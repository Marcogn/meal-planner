import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/menu-planner/',
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png'],
      manifest: {
        name: 'Menu Planner',
        short_name: 'MenuPlanner',
        description: 'Pianifica i tuoi menù settimanali offline',
        theme_color: '#2c6e49',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/menu-planner/',
        scope: '/menu-planner/',
        lang: 'it',
        icons: [
          { src: '/menu-planner/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/menu-planner/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
          { src: '/menu-planner/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [],
      },
    }),
  ],
});
