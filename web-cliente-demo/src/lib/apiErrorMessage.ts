import { ApiHttpError } from '../services/apiClient'

export function describeApiError(e: unknown): string {
  if (e instanceof ApiHttpError) {
    const code = e.payload?.codigo ? `${e.payload.codigo} · ` : ''
    const detail = e.payload?.mensaje ?? e.message
    if (
      e.status === 500 &&
      (!e.payload || !e.payload.mensaje?.trim()) &&
      (detail === 'HTTP 500' || detail === '')
    ) {
      return `${e.status} — El proxy no pudo hablar con el backend. Defina VITE_API_TARGET si el API está en otra máquina o en WSL (y reinicie npm run dev).`
    }
    return `${e.status} — ${code}${detail}`
  }
  if (e instanceof TypeError && typeof e.message === 'string' && /fetch|network|failed/i.test(e.message)) {
    return 'Sin conexión con el servidor. Compruebe el middleware y VITE_API_TARGET (p. ej. IP de WSL:3000) y que el proxy /api de Vite pueda alcanzarlo.'
  }
  if (e instanceof Error) {
    const m = e.message
    if (/ECONNREFUSED|ECONNRESET|ETIMEDOUT|failed to fetch|network/i.test(m)) {
      return 'No se pudo conectar al backend. Inicie el middleware, configure VITE_API_TARGET si aplica (WSL), reinicie npm run dev y recargue.'
    }
    return m
  }
  return 'Error desconocido'
}
