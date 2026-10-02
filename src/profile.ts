import { dateKey, dailyWorkedMinutes, sessionDays, sessionDay, sessionDurationMs, timerElapsedMs } from './domain.ts';
import { hoursLabel } from './ui.ts';
import type { AppData, Campaign, DateKey, WorkSession } from './types.ts';

export interface CareerDay { day: DateKey; minutes: number }
export interface LongestSession { sessionId: string; minutes: number; day: DateKey }
export interface ProfileCareer {
  totalMinutes: number;
  score: number;
  bestDay: CareerDay | null;
  longestSession: LongestSession | null;
  campaignMinutes: Record<string, number>;
  mostCampaign: { campaign: Campaign; minutes: number } | null;
}

function campaignIdFor(data: AppData, record: WorkSession | NonNullable<AppData['timer']>): string | null {
  if (record.campaignId !== undefined) return record.campaignId;
  const occurrence = data.occurrences.find(item => item.id === record.questOccurrenceId);
  return data.quests.find(item => item.id === occurrence?.questId)?.campaignId ?? null;
}

export function profileCareer(data: AppData, now: number): ProfileCareer {
  const campaignMinutes: Record<string, number> = {};
  const dayMinutes: Record<string, number> = {};
  let totalMilliseconds = 0;
  let longestSession: LongestSession | null = null;

  for (const session of data.sessions) {
    const savedMilliseconds = sessionDurationMs(session);
    totalMilliseconds += savedMilliseconds;
    const minutes = savedMilliseconds / 60_000;
    for (const [day, value] of Object.entries(sessionDays(session))) {
      dayMinutes[day] = (dayMinutes[day] ?? 0) + value;
    }
    const day = sessionDay(session);
    if (!longestSession || minutes > longestSession.minutes || (minutes === longestSession.minutes && day > longestSession.day)) {
      longestSession = { sessionId: session.id, minutes, day };
    }
    const campaignId = campaignIdFor(data, session);
    if (campaignId) campaignMinutes[campaignId] = (campaignMinutes[campaignId] ?? 0) + minutes;
  }

  const bestEntry = Object.entries(dayMinutes)
    .filter(([day, minutes]) => day <= dateKey(now) && minutes > 0)
    .sort(([dayA, minutesA], [dayB, minutesB]) => minutesB - minutesA || dayB.localeCompare(dayA))[0];
  const bestDay = bestEntry ? { day: bestEntry[0], minutes: bestEntry[1] } : null;
  const mostCampaign = data.campaigns
    .filter(campaign => (campaignMinutes[campaign.id] ?? 0) > 0)
    .sort((a, b) => (campaignMinutes[b.id] ?? 0) - (campaignMinutes[a.id] ?? 0) || a.createdAt - b.createdAt || a.id.localeCompare(b.id))[0];
  return {
    totalMinutes: totalMilliseconds / 60_000,
    score: Math.floor(totalMilliseconds / (15 * 60_000)),
    bestDay,
    longestSession,
    campaignMinutes,
    mostCampaign: mostCampaign ? { campaign: mostCampaign, minutes: campaignMinutes[mostCampaign.id] } : null,
  };
}

export type ProfileStatus = { state: 'running' | 'paused' | 'today'; label: string; detail: string; elapsedMs?: number };

export function profileStatus(data: AppData, now: number): ProfileStatus {
  if (data.timer) {
    const campaignId = campaignIdFor(data, data.timer);
    const campaign = data.campaigns.find(item => item.id === campaignId);
    const running = data.timer.runningSince !== null;
    return { state: running ? 'running' : 'paused', label: running ? 'Locked in' : 'Paused', detail: campaign?.title ?? 'Free session', elapsedMs: timerElapsedMs(data.timer, now) };
  }
  return { state: 'today', label: "Today's deep work", detail: hoursLabel(dailyWorkedMinutes(data.sessions, dateKey(now))) };
}
