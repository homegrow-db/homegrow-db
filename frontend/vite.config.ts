import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/auth': 'http://localhost:8000',
      '/strains': 'http://localhost:8000',
      '/seeds': 'http://localhost:8000',
      '/grows': 'http://localhost:8000',
      '/search': 'http://localhost:8000',
      '/health': 'http://localhost:8000',
    },
  },
})
