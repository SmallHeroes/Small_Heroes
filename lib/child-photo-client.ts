/**
 * Client-side child photo compression + JSON response parsing (browser only).
 */

export const MAX_SOURCE_PHOTO_BYTES = 15 * 1024 * 1024;
export const MAX_CHILD_PHOTO_DATA_URL_CHARS = 3_200_000;
export const CHILD_PHOTO_MAX_DIMENSION = 1600;
export const CHILD_PHOTO_JPEG_QUALITIES = [0.86, 0.78, 0.68] as const;

export const CHILD_PHOTO_TOO_LARGE_HE =
  'התמונה גדולה מדי — נסה תמונה קטנה יותר';

export async function readJsonResponse<T>(
  res: Response,
  options?: { payloadTooLargeMessage?: string }
): Promise<T> {
  const payloadTooLargeMessage = options?.payloadTooLargeMessage ?? CHILD_PHOTO_TOO_LARGE_HE;
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) return {} as T;

  try {
    return JSON.parse(trimmed) as T;
  } catch {
    if (res.status === 413 || /^Request Entity Too Large/i.test(trimmed)) {
      throw new Error(payloadTooLargeMessage);
    }

    const plainText = trimmed
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 240);
    throw new Error(plainText || `Request failed (${res.status})`);
  }
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read photo file'));
    };
    image.src = objectUrl;
  });
}

export async function fileToChildPhotoDataUrl(file: File): Promise<string> {
  if (file.size > MAX_SOURCE_PHOTO_BYTES) {
    throw new Error('Child photo is too large. Use an image under 15 MB.');
  }

  const image = await loadImageFromFile(file);
  const naturalWidth = image.naturalWidth || image.width;
  const naturalHeight = image.naturalHeight || image.height;
  if (!naturalWidth || !naturalHeight) {
    throw new Error('Could not read photo dimensions');
  }

  const scale = Math.min(1, CHILD_PHOTO_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare photo for upload');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

  for (const quality of CHILD_PHOTO_JPEG_QUALITIES) {
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    if (dataUrl.length <= MAX_CHILD_PHOTO_DATA_URL_CHARS) return dataUrl;
  }

  throw new Error('Child photo is still too large after compression. Use a smaller image.');
}

/** Map compression errors to Hebrew for consumer wizard UI. */
export function childPhotoUploadErrorHe(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  if (/still too large after compression/i.test(msg) || /too large/i.test(msg)) {
    return CHILD_PHOTO_TOO_LARGE_HE;
  }
  if (/Could not read photo/i.test(msg)) {
    return 'לא הצלחנו לקרוא את הקובץ הזה. נסו תמונה אחרת.';
  }
  if (/Could not read photo dimensions/i.test(msg)) {
    return 'לא הצלחנו לקרוא את מידות התמונה. נסו תמונה אחרת.';
  }
  if (/Could not prepare photo/i.test(msg)) {
    return 'לא הצלחנו להכין את התמונה להעלאה. נסו תמונה אחרת.';
  }
  return msg || CHILD_PHOTO_TOO_LARGE_HE;
}
