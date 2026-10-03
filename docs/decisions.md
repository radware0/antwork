# Decision history

This is a retrospective decision record, not a dated changelog. Development before the public beta baseline has no Git history from which to verify dates or release boundaries. It records proposals and visible implementation changes, not measured user outcomes.

## From quotas to records

The first calendar-first concept compared daily work hours with a weekday target. Green, yellow, and red days represented surplus, exact target, and shortfall. Quests could repeat, earn size-based points, and lose a stake when missed. This made work feel game-like but also introduced a judgment system on days that naturally vary.

The product direction changed to flexible hours: work days are green and no-work days are neutral. Fixed targets, target differences, quest penalties, and quest management were removed from the interface. Legacy quest and target records remain in backups for compatibility, but the app no longer generates new quest occurrences.

## From task points to time Score

Score once followed quest completion and missed-due-day stakes. It now follows saved time alone: one point per 15 cumulative minutes. This avoids incentives to split sessions, overrate them, or write notes merely for points. Strong, Steady, and Rough remain optional self-ratings with no numerical effect.

## From broad dashboard to game HUD

The first dashboard carried a graph, tasks, timer, journal, and calendar as peers. Compact framing, then a floating five-destination dock, gave the calendar and one-click stopwatch clearer priority. Journal stayed prominent; editors moved into dialogs and the Work Hours page became chart-first. Profile became an identity and career screen rather than another settings form.

## Current beta polish

Profile cropping gained visible grids and desktop/mobile banner previews because the saved 8:3 asset can display inside a much wider compact desktop strip. Avatars render as circles. The hours graph uses a restrained, registry-installed ECharts line with a small area fill. The dock and theme control first used registry components; the current versions adapt supplied minimal-dock and liquid-switch source. New installs start Black. Old System and Slate preferences resolve to Black, while White stays White. Sound moved from a settings form to a global mute action. Documentation distinguishes what works locally from the hosted product ambition.

The raised metallic panel edges were later removed in favor of quiet borders. White became neutral rather than blue-grey, and uploaded timer images received one shared dark-backed treatment in both themes. Desktop navigation uses icons and tooltips while phones retain labels. Timer position and size now reset together, without changing the recording or its background.

The earlier mechanics are documented to explain the journey, not advertised as present features. No conversion, retention, productivity, or health effect has been measured for this beta.
