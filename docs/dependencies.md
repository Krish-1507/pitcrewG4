# Dependencies

All initial direct dependencies use the MIT license.

Runtime: Zod validates untrusted API, provider and configuration data.

Development: TypeScript and Node types provide strict compilation; ESLint,
typescript-eslint and Prettier enforce style; Vitest runs discriminating tests;
Turborepo schedules workspace builds. pnpm manages the lockfile and workspaces.
esbuild 0.28.2 (MIT, development) bundles the CLI and daemon into the global npm
artifact so the published package has no `workspace:*` dependencies.

No agent framework is used. Platform APIs provide HTTP, Git process launch,
hashing, cancellation and filesystem operations.

OpenPitStop 1.10.0 (MIT) is development-only and invoked through its public CLI.
Node SQLite avoids an additional runtime database dependency.

Repository intelligence: @vscode/tree-sitter-wasm 0.3.1 (MIT, runtime) bundles the parser and prebuilt grammars. JS/TS, Python, Rust and Go grammars are loaded on demand; no compiler toolchain or native parser install scripts are required.

Model gateway: @napi-rs/keyring 2.1.0 (MIT, runtime) provides OS credential storage using prebuilt native bindings. Linux explicitly uses Secret Service without volatile fallback. Configuration: yaml 2.9.1 (ISC, runtime) parses the documented YAML format with aliases disabled and strict Zod validation.

Web research and Quick Assistant add no dependency. They use the Node.js built-in `fetch`, `AbortSignal`, `node:http`, and the existing Zod schemas. The default searcher is the keyless DuckDuckGo HTML endpoint (no key, no package); SearXNG and Brave are external services configured by environment variable. Memory notes and assistants use the existing Node SQLite store and migration 4.

Desktop app: Electron 38.2.2 (MIT, development of `apps/desktop`) provides the native window and tray, and electron-builder 26.0.12 (MIT, development) produces the Windows NSIS installer. Both are devDependencies of `@pitcrew/desktop` only; they never enter the CLI runtime. The Electron toolchain resolves one git dependency (`@electron/node-gyp`), allowed deliberately in `.npmrc` and documented there. The desktop shell imports only Node and Electron APIs; it spawns the same daemon entry the CLI uses and runs no mission logic.

Desktop packaging adds no runtime dependency: `scripts/build-desktop-resources.mjs` stages the already-built daemon bundle, Mission Control assets, and the three packages that stay external in that bundle (openpitstop 1.10.0, playwright-core 1.64.1, @vscode/tree-sitter-wasm 0.3.1 — each already recorded above), and `scripts/package-desktop.mjs` copies them into the packaged app because electron-builder's file matcher excludes node_modules directories from extraResources. `scripts/repair-electron.mjs` verifies the cached Electron zip checksum and expands it with the platform archive tool; it adds no dependency and only replaces the broken extraction path.

Browser lab: playwright-core 1.64.1 (Apache-2.0, runtime) drives a locally installed Chrome or Edge; no browser is downloaded by the package. axe-core 4.14.0 (MPL-2.0, runtime) is injected into pages for accessibility audits. Both are isolated in `packages/browser-lab`.

Global CLI artifact: the packaged `@pitcrew/cli` declares `openpitstop` as an
external runtime dependency so the referee stays a separate process, and keeps
`playwright-core` and `@vscode/tree-sitter-wasm` external because they load
local browser and grammar assets at runtime. Everything else is bundled.
