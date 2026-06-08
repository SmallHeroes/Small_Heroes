import { describe, expect, it } from 'vitest';
import { runDeterministicLexicalBackstop } from '../story-gen/hebrew-lexical-backstop';

const B2_SNIPPETS = `--- Page 2 ---
{{childName}} {מִצְטָמֵצ|מִצְטָמֶצֶת}, הָאֶצְבָּעוֹת מְחַזִּיקוֹת בַּשּׂוּרָה.
מִן הַתִּיק נִשְׁמָע קְלִיק — בּוֹלִי מְרַעְדֵּד אֶת הַקְּלִפָּה, הָאַף מַצְצִיץ וְחוֹזֵר.

--- Page 3 ---
"עַכְשָׁיו תּוֹרְךָ," אוֹמֶרֶת הַמּוֹרָה, וְהַמַּקֵּל נוֹחַ כְּמוֹ נָח בֵּין גְּלִידוֹת.
בּוֹלִי מַצְמִיץ אֹף קָטָן מִתּוֹךְ הַכַּדּוּר.

--- Page 4 ---
הָאֲצְבָּעוֹת מְשַׂחֲקוֹת בַּרִיצְ'רוּץ הָרִיצְ'רוּץ שֶׁל הָרִיצְ'רָץ.

--- Page 6 ---
הַפִּיוֹת נִפְתָּחִים כְּמוֹ פִּתְחוֹנֵי קָפִיץ.

--- Page 10 ---
בְּתוֹךְ הַחוֹלֵשׁ נִפְתַּח מָקוֹם קָטָן.
בּוֹלִי נוֹף הָאַף מִצְטָץ.

WORD_COUNT: [1,1,1,1,1] = 5`;

const S6_CLEAN = `--- Page 1 ---
{{childName}} {שוכב|שוכבת} במיטה, {שומע|שומעת} את הלֵב {שלו|שלה}.
טוּבִּי מציץ, עיניים עגולות. פּוּף קטן.

WORD_COUNT: [8] = 8`;

describe('runDeterministicLexicalBackstop', () => {
  it('catches known B2 non-words and odd phrasings', () => {
    const hits = runDeterministicLexicalBackstop(B2_SNIPPETS);
    const issues = hits.map((h) => h.issue).join(' ');
    expect(issues).toMatch(/מצטמצ/);
    expect(issues).toMatch(/מציץ/);
    expect(issues).toMatch(/חולש/);
    expect(issues).toMatch(/ריצ'רוץ|tongue-twister/i);
    expect(issues).toMatch(/גלידות|nach/i);
    expect(issues).toMatch(/פתחוני קפיץ|jarring/i);
    expect(hits.filter((h) => h.page === 10).length).toBeGreaterThan(0);
  });

  it('does not flag clean S6 prose (deterministic layer)', () => {
    const hits = runDeterministicLexicalBackstop(S6_CLEAN);
    expect(hits).toHaveLength(0);
  });
});
