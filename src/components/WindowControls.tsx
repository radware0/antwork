import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

export function WindowControls({ label = 'antwork' }: { label?: string }) {
  const bridge = window.antworkDesktop;
  const [maximized, setMaximized] = useState(false);
  useEffect(() => {
    if (!bridge) return;
    let alive = true;
    const unsubscribe = bridge.onMaximizedChanged(setMaximized);
    void bridge.isWindowMaximized().then(value => { if (alive) setMaximized(value); }).catch(() => {});
    return () => { alive = false; unsubscribe(); };
  }, [bridge]);
  if (!bridge) return null;
  const maximizeLabel = `${maximized ? 'Restore' : 'Maximize'} ${label}`;
  return <div className="window-controls" role="group" aria-label="Window controls">
    <button type="button" className="window-button" aria-label={`Minimize ${label}`} title={`Minimize ${label}`} onClick={() => bridge.controlWindow('minimize')}><Minus size={15} aria-hidden="true" /></button>
    <button type="button" className="window-button" aria-label={maximizeLabel} title={maximizeLabel} onClick={() => bridge.controlWindow('toggle-maximize')}>{maximized ? <Copy size={13} aria-hidden="true" /> : <Square size={13} aria-hidden="true" />}</button>
    <button type="button" className="window-button window-close" aria-label={`Close ${label}`} title={`Close ${label}`} onClick={() => bridge.controlWindow('close')}><X size={15} aria-hidden="true" /></button>
  </div>;
}
