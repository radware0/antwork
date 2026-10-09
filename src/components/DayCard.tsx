import { useEffect, useRef, useState } from 'react';
import { dailyWorkedMinutes } from '../domain.ts';
import { dayQualityLabels, displayDate, hoursLabel } from '../ui.ts';
import { dayCardBackgroundForDate, dayVideoBlob, prepareDayCardBackground, removeDayCardBackground } from '../dayCardMedia.ts';
import { downloadBackup } from '../storage.ts';
import { Modal } from './Modal.tsx';
import type { Mutate } from '../ui.ts';
import type { AppData, DateKey, DayCardPreferences } from '../types.ts';
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

export function DayCard({ data, day, mutate, onClose, editOnly = false }: { data: AppData; day: DateKey; mutate: Mutate; onClose: () => void; editOnly?: boolean }) {
  const saved = dayCardBackgroundForDate(data, day);
  const savedDraft = (): DayCardPreferences => data.dayCardBackgrounds[day]
    ? { backgrounds: [data.dayCardBackgrounds[day], null], selectedIndex: 0 } : data.dayCardPreferences;
  const [editing, setEditing] = useState(editOnly);
  const [draft, setDraft] = useState<DayCardPreferences>(savedDraft);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [confirmedReplacement, setConfirmedReplacement] = useState(false);
  const legacyCount = Object.keys(data.dayCardBackgrounds).length;
  const background = editing ? (draft.selectedIndex === null ? null : draft.backgrounds[draft.selectedIndex]) : saved;
  const input = useRef<HTMLInputElement>(null);
  const customizeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (editing) input.current?.focus(); else customizeButton.current?.focus(); }, [editing]);
  const rating = data.dailyRatings[day];
  const minutes = dailyWorkedMinutes(data.sessions, day);
  return <Modal title={editing ? 'Day-card backgrounds' : 'Day card'} onClose={onClose} busy={busy} className="day-card-modal">
    {dismiss => <>
      <article className={'day-card' + (background ? ' has-background' : '')} aria-label={editOnly ? 'Day-card background preview' : 'Worked-day achievement'}>
        {background?.kind === 'image' && <img className="day-card-media" src={background.data} alt="" />}
        {background?.kind === 'video' && <VideoBackground key={background.data} data={background.data} />}
        <div className="day-card-content">
          <span className="day-card-brand">antwork / your workday</span>
          <h3>{editOnly ? 'Background preview' : displayDate(day)}</h3>
          {!editOnly && <>
            <strong className="day-card-hours">{hoursLabel(minutes)}</strong>
            <span className="day-card-caption">Saved work</span>
            <span className={'day-card-quality quality-' + (rating ?? 'unrated')}>{rating ? dayQualityLabels[rating] : 'Unrated'}</span>
          </>}
        </div>
      </article>
      {editing && <>
        <p className="muted">Save up to two pictures or videos. The selected background applies to every day card.</p>
        <label className="day-card-choice"><input type="radio" name="day-card-background" checked={draft.selectedIndex === null} disabled={busy} onChange={() => setDraft(current => ({ ...current, selectedIndex: null }))} />No background</label>
        <div className="day-card-backgrounds">
          {([0, 1] as const).map(index => <fieldset className="day-card-slot" key={index}>
            <legend>Background {index + 1}</legend>
            <label className="day-card-choice"><input type="radio" name="day-card-background" checked={draft.selectedIndex === index} disabled={busy || !draft.backgrounds[index]} onChange={() => setDraft(current => ({ ...current, selectedIndex: index }))} />Use background {index + 1}</label>
            <label className="field">{draft.backgrounds[index] ? 'Replace picture or video' : 'Add picture or video'}<input ref={index === 0 ? input : undefined} aria-label={'Background ' + (index + 1) + ' picture or video'} type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm" disabled={busy} onChange={async event => {
              const file = event.target.files?.[0]; event.target.value = ''; if (!file || busy) return;
              setBusy(true); setProblem('');
              try {
                const prepared = await prepareDayCardBackground(file);
                setDraft(current => {
                  const backgrounds: DayCardPreferences['backgrounds'] = [...current.backgrounds];
                  backgrounds[index] = prepared;
                  return { backgrounds, selectedIndex: index };
                });
              } catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Could not open this background.'); }
              finally { setBusy(false); }
            }} /></label>
            <button type="button" className="button subtle" disabled={busy || !draft.backgrounds[index]} onClick={() => { setDraft(current => removeDayCardBackground(current, index)); setProblem(''); }}>Remove background {index + 1}</button>
          </fieldset>)}
        </div>
        <p className="muted">PNG, JPEG, WebP up to 10 MiB. MP4 or WebM up to 5 MiB and 30 seconds. Videos play silently.</p>
        {legacyCount > 0 && <div className="day-card-legacy">
          <p>Saving will replace all {legacyCount} older per-date backgrounds. Export a backup first if you want to keep them.</p>
          <button type="button" className="button" disabled={busy} onClick={() => {
            try { downloadBackup(data); }
            catch { setProblem('Could not export. Your older backgrounds are unchanged; try again.'); }
          }}>Export JSON</button>
          <label className="day-card-choice"><input type="checkbox" checked={confirmedReplacement} disabled={busy} onChange={event => setConfirmedReplacement(event.target.checked)} />Replace all older per-date backgrounds</label>
        </div>}
      </>}
      {problem && <p className="form-error" role="alert">{problem}</p>}
      <div className="button-row">
        {editing ? <>
          <button type="button" className="button primary" disabled={busy || (legacyCount > 0 && !confirmedReplacement)} onClick={async () => {
            if (busy) return; setBusy(true); setProblem('');
            try {
              await mutate(current => {
                if (Object.keys(current.dayCardBackgrounds).length && !confirmedReplacement) throw new Error('Confirm replacement of older per-date backgrounds before saving.');
                return { ...current, dayCardBackgrounds: {}, dayCardPreferences: draft };
              });
              setConfirmedReplacement(false);
              if (editOnly) dismiss(); else setEditing(false);
            } catch (cause) { setProblem(cause instanceof Error ? cause.message : 'Could not save. Your draft is still here; try again.'); }
            finally { setBusy(false); }
          }}>{busy ? 'Working…' : 'Save backgrounds'}</button>
          <button type="button" className="button" disabled={busy} onClick={() => { setDraft(savedDraft()); setConfirmedReplacement(false); setProblem(''); if (editOnly) dismiss(); else setEditing(false); }}>Cancel</button>
        </> : <>
          <button ref={customizeButton} type="button" className="button primary" data-initial-focus onClick={() => { setDraft(savedDraft()); setEditing(true); setConfirmedReplacement(false); setProblem(''); }}>Day-card backgrounds</button>
          <button type="button" className="button" onClick={dismiss}>Close</button>
        </>}
      </div>
    </>}
  </Modal>;
}
