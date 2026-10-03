import type { ActiveTimer, AppData, DateKey, Interval, Quest, QuestOccurrence, WorkSession } from './types.ts';

export function dateKey(value: Date | number = new Date()): DateKey {
  const date = typeof value === 'number' ? new Date(value) : value;
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

export function localDate(key: DateKey): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function addDays(key: DateKey, amount: number): DateKey {
  const date = localDate(key);
  date.setDate(date.getDate() + amount);
  return dateKey(date);
}

export function datesBetween(start: DateKey, end: DateKey): DateKey[] {
  const dates: DateKey[] = [];
  if (start > end) return dates;
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function splitMinutesByDay(intervals: Interval[]): Record<DateKey, number> {
  const result: Record<DateKey, number> = {};
  for (const interval of intervals) {
    if (!Number.isFinite(interval.start) || !Number.isFinite(interval.end) || interval.end <= interval.start) continue;
    let cursor = interval.start;
    while (cursor < interval.end) {
      const day = dateKey(cursor);
      const midnight = new Date(new Date(cursor).getFullYear(), new Date(cursor).getMonth(), new Date(cursor).getDate() + 1).getTime();
      const next = Math.min(interval.end, midnight);
      result[day] = (result[day] ?? 0) + (next - cursor) / 60000;
      cursor = next;
    }
  }
  return result;
}

export function dailyWorkedMinutes(sessions: WorkSession[], day: DateKey): number {
  return sessions.reduce((total, session) => total + (sessionDays(session)[day] ?? 0), 0);
}

export function sessionDurationMs(session: WorkSession): number {
  return session.timing === 'duration' ? (session.durationMinutes ?? 0) * 60000
    : session.intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
}

export function sessionDays(session: WorkSession): Record<DateKey, number> {
  return session.timing === 'duration' && session.date
    ? { [session.date]: session.durationMinutes ?? 0 } : splitMinutesByDay(session.intervals);
}

export function sessionDay(session: WorkSession): DateKey {
  return session.date ?? dateKey(Math.min(...session.intervals.map(interval => interval.start)));
}

export function dailyHourDelta(sessions: WorkSession[], day: DateKey, targetHours: number): number {
  return Math.round((dailyWorkedMinutes(sessions, day) / 60 - targetHours) * 100) / 100;
}

export function questPointsForDate(
  occurrences: QuestOccurrence[],
  stakes: Record<string, number>,
  day: DateKey,
  today: DateKey,
): number {
  let points = 0;
  for (const occurrence of occurrences) {
    const stake = stakes[occurrence.questId] ?? 0;
    const completedDate = occurrence.completedAt === null ? null : dateKey(occurrence.completedAt);
    if (completedDate === day) points += stake;
    if (occurrence.dueDate === day && occurrence.dueDate < today && (completedDate === null || completedDate > occurrence.dueDate)) points -= stake;
  }
  return points;
}

export function generateOccurrences(
  quests: Quest[],
  existing: QuestOccurrence[],
  from: DateKey,
  through: DateKey,
): QuestOccurrence[] {
  const result = [...existing];
  const seen = new Set(existing.map(item => item.id));
  for (const quest of quests) {
    if (!quest.active) continue;
    const start = quest.startDate > from ? quest.startDate : from;
    const end = quest.endDate && quest.endDate < through ? quest.endDate : through;
    for (const day of datesBetween(start, end)) {
      if (quest.recurrence === 'none' && day !== quest.startDate) continue;
      if (quest.recurrence === 'weekly' && localDate(day).getDay() !== localDate(quest.startDate).getDay()) continue;
      const id = quest.id + ':' + day;
      if (!seen.has(id)) {
        result.push({ id, questId: quest.id, dueDate: day, completedAt: null });
        seen.add(id);
      }
    }
  }
  return result;
}

export function createInitialData(setupDate: DateKey): AppData {
  return {
    schemaVersion: 5,
    setupDate,
    setupComplete: true,
    weeklyTargets: [0, 4, 4, 4, 4, 4, 0],
    dailyTargets: {},
    theme: 'black',
    preferences: { interfaceSounds: true, timerAlarm: true },
    timerPanel: { image: null, imageOpacity: 30, imageBlur: 0, preferredWidth: 640, preferredHeight: null },
    onboarding: { usernamePromptCompleted: false },
    profile: { name: '', username: '', bio: '', avatar: null, banner: null, links: [] },
    campaigns: [],
    quests: [],
    occurrences: [],
    sessions: [],
    journals: [],
    timer: null,
    pendingReviewId: null,
  };
}

export function freezePastTargets(data: AppData, today: DateKey): AppData {
  const dailyTargets = { ...data.dailyTargets };
  for (const day of datesBetween(data.setupDate, addDays(today, -1))) {
    if (dailyTargets[day] === undefined) dailyTargets[day] = data.weeklyTargets[localDate(day).getDay()] ?? 0;
  }
  return { ...data, dailyTargets };
}

export function targetForDate(data: AppData, day: DateKey): number {
  if (data.dailyTargets[day] !== undefined) return data.dailyTargets[day];
  if (day < data.setupDate) return 0;
  return data.weeklyTargets[localDate(day).getDay()] ?? 0;
}

export function timerElapsedMs(timer: ActiveTimer, now: number): number {
  return timer.accumulatedMs + (timer.runningSince === null ? 0 : Math.max(0, now - timer.runningSince));
}

export function pauseTimer(timer: ActiveTimer, now: number): ActiveTimer {
  if (timer.runningSince === null) return timer;
  const end = timer.mode === 'countdown' && timer.durationMs !== null
    ? Math.min(now, timer.runningSince + Math.max(0, timer.durationMs - timer.accumulatedMs))
    : now;
  return {
    ...timer,
    accumulatedMs: timer.accumulatedMs + Math.max(0, end - timer.runningSince),
    intervals: [...timer.intervals, { start: timer.runningSince, end }],
    runningSince: null,
  };
}

export function resumeTimer(timer: ActiveTimer, now: number): ActiveTimer {
  return timer.runningSince === null ? { ...timer, runningSince: now } : timer;
}

export function finishTimer(timer: ActiveTimer, now: number): WorkSession {
  const closed = pauseTimer(timer, now);
  return {
    id: timer.id,
    intervals: closed.intervals.filter(interval => interval.end > interval.start),
    source: 'timer',
    questOccurrenceId: timer.questOccurrenceId,
    note: '',
    campaignId: timer.campaignId ?? null,
    result: null,
  };
}

export function settleCountdown(timer: ActiveTimer, now: number): WorkSession | null {
  if (timer.mode !== 'countdown' || timer.durationMs === null) return null;
  if (timerElapsedMs(timer, now) < timer.durationMs) return null;
  return finishTimer(timer, timer.runningSince === null ? now : timer.runningSince + Math.max(0, timer.durationMs - timer.accumulatedMs));
}
