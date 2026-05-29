import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { fetchAuditoriaCombinada, type AuditoriaCombinadaDatos } from '../services/apiAuditoria'
import {
  fetchHistorialCliente,
  fetchLineaTiempoCliente,
  operacionesAVista,
  type HistorialFilaVista,
  type LineaTiempoRespuesta,
} from '../services/apiHistorialCliente'
import { fetchHistorialDato } from '../services/apiDatos'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import LoteProcesoPanel, { extraerPayloadLote } from '../components/LoteProcesoPanel'
import { parseClienteDatos } from '../lib/apiClienteAdapter'
import { clienteFilasLegibles, displayClienteField } from '../lib/clienteDisplay'
import { decodeIfBase64 } from '../lib/ledgerFieldDecode'
import { autorRolDisplayDesdeNotas } from '../lib/notasLedger'

// NUEVO: Datos de identidad para auditores (se inyectan por el backend) BORRAR DESPUES PARA ORG2
const USUARIOS_DETALLE: Record<string, { nombre: string, cargo: string, depto: string, matricula: string, bio: string }> = {
  "Encargado de Almacén": {
    nombre: "Personal de Almacén",
    cargo: "Responsable de Recepción y Registro",
    depto: "Logística y Almacenamiento",
    matricula: "USR-ALM-001",
    bio: "Encargado de dar de alta la materia prima y registrar el ingreso inicial al sistema de trazabilidad."
  },
  "Operador de Planta": {
    nombre: "Operador de Producción",
    cargo: "Técnico de Procesamiento",
    depto: "División de Manufactura",
    matricula: "USR-PLN-012",
    bio: "Responsable de iniciar el proceso de transformación y registrar el uso de maquinaria."
  },
  "Inspector de Calidad": {
    nombre: "Inspector QA/QC",
    cargo: "Analista de Control de Calidad",
    depto: "Gestión de Calidad",
    matricula: "USR-QA-055",
    bio: "Verificador de estándares técnicos y aprobación de lotes para su salida al mercado."
  },
  "Supervisor General": {
    nombre: "Director de Operaciones",
    cargo: "Supervisor de Cierre y Sellado",
    depto: "Alta Dirección / Supervisión",
    matricula: "USR-SUP-999",
    bio: "Autoridad máxima para el sellado criptográfico final y cierre inmutable del lote de producción."
  }
}

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink-secondary outline-none placeholder:text-muted focus:border-accent-soft focus:ring-2 focus:ring-accent/25'
const btn =
  'admin-btn-primary shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'
const btnGhost =
  'inline-flex items-center justify-center rounded-xl border border-line bg-gray-50 px-4 py-2 text-sm text-ink-secondary hover:bg-gray-50 disabled:opacity-50'
const btnChip =
  'rounded-lg border border-line bg-gray-50 px-2.5 py-1 text-xs text-ink-secondary hover:border-accent/30 hover:text-ink'

type FilaTabla = {
  id: string
  codigo: string
  nombre: string
  fecha: string
  estado: string
  bloque: string
  firma: string
  enlace: string
  autor: string
  cliente: any
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

/** Color del indicador en tabla según rol mostrado en «Autor / Rol». */
function colorIndicadorAutor(autor: string): string {
  const a = autor.toLowerCase()
  if (a.includes('admin') || a.includes('supervisor') || a.includes('carlos')) return 'bg-amber-400'
  if (a.includes('integrador') || a.includes('trabajador') || a.includes('operador') || a.includes('ana')) {
    return 'bg-indigo-400'
  }
  if (a.includes('lectura') || a.includes('auditor') || a.includes('pedro')) return 'bg-slate-400'
  return 'bg-slate-400'
}

function obtenerCambios(viejo: any, nuevo: any) {
  const cambios: Record<string, { anterior: any; nuevo: any }> = {}
  const todosLosCampos = new Set([...Object.keys(viejo || {}), ...Object.keys(nuevo || {})])

  todosLosCampos.forEach((campo) => {
    const vVal = viejo?.[campo]
    const nVal = nuevo?.[campo]
    if (vVal !== nVal) {
      cambios[campo] = { anterior: vVal, nuevo: nVal }
    }
  })
  return cambios
}

function filasDesdeDatos(d: AuditoriaCombinadaDatos, tenant: string): FilaTabla[] {
  const out: FilaTabla[] = []
  let n = 0
  const isAgricultura = tenant.trim().toLowerCase() === 'agricultura'

  // Procesamos ÚNICAMENTE eventos del Ledger (Blockchain)
  for (const ev of d.eventosCadena) {
    const payloadObj =
      ev.payload && typeof ev.payload === 'object' ? (ev.payload as Record<string, unknown>) : null
    const looksLikeDato =
      !!payloadObj &&
      (typeof payloadObj.datoId === 'string' ||
        (payloadObj.payload &&
          typeof payloadObj.payload === 'object' &&
          typeof (payloadObj.payload as Record<string, unknown>).codigo_trazabilidad === 'string'))
    const looksLikeCliente =
      !!payloadObj &&
      (typeof payloadObj.clienteId === 'string' ||
        typeof payloadObj.numeroDocumento === 'string' ||
        typeof payloadObj.tipoDocumento === 'string')
    if (isAgricultura && !looksLikeDato) continue
    if (!isAgricultura && !looksLikeCliente) continue
    n++
    let fullObj: any = {}
    let codigo = '—'
    let nombre = '—'
    let estado = '—'

    try {
      if (ev.payload) {
        fullObj = typeof ev.payload === 'string' ? JSON.parse(ev.payload) : ev.payload

        const parsed = parseClienteDatos(fullObj)
        if (parsed) {
          fullObj = parsed
          codigo = parsed.clienteId
          nombre = parsed.nombre
          estado = parsed.estado
        } else {
          const payload = fullObj.payload && typeof fullObj.payload === 'object' ? fullObj.payload : null
          codigo = str(
            fullObj.datoId ||
              fullObj.clientId ||
              fullObj.clienteId ||
              fullObj.id ||
              fullObj.codigo ||
              (payload && (payload.codigo_trazabilidad || payload.datoId)) ||
              '—',
          )
          nombre = str((payload && payload.nombre) || fullObj.nombre || fullObj.Nombre || fullObj.name || codigo || '—')
          estado = str((payload && payload.estado) || fullObj.estado || fullObj.Estado || fullObj.status || '—')
        }
      }
    } catch (err) {
      console.error("Error parseando payload de evento:", err)
    }

    const autor = autorRolDisplayDesdeNotas(
      typeof fullObj.notas === 'string' ? fullObj.notas : fullObj.notasLedger,
    )

    // Extraer firma digital de negocio si existe
    let firmaNegocio = ev.txId // Default a TXID
    if (fullObj.notas && typeof fullObj.notas === 'string' && fullObj.notas.includes('FIRMA:')) {
      const match = fullObj.notas.match(/FIRMA: (SIG-[a-f0-9]+)/)
      if (match) firmaNegocio = match[1]
    }

    out.push({
      id: `e-${n}`,
      codigo: decodeIfBase64(codigo),
      nombre: decodeIfBase64(nombre),
      fecha: ev.timestamp,
      estado: estado !== '—' ? estado : 'LEDGER_TX',
      bloque: String(ev.blockNumber),
      firma: firmaNegocio, // Usamos la firma de negocio
      enlace: (ev as any).blockHash || `sha256:blk-${ev.blockNumber}`,
      autor,
      cliente: fullObj,
    })
  }
  return out.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

function toCsv(rows: FilaTabla[]): string {
  const h = ['codigo', 'nombre', 'fecha', 'estado', 'bloque', 'firma_digital_txid', 'enlace_criptografico_hash']
  const esc = (s: string) => `"${String(s || '').replace(/"/g, '""')}"`
  const lines = [h.join(',')]
  for (const r of rows) {
    lines.push([r.codigo, r.nombre, r.fecha, r.estado, r.bloque, r.firma, r.enlace].map(esc).join(','))
  }
  return lines.join('\n')
}

function downloadText(filename: string, text: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** YYYY-MM-DD en UTC (calendario simple para filtros). */
function toYmdUtc(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Estado al llegar desde Centro de avisos → Ver detalles. */
export type AuditarLocationState = {
  recursoId?: string
  txId?: string
}

export default function AuditarPage() {
  const location = useLocation()
  const { mode, apiKey, tenant } = useSettings()
  const isAgricultura = tenant.trim().toLowerCase() === 'agricultura'
  const puedeConsultarApi = mode === 'api' && apiKey.trim().length > 0
  const [limite, setLimite] = useState(150)
  const [desdeDia, setDesdeDia] = useState('')
  const [hastaDia, setHastaDia] = useState('')
  const [busquedaId, setBusquedaId] = useState('')
  const [busquedaTxId, setBusquedaTxId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<AuditoriaCombinadaDatos | null>(null)

  // --- Estado para Línea de Tiempo por Registro ---
  const [lineaTiempo, setLineaTiempo] = useState<LineaTiempoRespuesta | null>(null)
  const [historialOps, setHistorialOps] = useState<HistorialFilaVista[]>([])
  const [lotePayloadsLT, setLotePayloadsLT] = useState<Array<Record<string, unknown> | null>>([])
  const [lineaLoading, setLineaLoading] = useState(false)
  const [lineaError, setLineaError] = useState<string | null>(null)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [selectedAccionIdx, setSelectedAccionIdx] = useState<number | null>(null)
  const [selectedUsuario, setSelectedUsuario] = useState<string | null>(null)

  const buscarLineaTiempo = useCallback(async (idOverride?: string) => {
    const id = (idOverride ?? busquedaId).trim()
    if (!id) return
    if (idOverride) setBusquedaId(id)
    setLineaLoading(true)
    setLineaError(null)
    setLineaTiempo(null)
    setHistorialOps([])
    setLotePayloadsLT([])
    setSelectedAccionIdx(null)
    try {
      if (isAgricultura) {
        const hist = await fetchHistorialDato(id)
        const raw = Array.isArray(hist.datos) ? hist.datos : []
        const combinado = raw
          .map((op: any) => {
            const rec = parseDatoDatos(op?.record)
            return {
              fila: {
                txId: String(op?.txId ?? ''),
                timestamp: String(op?.timestamp ?? ''),
                isDelete: Boolean(op?.isDelete),
                resumen: rec ? `${rec.nombre} (${rec.estado})` : op?.isDelete ? 'Baja / borrado lógico' : 'Sin registro',
                cliente: rec,
              } satisfies HistorialFilaVista,
              payload: extraerPayloadLote(op?.record),
            }
          })
          .filter((x) => x.fila.txId)
          .sort((a, b) => new Date(a.fila.timestamp).getTime() - new Date(b.fila.timestamp).getTime())
        const ops: HistorialFilaVista[] = combinado.map((x) => x.fila)

        const acciones = ops.map((op, idx) => ({
          tipo: idx === 0 ? ('creado' as const) : op.isDelete ? ('baja' as const) : ('editado' as const),
          etiqueta: idx === 0 ? 'Creado' : op.isDelete ? 'Baja' : `Edición #${idx}`,
          fecha: op.timestamp,
          txId: op.txId,
        }))
        setLineaTiempo({ ok: true, clienteId: id, acciones })
        setHistorialOps(ops)
        setLotePayloadsLT(combinado.map((x) => x.payload))
      } else {
        const [lt, hist] = await Promise.all([fetchLineaTiempoCliente(id), fetchHistorialCliente(id)])
        setLineaTiempo(lt)
        setHistorialOps(operacionesAVista(hist))
        setLotePayloadsLT([])
      }
    } catch (e) {
      setLineaError(describeApiError(e))
    } finally {
      setLineaLoading(false)
    }
  }, [busquedaId, isAgricultura])

  const navegacionProcesada = useRef<string | null>(null)
  useEffect(() => {
    const st = location.state as AuditarLocationState | null
    const id = st?.recursoId?.trim()
    if (!id || !puedeConsultarApi) return
    const clave = `${location.key}:${id}`
    if (navegacionProcesada.current === clave) return
    navegacionProcesada.current = clave
    if (st?.txId?.trim()) setBusquedaTxId(st.txId.trim())
    void buscarLineaTiempo(id)
  }, [location.key, location.state, puedeConsultarApi, buscarLineaTiempo])

  const load = useCallback(async () => {
    if (!puedeConsultarApi) {
      setError('En modo API hace falta una X-API-Key guardada en Credenciales.')
      setDatos(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const d = await fetchAuditoriaCombinada(limite, desdeDia.trim(), hastaDia.trim())
      setDatos(d)
    } catch (e) {
      setError(describeApiError(e))
      setDatos(null)
    } finally {
      setLoading(false)
    }
  }, [limite, desdeDia, hastaDia, puedeConsultarApi])

  const filas = useMemo(() => {
    let list = datos ? filasDesdeDatos(datos, tenant) : []
    // Excluir entidades del legado "borradores" (claves _DRAFT y _REV_N).
    list = list.filter((r) => {
      const c = (r.codigo || '').toUpperCase()
      return !c.endsWith('_DRAFT') && !/_REV_\d+$/.test(c)
    })
    if (busquedaId.trim()) {
      const q = busquedaId.toLowerCase().trim()
      list = list.filter(r => r.codigo.toLowerCase().includes(q))
    }
    if (busquedaTxId.trim()) {
      const q = busquedaTxId.toLowerCase().trim()
      list = list.filter(r => r.firma.toLowerCase().includes(q))
    }
    return list
  }, [datos, busquedaId, busquedaTxId, tenant])

  // Agrupación: 1 fila por clienteId. Cada grupo recuerda en qué índices
  // del array plano `filas` están sus eventos para poder reabrir el modal
  // de detalle (que usa `selectedIdx`).
  type GrupoCliente = {
    codigo: string
    nombre: string
    fechaUltima: string
    autorUltimo: string
    estadoUltimo: string
    eventos: Array<{ fila: FilaTabla; idxPlano: number }>
  }

  const grupos = useMemo<GrupoCliente[]>(() => {
    const map = new Map<string, GrupoCliente>()
    filas.forEach((fila, idx) => {
      const key = fila.codigo || '—'
      const ev = { fila, idxPlano: idx }
      const g = map.get(key)
      if (!g) {
        map.set(key, {
          codigo: key,
          nombre: fila.nombre,
          fechaUltima: fila.fecha,
          autorUltimo: fila.autor,
          estadoUltimo: fila.estado,
          eventos: [ev],
        })
      } else {
        g.eventos.push(ev)
        if (new Date(fila.fecha).getTime() > new Date(g.fechaUltima).getTime()) {
          g.fechaUltima = fila.fecha
          g.autorUltimo = fila.autor
          g.estadoUltimo = fila.estado
          g.nombre = fila.nombre
        }
      }
    })
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.fechaUltima).getTime() - new Date(a.fechaUltima).getTime(),
    )
  }, [filas])

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const toggleExpandido = useCallback((codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        next.delete(codigo)
      } else {
        next.add(codigo)
      }
      return next
    })
  }, [])

  const onCopiar = (texto: string) => {
    navigator.clipboard.writeText(texto)
    // Podríamos añadir un toast aquí, pero por simplicidad usaremos un console log
    console.log("Copiado:", texto)
  }

  const onExportJson = () => {
    if (!datos) return
    downloadText(`auditoria-${Date.now()}.json`, JSON.stringify(datos, null, 2), 'application/json')
  }

  const onExportCsv = () => {
    if (!filas.length) return
    downloadText(`auditoria-${Date.now()}.csv`, toCsv(filas), 'text/csv;charset=utf-8')
  }

  const presetRango = (dias: number) => {
    const fin = new Date()
    const ini = new Date(Date.now() - dias * 86400000)
    setDesdeDia(toYmdUtc(ini))
    setHastaDia(toYmdUtc(fin))
  }

  const presetHoy = () => {
    const t = toYmdUtc(new Date())
    setDesdeDia(t)
    setHastaDia(t)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div>
        <h1 className="text-lg font-semibold text-ink">Auditar</h1>
        <p className="mt-1 text-sm text-muted">
          Bitácora del puente HTTP más eventos del ledger. Busca por ID para ver la línea de tiempo completa.
        </p>
      </div>

      {!puedeConsultarApi ? (
        <div className="rounded-xl border admin-alert-warning">
          <p>
            {mode !== 'api'
              ? 'Pasá a modo «Red / API» en Credenciales para consultar el middleware.'
              : 'No hay X-API-Key guardada. Sin esa cabecera el backend responde 401 y la consola muestra CREDENCIAL_AUSENTE.'}
          </p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/credenciales">
            Abrir Credenciales
          </Link>
        </div>
      ) : null}

      <div className="admin-card p-4 shadow-card">
        <p className="mb-3 text-xs text-muted">
          Elegí fechas con el calendario (formato <span className="font-mono text-muted">YYYY-MM-DD</span>). El servidor interpreta el día completo en UTC.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className={btnChip} onClick={presetHoy}>
            Hoy
          </button>
          <button type="button" className={btnChip} onClick={() => presetRango(7)}>
            Últimos 7 días
          </button>
          <button type="button" className={btnChip} onClick={() => presetRango(30)}>
            Últimos 30 días
          </button>
          <button
            type="button"
            className={btnChip}
            onClick={() => {
              setDesdeDia('')
              setHastaDia('')
            }}
          >
            Limpiar fechas
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-semibold uppercase tracking-wider text-muted">Límite (1–1000)</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value))}
              placeholder="150"
              className={input}
            />
          </div>
          <label className="text-xs text-muted">
            Desde (día)
            <input type="date" className={`${input} mt-1`} value={desdeDia} onChange={(e) => setDesdeDia(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Hasta (día)
            <input type="date" className={`${input} mt-1`} value={hastaDia} onChange={(e) => setHastaDia(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Buscar por ID
            <input
              type="text"
              className={`${input} mt-1 border-accent/40 focus:border-accent`}
              placeholder={isAgricultura ? 'Ej: AGRO-TEST-001' : 'Ej: CLI100'}
              value={busquedaId}
              onChange={(e) => {
                setBusquedaId(e.target.value)
                // Limpia la línea de tiempo al cambiar el ID para no mostrar datos obsoletos
                setLineaTiempo(null)
                setLineaError(null)
              }}
              onKeyDown={(e) => e.key === 'Enter' && void buscarLineaTiempo()}
            />
          </label>
          <label className="text-xs text-muted">
            Buscar por Firma Digital (TXID)
            <input
              type="text"
              className={`${input} mt-1 border-accent/40 focus:border-accent`}
              placeholder="Pegar TXID aquí..."
              value={busquedaTxId}
              onChange={(e) => setBusquedaTxId(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className={btn} disabled={loading || !puedeConsultarApi} onClick={() => void load()}>
              {loading ? 'Cargando…' : 'Consultar'}
            </button>
            <button
              type="button"
              className={`${btnGhost} border-accent/40 text-accent hover:border-accent`}
              disabled={lineaLoading || !busquedaId.trim() || !puedeConsultarApi}
              onClick={() => void buscarLineaTiempo()}
              title={`Ver línea de tiempo del registro: ${busquedaId}`}
            >
              {lineaLoading ? 'Buscando…' : '⏱ Ver Historial'}
            </button>
            <button type="button" className={btnGhost} disabled={!datos} onClick={onExportJson}>
              Exportar JSON
            </button>
            <button type="button" className={btnGhost} disabled={!filas.length} onClick={onExportCsv}>
              Exportar CSV
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger-ink">
          <p>{error}</p>
          {error.includes('401') || error.includes('403') ? (
            <p className="mt-2 text-xs text-muted">Revise X-API-Key y rol en Credenciales.</p>
          ) : null}
        </div>
      ) : null}

      {/* Panel de resultados: Línea de Tiempo del registro buscado */}
      {(lineaError || lineaTiempo) && (
        <div className="rounded-2xl border border-accent/20 bg-surface p-5 shadow-card animate-in fade-in duration-200">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-accent">Línea de Tiempo del Registro</h2>
              {lineaTiempo && (
                <p className="mt-0.5 text-xs text-muted">
                  <span className="font-mono text-ink-secondary">{lineaTiempo.clienteId}</span>
                  <span className="ml-2">— {lineaTiempo.acciones.length} acción(es)</span>
                </p>
              )}
            </div>
            <button
              className="text-[10px] text-muted hover:text-ink-secondary transition-colors"
              onClick={() => { setLineaTiempo(null); setLineaError(null) }}
            >
              ✕ Cerrar
            </button>
          </div>

          {lineaError && (
            <p className="rounded-md border border-danger/30 bg-danger-soft px-4 py-2 text-xs text-danger-ink">{lineaError}</p>
          )}

          {lineaTiempo && lineaTiempo.acciones.length === 0 && (
            <p className="text-xs text-muted italic">No se encontraron acciones para este registro.</p>
          )}

          {lineaTiempo && lineaTiempo.acciones.length > 0 && (
            <div className="space-y-4">
              {/* ── Nivel 1: Chips principales con flechas de orden ── */}
              <div className="flex flex-wrap items-center gap-2">
                {lineaTiempo.acciones.map((acc, i) => {
                  const isSelected = selectedAccionIdx === i
                  return (
                    <div key={`${acc.txId}-${i}`} className="flex items-center gap-2">
                      {i > 0 && (
                        <svg className="h-4 w-4 flex-shrink-0 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                        </svg>
                      )}
                      <button
                        onClick={() => {
                          setSelectedAccionIdx(isSelected ? null : i)
                        }}
                        className={`relative flex items-start gap-3 rounded-xl border p-3 shadow-sm min-w-[180px] text-left transition-all hover:scale-[1.02] ${
                          isSelected
                            ? acc.tipo === 'creado' ? 'border-emerald-500 bg-emerald-500/15 ring-1 ring-emerald-500/50'
                              : acc.tipo === 'baja' ? 'border-rose-500 bg-rose-500/15 ring-1 ring-rose-500/50'
                              : 'border-sky-500 bg-sky-500/15 ring-1 ring-sky-500/50'
                            : acc.tipo === 'creado' ? 'border-emerald-500/30 bg-emerald-500/5'
                              : acc.tipo === 'baja' ? 'border-rose-500/30 bg-rose-500/5'
                              : 'border-sky-500/30 bg-sky-500/5'
                        }`}
                      >
                        <span className="absolute -top-2 -left-2 flex h-5 w-5 items-center justify-center rounded-full bg-slate-700 text-[9px] font-bold text-ink-secondary ring-1 ring-slate-600">
                          {i + 1}
                        </span>
                        <div className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sm ${
                          acc.tipo === 'creado' ? 'bg-emerald-500/20 text-emerald-400'
                          : acc.tipo === 'baja' ? 'bg-rose-500/20 text-rose-400'
                          : 'bg-sky-500/20 text-sky-400'
                        }`}>
                          {acc.tipo === 'creado' ? '★' : acc.tipo === 'baja' ? '✖' : '✎'}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold uppercase tracking-wide ${
                            acc.tipo === 'creado' ? 'text-emerald-400'
                            : acc.tipo === 'baja' ? 'text-rose-400'
                            : 'text-sky-400'
                          }`}>{acc.etiqueta}</p>
                          <p className="mt-0.5 text-[10px] text-muted">{formatDemoDateTime(acc.fecha)}</p>
                          <p className="mt-1 font-mono text-[9px] text-muted">{acc.txId.slice(0, 14)}…</p>
                        </div>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* UNIFIED GIT-STYLE AUDIT DASHBOARD */}
      {selectedAccionIdx !== null && lineaTiempo?.acciones[selectedAccionIdx] && (() => {
        const selectedAcc = lineaTiempo.acciones[selectedAccionIdx]
        const opActual = historialOps[selectedAccionIdx]
        const opAnterior = selectedAccionIdx > 0 ? historialOps[selectedAccionIdx - 1] : null
        const campos = clienteFilasLegibles(opActual?.cliente).map((r) => r.key)

        const selectedAutor = autorRolDisplayDesdeNotas(opActual?.cliente ?? undefined)

        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setSelectedAccionIdx(null)}
          >
            <div
              className="w-full max-w-5xl h-[85vh] rounded-md border border-line bg-surface shadow-card-md animate-in zoom-in-95 duration-200 flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Navbar */}
              <div className="flex items-center justify-between border-b border-line bg-[#16192b] px-6 py-4">
                <div>
                  <h2 className="text-sm font-bold text-ink flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded bg-sky-500/20 text-xs text-sky-400 font-sans">✎</span>
                    Panel de Auditoría de Blockchain — Control de Revisiones
                  </h2>
                  <p className="text-[10px] text-muted mt-0.5">Código de Registro: <span className="font-mono text-ink-secondary font-bold">{lineaTiempo.clienteId}</span></p>
                </div>
                <button
                  onClick={() => setSelectedAccionIdx(null)}
                  className="rounded-lg bg-gray-50 border border-line px-3.5 py-1.5 text-xs text-muted hover:text-ink-secondary transition-colors"
                >
                  Cerrar
                </button>
              </div>

              {/* Main Content Area: Split View */}
              <div className="flex flex-1 min-h-0 divide-x divide-line/30">
                {/* Left Column: Revisions Sidebar (vertical timeline) */}
                <div className="w-1/3 bg-[#16192b]/35 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-1">Línea de Tiempo del Registro</p>
                  
                  <div className="space-y-2">
                    {lineaTiempo.acciones.map((acc, idx) => {
                      const isSelected = selectedAccionIdx === idx
                      const opAct = historialOps[idx]
                      const opAnt = idx > 0 ? historialOps[idx - 1] : null
                      const countModificados = clienteFilasLegibles(opAct?.cliente).filter(
                        ({ key, value }) =>
                          opAnt !== null &&
                          String(
                            clienteFilasLegibles(opAnt?.cliente).find((r) => r.key === key)?.value ?? '',
                          ) !== String(value ?? ''),
                      ).length

                      return (
                        <button
                          key={`${acc.txId}-${idx}`}
                          onClick={() => setSelectedAccionIdx(idx)}
                          className={`w-full text-left p-3 rounded-xl border transition-all flex items-start gap-3 hover:scale-[1.01] ${
                            isSelected
                              ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/40'
                              : 'border-line/60 bg-gray-50 hover:border-line'
                          }`}
                        >
                          <div className={`mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                            acc.tipo === 'creado' ? 'bg-emerald-500/20 text-emerald-400'
                            : acc.tipo === 'baja' ? 'bg-rose-500/20 text-rose-400'
                            : 'bg-sky-500/20 text-sky-400'
                          }`}>
                            {acc.tipo === 'creado' ? '★' : acc.tipo === 'baja' ? '✖' : '✎'}
                          </div>
                          
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className={`text-xs font-bold ${
                                acc.tipo === 'creado' ? 'text-emerald-400'
                                : acc.tipo === 'baja' ? 'text-rose-400'
                                : 'text-sky-400'
                              }`}>
                                {acc.tipo === 'creado' ? 'Snap Original (Bloque)' : `Edición #${idx}`}
                              </span>
                              {acc.tipo === 'editado' && (
                                <span className="rounded bg-sky-500/20 px-1.5 py-0.2 font-mono text-[9px] text-sky-300 font-bold">
                                  {countModificados} campo{countModificados !== 1 ? 's' : ''}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-ink-secondary truncate mt-0.5">{formatDemoDateTime(acc.fecha)}</p>
                            <p className="text-[9px] text-muted font-mono truncate mt-1">Tx: {acc.txId.slice(0, 24)}…</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Right Column: Comparative attributes view */}
                <div className="w-2/3 flex flex-col bg-[#121420] overflow-hidden">
                  {/* Action Details Header */}
                  <div className="bg-[#16192b]/20 border-b border-line/30 p-4">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-400/80">Detalle de la Modificación</p>
                    <h3 className="text-xs font-bold text-ink mt-1 flex items-center gap-1.5">
                      {selectedAcc.tipo === 'creado' ? (
                        <span className="text-emerald-400 flex items-center gap-1">★ Snap Inmutable Inicial (Creación)</span>
                      ) : (
                        <span className="text-sky-400 flex items-center gap-1">✎ Bloque de Modificaciones #{selectedAccionIdx}</span>
                      )}
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-4 mt-3 text-[10px] text-muted bg-surface/20 p-2.5 rounded-lg border border-line/40">
                      <div>
                        <span className="text-muted block">Autor / Firma digital:</span>
                        <span className="text-ink-secondary font-medium">{selectedAutor}</span>
                      </div>
                      <div>
                        <span className="text-muted block">Fecha de Registro (Ledger):</span>
                        <span className="text-ink-secondary font-medium">{formatDemoDateTime(selectedAcc.fecha)}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-muted block">Enlace Criptográfico / TxID:</span>
                        <span className="text-ink-secondary font-mono block break-all">{selectedAcc.txId}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attributes Comparison Table */}
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    {isAgricultura && lotePayloadsLT[selectedAccionIdx] ? (
                      <div className="mb-4 rounded-xl border border-line/60 bg-surface/20 p-4">
                        <LoteProcesoPanel
                          datos={lotePayloadsLT[selectedAccionIdx]}
                          titulo="Proceso del lote en esta revisión"
                          compacto
                        />
                      </div>
                    ) : null}
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-line text-[10px] uppercase text-muted">
                          <th className="py-2.5 w-1/3">Atributo</th>
                          <th className="py-2.5">
                            {selectedAccionIdx === 0 ? 'Valor Registrado' : 'Estado Actual / Cambio'}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line/40">
                        {campos.length === 0 ? (
                          <tr>
                            <td colSpan={2} className="py-8 text-center text-muted italic">Sin datos registrados.</td>
                          </tr>
                        ) : (
                          campos.map((campo) => {
                            const valActual = opActual?.cliente?.[campo]
                            const valAnterior = opAnterior?.cliente?.[campo]
                            
                            const actualStr = displayClienteField(campo, valActual)
                            const anteriorStr = displayClienteField(campo, valAnterior)
                            
                            const cambió = opAnterior !== null && String(valAnterior ?? '') !== String(valActual ?? '')

                            return (
                              <tr key={campo} className={`transition-colors ${cambió ? 'bg-sky-500/5 hover:bg-sky-500/10' : 'hover:bg-surface/20'}`}>
                                <td className={`py-3 font-semibold ${cambió ? 'text-sky-400' : 'text-muted'}`}>
                                  {campo}
                                </td>
                                <td className="py-3">
                                  {cambió ? (
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded bg-rose-500/10 px-1.5 py-0.5 font-mono text-[10px] text-rose-300/80 line-through">
                                        {anteriorStr || '(vacío)'}
                                      </span>
                                      <span className="text-muted text-[10px]">→</span>
                                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 font-mono text-[10px] font-medium text-emerald-400">
                                        {actualStr || '(vacío)'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="font-mono text-ink-secondary">{actualStr || '—'}</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Table Legend */}
                  <div className="flex items-center justify-start border-t border-line px-6 py-3 bg-[#16192b]/10">
                    <div className="flex items-center gap-4 text-[10px] text-muted">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-rose-500/60"></div>
                        <span>Anterior</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
                        <span>Nuevo</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

      {datos ? (
        <p className="text-xs text-muted">
          HTTP: {datos.totalHttp} filas · Eventos cadena: {datos.totalEventos} · Registros con actividad: {grupos.length}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto admin-card shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-gray-50 text-xs uppercase text-muted backdrop-blur-sm">
            <tr>
              <th className="w-8 px-2 py-2"></th>
              <th className="px-3 py-2 font-medium">Código</th>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Última actividad</th>
              <th className="px-3 py-2 font-medium">Autor / Rol</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium text-center"># Cambios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {grupos.length === 0 && !loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">
                  Pulse Consultar para cargar la auditoría de Blockchain (Ledger).
                </td>
              </tr>
            ) : null}
            {grupos.map((g) => {
              const isOpen = expandidos.has(g.codigo)
              return (
                <Fragment key={g.codigo}>
                  <tr
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleExpandido(g.codigo)}
                  >
                    <td className="px-2 py-2 text-center text-muted">
                      <svg
                        className={`mx-auto h-4 w-4 transition-transform ${isOpen ? 'rotate-90' : ''}`}
                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                      </svg>
                    </td>
                    <td className="px-3 py-2 font-medium text-ink">{g.codigo}</td>
                    <td className="px-3 py-2 text-ink-secondary">{g.nombre}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-muted">{formatDemoDateTime(g.fechaUltima)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className={`h-1.5 w-1.5 rounded-full ${colorIndicadorAutor(g.autorUltimo)}`}></div>
                        <span className="text-[11px] font-medium text-ink-secondary">{g.autorUltimo}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${g.estadoUltimo.includes('ACTIVO') || g.estadoUltimo.includes('exito') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-muted'}`}>
                        {g.estadoUltimo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-full bg-accent/20 px-2 text-[10px] font-bold text-accent">
                        {g.eventos.length}
                      </span>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-0 py-0">
                        <div className="overflow-hidden border-t border-line">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                              <tr>
                                <th className="px-3 py-1.5 font-medium">Fecha</th>
                                <th className="px-3 py-1.5 font-medium text-center">Bloque</th>
                                <th className="px-3 py-1.5 font-medium">Autor / Rol</th>
                                <th className="px-3 py-1.5 font-medium">Estado</th>
                                <th className="px-3 py-1.5 font-medium">Firma digital (TxID)</th>
                                <th className="px-3 py-1.5 font-medium">Enlace criptográfico</th>
                                <th className="px-3 py-1.5 font-medium text-center">Acción</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-line/60">
                              {[...g.eventos]
                                .sort((a, b) => new Date(a.fila.fecha).getTime() - new Date(b.fila.fecha).getTime())
                                .map((ev, idxEnGrupo) => {
                                  const r = ev.fila
                                  const i = ev.idxPlano
                                  const etiquetaCambio = idxEnGrupo === 0 ? 'Creado' : `Edición #${idxEnGrupo}`
                                  return (
                                    <tr
                                      key={r.id}
                                      className={`hover:bg-gray-50 ${selectedIdx === i ? 'bg-accent/10' : ''}`}
                                    >
                                      <td className="whitespace-nowrap px-3 py-1.5 text-muted">
                                        <span className="mr-2 inline-block rounded bg-accent/10 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
                                          {etiquetaCambio}
                                        </span>
                                        {formatDemoDateTime(r.fecha)}
                                      </td>
                                      <td className="px-3 py-1.5 text-center">
                                        <span className="rounded bg-accent/20 px-1.5 py-0.5 font-mono text-[10px] text-accent">{r.bloque}</span>
                                      </td>
                                      <td className="px-3 py-1.5">
                                        <div className="flex items-center gap-1.5 group">
                                          <div className={`h-1.5 w-1.5 rounded-full ${colorIndicadorAutor(r.autor)}`}></div>
                                          <span className="text-[11px] font-medium text-ink-secondary">{r.autor}</span>
                                          {USUARIOS_DETALLE[r.autor] && (
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setSelectedUsuario(r.autor) }}
                                              className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-accent/10 p-1 text-accent hover:bg-accent hover:text-white"
                                              title="Ver credencial de identidad"
                                            >
                                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 012-2h2a2 2 0 012 2v1m-6 0h6" /></svg>
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-3 py-1.5">
                                        <span className={`rounded-lg px-2 py-0.5 text-[10px] font-bold uppercase ${r.estado.includes('ACTIVO') || r.estado.includes('exito') ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-muted'}`}>{r.estado}</span>
                                      </td>
                                      <td className="px-3 py-1.5 font-mono text-[10px] text-muted">
                                        <div className="flex items-center gap-2">
                                          <span>{r.firma.slice(0, 12)}…</span>
                                          <button onClick={(e) => { e.stopPropagation(); onCopiar(r.firma) }} className="rounded bg-surface p-1 hover:bg-accent/20 hover:text-accent transition-colors" title="Copiar firma">
                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-3 py-1.5 font-mono text-[10px] text-accent/80">
                                        <div className="flex items-center gap-2">
                                          <span>{r.enlace.slice(0, 16)}…</span>
                                          <button onClick={(e) => { e.stopPropagation(); onCopiar(r.enlace) }} className="rounded bg-surface p-1 hover:bg-accent/20 hover:text-accent transition-colors" title="Copiar enlace">
                                            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>
                                          </button>
                                        </div>
                                      </td>
                                      <td className="px-3 py-1.5 text-center">
                                        <button
                                          onClick={(e) => { e.stopPropagation(); setSelectedIdx(selectedIdx === i ? null : i) }}
                                          className="rounded-lg bg-accent/20 px-3 py-1 text-[10px] font-bold text-accent hover:bg-accent/30 transition-all uppercase"
                                        >
                                          {selectedIdx === i ? 'Cerrar' : 'Ver Detalle'}
                                        </button>
                                      </td>
                                    </tr>
                                  )
                                })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalle (Tarjeta Flotante con DIFF) */}
      {selectedIdx !== null && filas[selectedIdx] && (() => {
        const row = filas[selectedIdx]
        const indexAnterior = filas.findIndex((r, idx) => idx > selectedIdx && r.codigo === row.codigo)
        const rowAnterior = indexAnterior !== -1 ? filas[indexAnterior] : null

        const cambios = obtenerCambios(rowAnterior?.cliente, row.cliente)
        const campos = Object.keys(row.cliente || {})

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-2xl rounded-2xl border border-accent/30 bg-gray-50 p-6 shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="mb-4 flex items-center justify-between border-b border-line pb-4">
                <div>
                  <h3 className="text-sm font-semibold text-ink">
                    {rowAnterior ? 'Comparativa de Cambios' : 'Registro Inicial del Cliente'}
                  </h3>
                  <p className="text-[10px] text-muted font-mono truncate max-w-[300px]">{row.firma}</p>
                </div>
                <button onClick={() => setSelectedIdx(null)} className="rounded-lg bg-gray-50 px-3 py-1.5 text-xs text-ink-secondary hover:bg-gray-50 transition-colors">Cerrar</button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="space-y-4">
                  {isAgricultura && extraerPayloadLote(row.cliente) ? (
                    <div className="rounded-xl border border-line/60 bg-surface/20 p-4">
                      <LoteProcesoPanel datos={row.cliente} titulo="Proceso del lote en esta transacción" />
                    </div>
                  ) : null}
                  <div className="overflow-hidden rounded-xl border border-line bg-surface/20">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 text-[10px] uppercase text-muted">
                        <tr>
                          <th className="px-4 py-2 font-semibold">Campo</th>
                          <th className="px-4 py-2 font-semibold">Estado Actual / Cambio</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {campos.map((campo) => {
                          const cambio = cambios[campo]
                          return (
                            <tr key={campo} className="hover:bg-white/[0.02]">
                              <td className="px-4 py-2.5 font-medium text-muted">{campo}</td>
                              <td className="px-4 py-2.5">
                                {cambio ? (
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-400 line-through decoration-rose-500/50">
                                      {str(cambio.anterior) || '(vacío)'}
                                    </span>
                                    <span className="text-muted">→</span>
                                    <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-400 font-semibold">
                                      {str(cambio.nuevo) || '(vacío)'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-ink-secondary font-mono">{str(row.cliente[campo]) || '(vacío)'}</span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between">
                <div className="flex items-center gap-4 text-[10px]">
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-rose-500"></div> <span className="text-muted">Anterior</span></div>
                  <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-emerald-500"></div> <span className="text-muted">Nuevo</span></div>
                </div>
                <button onClick={() => setSelectedIdx(null)} className="btn-accent rounded-lg bg-accent px-6 py-2 text-xs font-bold text-white shadow-lg shadow-accent/20">Entendido</button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* MODAL DE IDENTIDAD DIGITAL (TARGET) */}
      {selectedUsuario && USUARIOS_DETALLE[selectedUsuario] && (() => {
        const user = USUARIOS_DETALLE[selectedUsuario]
        return (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-surface shadow-2xl animate-in zoom-in-95 duration-300">
              {/* Banner Decorativo */}
              <div className="h-24 bg-gradient-to-r from-accent to-accent-hover"></div>

              {/* Foto de Perfil */}
              <div className="absolute top-12 left-1/2 -translate-x-1/2">
                <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface bg-gray-50 shadow-xl">
                  <span className="text-3xl font-bold text-accent">{user.nombre.charAt(0)}</span>
                </div>
              </div>

              <div className="mt-16 px-8 pb-10 text-center">
                <h3 className="text-xl font-bold text-ink">{user.nombre}</h3>
                <p className="text-sm font-semibold text-accent">{user.cargo}</p>
                <p className="mt-1 text-xs text-muted">{user.depto}</p>

                <div className="mt-8 grid grid-cols-2 gap-4">
                  <div className="rounded-md bg-gray-50 p-4 border border-line">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Matrícula</p>
                    <p className="mt-1 font-mono text-sm font-bold text-ink-secondary">{user.matricula}</p>
                  </div>
                  <div className="rounded-md bg-gray-50 p-4 border border-line">
                    <p className="text-[10px] uppercase tracking-widest text-muted">Estado Red</p>
                    <p className="mt-1 text-sm font-bold text-emerald-400">Verificado ✅</p>
                  </div>
                </div>

                <div className="mt-6 text-left">
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-2">Biografía y Atribuciones</p>
                  <p className="text-xs leading-relaxed text-muted italic">"{user.bio}"</p>
                </div>

                <button
                  onClick={() => setSelectedUsuario(null)}
                  className="mt-8 w-full rounded-2xl bg-accent py-3 text-sm font-bold text-white shadow-lg shadow-accent/20 transition-all hover:scale-[1.02] active:scale-95"
                >
                  Cerrar Credencial
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
