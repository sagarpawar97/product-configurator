/**
 * ALL API DETAILS LIVE HERE — host, subscription key, endpoints, defaults, request helper.
 * Routes + payloads follow the aaconfig API reference; the host is Azure APIM.
 */
import type { RemainingValuesResponse, ValidateResponse } from '../types';

// ── Host ─────────────────────────────────────────────────────
export const APIM_HOST = 'https://assaabloyamericas.azure-api.net';
export const API_BASE_PATH = '/configurator';

// Dev: requests go through the dev-server proxy (/apim → APIM_HOST) to avoid CORS.
// Your app's vite.config needs the same proxy, or set this to false once APIM allows your origin.
export const USE_DEV_PROXY: boolean = import.meta.env.DEV;

export const API_BASE_URL = `${USE_DEV_PROXY ? '/apim' : APIM_HOST}${API_BASE_PATH}`;

// ── Auth ─────────────────────────────────────────────────────
// NOTE: the key ships inside the JS bundle — fine for the POC, move behind a backend later.
export const SUBSCRIPTION_KEY_HEADER = 'Ocp-Apim-Subscription-Key';
export const SUBSCRIPTION_KEY = '2a20c1d6571e4fd4b6e6fe333d703eaa';

// ── Endpoints ────────────────────────────────────────────────
export const ENDPOINTS = {
  remainingValues: '/remaining-values',
  validate: '/validate',
} as const;

// ── Defaults ─────────────────────────────────────────────────
export const DEFAULTS = {
  item: '484',
  branch: 'SAR100',
  currency: 'USD',
  requestTimeoutMs: 30000,
} as const;

// ── Request helper ───────────────────────────────────────────
interface RequestOptions {
  signal?: AbortSignal;
}

async function post<T>(path: string, body: unknown, { signal }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULTS.requestTimeoutMs);
  signal?.addEventListener('abort', () => controller.abort());

  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        [SUBSCRIPTION_KEY_HEADER]: SUBSCRIPTION_KEY,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error || data?.message || `Request failed (${res.status})`);
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

// ── API calls ────────────────────────────────────────────────
interface ConfigRequest {
  config: string;
  branch?: string;
}

/** POST /remaining-values — segments still open, with allowed values and defaults */
export const getRemainingValues = ({ config, branch = DEFAULTS.branch }: ConfigRequest, opts?: RequestOptions) =>
  post<RemainingValuesResponse>(ENDPOINTS.remainingValues, { config, branch }, opts);

/** POST /validate — validity, rule messages and price */
export const validateConfig = ({ config, branch = DEFAULTS.branch }: ConfigRequest, opts?: RequestOptions) =>
  post<ValidateResponse>(ENDPOINTS.validate, { config, branch, pricing: true }, opts);
