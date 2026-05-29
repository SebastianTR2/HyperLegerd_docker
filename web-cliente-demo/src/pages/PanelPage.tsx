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

export default function PanelPage() {
  const { eventos, clientesLedger, clientesLedgerLoading, clientesLedgerError, clientesLedgerAccessDenied, limpiarEventos } =
    useDemoStore()
  const { role, roleLabel, tenant } = useSettings()
  const isAgricultura = tenant.trim().toLowerCase() === 'agricultura'
  const entityLabel = isAgricultura ? 'Lotes en red' : 'Clientes en red'
  const listEndpoint = isAgricultura ? 'GET /datos' : 'GET /clientes'
  const shortcuts = [
    { to: '/clientes-registrados', label: entityLabel, desc: `Listado desde ${listEndpoint} (solo lectura)` },
    { to: '/auditoria', label: 'Auditoría del puente', desc: 'HTTP + eventos cadena, exportación CSV/JSON' },
    ...(!isAgricultura ? [{ to: '/consultas', label: 'Consultas', desc: 'Cliente por clienteId exacto' }] : []),
    { to: '/historial', label: 'Actividad de la sesión', desc: 'Operaciones observadas en esta sesión' },
    { to: '/trazabilidad', label: 'Trazas y TXID', desc: 'Línea de tiempo y comprobación técnica' },
    { to: '/credenciales', label: 'Perfil de sesión', desc: 'Usuario, organización, rol y permisos' },
  ] as const
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
        entityLabel={entityLabel}
        ledgerEndpointHint={`Datos del ledger vía ${listEndpoint}`}
        tokenOpsCount={0}
        consultasCount={consultasCount}
        eventosCount={eventos.length}
        showTokenCard={false}
        dataSourceLabel="API / red"
      />

      {clientesLedgerAccessDenied ? (
        <div className="admin-alert-warning">
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
          <div className="admin-card p-4">
            <h2 className="admin-card-title">Espacio actual</h2>
            <p className="mt-1 text-xs text-muted">
              {workspace} · <span className="font-medium text-ink-secondary">{roleLabel}</span>
            </p>
            <p className="mt-3 text-xs text-muted">
              Esta consola es un <strong>explorador audit-only</strong> del puente. Las mutaciones operativas se
              realizan en el portal externo y aquí se visualizan desde la red.
            </p>
            <ul className="mt-3 space-y-2">
              <li>
                <a
                  href={portalClienteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-md border border-accent/25 bg-accent-soft/50 px-3 py-2 transition-colors hover:border-accent/40 hover:bg-accent-soft"
                >
                  <span className="text-sm font-medium text-ink">Abrir Portal de Cliente</span>
                  <span className="mt-0.5 block text-xs text-muted">Registro y edición operativa</span>
                </a>
              </li>
              {shortcuts.map((s) => (
                <li key={s.to}>
                  <Link
                    to={s.to}
                    className="block rounded-md border border-transparent px-3 py-2 transition-colors hover:border-line hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-ink-secondary">{s.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{s.desc}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="admin-card p-4">
            <h2 className="admin-card-title">Origen de datos</h2>
            <p className="mt-2 text-xs text-muted">
              Las listas se obtienen del <code className="font-mono">api-middleware</code> a través del BFF
              autenticado por JWT. Nada se guarda local; cada refresco vuelve a leer del ledger.
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-gray-50 px-3 py-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/35 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
              </span>
              <span className="text-xs text-ink-secondary">Sesión autenticada · proxy BFF activo</span>
            </div>
          </div>
        </div>

        <div className="flex min-h-0 flex-col lg:col-span-5">
          <div className="admin-card flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="admin-card-header">
              <h2 className="admin-card-title">{entityLabel}</h2>
              <p className="text-xs text-muted">
                Últimos registros ({listEndpoint}). Datos desde el middleware cuando el modo API está activo.
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
                <p className="px-4 py-8 text-center text-sm text-muted">No hay registros en red todavía.</p>
              ) : null}
              {clientesLedgerLoading ? (
                <p className="px-4 py-8 text-center text-sm text-muted">Cargando clientes…</p>
              ) : null}
              {ultimos.length > 0 ? (
                <table className="admin-table w-full text-left text-sm">
                  <thead className="sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-2 font-medium">{isAgricultura ? 'datoId' : 'clienteId'}</th>
                      <th className="px-4 py-2 font-medium">Nombre</th>
                      <th className="hidden px-4 py-2 font-medium sm:table-cell">{isAgricultura ? 'Código' : 'Documento'}</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                      <th className="px-4 py-2 font-medium">Alta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ultimos.map((c) => (
                      <UltimaFilaCliente key={c.clienteId} c={c} isAgricultura={isAgricultura} />
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
            <div className="shrink-0 border-t border-line p-3">
              <Link
                to="/clientes-registrados"
                className="admin-btn-secondary block w-full py-2 text-center text-xs"
              >
                Ver todos los registros
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
            onClear={limpiarEventos}
          />
        </div>
      </div>
    </div>
  )
}

function UltimaFilaCliente({ c, isAgricultura }: { c: ClienteApi; isAgricultura: boolean }) {
  return (
    <tr>
      <td className="px-4 py-2">
        <Link
          to="/clientes-registrados"
          state={{ focusId: c.clienteId }}
          className="font-mono text-xs font-medium text-accent hover:text-accent-hover"
        >
          {c.clienteId}
        </Link>
        <div className="mt-1 flex flex-wrap gap-x-2 text-[10px]">
          {isAgricultura ? (
            <Link className="text-muted hover:text-accent" to="/auditoria" state={{ recursoId: c.clienteId }}>
              Auditar
            </Link>
          ) : (
            <>
              <Link className="text-muted hover:text-accent" to={`/historial-cliente/${encodeURIComponent(c.clienteId)}`}>
                Historial
              </Link>
              <span className="text-line">·</span>
              <Link className="text-muted hover:text-accent" to="/consultas" state={{ clienteId: c.clienteId }}>
                Consulta
              </Link>
            </>
          )}
        </div>
      </td>
      <td className="max-w-[140px] truncate px-4 py-2 text-muted">{c.nombre}</td>
      <td className="hidden max-w-[140px] truncate px-4 py-2 text-muted sm:table-cell">
        {c.tipoDocumento} {c.numeroDocumento}
      </td>
      <td className="px-4 py-2">
        <ClienteLedgerEstadoBadge c={c} raw={isAgricultura} />
      </td>
      <td className="whitespace-nowrap px-4 py-2 text-xs text-muted">{formatShortDate(c.fechaAlta)}</td>
    </tr>
  )
}
