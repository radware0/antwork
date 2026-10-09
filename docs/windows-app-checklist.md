# Windows application checklist

**Current release: v1.1.0.** The release setup uses the guided NSIS wizard in `release/windows/`. It asks for current-user or all-users installation, allows a destination folder, and shows progress. The older Squirrel installation evidence below describes 0.1.x builds. Clean-machine NSIS walkthroughs and actual installer replacement remain open checks; the personal release records these limits in its [release notes](../release/windows/v1.1.0.md).

Researched with Firecrawl on 6 October 2026. This checklist combines official Windows and desktop-framework documentation with antwork's current code. Checked planning items record the user's decisions; unchecked items remain open decisions or release checks.

The first desktop release is for personal use, before trusted testers. It uses Electron and Electron Forge with a per-user installer without administrator access, reuses the current screens, and works offline after installation. Runtime downloads are allowed; this implementation bundles Electron. Accounts remain deferred. Windows 11 x64 is required; Windows 10 22H2 x64 compatibility is desired and still needs testing. Other platforms belong to a later roadmap. Updates are manual and uninstall preserves history until explicitly deleted.

## What the repository already tells us

antwork is a React and TypeScript app with a static esbuild output. It has local fonts, hash navigation, and no application backend. The build emits `/assets/`, `/fonts/`, and `/docs/` URLs that the desktop environment must resolve. See [the build script](../scripts/app.mjs), [architecture](architecture.md), and [package metadata](../package.json).

History lives in IndexedDB. A desktop browser profile will not automatically contain the history from the existing website. JSON export/import is the current transfer path; importing replaces history. The refreshed v1.1.0 build supports schema versions 1–7 and a 32 MiB input limit. Schema-7 exports require the refreshed installer, including for users who already installed the original v1.1.0 build. See [storage](../src/storage.ts), [backup controls](../src/components/ProfileView.tsx), and [validation](../src/validation.ts).

Browser timer recovery uses persisted wall-clock timestamps. The desktop bridge now pauses at sleep or close and recovers an interrupted timer as paused at its durable checkpoint. Minimize and screen lock keep it running. Alarms run in the renderer, so a fully exited app cannot sound them. See [timer calculations](../src/domain.ts), [desktop lifecycle](../desktop/runtime.cjs), [timer recovery](../src/useLedger.ts), and [sound](../src/sound.ts).

## Decisions before packaging

- [x] Start with personal use, then consider trusted testers.
- [x] Target Windows 11 x64 and seek Windows 10 x64 compatibility. The proposed Windows 10 test target is 22H2; actual installer compatibility still needs testing.
- [x] Deliver a per-user installer `.exe` without administrator access.
- [x] Keep the current screens and offline local data. Accounts remain deferred; extra desktop features are outside the initial scope unless required by the timer decisions.
- [x] Allow runtime downloads during installation. The installed application's normal use must work offline.
- [x] Use Electron and Electron Forge.
- [x] Keep the current JSON export/import workflow; importing replaces destination history.
- [x] Continue timers when minimized or locked; pause on sleep and app close/quit, with manual resume.
- [x] Use manual updates for personal use.
- [x] Preserve history through uninstall until the user explicitly deletes it.

Two practical wrapper options are:

- **Electron with Electron Forge:** the official distribution guide recommends Forge; its Squirrel.Windows maker generates a `Setup.exe` and update artifacts and supports installation without administrator rights. Keeping the desktop layer in JavaScript/TypeScript is a practical reason to evaluate this option first for this repository. [Electron distribution](https://www.electronjs.org/docs/latest/tutorial/application-distribution), [Squirrel.Windows](https://www.electronforge.io/config/makers/squirrel.windows).
- **Tauri:** Windows development requires Rust, Microsoft C++ Build Tools, and WebView2. Its Windows bundler produces an NSIS setup executable or MSI. The default installer downloads WebView2 if missing; offline installation needs a different runtime-bundling choice. Evaluate this option if its build-tool requirements fit the project. [Prerequisites](https://v2.tauri.app/start/prerequisites/), [Windows installer](https://v2.tauri.app/distribute/windows-installer/).

Windows 10 compatibility is feasible at the framework level. Electron's current breaking-change documentation specifies Windows 10 or later for Electron 23 and higher. Microsoft says the WebView2 Runtime receives updates on Windows 10 22H2 until at least October 2028. These statements support a compatibility target; the antwork installer still needs a Windows 10 test. [Electron Windows requirements](https://www.electronjs.org/docs/latest/breaking-changes#removed-windows-7--8--81-support), [Microsoft runtime support](https://learn.microsoft.com/en-us/deployedge/microsoft-edge-supported-operating-systems).

The development machine is Windows 11 Pro 24H2 x64. Node 24.21.0 and npm are installed; conventional Rust/Cargo and MSVC installations were not found. The repository now accepts Node 22.18+ and 24.x. Electron 44.5.1 and Forge 8.0.1 are pinned for this build. The local launcher opens on this machine; Smart App Control's state was not established by the read-only checks.

## Interview outcome

Both rounds are settled. The user approved the ten decisions above and authorized implementation. Crash recovery uses a native heartbeat every five seconds, so an unexpected exit can lose up to five seconds of unconfirmed work without charging closed time. Signing for distribution will be revisited before a tester release.

## Application package

- [x] Produce a fresh release build with local UI, fonts, images, chart chunks, and documentation. Packaged QA loads all five screens with the browser context offline and records no external requests.
- [x] Use the stable `antwork://app` origin, restrict served paths to bundled assets, and persist IndexedDB across launches. [Electron security](https://www.electronjs.org/docs/latest/tutorial/security#18-avoid-usage-of-the-file-protocol-and-prefer-usage-of-custom-protocols).
- [x] Launch the installed application independently of the repository and development server. Electron is bundled; users do not need developer tools.

## Data and timers

- [x] Use `%APPDATA%\antwork` for desktop history. Installed-app QA preserves real IndexedDB sessions, journals, and profile data across uninstall/reinstall; packaged QA preserves timer state across close and recovery.
- [x] Exercise JSON import/export in the packaged app and the existing browser workflow. Imports replace history; transfer instructions retain the original backup. No personal website backup was read during QA.
- [x] Unit and browser checks cover current/older backups, invalid files, size limits, and failed writes. Desktop QA verifies the native export destination and current-schema import. See [data and privacy](privacy.md).
- [x] Define timer states: minimize/lock continue; sleep/close/quit pause; reopen/wake require manual resume. Lifecycle-event and close/reopen tests pass.
- [x] Recover after an immediate exit without charging closed time. Unit checks cover backwards timestamps, date boundaries, and duplicate countdown settlement. The app takes a per-profile single-instance lock.
- [ ] Verify real hardware sleep, clock changes, and duplicate-instance behavior on tester machines. QA emits lifecycle events instead of suspending or locking this computer.
- [x] Verify application migration from v1.0.0 to v1.1.0 preserves sessions, journals, ratings, images, settings, and active timer state. Real old and new packaged apps used the same isolated profile; the timer recovered paused. Actual installer replacement remains a separate open check.
- [ ] Define when alarms must work and test those states, including muted sound. Windows sleep requires recovery behavior; an exited renderer cannot deliver an alarm. Electron exposes suspend/resume and Windows lock/unlock events if chosen. [Power monitor](https://www.electronjs.org/docs/latest/api/power-monitor).

## Windows usability

- [ ] Test title-bar controls, taskbar identity, Snap layouts, small windows, multiple monitors, and display scaling at 100%, 150%, and 200%.
- [ ] Test keyboard navigation, focus visibility, Narrator, contrast themes, larger text, and reduced motion. [Microsoft Windows app guidance](https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices).

## Security and publisher trust

- [x] Deny optional native permissions, restrict navigation, and send only validated HTTP/HTTPS links to the system browser. Renderer QA confirms no Node access, sandboxing, context isolation, and a narrow IPC bridge; Docs has no privileged bridge. A restrictive CSP is attached to local responses. [Electron security checklist](https://www.electronjs.org/docs/latest/tutorial/security#checklist-security-recommendations).
- [ ] Plan trusted signing and timestamps for released executables and installer components. Keep signing keys outside the repository and application package. [Microsoft security guidance](https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices#security-guidelines), [Windows signing setup](https://v2.tauri.app/distribute/sign/windows/).
- [ ] Test a browser-downloaded release with Windows security protections active. Signing establishes publisher identity, but a new signed binary can still receive a SmartScreen reputation warning. Use Microsoft's explanation for this distinction; the opening claim in Tauri's signing guide is too broad. [Microsoft SmartScreen reputation](https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/smartscreen-reputation).

## Installation, updates, and release

- [x] Set antwork's name, identifier, version, icon, and installer metadata. Bundle desktop license texts and retain Electron/Chromium notices. See [Squirrel metadata](https://www.electronforge.io/config/makers/squirrel.windows#mandatory-metadata) and [repository notices](../THIRD_PARTY_NOTICES.md).
- [x] Test standard-user installation, launch, uninstall, and reinstall on this Windows 11 host. The installer and app request `asInvoker`; the test token is not elevated. Verify the per-user Windows uninstall registration. Uninstall preserves the data profile.
- [x] Use manual updates. Instructions require exporting a backup and closing the app before installing a newer version. Existing import validation rejects unsupported backup schemas.
- [ ] Verify removal through Windows Settings UI and a newer-version upgrade on clean tester machines.
- [ ] Run the existing application checks, then test the actual installer on a clean machine for each supported target. Check launch time, idle CPU, memory, and active-timer behavior. [Microsoft installation and update guidance](https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices#installation-and-uninstallation), [performance guidance](https://learn.microsoft.com/en-us/windows/apps/get-started/best-practices#performance-and-fundamentals).
- [ ] Publish the chosen download with its version, supported systems, install instructions, release notes, backup instructions, and accurate local-data notice.

## Evidence and rerun inputs

The personal build is `out/make/squirrel.windows/x64/antwork-0.1.0-Setup.exe` (153,916,416 bytes). SHA-256: `e9ca403993fe3fb241ba8244d46247f6859d15147d3e1bdd9e54df95ef797583`. It is unsigned. Windows 10, browser-download reputation, physical sleep, multi-monitor scaling, Narrator, and clean-machine performance remain tester checks.

Verification on 6 October 2026, Windows 11 Pro 24H2 x64:

- `npm test`: 67 passed, zero failures.
- `npm run desktop:make`: production build, Windows x64 package, and Squirrel installer succeeded.
- `npm run test:browser`: five screens, two themes, four viewport sizes, zero browser errors.
- `ANTWORK_QA_EXECUTABLE` set to the packaged app, then `npm run test:desktop`: offline navigation/docs, native JSON export/import, minimize/lock behavior, sleep pause, manual resume, close/reopen, unexpected-exit recovery, and paused countdown passed. Screenshots are in `.qa/desktop-774272a8-cca8-419f-a8f8-71baa636bc1a/`.
- `node qa/desktop-install.mjs`: non-elevated installation, per-user registration, uninstall, and reinstall with retained IndexedDB history passed. Evidence is in `.qa/installer-573cb5c0-7b4f-45e1-a5c4-8ee57da42331/result.json`. The temporary installation was removed; synthetic test history remains in the isolated QA profile.
- `.qa/windows-package-audit.json`: only the four allowed roots enter `app.asar`; no local configuration, source maps, development dependencies, or QA data are included. Four complete desktop license texts and Windows documentation are present. Installer manifest requests no elevation.

Raw Firecrawl searches and Markdown extracts are saved in the gitignored `.firecrawl/` folder. The [source manifest](../.firecrawl/windows-checklist-sources.json) maps the eleven primary documentation pages to their saved evidence. Community answers returned by the SmartScreen search and a missing WebView2 URL were excluded from the checklist's evidence.

To refresh this research, use Firecrawl search and scrape with these inputs: Windows-only antwork desktop packaging; React/TypeScript and IndexedDB; Microsoft Learn, Electron/Electron Forge, and Tauri primary documentation; installation, offline assets, data transfer, timer lifecycle, accessibility, signing, and updates. Recheck the repository facts before reusing this checklist for a later release.

## v0.1.1 UI update ? October 6, 2026

Removed the outer application frame and deprecated profile identity editing and handle onboarding. Career overview, campaigns, backups, and previously stored identity data remain. The Windows timer pop-out shares the existing timer; closing it keeps the session running, while closing the main window pauses and closes both.

Installer: `out/make/squirrel.windows/x64/antwork-0.1.1-Setup.exe` (153,913,344 bytes), unsigned. SHA-256: `589ef5cd5d21858be01f5bf02dda9ce0bfdf579dae44996923c3889ef23ee484`.

Validation: 67 unit tests passed; browser smoke passed all five screens in two themes and four viewport sizes with no errors; packaged desktop smoke passed offline use, pop-out reuse, bidirectional controls, sleep pause, session review/save from the pop-out, closing both windows, retained history, crash recovery, and JSON transfer. Evidence: `.qa/desktop-34aba54a-7188-4658-81fd-2facdf9c2fb2/`. The installer was rebuilt; the earlier v0.1.0 install/uninstall evidence above remains historical.

## v0.1.2 timer-only pop-out ? October 6, 2026

The detached timer is now a frameless window filled entirely by its timer panel and optional background image. The surrounding padding, native title bar, and history hint are removed. Drag the timer header, resize from native window edges, and use its X button to close just that window.

Production compilation and packaged desktop smoke passed, including panel bounds matching the complete client area at 360?400, 640?400, and 1100?720, no native frame, the timer close button, countdown setup, synchronized controls, sleep pause, session save, retained history, and recovery. Evidence: `.qa/desktop-1cde41bd-45b1-4238-98d6-14a0f89c2749/`.

Installer: `out/make/squirrel.windows/x64/antwork-0.1.2-Setup.exe` (153,913,856 bytes), unsigned. SHA-256: `cc04f65a75c6ca6fde04391c0361b6d05433a260e2f911c142920c9da81f20c4`.

## v0.1.3 compact timer and tray ? October 6, 2026

The timer uses native movable/resizable window settings and retains Windows edge/corner resizing. Its clock, header, and background are draggable; interactive controls remain clickable. The minimum size is 280?200, with a compact clock/control view. No dependencies were added.

Minimize hides the main window in the Windows tray. The native tray offers Open antwork, Open timer, and Quit antwork; clicking its icon restores the main window. Close and Quit retain the existing pause-and-save behavior. Hidden windows clear their clock interval and enable Chromium background throttling. They remain loaded for quick restoration; this reduces background clock work without claiming that all Electron memory is released. A single native deadline completes a running countdown while hidden, including imported fractional durations. The recovery heartbeat remains in the main process.

Validation: 67 unit tests passed; browser smoke passed five screens in two themes and four viewport sizes; final packaged desktop QA passed minimize/hide, restore, stopped hidden clock redraws, compact and large resizing, draggable/non-draggable regions, synchronized controls, hidden countdown completion exactly once, sleep pause, close/reopen, crash recovery, retained history, and JSON transfer. Evidence: `.qa/desktop-c5a328ab-304b-4a92-984a-498c9f115c7a/`. Native window behavior was checked against the installed Electron types and [official BrowserWindow documentation](https://www.electronjs.org/docs/latest/api/browser-window); the Firecrawl source is saved at [electron-window-tray-visibility.md](../.firecrawl/electron-window-tray-visibility.md).

Installer: `out/make/squirrel.windows/x64/antwork-0.1.3-Setup.exe` (153,914,368 bytes), unsigned. SHA-256: `c63be9cd593adcae546670712b6757245b0fd5bbf6a3a691401566c208a2d205`.

## v0.1.4 full timer dragging - October 6, 2026

The complete timer panel is now the native drag region, including its padding, sides, corners, clock, and gaps between controls. Previously, only the inner content was draggable, and whole label and button-row boxes blocked dragging. Only actual buttons, inputs, dropdowns, text areas, and dialogs exclude dragging. The fix changes two CSS rules and adds no dependencies.

Validation: Windows `WM_NCHITTEST` reproduced the missing drag targets in v0.1.3. Production compilation and packaged desktop QA passed in v0.1.4, with native drag/control/resize targets checked at 280x200, 360x400, 640x400, and 1100x720, plus countdown setup. All eight native resize edges/corners remain available. The full desktop smoke also passed tray behavior, synchronized controls, session saving, offline use, sleep/close/recovery policy, history retention, and JSON transfer. Evidence: `.qa/desktop-3d7e5c4a-9392-436c-b539-75ef52c8f143/`. The native region approach follows [Electron's window interaction documentation](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions), scraped to [electron-custom-window-interactions.md](../.firecrawl/electron-custom-window-interactions.md).

Installer: `out/make/squirrel.windows/x64/antwork-0.1.4-Setup.exe` (153,914,368 bytes), unsigned. SHA-256: `bb564c27daf5f57e66544b87d1603cb21ba1b2432eb621966a5c6b667f346c33`.

## v0.1.5 custom title bars and glass controls - October 6, 2026

The main app and detached timer now use their existing headers as custom title bars, with Minimize, Maximize/Restore, and Close controls. Window requests use the existing trusted desktop bridge and a fixed action allowlist. Minimizing the main app still hides it in the tray; closing the timer leaves the session running, while closing the main app pauses and saves it. Controls remain available during startup and load errors.

Timer buttons, image controls, dropdowns, and number fields use translucent surfaces with thin borders and a small backdrop blur. Window controls use the same glass treatment. Blur stays confined to controls, and no dependencies were added. The compact title bar fits the 280x200 timer minimum.

Validation: production compilation, 67 unit tests, browser smoke across five pages in two themes and four viewport sizes, and final packaged desktop smoke passed. Native Windows hit tests verified title-bar dragging, clickable controls, full timer dragging, and all resize edges/corners. Actual custom buttons passed maximize/restore, keyboard activation, minimization, and close/reopen; offline use, synchronized controls, session saving, JSON transfer, sleep pause, crash recovery, and history retention also passed. The packaged main window is shown on-screen before testing its custom close button, avoiding the off-screen input timeout in the earlier test setup. Evidence: `.qa/desktop-babca55a-86d4-4c06-a861-42d11bad6f70/`. Official guidance is saved in [electron-custom-title-bar.md](../.firecrawl/electron-custom-title-bar.md) from [Electron's custom title-bar tutorial](https://www.electronjs.org/docs/latest/tutorial/custom-title-bar).

Installer: `out/make/squirrel.windows/x64/antwork-0.1.5-Setup.exe` (153,914,368 bytes), unsigned. SHA-256: `2b5ba53ce16faffa9d1201e082d00ccaed558fba7d1f8e0c92743de8f740cc29`.

## Original v1.1.0 worked-day cards - October 8, 2026

Calendar now opens an achievement card for today or past dates with saved work. It shows saved hours and the manual day rating, with one optional picture or silent looping MP4/WebM background. The screenshot review removed playback controls and the opaque popup frame; text shadows and a borderless day-quality label replace the dim overlay and badge. Videos run while visible, including with reduced motion enabled, and stop when hidden or closed.

Backups use schema 6 and include day media. Imports accept schemas 1 through 6; v1.0.0 cannot import the new exports. Growing writes above the 32 MiB backup limit retain saved data and the draft. The Close-button crash from a late native timer update is fixed and the packaged close/reopen check passes.

Validation on Windows 11 Pro x64:

- `npm test`: 71 passed, zero failures.
- Website and Windows release builds passed. Website smoke preserves the download page, both themes, responsive layout, browser history, and Docs synchronization.
- Packaged day-card checks passed for saved totals, ratings, image drafts, failed writes, both video formats, silence, automatic loops without controls, native hide/show, temporary URL cleanup, themes, narrow windows, media rejection, backup restoration, and size limits. Evidence: `.qa/day-cards-4dd429ed-bc04-44e4-b34d-64dcaa9e65ad/`.
- Full packaged desktop smoke passed offline screens and Docs, renderer isolation, window and tray behavior, synchronized pop-out controls, sleep-event pause, save/JSON transfer, close/reopen, and crash recovery. Evidence: `.qa/desktop-d7e3dbde-9bfc-46bb-a55f-8edc5df3f5e7/`.
- Real v1.0.0 and v1.1.0 binaries used one isolated profile and preserved hours, journals, ratings, identity data, images, settings, campaigns, and the paused timer. Evidence: `.qa/upgrade-89110156-a826-40c7-b7cb-22828f8c61e6/result.json`. Actual installer replacement was not tested.
- The final archive contains only `app-dist/`, `desktop-dist/`, package metadata, and third-party notices. Renderer, desktop bridge, and generated documentation match the final build. Evidence: `.qa/release-v1.1.0/package-audit.json`.

Installer: `release/windows/out/antwork-1.1.0-Setup.exe` (111,739,652 bytes), unsigned. SHA-256: `8e7c407f6920c0d2e29f96b464000ec850e1433b4f276e143232801b87d1de88`.

Windows 10, clean-machine NSIS walkthroughs for both scopes, actual installer replacement, physical sleep, Narrator, and multi-monitor scaling remain tester checks. Previous Squirrel installer results remain historical. The [v1.1.0 release notes](../release/windows/v1.1.0.md) include these limits and manual backup/update instructions.

## Refreshed v1.1.0 shared backgrounds - October 10, 2026

This update replaces the existing v1.1.0 installer and release notes without a version bump or new release. Calendar saves up to two picture/video choices; one selection applies to all day cards. The editor remains available without saved work. Older per-date media stays intact until a confirmed shared save, with backup export offered first. Backups now use schema 7 and import schemas 1 through 7; v1.0.0 and the original v1.1.0 build cannot read the new exports.

Validation on Windows 11 Pro x64:

- All 74 unit tests passed. Production website and Windows installer builds passed.
- Production website smoke passed download links, both themes, keyboard controls, responsive layout, preserved browser history, and Docs theme synchronization.
- Packaged day-card checks passed shared selection across dates, two slots, removal and blank cards, older-media confirmation/export, backup restoration, failure retention, bounded uploads, silent looping video playback, native visibility, themes, narrow windows, and temporary URL cleanup. Evidence: `.qa/day-cards-18f1ca87-8114-4b43-b729-b5be553b4205/`.
- Packaged desktop smoke passed offline navigation and Docs, renderer isolation, window/tray/pop-out controls, timer synchronization, sleep-event pause, JSON transfer, close/reopen, and crash recovery. Evidence: `.qa/desktop-56f50eee-be44-40f4-9a1b-6863a17b5345/`.
- The original v1.1.0 app and refreshed binary used the same isolated profile successfully. History, settings, a paused timer, and all three older per-date backgrounds survived. Evidence: `.qa/upgrade-cc621886-6937-4e7c-ace8-ae87ad3ad5fe/result.json`. Actual installer replacement was not tested.
- Package audit verified all 30 build files and third-party notices against the archive. It contains only `app-dist/`, `desktop-dist/`, package metadata, and notices. Evidence: `.qa/release-refresh-v1.1.0/package-audit.json`.

Replacement installer: `release/windows/out/antwork-1.1.0-Setup.exe` (111,741,556 bytes), unsigned. SHA-256: `5ead349844c53d6a572e90c3485db757d4d620571788e956422dec1f35e5f430`. The compatibility and installer checks listed above remain open.
