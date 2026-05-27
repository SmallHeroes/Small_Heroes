/**
 * Normalized layout for OpenBook.png (2594x1588).
 * Measured from cream-page regions (per-half bounding boxes); consumed via CSS variables -
 * do not hardcode percentages in stylesheets.
 *
 * Image coordinates: left page = illustration, right page = text (Hebrew RTL spread).
 */

export type NormalizedRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EdgeInsets = {
  top: number;
  bottom: number;
  outer: number;
  spine: number;
};

/** Fractional inset inside a page box (0-1). */
export type PageInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const OPEN_BOOK_ASSET = {
  src: '/Images/OpenBook.png',
  width: 2594,
  height: 1588,
  /** Retina-native source (2x of original 1297x794). Aspect ratio unchanged. */
  srcSet: undefined as string | undefined,
} as const;

/** Decorative torn-paper mask laid above the page content. Same aspect/size as OpenBook. */
export const MASK_ON_BOOK_ASSET = {
  src: '/Images/MaskOnBook.png',
  width: 2594,
  height: 1588,
} as const;

/** Reserved asset - not loaded by the default desktop reader (warm-dark stage instead). */
export const TABLE_TEXTURE_ASSET = {
  src: '/Images/TableTexture.png',
} as const;

/** Page boxes in OpenBook.png normalized space (0-1).
 *  Tightened 2026-05-27 to live STRICTLY inside the cream area — y/h now match the
 *  measured cream corners so no part of .openPageLeft / .openPageRight extends into
 *  the transparent strip above/below the leather binding. */
export const OPEN_BOOK_PAGE_BOXES = {
  leftPage: {
    x: 0.040864,
    y: 0.050,
    w: 0.453354,
    h: 0.890,
  },
  rightPage: {
    x: 0.501928,
    y: 0.050,
    w: 0.468774,
    h: 0.890,
  },
} as const satisfies Record<'leftPage' | 'rightPage', NormalizedRect>;

export type LeftPageShape = {
  /** object-position value for the illustration img inside the left page clip. */
  illustrationObjectPosition: string;
};

/** Flat left-page illustration positioning. No clip-path (rect + overflow:hidden
    bound the illustration; MaskOnBook handles decorative shape). No fake 3D. */
export const leftPageShape: LeftPageShape = {
  illustrationObjectPosition: 'center center',
};

/** Inner text area inside rightPage - extra inset to clear MaskOnBook decorative borders. */
export const OPEN_BOOK_TEXT_SAFE_INSET: EdgeInsets = {
  top: 0.10,
  bottom: 0.08,
  outer: 0.07,
  spine: 0.06,
};

export function insetRect(page: NormalizedRect, inset: PageInsets): NormalizedRect {
  return {
    x: page.x + page.w * inset.left,
    y: page.y + page.h * inset.top,
    w: page.w * (1 - inset.left - inset.right),
    h: page.h * (1 - inset.top - inset.bottom),
  };
}

/** Text safe zone inside the right (prose) page. */
export function openBookTextSafeZone(): NormalizedRect {
  const { rightPage } = OPEN_BOOK_PAGE_BOXES;
  const i = OPEN_BOOK_TEXT_SAFE_INSET;
  return insetRect(rightPage, {
    top: i.top,
    bottom: i.bottom,
    left: i.spine,
    right: i.outer,
  });
}

/** Both pages - wide illustration / overlay spreads. */
export function openBookSpreadOverlay(): NormalizedRect {
  const { leftPage, rightPage } = OPEN_BOOK_PAGE_BOXES;
  return {
    x: leftPage.x,
    y: Math.min(leftPage.y, rightPage.y),
    w: rightPage.x + rightPage.w - leftPage.x,
    h: Math.max(leftPage.h, rightPage.h),
  };
}

function rectToPercentVars(prefix: string, rect: NormalizedRect): Record<string, string> {
  return {
    [`--${prefix}-x`]: `${rect.x * 100}%`,
    [`--${prefix}-y`]: `${rect.y * 100}%`,
    [`--${prefix}-w`]: `${rect.w * 100}%`,
    [`--${prefix}-h`]: `${rect.h * 100}%`,
  };
}

/** CSS custom properties for composite desktop reader (apply on `.openBookFrame`). */
export function openBookLayoutCssVars(): Record<string, string> {
  const textSafe = openBookTextSafeZone();
  const spread = openBookSpreadOverlay();
  return {
    '--open-book-aspect': String(OPEN_BOOK_ASSET.width / OPEN_BOOK_ASSET.height),
    ...rectToPercentVars('open-left-page', OPEN_BOOK_PAGE_BOXES.leftPage),
    ...rectToPercentVars('open-right-page', OPEN_BOOK_PAGE_BOXES.rightPage),
    ...rectToPercentVars('open-text-safe', textSafe),
    ...rectToPercentVars('open-spread', spread),
    '--open-left-illustration-object-position': leftPageShape.illustrationObjectPosition,
  };
}
