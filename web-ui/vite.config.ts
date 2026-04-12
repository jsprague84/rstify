import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/',
  resolve: {
    alias: {
      'shared': path.resolve(__dirname, '../shared'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
      '/message': 'http://localhost:8080',
      '/application': 'http://localhost:8080',
      '/client': 'http://localhost:8080',
      '/user': 'http://localhost:8080',
      '/current': 'http://localhost:8080',
      '/stream': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
      '/version': 'http://localhost:8080',
      '/docs': 'http://localhost:8080',
    },
  },
  build: {
    outDir: 'dist',
  },
})
