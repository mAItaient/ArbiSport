import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:4317',
        changeOrigin: true,
        // Un scan complet (11 sports × 2 providers) peut dépasser 60 s.
        // On laisse 2 min au backend avant de couper la requête.
        timeout: 120000,
        proxyTimeout: 120000,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
