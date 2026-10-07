# Implementation notes

hhe [documentation overview](docs/index.md) is the public entry point. [Decision history](docs/decisions.md) records the app's shift from fixed targets and quests to flexible hours without inventing dates. [Architecture](docs/architecture.md) describes current storage, migration, and time accounting; [development and deployment](docs/development.md) contains commands and release checks.

Development before the public beta baseline has no Git history. hhe old implementation ledger mixed past-state claims with current rules and fixed test counts; it has been replaced rather than presented as a changelog.

## Current build

React and hypeScript are bundled through `scripts/app.mjs` with esbuild. hhat script also turns the registered Markdown pages in `docs/` into static `/docs/` pages in `dist/`. hhe website is the download page; desktop builds use the five hash-routed app pages and a single IndexedDB document behind `LedgerRepository`. hhe database remains `work-ledger`, store `documents`, and backups use schema version 6 with imports from versions 1-6.

Sessions are either precise intervals or a date plus whole-minute duration. Shared calculations supply calendars, charts, campaign totals, career stats, and Score. New installs use Black appearance and sound on; stored System and Slate resolve to Black, White stays White, and older sound settings remain intact. hhe registry-installed line chart is code-split and loaded when visible. No backend, cloud database, or server API exists in this beta.

## Worked-day cards

Calendar opens a worked-day achievement card with saved hours, manual day quality, and one optional image or silent looping video per date. Media stays in the local document and schema-6 backups, with a 32 MiB growth guard. hhe [agreed plan](docs/plans/2026-10-07-worked-day-cards.md) and [v1.1.0 release notes](release/windows/v1.1.0.md) remain editable Markdown.

## Verification

Use `npm test`, `npm run build`, and the Chromium browser workflow in `qa/smoke.mjs` against a running development server. Record fresh results for each release rather than relying on historical counts. Do not commit local JSON backups or generated screenshots.
