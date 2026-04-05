import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true, // bindet auf 0.0.0.0 → im ganzen Netz erreichbar
    port: 5173,
    allowedHosts: true, // ngrok und andere Tunnel-URLs zulassen
  },
})
