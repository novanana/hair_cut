import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
// GitHub Pages serves this project from https://novanana.github.io/hair_cut/,
// not the domain root, so every asset/manifest path needs this prefix.
const base = '/hair_cut/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '헤어 도해도 노트',
        short_name: '도해도노트',
        description: '수업 중 두상 도해도를 빠르게 그리고 메모하는 앱',
        theme_color: '#18181b',
        background_color: '#18181b',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,ico,png}'],
      },
    }),
  ],
})
