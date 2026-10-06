# Features and rules

The five app destinations are Dashboard, Timers, Calendar, Work Hours, and Profile. They share a bottom dock; editing uses focused dialogs rather than expanding into the reading layout.

Dashboard and Work Hours charts show daily deep work in hours. Screen-reader summaries and chart tooltips use the same unit. The Timers page keeps its complete work timer panel centered at first. On desktop, drag it by the header grip or resize it from the bottom-right handle; movement and resizing stay inside the free space above the dock. Arrow keys change position or size by 16px, Shift+arrow by 64px. Reset layout, or Home on either handle, restores centered placement and the default 640px, content-fit size together. The preferred width and height save after the gesture or key burst ends. Position remains in memory across page changes and resets when antwork reloads. Small workspaces and phone layouts keep normal scrolling and hide both handles.

Choose **Customize timer** to upload, replace, or remove a personal background. PNG, JPEG, and WebP images up to 10 MB are converted locally to static WebP with a 1600px maximum long edge. Image opacity (0–100%) and blur (0–24px) affect only the image. Charcoal backing, a 55% black contrast layer, white text, and dark controls give saved images the same treatment in both themes and the preview. Defaults are 30% opacity and no blur. Save applies the draft. Cancel leaves the last saved appearance in place. The image is used only on the Timers page, including its fixed phone layout.

## Hours, sessions, and results

All saved timer sessions and manual entries count as deep work. Interval sessions use their recorded start and end timestamps and split across local midnight. Dated duration entries assign every minute to the selected date. Paused timer time is excluded. Unfinished timer time is visible as provisional progress but is not a saved session.

Session history can show a self-chosen **Strong**, **Steady**, or **Rough** result. An unrated session stays neutral. A result describes how the work felt; it does not change hours or Score. A session may link directly to one campaign, including one that is later finished. Unlinked time still counts as deep work.

## Score

Score is one point for every 15 cumulative minutes of **saved** deep work. It is calculated from the total duration, not awarded per session. For example, three saved five-minute sessions together earn one point. Manual and timer sessions count equally. Corrections or deletions recalculate it. Journals, results, rest days, and inactivity add no points or penalties.

## Calendar and career

The calendar defaults to **Day quality**: Good is green, Steady is yellow, and Rough is red. Calendar cells show quality through color, with the date and work hours visible. These are manual whole-day ratings, independent of hours and session ratings. Unrated days stay neutral. Select today or a past day in Calendar to set, change, or clear its rating above the journal, including days with no work. Future dates stay blank and cannot be rated. Dashboard dates remain view-only.

Switch to **Hours** for green shading based on time: under 2 hours is light, 2 to under 4 hours is medium, and 4 or more hours is dark. Zero hours stays neutral. The toggle is shared between Dashboard and Calendar and remembered on this device. Switching views preserves hours, ratings, and notes. There is no daily target or target difference in either view.

Profile shows total saved deep work, best saved day by hours, longest saved session, most saved hours linked to one campaign, and lifetime Score. Profile identity editing (including name, username, and bio) and username onboarding are deprecated for now. Previously saved identity data remains in local storage and JSON backups. Campaigns need a title but may have no description.

## Sound and appearance

New installations start in Black and can switch immediately between Black and White from the top-bar pill. Saved System and Slate preferences resolve to Black; saved White stays White. Interface clicks and countdown alarms start on for new installations. The separate top-bar button mutes or unmutes both sounds and remembers that choice. Older installations keep their previous sound preference until the button is used. Sound requires browser permission through user interaction; an alarm is not guaranteed if the tab or browser is closed or suspended.
