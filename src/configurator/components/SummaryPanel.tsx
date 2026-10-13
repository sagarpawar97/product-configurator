import { useEffect, useState } from 'react';
import { formatPrice, optionText, prettyName } from '../utils/configString';
import { GROUP_TITLES } from '../utils/validationMessages';
import { DEFAULTS } from '../config/api';
import OrderString from './OrderString';
import OptionThumb from './OptionThumb';
import { getOptionImage } from '../config/optionImages';
import type { Field, MessageGroup, SegmentValues, ValidateResponse, ValidationMessage } from '../types';

type Names = Record<string, string>;

function displayValue(field: Field, v: string | undefined): string {
  if (!v) return 'None';
  const opt = field.values.find((o) => o.value === v);
  const text = opt ? optionText(opt) : '';
  return text ? `${prettyName(text)} (${v})` : v;
}

/** Thumbnail for a summary row: the option image, a "none" icon, or nothing for segments without images */
function SummaryThumb({ field, value }: { field: Field; value: string | undefined }) {
  const hasImages = field.values.some((o) => getOptionImage(field.seg, field.name, o.value, o.text));
  if (!value) return <OptionThumb size="sm" />;
  if (!hasImages) return null;
  const opt = field.values.find((o) => o.value === value);
  return <OptionThumb size="sm" src={getOptionImage(field.seg, field.name, value, opt?.text ?? null)} />;
}

/** Short headline for an invalid configuration */
function headline(messages: ValidationMessage[]): string {
  const errors = messages.filter((m) => m.tone === 'danger');
  if (!errors.length) return 'This configuration is not valid.';
  if (errors.every((m) => m.group === 'required')) return 'Fill in the required fields and get the price again.';
  return 'Update the highlighted options and get the price again.';
}

interface MessagesProps {
  validation: ValidateResponse;
  messages: ValidationMessage[];
  names: Names;
}

function Messages({ validation, messages, names }: MessagesProps) {
  const groups = (Object.keys(GROUP_TITLES) as MessageGroup[])
    .map((g) => ({ key: g, title: GROUP_TITLES[g], items: messages.filter((m) => m.group === g) }))
    .filter((g) => g.items.length);
  const hasWarnings = messages.some((m) => m.tone === 'warning');

  return (
    <div className="summary__messages" role="alert">
      {validation.valid ? (
        <div className="summary__status summary__status--ok">
          ✓ Configuration is valid{hasWarnings ? ' (with warnings)' : ''}
        </div>
      ) : (
        <div className="summary__status summary__status--bad">
          <strong>✕ Configuration is not valid</strong>
          <span>{headline(messages)}</span>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.key} className={`summary__msg summary__msg--${g.items[0].tone}`}>
          <strong>
            {g.title} ({g.items.length})
          </strong>
          <ul>
            {g.items.map((m) => (
              <li key={m.id}>
                <span className="summary__msg-text">{m.text}</span>
                <span className="summary__chips">
                  {m.rule != null && (
                    <span className="summary__rule">
                      Rule {m.rule}
                      {m.errorId ? ` · ${m.errorId}` : ''}
                    </span>
                  )}
                  {m.segs.map((s) => (
                    <span key={s} className="summary__chip">
                      {names[s] ? prettyName(names[s]) : `Segment ${s}`}
                    </span>
                  ))}
                </span>
                {m.details.length > 0 && (
                  <details className="summary__details">
                    <summary>Details</summary>
                    <ul>
                      {m.details.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function PriceBreakdown({ validation }: { validation: ValidateResponse }) {
  if (!validation.priced && validation.price == null) return null;
  return (
    <div className="summary__price">
      <table>
        <tbody>
          {(validation.priceLines || []).map((l, i) => (
            <tr key={i}>
              <td>
                {l.desc}
                {l.item && <span className="summary__muted"> · #{l.item}</span>}
              </td>
              <td className="summary__amt">{formatPrice(l.price, DEFAULTS.currency)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Estimated total</td>
            <td className="summary__amt">{formatPrice(validation.price, DEFAULTS.currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

interface SummaryPanelProps {
  fields: Field[];
  values: SegmentValues;
  isDefault: (seg: string) => boolean;
  validation: ValidateResponse | null;
  messages: ValidationMessage[];
  onClearAll: () => void;
  orderString: string;
  updating?: boolean;
  conflicts: Set<string>;
  allNames?: Names;
}

export default function SummaryPanel({
  fields,
  values,
  isDefault,
  validation,
  messages,
  onClearAll,
  orderString,
  updating,
  conflicts,
  allNames,
}: SummaryPanelProps) {
  const [open, setOpen] = useState(false);
  const names: Names = allNames || Object.fromEntries(fields.map((f) => [f.seg, f.name]));
  const invalid = !!validation && !validation.valid;

  // Open the mobile accordion automatically when there's a problem
  useEffect(() => {
    if (invalid) setOpen(true);
  }, [invalid]);

  return (
    <aside className={`summary ${open ? 'summary--open' : ''}`}>
      <div className="summary__head">
        <button type="button" className="summary__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <h3>Configuration Summary</h3>
          {invalid && <span className="summary__alert-dot" aria-label="Has errors" />}
          <span className="summary__chev" aria-hidden />
        </button>
        <button type="button" className="btn btn--link summary__clear" onClick={onClearAll}>
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" />
          </svg>
          Clear All
        </button>
      </div>

      <div className="summary__body">
        {validation && <Messages validation={validation} messages={messages} names={names} />}
        <dl className="summary__list">
          {fields.map((f) => (
            <div key={f.seg} className={`summary__row ${conflicts.has(f.seg) ? 'summary__row--conflict' : ''}`}>
              <dt>
                {prettyName(f.name)}
                {f.members && <span className="summary__range">{f.groupRange}</span>}
              </dt>
              <dd className={values[f.seg] ? '' : 'summary__muted'}>
                <SummaryThumb field={f} value={values[f.seg]} />
                <span className="summary__val">{displayValue(f, values[f.seg])}</span>
                {isDefault(f.seg) && <span className="summary__tag">default</span>}
              </dd>
            </div>
          ))}
        </dl>

        <OrderString
          className="order--panel"
          value={orderString}
          isDefault={isDefault}
          conflicts={conflicts}
          names={names}
          updating={updating}
        />

        {validation?.valid && <PriceBreakdown validation={validation} />}

        {!validation && (
          <div className="summary__note">
            <span className="summary__note-icon">i</span>
            Get price to see product availability and estimated price based on your configuration.
          </div>
        )}
      </div>
    </aside>
  );
}
