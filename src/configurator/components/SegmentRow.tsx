import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRootEl } from '../context/RootContext';
import { getOptionImage } from '../config/optionImages';
import { optionText, prettyName } from '../utils/configString';
import type { Field } from '../types';
import OptionThumb from './OptionThumb';

const SEARCH_MIN_OPTIONS = 6;

/** Nearest ancestor that actually scrolls (the list on desktop, the modal body on tablet/mobile) */
function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p);
    if ((overflowY === 'auto' || overflowY === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}

const DROPDOWN_MAX_HEIGHT = 340; // px
const DROPDOWN_MIN_HEIGHT = 160; // px
const VIEWPORT_MARGIN = 8; // px

interface DropdownPos {
  left: number;
  width: number;
  up: boolean;
  maxHeight: number;
  top?: number;
  bottom?: number;
}

export interface RowOption {
  value: string;
  title: string;
  code: string;
  image?: string;
}

/** "Standard (H01)" — or just the code when there's no separate description */
export const optionLabelOf = (o: Pick<RowOption, 'title' | 'code'>): string =>
  o.title !== o.code ? `${o.title} (${o.code})` : o.code;

/** Options of a field with display title + image, keeping the current value visible even if it isn't in the list */
export function useRowOptions(field: Field, value: string): RowOption[] {
  return useMemo(() => {
    const list =
      value && !field.values.some((o) => o.value === value) ? [{ value, text: null }, ...field.values] : field.values;
    return list.map((o) => {
      const text = optionText(o);
      return {
        value: o.value,
        title: text ? prettyName(text) : o.value,
        code: o.value,
        image: getOptionImage(field.seg, field.name, o.value, o.text),
      };
    });
  }, [field.seg, field.name, field.values, value]);
}

interface SegmentRowProps {
  field: Field;
  value: string | undefined;
  isDefault: boolean;
  error?: string;
  disabled?: boolean;
  expanded: boolean;
  onToggle: (seg: string) => void;
  onChange: (seg: string, value: string) => void;
}

/**
 * One segment row.
 *  - Segments WITH images: expands inline into option cards + a preview (desktop).
 *  - Segments WITHOUT images: a compact dropdown that overlays the rows below (opens up when there's no room).
 */
export default function SegmentRow({
  field,
  value = '',
  isDefault,
  error,
  disabled,
  expanded,
  onToggle,
  onChange,
}: SegmentRowProps) {
  const options = useRowOptions(field, value);
  const [query, setQuery] = useState('');
  const [hovered, setHovered] = useState<string | null>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const ddRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rootEl = useRootEl();
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.value === value);
  const hasImages = options.some((o) => o.image);
  const mode: 'cards' | 'dropdown' = hasImages ? 'cards' : 'dropdown';
  const locked = field.disabled; // API returned no options
  const showSearch = options.length >= SEARCH_MIN_OPTIONS;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.code} ${o.title}`.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const preview = options.find((o) => o.value === hovered) ?? selected ?? null;
  const close = () => onToggle(field.seg);
  const portal = (node: JSX.Element) => (rootEl ? createPortal(node, rootEl) : node);

  // Reset on close; cards scroll into view on open
  useEffect(() => {
    if (!expanded) {
      setQuery('');
      setHovered(null);
      return;
    }
    if (mode === 'cards') rowRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [expanded, mode]);

  // Latest onToggle for listeners (the parent passes a new function each render)
  const onToggleRef = useRef(onToggle);
  onToggleRef.current = onToggle;

  // Dropdown position: fixed to the screen (like a native select), so no scrolling panel can clip it.
  // Opens below the row, or above when there's more room there; closes if the row scrolls out of view.
  const [ddPos, setDdPos] = useState<DropdownPos | null>(null);
  // Invisible fixed box (inset 0) next to the dropdown: its rect is where position:fixed really maps to.
  // Normally the viewport; differs if the host page puts a transform/filter on an ancestor.
  const probeRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    if (!expanded || mode !== 'dropdown' || !rowRef.current) {
      setDdPos(null);
      return;
    }
    const row = rowRef.current;
    const head = row.querySelector<HTMLElement>('.row__head');
    const scroller = scrollParent(row);

    const place = () => {
      if (!head) return;
      const r = head.getBoundingClientRect();
      const view = scroller?.getBoundingClientRect();
      // Row scrolled out of its panel → close, like a native select
      if (view && (r.bottom < view.top + 4 || r.top > view.bottom - 4)) {
        onToggleRef.current(field.seg);
        return;
      }
      const below = window.innerHeight - r.bottom - VIEWPORT_MARGIN;
      const above = r.top - VIEWPORT_MARGIN;
      const up = below < DROPDOWN_MAX_HEIGHT && above > below;
      // Screen coords → coords of the fixed containing block (no-op when it's the viewport)
      const cb = probeRef.current?.getBoundingClientRect();
      const ox = cb?.left ?? 0;
      const oy = cb?.top ?? 0;
      const cbBottom = cb && cb.height ? cb.bottom : window.innerHeight;
      setDdPos({
        left: r.left - ox,
        width: r.width,
        up,
        maxHeight: Math.max(DROPDOWN_MIN_HEIGHT, Math.min(DROPDOWN_MAX_HEIGHT, up ? above : below)),
        ...(up ? { bottom: cbBottom - r.top } : { top: r.bottom - oy }),
      });
    };

    // Opening can shift the list (e.g. a tall image row above just collapsed) → bring this row
    // into view first, so it isn't treated as "scrolled away" and closed straight away
    if (head && scroller) {
      const r = head.getBoundingClientRect();
      const view = scroller.getBoundingClientRect();
      // leave room for the sticky "Required / Optional" title
      const sticky = row.closest('.modal__section')?.querySelector('.modal__section-title')?.getBoundingClientRect().height ?? 0;
      const top = view.top + sticky;
      if (r.top < top || r.bottom > view.bottom) {
        scroller.scrollTop += r.top < top ? r.top - top - VIEWPORT_MARGIN : r.bottom - view.bottom + VIEWPORT_MARGIN;
      }
    }
    place();
    const onScroll = (e: Event) => {
      // Ignore scrolling inside the dropdown's own list
      if (e.target instanceof Node && ddRef.current?.contains(e.target)) return;
      place();
    };
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true);
    scroller?.addEventListener('scroll', onScroll);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
      scroller?.removeEventListener('scroll', onScroll);
    };
  }, [expanded, mode, field.seg]);

  // Dropdown: on open, focus search (or the selected option) and show the selected option
  // (waits until the dropdown is positioned — it's invisible for its first frame and can't take focus before that)
  const positioned = ddPos !== null;
  useEffect(() => {
    if (!expanded || mode !== 'dropdown' || !positioned) return;
    // Touch devices: don't focus the search box (the keyboard would cover the list)
    const touch = window.matchMedia('(pointer: coarse)').matches;
    if (searchRef.current && !touch) searchRef.current.focus({ preventScroll: true });
    else listRef.current?.querySelector<HTMLElement>('[aria-selected="true"], [role="option"]')?.focus({ preventScroll: true });
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [expanded, mode, positioned]);



  // Dropdown: close on a click outside the row
  useEffect(() => {
    if (!expanded || mode !== 'dropdown') return;
    const onDown = (e: Event) => {
      // composedPath() sees inside the Shadow DOM
      const path = e.composedPath();
      const inside = (rowRef.current && path.includes(rowRef.current)) || (ddRef.current && path.includes(ddRef.current));
      if (!inside) onToggleRef.current(field.seg);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
    };
  }, [expanded, mode, field.seg]);

  // Dropdown keyboard: ↑/↓ move between options, Enter picks (handled by the button), Esc closes
  const onDropdownKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const root = rowRef.current?.getRootNode() as Document | ShadowRoot | undefined;
    const idx = items.indexOf(root?.activeElement as HTMLElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(items.length - 1, idx + 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) searchRef.current?.focus();
      else items[idx - 1]?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation(); // close only the dropdown, not the configurator
      close();
      rowRef.current?.querySelector<HTMLElement>('.row__toggle')?.focus();
    }
  };

  const id = `seg-${field.seg}`;
  const panelId = `${id}-panel`;
  const name = prettyName(field.name);
  // "Search finish (e.g. Brass, Aluminium, Bronze)…"
  const examples = options
    .filter((o) => o.title !== o.code)
    .slice(0, 3)
    .map((o) => o.title);
  const searchHint = `Search ${name.toLowerCase()}${examples.length ? ` (e.g. ${examples.join(', ')})` : ''}…`;

  const search = showSearch && (
    <label className="row__search">
      <svg viewBox="0 0 24 24" aria-hidden>
        <circle cx="11" cy="11" r="6.5" />
        <path d="M16 16l4 4" />
      </svg>
      <input
        ref={searchRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={searchHint}
        aria-label={`Search ${name}`}
      />
    </label>
  );

  return (
    <div
      ref={rowRef}
      // Dropdown closes when focus leaves the row (e.g. Tab), like a native select
      onBlur={(e) => {
        const to = e.relatedTarget as Node | null;
        if (mode === 'dropdown' && expanded && !e.currentTarget.contains(to) && !ddRef.current?.contains(to)) close();
      }}
      className={[
        'row',
        `row--${mode}`,
        expanded && 'row--open',
        expanded && ddPos?.up && 'row--drop-up',
        error && 'row--error',
        locked && 'row--locked',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="row__head">
        <span className="row__label">
          <button
            type="button"
            id={id}
            className="row__toggle"
            aria-expanded={expanded}
            aria-controls={panelId}
            aria-haspopup={mode === 'dropdown' ? 'listbox' : undefined}
            disabled={locked}
            onClick={() => onToggle(field.seg)}
          >
            <span className="row__chev" aria-hidden />
            <span className="row__name">
              {name}
              {field.required && <span className="row__req">*</span>}
            </span>
          </button>

          <span className="row__info" tabIndex={0} aria-label={`About ${name}`}>
            i
            <span className="row__tip" role="tooltip">
              {field.members
                ? `Segments ${field.groupRange} · same value applied to all ${field.members.length}`
                : `Segment ${field.seg}`}{' '}
              · {field.required ? 'Required' : 'Optional'}
              {field.current ? ` · Default: ${field.current}` : ''}
            </span>
          </span>

          {field.members && <span className="row__badge row__badge--group">Seg {field.groupRange}</span>}
        </span>

        {expanded ? (
          <span className="row__actions">
            {value && !disabled && (
              <button type="button" className="row__clear" onClick={() => onChange(field.seg, '')}>
                Clear
              </button>
            )}
            <button type="button" className="row__collapse" aria-label={`Collapse ${name}`} onClick={close} />
          </span>
        ) : (
          <button
            type="button"
            className="row__value"
            disabled={locked}
            onClick={() => onToggle(field.seg)}
            tabIndex={-1}
          >
            {locked ? (
              <span className="row__muted">No options available</span>
            ) : selected ? (
              <>
                {hasImages && <OptionThumb src={selected.image} size="sm" />}
                <span className="row__value-text">{optionLabelOf(selected)}</span>
                {isDefault && <span className="row__badge">Default</span>}
              </>
            ) : field.required ? (
              <span className="row__muted">Select</span>
            ) : (
              <>
                <OptionThumb size="sm" />
                <span className="row__muted">None</span>
              </>
            )}
          </button>
        )}
        {!expanded && value && !locked && (
          <button
            type="button"
            className="row__x"
            aria-label={`Clear ${name}`}
            title="Clear"
            disabled={disabled}
            onClick={() => onChange(field.seg, '')}
          >
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M7 7l10 10M17 7L7 17" />
            </svg>
          </button>
        )}
        {!expanded && (
          <button
            type="button"
            className="row__caret"
            tabIndex={-1}
            aria-hidden
            disabled={locked}
            onClick={() => onToggle(field.seg)}
          >
            <span className="row__down" />
          </button>
        )}
      </div>

      {error && <p className="row__error">{error}</p>}

      {/* ── Image segments: inline option cards + preview ── */}
      {expanded && mode === 'cards' && (
        <div id={panelId} className="row__panel row__panel--preview">
          {search}
          <div className="row__options">
            <div className="row__list" role="radiogroup" aria-label={name} onMouseLeave={() => setHovered(null)}>
              {filtered.map((o) => {
                const checked = o.value === value;
                return (
                  <label
                    key={o.value}
                    className={`opt ${checked ? 'opt--checked' : ''}`}
                    onMouseEnter={() => setHovered(o.value)}
                  >
                    <OptionThumb src={o.image} />
                    <span className="opt__text">
                      <span className="opt__title">{o.title}</span>
                      {o.title !== o.code && <span className="opt__code">{o.code}</span>}
                    </span>
                    <input
                      type="radio"
                      name={`${id}-radio`}
                      value={o.value}
                      checked={checked}
                      disabled={disabled}
                      onChange={() => onChange(field.seg, o.value)}
                    />
                    <span className="opt__radio" aria-hidden />
                  </label>
                );
              })}
              {!filtered.length && <p className="row__empty">No matches for “{query}”</p>}
            </div>
          </div>

          <div className="row__preview" aria-hidden>
            <OptionThumb src={preview?.image} size="lg" />
            {preview ? (
              <strong>{preview.title !== preview.code ? `${preview.title} (${preview.code})` : preview.code}</strong>
            ) : (
              <span className="row__muted">Hover or select an option to preview it</span>
            )}
          </div>
        </div>
      )}

      {/* ── Text-only segments: dropdown. Portalled next to the modal and fixed to the screen,
           so no scrolling panel can clip or shift it ── */}
      {expanded &&
        mode === 'dropdown' &&
        portal(
        <>
        <span
          ref={probeRef}
          aria-hidden
          style={{ position: 'fixed', inset: 0, visibility: 'hidden', pointerEvents: 'none' }}
        />
        <div
          ref={ddRef}
          id={panelId}
          className={`row__dropdown ${ddPos?.up ? 'row__dropdown--up' : ''}`}
          onKeyDown={onDropdownKey}
          onBlur={(e) => {
            const to = e.relatedTarget as Node | null;
            if (!ddRef.current?.contains(to) && !rowRef.current?.contains(to)) close();
          }}
          style={
            ddPos
              ? {
                  position: 'fixed',
                  left: ddPos.left,
                  width: ddPos.width,
                  top: ddPos.top,
                  bottom: ddPos.bottom,
                  maxHeight: ddPos.maxHeight,
                }
              : { position: 'fixed', visibility: 'hidden' } // first frame, before it's measured
          }
        >
          {search}
          <div ref={listRef} className="dd" role="listbox" aria-label={name}>
            {filtered.map((o) => {
              const checked = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={checked}
                  className={`dd__opt ${checked ? 'dd__opt--checked' : ''}`}
                  disabled={disabled}
                  onClick={() => {
                    onChange(field.seg, o.value);
                    close();
                    rowRef.current?.querySelector<HTMLElement>('.row__toggle')?.focus();
                  }}
                >
                  <span className="dd__text">{optionLabelOf(o)}</span>
                  {checked && (
                    <svg className="dd__check" viewBox="0 0 24 24" aria-hidden>
                      <path d="M5 12.5l4.5 4.5L19 7.5" />
                    </svg>
                  )}
                </button>
              );
            })}
            {!filtered.length && <p className="row__empty">No matches for “{query}”</p>}
          </div>
        </div>
        </>,
        )}
    </div>
  );
}
