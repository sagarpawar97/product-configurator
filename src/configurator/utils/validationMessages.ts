import { prettyName } from './configString';
import type { MessageGroup, ValidateResponse, ValidationMessage } from '../types';

/**
 * Turn a /validate response into one flat list of display messages.
 *
 * Real response shape (SAR100):
 *   ruleMessages: [{ rule, seq, segment, severity, errorId, message, ruleText, segmentValues, customMessage }]
 *   violatedRules / warningRules: ["50"]            ← rule numbers only
 *   invalidExtvarCombinations: ["Seg510: candidate '65 65' not found in f55010cValid for (...)"]
 *   missingRequired: ["Seg50"]   invalidUdc: ["Seg50='QQQ'"]   invalidRange: [...]
 */

export const GROUP_TITLES: Record<MessageGroup, string> = {
  rule: 'Rule violations',
  combination: 'Option combinations not available',
  required: 'Missing required fields',
  range: 'Values out of range',
  warning: 'Warnings',
  udc: 'Values not in the allowed list',
};

const GROUP_ORDER = Object.keys(GROUP_TITLES) as MessageGroup[];

type Names = Record<string, string>;

const segNum = (s: unknown): string | undefined => (String(s ?? '').match(/(\d+)/) || [])[1];
const fieldName = (names: Names, seg: string | undefined): string =>
  seg && names[seg] ? prettyName(names[seg]) : `Segment ${seg ?? ''}`.trim();
const ruleId = (r: string | { rule: string }): string => String(typeof r === 'object' ? r.rule : r);

/** "FUNCTION {Seg. 1/484} is 484\nOPTIONS ~ CYL {Seg. 510/484} is ?\n" → ["Function: 484", "Options ~ Cyl: not set"] */
function parseSegmentValues(text?: string): string[] {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(.*?)\s*\{Seg\.?\s*\d+(?:\/[^}]*)?\}\s*is\s*(.*)$/i);
      if (!m) return l;
      const value = m[2].trim();
      return `${prettyName(m[1].trim())}: ${value === '?' || value === '' ? 'not set' : value}`;
    });
}

export function buildMessages(validation: ValidateResponse | null, names: Names = {}): ValidationMessage[] {
  if (!validation) return [];
  const out: ValidationMessage[] = [];
  const covered = new Set<string>();

  // 1) Rule messages — the API's own readable text
  (validation.ruleMessages || []).forEach((m, i) => {
    const rule = m.rule != null ? String(m.rule) : undefined;
    const isError = String(m.severity || 'error').toLowerCase() === 'error';
    if (rule) covered.add(rule);
    const seg = segNum(m.segment);
    out.push({
      id: `rm-${i}`,
      tone: isError ? 'danger' : 'warning',
      group: isError ? 'rule' : 'warning',
      rule,
      errorId: m.errorId,
      segs: seg ? [seg] : [],
      text: (m.message || m.ruleText || `Rule ${rule} failed`).trim(),
      details: parseSegmentValues(m.segmentValues),
    });
  });

  // 2) Rule numbers with no message (fallback)
  (validation.violatedRules || []).map(ruleId).forEach((rule) => {
    if (!covered.has(rule))
      out.push({ id: `vr-${rule}`, tone: 'danger', group: 'rule', rule, segs: [], text: `Rule ${rule} failed`, details: [] });
  });
  (validation.warningRules || []).map(ruleId).forEach((rule) => {
    if (!covered.has(rule))
      out.push({ id: `wr-${rule}`, tone: 'warning', group: 'warning', rule, segs: [], text: `Rule ${rule} warning`, details: [] });
  });

  // 3) Option combinations — raw text is technical, keep it in details
  (validation.invalidExtvarCombinations || []).forEach((raw, i) => {
    const s = String(raw);
    const seg = segNum((s.match(/^Seg(\d+)/i) || [])[1]);
    const candidate = (s.match(/candidate\s+'([^']*)'/i) || [])[1];
    const who = seg ? fieldName(names, seg) : 'This option';
    out.push({
      id: `ex-${i}`,
      tone: 'danger',
      group: 'combination',
      segs: seg ? [seg] : [],
      text: candidate
        ? `${who}: combination '${candidate.trim()}' is not available with the current selections`
        : `${who}: this combination is not available`,
      details: [s],
    });
  });

  // 4) Missing / range / UDC
  (validation.missingRequired || []).forEach((t) => {
    const seg = segNum(t);
    out.push({
      id: `mr-${t}`,
      tone: 'danger',
      group: 'required',
      segs: seg ? [seg] : [],
      text: `${fieldName(names, seg)} is required`,
      details: [],
    });
  });
  (validation.invalidRange || []).forEach((t, i) => {
    const seg = segNum(String(t).match(/Seg\s*(\d+)/i)?.[1]);
    out.push({
      id: `ir-${i}`,
      tone: 'danger',
      group: 'range',
      segs: seg ? [seg] : [],
      text: seg ? `${fieldName(names, seg)} is outside the allowed range` : String(t),
      details: [String(t)],
    });
  });
  (validation.invalidUdc || []).forEach((t, i) => {
    const seg = segNum(String(t).match(/Seg\s*(\d+)/i)?.[1]);
    const val = (String(t).match(/='([^']*)'/) || [])[1];
    out.push({
      id: `iu-${i}`,
      tone: 'warning',
      group: 'udc',
      segs: seg ? [seg] : [],
      text: `${seg ? fieldName(names, seg) : 'Value'}${val != null ? ` '${val}'` : ''} is not in the allowed list`,
      details: [],
    });
  });

  return out.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group));
}

/** { seg: message } — first message per field, errors before warnings */
export function fieldErrorsFrom(messages: ValidationMessage[]): Record<string, string> {
  const errs: Record<string, string> = {};
  [...messages]
    .sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'danger' ? -1 : 1))
    .forEach((m) => m.segs.forEach((s) => (errs[s] ??= m.tone === 'warning' ? `Warning: ${m.text}` : m.text)));
  return errs;
}
