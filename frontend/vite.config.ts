import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../gateway/src/main/resources/static',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': 'http://localhost:8080',
      '/accounts': 'http://localhost:8080',
      '/transfers': 'http://localhost:8080',
      '/bills': 'http://localhost:8080',
      '/billpayments': 'http://localhost:8080',
      '/beneficiaries': 'http://localhost:8080',
      '/notifications': 'http://localhost:8080',
      '/admin': 'http://localhost:8080',
      '/gateway': 'http://localhost:8080',
    },
  },
})
