import { useRef, useState } from 'react';
import { Modal } from './Modal.tsx';
import type { Mutate } from '../ui.ts';
import type { AppData } from '../types.ts';

export function UsernamePrompt({ mutate, onDone }: { mutate: Mutate; onDone: (warning?: string) => void }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const completed = useRef(false);
  const normalized = username.trim().replace(/^@/, '').toLowerCase();

  const save = async (dismiss: () => void) => {
    if (saving) return;
    if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
      setError('Use 3–24 letters, numbers, or underscores.');
      return;
    }
    setSaving(true);
    try {
      await mutate(current => ({ ...current, profile: { ...current.profile, username: normalized }, onboarding: { usernamePromptCompleted: true } }));
      completed.current = true;
      onDone();
      dismiss();
    } catch { setError('Could not save your handle. It is still here; try again or skip for now.'); }
    finally { setSaving(false); }
  };

  const finishWithoutHandle = async () => {
    if (completed.current) return;
    try {
      await mutate((current: AppData) => ({ ...current, onboarding: { usernamePromptCompleted: true } }));
      completed.current = true;
      onDone();
    } catch {
      completed.current = true;
      onDone('We could not remember that you skipped the handle prompt. It may appear again after reload.');
    }
  };

  return <Modal title="Pick your handle" className="username-prompt" busy={saving} quiet onClose={finishWithoutHandle}>
    {dismiss => <form onSubmit={event => { event.preventDefault(); void save(dismiss); }}>
      <p className="muted">Choose a local handle for your antwork profile. You can change it later.</p>
      <label className="field">Username<input aria-describedby="username-prompt-help" autoCapitalize="none" autoComplete="off" maxLength={25} placeholder="@your_handle" spellCheck={false} value={username} onChange={event => { setUsername(event.target.value); setError(''); }} /></label>
      <small id="username-prompt-help" className="muted">3–24 letters, numbers, or underscores.</small>
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="button-row"><button type="submit" className="button primary" disabled={saving}>{saving ? 'Saving…' : 'Save handle'}</button><button type="button" className="button subtle" disabled={saving} onClick={dismiss}>Skip for now</button></div>
    </form>}
  </Modal>;
}
