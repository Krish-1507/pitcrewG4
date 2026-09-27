# Dependencies

All initial direct dependencies use the MIT license.

Runtime: Zod validates untrusted API, provider and configuration data.

Development: TypeScript and Node types provide strict compilation; ESLint,
typescript-eslint and Prettier enforce style; Vitest runs discriminating tests;
Turborepo schedules workspace builds. pnpm manages the lockfile and workspaces.

No agent framework is used. Platform APIs provide HTTP, Git process launch,
hashing, cancellation and filesystem operations.

OpenPitStop 1.10.0 (MIT) is development-only and invoked through its public CLI.
Node SQLite avoids an additional runtime database dependency.

Repository intelligence: @vscode/tree-sitter-wasm 0.3.1 (MIT, runtime) bundles the parser and prebuilt grammars. JS/TS, Python, Rust and Go grammars are loaded on demand; no compiler toolchain or native parser install scripts are required.
