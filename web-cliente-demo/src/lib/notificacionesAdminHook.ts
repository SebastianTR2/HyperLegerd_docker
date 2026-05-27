import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchHistorialNotificacionesAdmin,
  streamNotificacionesAdmin,
  type NotificacionAdmin,
  type StreamHandle,
} from '../services/apiNotificacionesAdmin'

export type EstadoStream = 'inactivo' | 'conectando' | 'conectado' | 'error'

interface UseNotificacionesArgs {
  /** Habilita la conexión. Cuando es false, se desconecta. */
  activo: boolean
  /** Callback opcional al recibir una notificación nueva (p. ej. toast). */
  onNueva?: (n: NotificacionAdmin) => void
}

interface UseNotificacionesResult {
  items: NotificacionAdmin[]
  estado: EstadoStream
  errorMensaje: string | null
  /** Indica que el usuario no ha visto las nuevas (badge). */
  noLeidas: number
  marcarLeidas: () => void
  /** Reintentar conexión manualmente. */
  reintentar: () => void
}

const MAX_HISTORIAL = 100

/**
 * useNotificacionesAdmin abre el stream SSE y mantiene una lista en memoria
 * con los eventos recibidos. No persiste (al recargar se pierde).
 *
 * Sólo conecta cuando `activo === true`. El llamador es responsable de
 * pasarle true únicamente cuando el rol sea admin.
 */
export function useNotificacionesAdmin({ activo, onNueva }: UseNotificacionesArgs): UseNotificacionesResult {
  const [items, setItems] = useState<NotificacionAdmin[]>([])
  const [estado, setEstado] = useState<EstadoStream>('inactivo')
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null)
  const [noLeidas, setNoLeidas] = useState(0)
  const [generacion, setGeneracion] = useState(0)

  const onNuevaRef = useRef(onNueva)
  useEffect(() => {
    onNuevaRef.current = onNueva
  }, [onNueva])

  const marcarLeidas = useCallback(() => setNoLeidas(0), [])
  const reintentar = useCallback(() => setGeneracion((g) => g + 1), [])

  useEffect(() => {
    if (!activo) {
      setEstado('inactivo')
      setErrorMensaje(null)
      return
    }

    let handle: StreamHandle | null = null
    let cancelado = false
    setEstado('conectando')
    setErrorMensaje(null)

    void (async () => {
      try {
        const hist = await fetchHistorialNotificacionesAdmin()
        if (cancelado) return
        setItems(hist.items ?? [])
      } catch {
        if (cancelado) return
        setItems([])
      }

      handle = streamNotificacionesAdmin({
        onConectado: () => {
          if (cancelado) return
          setEstado('conectado')
          setErrorMensaje(null)
        },
        onNotificacion: (n) => {
          if (cancelado) return
          setItems((prev) => {
            if (prev.some((p) => p.id === n.id)) return prev
            const nuevo = [n, ...prev]
            if (nuevo.length > MAX_HISTORIAL) nuevo.length = MAX_HISTORIAL
            return nuevo
          })
          setNoLeidas((c) => c + 1)
          onNuevaRef.current?.(n)
        },
        onError: (e) => {
          if (cancelado) return
          setEstado('error')
          setErrorMensaje(e instanceof Error ? e.message : 'No se pudo conectar al stream')
        },
      })
    })()

    return () => {
      cancelado = true
      handle?.cerrar()
    }
  }, [activo, generacion])

  return { items, estado, errorMensaje, noLeidas, marcarLeidas, reintentar }
}
