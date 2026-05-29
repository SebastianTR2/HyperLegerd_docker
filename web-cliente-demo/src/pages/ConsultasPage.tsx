import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { clienteApiToRegistro, parseClienteDesdeLectura } from '../lib/apiClienteAdapter'
import { parseDatoDatos } from '../lib/datoApiAdapter'
import { describeApiError } from '../lib/apiErrorMessage'
import { consultarClienteApi } from '../services/apiClientes'
import { consultarDatoApi } from '../services/apiDatos'
import LoteProcesoPanel, { extraerPayloadLote } from '../components/LoteProcesoPanel'
import { ApiHttpError } from '../services/apiClient'
import type { ClienteApiCacheRow } from '../types/api'
import type { Registro } from '../types/registro'
import { formatShortDate } from '../lib/format'

const input =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink-secondary outline-none placeholder:text-muted focus:border-accent-soft focus:ring-2 focus:ring-accent/25'

const btnPrimary =
  'admin-btn-primary shadow-sm transition-colors hover:bg-accent-hover'

export default function ConsultasPage() {
  const location = useLocation()
  const { mode, role, roleLabel, tenant } = useSettings()
  const isAgricultura = tenant.trim().toLowerCase() === 'agricultura'
  const endpointLabel = isAgricultura ? 'GET /datos/:datoId' : 'GET /clientes/:clienteId'
  const idLabel = isAgricultura ? 'datoId' : 'clienteId'
  const placeholder = isAgricultura ? 'AGRO-TEST-001' : 'CLI001'
  const { mergeExternalEvent, upsertApiClienteRow, showToast, pushTrace, refreshClientesLedger } = useDemoStore()
  const [clienteIdApi, setClienteIdApi] = useState('')
  const [lastApiRow, setLastApiRow] = useState<ClienteApiCacheRow | null>(null)
  const [lastLotePayload, setLastLotePayload] = useState<Record<string, unknown> | null>(null)
  const [lastError, setLastError] = useState<string | null>(null)

  useEffect(() => {
    const st = location.state as { clienteId?: string } | null | undefined
    const id = typeof st?.clienteId === 'string' ? st.clienteId.trim() : ''
    if (id) setClienteIdApi(id)
  }, [location.state])

  const onSubmitApi = async (e: React.FormEvent) => {
    e.preventDefault()
    setLastError(null)
    setLastApiRow(null)
    setLastLotePayload(null)
    const id = clienteIdApi.trim()
    if (!id) {
      showToast(`Indique el ${idLabel} exacto (ej. ${placeholder}).`, 'error')
      return
    }
    try {
      const res = isAgricultura ? await consultarDatoApi(id) : await consultarClienteApi(id)
      const parsed = isAgricultura ? parseDatoDatos(res.payloadDecodificado ?? res.datos) : parseClienteDesdeLectura(res)
      if (parsed) {
        upsertApiClienteRow(parsed)
        setLastApiRow(parsed)
        if (isAgricultura) {
          setLastLotePayload(extraerPayloadLote(res.payloadDecodificado ?? res.datos))
        }
      } else {
        setLastError('Respuesta sin datos de cliente reconocibles.')
      }
      mergeExternalEvent({
        tipo: 'consulta',
        estado: 'exito',
        titulo: 'Cliente consultado correctamente',
        mensaje: `${res.mensaje} · ${id}`,
      })
      showToast('Consulta completada.', 'success')
      void refreshClientesLedger()
      pushTrace({
        operationType: 'CLIENTE_CONSULTADO',
        mode,
        role,
        state: 'exitoso',
        message: `Consulta completada para ${id}.`,
        clienteId: id,
        steps: [
          { id: 'cap', label: 'Captura de clienteId', status: 'exitoso' },
          { id: 'rol', label: 'Validación de rol', status: 'exitoso', detail: `${roleLabel} puede consultar.` },
          { id: 'api', label: 'Solicitud al middleware/API', status: 'exitoso' },
          { id: 'res', label: 'Respuesta recibida', status: 'exitoso', detail: res.mensaje },
        ],
      })
    } catch (e) {
      const msg = describeApiError(e)
      setLastError(msg)
      showToast(msg, 'error')
      mergeExternalEvent({
        tipo: 'consulta',
        estado: 'error',
        titulo: 'Error al consultar cliente',
        mensaje: e instanceof ApiHttpError ? e.payload?.mensaje ?? msg : msg,
      })
      pushTrace({
        operationType: 'ERROR_API',
        mode,
        role,
        state: 'error',
        message: `Error al consultar ${isAgricultura ? 'registro' : 'cliente'} ${id}.`,
        clienteId: id,
        httpStatus: e instanceof ApiHttpError ? e.status : undefined,
        errorCode: e instanceof ApiHttpError ? e.payload?.codigo : undefined,
        errorMessage: e instanceof ApiHttpError ? e.payload?.mensaje ?? msg : msg,
        steps: [
          { id: 'cap', label: 'Captura de clienteId', status: 'exitoso' },
          { id: 'api', label: 'Solicitud al middleware/API', status: 'exitoso' },
          { id: 'err', label: 'Error recibido', status: 'error', detail: msg },
        ],
      })
    }
  }

  const apiRegistro: Registro | null = lastApiRow ? clienteApiToRegistro(lastApiRow) : null

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink">Consultas</h1>
        <p className="mt-1 text-sm text-muted">
          Consulta administrativa por <strong className="text-ink-secondary">{idLabel} exacto</strong>. No se busca por nombre en
          esta pantalla.
        </p>
      </div>

      <form onSubmit={onSubmitApi} className="shrink-0 admin-card p-5 shadow-card">
        <h2 className="text-sm font-semibold text-ink">Consulta en cadena</h2>
        <p className="mt-1 text-xs text-muted">
          Endpoint <code className="rounded bg-surface px-1 font-mono text-xs">{endpointLabel}</code> a través del proxy{' '}
          <code className="rounded bg-surface px-1 font-mono text-xs">/api</code>. Ejemplo: <strong className="text-muted">{placeholder}</strong>.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            className={input}
            value={clienteIdApi}
            onChange={(e) => setClienteIdApi(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="submit" className={`${btnPrimary} shrink-0 sm:px-8`}>
            Consultar
          </button>
        </div>
      </form>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden admin-card shadow-card">
        <div className="shrink-0 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold text-ink">Resultado</h2>
          <p className="text-xs text-muted">Datos devueltos por el middleware</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {lastError && !lastApiRow ? (
            <p className="text-sm text-danger/90">{lastError}</p>
          ) : apiRegistro ? (
            <div className="space-y-6">
              <ApiResultView r={apiRegistro} informacionAuditoria={lastApiRow?.informacionAuditoria} isAgricultura={isAgricultura} />
              {isAgricultura && lastLotePayload ? (
                <div className="border-t border-line/60 pt-5">
                  <LoteProcesoPanel datos={lastLotePayload} titulo="Proceso del lote (estado actual)" />
                </div>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted">Ejecute una consulta con un identificador válido.</p>
          )}
        </div>
      </div>
    </div>
  )
}

function ApiResultView({
  r,
  informacionAuditoria,
  isAgricultura,
}: {
  r: Registro
  informacionAuditoria?: string | null
  isAgricultura: boolean
}) {
  return (
    <div className="space-y-4">
      <div
        className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase ${
          r.estado === 'activo'
            ? 'border-success/30 bg-success/15 text-success'
            : r.estado === 'pendiente'
              ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
              : r.estado === 'baja'
                ? 'border-danger/30 bg-danger-soft text-danger-ink'
                : 'border-slate-500/25 bg-slate-500/10 text-muted'
        }`}
      >
        Estado: {r.estado}
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-[11px] uppercase text-muted">{isAgricultura ? 'datoId' : 'clienteId'}</dt>
          <dd className="mt-0.5 font-mono text-sm text-ink-secondary">{r.id}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-muted">Nombre</dt>
          <dd className="mt-0.5 text-ink-secondary">{r.nombreCompleto}</dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-muted">{isAgricultura ? 'Código' : 'Documento'}</dt>
          <dd className="mt-0.5 text-ink-secondary">
            {r.tipoDocumento} {r.documento}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] uppercase text-muted">Fecha alta</dt>
          <dd className="mt-0.5 text-ink-secondary">{formatShortDate(r.fechaRegistro)}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] uppercase text-muted">{isAgricultura ? 'metadata' : 'notas'}</dt>
          <dd className="mt-0.5 text-ink-secondary">{r.facultad}</dd>
        </div>
        {r.email ? (
          <div className="sm:col-span-2">
            <dt className="text-[11px] uppercase text-muted">email</dt>
            <dd className="mt-0.5 text-ink-secondary">{r.email}</dd>
          </div>
        ) : null}
        {r.telefono ? (
          <div>
            <dt className="text-[11px] uppercase text-muted">telefono</dt>
            <dd className="mt-0.5 text-ink-secondary">{r.telefono}</dd>
          </div>
        ) : null}
      </dl>
      {informacionAuditoria?.trim() ? (
        <div className="rounded-xl border border-line/60 bg-gray-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Información de auditoría</p>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
            {informacionAuditoria}
          </pre>
        </div>
      ) : null}
    </div>
  )
}
