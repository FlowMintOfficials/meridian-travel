import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Relative base so the site can be deployed at the root, a subfolder, or
// GitHub Pages project path without a rebuild.
export default defineConfig({
  plugins: [react()],
  base: './',
})
