import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, type ChildProcess } from 'child_process'

function autoStartBackend(): any {
  let backend: ChildProcess | null = null

  return {
    name: 'auto-start-backend',
    configureServer() {
      if (backend) return
      const python = '../backend/.venv/Scripts/python.exe'
      backend = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8002'], {
        cwd: '../backend',
        env: { ...process.env, APP_ENV: 'production' },
        stdio: 'pipe',
      })
      backend.stdout?.on('data', (d: Buffer) => process.stdout.write(`[be] ${d}`))
      backend.stderr?.on('data', (d: Buffer) => process.stderr.write(`[be] ${d}`))
      backend.on('exit', (code) => { backend = null })
      console.log('[vite] backend auto-started on :8002')
    },
    closeBundle() {
      if (backend) {
        backend.kill()
        backend = null
      }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = parseInt(env.VITE_PORT || '3002')
  const backendPort = env.VITE_BACKEND_PORT || '8002'

  return {
    plugins: [react(), autoStartBackend()],
    base: './',
    server: {
      port,
      proxy: {
        '/api': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: true },
        '/audio': { target: `http://127.0.0.1:${backendPort}`, changeOrigin: true },
      },
    },
  }
})
