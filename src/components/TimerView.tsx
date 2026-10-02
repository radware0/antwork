import { useState } from 'react';
import { Modal } from './Modal.tsx';
import { useSound } from '../SoundContext.tsx';
import { finishTimer, pauseTimer, resumeTimer } from '../domain.ts';
import { clockTime, countdownMinutes, timerLeft } from '../ui.ts';
import type { Mutate } from '../ui.ts';
import type { AppData, SessionResult } from '../types.ts';

interface Props { data: AppData; now: number; mutate: Mutate }
type ResultValue = SessionResult | '';

export function TimerStatus({ data, now, mutate, onOpen }: { data: AppData; now: number; mutate: Mutate; onOpen: () => void }) {
  const sound = useSound();
  const timer = data.timer;
  const state = !timer ? 'Ready' : timer.runningSince === null ? 'Paused' : 'Running';
  const campaign = data.campaigns.find(item => item.id === timer?.campaignId);
  const context = !timer ? 'Ready to lock in' : campaign?.title ?? 'Free session';
  const actionLabel = !timer ? 'Start lock-in' : timer.runningSince === null ? 'Resume lock-in' : 'Open Timer';
  const primaryAction = () => {
    if (timer?.runningSince != null) { onOpen(); return; }
    let changed = false;
    if (timer) {
      void mutate(current => current.timer?.id === timer.id && current.timer.runningSince === null
        ? (changed = true, { ...current, timer: resumeTimer(current.timer, Date.now()) }) : current)
        .then(() => { if (changed) sound.click(); }).catch(() => {});
      return;
    }
    void mutate(current => current.timer || current.pendingReviewId ? current : (changed = true, { ...current, timer: {
      id: crypto.randomUUID(), mode: 'stopwatch', durationMs: null,
      accumulatedMs: 0, intervals: [], runningSince: Date.now(), questOccurrenceId: null, campaignId: null,
    } })).then(() => { if (changed) sound.click(); }).catch(() => {});
  };
  return <section className="timer-status">
    <div className="panel-heading"><h2>Work timer</h2><span>{state}</span></div>
    <strong className="timer-status-clock">{timer ? clockTime(timerLeft(data, now)) : '00:00:00'}</strong>
    <p className="muted">{context}{timer?.mode === 'countdown' ? ' · remaining' : ''}</p>
    <button className="button primary" onClick={primaryAction}>{actionLabel}</button>
  </section>;
}

export function TimerView({ data, now, mutate }: Props) {
  const sound = useSound();
  const [mode, setMode] = useState<'stopwatch' | 'countdown'>('stopwatch');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [campaignId, setCampaignId] = useState('');
  const timer = data.timer;
  const duration = countdownMinutes(hours, minutes);
  const action = (change: (current: AppData) => AppData) => { void mutate(change).catch(() => {}); };
  const control = (change: (current: AppData) => AppData) => {
    let changed = false;
    void mutate(current => {
      const next = change(current);
      changed = next !== current;
      return next;
    }).then(() => { if (changed) sound.click(); }).catch(() => {});
  };
  const selectedCampaign = data.campaigns.find(item => item.id === (timer?.campaignId ?? campaignId));
  const updateCampaign = (value: string) => {
    setCampaignId(value);
    if (timer) action(current => current.timer?.id === timer.id ? { ...current, timer: { ...current.timer, campaignId: value || null, questOccurrenceId: null } } : current);
  };
  return <section className="panel timer-panel">
    <div className="panel-heading"><h2>Work timer</h2><span>{timer ? (timer.runningSince === null ? 'Paused' : 'Running') : 'Ready'}</span></div>
    {timer ? <div className="timer-active-context"><strong>{selectedCampaign?.title ?? 'Free session'}</strong><span>{selectedCampaign ? 'Campaign' : 'No campaign linked'}</span></div> : (
      <div className="timer-setup">
        <div className="field-row">
          <label>Mode<select value={mode} onChange={event => setMode(event.target.value as 'stopwatch' | 'countdown')}><option value="stopwatch">Stopwatch</option><option value="countdown">Countdown</option></select></label>
          {mode === 'countdown' && <>
            <label>Hours<input type="number" min="0" max="12" step="1" value={hours} onChange={event => setHours(Number(event.target.value))} /></label>
            <label>Minutes<input type="number" min="0" max="59" step="1" value={minutes} onChange={event => setMinutes(Number(event.target.value))} /></label>
          </>}
        </div>
        <label className="field">Campaign<select value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="">No campaign · Free session</option>{data.campaigns.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      </div>
    )}
    {timer && <label className="field timer-campaign-select">Campaign<select value={timer.campaignId ?? ''} onChange={event => updateCampaign(event.target.value)}><option value="">No campaign · Free session</option>{data.campaigns.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
    <div className="timer-display" aria-live="off">{timer ? clockTime(timerLeft(data, now)) : mode === 'countdown' ? clockTime((duration ?? 0) * 60000) : '00:00:00'}</div>
    {timer ? <div className="button-row timer-controls">
      <button className="button" onClick={() => control(current => current.timer?.id === timer.id ? ({ ...current, timer: timer.runningSince === null ? resumeTimer(current.timer, Date.now()) : pauseTimer(current.timer, Date.now()) }) : current)}>{timer.runningSince === null ? 'Resume' : 'Pause'}</button>
      <button className="button primary" onClick={() => control(current => {
        if (!current.timer || current.timer.id !== timer.id) return current;
        const session = finishTimer(current.timer, Date.now());
        return { ...current, timer: null, sessions: session.intervals.length ? [...current.sessions, session] : current.sessions, pendingReviewId: session.intervals.length ? session.id : null };
      })}>Finish session</button>
    </div> : <div className="button-row timer-controls">
      <button className="button primary" disabled={mode === 'countdown' && duration === null} onClick={() => control(current => current.timer || current.pendingReviewId ? current : ({ ...current, timer: {
        id: crypto.randomUUID(), mode, durationMs: mode === 'countdown' ? (duration ?? 0) * 60000 : null,
        accumulatedMs: 0, intervals: [], runningSince: Date.now(), questOccurrenceId: null, campaignId: campaignId || null,
      } }))}>Start session</button>
    </div>}
  </section>;
}

export function SessionReview({ data, mutate }: { data: AppData; mutate: Mutate }) {
  const session = data.sessions.find(item => item.id === data.pendingReviewId);
  const [note, setNote] = useState(session?.note ?? '');
  const [campaignId, setCampaignId] = useState(session?.campaignId ?? '');
  const [result, setResult] = useState<ResultValue>(session?.result ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  if (!session) return null;
  const minutes = session.intervals.reduce((sum, interval) => sum + interval.end - interval.start, 0);
  const save = async (dismiss: () => void) => {
    setSaving(true);
    try {
      await mutate(current => ({
        ...current,
        sessions: current.sessions.map(item => item.id === session.id ? { ...item, note, campaignId: campaignId || null, questOccurrenceId: null, result: result || null } : item),
      }));
      dismiss();
    } catch { setError('Could not save this session. Your note and choices are still here; try again.'); }
    finally { setSaving(false); }
  };
  return <Modal title="Session complete" queued busy={saving} onClose={async () => {
    setSaving(true);
    try { await mutate(current => ({ ...current, pendingReviewId: null })); }
    catch (cause) { setError('Could not close this review. Try again; your session is saved.'); throw cause; }
    finally { setSaving(false); }
  }}>{dismiss => <>
      <p className="muted">{clockTime(minutes)}</p>
      <label className="field">Campaign<select value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="">No campaign</option>{data.campaigns.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
      <label className="field">How did it feel?<select value={result} onChange={event => setResult(event.target.value as ResultValue)}><option value="">Unrated</option><option value="strong">Strong</option><option value="steady">Steady</option><option value="rough">Rough</option></select></label>
      <label className="field">Session note<textarea rows={4} value={note} onChange={event => setNote(event.target.value)} placeholder="What moved forward?" /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button primary full" disabled={saving} onClick={() => void save(dismiss)}>{saving ? 'Saving…' : 'Save session'}</button>
    </>}
  </Modal>;
}
