import { describe, expect, it } from 'vitest';
import {
  classifyLexicalHit,
  classifyLexicalHits,
  summarizeLexicalFindings,
} from '../story-gen/hebrew-lexical-classify';
import { runDeterministicLexicalBackstop } from '../story-gen/hebrew-lexical-backstop';

const B2_SNIPPETS = `---
companionId: bolly_armadillo
---
--- Page 2 ---
{{childName}} {מִצְטָמֵצ|מִצְטָמֶצֶת}, הָאֶצְבָּעוֹת מְחַזִּיקוֹת.
מִן הַתִּיק נִשְׁמָע קְלִיק — בּוֹלִי מְרַעְדֵּד, הָאַף מַצְצִיץ.

--- Page 3 ---
וְהַמַּקֵּל נוֹחַ כְּמוֹ נָח בֵּין גְּלִידוֹת.
בּוֹלִי מַצְמִיץ אֹף קָטָן.

--- Page 4 ---
הָאֲצְבָּעוֹת מְשַׂחֲקוֹת בַּרִיצְ'רוּץ הָרִיצְ'רוּץ שֶׁל הָרִיצְ'רָץ.

--- Page 6 ---
הַפִּיוֹת נִפְתָּחִים כְּמוֹ פִּתְחוֹנֵי קָפִיץ.

--- Page 8 ---
בּוֹלִי מְגַלְגֵּל קִצְקָשׁ.

--- Page 10 ---
בְּתוֹךְ הַחוֹלֵשׁ נִפְתַּח מָקוֹם.
בּוֹלִי מִצְטָץ.

WORD_COUNT: [1,1,1,1,1,1] = 6`;

const S6_DISPUTED = `---
companionId: baby_elephant
---
--- Page 8 ---
טוּבִּי מַהְנֵה באיטיות ואומר בקול כמעט־שֵׁן:
״חצי אוזן. קול אחד.״

WORD_COUNT: [5] = 5`;

const S6_FIXED = `---
companionId: baby_elephant
---
--- Page 8 ---
טוּבִּי מהנהן באיטיות ואומר בקול כמעט ישן:
״חצי אוזן. קול אחד.״

WORD_COUNT: [5] = 5`;

const S4_SOUND = `---
companionId: baby_elephant
---
--- Page 2 ---
טוּבִּי מכריז. הבטן שלו רְרוּם. פּוּף קטן.

WORD_COUNT: [6] = 6`;

describe('runDeterministicLexicalBackstop + severity', () => {
  it('classifies B2 known defects as BLOCKER or REVIEW, never ALLOW', () => {
    const raw = runDeterministicLexicalBackstop(B2_SNIPPETS);
    const findings = classifyLexicalHits(raw, B2_SNIPPETS);
    const { blockers, reviews, allows } = summarizeLexicalFindings(findings);

    expect(
      allows.every((a) => a.domain === 'allowed_sound_word' || a.domain === 'companion_name')
    ).toBe(true);
    expect(blockers.length + reviews.length).toBeGreaterThanOrEqual(6);

    const blob = [...blockers, ...reviews].map((f) => f.original + f.issue).join(' ');
    expect(blob).toMatch(/מצטמ|מתכווץ/);
    expect(blob).toMatch(/מציץ|מצציץ|מצמיץ|מצטץ/);
    expect(blob).toMatch(/חולש|חוֹלֵשׁ/);
    expect(blob).toMatch(/גלידות|nach|simile/i);
    expect(blob).toMatch(/פתחונ|קפיץ|jarring|metaphor/i);
    expect(blob).toMatch(/tongue-twister|ריצ|רוכס|zipper/i);
  });

  it('flags S6 disputed forms as non-ALLOW before fix', () => {
    const raw = runDeterministicLexicalBackstop(S6_DISPUTED);
    const findings = classifyLexicalHits(raw, S6_DISPUTED);
    const { blockers, reviews, allows } = summarizeLexicalFindings(findings);
    expect(allows.filter((a) => /מהנה|כמעט/.test(a.original))).toHaveLength(0);
    expect(blockers.length + reviews.length).toBeGreaterThanOrEqual(2);
    expect(blockers.some((b) => /מהנה/.test(b.original) || b.issue.includes('מהנה'))).toBe(
      true
    );
  });

  it('S6 fixed p8 has zero BLOCKERs (deterministic)', () => {
    const raw = runDeterministicLexicalBackstop(S6_FIXED);
    const findings = classifyLexicalHits(raw, S6_FIXED);
    const { blockers } = summarizeLexicalFindings(findings);
    expect(blockers).toHaveLength(0);
  });

  it('allows companion names and sound-words on S4', () => {
    const raw = runDeterministicLexicalBackstop(S4_SOUND);
    const findings = classifyLexicalHits(raw, S4_SOUND);
    const { blockers } = summarizeLexicalFindings(findings);
    expect(blockers).toHaveLength(0);

    const ctx = classifyLexicalHits([], S4_SOUND);
    void ctx;
    const tubi = classifyLexicalHit(
      {
        page: 2,
        original: 'טוּבִּי',
        issue: 'name check',
        suggestedMinimalFix: '',
        source: 'llm',
      },
      { companionId: 'baby_elephant', companionNames: ['טוּבִּי', 'טובי'], soundWords: [] }
    );
    expect(tubi.severity).toBe('ALLOW');
    expect(tubi.domain).toBe('companion_name');

    const poof = classifyLexicalHit(
      {
        page: 2,
        original: 'פּוּף',
        issue: 'sound check',
        suggestedMinimalFix: '',
        source: 'llm',
      },
      {
        companionId: 'baby_elephant',
        companionNames: ['טוּבִּי'],
        soundWords: ['פּוּף', 'פוף'],
      }
    );
    expect(poof.severity).toBe('ALLOW');
    expect(poof.domain).toBe('allowed_sound_word');
  });
});
