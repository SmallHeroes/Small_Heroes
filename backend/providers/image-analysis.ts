import sharp from 'sharp';

/**
 * Analyze the luminance of a specific zone (top or bottom 35%) of an image.
 * Returns 'light' or 'dark' based on average brightness.
 *
 * - If the zone is bright -> text should be dark -> return 'dark'
 * - If the zone is dim -> text should be light -> return 'light'
 */
export async function analyzeTextZoneLuminance(
  imageUrl: string,
  textZone: 'top_clear' | 'bottom_clear' | string
): Promise<'light' | 'dark'> {
  try {
    const response = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`fetch_failed_${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());

    const metadata = await sharp(buffer).metadata();
    const width = metadata.width ?? 800;
    const height = metadata.height ?? 1200;

    const zoneHeight = Math.round(height * 0.35);
    const top = textZone === 'top_clear' ? 0 : Math.max(0, height - zoneHeight);

    const { data, info } = await sharp(buffer)
      .extract({ left: 0, top, width, height: zoneHeight })
      .resize(50, 50, { fit: 'fill' })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pixelCount = info.width * info.height;
    const channelCount = info.channels;

    let totalLuminance = 0;
    for (let i = 0; i < data.length; i += channelCount) {
      const r = data[i] ?? 0;
      const g = data[i + 1] ?? 0;
      const b = data[i + 2] ?? 0;
      totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    const avgLuminance = totalLuminance / Math.max(1, pixelCount);
    const scheme = avgLuminance < 128 ? 'light' : 'dark';

    console.log(
      `[text_color_analysis] zone=${textZone} avgLuminance=${avgLuminance.toFixed(1)} scheme=${scheme}`
    );
    return scheme;
  } catch (error) {
    console.warn(
      `[text_color_analysis_fallback] error=${error instanceof Error ? error.message : String(error)}`
    );
    return 'dark';
  }
}
