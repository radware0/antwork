# Data and privacy

Your work history lives on your computer in the Windows app's IndexedDB profile. The app has no account, analytics, tracking service, cloud database, or sync endpoint. The website is a download page and documentation; it does not access your work history.

The local profile and backups are unencrypted. Someone with access to either may be able to read the data. JSON backups include free text, profile images, and day-card pictures and videos. Keep a backup somewhere you trust so you can restore your history after changing computers or deleting the app's profile. The app accepts backup files up to 32 MiB. New changes that grow beyond this size are rejected so exported history remains importable; existing larger legacy history remains readable and can be reduced.

## Windows desktop history

The Windows app keeps its IndexedDB profile under `%APPDATA%\antwork`. App files and documentation are bundled locally; normal use needs no account or network connection. History from the former web app stays in its browser profile. The download page does not open or clear that data. You can import a previously exported JSON backup into the desktop app. Import replaces desktop history; export that history first if it matters.

Uninstalling removes application files but preserves this profile. Reinstalling restores access to the retained history. To explicitly delete desktop history, close antwork, export a backup if wanted, then delete the `antwork` folder under `%APPDATA%`. Exported backups remain wherever you saved them. The profile and exports are unencrypted.

## Before a hosted account exists

antwork stores history on one computer and does not sync it between devices. A countdown chime needs the app running with sound enabled. The visible review and saved session are the work record.

The planned hosted product requires a separate security design before uploads: account authorization, server-side rate and size limits, abuse monitoring that does not inspect private free text, encrypted sync, passphrase and recovery-key behavior, and a threat model. The goal is for the operator not to be able to read users' free text. That property is **not** claimed for the current beta or its unencrypted JSON exports.
