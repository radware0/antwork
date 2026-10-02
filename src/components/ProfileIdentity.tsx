import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar.tsx';
import { Modal } from './Modal.tsx';
import { ProfileBanner } from './ProfileBanner.tsx';
import { ProfileCropper } from './ProfileCropper.tsx';
import { profileCareer, profileStatus } from '../profile.ts';
import { prepareProfileImage } from '../profileMedia.ts';
import { validateImport } from '../storage.ts';
import { clockTime, displayDate, hoursLabel } from '../ui.ts';
import type { Mutate } from '../ui.ts';
import type { PreparedProfileImage, ProfileImageKind } from '../profileMedia.ts';
import type { AppData, ProfileIdentity } from '../types.ts';

type CropStep = { kind: ProfileImageKind; source: PreparedProfileImage };

export function ProfileIdentityView({ data, now, mutate }: { data: AppData; now: number; mutate: Mutate }) {
  const career = useMemo(() => profileCareer(data, now), [data, now]);
  const status = profileStatus(data, now);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ProfileIdentity>(data.profile);
  const [cropStep, setCropStep] = useState<CropStep | null>(null);
  const cropSource = useRef<PreparedProfileImage | null>(null);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const editButton = useRef<HTMLButtonElement>(null);
  const savedBanner = useRef<HTMLDivElement>(null);
  const [bannerFrame, setBannerFrame] = useState({ width: 1236, height: 168 });
  const uploadToken = useRef(0);

  useEffect(() => {
    const element = savedBanner.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) setBannerFrame(current => current.width === width && current.height === height ? current : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const onMobile = bannerFrame.height < 150;
  const desktopFrame = onMobile ? { width: 1236, height: 168 } : bannerFrame;
  const mobileFrame = onMobile ? bannerFrame : { width: 340, height: 128 };

  const replaceCrop = (next: CropStep | null) => {
    cropSource.current?.dispose();
    cropSource.current = next?.source ?? null;
    setCropStep(next);
  };
  useEffect(() => () => cropSource.current?.dispose(), []);
  const closeEditor = () => {
    uploadToken.current += 1;
    replaceCrop(null);
    setUploading(false);
    setEditing(false);
    setError('');
    requestAnimationFrame(() => editButton.current?.focus());
  };
  const beginEditing = () => { replaceCrop(null); setDraft(structuredClone(data.profile)); setError(''); setEditing(true); };
  const setField = <K extends keyof ProfileIdentity>(field: K, value: ProfileIdentity[K]) => setDraft(current => ({ ...current, [field]: value }));
  const upload = async (file: File | undefined, kind: ProfileImageKind) => {
    if (!file) return;
    const token = ++uploadToken.current;
    setUploading(true);
    try {
      const source = await prepareProfileImage(file);
      if (token === uploadToken.current) { replaceCrop({ kind, source }); setError(''); }
      else source.dispose();
    } catch (cause) {
      if (token === uploadToken.current) setError(cause instanceof Error ? cause.message : 'Could not open this image.');
    } finally { if (token === uploadToken.current) setUploading(false); }
  };
  const save = async (event: React.FormEvent<HTMLFormElement>, dismiss: () => void) => {
    event.preventDefault();
    if (uploading || saving || cropStep) return;
    setSaving(true);
    const identity = { username: (draft.username ?? '').trim().replace(/^@/, '').toLowerCase(), name: draft.name.trim(), bio: draft.bio, avatar: draft.avatar, banner: draft.banner, links: draft.links.map(link => ({ label: link.label.trim(), url: link.url.trim() })) };
    try {
      validateImport({ ...data, profile: { ...data.profile, ...identity } });
      await mutate(current => ({ ...current, profile: { ...current.profile, ...identity } }));
      dismiss();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save profile. Your draft is still here.'); }
    finally { setSaving(false); }
  };

  const bestDay = career.bestDay;
  const longest = career.longestSession;
  return <>
    <section className="panel identity-panel">
      <div ref={savedBanner} className="profile-banner"><ProfileBanner key={data.profile.banner} src={data.profile.banner} alt="Profile banner" /></div>
      <div className="profile-identity-body">
        <div className="profile-identity-main">
          <Avatar className="profile-avatar"><AvatarImage src={data.profile.avatar ?? undefined} alt="Profile picture" /><AvatarFallback aria-hidden="true">{data.profile.name.trim().slice(0, 1).toUpperCase() || 'A'}</AvatarFallback></Avatar>
          <div className="profile-identity-copy">
            <h2>{data.profile.name || 'Your name'}</h2>
            {data.profile.username && <p className="profile-handle">@{data.profile.username}</p>}
            <p className={'profile-live-status ' + status.state} role="status"><i aria-hidden="true" /><strong>{status.label}</strong><span>{status.detail}</span>{status.elapsedMs !== undefined && <time>{clockTime(status.elapsedMs)}</time>}</p>
          </div>
          <button ref={editButton} className="button subtle profile-edit-button" onClick={beginEditing}>Edit profile</button>
        </div>
        <p className={'profile-bio' + (data.profile.bio ? '' : ' muted')}>{data.profile.bio || 'What keeps you locking in?'}</p>
        {data.profile.links.length > 0 && <div className="profile-links-section">
          <h3>Social / external links</h3>
          <div className="profile-links">{data.profile.links.map((link, index) => <a key={index} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={12} aria-hidden="true" /></a>)}</div>
        </div>}
      </div>
    </section>

    {editing && <Modal title="Edit profile" className="profile-editor" onClose={closeEditor} busy={saving || uploading}>
      {dismiss => <form onSubmit={event => void save(event, dismiss)} noValidate>
        {cropStep ? <ProfileCropper source={cropStep.source} kind={cropStep.kind} desktopFrame={desktopFrame} mobileFrame={mobileFrame} onCancel={() => replaceCrop(null)} onApply={image => {
          setField(cropStep.kind, image);
          replaceCrop(null);
          setError('');
        }} /> : <>
          <div className="profile-editor-media">
            <div className="profile-editor-frame"><span>Desktop frame{onMobile ? ' sample' : ' on this screen'}</span><div className="profile-editor-banner preview-desktop" style={{ aspectRatio: `${desktopFrame.width} / ${desktopFrame.height}` }}><ProfileBanner key={'desktop-' + draft.banner} src={draft.banner} alt="Desktop banner preview" /></div></div>
            <div className="profile-editor-frame-row">
              <div className="profile-editor-frame"><span>Mobile frame{onMobile ? ' on this screen' : ' sample'}</span><div className="profile-editor-banner preview-mobile" style={{ aspectRatio: `${mobileFrame.width} / ${mobileFrame.height}` }}><ProfileBanner key={'mobile-' + draft.banner} src={draft.banner} alt="Mobile banner preview" /></div></div>
              <div className="profile-editor-frame"><span>Profile picture</span><Avatar className="profile-editor-avatar"><AvatarImage src={draft.avatar ?? undefined} alt="Profile picture preview" /><AvatarFallback>{draft.name.trim().slice(0, 1).toUpperCase() || 'A'}</AvatarFallback></Avatar></div>
            </div>
          </div>
          <div className="profile-editor-fields">
            <div className="profile-media-controls">
              <label className="button file-button">Upload profile picture<input aria-label="Upload profile picture" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || saving} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file, 'avatar'); }} /></label>
              {draft.avatar && <button type="button" className="button subtle" disabled={uploading || saving} onClick={() => setField('avatar', null)}>Remove picture</button>}
              <label className="button file-button">Upload banner<input aria-label="Upload banner" type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading || saving} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; void upload(file, 'banner'); }} /></label>
              {draft.banner && <button type="button" className="button subtle" disabled={uploading || saving} onClick={() => setField('banner', null)}>Remove banner</button>}
            </div>
            <label className="field">Display name<input value={draft.name} maxLength={40} onChange={event => setField('name', event.target.value)} placeholder="Your name" /></label>
            <label className="field">Username<input value={draft.username ?? ''} maxLength={25} onChange={event => setField('username', event.target.value)} placeholder="@username" autoCapitalize="none" spellCheck={false} /></label>
            <label className="field">Bio<textarea value={draft.bio} maxLength={280} onChange={event => setField('bio', event.target.value)} placeholder="What keeps you locking in?" rows={3} /></label>
            <div className="profile-links-editor"><div className="panel-heading"><h3>Social / external links</h3><span>{draft.links.length}/5</span></div>
              {draft.links.map((link, index) => <div className="profile-link-row" key={index}>
                <label className="field">Link label {index + 1}<input value={link.label} maxLength={40} onChange={event => setField('links', draft.links.map((item, i) => i === index ? { ...item, label: event.target.value } : item))} placeholder="Portfolio" /></label>
                <label className="field">Link URL {index + 1}<input type="url" value={link.url} maxLength={2048} onChange={event => setField('links', draft.links.map((item, i) => i === index ? { ...item, url: event.target.value } : item))} placeholder="https://example.com" /></label>
                <button type="button" className="button subtle" aria-label={'Remove link ' + (index + 1)} onClick={() => setField('links', draft.links.filter((_, i) => i !== index))}>Remove</button>
              </div>)}
              <button type="button" className="button subtle" disabled={draft.links.length >= 5} onClick={() => setField('links', [...draft.links, { label: '', url: '' }])}>Add link</button>
            </div>
            {error && <p className="profile-editor-error" role="alert">{error}</p>}
            <div className="button-row"><button className="button primary" disabled={uploading || saving}>{saving ? 'Saving…' : 'Save profile'}</button><button type="button" className="button subtle" disabled={saving} onClick={dismiss}>Cancel</button></div>
          </div>
        </>}
      </form>}
    </Modal>}

    <div className="profile-section-heading"><h2>Career overview</h2></div>
    <div className="profile-stats">
      <section className="panel stat-card"><span>Total deep work</span><strong>{hoursLabel(career.totalMinutes)}</strong></section>
      <section className="panel stat-card"><span>Best day</span><strong>{bestDay ? hoursLabel(bestDay.minutes) : '—'}</strong><small>{bestDay ? displayDate(bestDay.day) : 'No work logged yet'}</small></section>
      <section className="panel stat-card"><span>Longest session</span><strong>{longest ? hoursLabel(longest.minutes) : '—'}</strong><small>{longest ? displayDate(longest.day) : 'No sessions yet'}</small></section>
      <section className="panel stat-card"><span>Most hours on one campaign</span><strong>{career.mostCampaign ? hoursLabel(career.mostCampaign.minutes) : '—'}</strong><small>{career.mostCampaign?.campaign.title ?? 'No campaign sessions yet'}</small></section>
      <section className="panel stat-card"><span>Score</span><strong>{career.score}</strong><small>1 point per 15 minutes saved</small></section>
    </div>
  </>;
}
