# antwork

<!-- impeccable:product-schema 1 -->

## Platform

Windows desktop app with a download website and documentation.

## Users and purpose

People who enjoy game career histories and want flexible, visible progress in daily work. The core loop is to start a lock-in, record honest work time, write a private journal note, and review the calendar and session history.

## Product principles

- Make starting and recording work immediate and understandable.
- Rest days are neutral; work does not create quotas or missed-day debt.
- Reflection is prominent without awarding points for writing.
- Viewing stays compact; editing happens in focused popup windows.
- Keep personal history local and exportable.
- Make returning feel satisfying without making sound or motion mandatory.

## Capabilities and constraints

React and TypeScript with local IndexedDB storage, five hash-routed app pages, timers, manual sessions, campaigns, journals, day ratings, and career statistics. Profile identity editing and username onboarding are retired; existing identity data stays in storage and backups. No accounts, public sharing, global handle reservations, or cloud uploads. Score is one point per fifteen cumulative saved minutes. Existing records and backups must migrate without losing timestamp precision.

Previously saved profile media remains available in backups. Timer backgrounds are normalized locally to static WebP. New installs start with interface sounds and countdown alarms on, controlled together by a persistent top-bar mute button. Existing silent installs remain silent until unmuted. Startup branding appears only during real local-history loading.

Worked-day achievement cards show saved hours and manual day quality in a Calendar popup, with one optional picture or silent looping video background per date. The [feature plan](docs/plans/2026-10-07-worked-day-cards.md) records the agreed limits and backup behavior.

## Brand commitments

Lowercase antwork, Rubik, compact game-HUD language, Black/White appearance with Black as the new-install default, circular avatars, rounded opaque cards, and glass limited to floating surfaces. Journal and calendar are central. The floating dock keeps all five destinations visible.
