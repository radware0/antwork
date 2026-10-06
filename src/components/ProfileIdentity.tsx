import { useMemo } from 'react';
import { profileCareer } from '../profile.ts';
import { displayDate, hoursLabel } from '../ui.ts';
import type { AppData } from '../types.ts';

export function CareerOverview({ data, now }: { data: AppData; now: number }) {
  const career = useMemo(() => profileCareer(data, now), [data, now]);
  const bestDay = career.bestDay;
  const longest = career.longestSession;
  return <>
    <div className="profile-section-heading"><h2>Career overview</h2></div>
    <div className="profile-stats">
      <section className="panel stat-card"><span>Total deep work</span><strong>{hoursLabel(career.totalMinutes)}</strong></section>
      <section className="panel stat-card"><span>Best day</span><strong>{bestDay ? hoursLabel(bestDay.minutes) : '—'}</strong><small>{bestDay ? displayDate(bestDay.day) : 'No work logged yet'}</small></section>
      <section className="panel stat-card"><span>Longest session</span><strong>{longest ? hoursLabel(longest.minutes) : '—'}</strong><small>{longest ? displayDate(longest.day) : 'No sessions yet'}</small></section>
      <section className="panel stat-card"><span>Most hours on one campaign</span><strong>{career.mostCampaign ? hoursLabel(career.mostCampaign.minutes) : '—'}</strong><small>{career.mostCampaign?.campaign.title ?? 'No campaign sessions yet'}</small></section>
      <section className="panel stat-card"><span>Score</span><strong>{career.score}</strong><small>1 point per 15 minutes saved</small></section>
    </div>
  </>;
}
