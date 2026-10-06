import { pauseTimer } from './domain.ts';
import type { AppData } from './types.ts';
import type { LedgerRepository } from './storage.ts';

export interface DesktopPause { id: string; at: number; reason: 'close' | 'sleep' | 'recovery' }
export interface DesktopBridge {
  openDocumentation(): void;
  openTimer(): void;
  controlWindow(action: 'minimize' | 'toggle-maximize' | 'close'): void;
  isWindowMaximized(): Promise<boolean>;
  onMaximizedChanged(listener: (maximized: boolean) => void): () => void;
  getPendingPause(): Promise<DesktopPause | null>;
  acknowledgePause(id: string): Promise<boolean>;
  reportTimer(runningSince: number | null, deadline: number | null): void;
  onPauseRequested(listener: () => void): () => void;
  onTimerDue(listener: () => void): () => void;
  isWindowVisible(): Promise<boolean>;
  onVisibilityChanged(listener: (visible: boolean) => void): () => void;
}

declare global { interface Window { antworkDesktop?: DesktopBridge } }

export function pauseDesktopTimer(data: AppData, at: number): AppData {
  if (!Number.isFinite(at) || at < 0) throw new Error('Invalid desktop pause time.');
  if (!data.timer || data.timer.runningSince === null) return data;
  return { ...data, timer: pauseTimer(data.timer, Math.max(at, data.timer.runningSince)) };
}

export async function saveDesktopPause(store: LedgerRepository, bridge: DesktopBridge): Promise<AppData | null> {
  const request = await bridge.getPendingPause();
  if (!request) return null;
  const updated = await store.update(data => pauseDesktopTimer(data, request.at));
  await bridge.acknowledgePause(request.id);
  return updated;
}
