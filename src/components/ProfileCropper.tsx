import { useEffect, useRef, useState } from 'react';
import { coverSourceRect, cropSourceRect, renderProfileCrop } from '../profileMedia.ts';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { PreparedProfileImage, ProfileCrop, ProfileImageKind } from '../profileMedia.ts';

const centeredCrop: ProfileCrop = { zoom: 1, x: 0, y: 0 };
const clamp = (value: number) => Math.min(1, Math.max(-1, value));

export function ProfileCropper({ source, kind, desktopFrame, mobileFrame, onApply, onCancel }: {
  source: PreparedProfileImage; kind: ProfileImageKind;
  desktopFrame: { width: number; height: number }; mobileFrame: { width: number; height: number };
  onApply: (image: string) => void; onCancel: () => void;
}) {
  const [crop, setCrop] = useState<ProfileCrop>(centeredCrop);
  const [error, setError] = useState('');
  const canvas = useRef<HTMLCanvasElement>(null);
  const desktopPreview = useRef<HTMLCanvasElement>(null);
  const mobilePreview = useRef<HTMLCanvasElement>(null);
  const avatarPreview = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ pointerId: number; clientX: number; clientY: number; crop: ProfileCrop } | null>(null);

  useEffect(() => {
    const element = canvas.current!;
    const context = element.getContext('2d');
    if (!context) { setError('Image editing is unavailable in this browser.'); return; }
    const rect = cropSourceRect(source.width, source.height, kind, crop);
    context.clearRect(0, 0, element.width, element.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(source.bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, element.width, element.height);
    for (const preview of [desktopPreview.current, mobilePreview.current, avatarPreview.current]) {
      if (!preview) continue;
      const previewContext = preview.getContext('2d');
      if (!previewContext) continue;
      const cover = coverSourceRect(element.width, element.height, preview.width, preview.height);
      previewContext.clearRect(0, 0, preview.width, preview.height);
      previewContext.drawImage(element, cover.x, cover.y, cover.width, cover.height, 0, 0, preview.width, preview.height);
    }
  }, [crop, kind, source, desktopFrame.width, desktopFrame.height, mobileFrame.width, mobileFrame.height]);

  const move = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const rect = cropSourceRect(source.width, source.height, kind, active.crop);
    const travelX = Math.max(0, ((source.width / rect.width) - 1) * bounds.width / 2);
    const travelY = Math.max(0, ((source.height / rect.height) - 1) * bounds.height / 2);
    setCrop(current => ({
      ...current,
      x: travelX ? clamp(active.crop.x - (event.clientX - active.clientX) / travelX) : 0,
      y: travelY ? clamp(active.crop.y - (event.clientY - active.clientY) / travelY) : 0,
    }));
  };
  return <section className="profile-crop-step" aria-labelledby="profile-crop-heading">
    <div><h3 id="profile-crop-heading">Crop {kind === 'avatar' ? 'profile picture' : 'banner'}</h3><p className="muted">Drag the image or use the arrow keys to frame it.</p></div>
    <div className={'profile-crop-frame crop-' + kind}>
    <canvas ref={canvas} className="profile-crop-canvas" width={kind === 'avatar' ? 512 : 800} height={kind === 'avatar' ? 512 : 300}
      tabIndex={0} role="img" aria-label={'Crop ' + (kind === 'avatar' ? 'profile picture' : 'banner') + '. Use arrow keys to reposition.'}
      onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, crop }; }}
      onPointerMove={move} onPointerUp={event => { event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={event => {
        const step = event.shiftKey ? 0.15 : 0.05;
        if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
        event.preventDefault();
        setCrop(current => ({ ...current,
          x: clamp(current.x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)),
          y: clamp(current.y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)),
        }));
      }} />
      <div className="profile-crop-grid" aria-hidden="true"><i /><i /><i /><i /></div>
    </div>
    {kind === 'avatar' ? <div className="crop-avatar-preview"><span>Profile frame</span><canvas ref={avatarPreview} width={128} height={128} role="img" aria-label="Circular profile picture preview" /></div>
      : <div className="crop-banner-previews" aria-label="Final banner frames">
        <div><span>Desktop frame</span><canvas ref={desktopPreview} width={600} height={Math.max(1, Math.round(600 * desktopFrame.height / desktopFrame.width))} role="img" aria-label="Desktop banner preview" /></div>
        <div><span>Mobile frame</span><canvas ref={mobilePreview} width={320} height={Math.max(1, Math.round(320 * mobileFrame.height / mobileFrame.width))} role="img" aria-label="Mobile banner preview" /></div>
      </div>}
    <label className="field crop-zoom">Zoom<input type="range" min="1" max="3" step="0.01" value={crop.zoom} onChange={event => setCrop(current => ({ ...current, zoom: Number(event.target.value) }))} /><output>{crop.zoom.toFixed(1)}×</output></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="button-row"><button type="button" className="button primary" onClick={() => {
      try { onApply(renderProfileCrop(source, kind, crop)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not apply this crop.'); }
    }}>Apply crop</button><button type="button" className="button" onClick={() => { setCrop(centeredCrop); setError(''); }}>Reset</button><button type="button" className="button subtle" onClick={onCancel}>Cancel crop</button></div>
  </section>;
}
