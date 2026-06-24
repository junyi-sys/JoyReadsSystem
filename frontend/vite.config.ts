import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.VITE_PORT || '3002')
  const backendPort = parseInt(env.VITE_BACKEND_PORT || '8002')

  return {
    plugins: [react()],
    base: './',
    server: {
      host: '0.0.0.0',
      port,
      proxy: {
        '/api': { target: `http://localhost:${backendPort}`, changeOrigin: true },
        '/audio': { target: `http://localhost:${backendPort}`, changeOrigin: true },
      },
    },
  }
})
