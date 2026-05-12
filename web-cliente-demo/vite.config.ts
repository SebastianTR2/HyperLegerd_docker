import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

/**
 * Proxy `/api` → backend (middleware Go).
 * En Windows + backend en WSL: use la IP del adaptador de WSL, p. ej.
 *   set VITE_API_TARGET=http://172.x.x.x:3000
 * El navegador sigue llamando solo a rutas relativas `/api/...`; el target solo lo usa el servidor de desarrollo de Vite.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget =
    env.VITE_API_TARGET ||
    process.env.VITE_API_TARGET ||
    "http://127.0.0.1:3000";

  console.log(`[Vite proxy] /api -> ${apiTarget}`);

  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api/, ""),
        },
      },
    },
  };
});
