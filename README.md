# antwork

antwork makes flexible deep work visible. Start a lock-in, save honest work hours, write a private daily note, and review your history like a game career screen. This is a local-first public beta: there are no accounts or cloud sync.

Try the beta at [antwork-five.vercel.app](https://antwork-five.vercel.app/).

Read the [project story and progress](docs/JOURNEY.md), written for this repository.

## Run locally

Use Node.js 22.18+ or 24.x and run `npm ci`, then `npm run dev`. Open `http://localhost:5173`. On Windows PowerShell, use `npm.cmd` if `npm` is blocked by execution policy.

Run `npm test` for unit tests and `npm run build` for the static app plus documentation in `dist/`. With the development server and Playwright Chromium available, `npm run test:browser` checks the full daily loop.

## Windows app

The desktop build uses Electron. Run `npm exec -- install-electron --no` once to download the development runtime, then `npm run desktop:start`. Run `npm run desktop:release` for the guided Windows x64 installer at `release/windows/out/antwork-1.0.0-Setup.exe`. It asks for the install location and whether to install for the current user or everyone, then shows installation progress. Installing for everyone requests administrator access. It bundles the runtime and works offline without a development server. Other platforms are deferred.

Timers continue when minimized or the screen is locked. Windows sleep and app close pause the timer; resume it manually. Updates are manual. Desktop history lives in `%APPDATA%\antwork`, separately from the website, and survives uninstall. Move existing history through Profile's JSON export/import workflow. Import replaces the destination history.

Read the [Windows instructions](docs/windows.md) and [researched checklist](docs/windows-app-checklist.md). `npm run test:desktop` checks the built launcher with isolated test data; set `ANTWORK_QA_EXECUTABLE` to test a packaged executable. This personal build is unsigned, so Windows security may warn or block it. Windows 10 compatibility still requires testing on Windows 10.

## Read the docs

Start with the [overview](docs/index.md), [daily loop](docs/daily-loop.md), and [decision history](docs/decisions.md). The same Markdown becomes the `/docs/` section in the built site. [Development and deployment](docs/development.md) covers GitHub and Vercel preparation; [data and privacy](docs/privacy.md) explains the current local-only boundary.

Your data stays in this browser's IndexedDB unless you export it. JSON backups contain readable personal text and images. Export a backup before clearing site data or moving to another domain.

New workspaces open in Black; switch between Black and White from the top bar. The chart adapts the registry-installed EvilCharts component; the minimal dock and liquid theme switch adapt supplied source. Applicable licenses are recorded in [third-party notices](THIRD_PARTY_NOTICES.md). No project-wide license has been granted for antwork.

On desktop, the Timers panel can be moved and resized. Add a local image background and adjust its opacity and blur from **Customize timer**. The Windows app also offers **Pop out timer**, with controls synchronized to the main window. Profile identity editing and username onboarding are deprecated; career statistics remain. Existing identity data stays in backups. Campaign descriptions are optional. JSON backups use schema version 5; this build imports versions 1–5, but older builds cannot import v5 backups.
