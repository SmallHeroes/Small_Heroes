import { describe, expect, it } from 'vitest';
import { derivePageEntityPresence } from '../image-entity-presence';
import { DRAGON_DINI_RECURRING_OBJECT_CATALOG } from '../style01-gptimage';

const DINI_PAGES = [
  {
    pageNumber: 1,
    bookPageText:
      'גבוה בהר, במקום שבו העננים היו נחים כשהתעייפו, גר דרקון בשם דיני.',
    imageDirection:
      'A high mountain cave above the clouds. A young copper-scaled dragon (Dini) curls inside a warm, glowing cave.',
  },
  {
    pageNumber: 2,
    bookPageText: 'בכל ערב דיני היה מתכרבל על האבן הגדולה.',
    imageDirection:
      'Dini curled snugly on a large smooth glowing stone in the cave. His tail wrapped around himself.',
  },
  {
    pageNumber: 3,
    bookPageText: 'בוקר אחד, כשדיני חזר מטיסת שמש קצרה, הוא נעצר בפתח המערה.',
    imageDirection:
      'Dini hovers at the cave entrance, looking in with cautious curiosity. On his beloved large stone sits a strange round blue-speckled object.',
  },
  {
    pageNumber: 4,
    bookPageText: 'הביצה נפתחה. מתוכה התגלגל דרקון תינוק.',
    imageDirection:
      'A baby dragon has hatched and is crawling onto Dini\'s big warm stone. Dini stands beside, mouth slightly open in surprise.',
  },
];

describe('derivePageEntityPresence — dragon_dini fantasy', () => {
  it('pages 1–4: human child absent, Dini present', () => {
    for (const page of DINI_PAGES.slice(0, 4)) {
      const contract = derivePageEntityPresence({
        bookPageText: page.bookPageText,
        imageDirection: page.imageDirection,
        companionName: 'הדרקון דיני',
        companionId: 'dragon_dini',
        recurringObjectCatalog: DRAGON_DINI_RECURRING_OBJECT_CATALOG,
      });
      expect(contract.childPresence, `page ${page.pageNumber}`).toBe('absent');
      expect(contract.companionPresence, `page ${page.pageNumber}`).toBe('present');
      expect(contract.forbiddenEntities).toContain('human child');
    }
  });

  it('page 3 detects glowing stone and egg objects', () => {
    const contract = derivePageEntityPresence({
      bookPageText: DINI_PAGES[2]!.bookPageText,
      imageDirection: DINI_PAGES[2]!.imageDirection,
      companionId: 'dragon_dini',
      companionName: 'דיני',
      recurringObjectCatalog: DRAGON_DINI_RECURRING_OBJECT_CATALOG,
    });
    expect(contract.recurringObjects).toContain('glowing_stone');
    expect(contract.recurringObjects).toContain('blue_speckled_egg');
  });

  it('detects human child when imageDirection names the child', () => {
    const contract = derivePageEntityPresence({
      bookPageText: 'הילדה מסתכלת על החדר.',
      imageDirection: 'The girl Noa stands in her bedroom doorway, looking at the crib.',
      childFirstName: 'נועה',
      companionName: 'דיני',
      companionId: 'dragon_dini',
    });
    expect(contract.childPresence).toBe('present');
  });
});
