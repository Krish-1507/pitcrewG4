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

Model gateway: @napi-rs/keyring 2.1.0 (MIT, runtime) provides OS credential storage using prebuilt native bindings. Linux explicitly uses Secret Service without volatile fallback. Configuration: yaml 2.9.1 (ISC, runtime) parses the documented YAML format with aliases disabled and strict Zod validation.

Browser lab: playwright-core 1.64.1 (Apache-2.0, runtime) drives a locally installed Chrome or Edge; no browser is downloaded by the package. axe-core 4.14.0 (MPL-2.0, runtime) is injected into pages for accessibility audits. Both are isolated in `packages/browser-lab`.
