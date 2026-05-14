/** URL base del portal operativo (Gestión de Clientes). Configurable con VITE_PORTAL_CLIENTE_URL en .env */
export function getPortalClienteUrl(): string {
  const raw = import.meta.env.VITE_PORTAL_CLIENTE_URL?.trim()
  if (raw) return raw.replace(/\/$/, '')
  return 'http://localhost:5174'
}
