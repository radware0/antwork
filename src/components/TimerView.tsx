import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent as ReactPointerEvent } from 'react';
import { motion, useDragControls, useMotionValue } from 'motion/react';
import { GripVertical, ImagePlus, LayoutGrid, MoveDiagonal2, ExternalLink, X } from 'lucide-react';
import { Modal } from './Modal.tsx';
import { WindowControls } from './WindowControls.tsx';
import { useSound } from '../SoundContext.tsx';
import { finishTimer, pauseTimer, resumeTimer } from '../domain.ts';
import { clockTime, countdownMinutes, timerLeft } from '../ui.ts';
import type { Mutate } from '../ui.ts';
import { normalizeTimerBackground } from '../profileMedia.ts';
import type { AppData, SessionResult, TimerPanelPreferences } from '../types.ts';

interface Props {
  data: AppData; now: number; mutate: Mutate;
  popout?: boolean;
  position: TimerPosition; onPositionChange: (position: TimerPosition) => void;
}
export interface TimerPosition { x: number; y: number }
interface DragLimits { left: number; right: number; top: number; bottom: number }
interface PanelSize { width: number; height: number | null }
type ResultValue = SessionResult | '';
const initialPosition: TimerPosition = { x: 0, y: 0 };
const initialPanelSize: PanelSize = { width: 640, height: null };
const minPanelWidth = 420;
const minPanelHeight = 400;

function clamp(value: number, min: number, max: number): number { return Math.max(min, Math.min(max, value)); }

function TimerCustomizeModal({ panel, mutate, onClose }: { panel: TimerPanelPreferences; mutate: Mutate; onClose: () => void }) {
  const [draft, setDraft] = useState<TimerPanelPreferences>(panel);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputId = useId();
  const upload = async (file?: File) => {
    if (!file) return;
    setReading(true);
    try {
      const image = await normalizeTimerBackground(file);
      setDraft(current => ({ ...current, image }));
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not prepare this image.'); }
    finally { setReading(false); }
  };
  const save = async (dismiss: () => void) => {
    if (saving || reading) return;
    setSaving(true);
    try {
      await mutate(current => ({ ...current, timerPanel: draft }));
      dismiss();
    } catch { setError('Could not save timer appearance. Your settings are still here; try again.'); }
    finally { setSaving(false); }
  };
  return <Modal title="Customize timer" className="timer-customize-modal" onClose={onClose} busy={saving || reading}>
    {dismiss => <div className="timer-customize-body">
      <div className={'timer-custom-preview' + (draft.image ? ' has-background' : '')} role="img" aria-label="Timer panel appearance preview">
        {draft.image && <div className="timer-panel-backdrop"><img className="timer-custom-preview-image" src={draft.image} alt="" style={{ opacity: draft.imageOpacity / 100, filter: `blur(${draft.imageBlur}px)` }} /><span className="timer-panel-contrast" /></div>}
        <strong>00:00:00</strong><span>Ready to lock in</span>
      </div>
      <div className="timer-background-actions">
        <label htmlFor={inputId} className="button"><ImagePlus size={15} aria-hidden="true" />{draft.image ? 'Replace image' : 'Upload image'}</label>
        <input id={inputId} className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" disabled={reading || saving} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file); }} />
        {draft.image && <button type="button" className="button subtle" disabled={reading || saving} onClick={() => setDraft(current => ({ ...current, image: null }))}>Remove image</button>}
        <span className="muted">PNG, JPEG, or WebP · 10 MB max</span>
      </div>
      <label className="field timer-slider-field">Image opacity <output>{draft.imageOpacity}%</output><input aria-label="Image opacity" type="range" min="0" max="100" step="1" value={draft.imageOpacity} disabled={!draft.image || reading || saving} onChange={event => setDraft(current => ({ ...current, imageOpacity: Number(event.target.value) }))} /></label>
      <label className="field timer-slider-field">Blur <output>{draft.imageBlur}px</output><input aria-label="Blur" type="range" min="0" max="24" step="1" value={draft.imageBlur} disabled={!draft.image || reading || saving} onChange={event => setDraft(current => ({ ...current, imageBlur: Number(event.target.value) }))} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><button className="button primary" disabled={reading || saving} onClick={() => void save(dismiss)}>{reading ? 'Preparing image…' : saving ? 'Saving…' : 'Save appearance'}</button><button type="button" className="button subtle" disabled={saving} onClick={dismiss}>Cancel</button></div>
    </div>}
  </Modal>;
}

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

export function TimerView({ data, now, mutate, position, onPositionChange, popout = false }: Props) {
  const sound = useSound();
  const [mode, setMode] = useState<'stopwatch' | 'countdown'>('stopwatch');
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [campaignId, setCampaignId] = useState('');
  const [panelSize, setPanelSizeState] = useState<PanelSize>(() => ({ width: data.timerPanel.preferredWidth, height: data.timerPanel.preferredHeight }));
  const [maxPanelSize, setMaxPanelSize] = useState({ width: 1280, height: 760 });
  const [stageHeight, setStageHeight] = useState<number | null>(null);
  const [canDrag, setCanDrag] = useState(false);
  const [canResize, setCanResize] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [sizeError, setSizeError] = useState('');
  const [sizeSaving, setSizeSaving] = useState(false);
  const [dragLimits, setDragLimits] = useState<DragLimits>({ left: 0, right: 0, top: 0, bottom: 0 });
  const workspaceRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const resizeRef = useRef<HTMLButtonElement>(null);
  const boundsRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });
  const panelSizeRef = useRef(panelSize);
  const keyboardSaveTimer = useRef<number | null>(null);
  const resizeStart = useRef<{ pointerId: number; clientX: number; clientY: number; width: number; height: number; x: number; y: number; maxWidth: number; maxHeight: number; latest: PanelSize } | null>(null);
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
  const setPanelSize = useCallback((next: PanelSize) => {
    panelSizeRef.current = next;
    setPanelSizeState(next);
  }, []);
  useEffect(() => {
    const next = { width: data.timerPanel.preferredWidth, height: data.timerPanel.preferredHeight };
    panelSizeRef.current = next;
    setPanelSizeState(current => current.width === next.width && current.height === next.height ? current : next);
  }, [data.timerPanel.preferredWidth, data.timerPanel.preferredHeight]);
  const savePanelSize = useCallback(async (next: PanelSize) => {
    setSizeSaving(true);
    try {
      await mutate(current => ({ ...current, timerPanel: { ...current.timerPanel, preferredWidth: Math.round(next.width), preferredHeight: next.height === null ? null : Math.round(next.height) } }));
      setSizeError('');
    } catch { setSizeError('Could not save this size. The timer stays here; try again.'); }
    finally { setSizeSaving(false); }
  }, [mutate]);
  const scheduleKeyboardSave = () => {
    if (keyboardSaveTimer.current !== null) window.clearTimeout(keyboardSaveTimer.current);
    keyboardSaveTimer.current = window.setTimeout(() => {
      keyboardSaveTimer.current = null;
      void savePanelSize(panelSizeRef.current);
    }, 240);
  };
  const resizeMaximum = useCallback(() => {
    const stage = stageRef.current?.getBoundingClientRect();
    const panel = panelRef.current?.getBoundingClientRect();
    if (!stage || !panel) return { width: maxPanelSize.width, height: maxPanelSize.height };
    return {
      width: clamp(Math.floor(stage.right - 16 - panel.left), minPanelWidth, maxPanelSize.width),
      height: clamp(Math.floor(stage.bottom - 16 - panel.top), minPanelHeight, maxPanelSize.height),
    };
  }, [maxPanelSize]);
  const applyLiveSize = (next: PanelSize, anchorX: number, anchorY: number) => {
    const panel = panelRef.current;
    if (!panel) return;
    const before = panel.getBoundingClientRect();
    panel.style.width = `${next.width}px`;
    panel.style.height = next.height === null ? 'auto' : `${next.height}px`;
    const after = panel.getBoundingClientRect();
    x.set(anchorX + before.left - after.left);
    y.set(anchorY + before.top - after.top);
    panelSizeRef.current = next;
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

  const resetLayout = (returnFocus = false) => {
    if (keyboardSaveTimer.current !== null) { window.clearTimeout(keyboardSaveTimer.current); keyboardSaveTimer.current = null; }
    resizeStart.current = null;
    applyLiveSize(initialPanelSize, x.get(), y.get());
    setPanelSize(initialPanelSize);
    resetPosition(returnFocus);
    void savePanelSize(initialPanelSize);
  };

  const resizeWithPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const panel = panelRef.current?.getBoundingClientRect();
    const stage = stageRef.current?.getBoundingClientRect();
    if (!panel || !stage || !canResize) return;
    if (keyboardSaveTimer.current !== null) { window.clearTimeout(keyboardSaveTimer.current); keyboardSaveTimer.current = null; }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const max = resizeMaximum();
    resizeStart.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, width: panel.width, height: panel.height, x: x.get(), y: y.get(), maxWidth: max.width, maxHeight: max.height, latest: { width: panel.width, height: panel.height } };
  };
  const moveResizePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = resizeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    const next = {
      width: clamp(Math.round(start.width + event.clientX - start.clientX), minPanelWidth, start.maxWidth),
      height: clamp(Math.round(start.height + event.clientY - start.clientY), minPanelHeight, start.maxHeight),
    };
    applyLiveSize(next, x.get(), y.get());
    start.latest = next;
  };
  const finishResizePointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const start = resizeStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    resizeStart.current = null;
    setPanelSize(start.latest);
    void savePanelSize(start.latest);
  };
  const resizeWithKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') { event.preventDefault(); resetLayout(); return; }
    const step = event.shiftKey ? 64 : 16;
    const delta = { width: event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0, height: event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0 };
    if (!delta.width && !delta.height) return;
    event.preventDefault();
    const panel = panelRef.current;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const max = resizeMaximum();
    const next = { width: clamp(Math.round(rect.width + delta.width), minPanelWidth, max.width), height: clamp(Math.round(rect.height + delta.height), minPanelHeight, max.height) };
    applyLiveSize(next, x.get(), y.get());
    setPanelSize(next);
  };
  const finishResizeKeyboard = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) scheduleKeyboardSave();
  };

  useLayoutEffect(() => {
    if (popout) return;
    const workspace = workspaceRef.current;
    const stage = stageRef.current;
    const panel = panelRef.current;
    const hint = hintRef.current;
    if (!workspace || !stage || !panel || !hint) return;

    let frame = 0;
    const update = () => {
      const dock = document.querySelector<HTMLElement>('.floating-nav');
      const dockTop = dock?.getBoundingClientRect().top ?? window.innerHeight;
      const availableHeight = Math.max(0, Math.min(760,
        dockTop - workspace.getBoundingClientRect().top - hint.getBoundingClientRect().height - 28));
      const width = stage.getBoundingClientRect().width;
      const nextMaxSize = { width: Math.floor(Math.min(1280, width - 32)), height: Math.floor(Math.min(760, availableHeight - 32)) };
      setMaxPanelSize(current => current.width === nextMaxSize.width && current.height === nextMaxSize.height ? current : nextMaxSize);
      const panelWidth = panel.offsetWidth;
      const panelHeight = panel.offsetHeight;
      const enoughRoom = !popout && window.matchMedia('(min-width: 900px)').matches
        && nextMaxSize.height >= minPanelHeight && nextMaxSize.width >= minPanelWidth;

      if (!enoughRoom) {
        boundsRef.current = { minX: 0, maxX: 0, minY: 0, maxY: 0 };
        setCanDrag(false);
        setCanResize(false);
        setStageHeight(null);
        setDragLimits({ left: 0, right: 0, top: 0, bottom: 0 });
        if (position.x !== 0 || position.y !== 0) resetPosition();
        return;
      }

      const height = Math.floor(availableHeight);
      const boundedPanelWidth = clamp(panelWidth, minPanelWidth, nextMaxSize.width);
      const boundedPanelHeight = clamp(panelHeight, minPanelHeight, nextMaxSize.height);
      boundsRef.current = {
        minX: -Math.floor((width - boundedPanelWidth) / 2) + 16,
        maxX: Math.floor((width - boundedPanelWidth) / 2) - 16,
        minY: -Math.floor((height - boundedPanelHeight) / 2) + 16,
        maxY: Math.ceil((height - boundedPanelHeight) / 2) - 16,
      };
      const nextLimits = { left: boundsRef.current.minX, right: boundsRef.current.maxX, top: boundsRef.current.minY, bottom: boundsRef.current.maxY };
      setDragLimits(current => current.left === nextLimits.left && current.right === nextLimits.right
        && current.top === nextLimits.top && current.bottom === nextLimits.bottom ? current : nextLimits);
      setCanDrag(true);
      setCanResize(true);
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
  }, [position.x, position.y, resetPosition, savePosition, x, y, panelSize.width, panelSize.height, popout]);

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Home') { event.preventDefault(); resetLayout(); return; }
    const step = event.shiftKey ? 64 : 16;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      savePosition({
        x: x.get() + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
        y: y.get() + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
      });
    }
  };

  const visibleWidth = canResize ? clamp(panelSize.width, minPanelWidth, maxPanelSize.width) : undefined;
  const visibleHeight = canResize && panelSize.height !== null ? clamp(panelSize.height, minPanelHeight, maxPanelSize.height) : undefined;
  const sizeIsDefault = panelSize.width === initialPanelSize.width && panelSize.height === null;
  return <div ref={workspaceRef} className="timers-focus timer-workspace">
    <div ref={stageRef} className={'timer-drag-stage' + (canDrag ? ' is-draggable' : ' is-static')} style={stageHeight === null ? undefined : { height: stageHeight }}>
    <motion.section ref={panelRef} className={'panel timer-panel' + (canResize ? ' is-resizable' : '') + (data.timerPanel.image ? ' has-background' : '')} drag={canDrag} dragControls={dragControls} dragListener={false}
      dragConstraints={dragLimits} dragElastic={0} dragMomentum={false} style={canDrag ? { x, y, width: visibleWidth, height: visibleHeight, maxWidth: maxPanelSize.width, maxHeight: maxPanelSize.height } : undefined}
      onDragEnd={() => savePosition({ x: x.get(), y: y.get() })}>
    {data.timerPanel.image && <div className="timer-panel-backdrop"><img className="timer-panel-image" src={data.timerPanel.image} alt="" style={{ opacity: data.timerPanel.imageOpacity / 100, filter: `blur(${data.timerPanel.imageBlur}px)` }} /><span className="timer-panel-contrast" /></div>}
    <div className="timer-panel-content">
    <div className={'panel-heading' + (popout ? ' timer-titlebar' : '')}><h2>Work timer</h2>{!popout && window.antworkDesktop && <button type="button" className="icon-button" aria-label="Pop out timer" title="Pop out timer" onClick={() => window.antworkDesktop?.openTimer()}><ExternalLink size={16} aria-hidden="true" /></button>}<span>{timer ? (timer.runningSince === null ? 'Paused' : 'Running') : 'Ready'}</span><button type="button" className="icon-button timer-customize-button" aria-label="Customize timer" title="Customize timer" onClick={() => setCustomizing(true)}><ImagePlus size={16} aria-hidden="true" /></button>{!popout && <div className="timer-move-controls">
      {canDrag && (!sizeIsDefault || position.x !== 0 || position.y !== 0) && <button type="button" className="icon-button timer-layout-reset" aria-label="Reset timer layout" title="Reset layout" onClick={() => resetLayout(true)}><LayoutGrid size={15} aria-hidden="true" /></button>}
      {canDrag && <button ref={handleRef} type="button" className="icon-button timer-move-handle" aria-label="Move timer" aria-describedby={instructionsId} title="Drag to move timer" onPointerDown={event => dragControls.start(event.nativeEvent)} onKeyDown={onHandleKeyDown}><GripVertical size={17} aria-hidden="true" /></button>}
    </div>}{popout && (window.antworkDesktop ? <WindowControls label="timer window" /> : <button type="button" className="icon-button" aria-label="Close timer window" title="Close timer window" onClick={() => window.close()}><X size={16} aria-hidden="true" /></button>)}</div>
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
    {sizeError && <div className="timer-size-error" role="alert"><span>{sizeError}</span><button type="button" className="text-button" disabled={sizeSaving} onClick={() => void savePanelSize(panelSizeRef.current)}>{sizeSaving ? 'Saving…' : 'Retry'}</button></div>}
    </div>
    {canResize && <button ref={resizeRef} type="button" className="icon-button timer-resize-handle" aria-label="Resize timer panel" title="Resize timer panel" aria-describedby={instructionsId} onPointerDown={resizeWithPointer} onPointerMove={moveResizePointer} onPointerUp={finishResizePointer} onPointerCancel={finishResizePointer} onKeyDown={resizeWithKeyboard} onKeyUp={finishResizeKeyboard}><MoveDiagonal2 size={16} aria-hidden="true" /></button>}
    <span id={instructionsId} className="sr-only">Drag the header grip to move the timer. Arrow keys move 16 pixels for position, hold Shift for 64 pixels. For size, use the bottom-right handle: arrow keys change 16 pixels, hold Shift for 64 pixels. Home on either handle resets both size and position. Movement and resizing stay within the workspace.</span>
    </motion.section>
    </div>
    {!popout && <p ref={hintRef} className="timer-history-hint">Finished sessions and match results live in Work Hours.</p>}
    {customizing && <TimerCustomizeModal panel={data.timerPanel} mutate={mutate} onClose={() => setCustomizing(false)} />}
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
