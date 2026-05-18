export type SamplePage = {
  pageNumber: number;
  text: string;
  imageDirection: string;
};

export function buildStoryMarkdown(
  frontmatter: Record<string, string | number>,
  pages: SamplePage[]
): string {
  const fmLines = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${typeof v === 'string' ? `"${v}"` : v}`)
    .join('\n');

  const body = pages
    .sort((a, b) => a.pageNumber - b.pageNumber)
    .map(
      (p) =>
        `--- Page ${p.pageNumber} ---\n${p.text.trim()}\n\nimageDirection: ${p.imageDirection.trim()}`
    )
    .join('\n\n');

  return `---\n${fmLines}\n---\n\n${body}\n`;
}

export function defaultBedtimePages(count: number, companionName = 'לִילִי', childName = 'נועה'): SamplePage[] {
  const dirs = [
    'Wide shot of cozy bedroom at night, child on right, soft shadows.',
    'Medium shot, companion hanging near window, child in foreground left.',
    'Close shot of companion wrapping wing, child center frame.',
    'Medium shot, child and companion on bed, warm lamp glow.',
    'Wide shot, both listening to night sounds, child left companion right.',
    'Close shot, child breathes slowly, companion wing on shoulder, emotional peak.',
    'Medium shot, quiet room, child eyes closed, companion whispering.',
    'Wide shot, moon through window, both resting on bed.',
    'Close shot, small lantern glow on companion neck.',
    'Wide shot, child asleep, companion watching, peaceful end.',
  ];

  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const hookLine = [2, 3, 7].includes(n) ? ' ששש... שומעים?' : '';
    const companionLine = n >= 2 ? ` ${companionName} לוחשת לידו.` : '';
    const momentLine =
      n === 6 || n === 9 ? ` ${childName} נשם לאט, כתף יורדת.` : '';
    return {
      pageNumber: n,
      text: `${childName} בחדר${companionLine}${hookLine}${momentLine} הגוף נרגע לאט.`,
      imageDirection: dirs[i % dirs.length] ?? dirs[0],
    };
  });
}

export function defaultBollyPages(count: number, childName = 'נועה'): SamplePage[] {
  const dirs = [
    'Low angle, clinic waiting corner softened, child and armadillo on bench.',
    'Close shot, armadillo folded as ball, child kneeling right.',
    'Medium shot, one shell plate opens, child on left watching.',
    'Wide shot, colorful sticker on shell visible, child foreground.',
    'Medium shot, companion peeks one eye, child hand near belly.',
    'Close shot, pink belly visible, child touches gently, peak moment.',
    'Medium shot, heavy ball roll on mat, child watching from left.',
    'Wide shot, both on soft mat, shell half open.',
    'Close shot, warm belly, child smiles without words.',
    'Wide shot, sticker wrinkle detail, peaceful ending.',
  ];
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1;
    const hookSound = [2, 4, 8].includes(n) ? ' טוּמְפּ.' : '';
    const hookPhrase = [2, 4, 8].includes(n) ? ' בפנים היה חם.' : '';
    const bolly = n >= 2 ? ' בּוֹלִי מתקפל לאט.' : '';
    const momentLine = n === 9 ? ' נועה נוגעת בבטן הוורודה.' : '';
    return {
      pageNumber: n,
      text: `${childName} יושב${bolly}${hookSound}${hookPhrase}${momentLine} הידיים נפתחות.`,
      imageDirection: dirs[i % dirs.length] ?? dirs[0],
    };
  });
}
