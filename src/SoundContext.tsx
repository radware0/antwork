import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { playInterfaceSound, primeAudio } from './sound.ts';
import type { SoundPreferences } from './types.ts';

const SoundContext = createContext({ click: () => {} });

export function SoundProvider({ preferences, children }: { preferences: SoundPreferences; children: ReactNode }) {
  useEffect(() => {
    const unlock = () => primeAudio(preferences.interfaceSounds || preferences.timerAlarm);
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    return () => {
      window.removeEventListener('pointerdown', unlock, { capture: true });
      window.removeEventListener('keydown', unlock, { capture: true });
    };
  }, [preferences.interfaceSounds, preferences.timerAlarm]);
  const value = useMemo(() => ({ click: () => playInterfaceSound(preferences.interfaceSounds) }), [preferences.interfaceSounds]);
  return <SoundContext.Provider value={value}>{children}</SoundContext.Provider>;
}

export function useSound() { return useContext(SoundContext); }
