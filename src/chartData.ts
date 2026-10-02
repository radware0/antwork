import { addDays, dateKey, datesBetween } from './domain.ts';
import { dailySummary } from './ui.ts';
import type { AppData, DateKey } from './types.ts';

export interface WorkHoursPoint extends Record<string, unknown> {
  day: DateKey;
  minutes: number;
}

export function workHoursSeries(data: AppData, now: number, days: number): WorkHoursPoint[] {
  const today = dateKey(now);
  return datesBetween(addDays(today, -(days - 1)), today)
    .map(day => ({ day, minutes: dailySummary(data, day, now).minutes }));
}
