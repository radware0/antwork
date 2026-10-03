import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { animate, motion, useMotionValue, useSpring, useTransform, useVelocity } from 'motion/react';
import { Moon, Sun } from 'lucide-react';
import { useReducedMotionPreference } from '../../useReducedMotionPreference.ts';

type Appearance = 'light' | 'dark';
interface Props {
  theme: Appearance;
  onThemeChange: (theme: Appearance) => Promise<void>;
  disabled?: boolean;
  className?: string;
}
const TRACK = 92;
const THUMB = 36;
const SHUT_X = 5;
const OPEN_X = TRACK - THUMB - SHUT_X;
const MID_X = (SHUT_X + OPEN_X) / 2;
const settle = { type: 'spring' as const, stiffness: 170, damping: 21.5, mass: .9 };
const clamp = (value: number) => Math.max(SHUT_X, Math.min(OPEN_X, value));

// Bencho liquid-toggle source supplied by the user, adapted to controlled
// appearance and commit-on-release. Its single thumb needs no SVG goo filter.
export function LiquidThemeToggle({ theme, onThemeChange, disabled = false, className = '' }: Props) {
  const reduced = useReducedMotionPreference();
  const rail = useRef<HTMLButtonElement>(null);
  const grip = useRef<{ id: number; grab: number | null; startX: number; moved: boolean } | null>(null);
  const committing = useRef(false);
  const [held, setHeld] = useState(false);
  const [hot, setHot] = useState(false);
  const [pending, setPending] = useState<Appearance | null>(null);
  const x = useMotionValue(theme === 'dark' ? OPEN_X : SHUT_X);
  const velocity = useVelocity(x);
  const eased = useSpring(velocity, { stiffness: 320, damping: 40, mass: .6 });
  const swell = useSpring(hot && !reduced ? 1.035 : 1, { stiffness: 520, damping: 34, mass: .6 });
  const wide = useTransform([eased, swell], ([v, s]: number[]) => reduced ? 1 : (1 + Math.min(.4, Math.abs(v) / 600) * .36) * s);
  const tall = useTransform([eased, swell], ([v, s]: number[]) => reduced ? 1 : s / (1 + Math.min(.4, Math.abs(v) / 600) * .36));
  const busy = disabled || pending !== null;

  useEffect(() => {
    if (held) return;
    const target = (pending ?? theme) === 'dark' ? OPEN_X : SHUT_X;
    const run = animate(x, target, reduced ? { duration: 0 } : settle);
    return () => run.stop();
  }, [theme, held, pending, reduced, x]);

  const commit = async (next: Appearance) => {
    if (busy || committing.current) return;
    if (next === theme) { x.set(theme === 'dark' ? OPEN_X : SHUT_X); return; }
    committing.current = true;
    setPending(next);
    try { await onThemeChange(next); }
    catch { /* The app's shared error banner reports failed persistence. */ }
    finally { committing.current = false; setPending(null); }
  };
  const release = (event: PointerEvent<HTMLButtonElement>, cancel = false) => {
    const current = grip.current;
    if (!current || current.id !== event.pointerId) return;
    grip.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* Pointer already released. */ }
    setHeld(false);
    if (cancel) { x.set(theme === 'dark' ? OPEN_X : SHUT_X); return; }
    void commit(current.moved ? (x.get() > MID_X ? 'dark' : 'light') : (theme === 'dark' ? 'light' : 'dark'));
  };

  return <button ref={rail} type="button" role="switch" aria-label="Dark appearance" aria-checked={theme === 'dark'}
    aria-busy={pending !== null} disabled={busy} className={'liquid-theme-toggle ' + className}
    data-on={(pending ?? theme) === 'dark'} title={'Switch to ' + (theme === 'dark' ? 'White' : 'Black') + ' appearance'}
    onPointerDown={event => {
      if (event.button !== 0 || busy) return;
      event.preventDefault();
      grip.current = { id: event.pointerId, grab: null, startX: x.get(), moved: false };
      setHeld(true);
      try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* Synthetic pointer. */ }
    }}
    onPointerMove={event => {
      const current = grip.current;
      const box = rail.current?.getBoundingClientRect();
      if (!current || current.id !== event.pointerId || !box) return;
      const at = (event.clientX - box.left) / (box.width / TRACK);
      if (current.grab === null) current.grab = at - x.get();
      const next = clamp(at - current.grab);
      if (Math.abs(next - current.startX) > 3) current.moved = true;
      x.set(next);
    }} onPointerUp={event => release(event)} onPointerCancel={event => release(event, true)}
    onPointerEnter={event => { if (event.pointerType === 'mouse') setHot(true); }} onPointerLeave={() => setHot(false)}
    onKeyDown={event => {
      if (event.key !== ' ' && event.key !== 'Enter') return;
      event.preventDefault();
      void commit(theme === 'dark' ? 'light' : 'dark');
    }}
    onClick={event => { if (event.detail === 0) void commit(theme === 'dark' ? 'light' : 'dark'); }}>
    <motion.span className="liquid-theme-thumb" aria-hidden="true" style={{ x, scaleX: wide, scaleY: tall }} />
    <Sun className="liquid-theme-sun" size={16} strokeWidth={1.8} aria-hidden="true" />
    <Moon className="liquid-theme-moon" size={16} strokeWidth={1.8} aria-hidden="true" />
  </button>;
}
