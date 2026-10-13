import type { SegmentOption, SegmentValues } from '../types';

/** Build "1 484|50 26D|110 1 1/4|" from item + { segment: value } */
export function buildConfigString(item: string, selections: SegmentValues): string {
  const parts = [`1 ${item}`];
  Object.entries(selections)
    .filter(([, v]) => v !== '' && v != null)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([seg, val]) => parts.push(`${seg} ${val}`));
  return parts.join('|') + '|';
}

/** Title-case a JDE description ("O/S FINISH" → "O/S Finish") */
export const prettyName = (s = ''): string =>
  s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\b(I\/s|O\/s)\b/g, (m) => m.toUpperCase());

/** Description without a repeated code prefix ("KY10 - 10 KEYS" → "10 KEYS"); '' when it just repeats the code */
export const optionText = (o: SegmentOption): string => {
  const text = (o.text || '').replace(/^\S+\s+-\s+/, '').trim();
  return text && text.toUpperCase() !== String(o.value).toUpperCase() ? text : '';
};

/** Option label as "value - text" */
export const optionLabel = (o: SegmentOption): string => {
  const text = optionText(o);
  return text ? `${o.value} - ${text}` : o.value;
};

export const formatPrice = (n: number | string | null | undefined, currency = 'USD'): string =>
  n == null || Number.isNaN(Number(n))
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(Number(n));
