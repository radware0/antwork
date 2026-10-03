import { useCallback, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { motion, useDragControls, useMotionValue } from 'motion/react';
import { GripVertical, RotateCcw } from 'lucide-react';
import { Modal } from './Modal.tsx';
import { useSound } from '../SoundContext.tsx';
import { finishTimer, pauseTimer, resumeTimer } from '../domain.ts';
import { clockTime, countdownMinutes, timerLeft } from '../ui.ts';
import type { Mutate } from '../ui.ts';
import type { AppData, SessionResult } from '../types.ts';

interface Props {
  data: AppData; now: number; mutate: Mutate;
  position: TimerPosition; onPositionChange: (position: TimerPosition) => void;
}
export interface TimerPosition { x: number; y: number }
interface DragLimits { left: number; right: number; top: number; bottom: number }
type ResultValue = SessionResult | '';
const initialPosition: TimerPosition = { x: 0, y: 0 };

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

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

export function TimerView({ data, now, mutate, position, onPositionChange }: Props) {
  const sound = useSound();
  const [mode, setMode] = useState<'stopwatch' | 'countdown'>('stopwatch');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [campaignId, setCampaignId] = useState('');
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);
  const [dragLimits, setDragLimits] = useState<DragLimits>({ left: 0, right: 0, top: 0, bottom: 0 });
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const boundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const dragControls = useDragControls();
  const x = useMotionValue(position.x);
  const y = useMotionValue(position.y);
  const instructionsId = useId();
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
  const savePosition = useCallback((next: TimerPosition) => {
    const bounds = boundsRef.current;
    const bounded = {
      x: clamp(next.x, bounds.minX, bounds.maxX),
      y: clamp(next.y, bounds.minY, bounds.maxY),
    };
    x.set(bounded.x); y.set(bounded.y);
    onPositionChange(bounded);
  }, [onPositionChange, x, y]);
  const resetPosition = useCallback((returnFocus = false) => {
    x.set(0); y.set(0);
    onPositionChange(initialPosition);
    if (returnFocus) requestAnimationFrame(() => handleRef.current?.focus());
  }, [onPositionChange, x, y]);

  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    const stage = stageRef.current;
    const panel = panelRef.current;
    const hint = hintRef.current;
    if (!workspace || !stage || !panel || !hint) return;

    let frame = 0;
    const update = () => {
      const dock = document.querySelector<HTMLElement>('.floating-nav');
      const dockTop = dock?.getBoundingClientRect().top ?? window.innerHeight;
      const availableHeight = Math.min(760,
        dockTop - workspace.getBoundingClientRect().top - hint.getBoundingClientRect().height - 28);
      const width = stage.getBoundingClientRect().width;
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const enoughRoom = window.matchMedia('(min-width: 900px)').matches
        && availableHeight >= panelHeight + 32 && width >= panelWidth + 32;

      if (!enoughRoom) {
        boundsRef.current = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        setCanDrag(false);
        setStageHeight(null);
        setDragLimits({ left: 0, right: 0, top: 0, bottom: 0 });
        if (position.x !== 0 || position.y !== 0) resetPosition();
        return;
      }

      const height = Math.floor(availableHeight);
      boundsRef.current = {
        minX: -Math.floor((width - panelWidth) / 2),
        maxX: Math.floor((width - panelWidth) / 2),
        minY: -Math.floor((height - panelHeight) / 2),
        maxY: Math.ceil((height - panelHeight) / 2),
      };
      const nextLimits = { left: boundsRef.current.minX, right: boundsRef.current.maxX, top: boundsRef.current.minY, bottom: boundsRef.current.maxY };
      setDragLimits(current => current.left === nextLimits.left && current.right === nextLimits.right
        && current.top === nextLimits.top && current.bottom === nextLimits.bottom ? current : nextLimits);
      setCanDrag(true);
      setStageHeight(current => current === height ? current : height);
      const next = {
        x: clamp(x.get(), boundsRef.current.minX, boundsRef.current.maxX),
        y: clamp(y.get(), boundsRef.current.minY, boundsRef.current.maxY),
      };
      if (next.x !== x.get() || next.y !== y.get()) savePosition(next);
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    for (const element of [workspace, stage, panel, hint, document.querySelector('.floating-nav')]) {
      if (element instanceof Element) observer.observe(element);
    }
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, { passive: true });
    window.visualViewport?.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener('resize', schedule);
      window.removeEventListener('scroll', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
    };
  }, [position.x, position.y, resetPosition, savePosition, x, y]);

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') { event.preventDefault(); resetPosition(); return; }
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      savePosition({
        x: x.get() + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: y.get() + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
      });
    }
  };

  return <div ref={workspaceRef} className="timers-focus timer-workspace">
    <div ref={stageRef} className={'timer-drag-stage' + (canDrag ? ' is-draggable' : ' is-static')} style={stageHeight === null ? undefined : { height: stageHeight }}>
    <motion.section ref={panelRef} className="panel timer-panel" drag={canDrag} dragControls={dragControls} dragListener={false}
      dragConstraints={dragLimits} dragElastic={0} dragMomentum={false} style={canDrag ? { x, y } : undefined}
      onDragEnd={() => savePosition({ x: x.get(), y: y.get() })}>
    <div className="panel-heading"><h2>Work timer</h2><span>{timer ? (timer.runningSince === null ? 'Paused' : 'Running') : 'Ready'}</span><div className="timer-move-controls">
      {canDrag && <>
        {position.x !== 0 || position.y !== 0 ? <button type="button" className="icon-button timer-position-reset" aria-label="Reset timer position" title="Reset timer position" onClick={() => resetPosition(true)}><RotateCcw size={15} aria-hidden="true" /></button> : null}
        <button ref={handleRef} type="button" className="icon-button timer-move-handle" aria-label="Move timer" aria-describedby={instructionsId} title="Drag to move timer" onPointerDown={event => dragControls.start(event.nativeEvent)} onKeyDown={onHandleKeyDown}><GripVertical size={17} aria-hidden="true" /></button>
        <span id={instructionsId} className="sr-only">Drag to move. Arrow keys move 16 pixels. Hold Shift to move 64 pixels. Press Home to reset.</span>
      </>}
    </div></div>
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
    </motion.section>
    </div>
    <p ref={hintRef} className="timer-history-hint">Finished sessions and match results live in Work Hours.</p>
  </div>;
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
