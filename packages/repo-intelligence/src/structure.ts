import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { dirname, extname, join, posix } from 'node:path';
import TreeSitter from '@vscode/tree-sitter-wasm';
import type {
  Node as SyntaxNode,
  Language as SyntaxLanguage,
} from '@vscode/tree-sitter-wasm';
import type {
  RepoFact,
  RepositoryGraph,
  SourceEvidence,
} from '@pitcrew/protocol';

const { Parser, Language } = TreeSitter;
const wasmRoot = dirname(
  createRequire(import.meta.url).resolve('@vscode/tree-sitter-wasm'),
);
let initialized: Promise<void> | undefined;
const languages = new Map<string, Promise<SyntaxLanguage>>();
const grammarByExtension: Record<string, string> = {
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.rs': 'rust',
  '.go': 'go',
};
export function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}
export function fact(
  subject: string,
  predicate: string,
  value: string,
  kind: RepoFact['kind'],
  evidence: SourceEvidence,
  dependencies: Record<string, string> = {},
): RepoFact {
  return {
    id:
      'fact_' +
      contentHash(
        JSON.stringify({ subject, predicate, value, evidence }),
      ).slice(0, 24),
    subject,
    predicate,
    value,
    kind,
    evidence,
    dependencies: { ...dependencies, [evidence.path]: evidence.digest },
    stale: false,
  };
}
export async function parseStructure(
  path: string,
  content: string,
  signal: AbortSignal,
): Promise<{
  facts: RepoFact[];
  imports: string[];
  errors: boolean;
  parser: string;
}> {
  const grammar = grammarByExtension[extname(path)];
  if (!grammar)
    return { facts: [], imports: [], errors: false, parser: 'not_configured' };
  initialized ??= Parser.init({
    locateFile: (file: string) => join(wasmRoot, file),
  });
  await initialized;
  if (!languages.has(grammar))
    languages.set(
      grammar,
      Language.load(join(wasmRoot, 'tree-sitter-' + grammar + '.wasm')),
    );
  const language = await languages.get(grammar)!;
  signal.throwIfAborted();
  const parser = new Parser();
  parser.setLanguage(language);
  parser.setTimeoutMicros(200000);
  const tree = parser.parse(content, null, {
    progressCallback: () => signal.aborted,
  });
  if (!tree) {
    parser.delete();
    return { facts: [], imports: [], errors: true, parser: 'tree-sitter' };
  }
  const facts: RepoFact[] = [];
  const imports: string[] = [];
  const digest = contentHash(content);
  function evidence(node: SyntaxNode): SourceEvidence {
    return { path, line: node.startPosition.row + 1, digest };
  }
  const stack = [tree.rootNode];
  let count = 0;
  try {
    while (stack.length) {
      signal.throwIfAborted();
      const node = stack.pop()!;
      if (++count > 50000) break;
      if (
        /^(function_declaration|function_definition|function_item|class_declaration|class_definition|method_definition|method_declaration|interface_declaration|type_alias_declaration|struct_item|enum_item|variable_declarator)$/.test(
          node.type,
        )
      ) {
        const name = node.childForFieldName('name');
        if (name)
          facts.push(
            fact(path, 'declares', name.text, 'observed', evidence(node)),
          );
      }
      if (
        /^(import_statement|import_from_statement|import_declaration|use_declaration)$/.test(
          node.type,
        )
      ) {
        const source =
          node.childForFieldName('source') ??
          node.childForFieldName('module_name') ??
          node.namedChildren.find(
            (child) =>
              child?.type === 'string' ||
              child?.type === 'interpreted_string_literal' ||
              child?.type === 'dotted_name',
          );
        if (source) {
          const target = source.text.replace(/^['"]|['"]$/g, '');
          imports.push(target);
          facts.push(fact(path, 'imports', target, 'observed', evidence(node)));
        }
      }
      if (node.type === 'call_expression') {
        const fn = node.childForFieldName('function');
        const args = node.childForFieldName('arguments');
        if (fn && /\.(get|post|put|patch|delete|route)$/.test(fn.text)) {
          const literal = args?.namedChildren.find(
            (child) => child?.type === 'string',
          );
          if (literal && /^['"]\//.test(literal.text))
            facts.push(
              fact(
                path,
                'possible_route',
                fn.text + ' ' + literal.text,
                'inferred',
                evidence(node),
              ),
            );
        }
      }
      stack.push(
        ...node.namedChildren.filter(
          (child): child is SyntaxNode => child !== null,
        ),
      );
    }
    const errors = tree.rootNode.hasError || count > 50000;
    return { facts, imports, errors, parser: 'tree-sitter' };
  } finally {
    tree.delete();
    parser.delete();
  }
}
export function linkImports(graph: RepositoryGraph): RepositoryGraph {
  const known = new Set(graph.files.map((file) => file.path));
  const relationships = graph.relationships.slice();
  for (const entry of graph.facts.filter(
    (item) => item.predicate === 'imports' && item.value.startsWith('.'),
  )) {
    const base = posix.normalize(
      posix.join(posix.dirname(entry.subject), entry.value),
    );
    const candidates = [
      base,
      ...['.ts', '.tsx', '.js', '.jsx', '.py', '.rs', '.go'].map(
        (extension) => base.replace(/\.js$/, '') + extension,
      ),
      ...['index.ts', 'index.tsx', 'index.js'].map((file) =>
        posix.join(base, file),
      ),
    ];
    const target = candidates.find((path) => known.has(path));
    if (target)
      relationships.push({
        from: entry.subject,
        to: target,
        kind: 'observed',
        relation: 'imports',
        evidence: entry.evidence,
      });
  }
  return { ...graph, relationships };
}
