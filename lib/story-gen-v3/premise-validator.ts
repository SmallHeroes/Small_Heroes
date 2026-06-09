/**
 * Deterministic hard-fail checks for StoryPremiseCandidate.
 */

import type { PremiseHardFail, StoryPremiseCandidate } from './types';

const ABSTRACT_OBJECT_RE =
  /light[\s-]?stone|spark[\s-]?stone|glowing\s+(ring|gate|mirror)|magic\s+mirror|stone\s+of\s+(light|feelings)|אבן\s+(ניצוץ|אור|זוהר)|שער\s+של\s+אור|מראה\s+של\s+רגשות|טבעת\s+זוהרת|אור\s+שמגיב/i;

const SYMBOLIC_PAYOFF_RE =
  /(learned|understood|calmed|felt\s+better|realized|הבין|הרגיע|למד\s+ש|הבנה|הרגעה|נרגע)(?!.*(jump|opens|laugh|runs|joins|falls|קפץ|נפתח|צחק|רץ|הצטרף|נפל))/i;

const CALM_ONLY_PAYOFF_RE =
  /^(they\s+)?(breathe|calm|quiet|peace|שקט|נשמו|הרגיעו)\b/i;

const THERAPEUTIC_HEADLINE_RE =
  /^(a\s+story\s+about|סיפור\s+על|learning\s+to|ללמוד\s+ל|teaches\s+the\s+child)/i;

const COMPANION_OWNS_RE =
  /^(dini|דיני|dragon)\s+(learns|discovers|solves|realizes|מגלה|פותרת|לומדת)/i;

const BABY_OWNS_RE =
  /^(the\s+)?(baby\s+dragon|תינוק[\s-]?דרקון)\s+(saves|leads|solves|teaches|מציל|מוביל|פותר)/i;

const HUMOR_MARKERS = [
  /funny|ridiculous|absurd|stuck|tangled|oops|מצחיק|תקוע|נתקע|נפל|התלפף|בייגל|פופקורן|גרב|כרית|שבלול/i,
];

function fieldLen(s: string | undefined, min: number): boolean {
  return typeof s === 'string' && s.trim().length >= min;
}

function countHumorOpportunities(c: StoryPremiseCandidate): number {
  const blob = [
    c.openingWeirdEvent,
    c.funnyFailureImage,
    c.companionWrongHelp,
    c.escalation,
    c.companionComicEngineUsed,
    c.oneLineHook,
  ].join(' ');
  let count = 0;
  for (const re of HUMOR_MARKERS) {
    if (re.test(blob)) count++;
  }
  if (c.funnyFailureImage?.trim().length > 20) count++;
  if (c.companionWrongHelp?.trim().length > 20) count++;
  if (c.openingWeirdEvent?.trim().length > 25) count++;
  return count;
}

function hasConcretePlayableObject(c: StoryPremiseCandidate): boolean {
  const play = c.playSystem?.trim() ?? '';
  if (play.length >= 12 && !ABSTRACT_OBJECT_RE.test(play)) {
    const playConcrete =
      /\b(draw|slide|game|hide|מרדף|קפיצ|משחק|מגלשה|מחבוא|ציור|ריצה|קערה|פופקורן|גרב|כנף|דלי|חול)\b/i.test(
        play
      );
    if (playConcrete) return true;
  }
  if (!c.keyObjects?.length) return false;
  const joined = c.keyObjects.join(' ').toLowerCase();
  if (ABSTRACT_OBJECT_RE.test(joined)) return false;
  return c.keyObjects.some((o) => o.trim().length >= 2);
}

function hasPhysicalProblem(c: StoryPremiseCandidate): boolean {
  const blob = `${c.physicalProblem} ${c.playSystem} ${c.openingWeirdEvent}`;
  if (!fieldLen(c.physicalProblem, 12)) return false;
  const abstractOnly =
    /emotion|feeling|fear|anxiety|confidence|רגש|פחד|חרדה|ביטחון/i.test(blob) &&
    !/\b(stuck|drop|spill|tangle|fall|block|תקוע|נשפך|נתקע|נפל|חוסם)\b/i.test(blob);
  return !abstractOnly;
}

function hasWeirdHook(c: StoryPremiseCandidate): boolean {
  const hook = `${c.oneLineHook} ${c.openingWeirdEvent}`;
  if (!fieldLen(c.oneLineHook, 15)) return false;
  const tooGeneric =
    /learns to|teaches|lesson about|מלמד|ללמוד|שיעור על/i.test(hook) &&
    !/stuck|pocket|popcorn|tail|wing|cloud|תקוע|כיס|פופקורן|זנב|כנף|ענן/i.test(hook);
  return !tooGeneric;
}

function hasChildTryFail(c: StoryPremiseCandidate): boolean {
  return (
    fieldLen(c.firstTry, 10) &&
    fieldLen(c.whyFirstTryFails, 10) &&
    fieldLen(c.funnyFailureImage, 12)
  );
}

function childOwnsWant(c: StoryPremiseCandidate): boolean {
  if (!fieldLen(c.childWant, 10)) return false;
  if (COMPANION_OWNS_RE.test(c.childWant.trim())) return false;
  if (BABY_OWNS_RE.test(c.childWant.trim())) return false;
  return true;
}

function companionOwnsArc(c: StoryPremiseCandidate): boolean {
  const climax = `${c.braveChildAction} ${c.bigReleasePayoff}`;
  if (COMPANION_OWNS_RE.test(c.braveChildAction?.trim() ?? '')) return true;
  if (BABY_OWNS_RE.test(c.braveChildAction?.trim() ?? '')) return true;
  if (/דיני\s+(מצילה|פותרת|מובילה)/i.test(climax)) return true;
  return false;
}

function abstractObjectIsEngine(c: StoryPremiseCandidate): boolean {
  const blob = `${c.playSystem} ${c.keyObjects?.join(' ')} ${c.openingWeirdEvent} ${c.physicalProblem}`;
  if (!ABSTRACT_OBJECT_RE.test(blob)) return false;
  const tangibleCounter =
    /\b(pocket|popcorn|sock|blanket|basket|laundry|button|lunchbox|sticker|sandal|כיס|פופקורן|גרב|שמיכה|סל|כפתור|קופסת)/i.test(
      blob
    );
  return !tangibleCounter;
}

function payoffIsCalmOnly(c: StoryPremiseCandidate): boolean {
  const p = c.bigReleasePayoff?.trim() ?? '';
  if (!p) return true;
  if (CALM_ONLY_PAYOFF_RE.test(p)) return true;
  if (SYMBOLIC_PAYOFF_RE.test(p) && !/\b(jump|open|laugh|run|join|fall|spread|קפץ|נפתח|צחק|רץ|התפשט|נפל)\b/i.test(p)) {
    return true;
  }
  return false;
}

function resilienceIsHeadline(c: StoryPremiseCandidate): boolean {
  const hook = `${c.oneLineHook} ${c.titleSeed}`;
  if (THERAPEUTIC_HEADLINE_RE.test(hook)) return true;
  if (new RegExp(c.resilienceTheme.replace(/[/\\.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(hook)) {
    return true;
  }
  return false;
}

function resilienceUnderlayerMissing(c: StoryPremiseCandidate): boolean {
  return (
    !fieldLen(c.hiddenResilienceTool, 8) ||
    !fieldLen(c.whyItMattersToChild, 10) ||
    !fieldLen(c.oneResilienceLineMax, 8)
  );
}

function whyNotFableWeak(c: StoryPremiseCandidate): boolean {
  const t = c.whyNotTherapeuticFable?.trim() ?? '';
  if (t.length < 40) return true;
  if (/because it teaches|כי זה מלמד/i.test(t) && !/physical|funny|concrete|פיזי|מצחיק|קונקרטי/i.test(t)) {
    return true;
  }
  return false;
}

export function validatePremiseHardFails(candidate: StoryPremiseCandidate): PremiseHardFail[] {
  const fails: PremiseHardFail[] = [];

  if (!hasWeirdHook(candidate)) {
    fails.push({ code: 'no_weird_funny_hook', message: 'Missing weird/funny concrete hook' });
  }
  if (!hasPhysicalProblem(candidate)) {
    fails.push({ code: 'abstract_problem', message: 'Problem is abstract, not physical' });
  }
  if (!childOwnsWant(candidate)) {
    fails.push({ code: 'no_child_want', message: 'Child does not want something of their own' });
  }
  if (!hasChildTryFail(candidate)) {
    fails.push({ code: 'no_child_try_fail', message: 'No real child try-fail with failure image' });
  }
  if (companionOwnsArc(candidate)) {
    fails.push({ code: 'companion_owns_arc', message: 'Companion appears to own the arc/climax' });
  }
  if (BABY_OWNS_RE.test(candidate.braveChildAction ?? '') || BABY_OWNS_RE.test(candidate.childWant ?? '')) {
    fails.push({ code: 'baby_creature_owns_arc', message: 'Baby creature owns the arc' });
  }
  if (abstractObjectIsEngine(candidate)) {
    fails.push({
      code: 'abstract_magic_object_engine',
      message: 'Abstract magical object is the main engine',
    });
  }
  if (payoffIsCalmOnly(candidate)) {
    fails.push({
      code: 'calm_only_payoff',
      message: 'Payoff is understood/calmed only — no visible release',
    });
  }
  if (resilienceIsHeadline(candidate)) {
    fails.push({
      code: 'resilience_theme_headline',
      message: 'Resilience theme is the visible headline',
    });
  }
  if (countHumorOpportunities(candidate) < 3) {
    fails.push({ code: 'few_humor_opportunities', message: 'Fewer than 3 humor opportunities' });
  }
  if (!fieldLen(candidate.funnyFailureImage, 12)) {
    fails.push({ code: 'no_funny_failure_image', message: 'No physical/funny failure image' });
  }
  if (!hasConcretePlayableObject(candidate)) {
    fails.push({ code: 'no_playable_object', message: 'No concrete playable object' });
  }
  if (resilienceUnderlayerMissing(candidate)) {
    fails.push({
      code: 'resilience_underlayer_missing',
      message: 'Resilience underlayer missing — funny-but-hollow',
    });
  }
  if (whyNotFableWeak(candidate)) {
    fails.push({
      code: 'weak_why_not_fable',
      message: 'whyNotTherapeuticFable is unconvincing',
    });
  }

  return fails;
}
