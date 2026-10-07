# Roadmap

antwork's intended destination is a public hosted product. The current beta tests a smaller question first: will a fast lock-in loop and an honest history make people want to return? No retention or productivity result is claimed yet.

## Beta learning

Polish the five-page local flow, observe usability with consent, and fix confusing session, journal, crop, or backup behavior. Keep work hours truthful and rest days neutral. Document meaningful decisions and verified observations rather than turning proposals into promises.

## Worked-day cards

The v1.1.0 work adds a daily achievement card opened from Calendar for dates with saved work. It shows saved hours and the existing Good, Steady, Rough, or Unrated day quality, with one optional picture or silent looping video background. Media travels with JSON backups under explicit size limits. Larger media collections remain outside this version's 32 MiB backup boundary.

## Desktop platforms

The first desktop build targets Windows 11 x64 for personal use, then trusted testers. Verify Windows 10 22H2 compatibility before claiming it. Trusted distribution needs installer, upgrade, accessibility, scaling, and signing checks on clean Windows machines. macOS and Linux are deferred until the Windows workflow is settled. Accounts remain outside this desktop release.

## Hosted-service foundation

Before user content is uploaded, design account authorization, encrypted free text, passphrase and printable recovery key, backup and key-loss behavior, server-side rate and resource limits, and an abuse model. Choose a cloud database only after those boundaries and data ownership are clear. A static Vercel deployment by itself does not need an app API rate limiter because it has no app API.

## Timer companion concept

A future active-timer island could appear across pages only while a session is running or paused. At rest it would be a small timer pill; expansion would expose pause, resume, and finish. Timers would still own setup, countdown selection, and completion review. A design pass must test collision with the top bar, editor dialogs, the bottom dock, keyboard focus, and narrow phones before this becomes a build task.

Other ideas - rest-time accounting, speedrun conditions, paid animated identity, rankings, and optional sign-in - remain research questions, not beta features. Rest deductions in particular need a rule that keeps raw worked time, rest time, and Score understandable.
