import { addDays, dateKey, datesBetween } from './domain.ts';
import { dailySummary } from './ui.ts';
import type { AppData, DateKey } from './types.ts';

export interface WorkHoursPoint extends Record<string, unknown> {
  day: DateKey;
  hours: number;
}

export function workHoursSeries(data: AppData, now: number, days: number): WorkHoursPoint[] {
  const today = dateKey(now);
  return datesBetween(addDays(today, -(days - 1)), today)
    .map(day => ({ day, hours: dailySummary(data, day, now).minutes / 60 }));
}

export function chartHoursLabel(hours: number): string {
  return Number((Math.round(hours * 1000) / 1000).toFixed(3)).toString() + 'h';
}

export function accessibleChartHours(hours: number): string {
  const value = Number((Math.round(hours * 1000) / 1000).toFixed(3));
  return value + (value === 1 ? ' hour' : ' hours');
}
