/**
 * Convert Hebrew slash gender chips to full {male|female} curly form.
 */

/** Explicit pairs found in generator output — extend as needed. */
const SLASH_TO_CURLY: Array<[RegExp, string]> = [
  [/נכנס\/ת/g, '{נכנס|נכנסה}'],
  [/מחייך\/ת/g, '{מחייך|מחייכת}'],
  [/הסתכל\/ה/g, '{הסתכל|הסתכלה}'],
  [/לו\/לה/g, '{לו|לה}'],
  [/מלמל\/ה/g, '{מלמל|מלמלה}'],
  [/הצביע\/ה/g, '{הצביע|הצביעה}'],
  [/טבל\/ה/g, '{טבל|טבלה}'],
  [/משך\/ה/g, '{משך|משכה}'],
  [/הניח\/ה/g, '{הניח|הניחה}'],
  [/נשם\/ה/g, '{נשם|נשמה}'],
  [/נשאר\/ה/g, '{נשאר|נשארה}'],
  [/פעור\/ת/g, '{פעור|פעורה}'],
  [/טובל\/ת/g, '{טובל|טובלת}'],
  [/גיחך\/ה/g, '{גיחך|גיחכה}'],
  [/מתגלגל\/ת/g, '{מתגלגל|מתגלגלת}'],
  [/קפץ\/ה/g, '{קפץ|קפצה}'],
  [/ניגב\/ה/g, '{ניגב|ניגבה}'],
  [/עקב\/ה/g, '{עקב|עקבה}'],
  [/הרים\/ה/g, '{הרים|הרימה}'],
  [/מדד\/ה/g, '{מדד|מדדה}'],
  [/ניער\/ה/g, '{ניער|ניערה}'],
  [/תלה\/תה/g, '{תלה|תלתה}'],
];

export function convertSlashChipsToCurly(text: string): { text: string; converted: number } {
  let converted = 0;
  let out = text;
  for (const [re, replacement] of SLASH_TO_CURLY) {
    const before = out;
    out = out.replace(re, replacement);
    if (out !== before) converted++;
  }
  return { text: out, converted };
}
