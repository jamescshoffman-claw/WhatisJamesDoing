import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: { __BW_BUILD__: JSON.stringify(new Date().toISOString()) },
  base: '/',
  root: 'src',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})
