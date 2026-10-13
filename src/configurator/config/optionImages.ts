/**
 * Option images.
 *
 * Put real images here: OPTION_IMAGES[segment][value] = url
 *   e.g. '50': { B: '/images/finish/brass-bronze.png', A: '/images/finish/aluminium.png' }
 * Segments/options without an entry simply show no image.
 */
import { sampleOptionImage } from './sampleImages'; // SAMPLE — remove with sampleImages.ts

export const OPTION_IMAGES: Record<string, Record<string, string>> = {
  // '50': { B: 'https://…/brass.png' },
};

/** SAMPLE — set to false (or delete with sampleImages.ts) once real images are in OPTION_IMAGES */
export const USE_SAMPLE_IMAGES = true;

export function getOptionImage(
  seg: string,
  segmentName: string,
  value: string,
  text: string | null = null,
): string | undefined {
  if (!value) return undefined;
  const real = OPTION_IMAGES[seg]?.[value];
  if (real) return real;
  return USE_SAMPLE_IMAGES ? sampleOptionImage(segmentName, text, value) : undefined; // SAMPLE
}
