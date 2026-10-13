import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getRemainingValues, validateConfig } from '../config/api';
import { groupOf, type SegmentGroup } from '../config/segmentGroups';
import { buildConfigString } from '../utils/configString';
import { buildMessages, fieldErrorsFrom } from '../utils/validationMessages';
import type { Field, RemainingSegment, SegmentValues, ValidateResponse, ValidationMessage } from '../types';

const REFRESH_DEBOUNCE_MS = 250;

/**
 * Drives the configurator.
 *
 *  - fields:     segments from /remaining-values
 *  - userValues: what the user picked ('' = cleared)
 *  - values:     userValues over defaults (`current`) → form, summary, order string
 *
 * On every change ONE /remaining-values call is made with the full configuration
 * (user picks + defaults). The segments in the response are updated (options + default);
 * the rest keep what they had. Get Price sends the same string to /validate.
 */

/** userValues over API defaults; disabled fields always use the API's current value */
function resolveValues(fields: Field[], userValues: SegmentValues): SegmentValues {
  const v: SegmentValues = {};
  fields.forEach((f) => {
    v[f.seg] = !f.disabled && f.seg in userValues ? userValues[f.seg] : f.current;
  });
  return v;
}

/** Existing segments in the same group as `seg` (just [seg] when not grouped) */
function membersOf(fields: Field[], seg: string): string[] {
  const g = groupOf(seg);
  if (!g) return [seg];
  const m = fields.map((f) => f.seg).filter((x) => Number(x) >= g.from && Number(x) <= g.to);
  return m.length ? m : [seg];
}

/** Group label: configured, or first member's name without its trailing number */
const groupName = (g: SegmentGroup, first: Field): string =>
  g.label || String(first.name || '').replace(/[\s\-~#]*\d+\s*$/, '').trim() || first.name;

interface UseConfiguratorArgs {
  item: string;
  branch: string;
  open: boolean;
}

export interface UseConfiguratorResult {
  fields: Field[];
  displayFields: Field[];
  values: SegmentValues;
  orderString: string;
  isDefault: (seg: string) => boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  validation: ValidateResponse | null;
  pricing: boolean;
  missingRequired: string[];
  fieldErrors: Record<string, string>;
  messages: ValidationMessage[];
  conflicts: Set<string>;
  setValue: (seg: string, value: string) => void;
  clearAll: () => void;
  getPrice: () => Promise<ValidateResponse | null>;
}

export function useConfigurator({ item, branch, open }: UseConfiguratorArgs): UseConfiguratorResult {
  const [fields, setFields] = useState<Field[]>([]);
  const [userValues, setUserValues] = useState<SegmentValues>({});
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false); // first /remaining-values call finished
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidateResponse | null>(null);
  const [pricing, setPricing] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // ── Derived ────────────────────────────────────────────────
  const values = useMemo(() => resolveValues(fields, userValues), [fields, userValues]);
  const orderString = useMemo(() => buildConfigString(item, values), [item, values]);

  // Latest state for the debounced call (no stale closures on quick changes)
  const fieldsRef = useRef(fields);
  const userValuesRef = useRef(userValues);
  fieldsRef.current = fields;
  userValuesRef.current = userValues;

  const isDefaultOne = useCallback(
    (seg: string) => !!values[seg] && (!(seg in userValues) || !!fields.find((f) => f.seg === seg)?.disabled),
    [userValues, values, fields],
  );
  const isDefault = useCallback((seg: string) => membersOf(fields, seg).every(isDefaultOne), [fields, isDefaultOne]);

  // Form/summary fields: grouped segments (e.g. 901–914) shown as one
  const displayFields = useMemo(() => {
    const out: Field[] = [];
    const seen = new Set<string>();
    fields.forEach((f) => {
      const g = groupOf(f.seg);
      if (!g) return void out.push(f);
      const key = `${g.from}-${g.to}`;
      if (seen.has(key)) return;
      seen.add(key);
      const members = fields.filter((x) => Number(x.seg) >= g.from && Number(x.seg) <= g.to);
      if (members.length === 1) return void out.push(f);
      out.push({
        ...f,
        name: groupName(g, f),
        members: members.map((m) => m.seg),
        groupRange: `${members[0].seg}–${members[members.length - 1].seg}`,
        required: members.some((m) => m.required),
        disabled: members.every((m) => m.disabled),
      });
    });
    return out;
  }, [fields]);

  // ── /remaining-values ──────────────────────────────────────
  // initial: replace the field list. Otherwise: update the segments returned, keep the rest.
  const mergeSegments = useCallback((segments: Record<string, RemainingSegment> | undefined, initial: boolean) => {
    setFields((prev) => {
      const map = new Map<string, Field>(initial ? [] : prev.map((f) => [f.seg, f]));
      Object.entries(segments || {}).forEach(([seg, s]) => {
        const old = map.get(seg);
        const list = Array.isArray(s.values) ? s.values : old?.values || [];
        map.set(seg, {
          seg,
          name: s.name ?? old?.name ?? `Segment ${seg}`,
          required: !!s.required,
          current: String(s.current ?? '').trim(),
          values: list,
          disabled: list.length === 0, // no allowed values → can't be chosen
        });
      });
      return [...map.values()].sort((a, b) => Number(a.seg) - Number(b.seg));
    });
  }, []);

  const fetchRemaining = useCallback(
    async (config: string, initial = false) => {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      if (initial) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        const data = await getRemainingValues({ config, branch }, { signal: ctrl.signal });
        if (!ctrl.signal.aborted) mergeSegments(data?.segments, initial);
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Could not load options');
      } finally {
        if (abortRef.current === ctrl) {
          setLoading(false);
          setRefreshing(false);
          if (initial) setLoaded(true);
        }
      }
    },
    [branch, mergeSegments],
  );

  const reset = useCallback(() => {
    clearTimeout(debounceRef.current);
    userValuesRef.current = {};
    setUserValues({});
    setValidation(null);
    setFields([]);
    setLoaded(false);
    void fetchRemaining(buildConfigString(item, {}), true);
  }, [item, fetchRemaining]);

  useEffect(() => {
    if (!open || !item || !branch) return;
    reset();
    return () => {
      // Closing (or item/branch change): stop requests and drop this session's data,
      // so a reopen never shows the previous configuration for a frame
      clearTimeout(debounceRef.current);
      abortRef.current?.abort();
      abortRef.current = null;
      userValuesRef.current = {};
      setUserValues({});
      setFields([]);
      setValidation(null);
      setError(null);
      setLoading(false);
      setRefreshing(false);
      setPricing(false);
      setLoaded(false);
    };
  }, [open, item, branch, reset]);

  // ── Actions ────────────────────────────────────────────────
  const setValue = useCallback(
    (seg: string, value: string) => {
      setValidation(null);
      const next: SegmentValues = { ...userValuesRef.current };
      membersOf(fieldsRef.current, seg).forEach((m) => (next[m] = value)); // groups: all members
      userValuesRef.current = next;
      setUserValues(next);

      // One call per change with the full configuration (picks + defaults)
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void fetchRemaining(buildConfigString(item, resolveValues(fieldsRef.current, userValuesRef.current)));
      }, REFRESH_DEBOUNCE_MS);
    },
    [item, fetchRemaining],
  );

  const getPrice = useCallback(async () => {
    setPricing(true);
    setError(null);
    try {
      const data = await validateConfig({ config: orderString, branch });
      setValidation(data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get price');
      return null;
    } finally {
      setPricing(false);
    }
  }, [orderString, branch]);

  // ── Validation display ─────────────────────────────────────
  const missingRequired = useMemo(
    () => fields.filter((f) => f.required && !values[f.seg]).map((f) => f.seg),
    [fields, values],
  );

  const messages = useMemo(
    () => buildMessages(validation, Object.fromEntries(fields.map((f) => [f.seg, f.name]))),
    [validation, fields],
  );

  const fieldErrors = useMemo(() => {
    const errs = fieldErrorsFrom(messages);
    displayFields.forEach((d) => {
      const hit = !errs[d.seg] && d.members?.find((m) => errs[m]);
      if (hit) errs[d.seg] = errs[hit];
    });
    return errs;
  }, [messages, displayFields]);

  const conflicts = useMemo(() => {
    const set = new Set<string>(
      validation && !validation.valid ? messages.filter((m) => m.tone === 'danger').flatMap((m) => m.segs) : [],
    );
    displayFields.forEach((d) => {
      if (d.members?.some((m) => set.has(m))) set.add(d.seg);
    });
    return set;
  }, [validation, messages, displayFields]);

  return {
    fields,
    displayFields,
    values,
    orderString,
    isDefault,
    loading: loading || (open && !loaded),
    refreshing,
    error,
    validation,
    pricing,
    missingRequired,
    fieldErrors,
    messages,
    conflicts,
    setValue,
    clearAll: reset,
    getPrice,
  };
}
