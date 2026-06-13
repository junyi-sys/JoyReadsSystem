import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, type ChildProcess } from 'child_process'
import path from 'path'

function autoStartBackend(): Plugin {
  let backend: ChildProcess | null = null

  function cleanup() {
    if (backend && !backend.killed) {
      backend.kill()
      backend = null
    }
  }

  return {
    name: 'auto-start-backend',
    configureServer() {
      if (backend) return
      const python = path.resolve('..', 'backend', '.venv', 'Scripts', 'python.exe')
      backend = spawn(python, ['-m', 'uvicorn', 'app.main:app', '--host', '0.0.0.0', '--port', '8002'], {
        cwd: path.resolve('..', 'backend'),
        env: { ...process.env, APP_ENV: 'production' },
        stdio: 'pipe',
      })
      backend.stdout?.on('data', (d: Buffer) => process.stdout.write(`[be] ${d}`))
      backend.stderr?.on('data', (d: Buffer) => process.stderr.write(`[be] ${d}`))
      backend.on('error', (err) => {
        console.error(`[vite] backend failed to start: ${err.message}`)
        console.error('[vite] check: pip install -r ../backend/requirements.txt')
        backend = null
      })
      backend.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          console.error(`[vite] backend exited with code ${code} — check logs`)
        }
        backend = null
      })
      console.log('[vite] backend auto-started on :8002')
    },
    buildEnd() {
      cleanup()
    },
    closeBundle() {
      cleanup()
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
