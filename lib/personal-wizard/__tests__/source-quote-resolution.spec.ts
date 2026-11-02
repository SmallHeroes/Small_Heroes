import { describe, it, expect } from 'vitest';
import { resolveSourceQuotes } from '../source-quote-resolution';

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
  it('leaves overlapping distinct source spans ambiguous', () => {
    const draft = { quote: 'go\tgo' };
    expect(resolveSourceQuotes(draft, ['go go\ngo'])).toEqual(draft);
  });
  it('resolves every quote-bearing key and array element', () => {
    const out = resolveSourceQuotes({ x: [{ quote: 'בקצה המגרש. לפיל' }], sceneChangeEvidence: 'בקצה  המגרש.\nלפיל היה' }, texts);
    expect(out).toEqual({ x: [{ quote: 'בקצה המגרש.\nלפיל' }], sceneChangeEvidence: 'בקצה המגרש.\nלפיל היה' });
  });
});
