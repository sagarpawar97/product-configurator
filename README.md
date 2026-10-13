# WebShop Configurator POC (TypeScript)

```
index.html               → <pdp-page></pdp-page>
src/main.tsx             → dev only: registers PdpPage as <pdp-page> with @r2wc/react-to-web-component
src/PdpPage.tsx          → sample PDP: how to use the configurator
src/configurator/        → ★ THE CONFIGURATOR — copy this folder into your app
```

## Run

```bash
npm install
npm run dev         # http://localhost:5173
npm run typecheck   # tsc --strict
npm run build       # typecheck + production build
```

## Use it in your app

1. Copy `src/configurator/` into your project.
2. In the PDP page:

```tsx
import { useState } from 'react';
import Configurator from './configurator';

export default function PdpPage() {
  const [showConfigurator, setShowConfigurator] = useState(false);

  return (
    <>
      <button onClick={() => setShowConfigurator(true)}>Configure</button>
      <Configurator open={showConfigurator} onClose={() => setShowConfigurator(false)} />
    </>
  );
}
```

Defaults: item `484`, branch `SAR100`.

| Prop | Type | Default | |
|---|---|---|---|
| `open` | `boolean` | `false` | Show the modal |
| `onClose` | `() => void` | — | ×, Cancel, Esc, backdrop, after Add to Cart |
| `itemId` | `string` | `"484"` | JDE item (segment 1) |
| `branch` | `string` | `"SAR100"` | Branch/plant |
| `onAddToCart` | `(line: ConfiguratorCartLine) => void` | — | `{ item, branch, config, resolvedConfig, price, kit }` |

```ts
import Configurator, { type ConfiguratorProps, type ConfiguratorCartLine } from './configurator';
```

### Needs in your app
- React 18+, TypeScript, Vite, `sass`.
- Dev proxy in your `vite.config.ts` (calls go to `/apim/...` in dev):
  ```ts
  server: { proxy: { '/apim': { target: 'https://assaabloyamericas.azure-api.net', changeOrigin: true, rewrite: (p) => p.replace(/^\/apim/, '') } } }
  ```
  Production builds call APIM directly → APIM needs CORS for your site's origin.

## Inside `src/configurator/`

```
index.ts                  import Configurator from './configurator'  (+ types)
Configurator.tsx          the component (own Shadow DOM + modal)
types/index.ts            all shared types (API responses, fields, props, cart line)
config/api.ts             ALL API details: host, subscription key, endpoints, defaults
config/segmentGroups.ts   optional grouping of segment ranges into one field (GROUP_SEGMENTS flag, off)
config/optionImages.ts    option images: OPTION_IMAGES[segment][value] = url
config/sampleImages.ts    ⚠️ TEMPORARY sample images for "…FINISH" segments — delete when real images are in
styles/                   ALL styles
  _variables.scss         global font size ($font-size-root), modal width ($modal-max-width), fonts, colors, spacing
  index.scss              entry — everything nested under .wsc-configurator
hooks/useConfigurator.ts  state + API flow
components/               ConfiguratorModal (Required / Optional sections), SegmentRow (image segments → option cards + preview;
                          text segments → overlay dropdown), OptionThumb, SummaryPanel, OrderString
utils/                    order string + validation message helpers
env.d.ts                  Vite client types (import.meta.env, ?inline import)
```

**Style isolation:** renders into its own Shadow DOM and every rule is nested under `.wsc-configurator` — your page's CSS can't change it and its CSS can't change your page. Sizes are px from `$font-size-root`, independent of your `html { font-size }`.
The Shadow DOM host (`<div class="wsc-host">`) is appended to `<body>`, so a `transform`, `overflow: hidden` or `z-index` on any PDP container can't clip or shift the modal or its dropdowns.

> **Editing styles in dev:** styles are imported with `?inline`, so Vite does **not** hot-update changes to the
> `_*.scss` partials — reload the page after editing them (and restart `npm run dev` after copying a new version of the folder).

## Option images

Add real images in `config/optionImages.ts`:
```ts
export const OPTION_IMAGES = {
  '50': { B: '/images/finish/brass-bronze.png', A: '/images/finish/aluminium.png' },
};
```
All segments start closed. Segments with images expand inline: search across the top, option cards on the left, large preview on the right (desktop).
A × on a closed row clears its value without opening it.
Segments without images open a compact dropdown (search + "Title (CODE)" list). It floats above everything (fixed to the
screen like a native select), opens upward when there's no room below, and closes if its row scrolls out of view.

**Sample images (testing only):** `USE_SAMPLE_IMAGES = true` draws placeholder images for segments whose name contains "FINISH".
To remove: delete `config/sampleImages.ts` and the lines marked `SAMPLE` in `optionImages.ts`.

## Flow
1. Open → `POST /remaining-values` with `1 <item>|` loads the fields.
2. Every change → one `POST /remaining-values` with the full order string (picks + defaults); returned segments get updated options/defaults.
3. Get Price → `POST /validate`; rule messages show in the summary and under fields; valid → total + Add to Cart.
4. Add to Cart → `onAddToCart(line)` then `onClose()`.

Segments 901–914 are shown as separate fields. To show each range as ONE field (value applied to all of them),
set `GROUP_SEGMENTS = true` in `config/segmentGroups.ts`.

> The subscription key is in `config/api.ts` and ends up in the browser bundle — fine for the POC; move behind your backend for production.
