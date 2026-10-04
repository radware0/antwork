# How antwork started

I started thinking about antwork while keeping a food journal during a cut. Writing things down helped me stay consistent. I wondered whether seeing work add up could help me return to work that felt dull or hard to start. That was a personal observation, not proof that tracking improves anyone else's productivity.

The first concept looked more like a game. A calendar compared each day's work hours with a weekday target. Green, yellow, and red marked a surplus, an exact match, or a shortfall. Repeatable quests could earn points, and missing one could cost a stake. The dashboard put tasks, a timer, a graph, a journal, and a calendar together.

That approach felt too rigid for days that naturally vary. I dropped the daily targets and quest penalties. Now a green day means work was logged, while a day without work stays neutral. Score comes from saved time alone: one point for every 15 cumulative minutes. A short session still counts toward the next point, and personal session ratings never change the score.

## How the app took shape

The work loop became simpler: start a lock-in, save the time, leave a note if it helps, and look back at what happened. A stopwatch starts from Dashboard. Timers also offers a countdown, and work can be entered manually. The calendar shows worked days and their hours; Work Hours shows a 30-day chart and session history. The daily journal gives each day a place for reflection. Profile gathers career statistics, campaigns, and a local identity.

The interface changed with the product. The dashboard gave the calendar and stopwatch more room. Editing moved into focused dialogs, and a dock with five destinations made the main screens easier to reach. Profile image cropping, Black and White themes, optional sound, and a movable desktop timer panel came later. The timer can now be resized and given a local image background.

The public beta keeps records in the browser's IndexedDB. JSON export and import let people keep a separate copy or move history between browsers. It has no accounts, cloud sync, or public profiles. The live site is [antwork-five.vercel.app](https://antwork-five.vercel.app/).

## Progress recorded in Git

The design changes above happened before this repository's first public beta commit. They are a retrospective from the product and decision notes, so I have not assigned them dates. Git history starts on October 2, 2026.

- **October 2:** The first commit established the public beta code, tests, and documentation. A later commit prepared the Vercel build and added the live site link. An experiment with raised panel edges also landed that day.
- **October 3:** Charts switched to hours, the desktop timer panel gained movement, and dock hover and interface sound received a polish pass.
- **October 4:** The raised panel edges were removed. White became more neutral, and the dock and theme switch were simplified. The timer gained resizing, image backgrounds, and a reset for timer size and position. New workspaces gained a local username prompt, and campaigns began requiring only a title. The backup format moved to version 5 to carry the new preferences. A later commit aligned timer controls and session history.

As of October 4, 2026, the next beta work is to test the flow across five pages with willing users and fix confusing behavior. A hosted version would need decisions about accounts, data protection, recovery, and ways to limit abuse before personal content moves off the device.

For the detailed design record, see [Decision history](decisions.md). For current behavior and future ideas, see [Features and rules](features.md) and the [Roadmap](roadmap.md).
