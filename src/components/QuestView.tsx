import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { dateKey, generateOccurrences } from '../domain.ts';
import type { Mutate } from '../ui.ts';
import type { AppData, Quest, Recurrence, Stake } from '../types.ts';

interface Props { data: AppData; mutate: Mutate; today: string }

export function QuestView({ data, mutate, today }: Props) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(today);
  const [stake, setStake] = useState<Stake>(10);
  const [recurrence, setRecurrence] = useState<Recurrence>('none');
  const [campaignId, setCampaignId] = useState('');
  const dueList = data.occurrences.filter(item => item.dueDate <= today && item.completedAt === null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialogOpen && dialog && !dialog.open) {
      dialog.showModal();
      dialog.querySelector<HTMLInputElement>('input')?.focus();
    } else if (!dialogOpen && dialog?.open) dialog.close();
  }, [dialogOpen]);
  useEffect(() => {
    if (!dialogOpen && wasOpen.current) triggerRef.current?.focus();
    wasOpen.current = dialogOpen;
  }, [dialogOpen]);
  const openDialog = () => {
    setTitle(''); setDue(today); setStake(10); setRecurrence('none'); setCampaignId(''); setSaveError('');
    setDialogOpen(true);
  };
  const closeDialog = () => {
    setDialogOpen(false);
    setTitle(''); setDue(today); setStake(10); setRecurrence('none'); setCampaignId(''); setSaveError('');
  };
  return (
    <section className="quest-strip" aria-labelledby="quest-strip-title">
      <div className="panel-heading"><h2>Quests</h2><span className="quest-open-count">{dueList.length} open</span></div>
      <p className="muted quest-score-note">Create a quest to mark your next lock-in.</p>
      <button ref={triggerRef} className="button subtle quest-create-trigger" onClick={openDialog}>New quest</button>
      <dialog ref={dialogRef} className="quest-create-dialog" aria-labelledby="quest-create-title"
        onCancel={event => { event.preventDefault(); closeDialog(); }}
        onClick={event => { if (event.target === event.currentTarget) closeDialog(); }}>
        <div className="quest-create-content">
          <div className="panel-heading quest-create-heading"><div><h2 id="quest-create-title">New quest</h2><p className="muted">Choose one thing to lock in on.</p></div>
            <button type="button" className="icon-button" aria-label="Close new quest" onClick={closeDialog}><X size={16} /></button></div>
        <form onSubmit={event => {
          event.preventDefault();
          if (!title.trim()) return;
          const quest = { id: crypto.randomUUID(), title: title.trim(), campaignId: campaignId || null, stake, recurrence, startDate: due, endDate: null, active: true };
          void mutate(current => ({
            ...current,
            quests: [...current.quests, quest],
            occurrences: generateOccurrences([...current.quests, quest], current.occurrences, due, dateKey(new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0))),
          })).then(() => closeDialog()).catch(() => setSaveError('Could not save this quest. Your draft is still here; try again.'));
        }}>
          <label className="field">Quest name<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} placeholder="Write project draft" /></label>
          <div className="field-row">
            <label>First due date<input type="date" required value={due} onChange={event => setDue(event.target.value)} /></label>
            <label>Size<select value={stake} onChange={event => setStake(Number(event.target.value) as Stake)}><option value={5}>Small · 5 score</option><option value={10}>Medium · 10 score</option><option value={20}>Large · 20 score</option></select></label>
          </div>
          <div className="field-row">
            <label>Repeat<select value={recurrence} onChange={event => setRecurrence(event.target.value as Recurrence)}><option value="none">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
            <label>Campaign<select value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="">None</option>{data.campaigns.filter(item => item.completedAt === null).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          </div>
          {saveError && <p className="form-error" role="alert">{saveError}</p>}
          <div className="button-row quest-create-actions"><button className="button subtle" type="button" onClick={closeDialog}>Cancel</button><button className="button primary" type="submit">Create quest</button></div>
        </form>
        </div>
      </dialog>
    </section>
  );
}

function QuestEditor({ quest, data, mutate, today }: Props & { quest: Quest }) {
  const [title, setTitle] = useState(quest.title);
  const [stake, setStake] = useState<Stake>(quest.stake);
  const [repeat, setRepeat] = useState<Recurrence>(quest.recurrence);
  const [active, setActive] = useState(quest.active);
  const [campaignId, setCampaignId] = useState(quest.campaignId ?? '');
  const [saved, setSaved] = useState(false);
  return <details className="creation"><summary>{quest.title} · {quest.stake} score · {quest.active ? quest.recurrence : 'stopped'}</summary>
    <form onSubmit={event => {
      event.preventDefault();
      void mutate(current => {
        const old = current.quests.find(item => item.id === quest.id);
        if (!old) return current;
        const scheduleChanged = old.recurrence !== repeat || old.active !== active;
        const updated = { ...old, title: title.trim(), stake, campaignId: campaignId || null, recurrence: repeat, active,
          startDate: scheduleChanged ? today : old.startDate };
        const linked = new Set([...current.sessions.map(item => item.questOccurrenceId), current.timer?.questOccurrenceId]);
        const kept = scheduleChanged ? current.occurrences.filter(item => item.questId !== quest.id || item.dueDate <= today || item.completedAt !== null || linked.has(item.id)) : current.occurrences;
        const quests = current.quests.map(item => item.id === quest.id ? updated : item);
        return { ...current, quests, occurrences: generateOccurrences(quests, kept, today, dateKey(new Date(new Date().getFullYear(), new Date().getMonth() + 2, 0))) };
      }).then(() => setSaved(true)).catch(() => {});
    }}>
      <label className="field">Edit quest name<input required value={title} onChange={event => { setTitle(event.target.value); setSaved(false); }} /></label>
      <div className="field-row"><label>Edit size<select value={stake} onChange={event => setStake(Number(event.target.value) as Stake)}><option value={5}>Small · 5 score</option><option value={10}>Medium · 10 score</option><option value={20}>Large · 20 score</option></select></label>
      <label>Edit repeat<select value={repeat} onChange={event => setRepeat(event.target.value as Recurrence)}><option value="none">Once</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
      <label>Edit campaign<select value={campaignId} onChange={event => setCampaignId(event.target.value)}><option value="">None</option>{data.campaigns.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
      <label className="checkbox"><input type="checkbox" checked={active} onChange={event => setActive(event.target.checked)} /> Generate new occurrences</label>
      <p className="muted">Name and size corrections update history. Repeat changes apply from today; past occurrences and linked sessions stay intact. Correct individual due dates in Calendar.</p>
      <button className="button primary">Save quest correction</button>{saved && <span role="status"> Saved</span>}
    </form>
  </details>;
}
export function QuestManager(props: Props) {
  const openOccurrences = props.data.occurrences.filter(item => item.dueDate <= props.today && item.completedAt === null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return <div className="quest-manager-list">
    <h3>Open quests</h3>
    {openOccurrences.length === 0 && <p className="empty">No open quests. Create one when you’re ready.</p>}
    {openOccurrences.map(item => {
      const quest = props.data.quests.find(value => value.id === item.questId);
      return <div className="quest-row" key={item.id}>
        <button className="check-button" aria-label={'Complete ' + (quest?.title ?? 'quest')} onClick={() => { void props.mutate(current => ({
          ...current, occurrences: current.occurrences.map(value => value.id === item.id ? { ...value, completedAt: Date.now() } : value),
        })).catch(() => {}); }} />
        <div className="quest-copy"><strong>{quest?.title ?? 'Untitled quest'}</strong><span>{item.dueDate < props.today ? 'Missed quest · ' : 'Due today · '}{quest?.stake ?? 0} score</span></div>
      </div>;
    })}
    <h3 className="quest-log-title">Quest log</h3>
    {props.data.quests.length === 0 && <p className="empty">Create a quest to build your history.</p>}
    {props.data.quests.map(quest => <QuestEditor key={quest.id} {...props} quest={quest} />)}
  </div>;
}
