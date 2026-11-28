import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// For GitHub project pages set VITE_BASE_PATH=/your-repo-name/ before building.
const base = process.env.VITE_BASE_PATH || '/';
const normalizedBase = base.endsWith('/') ? base : `${base}/`;

export default defineConfig({
  base: normalizedBase,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg', 'icons/apple-touch-icon.png'],
      devOptions: { enabled: true, type: 'module' },
      manifest: {
        name: 'penny — expense tracker',
        short_name: 'penny',
        description: 'A cute little expense tracker that works offline.',
        lang: 'en',
        start_url: normalizedBase,
        scope: normalizedBase,
        display: 'standalone',
        orientation: 'portrait-primary',
        theme_color: '#ff8f7d',
        background_color: '#fff8f3',
        icons: [
          { src: `${normalizedBase}icons/icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: `${normalizedBase}icons/icon-512.png`, sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: `${normalizedBase}icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Keep version.json in the precache so every push produces a new sw.js.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,json,webmanifest}'],
        // injectRegister is false in this app, so ask Workbox to activate new
        // service workers right away instead of waiting for every tab to close.
        skipWaiting: true,
        clientsClaim: true,
        navigateFallback: `${normalizedBase}index.html`,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'penny-api-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
});
