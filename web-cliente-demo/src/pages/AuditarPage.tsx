import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../context/SettingsContext'
import { describeApiError } from '../lib/apiErrorMessage'
import { formatDemoDateTime } from '../lib/format'
import { fetchAuditoriaCombinada, type AuditoriaCombinadaDatos } from '../services/apiAuditoria'

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm text-slate-200 outline-none placeholder:text-slate-500 focus:border-accent-soft focus:ring-2 focus:ring-accent/25'
const btn =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover disabled:opacity-50'
const btnGhost =
  'inline-flex items-center justify-center rounded-xl border border-line bg-surface/60 px-4 py-2 text-sm text-slate-200 hover:bg-elevated disabled:opacity-50'
const btnChip =
  'rounded-lg border border-line bg-surface/50 px-2.5 py-1 text-xs text-slate-300 hover:border-accent/30 hover:text-slate-100'

type FilaTabla = {
  id: string
  fecha: string
  tipo: string
  funcion: string
  estado: string
  txId: string
  operacionId: string
  detalle: string
}

function registroComoObjeto(reg: unknown): Record<string, unknown> {
  if (reg && typeof reg === 'object' && !Array.isArray(reg)) return reg as Record<string, unknown>
  return {}
}

function str(v: unknown): string {
  if (v === null || v === undefined) return ''
  return String(v)
}

function filasDesdeDatos(d: AuditoriaCombinadaDatos): FilaTabla[] {
  const out: FilaTabla[] = []
  let n = 0
  for (const line of d.httpPuente) {
    n++
    const r = registroComoObjeto(line.registro)
    const opId = str(r.operacionId)
    const ts = str(r.timestamp)
    const resumenTipo = line.tipoFuente
    let funcion = ''
    let txId = ''
    let estado = ''
    let detalle = ''
    if (line.prefijo.includes('CHAINCODE')) {
      funcion = str(r.funcion) + ' / ' + str(r.modo)
      txId = str(r.txId)
      estado = str(r.resultado) + (r.codigoNegocio ? ` (${str(r.codigoNegocio)})` : '')
      detalle = str(r.mensaje) || str(r.contrato) + ' · ' + str(r.canal)
    } else if (line.prefijo.includes('RESULTADO')) {
      funcion = str(r.ruta) + ' ' + str(r.metodo)
      estado = str(r.resultado) + ' HTTP ' + str(r.codigoHttp)
      detalle = str(r.detalle)
    } else if (line.prefijo.includes('SOLICITUD')) {
      funcion = str(r.ruta) + ' ' + str(r.metodo)
      estado = 'entrada'
      detalle = 'remoto=' + str(r.remoto)
    } else {
      funcion = line.prefijo
      estado = str(r.resultado) || str(r.categoria) || '—'
      detalle = str(r.mensaje) || str(r.error)
    }
    out.push({
      id: `h-${n}`,
      fecha: ts,
      tipo: resumenTipo,
      funcion,
      estado,
      txId,
      operacionId: opId,
      detalle: detalle.slice(0, 280),
    })
  }
  for (const ev of d.eventosCadena) {
    n++
    out.push({
      id: `e-${n}`,
      fecha: ev.timestamp,
      tipo: 'evento_ledger',
      funcion: ev.nombreEvento + ' @' + ev.contrato,
      estado: 'evento',
      txId: ev.txId,
      operacionId: '',
      detalle: 'bloque ' + String(ev.blockNumber),
    })
  }
  return out.sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime())
}

function toCsv(rows: FilaTabla[]): string {
  const h = ['fecha', 'tipo', 'funcion', 'estado', 'txId', 'operacionId', 'detalle']
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const lines = [h.join(',')]
  for (const r of rows) {
    lines.push([r.fecha, r.tipo, r.funcion, r.estado, r.txId, r.operacionId, r.detalle].map(esc).join(','))
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

export default function AuditarPage() {
  const { mode, apiKey } = useSettings()
  const puedeConsultarApi = mode === 'api' && apiKey.trim().length > 0
  const [limite, setLimite] = useState(150)
  const [desdeDia, setDesdeDia] = useState('')
  const [hastaDia, setHastaDia] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [datos, setDatos] = useState<AuditoriaCombinadaDatos | null>(null)

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

  const filas = useMemo(() => (datos ? filasDesdeDatos(datos) : []), [datos])

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
        <h1 className="text-lg font-semibold text-slate-100">Auditar</h1>
        <p className="mt-1 text-sm text-muted">
          Vista combinada: bitácora del puente HTTP (solicitud/resultado por <strong className="text-slate-300">operacionId</strong>
          , misma correlación que la cabecera <code className="rounded bg-surface px-1 font-mono text-xs">X-Operacion-Id</code>
          ) más eventos recientes de chaincode. Para solo ledger use también{' '}
          <code className="rounded bg-surface px-1 font-mono text-xs">GET /eventos/historial</code>.
        </p>
        {datos?.correlacionHint ? <p className="mt-2 text-xs text-muted">{datos.correlacionHint}</p> : null}
      </div>

      {!puedeConsultarApi ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
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

      <div className="rounded-2xl border border-line bg-elevated/90 p-4 shadow-card">
        <p className="mb-3 text-xs text-muted">
          Elegí fechas con el calendario (formato <span className="font-mono text-slate-400">YYYY-MM-DD</span>). El servidor interpreta el día completo en UTC.
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
          <label className="text-xs text-muted">
            Límite (1–500)
            <input
              type="number"
              min={1}
              max={500}
              className={`${input} mt-1`}
              value={limite}
              onChange={(e) => setLimite(Number(e.target.value) || 100)}
            />
          </label>
          <label className="text-xs text-muted">
            Desde (día)
            <input type="date" className={`${input} mt-1`} value={desdeDia} onChange={(e) => setDesdeDia(e.target.value)} />
          </label>
          <label className="text-xs text-muted">
            Hasta (día)
            <input type="date" className={`${input} mt-1`} value={hastaDia} onChange={(e) => setHastaDia(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button type="button" className={btn} disabled={loading || !puedeConsultarApi} onClick={() => void load()}>
              {loading ? 'Cargando…' : 'Consultar'}
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
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100/95">
          <p>{error}</p>
          {error.includes('401') || error.includes('403') ? (
            <p className="mt-2 text-xs text-muted">Revise X-API-Key y rol en Credenciales.</p>
          ) : null}
        </div>
      ) : null}

      {datos ? (
        <p className="text-xs text-muted">
          HTTP: {datos.totalHttp} filas · Eventos cadena: {datos.totalEventos} · Tabla unificada: {filas.length} filas
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto rounded-2xl border border-line bg-elevated/90 shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-surface/95 text-xs uppercase text-muted backdrop-blur-sm">
            <tr>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Tipo</th>
              <th className="px-3 py-2 font-medium">Operación / evento</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">txId</th>
              <th className="px-3 py-2 font-medium">operacionId</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {filas.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted">
                  Pulse Consultar para cargar la auditoría (requiere modo API).
                </td>
              </tr>
            ) : null}
            {filas.map((r) => (
              <tr key={r.id} className="hover:bg-surface/40">
                <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-300">{formatDemoDateTime(r.fecha)}</td>
                <td className="px-3 py-2 text-xs text-muted">{r.tipo}</td>
                <td className="max-w-[240px] px-3 py-2 text-xs text-slate-200">
                  <span className="line-clamp-2" title={r.funcion + (r.detalle ? ' — ' + r.detalle : '')}>
                    {r.funcion}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs">{r.estado}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-slate-400">{r.txId || '—'}</td>
                <td className="px-3 py-2 font-mono text-[11px] text-accent/90">{r.operacionId || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
