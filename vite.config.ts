import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // Dev only: /apim/* → Azure APIM, so the browser doesn't hit CORS (see USE_DEV_PROXY in configurator/config/api.ts)
    proxy: {
      '/apim': {
        target: 'https://assaabloyamericas.azure-api.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/apim/, ''),
      },
    },
  },
});
