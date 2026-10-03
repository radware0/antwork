import { useState } from 'react';
import { dateKey } from '../domain.ts';
import { assertBackupImportSize, validateImport } from '../storage.ts';
import { ProfileIdentityView } from './ProfileIdentity.tsx';
import { Modal } from './Modal.tsx';
import type { Mutate } from '../ui.ts';
import type { AppData, Campaign } from '../types.ts';

function CampaignEditor({ campaign, mutate, onClose }: { campaign: Campaign | null; mutate: Mutate; onClose: () => void }) {
  const [title, setTitle] = useState(campaign?.title ?? '');
  const [description, setDescription] = useState(campaign?.note ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  return <Modal title={campaign ? 'Edit campaign' : 'Create campaign'} onClose={onClose} busy={saving}>
    {dismiss => <form onSubmit={async event => {
      event.preventDefault();
      if (saving) return;
      if (!title.trim()) { setError('Add a title.'); return; }
      setSaving(true);
      try {
        await mutate(current => ({ ...current, campaigns: campaign
          ? current.campaigns.map(item => item.id === campaign.id ? { ...item, title: title.trim(), note: description.trim() } : item)
          : [...current.campaigns, { id: crypto.randomUUID(), title: title.trim(), note: description.trim(), createdAt: Date.now(), completedAt: null }] }));
        dismiss();
      } catch { setError('Could not save this campaign. Your draft is still here; try again.'); }
      finally { setSaving(false); }
    }}>
      <label className="field">Title<input value={title} onChange={event => setTitle(event.target.value)} maxLength={120} required /></label>
      <label className="field">Description<textarea value={description} onChange={event => setDescription(event.target.value)} maxLength={500} rows={4} /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="button-row"><button className="button primary" disabled={saving}>{saving ? 'Saving…' : campaign ? 'Save campaign' : 'Create campaign'}</button><button type="button" className="button subtle" disabled={saving} onClick={dismiss}>Cancel</button></div>
    </form>}
  </Modal>;
}

export function ProfileView({ data, now, mutate, replace }: { data: AppData; now: number; mutate: Mutate; replace: (data: AppData) => Promise<void> }) {
  const [campaignEditor, setCampaignEditor] = useState<Campaign | 'new' | null>(null);
  const [imported, setImported] = useState<AppData | null>(null);
  const [backupMessage, setBackupMessage] = useState('');
  const [replacing, setReplacing] = useState(false);
  const [campaignBusy, setCampaignBusy] = useState(false);
  const exportData = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = 'antwork-' + dateKey(now) + '.json'; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="page-stack profile-page">
    <div className="page-title"><div><h1>Profile</h1><p>Your career</p></div></div>
    <ProfileIdentityView data={data} now={now} mutate={mutate} />
    <div className="profile-management bento-grid">
      <section className="panel campaigns-panel">
        <div className="panel-heading"><h2>Campaigns</h2><button className="button subtle" onClick={() => setCampaignEditor('new')}>Create campaign</button></div>
        {data.campaigns.length === 0 && <p className="empty">Your next project starts here.</p>}
        {data.campaigns.map(campaign => <article className="campaign-row" key={campaign.id}>
          <div className="campaign-copy"><strong>{campaign.title}</strong>{campaign.note && <p>{campaign.note}</p>}<small>{campaign.completedAt === null ? 'Active campaign' : 'Finished campaign'}</small></div>
          <div className="campaign-actions"><button className="button subtle" onClick={() => setCampaignEditor(campaign)}>Edit</button><button className="button subtle" disabled={campaignBusy} onClick={async () => {
            if (campaignBusy) return; setCampaignBusy(true);
            try { await mutate(current => ({ ...current, campaigns: current.campaigns.map(item => item.id === campaign.id ? { ...item, completedAt: item.completedAt === null ? Date.now() : null } : item) })); }
            catch { /* The shared error banner reports persistence failures. */ }
            finally { setCampaignBusy(false); }
          }}>{campaign.completedAt === null ? 'Finish' : 'Reopen'}</button></div>
        </article>)}
      </section>
      <div className="page-stack">
        <section className="panel"><div className="panel-heading"><h2>Local backup</h2></div><p className="muted">Keep a copy of your history outside this browser.</p><div className="button-row backup-actions"><button className="button" onClick={exportData}>Export JSON</button><label className="button file-button">Import JSON<input type="file" accept="application/json,.json" onChange={async event => {
          const file = event.target.files?.[0]; if (!file) return;
          try { assertBackupImportSize(file.size); setImported(validateImport(JSON.parse(await file.text()))); setBackupMessage(''); }
          catch (cause) { setBackupMessage(cause instanceof Error ? cause.message : 'Could not import backup.'); }
          event.target.value = '';
        }} /></label></div>{backupMessage && <p className="muted" role="status">{backupMessage}</p>}</section>
      </div>
    </div>
    {campaignEditor && <CampaignEditor campaign={campaignEditor === 'new' ? null : campaignEditor} mutate={mutate} onClose={() => setCampaignEditor(null)} />}
    {imported && <Modal title="Replace local history" onClose={() => setImported(null)} busy={replacing}>
      {dismiss => <><p>Replace local history with {imported.sessions.length} saved sessions? Export your current data first.</p>
      {backupMessage && <p role="alert" className="form-error">{backupMessage}</p>}
      <div className="button-row backup-actions"><button className="button primary" disabled={replacing} onClick={async () => {
        if (replacing) return; setReplacing(true);
        try { await replace(imported); setBackupMessage('Backup imported.'); dismiss(); }
        catch { setBackupMessage('Could not replace history. Your backup is still available; try again.'); }
        finally { setReplacing(false); }
      }}>Replace local history</button><button className="button" disabled={replacing} onClick={dismiss}>Cancel import</button></div></>}
    </Modal>}
  </div>;
}
