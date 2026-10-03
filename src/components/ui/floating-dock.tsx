import { useEffect, useState, type ComponentType } from 'react';
import { motion } from 'motion/react';
import { useReducedMotionPreference } from '../../useReducedMotionPreference.ts';

export interface DockItem<Page extends string> {
  page: Page;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;
}

// Adapted from the minimal dock supplied for antwork: fixed tiles, icon motion,
// and hover labels, with touch labels and native navigation controls added.
function DockButton<Page extends string>({ item, selected, onNavigate, moving }: {
  item: DockItem<Page>; selected: boolean; onNavigate: (page: Page) => void; moving: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const Icon = item.icon;
  const hot = hovered || focused;
  return <div className="dock-slot">
    <button type="button" className={'dock-item' + (selected ? ' active' : '')}
      aria-label={item.label} aria-current={selected ? 'page' : undefined}
      onClick={() => onNavigate(item.page)}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true); }}
      onPointerLeave={() => setHovered(false)}
      onFocus={event => setFocused(event.currentTarget.matches(':focus-visible'))}
      onBlur={() => setFocused(false)} onKeyDown={() => setFocused(true)}>
      <motion.span className="dock-icon" animate={{ y: moving && hot ? -2 : 0, scale: moving && hot ? 1.08 : 1 }}
        transition={{ duration: moving ? .16 : 0, ease: [.23, 1, .32, 1] }}>
        <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
      </motion.span>
      <span className="dock-label">{item.label}</span>
    </button>
    <span role="tooltip" aria-hidden={!hot} className={'dock-tooltip' + (hot ? ' visible' : '')}>{item.label}</span>
  </div>;
}

export function FloatingDock<Page extends string>({ items, active, onNavigate }: {
  items: readonly DockItem<Page>[]; active: Page; onNavigate: (page: Page) => void;
}) {
  const reduced = useReducedMotionPreference();
  const [desktopPointer, setDesktopPointer] = useState(false);
  useEffect(() => {
    const query = matchMedia('(min-width: 900px) and (hover: hover) and (pointer: fine)');
    const update = () => setDesktopPointer(query.matches);
    update(); query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return <nav className="floating-nav" aria-label="Main navigation"><div className="antwork-dock">
    {items.map(item => <DockButton key={item.page} item={item} selected={active === item.page}
      onNavigate={onNavigate} moving={desktopPointer && !reduced} />)}
  </div></nav>;
}
