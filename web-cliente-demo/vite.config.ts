import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

function resolveProxyTarget(raw: string | undefined, defaultPort: string): string {
  let s = (raw ?? "").trim();
  if (!s) return `http://127.0.0.1:${defaultPort}`;
  if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return `http://127.0.0.1:${defaultPort}`;
  }
  if (u.hostname.startsWith("169.254.")) {
    console.warn(
      `[Vite proxy] dirección APIPA descartada. Usa http://127.0.0.1:${defaultPort}`,
    );
    return `http://127.0.0.1:${defaultPort}`;
  }
  if (!u.port && (u.protocol === "http:" || u.protocol === "https:")) {
    u.port = defaultPort;
  }
  return u.toString().replace(/\/+$/, "");
}

/**
 * Proxy:
 *   `/api/*` → BFF web-portal-api (default :3001). El BFF maneja:
 *       /admin/auth/{login,me,logout}
 *       /admin/api/*  (proxy a api-middleware con JWT + X-API-Key)
 *
 * Configurable por:
 *   - VITE_BFF_TARGET (preferido): http://127.0.0.1:3001
 *   - VITE_API_TARGET (legacy): para retrocompatibilidad con scripts viejos.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const bffTarget = resolveProxyTarget(
    env.VITE_BFF_TARGET ||
      process.env.VITE_BFF_TARGET ||
      env.VITE_API_TARGET ||
      process.env.VITE_API_TARGET,
    "3001",
  );

  console.log(`[Vite proxy] /api -> ${bffTarget}`);

  const proxy = {
    "/api": {
      target: bffTarget,
      changeOrigin: true,
      rewrite: (p: string) => p.replace(/^\/api/, ""),
    },
  };

  return {
    plugins: [react()],
    server: { port: 5173, proxy },
    preview: { port: 5173, proxy },
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: "./src/test/setup.ts",
    },
  };
});
