/**
 * Generic story-markdown parser for the Visual Contract Compiler.
 *
 * Reads a story-bank `.md` (frontmatter + `--- Page N ---` blocks + per-page
 * `imageDirection:` lines) into a normalized `CompilerStoryInput`. Deterministic,
 * dependency-free (no YAML lib) — only the signals the compiler needs.
 */

export interface CompilerStoryPage {
  pageNumber: number;
  text: string;
  /** Raw free-text image direction for the page (may be empty). */
  imageDirection: string;
  /** Parsed from `companionPresence: present|absent` in the direction. */
  companionPresence: 'present' | 'absent' | null;
  /** Parsed from `view: ...` in the direction. */
  view: string | null;
}

export interface CompilerStoryFrontmatter {
  title: string | null;
  companionId: string | null;
  direction: string | null;
  category: string | null;
  timeOfDay: string | null;
  gender: string | null;
  pages: number | null;
  /** From `powerCard.visualMotifs` — the canonical critical-object motif list. */
  visualMotifs: string[];
  beats: {
    quietPagePosition: number | null;
    heartLine: string | null;
    emotionalMistake: string | null;
    uncomfortableTruth: string | null;
    agencyTransfer: string | null;
  };
}

export interface CompilerStoryInput {
  storyKey: string;
  frontmatter: CompilerStoryFrontmatter;
  pages: CompilerStoryPage[];
}

function matchLine(md: string, key: string): string | null {
  const re = new RegExp('^' + key + ':\\s*(.+?)\\s*$', 'm');
  const m = md.match(re);
  if (!m) return null;
  return m[1].replace(/^["']|["']$/g, '').trim() || null;
}

function matchNumber(md: string, key: string): number | null {
  const v = matchLine(md, key);
  if (v == null) return null;
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

/** Extract the `visualMotifs:` YAML list (quoted "- ..." items under the key). */
function parseVisualMotifs(md: string): string[] {
  const lines = md.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  let listIndent = -1;
  for (const line of lines) {
    if (/^\s*visualMotifs:\s*$/.test(line)) {
      inList = true;
      listIndent = (line.match(/^\s*/)?.[0].length ?? 0);
      continue;
    }
    if (!inList) continue;
    const itemMatch = line.match(/^(\s*)-\s+(.*\S)\s*$/);
    if (itemMatch && itemMatch[1].length > listIndent) {
      out.push(itemMatch[2].replace(/^["']|["']$/g, '').trim());
      continue;
    }
    // Any non-deeper-list line ends the block.
    if (line.trim() !== '') break;
  }
  return out;
}

export function parseStoryMarkdownForContract(
  rawMd: string,
  storyKey: string
): CompilerStoryInput {
  const frontmatter: CompilerStoryFrontmatter = {
    title: matchLine(rawMd, 'title'),
    companionId: matchLine(rawMd, 'companionId'),
    direction: matchLine(rawMd, 'direction'),
    category: matchLine(rawMd, 'category'),
    timeOfDay: matchLine(rawMd, 'timeOfDay'),
    gender: matchLine(rawMd, 'gender'),
    pages: matchNumber(rawMd, 'pages'),
    visualMotifs: parseVisualMotifs(rawMd),
    beats: {
      quietPagePosition: matchNumber(rawMd, 'quietPagePosition'),
      heartLine: matchLine(rawMd, 'heartLine'),
      emotionalMistake: matchLine(rawMd, 'emotionalMistake'),
      uncomfortableTruth: matchLine(rawMd, 'uncomfortableTruth'),
      agencyTransfer: matchLine(rawMd, 'agencyTransfer'),
    },
  };

  // Split into page blocks on `--- Page N ---`.
  const pages: CompilerStoryPage[] = [];
  const pageRe = /^---\s*Page\s+(\d+)\s*---\s*$/gim;
  const markers: { pageNumber: number; index: number; endOfMarker: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = pageRe.exec(rawMd)) !== null) {
    markers.push({
      pageNumber: Number.parseInt(m[1], 10),
      index: m.index,
      endOfMarker: m.index + m[0].length,
    });
  }
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].endOfMarker;
    const end = i + 1 < markers.length ? markers[i + 1].index : rawMd.length;
    const block = rawMd.slice(start, end);
    // Stop the last block at a trailing metadata line like `WORD_COUNT:`.
    const wordCountIdx = block.search(/^\s*WORD_COUNT\s*:/m);
    const body = wordCountIdx >= 0 ? block.slice(0, wordCountIdx) : block;

    const dirIdx = body.search(/^\s*imageDirection\s*:/im);
    const text = (dirIdx >= 0 ? body.slice(0, dirIdx) : body).trim();
    let imageDirection = '';
    if (dirIdx >= 0) {
      imageDirection = body
        .slice(dirIdx)
        .replace(/^\s*imageDirection\s*:/i, '')
        .trim();
    }
    const cp = imageDirection.match(/companionPresence:\s*(present|absent)/i);
    const vw = imageDirection.match(/view:\s*([^.;\n]+)/i);
    pages.push({
      pageNumber: markers[i].pageNumber,
      text,
      imageDirection,
      companionPresence: cp ? (cp[1].toLowerCase() as 'present' | 'absent') : null,
      view: vw ? vw[1].trim() : null,
    });
  }

  pages.sort((a, b) => a.pageNumber - b.pageNumber);
  return { storyKey, frontmatter, pages };
}
