// Cliente del feed de notificaciones admin que expone el api-middleware
// (ver docs/notificaciones-admin.md). Usamos fetch + ReadableStream para
// poder enviar la X-API-Key como header; EventSource no permite headers
// custom y nuestro middleware exige X-API-Key con rol admin.

import { API_PREFIX, ApiHttpError, apiJson } from './apiClient'
import { leerTokenSesion } from '../context/AuthContext'

/** Estructura entregada por el middleware en cada notificación. */
export interface NotificacionAdmin {
  id: string
  timestamp: string
  tenant: string
  tipo: string
  recurso?: string
  actorRol?: string
  actorId?: string
  actorNombre?: string
  txId?: string
  resumen: string
  metadata?: Record<string, unknown>
}

/** Respuesta del histórico GET /admin/notificaciones */
export interface HistorialNotificacionesAdmin {
  ok: boolean
  tenant: string
  total: number
  items: NotificacionAdmin[]
}

/** Obtiene el histórico in-memory más reciente para el tenant del solicitante. */
export async function fetchHistorialNotificacionesAdmin(): Promise<HistorialNotificacionesAdmin> {
  return apiJson<HistorialNotificacionesAdmin>('/admin/notificaciones', { method: 'GET' })
}

export interface StreamCallbacks {
  onNotificacion: (n: NotificacionAdmin) => void
  onConectado?: () => void
  onError?: (e: unknown) => void
}

export interface StreamHandle {
  /** Cierra el stream y libera el lector. */
  cerrar: () => void
}

/**
 * Abre una conexión SSE al endpoint /admin/notificaciones/stream. Si el rol
 * de la API key no es admin, el servidor devuelve 403 y onError se invoca
 * inmediatamente sin reintentar.
 *
 * Devuelve un handle para cerrar el stream desde el componente que lo abrió.
 */
export function streamNotificacionesAdmin(cb: StreamCallbacks): StreamHandle {
  const abort = new AbortController()
  let cerrado = false

  const cerrar = () => {
    if (cerrado) return
    cerrado = true
    abort.abort()
  }

  void (async () => {
    const jwt = leerTokenSesion()
    try {
      const res = await fetch(`${API_PREFIX}/admin/notificaciones/stream`, {
        method: 'GET',
        headers: {
          Accept: 'text/event-stream',
          ...(jwt ? { Authorization: `Bearer ${jwt}` } : {}),
        },
        signal: abort.signal,
      })
      if (!res.ok) {
        const texto = await res.text().catch(() => '')
        let payload: unknown = null
        try {
          payload = texto ? JSON.parse(texto) : null
        } catch {
          payload = null
        }
        throw new ApiHttpError(res.status, payload as never, `SSE rechazado (${res.status})`)
      }
      if (!res.body) {
        throw new Error('respuesta sin body para SSE')
      }
      cb.onConectado?.()
      await leerSSE(res.body.getReader(), cb)
    } catch (e) {
      if (cerrado) return
      cb.onError?.(e)
    }
  })()

  return { cerrar }
}

// Parser mínimo de SSE: separa por '\n\n' y procesa solo bloques con `data:`
// (y opcionalmente `event:`). Ignora comentarios (`:`) usados como keep-alive.
async function leerSSE(reader: ReadableStreamDefaultReader<Uint8Array>, cb: StreamCallbacks) {
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) return
    buffer += decoder.decode(value, { stream: true })

    let sep: number
    while ((sep = buffer.indexOf('\n\n')) !== -1) {
      const bloque = buffer.slice(0, sep)
      buffer = buffer.slice(sep + 2)
      const ev = parseBloqueSSE(bloque)
      if (!ev) continue
      // Solo procesamos los eventos `notificacion` (el servidor también envía
      // `status` al conectar y comentarios `:` cada 15 s como keep-alive).
      if (ev.evento && ev.evento !== 'notificacion') continue
      try {
        const n = JSON.parse(ev.data) as NotificacionAdmin
        cb.onNotificacion(n)
      } catch {
        /* ignora líneas que no sean JSON válido */
      }
    }
  }
}

function parseBloqueSSE(raw: string): { evento?: string; data: string } | null {
  let evento: string | undefined
  const dataLineas: string[] = []
  for (const linea of raw.split('\n')) {
    if (!linea || linea.startsWith(':')) continue
    if (linea.startsWith('event:')) {
      evento = linea.slice(6).trim()
    } else if (linea.startsWith('data:')) {
      dataLineas.push(linea.slice(5).trim())
    }
  }
  if (dataLineas.length === 0) return null
  return { evento, data: dataLineas.join('\n') }
}
