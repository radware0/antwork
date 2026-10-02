# Architecture

antwork is a React 19 and TypeScript web app bundled by a small esbuild script. The five screens use hash navigation, so the static host serves one application entry point. Rubik carries the interface; Tailwind v4 and the existing theme-token CSS coexist without a global Tailwind reset. Profile avatar primitives use Base UI. The chart uses a registry-installed EvilCharts ECharts line chart in a lazy ESM chunk; the dock uses Magic UI and the top-bar Black/White pill uses SmoothUI. These installed sources are adapted to antwork tokens and documented in the repository's third-party notices. Motion is short, stateful, and disabled or reduced when the operating system requests less motion.

## Local data flow

The app loads one document from IndexedDB database `work-ledger`, store `documents`, key `current`. UI changes go through a repository interface: load, update, and replace. Updates validate and normalize the full document before writing in a read-write transaction. A BroadcastChannel tells other open tabs when local data changes. There is no HTTP API or server-side session data in this beta.

The current JSON backup format is schema version 4. It contains profile identity and cropped images, campaigns, sessions, daily journals, timer state, preferences, and retained legacy quest/target records. Imports from versions 1 through 4 normalize to the current shape. Older quest-linked work is attributed to a campaign when that relationship can be found. Saved System and Slate appearance normalize to Black, saved White remains White, and older muted sound preferences remain muted. No database or store rename is required.

## Time model

An interval session holds one or more precise timestamp ranges. Local-midnight splitting assigns its duration to each calendar day it touches. A duration session instead holds a date and whole minutes, with no fabricated clock times. Shared session calculations feed the calendar, charts, campaign totals, career stats, and Score. Active timer time is shown provisionally but saved totals wait for session settlement. Countdown recovery uses persisted timestamps and a transaction winner so two open tabs do not both settle or alarm for the same timer.

## Boundaries

The app rejects JSON backup files above 32 MiB before reading them and validates imported records, images, links, dates, and durations. This is a beta guard, not comprehensive protection against resource-heavy but smaller files; record counts and free-text lengths in legacy imports do not have universal caps. These local checks are not server rate limits. Browser storage can be cleared or lost; JSON export is the only backup path today. The architecture deliberately keeps a repository boundary for later sync, but account identity, authorization, encrypted content upload, and server resource controls are not implemented.
