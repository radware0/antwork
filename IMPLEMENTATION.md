# Implementation notes

The [documentation overview](docs/index.md) is the public entry point. [Decision history](docs/decisions.md) records the app's shift from fixed targets and quests to flexible hours without inventing dates. [Architecture](docs/architecture.md) describes current storage, migration, and time accounting; [development and deployment](docs/development.md) contains commands and release checks.

Development before the public beta baseline has no Git history. The old implementation ledger mixed past-state claims with current rules and fixed test counts; it has been replaced rather than presented as a changelog.

## Current build

React and TypeScript are bundled through `scripts/app.mjs` with esbuild. That script also turns the versioned Markdown in `docs/` into static `/docs/` pages in `dist/`. The app uses five hash-routed pages and a single IndexedDB document behind `LedgerRepository`. The database remains `work-ledger`, store `documents`, and backups remain schema version 4 with imports from versions 1-4.

Sessions are either precise intervals or a date plus whole-minute duration. Shared calculations supply calendars, charts, campaign totals, career stats, and Score. New installs use Black appearance and sound on; stored System and Slate resolve to Black, White stays White, and older sound settings remain intact. The registry-installed line chart is code-split and loaded when visible. No backend, cloud database, or server API exists in this beta.

## Verification

Use `npm test`, `npm run build`, and the Chromium browser workflow in `qa/smoke.mjs` against a running development server. Record fresh results for each release rather than relying on historical counts. Do not commit local JSON backups or generated screenshots.
