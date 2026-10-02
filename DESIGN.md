# antwork interface

## Layout

The 1280px frame keeps existing outer spacing and the centered bottom dock. A shared bento grid uses 12px gaps with a roughly 1.8:1 split and a 300px minimum secondary column. Below 900px it becomes one column.

Dashboard: calendar left; Today/timer and Journal right; chart below. Calendar: month left, selected-day summary and Journal right, sessions below. Work Hours: header action, 30-day chart, history. Profile: identity, career statistics, campaigns and settings.

## Surfaces and type

Rubik throughout. Reuse existing theme tokens: --bg, --surface, --surface-2, --border, --text, --muted, --accent, --positive, --even, --negative. Panels have 12px corners, controls 8px, dock and dialogs 16px. Keep ordinary cards opaque. Dialogs use a solid fallback and 96% theme surface with 18px backdrop blur where supported. Do not encode quantity through session self-ratings.

## Editing

Use the shared native Modal for editors; the Black/White theme pill lives in the top bar, not in an Appearance modal. Native modality blocks the dock. Focus enters the first useful field and returns to the trigger. Escape/Cancel discard drafts; backdrop clicks do nothing. Save failures leave drafts open. While saving, closing and duplicate submissions are blocked. Countdown review waits behind an existing modal.

Journal cards show a bounded paragraph-preserving preview and a Saved indicator only when a record exists. Long notes open for reading. Editors retain the day they opened on.

## Motion and loading

Motion supports orientation, feedback, and return habit; it does not decorate timer ticks. Page entrances and every modal close/open use 180ms with `cubic-bezier(0.23, 1, 0.32, 1)`. The installed dock magnifies gently on desktop hover/focus without shifting adjacent items and stays static on touch. The installed line chart draws in once per mount over 250ms; data updates do not replay that entrance.

Reduced motion removes positional movement, chart transitions, and loading pulses. Initial history loading uses a centered lowercase antwork title in Rajdhani SemiBold and a quiet indicator only while IndexedDB is pending. Loading failure replaces it with a reload action. Rubik remains the interface face. Saves and background refreshes retain existing content.

## Profile crops and sound

Image selection enters an in-place crop step inside Edit profile. Drag, touch, arrow keys, zoom, Reset, Apply crop, and Cancel crop are available without stacking dialogs. Both crops show a rule-of-thirds grid. Avatar source framing is square, but displayed avatars are circular; banner source framing is 8:3 with desktop/mobile final-frame previews. Draft previews remain visible before Save. Upload originals and temporary URLs are released after Apply, Cancel, or editor dismissal.

Sound is on for new installs and controlled by a persistent top-bar mute button; older silent records stay muted until changed. Interface clicks cover navigation, editor open/close, timer controls, and successful modal saves. A 100ms gate drops rapid clicks. Countdown settlement uses the IndexedDB transaction winner to emit one short chime; history imports and reviews never replay it. A closed or suspended browser cannot guarantee an alarm.

## Responsive acceptance

Inspect 1440×900, 1366×768, 1100px embedded views, and 390×844. Preserve calendar numerals, journal readability, wrapped long text, full modal scrolling, and dock clearance.
