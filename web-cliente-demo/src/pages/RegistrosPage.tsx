import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { formatShortDate } from '../lib/format'
import { getPortalClienteUrl } from '../lib/portalCliente'
import type { ClienteApi } from '../types/api'
import { ClienteLedgerEstadoBadge } from '../components/ClienteLedgerEstadoBadge'

const card =
  'rounded-2xl border border-line bg-elevated/90 p-5 shadow-card'
const btnPortal =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover'

export default function RegistrosPage() {
  const {
    clientesLedger,
    clientesLedgerLoading,
    clientesLedgerError,
    clientesLedgerAccessDenied,
    refreshClientesLedger,
  } = useDemoStore()
  const { permissions } = useSettings()
  const portalUrl = getPortalClienteUrl()

  useEffect(() => {
    void refreshClientesLedger()
  }, [refreshClientesLedger])

  const rows: ClienteApi[] = clientesLedger

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className={card}>
        <h2 className="text-sm font-semibold text-slate-100">Portal de Cliente</h2>
        <p className="mt-2 text-sm text-muted">
          El registro operativo de clientes se realiza desde el Portal de Cliente. Este panel administrativo sirve para
          revisar datos en la red, historial, trazabilidad y operaciones de control.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a className={btnPortal} href={portalUrl} target="_blank" rel="noopener noreferrer">
            Abrir Portal de Cliente
          </a>
          <span className="self-center text-[11px] text-muted">
            Destino: <span className="font-mono text-slate-400">{portalUrl}</span>
            {' · '}
            Variable opcional: <span className="font-mono">VITE_PORTAL_CLIENTE_URL</span>
          </span>
        </div>
      </div>

      <div className={card}>
        <h3 className="text-sm font-semibold text-slate-200">Accesos administrativos</h3>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          <li>
            <Link className="text-accent hover:underline" to="/clientes-registrados">
              Clientes registrados
            </Link>
          </li>
          <span className="text-line">·</span>
          <li>
            <Link className="text-accent hover:underline" to="/consultas">
              Consultas
            </Link>
          </li>
          <span className="text-line">·</span>
          <li>
            <Link className="text-accent hover:underline" to="/historial">
              Historial
            </Link>
          </li>
          <span className="text-line">·</span>
          <li>
            <Link className="text-accent hover:underline" to="/trazabilidad">
              Trazabilidad
            </Link>
          </li>
        </ul>
      </div>

      <div className={card}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-200">Vista resumida en red</h3>
          <button
            type="button"
            className="rounded-lg border border-line bg-surface/60 px-3 py-1.5 text-xs text-slate-300 hover:bg-elevated"
            onClick={() => void refreshClientesLedger()}
            disabled={clientesLedgerLoading}
          >
            {clientesLedgerLoading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">Origen: GET /clientes · solo lectura</p>
        {clientesLedgerAccessDenied ? (
          <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-100/95">
            <p>{clientesLedgerError}</p>
            <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/credenciales">
              Abrir Credenciales
            </Link>
          </div>
        ) : clientesLedgerError ? (
          <p className="mt-3 text-sm text-danger/90">{clientesLedgerError}</p>
        ) : null}
        {!clientesLedgerLoading && !clientesLedgerError && rows.length === 0 ? (
          <p className="mt-4 text-center text-sm text-muted">No hay clientes registrados todavía.</p>
        ) : null}
        {clientesLedgerLoading ? <p className="mt-4 text-center text-sm text-muted">Cargando…</p> : null}
        {rows.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line text-xs uppercase text-muted">
                <tr>
                  <th className="pb-2 pr-3 font-medium">clienteId</th>
                  <th className="pb-2 pr-3 font-medium">Nombre</th>
                  <th className="pb-2 pr-3 font-medium">Documento</th>
                  <th className="pb-2 pr-3 font-medium">Estado</th>
                  <th className="pb-2 font-medium">Alta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.slice(0, 12).map((r) => (
                  <tr key={r.clienteId}>
                    <td className="py-2 pr-3 font-mono text-xs text-accent">
                      <Link to="/clientes-registrados" state={{ focusId: r.clienteId }} className="hover:underline">
                        {r.clienteId}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-slate-200">{r.nombre}</td>
                    <td className="py-2 pr-3 text-muted">
                      {r.tipoDocumento} {r.numeroDocumento}
                    </td>
                    <td className="py-2 pr-3">
                      <ClienteLedgerEstadoBadge c={r} />
                    </td>
                    <td className="py-2 text-xs text-muted">{formatShortDate(r.fechaAlta)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length > 12 ? (
              <p className="mt-2 text-xs text-muted">
                Mostrando 12 de {rows.length}.{' '}
                <Link className="text-accent hover:underline" to="/clientes-registrados">
                  Ver listado completo
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      {!permissions.canRegisterClients ? (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          Su rol solo permite consultar. Use el portal solo si cuenta con una clave con permiso de registro.
        </div>
      ) : null}
    </div>
  )
}
