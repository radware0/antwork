import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { CalendarDays, Clock3, LayoutDashboard, UserRound, X, ChartNoAxesCombined, Volume2, VolumeX } from 'lucide-react';
import { dateKey, localDate } from './domain.ts';
import { dailySummary, hoursLabel } from './ui.ts';
import { useLedger } from './useLedger.ts';
import { CalendarView, DayDetails } from './components/CalendarView.tsx';
import { JournalView } from './components/JournalView.tsx';
import { SessionReview, TimerStatus, TimerView, type TimerPosition } from './components/TimerView.tsx';
import { HoursChart, WorkHoursView, ManualEntry, SessionHistory } from './components/WorkHoursView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { UsernamePrompt } from './components/UsernamePrompt.tsx';
import { LoadingView } from './components/LoadingView.tsx';
import { SoundProvider } from './SoundContext.tsx';
import { playInterfaceSound, toggleSoundPreferences } from './sound.ts';
import { Avatar, AvatarFallback, AvatarImage } from './components/ui/avatar.tsx';
import { FloatingDock } from './components/ui/floating-dock.tsx';
import { LiquidThemeToggle } from './components/ui/liquid-theme-toggle.tsx';
import type { AppData, DateKey } from './types.ts';

type Page = 'dashboard' | 'timers' | 'calendar' | 'hours' | 'profile';
const nav: { page: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { page: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { page: 'timers', label: 'Timers', icon: Clock3 },
  { page: 'calendar', label: 'Calendar', icon: CalendarDays },
  { page: 'hours', label: 'Work Hours', icon: ChartNoAxesCombined },
  { page: 'profile', label: 'Profile', icon: UserRound },
];

function readPage(): Page {
  const name = window.location.hash.slice(1);
  return nav.some(item => item.page === name) ? name as Page : 'dashboard';
}

function TodaySummary({ data, now }: { data: AppData; now: number }) {
  const today = dateKey(now);
  const summary = dailySummary(data, today, now);
  return <section className="today-panel">
    <div className="panel-heading"><h2>Today</h2><span>{localDate(today).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span></div>
    <div className="today-value">{hoursLabel(summary.minutes)}</div>
    <div className="muted today-caption">Deep work logged</div>
  </section>;
}

function Dashboard({ data, now, mutate, month, setMonth, openCalendar, openTimer, openProfile }: {
  data: AppData; now: number; mutate: ReturnType<typeof useLedger>['mutate'];
  month: DateKey; setMonth: (day: DateKey) => void; openCalendar: () => void;
  openTimer: () => void; openProfile: () => void;
}) {
  const timerState = !data.timer ? 'Ready' : data.timer.runningSince === null ? 'Paused' : 'Running';
  return <div className="page-stack dashboard-page">
    <div className="page-title"><div><h1>Dashboard</h1><p>Your work, one day at a time.</p></div><div className="dashboard-title-actions"><span className="page-date">{new Date(now).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><button className="icon-button profile-shortcut" aria-label={'Open Profile, timer status ' + timerState.toLowerCase()} title={'Profile · ' + timerState} onClick={openProfile}><span className="dashboard-avatar"><Avatar><AvatarImage src={data.profile.avatar ?? undefined} alt="" /><AvatarFallback><UserRound size={17} /></AvatarFallback></Avatar><i className={'dashboard-status-dot ' + timerState.toLowerCase()} /></span></button></div></div>
    <div className="dashboard-layout bento-grid">
      <div className="dashboard-main"><CalendarView mode="overview" data={data} now={now} month={month} onMonth={setMonth} onOpen={openCalendar} mutate={mutate} /></div>
      <aside className="dashboard-side"><div className="dashboard-rail panel"><TodaySummary data={data} now={now} /><TimerStatus data={data} now={now} mutate={mutate} onOpen={openTimer} /></div><JournalView data={data} day={dateKey(now)} mutate={mutate} /></aside>
    </div>
    <div className="dashboard-secondary">
      <HoursChart data={data} now={now} days={7} compact />
    </div>
  </div>;
}

export default function App() {
  const reduced = useReducedMotion();
  const { data, error, now, mutate, replace, clearError } = useLedger();
  const [page, setPage] = useState<Page>(readPage);
  const [month, setMonth] = useState<DateKey>(() => dateKey(new Date(new Date().getFullYear(), new Date().getMonth(), 1)));
  const [selectedDay, setSelectedDay] = useState<DateKey>(dateKey);
  const [timerPosition, setTimerPosition] = useState<TimerPosition>({ x: 0, y: 0 });
  const [soundBusy, setSoundBusy] = useState(false);
  const [themeBusy, setThemeBusy] = useState(false);
  const [usernamePromptDismissed, setUsernamePromptDismissed] = useState(false);
  const [usernamePromptWarning, setUsernamePromptWarning] = useState('');
  useEffect(() => {
    const onHash = () => setPage(readPage());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (data) document.documentElement.dataset.theme = data.theme;
  }, [data?.theme]);
  const navigate = (next: Page) => {
    playInterfaceSound(Boolean(data?.preferences.interfaceSounds));
    if (next === 'calendar' && page !== 'calendar') {
      const currentMonth = dateKey(new Date(new Date(now).getFullYear(), new Date(now).getMonth(), 1));
      setSelectedDay(month === currentMonth ? dateKey(now) : month);
    }
    window.location.hash = next;
    setPage(next);
  };
  if (!data) return error ? <div className="startup-screen startup-error"><span className="startup-title">antwork</span><p role="alert">Could not open local history.</p><button className="button primary" onClick={() => window.location.reload()}>Reload app</button></div> : <LoadingView />;

  const soundOn = data.preferences.interfaceSounds || data.preferences.timerAlarm;
  const toggleSound = async () => {
    if (soundBusy) return;
    setSoundBusy(true);
    try {
      let enabled = false;
      await mutate(current => {
        const preferences = toggleSoundPreferences(current.preferences);
        enabled = preferences.interfaceSounds;
        return { ...current, preferences };
      });
      if (enabled) playInterfaceSound(true, true);
    } catch { /* The shared error banner reports persistence failures. */ }
    finally { setSoundBusy(false); }
  };
  const switchTheme = async (next: 'light' | 'dark') => {
    if (themeBusy) return;
    setThemeBusy(true);
    try {
      await mutate(current => ({ ...current, theme: next === 'light' ? 'white' : 'black' }));
      playInterfaceSound(Boolean(data.preferences.interfaceSounds));
    } finally { setThemeBusy(false); }
  };

  return <SoundProvider preferences={data.preferences}><div className="app-shell">
    <header className="app-topbar"><div className="brand"><span className="brand-mark" aria-hidden="true">a</span><span className="brand-name">antwork</span></div><div className="topbar-actions"><LiquidThemeToggle className="topbar-theme" disabled={themeBusy} theme={data.theme === 'white' ? 'light' : 'dark'} onThemeChange={switchTheme} /><a className="topbar-docs" href="/docs/">Docs</a><button type="button" className="icon-button sound-toggle" aria-label={soundOn ? 'Mute sounds' : 'Unmute sounds'} title={soundOn ? 'Mute sounds' : 'Unmute sounds'} aria-pressed={!soundOn} disabled={soundBusy} onClick={() => void toggleSound()}>{soundOn ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}</button></div></header>
    <main className="main-content">
      {error && <div className="error-banner" role="alert">{error}<button aria-label="Dismiss error" onClick={clearError}><X size={16} /></button></div>}
      {usernamePromptWarning && <p className="muted" role="status">{usernamePromptWarning}</p>}
      <motion.div key={page} initial={{ opacity: 0.65, y: reduced ? 0 : 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduced ? 0 : 0.18, ease: [0.23, 1, 0.32, 1] }} className="page-transition">
      {page === 'dashboard' && <Dashboard data={data} now={now} mutate={mutate} month={month} setMonth={setMonth} openCalendar={() => navigate('calendar')} openTimer={() => navigate('timers')} openProfile={() => navigate('profile')} />}
      {page === 'timers' && <div className="page-stack timers-page"><div className="page-title"><div><h1>Timers</h1><p>Start a stopwatch or choose a countdown.</p></div></div><TimerView data={data} now={now} mutate={mutate} position={timerPosition} onPositionChange={setTimerPosition} /> </div>}
      {page === 'calendar' && <div className="page-stack calendar-page"><div className="page-title"><div><h1>Calendar</h1><p>Browse each day’s quality, deep work, and notes.</p></div><ManualEntry data={data} mutate={mutate} initialDay={selectedDay} /></div><div className="calendar-page-layout bento-grid"><CalendarView mode="interactive" data={data} now={now} month={month} selectedDay={selectedDay} onMonth={nextMonth => { setMonth(nextMonth); setSelectedDay(nextMonth); }} onSelect={setSelectedDay} mutate={mutate} /><DayDetails data={data} day={selectedDay} now={now} mutate={mutate} /></div><SessionHistory data={data} mutate={mutate} day={selectedDay} title="Sessions" /></div>}
      {page === 'hours' && <WorkHoursView data={data} now={now} mutate={mutate} />}
      {page === 'profile' && <ProfileView data={data} now={now} mutate={mutate} replace={replace} />}
      </motion.div>
    </main>
    <FloatingDock items={nav} active={page} onNavigate={navigate} />
    {data.pendingReviewId && <SessionReview key={data.pendingReviewId} data={data} mutate={mutate} />}
    {!data.pendingReviewId && !usernamePromptDismissed && !data.profile.username && !data.onboarding.usernamePromptCompleted && <UsernamePrompt mutate={mutate} onDone={warning => { setUsernamePromptDismissed(true); setUsernamePromptWarning(warning ?? ''); }} />}
  </div></SoundProvider>;
}
