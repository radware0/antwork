import type { ComponentType } from 'react';
import { useReducedMotion } from 'motion/react';
import { Dock, DockIcon } from './dock.tsx';

export interface DockItem<Page extends string> {
  page: Page;
  label: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean | 'true' }>;
}

export function FloatingDock<Page extends string>({ items, active, onNavigate }: {
  items: readonly DockItem<Page>[]; active: Page; onNavigate: (page: Page) => void;
}) {
  const reduced = useReducedMotion();
  return <nav className="floating-nav" aria-label="Main navigation"><Dock className="antwork-dock"
    iconSize={52} iconMagnification={56} iconDistance={100} disableMagnification={Boolean(reduced)}>{items.map(item => {
    const Icon = item.icon;
    return <DockIcon className="dock-slot" key={item.page}><button type="button" className={'dock-item' + (active === item.page ? ' active' : '')}
      aria-current={active === item.page ? 'page' : undefined} onClick={() => onNavigate(item.page)} title={item.label}
      >
      <Icon size={18} strokeWidth={1.8} aria-hidden="true" /><span>{item.label}</span>
    </button></DockIcon>;
  })}</Dock></nav>;
}
