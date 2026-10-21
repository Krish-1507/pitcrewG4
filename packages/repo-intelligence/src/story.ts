import { repoStorySchema } from '@pitcrew/protocol';
import type {
  RepoFact,
  RepositoryGraph,
  RepoStory,
  StoryItem,
  StoryView,
} from '@pitcrew/protocol';

function item(
  view: StoryView,
  statement: string,
  kind: StoryItem['kind'],
  facts: RepoFact | RepoFact[],
): StoryItem {
  const list = Array.isArray(facts) ? facts : [facts];
  const evidence = [
    ...new Map(
      list.map((entry) => [
        entry.evidence.path +
          ':' +
          entry.evidence.line +
          ':' +
          entry.evidence.digest,
        entry.evidence,
      ]),
    ).values(),
  ].slice(0, 8);
  return { view, statement, kind, evidence };
}

export function buildRepoStory(graph: RepositoryGraph): RepoStory {
  const items: StoryItem[] = [];
  const facts = graph.facts;
  const packages = facts.filter((fact) => fact.predicate === 'package');
  const scripts = facts.filter((fact) => fact.predicate.startsWith('script:'));
  for (const fact of packages)
    items.push(
      item(
        'product',
        'Package ' + fact.value + ' is declared.',
        'observed',
        fact,
      ),
    );
  for (const fact of scripts)
    items.push(
      item(
        'product',
        'Script ' +
          fact.predicate.slice('script:'.length) +
          ' runs: ' +
          fact.value,
        'observed',
        fact,
      ),
    );
  const languages = new Map<string, RepositoryGraph['files']>();
  for (const file of graph.files) {
    const bucket = languages.get(file.language) ?? [];
    bucket.push(file);
    languages.set(file.language, bucket);
  }
  for (const [language, files] of [...languages].sort(([a], [b]) =>
    a.localeCompare(b),
  ))
    items.push({
      view: 'system',
      statement:
        files.length +
        ' ' +
        language +
        ' file' +
        (files.length === 1 ? '' : 's') +
        ' are indexed.',
      kind: 'observed',
      evidence: [
        ...new Map(
          files
            .slice(0, 4)
            .map((file) => [
              file.path + ':' + file.digest,
              { path: file.path, line: 1, digest: file.digest },
            ]),
        ).values(),
      ],
    });
  for (const file of graph.files.filter((entry) =>
    /(?:^|\/)index\.[cm]?[jt]sx?$|(?:^|\/)main\.[cm]?[jt]sx?$/.test(entry.path),
  ))
    items.push({
      view: 'system',
      statement:
        file.path + ' is an entry-point candidate by file naming convention.',
      kind: 'inferred',
      evidence: [{ path: file.path, line: 1, digest: file.digest }],
    });
  for (const route of facts.filter(
    (fact) => fact.predicate === 'possible_route',
  ))
    items.push(
      item(
        'request-journey',
        'Possible route ' + route.value + '.',
        'inferred',
        route,
      ),
    );
  for (const relation of graph.relationships
    .filter((entry) => entry.relation === 'imports')
    .slice(0, 80))
    items.push(
      item(
        'change-impact',
        relation.from + ' imports ' + relation.to + '.',
        relation.kind,
        {
          id: 'story-' + items.length,
          subject: relation.from,
          predicate: 'imports',
          value: relation.to,
          kind: relation.kind,
          evidence: relation.evidence,
          dependencies: {},
          stale: false,
        },
      ),
    );
  for (const testFile of facts.filter((fact) => fact.predicate === 'test_file'))
    items.push(
      item(
        'change-impact',
        testFile.subject +
          ' carries verification responsibility and must stay unchanged by an implementer.',
        'inferred',
        testFile,
      ),
    );
  for (const boundary of facts.filter((fact) =>
    ['package', 'ci_configuration', 'data_boundary', 'lockfile'].includes(
      fact.predicate,
    ),
  ))
    items.push(
      item(
        'change-impact',
        'Changing ' +
          boundary.subject +
          ' invalidates repository facts that depend on it.',
        'inferred',
        boundary,
      ),
    );
  const observed = facts.filter((fact) => fact.kind === 'observed').length;
  const inferred = facts.filter((fact) => fact.kind === 'inferred').length;
  const declared = facts.filter((fact) => fact.kind === 'user_declared').length;
  const sample = facts[0];
  if (sample)
    items.push(
      item(
        'trust',
        observed +
          ' observed, ' +
          inferred +
          ' inferred and ' +
          declared +
          ' user-declared facts are recorded with source evidence.',
        'observed',
        sample,
      ),
    );
  items.push({
    view: 'trust',
    statement:
      'Repository boundary digest ' +
      graph.boundaryDigest.slice(0, 12) +
      ' covers manifest, authorization, CI and schema files.',
    kind: 'observed',
    evidence: [
      ...new Map(
        graph.files
          .filter((file) =>
            /package\.json|auth|permission|\.github|\.gitlab|schema|migration/i.test(
              file.path,
            ),
          )
          .slice(0, 8)
          .map((file) => [
            file.path + ':' + file.digest,
            { path: file.path, line: 1, digest: file.digest },
          ]),
      ).values(),
    ],
  });
  const deduped = [
    ...new Map(
      items.map((entry) => [entry.view + '\0' + entry.statement, entry]),
    ).values(),
  ];
  return repoStorySchema.parse({
    root: graph.root,
    head: graph.head,
    boundaryDigest: graph.boundaryDigest,
    items: [...deduped].filter((entry) => entry.evidence.length > 0),
    limitations: graph.limitations,
  });
}
