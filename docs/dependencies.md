# Dependencies

All initial direct dependencies use the MIT license.

Runtime: Zod validates untrusted API, provider and configuration data.

Development: TypeScript and Node types provide strict compilation; ESLint,
typescript-eslint and Prettier enforce style; Vitest runs discriminating tests;
Turborepo schedules workspace builds. pnpm manages the lockfile and workspaces.

No agent framework is used. Platform APIs provide HTTP, Git process launch,
hashing, cancellation and filesystem operations.
