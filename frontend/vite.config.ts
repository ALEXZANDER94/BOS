import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Production builds write directly into the backend's static file folder.
    // ASP.NET Core will then serve these files from wwwroot.
    outDir: '../backend/wwwroot',
    emptyOutDir: true,
  },
  server: {
    // In development, Vite's hot-reload server proxies all /api requests to the
    // ASP.NET Core backend running on port 5000. This means frontend code can
    // always use relative paths like '/api/glossary' regardless of environment.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
