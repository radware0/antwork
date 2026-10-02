import { useCallback, useEffect, useRef, useState } from 'react';
import { settleCountdown } from './domain.ts';
import { repository } from './storage.ts';
import { playTimerAlarm } from './sound.ts';
import { settleExpiredCountdown } from './timerSettlement.ts';
import type { AppData } from './types.ts';

export function useLedger() {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const channel = useRef<BroadcastChannel | null>(null);
  const settling = useRef(false);

  useEffect(() => {
    let alive = true;
    repository.load().then(loaded => {
      if (alive) setData(loaded);
    }).catch(cause => { if (alive) setError(String(cause)); });
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel('work-ledger-data');
      channel.current.onmessage = () => {
        repository.load().then(loaded => { if (alive) setData(loaded); }).catch(cause => setError(String(cause)));
      };
    }
    return () => {
      alive = false;
      window.clearInterval(interval);
      channel.current?.close();
    };
  }, []);

  const mutate = useCallback(async (change: (current: AppData) => AppData) => {
    try {
      const updated = await repository.update(change);
      setData(updated);
      channel.current?.postMessage('changed');
      setError(null);
      return updated;
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }, []);

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
      const updated = await repository.replace(value);
      setData(updated);
      channel.current?.postMessage('changed');
      setError(null);
    } catch (cause) {
      setError(String(cause));
      throw cause;
    }
  }, []);

  return { data, error, now, mutate, replace, clearError: () => setError(null) };
}
