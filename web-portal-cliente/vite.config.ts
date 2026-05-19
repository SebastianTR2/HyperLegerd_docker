import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

/** Proxy `/portal-api` → web-portal-api (BFF + JWT). */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const portalApiTarget =
    (env.VITE_PORTAL_API_TARGET || process.env.VITE_PORTAL_API_TARGET || 'http://127.0.0.1:3001')
      .trim()
      .replace(/\/+$/, '') || 'http://127.0.0.1:3001'

  console.log(`[Vite proxy] /portal-api -> ${portalApiTarget}`)

  const portalProxy = {
    target: portalApiTarget,
    changeOrigin: true,
    rewrite: (p: string) => p.replace(/^\/portal-api/, ''),
  }

  return {
    plugins: [react()],
    server: {
      port: 5174,
      proxy: {
        '/portal-api': portalProxy,
      },
    },
    preview: {
      port: 5174,
      proxy: {
        '/portal-api': portalProxy,
      },
    },
  }
})
