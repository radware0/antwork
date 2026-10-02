# Data and privacy

Your work history lives in this browser's IndexedDB. The current app has no account, analytics, tracking service, cloud database, or sync endpoint. Deploying the static site does not upload your journals, session notes, profile images, or work history to the app owner.

Local does not mean encrypted. Someone with access to your browser profile or an exported backup may be able to read the data. JSON backups include free text and profile images in readable form. Keep a backup somewhere you trust; clearing site data, changing devices, or moving to a different site origin can leave the new browser without this history until you import a backup. This beta accepts backup files up to 32 MiB; a very large local history may exceed that import limit.

## Before a hosted account exists

The public beta should be evaluated as a single-browser tool. Do not treat it as a private cloud vault, multi-device service, or guaranteed alarm. A countdown chime needs antwork open and a browser that allows audio after interaction. The visible review and saved session are the authoritative record.

The planned hosted product requires a separate security design before uploads: account authorization, server-side rate and size limits, abuse monitoring that does not inspect private free text, encrypted sync, passphrase and recovery-key behavior, and a threat model. The goal is for the operator not to be able to read users' free text. That property is **not** claimed for the current beta or its unencrypted JSON exports.
