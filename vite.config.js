import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const configuredBasePath = globalThis.process?.env.VITE_BASE_PATH || '/G-tec/'
const basePath = configuredBasePath.startsWith('/') ? configuredBasePath : `/${configuredBasePath}`

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: basePath.endsWith('/') ? basePath : `${basePath}/`,
})
