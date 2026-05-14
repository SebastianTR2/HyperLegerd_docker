/** Etiqueta de negocio para mensajes de sesión (MVP). */
export function operadorDesdeApiKey(apiKey: string): string {
  const k = apiKey.trim()
  if (k === 'sec-admin') return 'Administrador'
  if (k === 'sec-int') return 'Integrador'
  if (k === 'sec-lect') return 'Solo lectura'
  if (!k) return 'Usuario'
  return 'Usuario'
}

export function esSoloLectura(apiKey: string): boolean {
  return apiKey.trim() === 'sec-lect'
}

export function puedeEscribir(apiKey: string): boolean {
  const k = apiKey.trim()
  return k === 'sec-admin' || k === 'sec-int'
}
