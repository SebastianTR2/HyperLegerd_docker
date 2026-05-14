import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultDemoState,
  loadDemoState,
  newEntityId,
  randomHexRef,
  saveDemoState,
} from '../lib/demoPersist'
import { describeApiError, isCredentialHttpError } from '../lib/apiErrorMessage'
import { loadApiClientesCache, saveApiClientesCache, upsertApiClienteCache as upsertApiClienteInList } from '../lib/apiClientesCache'
import { loadTraceEntries, saveTraceEntries } from '../lib/tracePersist'
import { listarClientesApi } from '../services/apiClientesLista'
import { useSettings } from './SettingsContext'
import type { ClienteApi, ClienteApiCacheRow } from '../types/api'
import type { DemoEvent, DemoEventType, TokenOperacion, TraceEntry } from '../types/demo'
import type { Registro, RegistroInput } from '../types/registro'

export type ToastVariant = 'success' | 'error' | 'info'

export interface ToastItem {
  id: string
  message: string
  variant: ToastVariant
}

interface EmitTokenPayload {
  cliente: string
  cantidad: number
  descripcion: string
  tipoToken: string
  fechaExpiracion: string
}

interface TransferTokenPayload {
  clienteOrigen: string
  clienteDestino: string
  cantidad: number
  descripcion: string
}

export interface ConsultaResult {
  ok: boolean
  mensaje: string
  registro?: Registro
  referencia?: string
}

interface DemoStoreValue {
  registros: Registro[]
  /** Clientes devueltos por GET /clientes (ledger). */
  clientesLedger: ClienteApi[]
  clientesLedgerLoading: boolean
  clientesLedgerError: string | null
  /** True cuando el fallo de GET /clientes es 401/403 (evita repetir el mismo aviso en rojo en toda la UI). */
  clientesLedgerAccessDenied: boolean
  refreshClientesLedger: () => Promise<void>
  /** Clientes vistos o dados de alta vía API (persistido aparte del mock demo). */
  apiClienteRows: ClienteApiCacheRow[]
  upsertApiClienteRow: (row: ClienteApiCacheRow) => void
  eventos: DemoEvent[]
  tokenOps: TokenOperacion[]
  traces: TraceEntry[]
  createRegistro: (input: RegistroInput) => Registro
  updateRegistro: (id: string, input: RegistroInput) => Registro
  deleteRegistro: (id: string) => void
  emitToken: (payload: EmitTokenPayload) => TokenOperacion
  transferToken: (payload: TransferTokenPayload) => TokenOperacion
  consultar: (query: string) => ConsultaResult
  /** Añade evento al historial (p. ej. respuesta API real). */
  mergeExternalEvent: (ev: Omit<DemoEvent, 'id' | 'fechaIso'> & { fechaIso?: string }) => void
  /** Añade operación token al listado (p. ej. txId real). */
  mergeExternalTokenOp: (op: TokenOperacion) => void
  pushTrace: (trace: Omit<TraceEntry, 'id' | 'createdAt'> & { createdAt?: string }) => TraceEntry
  toasts: ToastItem[]
  dismissToast: (id: string) => void
  showToast: (message: string, variant?: ToastVariant) => void
}

const DemoStoreContext = createContext<DemoStoreValue | null>(null)

function eventLabel(tipo: DemoEventType): string {
  const map: Record<DemoEventType, string> = {
    registro_creado: 'Cliente registrado correctamente',
    registro_editado: 'Cliente actualizado',
    registro_eliminado: 'Cliente dado de baja en la vista',
    token_emitido: 'Token emitido',
    token_transferido: 'Transferencia realizada',
    consulta: 'Consulta de cliente',
  }
  return map[tipo]
}

function appendEvent(prev: DemoEvent[], ev: Omit<DemoEvent, 'id' | 'fechaIso'> & { fechaIso?: string }): DemoEvent[] {
  const full: DemoEvent = {
    id: newEntityId('evt'),
    fechaIso: ev.fechaIso ?? new Date().toISOString(),
    tipo: ev.tipo,
    estado: ev.estado,
    titulo: ev.titulo,
    mensaje: ev.mensaje,
    referencia: ev.referencia,
  }
  return [full, ...prev].slice(0, 200)
}

export function DemoStoreProvider({ children }: { children: ReactNode }) {
  const { mode, apiKey } = useSettings()
  const boot = useRef(loadDemoState())
  const [registros, setRegistros] = useState<Registro[]>(() => boot.current.registros)
  const [eventos, setEventos] = useState<DemoEvent[]>(() => boot.current.eventos)
  const [tokenOps, setTokenOps] = useState<TokenOperacion[]>(() => boot.current.tokenOps)
  const [apiClienteRows, setApiClienteRows] = useState<ClienteApiCacheRow[]>(() => loadApiClientesCache())
  const [clientesLedger, setClientesLedger] = useState<ClienteApi[]>([])
  const [clientesLedgerLoading, setClientesLedgerLoading] = useState(false)
  const [clientesLedgerError, setClientesLedgerError] = useState<string | null>(null)
  const [clientesLedgerAccessDenied, setClientesLedgerAccessDenied] = useState(false)
  const [traces, setTraces] = useState<TraceEntry[]>(() => loadTraceEntries())
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const refreshClientesLedger = useCallback(async () => {
    setClientesLedgerLoading(true)
    setClientesLedgerError(null)
    setClientesLedgerAccessDenied(false)
    try {
      const list = await listarClientesApi()
      setClientesLedger(list)
    } catch (e) {
      setClientesLedger([])
      setClientesLedgerError(describeApiError(e))
      setClientesLedgerAccessDenied(isCredentialHttpError(e))
    } finally {
      setClientesLedgerLoading(false)
    }
  }, [])

  useEffect(() => {
    if (mode !== 'api') {
      setClientesLedger([])
      setClientesLedgerError(null)
      setClientesLedgerAccessDenied(false)
      return
    }
    if (!apiKey.trim()) {
      setClientesLedger([])
      setClientesLedgerError(null)
      setClientesLedgerAccessDenied(true)
      return
    }
    void refreshClientesLedger()
  }, [refreshClientesLedger, mode, apiKey])

  useEffect(() => {
    saveDemoState({ version: 2, registros, eventos, tokenOps })
  }, [registros, eventos, tokenOps])

  useEffect(() => {
    saveApiClientesCache(apiClienteRows)
  }, [apiClienteRows])

  useEffect(() => {
    saveTraceEntries(traces)
  }, [traces])

  const upsertApiClienteRow = useCallback((row: ClienteApiCacheRow) => {
    setApiClienteRows((list) => upsertApiClienteInList(list, row))
  }, [])

  const showToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = newEntityId('toast')
    setToasts((t) => [...t, { id, message, variant }])
    window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 4200)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const createRegistro = useCallback(
    (input: RegistroInput): Registro => {
      const ref = randomHexRef()
      const id = input.clienteId?.trim() || newEntityId('r')
      const fechaRegistro = input.fechaAlta?.trim()
        ? `${input.fechaAlta.trim()}T12:00:00.000Z`
        : new Date().toISOString()
      const { clienteId: _c, fechaAlta: _f, ...rest } = input
      const nuevo: Registro = {
        id,
        ...rest,
        fechaRegistro,
        referenciaTrazabilidad: ref,
      }
      setRegistros((list) => [nuevo, ...list])
      setEventos((e) =>
        appendEvent(e, {
          tipo: 'registro_creado',
          estado: 'exito',
          titulo: eventLabel('registro_creado'),
          mensaje: `${input.nombreCompleto} · ${input.tipoDocumento} ${input.documento}`,
          referencia: ref,
        }),
      )
      showToast('Registro guardado en el navegador. Use modo API para persistir en la red.', 'success')
      return nuevo
    },
    [showToast],
  )

  const updateRegistro = useCallback(
    (id: string, input: RegistroInput): Registro => {
      let actualizado: Registro | null = null
      const ref = randomHexRef()
      setRegistros((list) =>
        list.map((r) => {
          if (r.id !== id) return r
          const { clienteId: _cid, fechaAlta: _fa, ...restIn } = input
          actualizado = {
            ...r,
            ...restIn,
            id: r.id,
            fechaRegistro: r.fechaRegistro,
            referenciaTrazabilidad: ref,
          }
          return actualizado
        }),
      )
      if (!actualizado) throw new Error('Registro no encontrado')
      setEventos((e) =>
        appendEvent(e, {
          tipo: 'registro_editado',
          estado: 'exito',
          titulo: eventLabel('registro_editado'),
          mensaje: `${input.nombreCompleto} · ${input.tipoDocumento} ${input.documento}`,
          referencia: ref,
        }),
      )
      showToast('Cambios guardados en el navegador.', 'success')
      return actualizado
    },
    [showToast],
  )

  const deleteRegistro = useCallback(
    (id: string) => {
      let prev: Registro | undefined
      setRegistros((list) => {
        prev = list.find((r) => r.id === id)
        return list.filter((r) => r.id !== id)
      })
      const ref = randomHexRef()
      setEventos((e) =>
        appendEvent(e, {
          tipo: 'registro_eliminado',
          estado: 'exito',
          titulo: eventLabel('registro_eliminado'),
          mensaje: prev
            ? `Eliminado: ${prev.nombreCompleto} (${prev.tipoDocumento} ${prev.documento})`
            : 'Registro eliminado',
          referencia: ref,
        }),
      )
      showToast('Fila quitada de la vista. No elimina datos en blockchain.', 'info')
    },
    [showToast],
  )

  const emitToken = useCallback(
    (payload: EmitTokenPayload): TokenOperacion => {
      const ref = randomHexRef()
      const op: TokenOperacion = {
        id: newEntityId('tok'),
        tipo: 'emitir',
        clienteOrigen: payload.cliente,
        cantidad: payload.cantidad,
        descripcion: payload.descripcion,
        tipoToken: payload.tipoToken,
        fechaIso: new Date().toISOString(),
        referencia: ref,
        estado: 'exito',
      }
      setTokenOps((list) => [op, ...list].slice(0, 120))
      setEventos((e) =>
        appendEvent(e, {
          tipo: 'token_emitido',
          estado: 'exito',
          titulo: eventLabel('token_emitido'),
          mensaje: `${payload.cantidad} ${payload.tipoToken} · ${payload.cliente} · exp. ${payload.fechaExpiracion}`,
          referencia: ref,
        }),
      )
      showToast('Token emitido (registrado solo en este navegador).', 'success')
      return op
    },
    [showToast],
  )

  const transferToken = useCallback(
    (payload: TransferTokenPayload): TokenOperacion => {
      const ref = randomHexRef()
      const op: TokenOperacion = {
        id: newEntityId('tok'),
        tipo: 'transferir',
        clienteOrigen: payload.clienteOrigen,
        clienteDestino: payload.clienteDestino,
        cantidad: payload.cantidad,
        descripcion: payload.descripcion,
        tipoToken: 'TKN',
        fechaIso: new Date().toISOString(),
        referencia: ref,
        estado: 'exito',
      }
      setTokenOps((list) => [op, ...list].slice(0, 120))
      setEventos((e) =>
        appendEvent(e, {
          tipo: 'token_transferido',
          estado: 'exito',
          titulo: eventLabel('token_transferido'),
          mensaje: `${payload.cantidad} TKN · ${payload.clienteOrigen} → ${payload.clienteDestino}`,
          referencia: ref,
        }),
      )
      showToast('Transferencia registrada solo en este navegador.', 'success')
      return op
    },
    [showToast],
  )

  const mergeExternalEvent = useCallback((ev: Omit<DemoEvent, 'id' | 'fechaIso'> & { fechaIso?: string }) => {
    setEventos((e) => appendEvent(e, ev))
  }, [])

  const mergeExternalTokenOp = useCallback((op: TokenOperacion) => {
    setTokenOps((list) => [op, ...list].slice(0, 120))
  }, [])

  const pushTrace = useCallback((trace: Omit<TraceEntry, 'id' | 'createdAt'> & { createdAt?: string }) => {
    const full: TraceEntry = {
      ...trace,
      id: newEntityId('trz'),
      createdAt: trace.createdAt ?? new Date().toISOString(),
    }
    setTraces((list) => [full, ...list].slice(0, 300))
    return full
  }, [])

  const consultar = useCallback(
    (query: string): ConsultaResult => {
      const q = query.trim().toLowerCase()
      const refQuery = q.replace(/\s/g, '')
      let found: Registro | undefined
      if (q) {
        found = registros.find(
          (r) =>
            r.documento.toLowerCase() === q ||
            r.documento.toLowerCase().includes(q) ||
            (r.referenciaTrazabilidad &&
              r.referenciaTrazabilidad.toLowerCase().includes(refQuery)),
        )
      }
      const ref = randomHexRef()
      if (found) {
        setEventos((e) =>
          appendEvent(e, {
            tipo: 'consulta',
            estado: 'exito',
            titulo: eventLabel('consulta'),
            mensaje: `Coincidencia: ${found.nombreCompleto}`,
            referencia: found.referenciaTrazabilidad ?? ref,
          }),
        )
        showToast('Consulta completada.', 'success')
        return {
          ok: true,
          mensaje: 'Se encontró un registro coincidente.',
          registro: found,
          referencia: found.referenciaTrazabilidad ?? ref,
        }
      }
      setEventos((e) =>
        appendEvent(e, {
          tipo: 'consulta',
          estado: 'error',
          titulo: eventLabel('consulta'),
          mensaje: q ? 'Sin resultados para la búsqueda indicada.' : 'Consulta vacía',
          referencia: ref,
        }),
      )
      showToast(q ? 'Sin coincidencias en la tabla de esta ventana.' : 'Ingresa documento o referencia.', 'error')
      return {
        ok: false,
        mensaje: q ? 'No hay registros que coincidan con ese criterio.' : 'Escribe un documento o fragmento de referencia.',
        referencia: ref,
      }
    },
    [registros, showToast],
  )

  const value = useMemo(
    () => ({
      registros,
      clientesLedger,
      clientesLedgerLoading,
      clientesLedgerError,
      clientesLedgerAccessDenied,
      refreshClientesLedger,
      apiClienteRows,
      upsertApiClienteRow,
      eventos,
      tokenOps,
      traces,
      createRegistro,
      updateRegistro,
      deleteRegistro,
      emitToken,
      transferToken,
      consultar,
      mergeExternalEvent,
      mergeExternalTokenOp,
      pushTrace,
      toasts,
      dismissToast,
      showToast,
    }),
    [
      registros,
      clientesLedger,
      clientesLedgerLoading,
      clientesLedgerError,
      clientesLedgerAccessDenied,
      refreshClientesLedger,
      apiClienteRows,
      upsertApiClienteRow,
      eventos,
      tokenOps,
      traces,
      createRegistro,
      updateRegistro,
      deleteRegistro,
      emitToken,
      transferToken,
      consultar,
      mergeExternalEvent,
      mergeExternalTokenOp,
      pushTrace,
      toasts,
      dismissToast,
      showToast,
    ],
  )

  return <DemoStoreContext.Provider value={value}>{children}</DemoStoreContext.Provider>
}

export function useDemoStore(): DemoStoreValue {
  const ctx = useContext(DemoStoreContext)
  if (!ctx) throw new Error('useDemoStore debe usarse dentro de DemoStoreProvider')
  return ctx
}

/** Reinicia el estado guardado en el navegador (útil si se corrompe el almacenamiento). */
export function resetDemoLocalStorage(): void {
  const fresh = defaultDemoState()
  saveDemoState(fresh)
  window.location.reload()
}
