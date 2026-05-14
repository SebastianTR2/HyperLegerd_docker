import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Proxy `/api` → api-middleware (mismo patrón que web-cliente-demo).
 * Backend en WSL: VITE_API_TARGET=http://172.x.x.x:3000
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget =
    env.VITE_API_TARGET ||
    process.env.VITE_API_TARGET ||
    'http://127.0.0.1:3000'

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
  }
})
