import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  // Relative base works on Vercel (/) and GitHub Pages (/repo/)
  base: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,
  },
})
