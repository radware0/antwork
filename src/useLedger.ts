import { useCallback, useEffect, useRef, useState } from 'react';
import { settleCountdown } from './domain.ts';
import { repository } from './storage.ts';
import { playTimerAlarm } from './sound.ts';
import { settleExpiredCountdown } from './timerSettlement.ts';
import type { AppData } from './types.ts';
import { saveDesktopPause } from './desktop.ts';

export function useLedger() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const channel = useRef<BroadcastChannel | null>(null);
  const settling = useRef(false);
  const desktopPause = useRef<Promise<AppData | null> | null>(null);

  const syncDesktopPause = useCallback(() => {
    const bridge = window.antworkDesktop;
    if (!bridge) return Promise.resolve(null);
    if (!desktopPause.current) {
      desktopPause.current = saveDesktopPause(repository, bridge).then(paused => {
        if (paused) channel.current?.postMessage('changed');
        return paused;
      }).finally(() => { desktopPause.current = null; });
    }
    return desktopPause.current;
  }, []);

  useEffect(() => {
    let alive = true;
    syncDesktopPause().then(() => repository.load()).then(loaded => {
      if (alive) setData(loaded);
    }).catch(cause => { if (alive) setError(String(cause)); });
    const refresh = async () => {
      try {
        const paused = await syncDesktopPause();
        if (alive) { if (paused) setData(paused); setNow(Date.now()); }
      } catch (cause) { if (alive) setError(String(cause)); }
    };
    const unsubscribe = window.antworkDesktop?.onPauseRequested(() => { void refresh(); });
    const unsubscribeDue = window.antworkDesktop?.onTimerDue(() => { void refresh(); });
    let interval: number | undefined;
    const updateVisibility = (visible: boolean) => {
      if (!alive) return;
      window.clearInterval(interval);
      interval = undefined;
      if (visible) {
        interval = window.setInterval(() => setNow(Date.now()), 1000);
        void refresh();
      }
    };
    const bridge = window.antworkDesktop;
    const onVisibility = () => { if (!bridge) updateVisibility(!document.hidden); };
    const unsubscribeVisibility = bridge?.onVisibilityChanged(updateVisibility);
    document.addEventListener('visibilitychange', onVisibility);
    if (bridge) bridge.isWindowVisible().then(updateVisibility).catch(cause => { if (alive) setError(String(cause)); });
    else onVisibility();
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('work-ledger-data');
      channel.current.onmessage = () => {
        repository.load().then(loaded => { if (alive) setData(loaded); }).catch(cause => setError(String(cause)));
      };
    }
    return () => {
      alive = false;
      window.clearInterval(interval);
      unsubscribe?.();
      unsubscribeDue?.();
      unsubscribeVisibility?.();
      document.removeEventListener('visibilitychange', onVisibility);
      channel.current?.close();
    };
  }, [syncDesktopPause]);

  useEffect(() => {
    if (!data) return;
    const timer = data.timer;
    const runningSince = timer?.runningSince ?? null;
    const deadline = timer?.mode === 'countdown' && runningSince !== null
      ? Math.ceil(runningSince + timer.durationMs! - timer.accumulatedMs) : null;
    if (window.antworkDesktop) window.antworkDesktop.reportTimer(runningSince, deadline);
    else if (deadline !== null) {
      const timeout = window.setTimeout(() => setNow(Date.now()), Math.max(0, deadline - Date.now()));
      return () => window.clearTimeout(timeout);
    }
  }, [data?.timer?.runningSince, data?.timer?.durationMs, data?.timer?.accumulatedMs, data?.timer?.mode, Boolean(data)]);

  const mutate = useCallback(async (change: (current: AppData) => AppData) => {
    try {
      await syncDesktopPause();
      const updated = await repository.update(change);
      setData(updated);
      channel.current?.postMessage('changed');
      setError(null);
      return updated;
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }, [syncDesktopPause]);

  useEffect(() => {
    if (!data?.timer || settling.current) return;
    const finished = settleCountdown(data.timer, now);
    if (!finished) return;
    settling.current = true;
    let settledByThisTab = false;
    mutate(current => {
      const result = settleExpiredCountdown(current, finished.id, Date.now());
      settledByThisTab = result.settled;
      return result.data;
    }).then(updated => { if (settledByThisTab) playTimerAlarm(updated.preferences.timerAlarm); })
      .catch(() => {}).finally(() => { settling.current = false; });
  }, [data?.timer, now, mutate]);

  const replace = useCallback(async (value: AppData) => {
    try {
      await syncDesktopPause();
      const updated = await repository.replace(value);
      setData(updated);
      channel.current?.postMessage('changed');
      setError(null);
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }, [syncDesktopPause]);

  return { data, error, now, mutate, replace, clearError: () => setError(null) };
}
