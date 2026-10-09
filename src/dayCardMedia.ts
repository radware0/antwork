import { normalizeTimerBackground } from './profileMedia.ts';
import type { AppData, DateKey, DayCardBackground, DayCardPreferences } from './types.ts';

export const MAX_DAY_VIDEO_BYTES = 5 * 1024 * 1024;
export const MAX_DAY_VIDEO_SECONDS = 30;

export function dayCardBackgroundForDate(data: AppData, day: DateKey): DayCardBackground | null {
  const { backgrounds, selectedIndex } = data.dayCardPreferences;
  return selectedIndex === null ? data.dayCardBackgrounds[day] ?? null : backgrounds[selectedIndex];
}

export function removeDayCardBackground(preferences: DayCardPreferences, index: 0 | 1): DayCardPreferences {
  const backgrounds: DayCardPreferences['backgrounds'] = [...preferences.backgrounds];
  backgrounds[index] = null;
  const other = index === 0 ? 1 : 0;
  return { backgrounds, selectedIndex: preferences.selectedIndex === index ? (backgrounds[other] ? other : null) : preferences.selectedIndex };
}

export function assertDayVideoFile(file: Pick<File, 'type' | 'size'>) {
  if (!['video/mp4', 'video/webm'].includes(file.type)) throw new Error('Choose an MP4 or WebM video.');
  if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_DAY_VIDEO_BYTES) throw new Error('Choose a video up to 5 MiB with visible content.');
}

export function assertDayVideoDuration(duration: number) {
  if (!Number.isFinite(duration) || duration <= 0 || duration > MAX_DAY_VIDEO_SECONDS) throw new Error('Choose a video up to 30 seconds.');
}

export function validDayVideoData(value: string): boolean {
  const match = /^data:video\/(mp4|webm);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) return false;
  const encoded = match[2];
  const bytes = encoded.length / 4 * 3 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
  if (encoded.length % 4 !== 0 || bytes <= 0 || bytes > MAX_DAY_VIDEO_BYTES) return false;
  try {
    const header = atob(encoded.slice(0, 24));
    return match[1] === 'mp4' ? bytes >= 12 && header.slice(4, 8) === 'ftyp'
      : bytes >= 4 && header.startsWith('\x1a\x45\xdf\xa3');
  } catch { return false; }
}

export function dayVideoBlob(data: string): Blob {
  if (!validDayVideoData(data)) throw new Error('This video background is invalid.');
  const [header, encoded] = data.split(',');
  const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  return new Blob([bytes], { type: header.slice(5, header.indexOf(';')) });
}

async function inspectVideo(blob: Blob): Promise<number> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement('video');
  video.preload = 'auto'; video.muted = true; video.playsInline = true;
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const timeout = window.setTimeout(() => reject(new Error('This video could not be opened. Choose a shorter playable clip.')), 10000);
      video.onloadeddata = () => { clearTimeout(timeout); resolve(video.duration); };
      video.onerror = () => { clearTimeout(timeout); reject(new Error('This video could not be opened. Choose a playable MP4 or WebM.')); };
      video.src = url;
    });
    assertDayVideoDuration(duration);
    return duration;
  } finally {
    video.pause(); video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url);
  }
}

export async function validateDayCardPlayback(data: AppData): Promise<void> {
  for (const background of [...Object.values(data.dayCardBackgrounds), ...data.dayCardPreferences.backgrounds]) {
    if (!background) continue;
    if (background.kind === 'video') await inspectVideo(dayVideoBlob(background.data));
    else {
      const encoded = background.data.split(',')[1];
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      try { const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/webp' })); bitmap.close(); }
      catch { throw new Error('A day-card picture in this backup could not be opened. Your saved history is unchanged.'); }
    }
  }
}

export async function prepareDayCardBackground(file: File): Promise<DayCardBackground> {
  if (file.type.startsWith('image/')) return { kind: 'image', data: await normalizeTimerBackground(file) };
  assertDayVideoFile(file);
  const durationSeconds = await inspectVideo(file);
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('This video could not be read.'));
    reader.readAsDataURL(file);
  });
  if (!validDayVideoData(data)) throw new Error('This video file has an unsupported format.');
  return { kind: 'video', data, durationSeconds };
}
