import { settleCountdown } from './domain.ts';
import type { AppData } from './types.ts';

export function settleExpiredCountdown(data: AppData, timerId: string, now: number): { data: AppData; settled: boolean } {
  if (!data.timer || data.timer.id !== timerId) return { data, settled: false };
  const session = settleCountdown(data.timer, now);
  if (!session) return { data, settled: false };
  return {
    data: { ...data, timer: null, sessions: [...data.sessions, session], pendingReviewId: session.id },
    settled: true,
  };
}
