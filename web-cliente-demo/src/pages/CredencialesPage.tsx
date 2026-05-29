import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { etiquetaOrganizacion } from '../lib/organizacion'
import { rolePermissions, workspaceLabel } from '../lib/roles'

/**
 * Página "Perfil de sesión". Antes editaba la X-API-Key manualmente; tras
 * introducir el login JWT este formulario quedó obsoleto. Ahora muestra:
 *   - identidad del usuario (nombre, usuario, tenant, rol),
 *   - permisos efectivos del rol,
 *   - explicación del flujo (JWT → BFF → middleware) sin exponer claves,
 *   - botón para cerrar sesión.
 */
export default function CredencialesPage() {
  const { role, roleLabel, tenant, nombreUsuario } = useSettings()
  const { usuario, logout } = useAuth()
  const navigate = useNavigate()
  const perms = rolePermissions(role)
  const workspace = workspaceLabel(role)

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-2">
      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">Sesión actual</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusTile label="Nombre" value={nombreUsuario || '—'} tone="ok" help="Tal como lo registró el operador del BaaS." />
          <StatusTile label="Usuario" value={usuario?.usuario ?? '—'} tone="info" help="Identificador para iniciar sesión." />
          <StatusTile
            label="Organización"
            value={etiquetaOrganizacion(tenant)}
            tone="info"
            help="Empresa o espacio de datos al que pertenece tu cuenta."
          />
          <StatusTile label="Rol" value={roleLabel} tone="ok" help="Determina los permisos y la X-API-Key del backend." />
          <StatusTile label="Espacio" value={workspace} tone="info" help="Interfaz adaptada al rol." />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">Permisos efectivos en la consola</h2>
        <p className="mt-1 text-xs text-muted">
          La consola del puente es de solo lectura. Las altas, ediciones y bajas se hacen en el portal del cliente
          (o vía API directa al middleware) y aquí solo se auditan.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <PermChip ok={perms.canConsultClients} text="Consultar clientes" />
          <PermChip ok={perms.canViewHistory} text="Ver historial" />
          <PermChip ok={perms.canViewTraceability} text="Ver trazabilidad" />
          <PermChip ok={perms.canSeeAdminNotifications} text="Recibir notificaciones admin" />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">Cómo se autentica esta consola</h2>
        <p className="mt-2 text-xs text-muted">
          La consola del puente ya <strong>no</strong> guarda una <code className="font-mono">X-API-Key</code> en el
          navegador. El login emite un JWT que enviamos en cada petición; el BFF (
          <code className="font-mono">web-portal-api</code>) lo valida, deduce el tenant y rol del usuario, e inyecta
          la <code className="font-mono">X-API-Key</code> real más las cabeceras{' '}
          <code className="font-mono">X-Actor-*</code> al reenviar la petición al{' '}
          <code className="font-mono">api-middleware</code>.
        </p>
        <p className="mt-2 text-xs text-muted">
          Las cuentas humanas las administra el operador del BaaS editando{' '}
          <code className="font-mono">web-portal-api/config/usuarios-admin.yaml</code> y reiniciando el BFF.
        </p>
      </section>

      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">Cerrar sesión</h2>
        <p className="mt-2 text-xs text-muted">
          Al salir, el JWT actual se invalida en el BFF y se borra del navegador.
        </p>
        <button
          type="button"
          className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-2 text-sm font-semibold text-danger hover:bg-danger/15"
          onClick={() => void logout().then(() => navigate('/login', { replace: true }))}
        >
          Cerrar sesión
        </button>
      </section>
    </div>
  )
}

function StatusTile({
  label,
  value,
  help,
  tone,
}: {
  label: string
  value: string
  help: string
  tone: 'ok' | 'warn' | 'info'
}) {
  const toneClass =
    tone === 'ok'
      ? 'border-success/30 bg-success/10'
      : tone === 'warn'
        ? 'border-amber-500/35 bg-amber-500/10'
        : 'border-accent-soft/35 bg-accent-soft/10'
  return (
    <div className={`rounded-xl border px-3 py-2 ${toneClass}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-100">{value}</p>
      <p className="mt-1 text-[11px] text-muted">{help}</p>
    </div>
  )
}

function PermChip({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span
      className={[
        'rounded-full border px-2.5 py-1 text-[11px]',
        ok ? 'border-success/35 bg-success/10 text-success' : 'border-slate-600/70 bg-surface text-slate-400',
      ].join(' ')}
    >
      {ok ? 'Sí' : 'No'} · {text}
    </span>
  )
}
