import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          map: ['maplibre-gl'],
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          react: ['react', 'react-dom', 'react-router-dom']
        }
      }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/icon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'T Log',
        short_name: 'T Log',
        description: 'Write, discuss, decide, travel.',
        theme_color: '#f7f6f2',
        background_color: '#f7f6f2',
        display: 'standalone',
        start_url: './',
        scope: './',
        orientation: 'portrait',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024
      }
    })
  ]
})
