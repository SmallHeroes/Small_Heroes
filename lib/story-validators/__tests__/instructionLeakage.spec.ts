/**
 * v0.4.5 — Repair Leakage Firewall fixtures.
 *
 * Every fixture below is real text observed in batch outputs OR a structural
 * pattern that should never appear in legitimate Hebrew children's prose.
 * The validator must produce a BLOCKING finding for each.
 */
import { describe, it, expect } from 'vitest';
import { instructionLeakageValidator } from '../validators/instructionLeakage';
import type { ValidatorContext } from '../types';

function ctx(pageText: string): ValidatorContext {
  return {
    parsed: {
      frontmatter: {},
      pages: [{ pageNumber: 1, imageDirection: 'irrelevant', text: pageText }],
    },
    input: {
      storyMarkdown: '',
      mode: 'production',
      context: {
        companionId: 'bolly_armadillo',
        direction: 'bedtime',
        pageCount: 10,
        childName: 'נועה',
        childGender: 'girl',
        childAge: 5,
        declared: { moment: { page: 6 }, hook: { appearsOnPages: [] } },
      },
    },
  };
}

function fires(text: string): boolean {
  const findings = instructionLeakageValidator.run(ctx(text));
  return findings.some((f) => f.severity === 'BLOCKING');
}

describe('instructionLeakage — Repair Leakage Firewall (v0.4.5)', () => {
  // ============ Legitimate prose must NOT fire ============
  it('does NOT fire on clean Hebrew narrative', () => {
    expect(fires('נועה שכבה במיטה. בּוֹלִי נסגר לכדור. בפנים היה חם.')).toBe(false);
  });

  it('allows dialogue verbs with colon (אמרה: "...")', () => {
    expect(fires('אמא אמרה: "מחר בבוקר יש בדיקה." נועה הסתכלה.')).toBe(false);
  });

  it('allows nested quoted speech', () => {
    expect(fires('הרופאה לחשה: "נבדוק רק רגע." נועה הנהנה.')).toBe(false);
  });

  // ============ v0.3.6 originals ============
  it('catches "סיים בשינה רכה" (v0.3.6 case)', () => {
    expect(fires('סיים בשינה רכה, לא בבוקר/התעוררות')).toBe(true);
  });

  // ============ v0.4.5 — meta-imperatives ============
  it('catches "פשטי:" followed by quoted content', () => {
    expect(fires(`פשטי: 'נועה סגרה את היד, זכרה את טוּמְפּ של בולי.'`)).toBe(true);
  });

  it('catches "וכתיבה פשוטה יותר:"', () => {
    expect(
      fires('בולי התכווץ לרגע, וכתיבה פשוטה יותר: "בּוֹלִי היה חמים."')
    ).toBe(true);
  });

  it('catches "נוסח פשוט:"', () => {
    expect(fires(`נוסח פשוט: "המדחום על המדף."`)).toBe(true);
  });

  it('catches "החלף:"', () => {
    expect(fires(`החלף: "נועה הסתכלה." → "נועה הביטה."`)).toBe(true);
  });

  it('catches "תקן:"', () => {
    expect(fires(`תקן: "המשפט הקודם."`)).toBe(true);
  });

  it('catches "שכתב:"', () => {
    expect(fires(`שכתב: "עמוד 5 בלי הציטוט."`)).toBe(true);
  });

  // ============ v0.4.5 — structural: page labels ============
  it('catches "עמוד 11:" page label leaked into prose', () => {
    expect(
      fires(`עמוד 11: 'בתוך התרמיל חיכתה המדבקה.' נועה צחקה.`)
    ).toBe(true);
  });

  it('catches "Page 11:" English variant', () => {
    expect(fires('Page 11: continuation goes here.')).toBe(true);
  });

  it('catches "עמוד 1:" with single-digit', () => {
    expect(fires(`עמוד 1: "נועה במיטה."`)).toBe(true);
  });

  // ============ v0.4.5 — English meta-words ============
  it('catches "suggestion:" leaked', () => {
    expect(fires(`suggestion: "נועה הסתכלה במדחום."`)).toBe(true);
  });

  it('catches "rewrite:" leaked', () => {
    expect(fires('rewrite: "המשפט החדש."')).toBe(true);
  });

  // ============ v0.4.5 — structural: meta-verb + colon + quote ============
  it('catches unknown meta-verb followed by colon and quote', () => {
    expect(fires(`לערוך: "המשפט הזה צריך תיקון."`)).toBe(true);
  });

  it('does NOT fire on legitimate two-word Hebrew followed by colon-less text', () => {
    // No colon → safe
    expect(fires('נועה הביטה החוצה והבחינה במדחום.')).toBe(false);
  });
});
