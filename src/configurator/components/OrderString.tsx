import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'configurator.orderString.open';

function readOpen(): boolean {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v == null ? true : v === '1'; // open by default
  } catch {
    return true;
  }
}

// One open/closed state shared by the desktop panel and the mobile dock
type OpenUpdater = boolean | ((prev: boolean) => boolean);

let sharedOpen = readOpen();
const subscribers = new Set<(open: boolean) => void>();
function setSharedOpen(next: OpenUpdater) {
  sharedOpen = typeof next === 'function' ? next(sharedOpen) : next;
  try {
    localStorage.setItem(STORAGE_KEY, sharedOpen ? '1' : '0');
  } catch {
    /* storage blocked */
  }
  subscribers.forEach((fn) => fn(sharedOpen));
}
function useSharedOpen(): [boolean, typeof setSharedOpen] {
  const [open, setOpen] = useState(sharedOpen);
  useEffect(() => {
    subscribers.add(setOpen);
    setOpen(sharedOpen);
    return () => {
      subscribers.delete(setOpen);
    };
  }, []);
  return [open, setSharedOpen];
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for http / older browsers
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

/** "1 484|50 26D|110 1 1/4|" → [{ seg: '1', value: '484' }, ...] */
const toPairs = (str: string): Array<{ seg: string; value: string }> =>
  String(str || '')
    .split('|')
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf(' ');
      return i === -1 ? { seg: p, value: '' } : { seg: p.slice(0, i), value: p.slice(i + 1) };
    });

/**
 * Always-visible order string with copy button.
 * Segments are styled (default = muted, conflict = red); the text itself is
 * exactly the order string, so selecting it by hand copies the same thing.
 */
interface OrderStringProps {
  value: string;
  isDefault?: (seg: string) => boolean;
  conflicts?: Set<string>;
  names?: Record<string, string>;
  updating?: boolean;
  className?: string;
}

export default function OrderString({
  value,
  isDefault,
  conflicts,
  names = {},
  updating,
  className = '',
}: OrderStringProps) {
  const [open, setOpen] = useSharedOpen();
  const [copied, setCopied] = useState<'ok' | 'fail' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const pairs = toPairs(value);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onCopy = async () => {
    const ok = await copyText(value);
    setCopied(ok ? 'ok' : 'fail');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(null), 1800);
  };

  return (
    <section className={`order ${className} ${open ? 'order--open' : ''}`} aria-label="Order string">
      <div className="order__head">
        <button
          type="button"
          className="order__toggle"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={`order-body-${className}`}
        >
          <span className="order__chev" aria-hidden />
          <span className="order__title">Order string</span>
          <span className="order__count">{pairs.length} segments</span>
          {/* Always rendered (hidden when idle) so the header never shifts */}
          <span className={`spinner order__spinner ${updating ? '' : 'is-idle'}`} aria-hidden={!updating} />
        </button>

        <button
          type="button"
          className={`order__copy ${copied ? `is-${copied}` : ''}`}
          onClick={onCopy}
          aria-live="polite"
        >
          {copied === 'ok' ? (
            <>
              <svg viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
              Copied
            </>
          ) : copied === 'fail' ? (
            'Copy failed'
          ) : (
            <>
              <svg viewBox="0 0 24 24" aria-hidden>
                <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
                <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>

      {open && (
        <div id={`order-body-${className}`} className="order__body">
          <code className="order__code">
            {pairs.map((p, i) => {
              const cls = [
                'order__pair',
                conflicts?.has(p.seg) ? 'is-conflict' : '',
                isDefault?.(p.seg) ? 'is-default' : '',
              ].join(' ');
              return (
                <span key={`${p.seg}-${i}`} className={cls} title={names[p.seg] || (p.seg === '1' ? 'Item' : `Segment ${p.seg}`)}>
                  <span className="order__seg">{p.seg}</span> <span className="order__val">{p.value}</span>
                  <span className="order__sep">|</span>
                </span>
              );
            })}
          </code>
          <div className="order__legend">
            <span>
              <i className="order__dot" /> Selected
            </span>
            <span>
              <i className="order__dot order__dot--default" /> Default
            </span>
            {!!conflicts?.size && (
              <span>
                <i className="order__dot order__dot--conflict" /> Conflict
              </span>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
