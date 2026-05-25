import fs from 'fs';
import path from 'path';

const strip = (s) => s.replace(/<!--[\s\S]*?-->/g, '').trim();
const dest = path.join('lib/story-generator/__tests__/voice-calibration-corpus');

const map = {
  fantasy_gold: 'gold-candidates/bolly_fantasy_v0.5.5g_gold.md',
  adventure_noa: 'gold-candidates/bolly_adventure_v0.5a_smoke1.md',
  adventure_michal: 'gold-candidates/bolly_adventure_v0.5.0-f_gold.md',
  adventure_daniel: 'gold-candidates/bolly_adventure_v0.5a_smoke2.md',
  bedtime_michal: 'gold-candidates/bolly_bedtime_v0.5.0-b_gold.md',
};

fs.mkdirSync(dest, { recursive: true });

for (const [id, src] of Object.entries(map)) {
  let md = strip(fs.readFileSync(src, 'utf8'));
  if (id === 'adventure_noa') {
    md = md.replace(
      /--- Page 1 ---[\s\S]*?(?=--- Page 2 ---)/,
      `--- Page 1 ---
השמש נכנסה לחדר של נועה.
היא הסתתרה מתחת לשמיכה ולא רצתה לקום.
הגוף עדיין מכווץ, אבל בּוֹלִי ישב ליד הכרית.

`
    );
    md = md.replace(
      /--- Page 4 ---[\s\S]*?(?=--- Page 5 ---)/,
      `--- Page 4 ---
נועה חיכתה רגע ואז המשיכה ללכת.
בּוֹלִי מתגלגל לידה ומתאים את הקצב לקצב הצעדים — טוּמְפּ רך.
הם הלכו יחד לאורך המדרכה.

`
    );
  }
  if (id === 'adventure_michal') {
    md = md.replace(
      /--- Page 11 ---[\s\S]*?(?=--- Page 12 ---)/,
      `--- Page 11 ---
המדחום נגע ביד של מיכל קלות.
המדחום עדיין ביד שלה כשהרופאה חייכה.
היא נשארה על הכיסא, הגוף שקט.

`
    );
  }
  fs.writeFileSync(path.join(dest, `${id}.md`), `${md}\n`);
}

let run1 = strip(fs.readFileSync('gold-candidates/bolly_adventure_v0.5.0-f_gold.md', 'utf8'));
run1 = run1.replace(
  /--- Page 6 ---[\s\S]*?(?=--- Page 7 ---)/,
  `--- Page 6 ---
האור הלבן בחדר דוקדק ונוגע בעיניים.
מיכל מצמצמת עיניים ונושמת קצר.
בּוֹלִי הזיז לוח קלות בתוך הכיס.

`
);
fs.writeFileSync(path.join(dest, 'adventure_michal_run1.md'), `${run1}\n`);

// bedtime_noa — anticipation smoke with therapeutic + ai-poetic seeds
let bedtimeNoa = strip(fs.readFileSync('gold-candidates/bolly_bedtime_v0.5.0-b_gold.md', 'utf8'));
bedtimeNoa = bedtimeNoa.replace(/מיכל/g, 'נועה').replace(/girl/g, 'girl');
bedtimeNoa = bedtimeNoa.replace(
  /--- Page 3 ---[\s\S]*?(?=--- Page 4 ---)/,
  `--- Page 3 ---
עיניה גולשות אל המדחום שעל המדף.
אי-השקט הקטן עוד כאן, והיא מסיטה את המבט הצידה.
בחדר שקט, ובבטן מתנועע משהו קטן שלא נרגע.

`
);
bedtimeNoa = bedtimeNoa.replace(
  /--- Page 7 ---[\s\S]*?(?=--- Page 8 ---)/,
  `--- Page 7 ---
היא מושיטה אצבע קטנה ונוגעת בבּוֹלִי בעדינות.
לוח אחד נפתח ובפנים חם.
החום עובר אל קצה האצבע.

`
);
fs.writeFileSync(path.join(dest, 'bedtime_noa.md'), `${bedtimeNoa}\n`);

let bedtimeMichal = strip(fs.readFileSync('gold-candidates/bolly_bedtime_v0.5.0-b_gold.md', 'utf8'));
bedtimeMichal = bedtimeMichal.replace(
  /--- Page 4 ---[\s\S]*?(?=--- Page 5 ---)/,
  `--- Page 4 ---
המחשבה על מחר עושה את הכתפיים לעלות מעט.
יד קטנה נסגרת קצת ליד הכרית.
הנשימה שלה נהיית קצרה, כמו מחכה.

`
);
fs.writeFileSync(path.join(dest, 'bedtime_michal.md'), `${bedtimeMichal}\n`);

// bedtime_daniel — dense opening line
let bedtimeDaniel = strip(fs.readFileSync('gold-candidates/bolly_bedtime_v0.5.0-b_gold.md', 'utf8'));
bedtimeDaniel = bedtimeDaniel
  .replace(/מיכל/g, 'דניאל')
  .replace('childGender: "girl"', 'childGender: "boy"');
bedtimeDaniel = bedtimeDaniel.replace(
  /--- Page 1 ---[\s\S]*?(?=--- Page 2 ---)/,
  `--- Page 1 ---
דניאל שוכב במיטה כשהאור העמום מהמסדרון משאיר פס רך על הקיר ועל המדף שמחכה מדחום קטן למחר ובּוֹלִי נח ליד הכרית עם לוח קטן אחד פתוח.

`
);
fs.writeFileSync(path.join(dest, 'bedtime_daniel.md'), `${bedtimeDaniel}\n`);

console.log('Seeded voice calibration corpus in', dest);
