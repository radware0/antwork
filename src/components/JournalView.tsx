import { useEffect, useRef, useState } from 'react';
import type { AppData, DateKey } from '../types.ts';
import type { Mutate } from '../ui.ts';
import { displayDate } from '../ui.ts';
import { Modal } from './Modal.tsx';

export function JournalView({ data, day, mutate }: { data: AppData; day: DateKey; mutate: Mutate; compact?: boolean }) {
  const entry = data.journals.find(item => item.date === day);
  const [editor, setEditor] = useState<{ day: DateKey; text: string; editing: boolean; exists: boolean } | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const preview = useRef<HTMLParagraphElement>(null);
  const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    const element = preview.current!;
    const measure = () => setTruncated(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [entry?.text]);
  const open = (editing: boolean) => { setError(''); setEditor({ day, text: entry?.text ?? '', editing, exists: Boolean(entry) }); };
  const save = async (dismiss: () => void) => {
    if (!editor || saving) return;
    setSaving(true);
    try {
      await mutate(current => ({ ...current, journals: [...current.journals.filter(item => item.date !== editor.day),
        { date: editor.day, text: editor.text, updatedAt: Date.now() }] }));
      dismiss();
    } catch { setError('Could not save your note. Your draft is still here; try again.'); }
    finally { setSaving(false); }
  };
  return <section className="panel journal-panel">
    <div className="panel-heading"><h2>Journal</h2><span>{day}</span></div>
    <p ref={preview} className={'journal-saved-text journal-preview' + (!entry?.text ? ' muted' : '')}>{entry?.text || 'What moved forward today?'}</p>
    <div className="panel-footer"><span className="muted" role="status">{entry ? 'Saved on this device' : ''}</span><div className="button-row">
      {entry?.text && truncated && <button className="button subtle" onClick={() => open(false)}>Read journal</button>}
      <button className="button subtle" onClick={() => open(true)}>{entry ? 'Edit' : 'Write note'}</button>
    </div></div>
    {editor && <Modal title={editor.editing ? 'Edit journal' : 'Journal'} onClose={() => setEditor(null)} busy={saving} className="journal-modal">
      {dismiss => <>
      <p className="muted">{displayDate(editor.day)}</p>
      {editor.editing ? <form onSubmit={event => { event.preventDefault(); void save(dismiss); }}>
        <label className="field">Daily journal<textarea rows={12} value={editor.text} onChange={event => setEditor({ ...editor, text: event.target.value })} placeholder="What moved forward? What held you back?" /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <div className="button-row"><button className="button primary" disabled={saving}>{saving ? 'Saving…' : editor.exists ? 'Save changes' : 'Save note'}</button><button type="button" className="button subtle" disabled={saving} onClick={dismiss}>Cancel</button></div>
      </form> : <><p className="journal-saved-text">{editor.text}</p><button className="button" onClick={() => setEditor({ ...editor, editing: true })}>Edit</button></>}
      </>}
    </Modal>}
  </section>;
}
