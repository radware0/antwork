import { useEffect, useRef, useState } from 'react';
import { dailyWorkedMinutes } from '../domain.ts';
import { dayQualityLabels, displayDate, hoursLabel } from '../ui.ts';
import { dayVideoBlob, prepareDayCardBackground } from '../dayCardMedia.ts';
import { Modal } from './Modal.tsx';
import type { Mutate } from '../ui.ts';
import type { AppData, DateKey, DayCardBackground } from '../types.ts';
import './day-card.css';

function VideoBackground({ data }: { data: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [url, setUrl] = useState('');
  const [problem, setProblem] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(dayVideoBlob(data));
    setUrl(objectUrl); setProblem('');
    return () => { ref.current?.pause(); URL.revokeObjectURL(objectUrl); };
  }, [data]);
  useEffect(() => {
    const video = ref.current;
    if (!video || !url) return;
    const bridge = window.antworkDesktop;
    let visible = !document.hidden;
    let active = true;
    const update = () => {
      video.muted = true; video.volume = 0;
      if (!visible) video.pause();
      else void video.play().catch(() => setProblem('This video cannot play. Replace or remove the background.'));
    };
    const onVisibility = () => { if (!bridge) { visible = !document.hidden; update(); } };
    const unsubscribe = bridge?.onVisibilityChanged(value => { visible = value; update(); });
    if (bridge) void bridge.isWindowVisible().then(value => { if (active) { visible = value; update(); } }).catch(() => video.pause());
    else update();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; unsubscribe?.(); document.removeEventListener('visibilitychange', onVisibility); video.pause(); };
  }, [url]);
  return <>
    <video ref={ref} className="day-card-media" src={url || undefined} autoPlay muted loop playsInline preload="auto" aria-hidden="true"
      onVolumeChange={event => { event.currentTarget.muted = true; event.currentTarget.volume = 0; }}
      onError={() => setProblem('This video cannot play. Replace or remove the background.')} />
    {problem && <p className="day-card-playback-error" role="alert">{problem}</p>}
  </>;
}

export function DayCard({ data, day, mutate, onClose }: { data: AppData; day: DateKey; mutate: Mutate; onClose: () => void }) {
  const saved = data.dayCardBackgrounds[day] ?? null;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DayCardBackground | null>(saved);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const background = editing ? draft : saved;
  const input = useRef<HTMLInputElement>(null);
  const customizeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); else customizeButton.current?.focus(); }, [editing]);
  const rating = data.dailyRatings[day];
  const minutes = dailyWorkedMinutes(data.sessions, day);
  return <Modal title={editing ? 'Customize day card' : 'Day card'} onClose={onClose} busy={busy} className="day-card-modal">
    {dismiss => <>
      <article className={'day-card' + (background ? ' has-background' : '')} aria-label="Worked-day achievement">
        {background?.kind === 'image' && <img className="day-card-media" src={background.data} alt="" />}
        {background?.kind === 'video' && <VideoBackground key={background.data} data={background.data} />}
        <div className="day-card-content">
          <span className="day-card-brand">antwork / your workday</span>
          <h3>{displayDate(day)}</h3>
          <strong className="day-card-hours">{hoursLabel(minutes)}</strong>
          <span className="day-card-caption">Saved work</span>
          <span className={'day-card-quality quality-' + (rating ?? 'unrated')}>{rating ? dayQualityLabels[rating] : 'Unrated'}</span>
        </div>
      </article>
      {editing && <>
        <label className="field">Background picture or video<input ref={input} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" disabled={busy} onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return;
          setBusy(true); setProblem('');
          try { setDraft(await prepareDayCardBackground(file)); }
          catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Could not open this background.'); }
          finally { setBusy(false); }
        }} /></label>
        <p className="muted">PNG, JPEG, WebP up to 10 MiB. MP4 or WebM up to 5 MiB and 30 seconds. Videos play silently.</p>
      </>}
      {problem && <p className="form-error" role="alert">{problem}</p>}
      <div className="button-row">
        {editing ? <>
          <button type="button" className="button primary" disabled={busy} onClick={async () => {
            if (busy) return; setBusy(true); setProblem('');
            try {
              await mutate(current => {
                const dayCardBackgrounds = { ...current.dayCardBackgrounds };
                if (draft) dayCardBackgrounds[day] = draft; else delete dayCardBackgrounds[day];
                return { ...current, dayCardBackgrounds };
              });
              setEditing(false);
            } catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Could not save. Your draft is still here; try again.'); }
            finally { setBusy(false); }
          }}>{busy ? 'Working…' : 'Save background'}</button>
          <button type="button" className="button" disabled={busy} onClick={() => { setDraft(saved); setEditing(false); setProblem(''); }}>Cancel</button>
          <button type="button" className="button subtle" disabled={busy || !draft} onClick={() => { setDraft(null); setProblem(''); }}>Remove background</button>
        </> : <>
          <button ref={customizeButton} type="button" className="button primary" data-initial-focus onClick={() => { setDraft(saved); setEditing(true); setProblem(''); }}>Customize card</button>
          <button type="button" className="button" onClick={dismiss}>Close</button>
        </>}
      </div>
    </>}
  </Modal>;
}
