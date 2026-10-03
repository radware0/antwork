# antwork interface

## Layout

The 1280px frame keeps existing outer spacing and the centered bottom dock. A shared bento grid uses 12px gaps with a roughly 1.8:1 split and a 300px minimum secondary column. Below 900px it becomes one column.

Dashboard: calendar left; Today/timer and Journal right; chart below. Calendar: month left, selected-day summary and Journal right, sessions below. Work Hours: header action, 30-day chart, history. Profile: identity, career statistics, campaigns and settings.

## Surfaces and type

Rubik throughout. Reuse existing theme tokens: --bg, --surface, --surface-2, --border, --text, --muted, --accent, --positive, --even, --negative. Panels have 12px corners, controls 8px, dock and dialogs 16px. Keep ordinary cards opaque. Dialogs use a solid fallback and 96% theme surface with 18px backdrop blur where supported. Do not encode quantity through session self-ratings.

Black keeps its OLED background. White uses a #fafafa page, white cards, and neutral controls without a blue-grey tint. Cards use quiet thin borders without embossed rims, inset bevels, or a Profile perimeter overlay. Dock and dialogs keep restrained floating shadows and glass. The Dashboard profile shortcut has no box border or hover fill; its circular avatar, status dot, and keyboard outline remain.

## Editing

Use the shared native Modal for editors; the Black/White liquid switch lives in the top bar, not in an Appearance modal. Native modality blocks the dock. Focus enters the first useful field and returns to the trigger. Escape/Cancel discard drafts; backdrop clicks do nothing. Save failures leave drafts open. While saving, closing and duplicate submissions are blocked. Countdown review waits behind an existing modal.

Journal cards show a bounded paragraph-preserving preview and a Saved indicator only when a record exists. Long notes open for reading. Editors retain the day they opened on.

## Motion and loading

Motion supports orientation, feedback, and return habit; it does not decorate timer ticks. Page entrances and every modal close/open use 180ms with `cubic-bezier(0.23, 1, 0.32, 1)`. The dock keeps tile backgrounds, labels, and touch targets fixed. Only the hovered or keyboard-focused icon lifts by 2px and grows to 1.08× through Motion; adjacent icons stay still. Hover and focus brighten only the icon and label, while the selected page stays blue. Touch and reduced-motion modes stay static, and focus outlines are not clipped. The installed line chart draws in once per mount over 250ms; data updates do not replay that entrance.

Hours charts plot hours derived from saved and provisional minutes. Axis labels, tooltips, and the screen-reader list all use hours. On desktop, the full timer panel can move and resize inside the area below its heading and above the dock. Movement uses the header grip; resizing uses its own bottom-right grip. Arrow keys change size by 16px, Shift+arrow by 64px, and Home resets size and position together. The preferred width and height save when a resize gesture or keyboard burst ends. Position lasts across page navigation and resets on reload. Small workspaces and phones keep the panel in normal flow; saved timer backgrounds still appear on phones.

The Timers page can use one uploaded PNG, JPEG, or WebP background. It is normalized locally to static WebP at no more than 1600px on its long edge. Centered cover framing keeps the whole panel filled; Image opacity and Blur affect only that image. Uploaded images use charcoal backing, a 55% black contrast layer, white text, and dark local controls in both themes, including the customization preview. Defaults are 30% and 0px. Panels without an image follow the selected app theme.

The supplied minimal dock keeps five semantic route buttons. At 900px and above, icons have hover/focus tooltips; smaller layouts show labels. Only icons move, never tiles or the dock frame. The supplied liquid switch uses a 92×46px track with sun/moon cues. Click, Enter, Space, or a completed drag saves one appearance change; pointer cancellation and failed persistence restore the saved value. Reduced motion removes spring movement.

Reset layout uses the four-square LayoutGrid icon and restores centered placement plus the default 640px/content-fit size. Home on either handle does the same. Pending keyboard resize saves are cancelled; the reset persists only size, leaving the background and recording intact. If saving fails, the visible reset remains and Retry is available.

New local workspaces ask once for a handle after IndexedDB history is ready. Saving sets the local @username; Skip, Escape, or Close remembers completion. A failed save leaves the username draft open, and a failed skip save lets the app continue with a note that the prompt may return. An existing handle bypasses onboarding. Campaign titles are required; descriptions are optional and blank descriptions remain blank.

Reduced motion removes positional movement, chart transitions, and loading pulses. Initial history loading uses a centered lowercase antwork title in Rajdhani SemiBold and a quiet indicator only while IndexedDB is pending. Loading failure replaces it with a reload action. Rubik remains the interface face. Saves and background refreshes retain existing content.

## Profile crops and sound

Image selection enters an in-place crop step inside Edit profile. Drag, touch, arrow keys, zoom, Reset, Apply crop, and Cancel crop are available without stacking dialogs. Both crops show a rule-of-thirds grid. Avatar source framing is square, but displayed avatars are circular; banner source framing is 8:3 with desktop/mobile final-frame previews. Draft previews remain visible before Save. Upload originals and temporary URLs are released after Apply, Cancel, or editor dismissal.

Sound is on for new installs and controlled by a persistent top-bar mute button; older silent records stay muted until changed. Interface clicks cover navigation, editor open/close, timer controls, and successful modal saves. A 100ms gate drops rapid clicks. Countdown settlement uses the IndexedDB transaction winner to emit one short chime; history imports and reviews never replay it. A closed or suspended browser cannot guarantee an alarm.

Clicks use a peak gain of 0.072; countdown notes use 0.18 and 0.14. These are roughly 6 dB above the previous levels. Frequencies and short attack/release envelopes stay unchanged; no sound plays on hover, typing, timer ticks, or failed actions.

## Responsive acceptance

Inspect 1440×900, 1366×768, 1100px embedded views, and 390×844. Preserve calendar numerals, journal readability, wrapped long text, full modal scrolling, and dock clearance.
