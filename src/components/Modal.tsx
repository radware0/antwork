import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { X } from 'lucide-react';
import { useSound } from '../SoundContext.tsx';

type ModalChildren = ReactNode | ((dismiss: () => void) => ReactNode);

export function Modal({ title, children, onClose, busy = false, className = '', queued = false, quiet = false }: {
  title: string; children: ModalChildren; onClose: () => void | Promise<void>; busy?: boolean; className?: string; queued?: boolean; quiet?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const id = useId();
  const reduced = useReducedMotion();
  const sound = useSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const dialog = ref.current!;
    const show = () => {
      if (dialog.open || (queued && document.querySelector('dialog[open]'))) return;
      opener.current = document.activeElement as HTMLElement;
      dialog.showModal();
      if (!quiet) soundRef.current.click();
      dialog.querySelector<HTMLElement>('input:not([type=file]), textarea, select, [data-initial-focus]')?.focus();
    };
    show();
    const observer = new MutationObserver(show);
    if (queued) observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['open'], childList: true });
    return () => {
      observer.disconnect();
      dialog.close();
      if (opener.current?.isConnected) opener.current.focus();
    };
  }, [queued, quiet]);
  const close = () => { if (!busy) setClosing(true); };
  return <motion.dialog ref={ref} className={'app-modal ' + className} aria-labelledby={id}
    onCancel={event => { event.preventDefault(); close(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, a[href], [tabindex="0"]')].filter(item => item.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    initial={{ opacity: 0, y: reduced ? 0 : 8 }}
    animate={{ opacity: closing ? 0 : 1, y: closing && !reduced ? 8 : 0 }}
    transition={{ duration: reduced ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }}
    onAnimationComplete={() => { if (closing) void Promise.resolve().then(onClose).then(() => { if (!quiet) sound.click(); }).catch(() => setClosing(false)); }}>
    <div className="panel-heading modal-heading"><h2 id={id}>{title}</h2><button type="button" className="icon-button" aria-label={'Close ' + title.toLowerCase()} disabled={busy} onClick={close}><X size={18} /></button></div>
    {typeof children === 'function' ? children(close) : children}
  </motion.dialog>;
}
