import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// No service worker. The dashboard is a normal SPA — every refresh fetches
// index.html from the server, which references hashed asset paths so the
// browser pulls the latest JS/CSS automatically.
//
// A small cleanup script in index.html unregisters any service worker that
// might be lingering from a previous deploy, so existing users don't have to
// do anything to pick up new changes.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/i/': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
})
