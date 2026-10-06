# Windows app

The Windows app keeps Dashboard, Timers, Calendar, Work Hours, and Profile available offline. Download it from [GitHub Releases](https://github.com/radware0/antwork/releases/latest). Accounts and other platforms are deferred. Windows 11 x64 is the primary target. Windows 10 22H2 x64 is a compatibility target that still needs testing on that system.

## Install and open

Run `antwork-1.0.0-Setup.exe`. Choose whether to install for your Windows user account or everyone, then choose the installation folder. Installing for everyone requests administrator access. The wizard displays progress while it installs. It bundles Electron, so you do not need Node.js or a development server. Launch antwork from its shortcut after installation. This build is unsigned; Windows security may warn or block it. No security setting is changed by antwork.

The installed app works offline. Documentation opens in a separate window so opening Docs does not interrupt your timer. Valid web links open in your default browser and need a connection to visit their websites.

## Bring your existing history

If you exported a JSON backup from the former web app:

1. Open the Windows app, go to Profile, and choose **Import JSON**.
2. Select your backup and review **Replace local history**. Export any existing desktop history first if you need it.
3. Confirm the replacement.

The website now serves the download page and Docs. It does not open or delete the browser's previous history. Browser and desktop profiles are separate. Backups contain readable personal text and images. Current exports use schema version 5; this build imports versions 1 through 5 with a 32 MiB file limit.

## Timer behavior

The main app and pop-out timer use custom title bars with **Minimize**, **Maximize/Restore**, and **Close** controls. Drag the main app's header to move it. The controls also work with the keyboard and show their action when hovered.

On Timers, choose **Pop out timer** to open just the timer in a borderless window. Drag the clock, header, or background to move it and resize from any edge or corner; the timer fills the available space. Timer buttons and setup fields use translucent glass surfaces over your background. At smaller sizes, the compact view keeps the clock and session controls; expand it to change mode or campaign. The X in the timer header closes that window. Both windows control the same session. Closing just the timer window leaves that session running; closing the main app pauses it and closes both windows.

- Minimize the main window: it hides in the Windows tray and the timer continues. Click its tray icon to reopen it; the tray menu also offers Open timer and Quit antwork.
- Screen locked: the timer continues.
- Windows sleep: the timer pauses at suspension.
- Close or quit: the timer pauses and history is saved.
- Reopen or wake: resume the timer manually.
- Unexpected exit: recover as paused at the last durable checkpoint. Up to five seconds of unconfirmed work may be lost.

Hidden windows stop their clock updates and use Chromium background throttling. A native countdown deadline keeps completion timely while the app is in the tray. The app remains loaded for quick reopening.

A countdown cannot finish from time spent asleep or with the app closed. Its alarm needs the app running and sound enabled. The saved session remains the work record.

## Update or remove

Updates are manual. Export a backup, close antwork, then run the newer installer. If upgrading from a 0.1.x Squirrel build, uninstall that old app through Windows Settings first; it used a different installation location. The app keeps the same local profile across updates.

Uninstall through Windows Settings. Your history remains under `%APPDATA%\antwork` until you explicitly delete it; reinstalling lets you use it again. To remove that history, close the app and delete that folder. Backups stay wherever you exported them.

Build instructions are in [Development and deployment](/docs/development/#windows-desktop-build).
