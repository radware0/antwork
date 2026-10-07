# Worked-day achievement cards

Status: approved design, implemented and verified for v1.1.0.
Design agreed on October 7, 2026. Release prepared on October 8, 2026.

## Purpose

Let users look back at a worked day through a personal achievement card, similar to a trading PnL card. The card shows honest saved work hours and how the user rated the day. A picture or silent looping video makes the card personal without changing the work record.

The first phase produced editable Markdown before implementation. These files remain directly editable; no recurring documentation automation is needed. Implementation follows the agreed design below, and release evidence is recorded in the v1.1.0 notes.

## Agreed behavior

- Open the card from the selected day in Calendar through **View day card**.
- Offer the action only for today or a past date with positive saved work time.
- Show the date, saved hours, and the existing manual **Good**, **Steady**, or **Rough** day rating. Show **Unrated** when no rating exists.
- Combine all saved sessions touching that date. Split precise intervals at local midnight through the existing time calculations. Dated duration entries belong to their selected date.
- Exclude unfinished timer time from the achievement total. Saving, correcting, or deleting work updates the displayed hours.
- Open a focused popup using the existing Modal. Use timer-card visual treatment; movement and resizing are not part of this card.
- Store one optional picture or video background per date. Users can add, replace, or remove it.
- Keep the background associated with the date, independent of session edits. If the last saved work is deleted, hide the card action and retain its background for that date. Calendar must still allow removing that stored background so it does not become inaccessible or consume space permanently.
- Keep day quality independent of hours, session results, and Score. Rating changes use the existing Calendar controls.

## Backgrounds and playback

Pictures accept PNG, JPEG, and WebP up to 10 MiB. Reuse timer normalization: a static WebP, at most 1600 pixels on the long edge, and at most 2,800,000 characters in the stored data URL.

Videos accept locally selected MP4 or WebM files up to 5 MiB and 30 seconds. The selected clip must decode successfully in the target app before it can be saved. Reject empty, corrupt, unsupported, oversized, or longer clips with a readable error. Do not add transcoding or trimming for this release.

Visible videos loop automatically with silent playback and inline presentation. Playback stays muted regardless of the global interface-sound setting; the card has no playback or unmute controls. Stop playback when the card closes or the app becomes hidden. The user's screenshot review supersedes the earlier reduced-motion pause and manual playback controls: visible clips continue looping regardless of motion preferences. Report playback failures with an instruction to replace or remove the background.

Use centered cover framing with full-opacity media, a transparent popup and empty card, and text shadows in both themes. Day quality is plain colored text without a border or badge fill. Background editing stays inside the same popup rather than stacking dialogs. Save commits the draft; Cancel or Escape discards it. Failed saves preserve the draft and allow retry. Disable dismissal and duplicate saves while a write is pending.

## Local data and backups

Use the existing IndexedDB repository and a date-keyed background map in AppData. Store bounded media bytes in the document so the existing JSON backup includes both pictures and videos. Use temporary blob URLs for video playback and release them when replaced or dismissed; the desktop CSP already permits blob media.

Introduce backup schema version 6 for day-card backgrounds. Versions 1 through 5 migrate with an empty background map and preserve existing work, journals, ratings, timer settings, and profile data. Version-6 exports include media; v1.0.0 cannot import the new schema. Keep the database name, store, desktop origin, and data directory stable.

Retain the 32 MiB JSON import limit. Measure the UTF-8 bytes of the same formatted JSON used by export before accepting writes that grow the document. Reject changes exceeding the limit without replacing saved data or closing the draft, and explain that removing a background can free space. Existing over-limit legacy history must remain readable and permit reductions without truncation.

Validate imported background dates, media types, bounded payloads, and video metadata. File selection also checks actual decoding and duration. Imports must reject malformed data before replacing destination history. Restore and play a media-containing backup in the packaged Windows app as an acceptance check.

The deliberate ceiling is a small collection of short clips: every repository update currently clones, validates, and rewrites the full document. A separate media store and another backup format are later work if larger collections are needed.

## Implementation order

1. Add the schema-6 background map, migration, media validation, and export-size guard using the current repository boundary.
2. Reuse saved session-day calculations for card eligibility and totals; do not use the live-inclusive daily summary for the achievement total.
3. Add the Calendar action and focused card popup, with date-scoped drafts and the existing Modal behavior.
4. Reuse image processing. Add bounded video selection, blob URL cleanup, automatic silent looping, and visibility handling. Apply the screenshot-review changes: a transparent popup, text shadows, and borderless day quality.
5. Verify the feature and update user documentation to describe implemented behavior and schema-6 compatibility.
6. Record release evidence in [the v1.1.0 notes](../../release/windows/v1.1.0.md), inspect the installer, then publish the release.

Likely touchpoints: `src/types.ts`, `src/validation.ts`, `src/domain.ts`, `src/storage.ts`, `src/components/CalendarView.tsx`, the shared Modal and image helpers, and a small day-card component with styles. Reuse the existing dependencies and five destinations.

## Acceptance checks

- A day with multiple saved sessions has one card with their combined hours. A midnight-spanning session contributes only that date's portion; a duration entry uses its selected date.
- A running timer alone does not unlock a card. Future dates and dates without saved work have no card action. Existing rating and journal controls remain available independently.
- Good, Steady, Rough, and Unrated match Calendar. Editing hours or quality refreshes the card without changing Score rules.
- Add, replace, remove, Cancel, Escape, and a failed save preserve the correct saved background and draft.
- MP4 and WebM loop silently and automatically in the packaged app without playback controls, including when reduced motion is enabled. Hidden/closed cards stop playback. Playback failures show a readable error. Temporary URLs are released.
- Invalid media, the exact file/duration boundaries, malformed imported media, and the 32 MiB backup boundary have runnable checks.
- A v1.0.0 backup migrates without loss. A new media-containing backup restores hours, ratings, pictures, and video offline.
- Check keyboard focus, visible errors, text contrast, narrow windows, and both themes. Inspect 1440x900, 1366x768, and 390x844 layouts.

## Markdown handoff

This plan records the agreed design and the subsequent screenshot-review changes. Feature, backup, privacy, architecture, and Windows instructions now describe the implemented behavior. The v1.1.0 release notes record verification, the actual installer hash, and the remaining test limits.
