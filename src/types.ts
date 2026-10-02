export type DateKey = string;
export type Interval = { start: number; end: number };
export type Theme = 'white' | 'black';
export type Recurrence = 'none' | 'daily' | 'weekly';
export type Stake = 5 | 10 | 20;
export type SessionResult = 'strong' | 'steady' | 'rough';

export interface Campaign {
  id: string;
  title: string;
  note: string;
  createdAt: number;
  completedAt: number | null;
}

export interface Quest {
  id: string;
  title: string;
  campaignId: string | null;
  stake: Stake;
  recurrence: Recurrence;
  startDate: DateKey;
  endDate: DateKey | null;
  active: boolean;
}

export interface QuestOccurrence {
  id: string;
  questId: string;
  dueDate: DateKey;
  completedAt: number | null;
}

export interface WorkSession {
  timing?: 'intervals' | 'duration';
  date?: DateKey;
  durationMinutes?: number;
  id: string;
  intervals: Interval[];
  source: 'timer' | 'manual';
  questOccurrenceId: string | null;
  note: string;
  campaignId?: string | null;
  result?: SessionResult | null;
}

export interface ActiveTimer {
  id: string;
  mode: 'stopwatch' | 'countdown';
  durationMs: number | null;
  accumulatedMs: number;
  intervals: Interval[];
  runningSince: number | null;
  questOccurrenceId: string | null;
  campaignId?: string | null;
}

export interface DailyJournal {
  date: DateKey;
  text: string;
  updatedAt: number;
}

export interface ProfileLink { label: string; url: string }

export interface ProfileIdentity {
  username?: string;
  name: string;
  bio: string;
  avatar: string | null;
  banner: string | null;
  links: ProfileLink[];
}

export interface SoundPreferences {
  interfaceSounds: boolean;
  timerAlarm: boolean;
}

export interface AppData {
  schemaVersion: 4;
  setupDate: DateKey;
  setupComplete: boolean;
  weeklyTargets: number[];
  dailyTargets: Record<DateKey, number>;
  theme: Theme;
  preferences: SoundPreferences;
  profile: ProfileIdentity;
  campaigns: Campaign[];
  quests: Quest[];
  occurrences: QuestOccurrence[];
  sessions: WorkSession[];
  journals: DailyJournal[];
  timer: ActiveTimer | null;
  pendingReviewId: string | null;
}
