# Windows v1.1.0 release

From the repository root, run `npm ci` and then `npm run desktop:release` on Windows x64. The standalone installer is written to `release/windows/out/antwork-1.1.0-Setup.exe`. The desktop renderer is built into `app-dist/`; the download website uses `dist/` separately.

The setup wizard asks whether to install for the current user or everyone, then asks where to install. The current-user option is preselected and needs no administrator access. The everyone option requests elevation. The wizard shows installation progress before its finish page. The installed app works offline.

Run `npm test`, then set `ANTWORK_QA_EXECUTABLE` to `release/windows/out/win-unpacked/antwork.exe` and run `npm run test:desktop` and `npm run test:day-cards`. Upgrade preservation can be checked with `node --experimental-strip-types qa/upgrade-check.mjs` using `ANTWORK_QA_OLD_EXECUTABLE` for a v1.0.0 packaged app and `ANTWORK_QA_EXECUTABLE` for v1.1.0. This uses an isolated shared profile and does not replace an installed application.

The personal v1.1.0 release is tested on Windows 11 x64 and is unsigned. Windows 10 compatibility and clean-machine NSIS walkthroughs for both install scopes remain untested. Those walkthroughs should cover the selected directory, shortcuts, launch, uninstall, and actual installer replacement over v1.0.0. The everyone option requires an administrator account. Keep `%APPDATA%\antwork` after uninstall so local history survives. See [release notes](v1.1.0.md) for artifact details and validation.

Earlier 0.1.x builds used Squirrel.Windows. If one is installed, export a JSON backup, close antwork, and uninstall that old version through Windows Settings before running this setup. The new installer uses a different install location; uninstalling the old app leaves `%APPDATA%\antwork` in place.

This executable is unsigned until a signing certificate is configured. Do not publish a GitHub release before checking the finished artifact and its SHA-256 hash.
