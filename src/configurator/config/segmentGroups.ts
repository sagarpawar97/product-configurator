/**
 * Segments that share the same UDC list and should be shown as ONE dropdown.
 * The chosen value is applied to every segment in the range (order string + API calls).
 * 
 * Add more ranges if needed, e.g. { from: 920, to: 925, label: 'Something' }.
 * `label` is optional — without it the first segment's name is used minus its
 * trailing number ("PREFIX OPTION - 1" → "Prefix Option").
 */
export interface SegmentGroup {
  from: number;
  to: number;
  label?: string;
}

/**
 * Turn grouping on/off.
 *  false (current): every segment (901, 902, … 910) is shown as its own field.
 *  true:            each range below is shown as ONE field and its value is applied to all of them.
 */
export const GROUP_SEGMENTS = false;

export const SEGMENT_GROUPS: SegmentGroup[] = [{ from: 901, to: 914 }];

/** Group config for a segment number, or undefined (always undefined while GROUP_SEGMENTS is off) */
export const groupOf = (seg: string | number): SegmentGroup | undefined =>
  GROUP_SEGMENTS ? SEGMENT_GROUPS.find((g) => Number(seg) >= g.from && Number(seg) <= g.to) : undefined;
