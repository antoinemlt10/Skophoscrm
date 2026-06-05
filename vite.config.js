import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Minimal Vite config — React + fast refresh. Nothing exotic so it stays easy to maintain.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
})
