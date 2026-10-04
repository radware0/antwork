# antwork

antwork makes flexible deep work visible. Start a lock-in, save honest work hours, write a private daily note, and review your history like a game career screen. This is a local-first public beta: there are no accounts or cloud sync.

Try the beta at [antwork-five.vercel.app](https://antwork-five.vercel.app/).

Read the [project story and progress](docs/JOURNEY.md), written for this repository.

## Run locally

Use Node.js 22.x (22.18 or newer) and run `npm ci`, then `npm run dev`. Open `http://localhost:5173`. On Windows PowerShell, use `npm.cmd` if `npm` is blocked by execution policy.

Run `npm test` for unit tests and `npm run build` for the static app plus documentation in `dist/`. With the development server and Playwright Chromium available, `npm run test:browser` checks the full daily loop.

## Read the docs

Start with the [overview](docs/index.md), [daily loop](docs/daily-loop.md), and [decision history](docs/decisions.md). The same Markdown becomes the `/docs/` section in the built site. [Development and deployment](docs/development.md) covers GitHub and Vercel preparation; [data and privacy](docs/privacy.md) explains the current local-only boundary.

Your data stays in this browser's IndexedDB unless you export it. JSON backups contain readable personal text and images. Export a backup before clearing site data or moving to another domain.

New workspaces open in Black; switch between Black and White from the top bar. The chart adapts the registry-installed EvilCharts component; the minimal dock and liquid theme switch adapt supplied source. Applicable licenses are recorded in [third-party notices](THIRD_PARTY_NOTICES.md). No project-wide license has been granted for antwork.

On desktop, the Timers panel can be moved and resized. Add a local image background and adjust its opacity and blur from **Customize timer**. New workspaces are asked once for a local username and can skip it. Campaign descriptions are optional. JSON backups use schema version 5; this build imports versions 1–5, but older builds cannot import v5 backups.
