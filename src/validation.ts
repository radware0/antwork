import { z } from 'zod';
import { dateKey, localDate } from './domain.ts';
import type { AppData, TimerPanelPreferences, WorkSession } from './types.ts';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => v >= '1970-01-01' && v <= '2100-12-31' && dateKey(localDate(v)) === v, 'Invalid date');
const id = z.string().min(1);
const time = z.number().finite().min(0).max(4133980800000);
const interval = z.object({ start: time, end: time }).refine(v => v.end > v.start, 'Invalid interval');
const timerInterval = z.object({ start: time, end: time }).refine(v => v.end >= v.start);
const campaign = z.object({ id, title: z.string().min(1), note: z.string(), createdAt: time, completedAt: time.nullable() });
const quest = z.object({ id, title: z.string().min(1), campaignId: id.nullable(), stake: z.union([z.literal(5), z.literal(10), z.literal(20)]), recurrence: z.enum(['none', 'daily', 'weekly']), startDate: day, endDate: day.nullable(), active: z.boolean() });
const occurrence = z.object({ id, questId: id, dueDate: day, completedAt: time.nullable() });
const session = z.object({ id, intervals: z.array(interval).min(1), source: z.enum(['manual', 'timer']), questOccurrenceId: id.nullable(), note: z.string() });
const timer = z.object({ id, mode: z.enum(['stopwatch', 'countdown']), durationMs: z.number().positive().max(43200000).nullable(), accumulatedMs: z.number().nonnegative(), intervals: z.array(timerInterval), runningSince: time.nullable(), questOccurrenceId: id.nullable() })
  .refine(v => v.mode === 'countdown' ? v.durationMs !== null : v.durationMs === null);
const image = z.string().max(2_800_000).regex(/^data:image\/webp;base64,[A-Za-z0-9+/]+={0,2}$/).refine(value => {
  try {
    const header = atob(value.slice('data:image/webp;base64,'.length, 'data:image/webp;base64,'.length + 16));
    return header.slice(0, 4) === 'RIFF' && header.slice(8, 12) === 'WEBP';
  } catch { return false; }
}, 'Invalid WebP image.').nullable();
const linkUrl = z.string().trim().max(2048).refine(value => {
  try { return ['http:', 'https:'].includes(new URL(value).protocol); } catch { return false; }
}, 'Use an HTTP or HTTPS URL.');
const profileV2 = z.object({
  name: z.string().trim().max(40), bio: z.string().max(280), avatar: image, banner: image,
  links: z.array(z.object({ label: z.string().trim().min(1).max(40), url: linkUrl })).max(5),
  currentCampaignId: id.nullable(),
});
const profileV3 = profileV2.omit({ currentCampaignId: true });
const legacyShape = {
  setupDate: day, setupComplete: z.boolean(),
  weeklyTargets: z.array(z.number().min(0).max(24)).length(7),
  dailyTargets: z.record(day, z.number().min(0).max(24)),
  theme: z.enum(['system', 'white', 'black', 'slate']),
  campaigns: z.array(campaign), quests: z.array(quest), occurrences: z.array(occurrence),
  sessions: z.array(session), journals: z.array(z.object({ date: day, text: z.string(), updatedAt: time })),
  timer: timer.nullable(), pendingReviewId: id.nullable(),
};
const legacySchema = z.object({ schemaVersion: z.literal(1), ...legacyShape });
const v2Schema = z.object({ schemaVersion: z.literal(2), ...legacyShape, profile: profileV2 });
const v3Session = session.extend({ campaignId: id.nullable().optional(), result: z.enum(['strong', 'steady', 'rough']).nullable().optional() });
const v3Timer = timer.extend({ campaignId: id.nullable().optional() });
const v3Schema = z.object({ schemaVersion: z.literal(3), ...legacyShape, profile: profileV3, sessions: z.array(v3Session), timer: v3Timer.nullable() });
const username = z.string().transform(value => value.trim().replace(/^@/, '').toLowerCase())
  .refine(value => value === '' || /^[a-z0-9_]{3,24}$/.test(value), 'Username needs 3–24 letters, digits, or underscores.');
const soundPreferences = z.object({ interfaceSounds: z.boolean(), timerAlarm: z.boolean() });
const defaultTimerPanel: TimerPanelPreferences = { image: null, imageOpacity: 30, imageBlur: 0, preferredWidth: 640, preferredHeight: null };
const timerPanel = z.object({
  image: image.default(null),
  imageOpacity: z.number().min(0).max(100).default(30),
  imageBlur: z.number().min(0).max(24).default(0),
  preferredWidth: z.number().int().min(420).max(1280).default(640),
  preferredHeight: z.number().int().min(400).max(760).nullable().default(null),
}).default(defaultTimerPanel);
const onboarding = z.object({ usernamePromptCompleted: z.boolean().default(false) }).default({ usernamePromptCompleted: false });
const v4Session = v3Session.extend({
  timing: z.enum(['intervals', 'duration']).default('intervals'),
  intervals: z.array(interval),
  date: day.optional(),
  durationMinutes: z.number().int().min(1).max(1440).optional(),
}).refine(value => value.timing === 'duration'
  ? value.source === 'manual' && value.intervals.length === 0 && value.date !== undefined && value.durationMinutes !== undefined
  : value.intervals.length > 0 && value.date === undefined && value.durationMinutes === undefined, 'Invalid session timing.');
const v4Schema = z.object({ schemaVersion: z.literal(4), ...legacyShape,
  profile: profileV3.extend({ username: username.default('') }), sessions: z.array(v4Session), timer: v3Timer.nullable(),
  preferences: soundPreferences.default({ interfaceSounds: false, timerAlarm: false }) });
const v5Schema = z.object({ schemaVersion: z.literal(5), ...legacyShape,
  profile: profileV3.extend({ username: username.default('') }), sessions: z.array(v4Session), timer: v3Timer.nullable(),
  preferences: soundPreferences.default({ interfaceSounds: false, timerAlarm: false }),
  timerPanel, onboarding });

const emptyProfile = { name: '', bio: '', avatar: null, banner: null, links: [] } as const;

function legacyCampaignId(record: { questOccurrenceId: string | null }, occurrences: AppData['occurrences'], quests: AppData['quests']): string | null {
  const linkedOccurrence = occurrences.find(item => item.id === record.questOccurrenceId);
  const linkedQuest = quests.find(item => item.id === linkedOccurrence?.questId);
  return linkedQuest?.campaignId ?? null;
}

function invalidBackup(result: { success: false; error: z.ZodError }): never {
  const issue = result.error.issues[0];
  throw new Error('Invalid backup: ' + issue.path.join('.') + ' — ' + issue.message);
}

export function parseBackup(value: unknown): AppData {
  const version = value && typeof value === 'object' ? (value as { schemaVersion?: unknown }).schemaVersion : null;
  const result = version === 1 ? legacySchema.safeParse(value)
    : version === 2 ? v2Schema.safeParse(value)
      : version === 3 ? v3Schema.safeParse(value) : version === 4 ? v4Schema.safeParse(value) : version === 5 ? v5Schema.safeParse(value) : null;
  if (!result) throw new Error('Invalid backup: unsupported schema version.');
  if (!result.success) invalidBackup(result);

  const raw = result.data as any;
  const oldProfile: any = version === 1 ? emptyProfile : raw.profile;
  const { currentCampaignId: _unusedCurrentCampaign, ...profile } = oldProfile;
  const sessions: WorkSession[] = raw.sessions.map((item: any) => ({
    ...item,
    timing: item.timing ?? 'intervals',
    campaignId: Number(version) >= 3 && item.campaignId !== undefined ? item.campaignId : legacyCampaignId(item, raw.occurrences, raw.quests),
    result: item.result ?? null,
  }));
  const timerData = raw.timer ? {
    ...raw.timer,
    campaignId: Number(version) >= 3 && raw.timer.campaignId !== undefined ? raw.timer.campaignId : legacyCampaignId(raw.timer, raw.occurrences, raw.quests),
  } : null;
  const migratedOnboarding = version === 5 ? raw.onboarding : { usernamePromptCompleted: Boolean(profile.username) };
  const data = {
    ...raw, schemaVersion: 5, setupComplete: true, theme: raw.theme === 'white' ? 'white' : 'black',
    preferences: raw.preferences ?? { interfaceSounds: false, timerAlarm: false },
    timerPanel: raw.timerPanel ?? defaultTimerPanel,
    onboarding: { ...migratedOnboarding, usernamePromptCompleted: Boolean(migratedOnboarding?.usernamePromptCompleted || profile.username) },
    profile: { ...profile, username: profile.username ?? '' }, sessions, timer: timerData,
  } as AppData;

  for (const records of [data.campaigns, data.quests, data.occurrences, data.sessions]) {
    if (new Set(records.map(record => record.id)).size !== records.length) throw new Error('Backup contains duplicate record IDs.');
  }
  const campaigns = new Set(data.campaigns.map(item => item.id));
  const quests = new Set(data.quests.map(item => item.id));
  const occurrences = new Set(data.occurrences.map(item => item.id));
  const linkedSessions = [...data.sessions, ...(data.timer ? [data.timer] : [])];
  if (
    data.quests.some(item => item.campaignId !== null && !campaigns.has(item.campaignId)) ||
    data.occurrences.some(item => !quests.has(item.questId)) ||
    linkedSessions.some(item => item.questOccurrenceId !== null && !occurrences.has(item.questOccurrenceId)) ||
    linkedSessions.some(item => item.campaignId != null && !campaigns.has(item.campaignId)) ||
    (data.pendingReviewId !== null && !data.sessions.some(item => item.id === data.pendingReviewId))
  ) throw new Error('Backup contains broken record links.');
  if (data.timer && (data.sessions.some(item => item.id === data.timer!.id) || Math.abs(data.timer.accumulatedMs - data.timer.intervals.reduce((sum, item) => sum + item.end - item.start, 0)) > 1)) {
    throw new Error('Backup contains inconsistent timer history.');
  }
  return data;
}
