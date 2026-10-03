export type ProfileImageKind = 'avatar' | 'banner';

export interface ProfileCrop { zoom: number; x: number; y: number }
export interface PreparedProfileImage {
  bitmap: ImageBitmap;
  previewUrl: string;
  width: number;
  height: number;
  dispose(): void;
}

const outputSize = (kind: ProfileImageKind) => kind === 'avatar' ? { width: 512, height: 512 } : { width: 1600, height: 600 };
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

export function coverSourceRect(width: number, height: number, frameWidth: number, frameHeight: number) {
  const sourceRatio = width / height;
  const frameRatio = frameWidth / frameHeight;
  if (sourceRatio < frameRatio) {
    const cropHeight = width / frameRatio;
    return { x: 0, y: (height - cropHeight) / 2, width, height: cropHeight };
  }
  const cropWidth = height * frameRatio;
  return { x: (width - cropWidth) / 2, y: 0, width: cropWidth, height };
}

export function cropSourceRect(imageWidth: number, imageHeight: number, kind: ProfileImageKind, crop: ProfileCrop) {
  const output = outputSize(kind);
  const zoom = clamp(crop.zoom, 1, 3);
  const outputRatio = output.width / output.height;
  let width = imageWidth;
  let height = width / outputRatio;
  if (height > imageHeight) { height = imageHeight; width = height * outputRatio; }
  width /= zoom;
  height /= zoom;
  const maxX = Math.max(0, (imageWidth - width) / 2);
  const maxY = Math.max(0, (imageHeight - height) / 2);
  const centerX = imageWidth / 2 + clamp(crop.x, -1, 1) * maxX;
  const centerY = imageHeight / 2 + clamp(crop.y, -1, 1) * maxY;
  return {
    x: clamp(centerX - width / 2, 0, imageWidth - width),
    y: clamp(centerY - height / 2, 0, imageHeight - height),
    width,
    height,
  };
}

function validateProfileFile(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose an image under 10 MB.');
}

export function fitTimerImageDimensions(width: number, height: number, limit = 1600): { width: number; height: number } {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || limit < 1) {
    throw new Error('This image has no visible pixels.');
  }
  const scale = Math.min(1, limit / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export async function normalizeTimerBackground(file: File): Promise<string> {
  const source = await prepareProfileImage(file);
  try {
    const output = fitTimerImageDimensions(source.width, source.height);
    const canvas = document.createElement('canvas');
    canvas.width = output.width;
    canvas.height = output.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image editing is unavailable in this browser.');
    context.drawImage(source.bitmap, 0, 0, output.width, output.height);
    const result = canvas.toDataURL('image/webp', 0.85);
    if (!result.startsWith('data:image/webp;base64,') || result.length > 2_800_000) {
      throw new Error('The image is too large after processing. Choose a simpler image.');
    }
    return result;
  } finally { source.dispose(); }
}

export async function prepareProfileImage(file: File): Promise<PreparedProfileImage> {
  validateProfileFile(file);
  let bitmap: ImageBitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw new Error('This image could not be opened.'); }
  if (!bitmap.width || !bitmap.height) { bitmap.close(); throw new Error('This image has no visible pixels.'); }
  const previewUrl = URL.createObjectURL(file);
  let disposed = false;
  return {
    bitmap, previewUrl, width: bitmap.width, height: bitmap.height,
    dispose() {
      if (disposed) return;
      disposed = true;
      URL.revokeObjectURL(previewUrl);
      bitmap.close();
    },
  };
}

export function renderProfileCrop(source: PreparedProfileImage, kind: ProfileImageKind, crop: ProfileCrop): string {
  const output = outputSize(kind);
  const canvas = document.createElement('canvas');
  canvas.width = output.width;
  canvas.height = output.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image editing is unavailable in this browser.');
  const rect = cropSourceRect(source.width, source.height, kind, crop);
  context.drawImage(source.bitmap, rect.x, rect.y, rect.width, rect.height, 0, 0, output.width, output.height);
  const result = canvas.toDataURL('image/webp', 0.85);
  if (!result.startsWith('data:image/webp;base64,') || result.length > 2_800_000) throw new Error('The image is too large after processing. Choose a simpler image.');
  return result;
}

export async function normalizeProfileImage(file: File, kind: ProfileImageKind): Promise<string> {
  const source = await prepareProfileImage(file);
  try { return renderProfileCrop(source, kind, { zoom: 1, x: 0, y: 0 }); }
  finally { source.dispose(); }
}
