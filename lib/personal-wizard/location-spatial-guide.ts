import 'server-only';
import sharp from 'sharp';
import type { BlockedRoute } from './location-spatial-direction';

export const LOCATION_GUIDE_LEGEND =
  'The layout guide is an abstract spatial diagram. Each band follows the order of the priority spatial cues. Its blue section marks the source-specified supply, the dark shape marks the obstruction, and the light section marks the dry or empty bed of the same route. The angled line, when present, marks the separately outlined feature above it. Use the diagram to place the visible parts. Render all materials and colours from the design data, with the storybook style and location labels. Do not copy the guide colours, layout bands, simplified shapes, margins or proportions.';

/** An illustrative diagram, with the same topology at any scale. No typography, image or pixel from a rejected sheet. */
export async function locationSpatialGuide(routes: readonly BlockedRoute[]) {
  if (!routes.length || routes.length > 4) return null;
  const rows = routes.map((route, i) => `<g transform="translate(0 ${i * 152})">
    <path d="M54 97 Q94 72 150 78 L454 78 L458 126 L144 126 Q89 121 54 105Z" fill="#ecd8ab" stroke="#765f44" stroke-width="4"/>
    <path d="M61 100 Q97 80 150 87 L243 87 L242 116 L146 118 Q93 113 61 100Z" fill="#57a7b5"/>
    <path d="M243 125 L244 74 Q251 63 274 60 L287 69 L285 124Z" fill="#5e4942" stroke="#443631" stroke-width="3"/>
    ${route.overhead ? '<path d="M383 17 Q374 28 366 37 L351 61 L343 65 L350 42 Q359 30 360 17Z" fill="#5e8359" stroke="#425f3d" stroke-width="3"/>' : ''}
    </g>`).join('');
  const height = routes.length * 152;
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="512" height="${height}" viewBox="0 0 512 ${height}"><rect width="512" height="${height}" fill="#f7f2e8"/>${rows}</svg>`)).png().toBuffer();
}
