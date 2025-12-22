import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // GitHub Pages serves under /<repo>/; this is injected by the deploy workflow.
  base: process.env.BASE_PATH || '/',
  plugins: [react()],
  server: {
    host: process.env.CODESPACES ? true : '127.0.0.1',
    strictPort: true,
  },
  preview: {
    host: process.env.CODESPACES ? true : '127.0.0.1',
    strictPort: true,
  },
})
