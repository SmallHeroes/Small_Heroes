/**
 * FAIL if child is given companion body parts without game/imaginary framing.
 * Scans prose and imageDirection (illustration prompts).
 */

import { pageProseOnly, parseStoryPages } from '../story-gen/story-page-utils';

export interface CompanionBodyPartHit {
  code: 'child_companion_body_part';
  message: string;
  line: string;
  page?: number;
  field?: 'prose' | 'imageDirection';
}

const GAME_FRAME_RE = /כאילו|במשחק|דמיוני|דמוי|כמו אוזן במשחק|הדמיוניות|like ears|ear-statue|hands.*ears/i;

const BUNNY_IN_LINE = /בוּנִי|בוני|bunny/i;
const CHILD_FEM_EAR =
  /(?:{{childName}}|היא)[^.\n]{0,40}אוזנ(?:יים|יה)\s+שלה|שלה[^.\n]{0,20}אוזנ|מנענעת[^.\n]{0,20}אוזן(?![^.\n]{0,40}כאילו)|מזיזה[^.\n]{0,20}אוזן(?![^.\n]{0,40}כמו)/i;

const CHILD_EAR_IMAGE_DIRECTION_RE =
  /child(?:'s|’s)?\s+ears?|ears?\s+(?:stretched|trembling|mid|tilted|wiggling)|wiggling\s+ears(?!\s+deliberately,\s+bunny)/i;

function scanLineForEarLeak(
  line: string,
  opts: { page?: number; field: 'prose' | 'imageDirection' }
): CompanionBodyPartHit | null {
  if (!line.trim()) return null;
  if (GAME_FRAME_RE.test(line)) return null;
  if (BUNNY_IN_LINE.test(line)) return null;
  if (/אוזניים הדמיוניות|פסל אוזניים|משחק אוזניים|bunny ears/i.test(line)) return null;
  if (/שחק[^.\n]{0,50}אוזנ|אוזנ[^.\n]{0,30}מי שזז מפסיד/.test(line)) return null;

  const proseHit = opts.field === 'prose' && CHILD_FEM_EAR.test(line);
  const imageHit = opts.field === 'imageDirection' && CHILD_EAR_IMAGE_DIRECTION_RE.test(line);
  if (!proseHit && !imageHit) return null;

  return {
    code: 'child_companion_body_part',
    message:
      opts.field === 'imageDirection'
        ? 'imageDirection implies child has companion ears'
        : 'Child given companion ears without game/imaginary frame',
    line: line.slice(0, 100),
    page: opts.page,
    field: opts.field,
  };
}

export function scanChildCompanionBodyPartLeak(
  markdown: string,
  companionBodyPart: 'ears' | 'shell' | 'tail' = 'ears'
): CompanionBodyPartHit[] {
  const hits: CompanionBodyPartHit[] = [];

  if (companionBodyPart !== 'ears') {
    return hits;
  }

  for (const { page, body } of parseStoryPages(markdown)) {
    const prose = pageProseOnly(body);
    for (const rawLine of prose.split(/\r?\n/)) {
      const hit = scanLineForEarLeak(rawLine.trim(), { page, field: 'prose' });
      if (hit) hits.push(hit);
    }

    const imgMatch = body.match(/imageDirection:\s*(.+)/i);
    if (imgMatch?.[1]) {
      const hit = scanLineForEarLeak(imgMatch[1].trim(), { page, field: 'imageDirection' });
      if (hit) hits.push(hit);
    }
  }

  return hits;
}
