export type StaticBookPalette = {
  page_bg: string;
  page_bg_alt: string;
  text_color: string;
};

export const BOOK_PALETTES: Record<string, StaticBookPalette> = {
  cmobbj6zw00004wf0t8fxfvas: {
    page_bg: '#f5e5b8',
    page_bg_alt: '#ead7a0',
    text_color: '#1a1a1a',
  },
  cmobbaaif00004w40tb8glnso: {
    page_bg: '#c8e0de',
    page_bg_alt: '#b3d0cc',
    text_color: '#1a1a1a',
  },
  cmo9w7zqe00114wa8cs8xeazo: {
    page_bg: '#e8d8e8',
    page_bg_alt: '#d8c6d8',
    text_color: '#1a1a1a',
  },
};

export const DEFAULT_BOOK_PALETTE: StaticBookPalette = {
  page_bg: '#f4efe3',
  page_bg_alt: '#f4efe3',
  text_color: '#1a1a1a',
};

