import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { workHoursSeries } from '../chartData.ts';
import { dateKey, sessionDays, sessionDay } from '../domain.ts';
import { Modal } from './Modal.tsx';
import { localMinute, resolveEditedEndpoint } from '../sessionTime.ts';
import { displayDate, hoursLabel, sessionMinutes } from '../ui.ts';
import type { Mutate } from '../ui.ts';
import type { AppData, DateKey, Interval, SessionResult, WorkSession } from '../types.ts';

const resultLabels: Record<SessionResult, string> = { strong: 'Strong', steady: 'Steady', rough: 'Rough' };
const HoursPlot = lazy(() => import('./HoursPlot.tsx'));
type ResultValue = SessionResult | '';
type EditableInterval = {
  start: string; end: string; originalStart: number | null; originalEnd: number | null;
  startEdited: boolean; endEdited: boolean;
};

function readInput(value: string): number { return new Date(value).getTime(); }
function sessionTouchesDay(session: WorkSession, day: DateKey): boolean {
  return (sessionDays(session)[day] ?? 0) > 0;
}

export function SessionEditor({ session, data, mutate, onClose }: { session: WorkSession; data: AppData; mutate: Mutate; onClose: () => void }) {
  const [day, setDay] = useState(session.date ?? dateKey());
  const [hours, setHours] = useState(String(Math.floor((session.durationMinutes ?? 0) / 60)));
  const [minutes, setMinutes] = useState(String((session.durationMinutes ?? 0) % 60));
  const [intervals, setIntervals] = useState<EditableInterval[]>(session.intervals.map(interval => ({
    start: localMinute(interval.start), end: localMinute(interval.end), originalStart: interval.start, originalEnd: interval.end,
    startEdited: false, endEdited: false,
  })));
  const [note, setNote] = useState(session.note);
  const [campaignId, setCampaignId] = useState(session.campaignId ?? '');
  const [result, setResult] = useState<ResultValue>(session.result ?? '');
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async (dismiss: () => void) => {
    if (saving) return;
    const duration = Number(hours) * 60 + Number(minutes);
    const parsed: Interval[] = intervals.map(item => ({
      start: resolveEditedEndpoint(item.start, item.originalStart, item.startEdited),
      end: resolveEditedEndpoint(item.end, item.originalEnd, item.endEdited),
    }));
    if (session.timing === 'duration' ? !day || !Number.isInteger(Number(hours)) || !Number.isInteger(Number(minutes)) || Number(hours) < 0 || Number(minutes) < 0 || Number(minutes) > 59 || duration < 1 || duration > 1440 : parsed.length === 0 || parsed.some(item => !Number.isFinite(item.start) || !Number.isFinite(item.end) || item.end <= item.start)) {
      setProblem('Each interval needs an end after its start.'); return;
    }
    setSaving(true);
    try {
      await mutate(current => ({
        ...current,
        sessions: current.sessions.map(item => item.id === session.id ? {
          ...item, intervals: parsed, ...(session.timing === 'duration' ? { date: day, durationMinutes: duration } : {}), note, questOccurrenceId: null, campaignId: campaignId || null, result: result || null,
        } : item),
      }));
      dismiss();
    } catch { setProblem('Could not save this correction. Your changes are still here; try again.'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title="Edit session" onClose={onClose} busy={saving}>{dismiss => <div className="session-editor">
      {session.timing === 'duration' && <div className="field-row"><label>Date<input type="date" value={day} onChange={event => setDay(event.target.value)} /></label><label>Hours<input type="number" min="0" max="24" value={hours} onChange={event => setHours(event.target.value)} /></label><label>Minutes<input type="number" min="0" max="59" value={minutes} onChange={event => setMinutes(event.target.value)} /></label></div>}
      {intervals.map((item, index) => <div className="field-row" key={index}>
        <label>Start<input type="datetime-local" step="60" value={item.start} onChange={event => setIntervals(current => current.map((value, i) => i === index ? { ...value, start: event.target.value, startEdited: true } : value))} /></label>
        <label>End<input type="datetime-local" step="60" value={item.end} onChange={event => setIntervals(current => current.map((value, i) => i === index ? { ...value, end: event.target.value, endEdited: true } : value))} /></label>
        {intervals.length > 1 && <button type="button" className="button subtle" onClick={() => setIntervals(current => current.filter((_, i) => i !== index))}>Remove interval</button>}
      </div>)}
      {session.timing !== 'duration' && <button type="button" className="text-button" onClick={() => setIntervals(current => {
        const start = Date.now();
        return [...current, { start: localMinute(start), end: localMinute(start + 3600000), originalStart: null, originalEnd: null, startEdited: false, endEdited: false }];
      })}>+ Add interval</button>}
      <div className="field-row">
        <label className="field">Campaign<select value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="">No campaign</option>{data.campaigns.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="field">How did it feel?<select value={result} onChange={event => setResult(event.target.value as ResultValue)}><option value="">Unrated</option><option value="strong">Strong</option><option value="steady">Steady</option><option value="rough">Rough</option></select></label>
      </div>
      <label className="field">Session note<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} /></label>
      {problem && <p className="form-error" role="alert">{problem}</p>}
      <div className="button-row"><button className="button primary" disabled={saving} onClick={() => void save(dismiss)}>{saving ? 'Saving…' : 'Save correction'}</button><button className="button" disabled={saving} onClick={dismiss}>Cancel</button><button className="button subtle" disabled={saving} onClick={() => { if (window.confirm('Delete this session? Export a backup first if you may need it.')) void mutate(current => ({ ...current, sessions: current.sessions.filter(item => item.id !== session.id), pendingReviewId: current.pendingReviewId === session.id ? null : current.pendingReviewId })).then(dismiss).catch(() => setProblem('Could not delete this session.')); }}>Delete session</button></div>
    </div>}</Modal>
  );
}

export function SessionHistory({ data, mutate, day, title }: { data: AppData; mutate: Mutate; day?: DateKey; title?: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  const sessions = [...data.sessions]
    .filter(item => !day || sessionTouchesDay(item, day))
    .sort((a, b) => sessionDay(b).localeCompare(sessionDay(a)) || (b.intervals.at(-1)?.end ?? 0) - (a.intervals.at(-1)?.end ?? 0));
  return <section className="panel session-history">
    <div className="panel-heading"><h2>{title ?? 'Session history'}</h2><span>{day ? displayDate(day) : sessions.length + ' total'}</span></div>
    {sessions.length === 0 && <p className="empty">No sessions yet — start your first lock-in.</p>}
    <div className="history-list">{sessions.map(session => {
      const firstStart = session.intervals[0]?.start;
      const campaign = data.campaigns.find(item => item.id === session.campaignId);
      const result = session.result ?? null;
      return <article className={'history-item' + (result ? ' result-' + result : '')} key={session.id}>
        <div className="history-main">
          <div className="history-record">
            <strong>{session.timing === 'duration' ? displayDate(session.date!) : firstStart === undefined ? 'Session' : new Date(firstStart).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong>
            <span className="session-outcome" data-result={result ?? 'unrated'}>{result ? resultLabels[result] : 'Unrated'}</span>
            <small>{campaign ? campaign.title : 'No campaign'}{session.note ? ' · ' + session.note : ''}</small>
          </div>
          <div className="history-actions"><b>{hoursLabel(sessionMinutes(session))}</b><button className="button subtle" aria-haspopup="dialog" onClick={() => setEditing(session.id)}>Edit</button></div>
        </div>
        {editing === session.id && <SessionEditor key={session.id} session={session} data={data} mutate={mutate} onClose={() => setEditing(null)} />}
      </article>;
    })}</div>
  </section>;
}

export function ManualEntry({ data, mutate, initialDay }: { data: AppData; mutate: Mutate; initialDay?: DateKey; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  return <><button className="button" onClick={() => setOpen(true)}>Add work hours</button>
    {open && <ManualEntryForm data={data} mutate={mutate} initialDay={initialDay} onClose={() => setOpen(false)} />}</>;
}

function ManualEntryForm({ data, mutate, initialDay, onClose }: { data: AppData; mutate: Mutate; initialDay?: DateKey; onClose: () => void }) {
  const [day, setDay] = useState(initialDay ?? dateKey());
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [exact, setExact] = useState(false);
  const [start, setStart] = useState((initialDay ?? dateKey()) + 'T09:00');
  const [end, setEnd] = useState((initialDay ?? dateKey()) + 'T10:00');
  const [note, setNote] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [result, setResult] = useState<ResultValue>('');
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  return <Modal title="Add work hours" onClose={onClose} busy={saving}>
    {dismiss => <form onSubmit={async event => {
      event.preventDefault();
      if (saving) return;
      const duration = Number(hours) * 60 + Number(minutes);
      const startAt = readInput(start), endAt = readInput(end);
      if (exact ? !Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt <= startAt || endAt - startAt > 86400000
        : !day || !Number.isInteger(Number(hours)) || !Number.isInteger(Number(minutes)) || Number(hours) < 0 || Number(minutes) < 0 || Number(minutes) > 59 || duration < 1 || duration > 1440) {
        setProblem(exact ? 'Choose an end after the start, up to 24 hours.' : 'Enter between 1 minute and 24 hours.'); return;
      }
      setSaving(true);
      try {
        await mutate(current => ({ ...current, sessions: [...current.sessions, {
          id: crypto.randomUUID(), source: 'manual', questOccurrenceId: null, note, campaignId: campaignId || null, result: result || null,
          ...(exact ? { timing: 'intervals' as const, intervals: [{ start: startAt, end: endAt }] }
            : { timing: 'duration' as const, intervals: [], date: day, durationMinutes: duration }),
        }] }));
        dismiss();
      } catch { setProblem('Could not save your hours. Your entries are still here; try again.'); }
      finally { setSaving(false); }
    }}>
      {exact ? <div className="field-row"><label>Start<input type="datetime-local" step="60" value={start} onChange={event => setStart(event.target.value)} required /></label><label>End<input type="datetime-local" step="60" value={end} onChange={event => setEnd(event.target.value)} required /></label></div>
        : <><label className="field">Date<input type="date" value={day} onChange={event => { setDay(event.target.value); setStart(event.target.value + 'T09:00'); setEnd(event.target.value + 'T10:00'); }} required /></label>
          <div className="field-row"><label>Hours<input type="number" min="0" max="24" step="1" placeholder="0" value={hours} onChange={event => setHours(event.target.value)} /></label><label>Minutes<input type="number" min="0" max="59" step="1" placeholder="0" value={minutes} onChange={event => setMinutes(event.target.value)} /></label></div></>}
      <button type="button" className="text-button" onClick={() => { setExact(!exact); setProblem(''); }}>{exact ? 'Use date and duration' : 'Use start and end times'}</button>
      <details className="entry-details"><summary>More details</summary>
        <div className="field-row"><label className="field">Campaign<select value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="">No campaign</option>{data.campaigns.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="field">How did it feel?<select value={result} onChange={event => setResult(event.target.value as ResultValue)}><option value="">Unrated</option><option value="strong">Strong</option><option value="steady">Steady</option><option value="rough">Rough</option></select></label></div>
        <label className="field">Session note<textarea rows={3} value={note} onChange={event => setNote(event.target.value)} placeholder="What did you work on?" /></label>
      </details>
      {problem && <p className="form-error" role="alert">{problem}</p>}
      <div className="button-row"><button className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save hours'}</button><button type="button" className="button subtle" disabled={saving} onClick={dismiss}>Cancel</button></div>
    </form>}
  </Modal>;
}

export function HoursChart({ data, now, days = 7, compact = false }: { data: AppData; now: number; days?: number; compact?: boolean }) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (visible || !chartRef.current) return;
    if (!('IntersectionObserver' in window)) { setVisible(true); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, { rootMargin: '150px' });
    observer.observe(chartRef.current);
    return () => observer.disconnect();
  }, [visible]);
  const values = workHoursSeries(data, now, days);
  return <section className={'panel trend-panel' + (compact ? ' trend-compact' : '')}>
    <div className="panel-heading"><h2>Hours worked</h2><span>Last {days} days</span></div>
    <div ref={chartRef} className="hours-area" aria-label="Deep work hours by day">
      <div aria-hidden="true">{visible ? <Suspense fallback={<div className="chart-pending" />}>
        <HoursPlot points={values} compact={compact} />
      </Suspense> : <div className="chart-pending" />}</div>
      <ol className="sr-only">{values.map(({ day, minutes }) => <li key={day}>{displayDate(day)}: {Math.round(minutes * 100) / 100} minutes</li>)}</ol>
    </div>
    {data.sessions.length === 0 && !data.timer && <p className="chart-empty">No sessions yet — start your first lock-in.</p>}
  </section>;
}

export function WorkHoursView({ data, now, mutate }: { data: AppData; now: number; mutate: Mutate }) {
  return <div className="page-stack work-hours-page">
    <div className="page-title"><div><h1>Work Hours</h1><p>Your deep work, day by day.</p></div><ManualEntry data={data} mutate={mutate} /></div>
    <HoursChart data={data} now={now} days={30} />
    <SessionHistory data={data} mutate={mutate} />
  </div>;
}
