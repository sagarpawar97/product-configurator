/**
 * ⚠️ TEMPORARY — sample option images for testing the UI only.
 * Draws a generic extrusion profile, coloured from the option's description
 * ("BRASS" → gold, "BRONZE" → brown, "BLACK" → black, "ALUMINIUM"/"CHROME"/"STEEL" → silver, …).
 * 
 * To remove: delete this file and the SAMPLE lines in optionImages.ts.
 */

/** Only segments whose name contains one of these words get sample images */
export const SAMPLE_IMAGE_SEGMENT_NAMES = ['FINISH'];

interface Palette {
  top: string;
  front: string;
  dark: string;
}

const PALETTES: Array<[RegExp, Palette]> = [
  [/BLACK/i, { top: '#4a4a4a', front: '#2b2b2b', dark: '#141414' }],
  [/DARK BRONZE|OXIDIZED|OIL RUBBED|DURANODIC|\bDB\b/i, { top: '#5d4334', front: '#3d2a20', dark: '#22160f' }],
  [/BRASS|GOLD/i, { top: '#e6c879', front: '#c49a3c', dark: '#8a6a22' }],
  [/BRONZE/i, { top: '#b0845a', front: '#8a5f39', dark: '#5c3d22' }],
  [/WHITE|PAINT|PRIME/i, { top: '#f6f6f3', front: '#dcdcd7', dark: '#b5b5ae' }],
  [/STAINLESS|STEEL/i, { top: '#c9ccd0', front: '#9ea3a9', dark: '#6f747a' }],
  [/ALUMIN|CHROME|NICKEL|SILVER|SATIN|CLEAR/i, { top: '#e3e6ea', front: '#bcc2c9', dark: '#8b939c' }],
];

const FALLBACK: Palette = { top: '#d9dde2', front: '#b3bac2', dark: '#858d96' };

function svgFor(p: Palette): string {
  // Angled extrusion bar with a channel, like a product thumbnail
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.front}"/><stop offset="1" stop-color="${p.dark}"/></linearGradient>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${p.top}"/><stop offset="1" stop-color="${p.front}"/></linearGradient>
  </defs>
  <rect width="160" height="100" fill="#f3f4f6"/>
  <polygon points="12,52 108,24 148,34 52,62" fill="url(#t)"/>
  <polygon points="12,52 52,62 52,84 12,74" fill="url(#f)"/>
  <polygon points="52,62 148,34 148,56 52,84" fill="${p.dark}" opacity=".9"/>
  <polygon points="24,58 40,62 40,70 24,66" fill="${p.dark}" opacity=".55"/>
  <polygon points="60,58 140,35 140,40 60,63" fill="#fff" opacity=".25"/>
</svg>`;
}

export function sampleOptionImage(segmentName: string, text: string | null, value: string): string | undefined {
  if (!SAMPLE_IMAGE_SEGMENT_NAMES.some((w) => segmentName.toUpperCase().includes(w))) return undefined;
  if (!value || /^(-|NA|N\/A|NONE)$/i.test(value)) return undefined;
  const label = `${text ?? ''} ${value}`;
  const palette = PALETTES.find(([re]) => re.test(label))?.[1] ?? FALLBACK;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svgFor(palette))}`;
}
