import { Link } from 'react-router-dom'
import { ActivityFeed } from '../components/ActivityFeed'
import { StatSummary } from '../components/StatSummary'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { formatShortDate } from '../lib/format'
import { getPortalClienteUrl } from '../lib/portalCliente'
import { workspaceLabel } from '../lib/roles'
import type { ClienteApi } from '../types/api'
import { ClienteLedgerEstadoBadge } from '../components/ClienteLedgerEstadoBadge'

const shortcuts = [
  { to: '/clientes-registrados', label: 'Clientes en red', desc: 'Listado desde GET /clientes (solo lectura)' },
  { to: '/auditoria', label: 'Auditoría del puente', desc: 'HTTP + eventos cadena, exportación CSV/JSON' },
  { to: '/consultas', label: 'Consultas', desc: 'Cliente por clienteId exacto' },
  { to: '/historial', label: 'Actividad de la sesión', desc: 'Operaciones observadas en esta sesión' },
  { to: '/trazabilidad', label: 'Trazas y TXID', desc: 'Línea de tiempo y comprobación técnica' },
  { to: '/credenciales', label: 'Perfil de sesión', desc: 'Usuario, tenant, rol y permisos' },
] as const

export default function PanelPage() {
  const { eventos, clientesLedger, clientesLedgerLoading, clientesLedgerError, clientesLedgerAccessDenied } =
    useDemoStore()
  const { role, roleLabel } = useSettings()
  const consultasCount = eventos.filter((e) => e.tipo === 'consulta').length
  const ultimos = [...clientesLedger].sort(
    (a, b) => new Date(b.fechaAlta).getTime() - new Date(a.fechaAlta).getTime(),
  ).slice(0, 6)
  const actividad = eventos.slice(0, 8)
  const portalClienteUrl = getPortalClienteUrl()
  const workspace = workspaceLabel(role)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <StatSummary
        totalClientesEnRed={clientesLedger.length}
        tokenOpsCount={0}
        consultasCount={consultasCount}
        eventosCount={eventos.length}
        showTokenCard={false}
        dataSourceLabel="API / red"
      />

      {clientesLedgerAccessDenied ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95 shadow-sm">
          <p>
            {clientesLedgerError?.trim()
              ? clientesLedgerError
              : 'La sesión actual no tiene permiso para listar clientes. Verifique con un administrador.'}
          </p>
          <Link className="mt-2 inline-block text-xs font-medium text-accent hover:underline" to="/credenciales">
            Ver perfil de sesión
          </Link>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-12 lg:items-stretch">
        <div className="flex min-h-0 flex-col gap-4 lg:col-span-3">
          <div className="rounded-2xl border border-line bg-elevated/90 p-4 shadow-card">
            <h2 className="text-sm font-semibold text-slate-100">Espacio actual</h2>
            <p className="mt-1 text-xs text-muted">
              {workspace} · <span className="text-slate-300">{roleLabel}</span>
            </p>
            <p className="mt-3 text-xs text-muted">
              Esta consola es un <strong>explorador audit-only</strong> del puente. Los altas, ediciones y bajas
              de clientes se realizan en el portal del cliente.
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href={portalClienteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-xl border border-accent/25 bg-accent/5 px-3 py-2 transition-colors hover:border-accent/40 hover:bg-accent/10"
                >
                  <span className="text-sm font-medium text-slate-200">Abrir Portal de Cliente</span>
                  <span className="mt-0.5 block text-xs text-muted">Registro y edición operativa</span>
                </a>
              </li>
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
              Las listas se obtienen del <code className="font-mono">api-middleware</code> a través del BFF
              autenticado por JWT. Nada se guarda local; cada refresco vuelve a leer del ledger.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-line bg-surface/50 px-3 py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/35 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="text-xs text-slate-300">Sesión autenticada · proxy BFF activo</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-5">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-elevated/90 shadow-card">
            <div className="shrink-0 border-b border-line px-4 py-3 sm:px-5">
              <h2 className="text-sm font-semibold text-slate-100">Clientes en red</h2>
              <p className="text-xs text-muted">
                Últimos clientes (GET /clientes). Datos desde el middleware cuando el modo API está activo.
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {clientesLedgerError && !clientesLedgerAccessDenied ? (
                <p className="px-4 py-6 text-center text-sm text-danger/90">{clientesLedgerError}</p>
              ) : null}
              {!clientesLedgerLoading && clientesLedgerAccessDenied ? (
                <p className="px-4 py-8 text-center text-sm text-muted">
                  No se pudieron cargar los últimos clientes en esta vista.
                </p>
              ) : null}
              {!clientesLedgerLoading && !clientesLedgerError && ultimos.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted">No hay clientes registrados todavía.</p>
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
                      <th className="px-4 py-2 font-medium">Estado</th>
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
                to="/clientes-registrados"
                className="block w-full rounded-xl border border-line bg-surface/60 py-2 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-elevated hover:text-slate-100"
              >
                Ver todos los clientes
              </Link>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-4">
          <ActivityFeed
            items={actividad}
            title="Actividad reciente"
            subtitle="Operaciones registradas en esta sesión"
            emptyText="No hay actividad reciente."
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
          to="/clientes-registrados"
          state={{ focusId: c.clienteId }}
          className="font-mono text-xs font-medium text-accent hover:text-accent-hover"
        >
          {c.clienteId}
        </Link>
        <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">
          <Link className="text-muted hover:text-accent" to={`/historial-cliente/${encodeURIComponent(c.clienteId)}`}>
            Historial
          </Link>
          <span className="text-line">·</span>
          <Link className="text-muted hover:text-accent" to="/consultas" state={{ clienteId: c.clienteId }}>
            Consulta
          </Link>
        </div>
      </td>
      <td className="max-w-[140px] truncate px-4 py-2 text-muted">{c.nombre}</td>
      <td className="hidden max-w-[140px] truncate px-4 py-2 text-muted sm:table-cell">
        {c.tipoDocumento} {c.numeroDocumento}
      </td>
      <td className="px-4 py-2">
        <ClienteLedgerEstadoBadge c={c} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatShortDate(c.fechaAlta)}</td>
    </tr>
  )
}
