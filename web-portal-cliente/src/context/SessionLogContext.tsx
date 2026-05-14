import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type SessionMessageVariant = 'success' | 'error'

export interface SessionMessage {
  id: string
  variant: SessionMessageVariant
  titulo: string
  detalle?: string
  referenciaTecnica?: string
  at: string
}

export type SessionActivityVariant = 'ok' | 'err' | 'info'

export interface SessionActivity {
  id: string
  variant: SessionActivityVariant
  texto: string
  at: string
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2, 9)}`
}

interface SessionLogValue {
  messages: SessionMessage[]
  activities: SessionActivity[]
  pushMessage: (m: Omit<SessionMessage, 'id' | 'at'> & { id?: string; at?: string }) => void
  pushActivity: (a: Omit<SessionActivity, 'id' | 'at'> & { id?: string; at?: string }) => void
  clear: () => void
}

const SessionLogContext = createContext<SessionLogValue | null>(null)

const MAX = 80

export function SessionLogProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<SessionMessage[]>([])
  const [activities, setActivities] = useState<SessionActivity[]>([])

  const pushMessage = useCallback((m: Omit<SessionMessage, 'id' | 'at'> & { id?: string; at?: string }) => {
    const full: SessionMessage = {
      id: m.id ?? newId(),
      variant: m.variant,
      titulo: m.titulo,
      detalle: m.detalle,
      referenciaTecnica: m.referenciaTecnica,
      at: m.at ?? new Date().toISOString(),
    }
    setMessages((prev) => [full, ...prev].slice(0, MAX))
  }, [])

  const pushActivity = useCallback((a: Omit<SessionActivity, 'id' | 'at'> & { id?: string; at?: string }) => {
    const full: SessionActivity = {
      id: a.id ?? newId(),
      variant: a.variant,
      texto: a.texto,
      at: a.at ?? new Date().toISOString(),
    }
    setActivities((prev) => [full, ...prev].slice(0, MAX))
  }, [])

  const clear = useCallback(() => {
    setMessages([])
    setActivities([])
  }, [])

  const value = useMemo(
    () => ({ messages, activities, pushMessage, pushActivity, clear }),
    [messages, activities, pushMessage, pushActivity, clear],
  )

  return <SessionLogContext.Provider value={value}>{children}</SessionLogContext.Provider>
}

export function useSessionLog(): SessionLogValue {
  const ctx = useContext(SessionLogContext)
  if (!ctx) throw new Error('useSessionLog requiere SessionLogProvider')
  return ctx
}

/** Registra alta exitosa en sesión (mensaje + actividad en lenguaje neutro, sin rol técnico). */
export function logRegistroClienteExitoso(log: SessionLogValue, clienteId: string, txId?: string): void {
  const id = clienteId.trim()
  log.pushMessage({
    variant: 'success',
    titulo: 'Cliente registrado correctamente.',
    detalle: id ? `Se registró el cliente ${id}.` : undefined,
    referenciaTecnica: txId?.trim() || undefined,
  })
  log.pushActivity({
    variant: 'ok',
    texto: id ? `Se registró el cliente ${id}.` : 'Se registró un cliente.',
  })
}

export function logConsultaCliente(log: SessionLogValue, encontrado: boolean, etiqueta: string): void {
  const id = etiqueta.trim()
  if (encontrado) {
    log.pushActivity({ variant: 'ok', texto: `Se consultó el cliente ${id}.` })
  } else {
    log.pushMessage({
      variant: 'error',
      titulo: 'Cliente no encontrado.',
      detalle: `No hay resultados para ${id}.`,
    })
    log.pushActivity({ variant: 'err', texto: `No se encontraron datos para el cliente ${id}.` })
  }
}

export function logClienteActualizado(log: SessionLogValue, clienteId: string): void {
  const id = clienteId.trim()
  if (id) log.pushActivity({ variant: 'ok', texto: `Se actualizó el cliente ${id}.` })
}

export function logClienteBaja(log: SessionLogValue, clienteId: string): void {
  const id = clienteId.trim()
  if (id) log.pushActivity({ variant: 'ok', texto: `Se dio de baja el cliente ${id}.` })
}

export function logErrorGuardar(log: SessionLogValue, detalleUsuario: string): void {
  log.pushMessage({ variant: 'error', titulo: detalleUsuario })
  log.pushActivity({ variant: 'err', texto: 'Error al guardar.' })
}

export function logAccionPendiente(log: SessionLogValue, accion: string): void {
  log.pushMessage({
    variant: 'error',
    titulo: 'Función pendiente de habilitación en el servicio.',
    detalle: accion,
  })
  log.pushActivity({ variant: 'info', texto: `Acción pendiente: ${accion}` })
}
