import type { Finding, StoryValidator } from '../types';
import { excerptAround, finding, stripNikud } from '../utils';

/**
 * v0.4.5 — BLOCKING: meta-text leaked into story prose.
 *
 * v0.3.6 caught "סיים בשינה רכה" — a single planning suggestion the model
 * literally pasted into the page text.
 *
 * v0.4.5 expands this to a Repair Leakage Firewall. The editorial repair
 * LLM in recent batches has been producing pages that include:
 *   - "פשטי: 'נועה סגרה את היד...'"      (imperative-feminine + quoted content)
 *   - "וכתיבה פשוטה יותר: 'בּוֹלִי...'"   (meta phrasing + quoted content)
 *   - "עמוד 11: 'בתוך התרמיל...'"         (page label leaked into prose)
 *
 * None of these patterns can ever be legitimate Hebrew children's prose.
 * They are all artifacts of the LLM treating its instructions as content.
 *
 * Detection: closed list of exact-match phrases + structural patterns
 *   (label N:, meta-verb + colon).
 */

/** Exact-match phrases that NEVER appear in legitimate children's prose. */
const META_PHRASES = [
  // v0.3.6 originals
  'סיים ב', 'סיימי ב', 'סיים את', 'תסיים ב',
  'כתוב ב', 'כתוב את', 'תכתוב ב', 'תכתבי ב',
  'הוסף ב', 'הוסף את', 'תוסיף ב',
  'הסר את', 'תסיר את',
  'אל תכתוב', 'אל תוסיף', 'אל תכלול', 'אל תסיים',
  'צריך להיות', 'חייב להיות',
  'ודא ש', 'ודאי ש', 'תוודא ש',
  'לא בבוקר/התעוררות', 'לא בבוקר / התעוררות',
  'הערה:', 'הערה למודל', 'הנחיה:',

  // v0.4.5 — repair-LLM leakage observed in batches
  'פשטי:', 'פשט:', 'פשטו:', 'תפשטי:', 'תפשט:',
  'כתיבה פשוטה יותר',
  'גרסה פשוטה:', 'גרסה קצרה:',
  'נוסח פשוט:', 'נוסח קצר:', 'נוסח מקוצר:',
  'אפשר לכתוב:', 'אפשר גם:',
  'עדיף:', 'מוטב:',
  'החלף:', 'תחליף:', 'להחליף:',
  'תקן:', 'תקני:', 'לתקן:',
  'שכתב:', 'לשכתב:',
  // English meta-words the model sometimes drops into Hebrew prose
  'suggestion:', 'rewrite:', 'replace:', 'simplify:', 'better:',
  'note:', 'hint:', 'quote:',
];

/** Structural regex patterns. */
const META_PATTERNS: Array<{ re: RegExp; label: string }> = [
  // "עמוד 11:" or "Page 11:" — page label leaked into prose
  { re: /\bעמוד\s+\d+\s*:/, label: 'עמוד N:' },
  { re: /\bPage\s+\d+\s*:/i, label: 'Page N:' },
];

/** Hebrew narration verbs that LEGITIMATELY take a colon (dialogue verbs). */
const DIALOGUE_VERB_COLON = /\b(אמרה?|אמרו|לחשה?|לחשו|שאלה?|שאלו|ענתה?|ענו|קראה?|קראו|חשבה?|הסבירה?|המשיכה?|הוסיפה?)\s*:/;

export const instructionLeakageValidator: StoryValidator = {
  id: 'instructionLeakage',
  run({ parsed }) {
    const findings: Finding[] = [];

    for (const page of parsed.pages) {
      const naked = stripNikud(page.text);

      // Layer 1: exact-match meta phrases
      let matched: { pattern: string; idx: number } | null = null;
      for (const phrase of META_PHRASES) {
        const idx = naked.indexOf(phrase);
        if (idx !== -1) {
          matched = { pattern: phrase, idx };
          break;
        }
      }

      // Layer 2: structural patterns (page label leaks)
      if (!matched) {
        for (const { re, label } of META_PATTERNS) {
          const m = re.exec(naked);
          if (m) {
            matched = { pattern: label, idx: m.index };
            break;
          }
        }
      }

      // Layer 3: meta-verb + colon + quoted content within ~20 chars.
      // This catches "פשטי: 'נועה...'" or "סוגג'סטיון: '...'" forms.
      // We allow dialogue verbs (אמרה: "...") by exclusion.
      if (!matched) {
        // Look for "<hebrew-word><whitespace>:<whitespace>['""]" patterns
        const colonQuoteRe = /([א-ת]{2,12})\s*:\s*['"״׳]/g;
        let cm: RegExpExecArray | null;
        while ((cm = colonQuoteRe.exec(naked)) !== null) {
          const verb = cm[1];
          const fullMatch = naked.slice(Math.max(0, cm.index), cm.index + 20);
          if (DIALOGUE_VERB_COLON.test(fullMatch)) continue; // dialogue OK
          matched = { pattern: `${verb}: '…'`, idx: cm.index };
          break;
        }
      }

      if (matched) {
        findings.push(
          finding(
            'instructionLeakage',
            'BLOCKING',
            `דליפת מטא-טקסט לפרוזה בעמוד ${page.pageNumber}: הביטוי "${matched.pattern}" הוא הוראה/label, לא טקסט סיפורי.`,
            {
              page: page.pageNumber,
              excerpt: excerptAround(naked, matched.idx, 50),
              suggestion: 'החלף את העמוד בטקסט עברי-סיפורי בלבד. אסור labels, suggestions, או הוראות מטא בתוך הפרוזה.',
            }
          )
        );
      }
    }

    return findings;
  },
};
