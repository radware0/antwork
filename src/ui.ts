import { dateKey, dailyWorkedMinutes, localDate, timerElapsedMs, sessionDurationMs } from './domain.ts';
import type { AppData, DateKey, DayQuality, WorkSession } from './types.ts';

export type Mutate = (change: (data: AppData) => AppData) => Promise<AppData>;

export function countdownMinutes(hours: number, minutes: number): number | null {
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  if (total < 1 || total > 720) return null;
  return total;
}

export function signedHours(hours: number): string {
  if (hours !== 0 && Math.abs(hours) < 0.05) return hours > 0 ? '+<0.1h' : '−<0.1h';
  const rounded = Math.round(hours * 10) / 10;
  return (rounded > 0 ? '+' : '') + rounded.toFixed(1) + 'h';
}

export function hoursLabel(minutes: number): string {
  return (Math.round(minutes / 6) / 10).toFixed(1) + 'h';
}

export function clockTime(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map(value => String(value).padStart(2, '0')).join(':');
}

export function displayDate(day: DateKey): string {
  return localDate(day).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function withLiveSession(data: AppData, now: number): WorkSession[] {
  if (!data.timer) return data.sessions;
  const timer = data.timer;
  const allowed = timer.mode === 'countdown' && timer.durationMs !== null
    ? Math.max(0, timer.durationMs - timer.accumulatedMs)
    : Number.POSITIVE_INFINITY;
  const end = timer.runningSince === null ? null : Math.min(now, timer.runningSince + allowed);
  const intervals = end && end > timer.runningSince! ? [...timer.intervals, { start: timer.runningSince!, end }] : timer.intervals;
  return [...data.sessions, { id: timer.id, intervals, source: 'timer', questOccurrenceId: timer.questOccurrenceId, note: '', campaignId: timer.campaignId ?? null, result: null }];
}

export function sessionMinutes(session: WorkSession): number {
  return sessionDurationMs(session) / 60000;
}

export function dailySummary(data: AppData, day: DateKey, now: number) {
  const minutes = dailyWorkedMinutes(withLiveSession(data, now), day);
  const color = day > dateKey(now) || minutes === 0 ? 'neutral' : 'positive';
  return { minutes, color };
}

export const dayQualityLabels: Record<DayQuality, string> = { good: 'Good', steady: 'Steady', rough: 'Rough' };

export function calendarSummary(data: AppData, day: DateKey, now: number) {
  const { minutes } = dailySummary(data, day, now);
  const future = day > dateKey(now);
  const rating = future ? null : data.dailyRatings[day] ?? null;
  const color = future ? 'neutral' : data.calendarMode === 'quality'
    ? rating ? 'quality-' + rating : 'neutral'
    : minutes === 0 ? 'neutral' : minutes < 120 ? 'hours-light' : minutes < 240 ? 'hours-medium' : 'hours-dark';
  return { minutes, future, rating, color, ratingLabel: rating ? dayQualityLabels[rating] : 'Unrated' };
}

export function timerLeft(data: AppData, now: number): number {
  const timer = data.timer;
  if (!timer) return 0;
  const elapsed = timerElapsedMs(timer, now);
  return timer.mode === 'countdown' ? Math.max(0, (timer.durationMs ?? 0) - elapsed) : elapsed;
}
