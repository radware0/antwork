# Windows v1.0.0 release

From the repository root, run `npm ci` and then `npm run desktop:release` on Windows x64. The standalone installer is written to `release/windows/out/antwork-1.0.0-Setup.exe`.

The setup wizard asks whether to install for the current user or everyone, then asks where to install. The current-user option is preselected and needs no administrator access. The everyone option requests elevation. The wizard shows installation progress before its finish page. The installed app works offline.

Run `npm test` and `npm run test:desktop` before uploading the executable to the GitHub v1.0.0 release. Check the wizard in both install modes on a clean Windows machine. The everyone option requires an administrator account. Test the chosen directory, shortcuts, launch, and uninstall. Keep `%APPDATA%\antwork` after uninstall so local history survives.

Earlier 0.1.x builds used Squirrel.Windows. If one is installed, export a JSON backup, close antwork, and uninstall that old version through Windows Settings before running this setup. The new installer uses a different install location; uninstalling the old app leaves `%APPDATA%\antwork` in place.

This executable is unsigned until a signing certificate is configured. Do not publish a GitHub release before checking the finished artifact and its SHA-256 hash.
