import { useSyncExternalStore } from 'react';

const query = () => window.matchMedia('(prefers-reduced-motion: reduce)');
const subscribe = (notify: () => void) => {
  const media = query();
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
const snapshot = () => query().matches;

// Keep persistent controls responsive when the OS preference changes mid-session.
export function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, snapshot, () => false);
}
