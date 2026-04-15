import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/lib/**', 'src/data/**'],
      exclude: ['src/components/**', 'src/App.jsx', 'src/main.jsx'],
    },
  },
  server: {
    host: true,
    port: 5173,
    allowedHosts: true,
  },
})
