/** Shared Phase 1 style-audition prompts (text-only + v4-reference). */

export const STYLE_BRIEF_VERSION = 'v3';

export const SHARED_STYLE_BRIEF =
  "A rich, cinematic, premium children's picture-book illustration — hand-crafted and full of life. The world is dense and lived-in: a deeply detailed environment fills the frame, layered foreground to background, richly populated with furniture, plants, props, books, toys, small objects and texture — things to discover in every corner, while keeping a clear focal hierarchy. Clean, confident linework; every object crisply drawn and readable. Clean does NOT mean simple — keep the scene visually rich, layered and atmospheric while each element stays precise. Gouache-and-watercolor with real depth and a strong sense of place — soft light, gentle shadow, atmosphere — but never muddy, hazy or smeared. The child is a cute, appealing, carefully designed character with genuine expression and nuance — real feeling in the face — not a plain, generic, toy-like figure. The quality of a beloved modern premium picture book. Lighting: warmth comes ONLY from real sources in the scene — lamps, windows, lanterns — with NO overall amber, orange or sepia wash; clean true whites and creams, cooler blue-green-balanced shadows, honest midtones. NOT photorealistic. NOT flat vector cartoon. NOT muddy or hazy watercolor. NOT a simple, generic nursery illustration. NOT a character on blank paper.";

export const CHILD_ARCHETYPE =
  'Young child protagonist (around 5 years old, soft rounded features, expressive eyes).';

export const STYLE_AUDITION_SCENES: Array<{ id: string; slug: string; sceneLine: string }> = [
  {
    id: '01',
    slug: 'bedroom-night',
    sceneLine:
      "A child's cozy bedroom at night — a bed, a window showing the moon and stars, shelves with toys and books, a small lamp glowing softly. The child is on the bed.",
  },
  {
    id: '02',
    slug: 'classroom',
    sceneLine:
      "A bright daytime classroom flooded with cool natural daylight from large windows — wooden desks, a chalkboard, posters and children's art on the walls, plants on the windowsill, books and supplies on shelves. The child stands among the desks.",
  },
  {
    id: '03',
    slug: 'clinic',
    sceneLine:
      "A friendly children's clinic room — an examination bed, a shelf of jars and supplies, a curtained window, gentle posters on the wall. The child sits in the room.",
  },
  {
    id: '04',
    slug: 'forest',
    sceneLine:
      'A lush forest in dappled afternoon light — tall trees, ferns, mushrooms, soft light falling through the leaves, a winding path. The child walks the path.',
  },
  {
    id: '05',
    slug: 'night-outdoors',
    sceneLine:
      'A magical night outdoors — a deep starry sky, a crescent moon, fireflies, a glowing lantern, hills in the distance. The child stands outside, looking up in wonder.',
  },
  {
    id: '06',
    slug: 'cottage-garden',
    sceneLine:
      'A cottage and its garden in warm afternoon light — flowers, a winding stone path, a low fence, a leafy tree, a watering can. The child is in the garden.',
  },
];
