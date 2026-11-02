import { describe, it, expect } from 'vitest';
import { resolveSourceQuotes } from '../source-quote-resolution';
import { canonicalStagingRefs } from '../storyboard-claim-basis';

const texts = ['כריכה', 'מומו תפס אותה בחדק והניח אותה ישר בקצה המגרש.\nלפיל היה חדק!', 'הוא קפץ.  ואז נח.', 'הוא קפץ. ואז נח.'];
describe('source quote resolution (whitespace-only variants)', () => {
  it('resolves a quote joined by a space where the page breaks the line, without touching the input', () => {
    const draft = { moments: { frames: [{ requirements: [{ kind: 'show', subject: 'x', evidence: 'מומו תפס אותה בחדק והניח אותה ישר בקצה המגרש. לפיל היה חדק!' }] }] } };
    const before = JSON.stringify(draft), out = resolveSourceQuotes(draft, texts);
    expect(out.moments.frames[0].requirements[0].evidence).toBe('מומו תפס אותה בחדק והניח אותה ישר בקצה המגרש.\nלפיל היה חדק!');
    expect(JSON.stringify(draft)).toBe(before);
  });
  it('leaves exact quotes, non-quote fields, other-character differences and ambiguous spans unchanged', () => {
    const draft = { a: { evidence: 'לפיל היה חדק!' }, subject: 'מומו תפס אותה בחדק והניח אותה ישר בקצה המגרש. לפיל היה חדק!',
      b: { quote: 'לפיל היה חדק' + '.' }, c: { quote: 'הוא קפץ. ואז נח.' }, d: { storyEvidence: 'קפץ.\nואז' } };
    const out = resolveSourceQuotes(draft, texts);
    expect(out).toEqual(draft);
  });
  it('turns a NUL placeholder quote (raw or JSON-escaped) into null and leaves real quotes and other keys alone', () => {
    const out = resolveSourceQuotes({ grounding: [{ assertion: 'a', quote: '\\u0000' }, { assertion: 'b', quote: '\u0000' }, { assertion: 'c', quote: 'לפיל היה חדק!' }], note: '\\u0000' }, texts);
    expect(out).toEqual({ grounding: [{ assertion: 'a', quote: null }, { assertion: 'b', quote: null }, { assertion: 'c', quote: 'לפיל היה חדק!' }], note: '\\u0000' });
  });
  it('turns an empty or whitespace-only quote into null', () => {
    expect(resolveSourceQuotes({ grounding: [{ quote: '' }, { quote: ' \n' }], evidence: '' }, texts)).toEqual({ grounding: [{ quote: null }, { quote: null }], evidence: null });
  });
  it('canonicalizes only the exact p{n}:plan.<stageable field> staging alias', () => {
    const raw = { moments: { frames: [{ staging: [{ ref: 'p0:plan', reason: 'r' }] }, { staging: [{ ref: 'p1:plan.childGaze', reason: 'r' }, { ref: 'p1:requirement:0', reason: 'r' },
      { ref: 'p1:plan.background', reason: 'r' }] }] } };
    const before = JSON.stringify(raw), out = canonicalStagingRefs(raw);
    expect(out.moments.frames.map(f => f.staging.map(s => s.ref))).toEqual([['p0:plan'], ['p1:childGaze', 'p1:requirement:0', 'p1:plan.background']]);
    expect(JSON.stringify(raw)).toBe(before);
  });
  it('leaves overlapping distinct source spans ambiguous', () => {
    const draft = { quote: 'go\tgo' };
    expect(resolveSourceQuotes(draft, ['go go\ngo'])).toEqual(draft);
  });
  it('resolves every quote-bearing key and array element', () => {
    const out = resolveSourceQuotes({ x: [{ quote: 'בקצה המגרש. לפיל' }], sceneChangeEvidence: 'בקצה  המגרש.\nלפיל היה' }, texts);
    expect(out).toEqual({ x: [{ quote: 'בקצה המגרש.\nלפיל' }], sceneChangeEvidence: 'בקצה המגרש.\nלפיל היה' });
  });
});
