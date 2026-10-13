import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useConfigurator } from '../hooks/useConfigurator';
import { formatPrice } from '../utils/configString';
import { DEFAULTS } from '../config/api';
import SegmentRow from './SegmentRow';
import SummaryPanel from './SummaryPanel';
import OrderString from './OrderString';
import type { ConfiguratorCartLine, Field } from '../types';

const FOCUSABLE = 'button, [href], input:not([type="radio"]), input[type="radio"]:checked, select, textarea, [tabindex]:not([tabindex="-1"])';

interface ConfiguratorModalProps {
  open: boolean;
  item: string;
  branch: string;
  onClose: () => void;
  onAddToCart: (line: ConfiguratorCartLine) => void;
}

export default function ConfiguratorModal({ open, item, branch, onClose, onAddToCart }: ConfiguratorModalProps) {
  const cfg = useConfigurator({ item, branch, open });
  const [expanded, setExpanded] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Focus: move into the dialog on open, give it back to whatever opened it on close
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => previous?.focus({ preventScroll: true });
  }, [open]);

  // Keep Tab / Shift+Tab inside the dialog
  const trapFocus = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const focusables = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
    );
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = (panelRef.current.getRootNode() as Document | ShadowRoot).activeElement;
    if (e.shiftKey && (active === first || active === panelRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };

  // Esc closes an open row first, then the configurator. Body scroll lock (restores the host page's own value)
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (expandedRef.current) setExpanded('');
      else onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  // Every segment starts closed; reset when the configurator closes
  useEffect(() => {
    if (!open) setExpanded(null);
  }, [open]);

  const toggle = (seg: string) => setExpanded((cur) => (cur === seg ? '' : seg));
  const required = cfg.displayFields.filter((f) => f.required);
  const optional = cfg.displayFields.filter((f) => !f.required);
  const requiredDone = required.filter((f) => !!cfg.values[f.seg]).length;

  const renderRows = (fields: Field[]) =>
    fields.map((f) => (
      <SegmentRow
        key={f.seg}
        field={f}
        value={cfg.values[f.seg]}
        isDefault={cfg.isDefault(f.seg)}
        error={cfg.fieldErrors[f.seg]}
        disabled={cfg.pricing}
        expanded={expanded === f.seg}
        onToggle={toggle}
        onChange={cfg.setValue}
      />
    ));

  if (!open) return null;

  const busy = cfg.loading || cfg.pricing;
  const busyUpdating = cfg.refreshing || cfg.pricing;
  const validation = cfg.validation;
  const priced = !!validation?.valid && validation.price != null;
  const names = Object.fromEntries(cfg.fields.map((f) => [f.seg, f.name]));

  const handleAdd = () => {
    if (!validation || validation.price == null) return;
    onAddToCart({
      item,
      branch,
      config: cfg.orderString,
      resolvedConfig: validation.resolvedConfig,
      price: validation.price,
      kit: validation.kit,
    });
  };

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-labelledby="cfg-title">
      <div className="modal__backdrop" onClick={onClose} />

      <div className="modal__panel" ref={panelRef} tabIndex={-1} onKeyDown={trapFocus}>
        <header className="modal__header">
          <div>
            <h2 id="cfg-title">WebShop Configurator ({item})</h2>
            <p>Configure your product by selecting the required options.</p>
          </div>
          <button type="button" className="modal__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <div className="modal__body">
          <div className="modal__main-wrap">
            {/* Loader: thin bar pinned to the top — never moves the layout */}
            <div
              className={`modal__progress ${busyUpdating ? 'is-active' : ''}`}
              role="progressbar"
              aria-label="Updating"
              aria-hidden={!busyUpdating}
            />

            <section className="modal__main" aria-label="Configuration">
              {cfg.error && (
                <div className="modal__alert" role="alert">
                  <span>{cfg.error}</span>
                  {!cfg.fields.length && !cfg.loading && (
                    <button type="button" className="btn btn--link modal__retry" onClick={cfg.clearAll}>
                      Retry
                    </button>
                  )}
                </div>
              )}

              {cfg.loading ? (
                <div className="modal__loading">
                  <span className="spinner" /> Loading options…
                </div>
              ) : (
                <>
                  {required.length > 0 && (
                    <div className="modal__section">
                      <h3 className="modal__section-title">
                        Required
                        <span className={`modal__count ${requiredDone === required.length ? 'is-done' : ''}`}>
                          {requiredDone}/{required.length} selected
                        </span>
                      </h3>
                      <div className="modal__rows">{renderRows(required)}</div>
                    </div>
                  )}
                  {optional.length > 0 && (
                    <div className="modal__section">
                      <h3 className="modal__section-title">
                        Optional
                        <span className="modal__count">{optional.length}</span>
                      </h3>
                      <div className="modal__rows">{renderRows(optional)}</div>
                    </div>
                  )}
                  {!cfg.fields.length && !cfg.error && <p className="modal__empty">No configurable options for this item.</p>}
                </>
              )}
            </section>
          </div>

          <SummaryPanel
            fields={cfg.displayFields}
            allNames={names}
            values={cfg.values}
            isDefault={cfg.isDefault}
            validation={cfg.validation}
            messages={cfg.messages}
            orderString={cfg.orderString}
            updating={cfg.refreshing}
            conflicts={cfg.conflicts}
            onClearAll={() => {
              cfg.clearAll();
              setExpanded(null);
            }}
          />
        </div>

        {/* Tablet / mobile: order string docked above the actions so it's always on screen */}
        <OrderString
          className="order--dock"
          value={cfg.orderString}
          isDefault={cfg.isDefault}
          conflicts={cfg.conflicts}
          names={names}
          updating={cfg.refreshing}
        />

        <footer className="modal__footer">
          <button type="button" className="btn btn--outline modal__cancel" onClick={onClose}>
            Cancel
          </button>

          {priced && (
            <div className="modal__total">
              <span>Estimated total</span>
              <strong>{formatPrice(validation?.price, DEFAULTS.currency)}</strong>
            </div>
          )}

          <div className="modal__actions">
            <button
              type="button"
              className="btn btn--outline"
              onClick={() => void cfg.getPrice()}
              disabled={busy || cfg.refreshing || cfg.missingRequired.length > 0}
              title={cfg.missingRequired.length ? 'Fill all required fields first' : undefined}
            >
              {cfg.pricing && <span className="spinner" />} Get Price
            </button>
            <button type="button" className="btn btn--primary" onClick={handleAdd} disabled={!priced || busy}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="9" cy="20" r="1.5" />
                <circle cx="18" cy="20" r="1.5" />
                <path d="M2 3h3l2.5 12h11.5l2-8H6.2" />
              </svg>
              Add to Cart
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
