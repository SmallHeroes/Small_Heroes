export const QA_CONSOLE_MAX_PAGES = 12;
export const QA_REPRESENTATIVE_PAGES = [1, 2, 3, 4, 5, 8, 13, 15, 16, 20] as const;

const EST_IMAGE_USD_LOW = 0.011;
const EST_AUDIO_USD_PER_PAGE = 0.008;

export function estimateQaConsoleCostUsd(
  pageCount: number,
  quality: 'low' | 'medium',
  withAudio: boolean
): number {
  const imageRate = quality === 'medium' ? EST_IMAGE_USD_LOW * 2.5 : EST_IMAGE_USD_LOW;
  let total = pageCount * imageRate;
  if (withAudio) total += pageCount * EST_AUDIO_USD_PER_PAGE;
  return Math.round(total * 1000) / 1000;
}
