import { dateKey } from './domain.ts';

export function localMinute(timestamp: number): string {
  const date = new Date(timestamp);
  return dateKey(date) + 'T' + String(date.getHours()).padStart(2, '0') + ':' + String(date.getMinutes()).padStart(2, '0');
}

export function resolveEditedEndpoint(value: string, original: number | null, edited = false): number {
  return !edited && original !== null && value === localMinute(original) ? original : new Date(value).getTime();
}
