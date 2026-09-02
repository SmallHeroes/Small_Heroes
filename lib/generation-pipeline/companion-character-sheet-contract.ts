/** Passive, provider-free companion-sheet view contract. */
export type CompanionSheetViewKind =
  | 'front'
  | 'three_quarter_front'
  | 'side'
  | 'three_quarter_back'
  | 'happy'
  | 'theme';

export const COMPANION_SHEET_VIEW_KINDS: CompanionSheetViewKind[] = [
  'front',
  'three_quarter_front',
  'side',
  'three_quarter_back',
  'happy',
  'theme',
];

/** On-disk filenames under style01-sheets/ or outputs/companion-sheets/<id>/. */
export const COMPANION_SHEET_VIEW_FILENAME: Record<
  CompanionSheetViewKind,
  string
> = {
  front: 'front.png',
  three_quarter_front: '3-4.png',
  side: 'side.png',
  three_quarter_back: 'back.png',
  happy: 'happy.png',
  theme: 'theme.png',
};
