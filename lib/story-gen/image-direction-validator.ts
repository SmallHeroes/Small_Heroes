/**
 * imageDirection format checks — malformed labels pollute image prompts.
 *
 * Current policy: WARN only (advisory). Pre-image gate should call with blocking=true.
 */

import { parseStoryPages } from './story-page-utils';

export type ImageDirectionFormatReason =
  | 'stray_bold_marker'
  | 'label_has_bold'
  | 'split_label'
  | 'missing_wellformed_line';

export type ImageDirectionFormatHit = {
  page: number;
  reason: ImageDirectionFormatReason;
  snippet: string;
};

export type ImageDirectionFormatReport = {
  status: 'image_direction_format_v1';
  hits: ImageDirectionFormatHit[];
  malformedPages: number[];
  advisoryWarn: boolean;
  /** When true, callers should treat hits as hard failures (pre-image gate). */
  advisoryFail: boolean;
};

const WELL_FORMED_LINE = /^\s*imageDirection:\s*[^*\n][^\n]*$/im;

export function scanImageDirectionFormat(
  markdown: string,
  options?: { blocking?: boolean }
): ImageDirectionFormatReport {
  const blocking = options?.blocking ?? false;
  const hits: ImageDirectionFormatHit[] = [];

  for (const { page, body } of parseStoryPages(markdown)) {
    const lines = body.split(/\r?\n/);
    const strayBold = lines.some((line) => /^\s*\*\*\s*$/.test(line));
    const labelHasBold = /imageDirection\s*:\s*\*\*/i.test(body);
    const wellFormed = WELL_FORMED_LINE.test(body);
    const hasToken = /imageDirection/i.test(body);

    if (strayBold) {
      hits.push({ page, reason: 'stray_bold_marker', snippet: '**' });
    }
    if (labelHasBold) {
      const snippet =
        body.match(/imageDirection\s*:\s*\*\*[^\n]*/i)?.[0]?.trim() ?? 'imageDirection:**';
      hits.push({ page, reason: 'label_has_bold', snippet });
    }
    if (!wellFormed && hasToken && !labelHasBold && strayBold) {
      hits.push({
        page,
        reason: 'split_label',
        snippet: body.match(/imageDirection[\s\S]{0,80}/i)?.[0]?.trim() ?? 'imageDirection (split)',
      });
    } else if (!wellFormed && !hasToken) {
      hits.push({ page, reason: 'missing_wellformed_line', snippet: '(no imageDirection line)' });
    } else if (!wellFormed && hasToken && !strayBold && !labelHasBold) {
      hits.push({
        page,
        reason: 'missing_wellformed_line',
        snippet: body.match(/imageDirection[^\n]*/i)?.[0]?.trim() ?? 'imageDirection (malformed)',
      });
    }
  }

  const malformedPages = [...new Set(hits.map((h) => h.page))].sort((a, b) => a - b);
  const advisoryWarn = hits.length > 0;

  return {
    status: 'image_direction_format_v1',
    hits,
    malformedPages,
    advisoryWarn,
    advisoryFail: blocking && advisoryWarn,
  };
}
