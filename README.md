# antwork

antwork is a Windows app for timing your work and keeping a record of it. Start a stopwatch or countdown, save your hours, and look back through your calendar and daily notes. Career statistics give you a view of the work you've put in over time.

[Download v1.1.0 for Windows](https://github.com/radware0/antwork/releases/tag/v1.1.0). The [website](https://antwork-five.vercel.app/) now points to the app download and documentation.

The app works offline. Everything is saved on your computer, with no accounts or cloud sync.

## Install

Download `antwork-1.1.0-Setup.exe` from the release page and run it. Choose where to install it and whether it's for your Windows account or everyone. Installing for everyone asks for administrator access. The installer includes the runtime, so you don't need Node.js.

Windows 11 x64 is the tested target. Windows 10 still needs testing on a Windows 10 machine. This release is unsigned, so Windows security may warn or block it. The release notes list the remaining installer and compatibility checks.

If you're upgrading from a 0.1.x desktop build, export a backup, close antwork, and uninstall the old version first. Uninstalling keeps your history.

## Using it

Start a session from Dashboard or Timers. The timer keeps running while minimized or when the screen is locked. Sleep and quitting pause it; resume it when you're ready.

Use **Pop out timer** for a separate window you can move and resize. It stays in sync with the main window. You can add a local background image and adjust its opacity and blur. The app starts in Black; the theme toggle switches between Black and White.

In Calendar, select a date with saved work and choose **View day card**. The card shows saved hours and your Good, Steady, Rough, or Unrated day quality. Add one picture or silent looping video background per date. Videos loop automatically without playback controls; the transparent popup uses text shadows and a borderless day-quality label.

Profile shows your career statistics. Profile identity editing and username onboarding have been retired, but existing identity data stays in backups. Campaign descriptions are optional.

## Your history

Desktop history lives in `%APPDATA%\antwork` and survives uninstall. Updates are manual: export a backup, close the app, and run the newer installer.

Use Profile's JSON export to keep a backup. Backups contain readable personal text, images, and day-card videos. Importing replaces the destination history, so export that history first if you need it. Current exports use schema version 6; this build imports versions 1 through 6 with a 32 MiB limit. The v1.0.0 app cannot read schema-6 backups.

History from the former web app is separate from desktop history. You can import a previously exported browser backup into the Windows app.

## Working on the code

Use Node.js 22.18+ or 24.x. Run `npm ci`, then `npm run dev` to open the download page at `http://localhost:5173`. Use `npm run dev:app` to work on the app screens at `http://localhost:5174`. On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm`.

Run `npm test` for unit tests. `npm run build` builds the website and docs in `dist/`; with the development server running, `npm run test:browser` checks the download page. The app's browser checks are available through `npm run test:app:browser` with `dev:app` running.

For desktop development, run `npm exec -- install-electron --no` once to download Electron, then `npm run desktop:start`. `npm run test:desktop` checks the launcher with isolated test data; set `ANTWORK_QA_EXECUTABLE` to check a packaged executable. `npm run test:day-cards` checks the card and media behavior with the same setting.

Run `npm run desktop:release` to build the Windows installer at `release/windows/out/antwork-1.1.0-Setup.exe`. Other platforms are deferred.

## More about the project

Read the [project story](docs/JOURNEY.md), [overview](docs/index.md), [daily loop](docs/daily-loop.md), or [decision history](docs/decisions.md). The [Windows instructions](docs/windows.md) cover installation and timer behavior; the [checklist](docs/windows-app-checklist.md) records release checks. [Development and deployment](docs/development.md) covers builds and hosting, and [data and privacy](docs/privacy.md) explains storage.

The chart, dock, and theme switch use adapted component source. Credits and licenses are in [third-party notices](THIRD_PARTY_NOTICES.md). No project-wide license has been granted for antwork.
