import { useState } from 'react';
import { Scales } from './ui/scales.tsx';

export function ProfileBanner({ src, alt }: { src: string | null; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Scales />;
  return <>{!loaded && <span className="skeleton media-loading" aria-hidden="true" />}
    <img src={src} alt={alt} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} style={{ visibility: loaded ? 'visible' : 'hidden' }} /></>;
}
