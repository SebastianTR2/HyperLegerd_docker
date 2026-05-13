import { Link } from 'react-router-dom'
import { ActivityFeed } from '../components/ActivityFeed'
import { StatSummary } from '../components/StatSummary'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { workspaceLabel } from '../lib/roles'
import { formatShortDate } from '../lib/format'
import type { ClienteApi } from '../types/api'

const shortcutsBase = [
  { to: '/registros', label: 'Registros', desc: 'Alta de cliente y respuesta del servidor' },
  { to: '/tokens', label: 'Cuentas token', desc: 'Emitir y transferir vía API' },
  { to: '/cuentas-visibles', label: 'Cuentas token visibles', desc: 'Listado desde chaincode' },
  { to: '/consultas', label: 'Consultas', desc: 'Buscar por clienteId exacto' },
  { to: '/clientes-registrados', label: 'Clientes registrados', desc: 'GET /clientes' },
  { to: '/historial', label: 'Historial de operaciones', desc: 'Auditoría de la sesión' },
  { to: '/trazabilidad', label: 'Trazabilidad', desc: 'TXID y pasos' },
  { to: '/credenciales', label: 'Credenciales', desc: 'Rol y cabecera X-API-Key' },
] as const

export default function PanelPage() {
  const { eventos, tokenOps, clientesLedger, clientesLedgerLoading, clientesLedgerError } = useDemoStore()
  const { mode, role, roleLabel, permissions } = useSettings()
  const consultasCount = eventos.filter((e) => e.tipo === 'consulta').length
  const ultimos = [...clientesLedger].sort(
    (a, b) => new Date(b.fechaAlta).getTime() - new Date(a.fechaAlta).getTime(),
  ).slice(0, 6)
  const actividad = eventos.slice(0, 8)
  const shortcuts = shortcutsBase.filter((s) => {
    if (s.to === '/tokens' && !permissions.canEmitTokens) return false
    if (s.to === '/registros' && !permissions.canRegisterClients) return false
    return true
  })
  const workspace = workspaceLabel(role)
  const dataSourceLabel = mode === 'api' ? 'API / red' : 'Sin API'

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <StatSummary
        totalClientesEnRed={clientesLedger.length}
        tokenOpsCount={tokenOps.length}
        consultasCount={consultasCount}
        eventosCount={eventos.length}
        showTokenCard={permissions.canEmitTokens}
        dataSourceLabel={dataSourceLabel}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-3">
          <div className="rounded-2xl border border-line bg-elevated/90 p-4 shadow-card">
            <h2 className="text-sm font-semibold text-slate-100">Panel administrativo</h2>
            <p className="mt-1 text-xs text-muted">
              {workspace} · <span className="text-slate-300">{roleLabel}</span>
            </p>
            <ul className="mt-3 space-y-2">
              {shortcuts.map((s) => (
                <li key={s.to}>
                  <Link
                    to={s.to}
                    className="block rounded-xl border border-transparent px-3 py-2 transition-colors hover:border-line hover:bg-surface/60"
                  >
                    <span className="text-sm font-medium text-slate-200">{s.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{s.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-line bg-elevated/90 p-4 shadow-card">
            <h2 className="text-sm font-semibold text-slate-100">Origen de datos</h2>
            <p className="mt-2 text-xs text-muted">
              {mode === 'api'
                ? 'Las listas de clientes se obtienen del middleware (proxy /api) y del ledger cuando la red responde.'
                : 'Sin API: el panel de clientes vacío hasta conectar credenciales y modo API en Credenciales.'}
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-3 py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/35 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="text-xs text-slate-300">
                {mode === 'api' ? 'Conexión API (X-API-Key vía proxy)' : 'Configure API en Credenciales'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-5">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-elevated/90 shadow-card">
            <div className="shrink-0 border-b border-line px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-slate-100">
                {permissions.canRegisterClients ? 'Registros del sistema' : 'Resumen'}
              </h2>
              <p className="text-xs text-muted">
                {permissions.canRegisterClients
                  ? 'Últimos clientes en red (GET /clientes). Datos obtenidos desde la red/API.'
                  : 'Vista de seguimiento'}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {clientesLedgerError ? (
                <p className="px-4 py-6 text-center text-sm text-danger/90">{clientesLedgerError}</p>
              ) : null}
              {!clientesLedgerLoading && !clientesLedgerError && ultimos.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No hay registros cargados todavía.</p>
              ) : null}
              {clientesLedgerLoading ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Cargando clientes…</p>
              ) : null}
              {ultimos.length > 0 ? (
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-line bg-surface/95 text-xs uppercase text-muted backdrop-blur-sm">
                    <tr>
                      <th className="px-4 py-2 font-medium">clienteId</th>
                      <th className="px-4 py-2 font-medium">Nombre</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">Documento</th>
                      <th className="px-4 py-2 font-medium">Alta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ultimos.map((c) => (
                      <UltimaFilaCliente key={c.clienteId} c={c} />
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-line p-3">
              <Link
                to={permissions.canRegisterClients ? '/clientes-registrados' : '/consultas'}
                className="block w-full rounded-xl border border-line bg-surface/60 py-2 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-elevated hover:text-slate-100"
              >
                {permissions.canRegisterClients ? 'Ver todos los clientes' : 'Ir a consultas'}
              </Link>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-4">
          <ActivityFeed
            items={actividad}
            title="Actividad reciente"
            subtitle="Operaciones registradas en esta sesión"
            emptyText="No hay actividades recientes."
            className="min-h-0 flex-1"
            bodyClassName="min-h-0"
          />
        </div>
      </div>
    </div>
  )
}

function UltimaFilaCliente({ c }: { c: ClienteApi }) {
  return (
    <tr className="hover:bg-surface/40">
      <td className="px-4 py-2">
        <Link
          to="/registros"
          state={{ focusId: c.clienteId }}
          className="font-mono text-xs font-medium text-accent hover:text-accent-hover"
        >
          {c.clienteId}
        </Link>
      </td>
      <td className="max-w-[140px] truncate px-4 py-2 text-muted">{c.nombre}</td>
      <td className="hidden max-w-[140px] truncate px-4 py-2 text-muted sm:table-cell">
        {c.tipoDocumento} {c.numeroDocumento}
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatShortDate(c.fechaAlta)}</td>
    </tr>
  )
}
