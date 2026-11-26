import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH: '/' (default, Cloudflare / Netlify / local) or '/<repo>/' (GitHub Pages).
const base = process.env.BASE_PATH || '/';

export default defineConfig({
  base,
  build: { target: 'es2020', chunkSizeWarningLimit: 1000 },
  plugins: [
    VitePWA({
      registerType: 'prompt',
      injectRegister: false, // registered from src/ui/update.js
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: base,
        name: 'Iso Piping 3D',
        short_name: 'IsoPiping',
        description: 'Isometric piping sketch, 3D model and bill of materials (MTO) for onshore and offshore piping. Works offline.',
        lang: 'en',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        // aligned with the V4.1 theme: --panel (header) and --bg (light)
        theme_color: '#ffffff',
        background_color: '#e9ecef',
        categories: ['productivity', 'utilities'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        // precache the whole build
        globPatterns: ['**/*.{html,js,css,svg,png,ico,woff,woff2,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
  },
});
