import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Evita proxy a :80 (ECONNREFUSED) y APIPA 169.254.x.x mal copiada sin puerto 3000. */
function resolveApiProxyTarget(raw: string | undefined): string {
  let s = (raw ?? '').trim()
  if (!s) return 'http://127.0.0.1:3000'
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`
  let u: URL
  try {
    u = new URL(s)
  } catch {
    return 'http://127.0.0.1:3000'
  }
  if (u.hostname.startsWith('169.254.')) {
    console.warn(
      '[Vite proxy] VITE_API_TARGET usa 169.254.x.x (APIPA). En la misma máquina use http://127.0.0.1:3000',
    )
    return 'http://127.0.0.1:3000'
  }
  if (!u.port && (u.protocol === 'http:' || u.protocol === 'https:')) {
    u.port = '3000'
  }
  return u.toString().replace(/\/+$/, '')
}

/**
 * Proxy `/api` → api-middleware.
 * Misma máquina: `VITE_API_TARGET=http://127.0.0.1:3000` (siempre con puerto 3000).
 * Otra máquina / WSL: `http://IP:3000`
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget = resolveApiProxyTarget(
    env.VITE_API_TARGET || process.env.VITE_API_TARGET,
  )

  console.log(`[Vite proxy] /api -> ${apiTarget}`)

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
    preview: {
      port: 5174,
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ''),
        },
      },
    },
  }
})
