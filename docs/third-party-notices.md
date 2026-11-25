# Third-party notices

PitCrew depends on the following direct packages. Full license texts are distributed with each package.

| Package                  | Version | License    | Role                                                                       |
| ------------------------ | ------- | ---------- | -------------------------------------------------------------------------- |
| zod                      | 3.25.76 | MIT        | Boundary validation                                                        |
| yaml                     | 2.9.1   | ISC        | Strict configuration parsing                                               |
| @napi-rs/keyring         | 2.1.0   | MIT        | Operating system credential storage                                        |
| @vscode/tree-sitter-wasm | 0.3.1   | MIT        | Repository parsing                                                         |
| playwright-core          | 1.64.1  | Apache-2.0 | Browser automation via an installed Chrome or Edge                         |
| axe-core                 | 4.14.0  | MPL-2.0    | Accessibility audit injected into the page                                 |
| openpitstop              | 1.10.0  | MIT        | Independent verification (development dependency, public CLI only)         |
| electron                 | 38.2.2  | MIT        | Desktop shell (development dependency of `@pitcrew/desktop`)               |
| electron-builder         | 26.0.12 | MIT        | Windows installer packaging (development dependency of `@pitcrew/desktop`) |

Development tooling: TypeScript, ESLint, typescript-eslint, Prettier, Vitest, Turborepo under their respective open-source licenses.

Vendored skills credit their origins and licences inside each `SKILL.md`:
`design-taste-frontend` (adapted from Leonxlnx/taste-skill, MIT), `unslop`
(adapted from unslop.live/SKILL.md), `graphify` (adapted from
Graphify-Labs/graphify, Apache-2.0), `ponytail` (adapted from
DietrichGebert/ponytail, MIT) and `web-research` (guardrail approach adapted
from Cedriccmh/claude-code-skill-scrapling, MIT, implemented over PitCrew's
own keyless searcher without bundling Scrapling).

No code from OpenPitStop is imported into the PitCrew runtime. The referee is invoked as a separate executable and its verdict is recorded as evidence.
