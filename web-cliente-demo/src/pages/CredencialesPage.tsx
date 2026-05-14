import { useEffect, useMemo, useState } from 'react'
import { useDemoStore } from '../context/DemoStoreContext'
import { useSettings } from '../context/SettingsContext'
import { rolePermissions, workspaceLabel } from '../lib/roles'
import { normalizeApiKey, STORAGE_KEY_API_KEY } from '../lib/settings'

const presets = [
  {
    role: 'Administrador',
    value: 'sec-admin',
    hint: 'API_KEY_ADMIN',
    desc: 'Control total de registros, consultas y operaciones de token.',
    perms: ['Registrar', 'Consultar', 'Emitir token', 'Transferir token'],
  },
  {
    role: 'Integrador',
    value: 'sec-int',
    hint: 'API_KEY_INTEGRADOR',
    desc: 'Gestiona clientes y consultas, sin operaciones de token.',
    perms: ['Registrar', 'Consultar', 'Historial', 'Trazabilidad'],
  },
  {
    role: 'Solo lectura',
    value: 'sec-lect',
    hint: 'API_KEY_SOLO_LECTURA',
    desc: 'Perfil de monitoreo sin cambios ni operaciones de escritura.',
    perms: ['Consultar', 'Historial', 'Trazabilidad'],
  },
] as const

function presetByValue(value: string) {
  return presets.find((p) => p.value === value)
}

function credentialLabel(apiKey: string): string {
  if (!apiKey) return 'Ninguna'
  const hit = presetByValue(apiKey)
  return hit ? hit.role : 'Clave personalizada'
}

function activationMessage(roleName: string): string {
  if (roleName === 'Administrador') return 'Modo Administrador activado. Puede registrar, consultar y operar tokens.'
  if (roleName === 'Integrador') return 'Modo Integrador activado. Puede registrar y consultar, pero no operar tokens.'
  if (roleName === 'Solo lectura') return 'Modo Solo lectura activado. Solo puede consultar informacion.'
  return 'Credencial activada correctamente.'
}

export default function CredencialesPage() {
  const { mode, apiKey, role, roleLabel, setMode, setApiKey } = useSettings()
  const { showToast, refreshClientesLedger } = useDemoStore()
  const [draftKey, setDraftKey] = useState(apiKey)

  const activePresetValue = useMemo(() => presetByValue(apiKey)?.value ?? null, [apiKey])
  const perms = useMemo(() => rolePermissions(role), [role])
  const workspace = useMemo(() => workspaceLabel(role), [role])
  const hasPendingDraft = normalizeApiKey(draftKey) !== apiKey

  useEffect(() => {
    setDraftKey(apiKey)
  }, [apiKey])

  const applyDraft = () => {
    setApiKey(draftKey)
    const cleaned = normalizeApiKey(draftKey)
    if (!cleaned) return
    const hit = presetByValue(cleaned)
    showToast(hit ? activationMessage(hit.role) : 'Clave guardada correctamente.', 'success')
  }

  const applyPreset = (value: string) => {
    const hit = presetByValue(value)
    setDraftKey(value)
    setApiKey(value)
    if (hit) showToast(activationMessage(hit.role), 'success')
  }

  const clearStoredCredential = () => {
    setApiKey('')
    setDraftKey('')
    void refreshClientesLedger()
    showToast('Credencial eliminada del navegador. Guarde una clave válida para operar con el servicio.', 'info')
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 pb-2">
      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">Sesion actual</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatusTile
            label="Modo"
            value={mode === 'api' ? 'Red / API' : 'Navegador (sin API)'}
            tone={mode === 'api' ? 'info' : 'ok'}
            help={mode === 'api' ? 'Las operaciones se envían al backend vía proxy.' : 'Los cambios no se envían al backend ni a la red.'}
          />
          <StatusTile label="Rol actual" value={roleLabel} tone="ok" help="Resuelto por la credencial guardada." />
          <StatusTile label="Espacio" value={workspace} tone="info" help="Interfaz adaptada por rol activo." />
          <StatusTile
            label="API key"
            value={maskKey(apiKey)}
            tone={apiKey ? 'ok' : 'warn'}
            help={apiKey ? 'Se muestra enmascarada por seguridad.' : 'Sin clave configurada.'}
          />
          <StatusTile
            label="Estado"
            value={mode === 'api' && !apiKey ? 'No configurado' : hasPendingDraft ? 'Pendiente' : 'Activo'}
            tone={mode === 'api' && !apiKey ? 'warn' : hasPendingDraft ? 'info' : 'ok'}
            help={mode === 'api' ? 'Se enviará en X-API-Key.' : 'Sin cabecera X-API-Key en este modo.'}
          />
        </div>
        {mode === 'api' ? (
          <p className="mt-3 text-xs text-muted">
            La web enviara esta clave en la cabecera <code className="font-mono text-slate-300">X-API-Key</code> via proxy{' '}
            <code className="font-mono text-slate-500">/api</code>. Requiere backend en localhost:3000.
          </p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">Modo de datos</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface/50 px-4 py-3">
            <input
              type="radio"
              name="ds"
              checked={mode === 'demo'}
              onChange={() => setMode('demo')}
              className="border-line text-accent focus:ring-accent/30"
            />
            <span className="text-sm text-slate-200">Solo navegador (sin backend)</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-line bg-surface/50 px-4 py-3">
            <input
              type="radio"
              name="ds"
              checked={mode === 'api'}
              onChange={() => setMode('api')}
              className="border-line text-accent focus:ring-accent/30"
            />
            <span className="text-sm text-slate-200">Red / API (proxy /api)</span>
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-100">Seleccion de rol</h2>
          <p className="text-xs text-muted">
            Credencial actual: <span className="text-accent">{credentialLabel(apiKey)}</span>
          </p>
        </div>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {presets.map((p) => {
            const active = activePresetValue === p.value
            return (
              <button
                key={p.value}
                type="button"
                className={[
                  'relative rounded-xl border px-4 py-4 text-left transition-all',
                  active
                    ? 'border-accent/70 bg-accent/15 ring-2 ring-accent/35'
                    : 'border-line bg-surface/60 hover:border-accent-soft/60 hover:bg-surface',
                ].join(' ')}
                onClick={() => applyPreset(p.value)}
              >
                {active ? (
                  <span className="absolute right-3 top-3 rounded-full bg-accent/25 px-2 py-0.5 text-[10px] font-semibold uppercase text-accent">
                    Activo
                  </span>
                ) : null}
                <p className="pr-16 text-sm font-semibold text-slate-100">{p.role}</p>
                <p className="mt-1 font-mono text-xs text-accent">{p.value}</p>
                <p className="mt-2 text-xs leading-relaxed text-muted">{p.desc}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.perms.map((perm) => (
                    <span key={perm} className="rounded-full border border-line/80 bg-elevated px-2 py-0.5 text-[10px] text-slate-300">
                      {perm}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-slate-500">{p.hint}</p>
              </button>
            )
          })}
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">Permisos efectivos del rol</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <PermChip ok={perms.canRegisterClients} text="Registrar clientes" />
          <PermChip ok={perms.canConsultClients} text="Consultar clientes" />
          <PermChip ok={perms.canEmitTokens} text="Emitir tokens" />
          <PermChip ok={perms.canTransferTokens} text="Transferir tokens" />
          <PermChip ok={perms.canViewHistory} text="Ver historial" />
          <PermChip ok={perms.canViewTraceability} text="Ver trazabilidad" />
          <PermChip ok={perms.canEditDemoRecords} text="Editar en vista sin API" />
          <PermChip ok={perms.canDeleteDemoRecords} text="Quitar filas en vista sin API" />
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-elevated/90 p-5 shadow-card">
        <h2 className="text-sm font-semibold text-slate-100">API key y detalle tecnico</h2>
        <p className="mt-2 text-xs text-muted">
          Claves de ejemplo alineadas a las variables del middleware (entorno de integración).
        </p>
        <p className="mt-1 text-xs text-muted">
          Estas claves deben coincidir con <code className="font-mono text-slate-400">API_KEY_ADMIN</code>,{' '}
          <code className="font-mono text-slate-400">API_KEY_INTEGRADOR</code> y{' '}
          <code className="font-mono text-slate-400">API_KEY_SOLO_LECTURA</code> del .env del backend.
        </p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-muted">Valor manual (editable)</span>
          <input
            className="w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-mono text-sm text-slate-200 outline-none focus:border-accent-soft focus:ring-2 focus:ring-accent/25"
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder="sec-admin"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <button
          type="button"
          className="mt-3 w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 transition-colors hover:bg-accent-hover"
          onClick={applyDraft}
        >
          Guardar API key
        </button>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-xl border border-line bg-surface/70 px-4 py-2.5 text-sm font-medium text-slate-200 transition-colors hover:bg-elevated"
            onClick={clearStoredCredential}
          >
            Quitar credencial del navegador
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted">
          Si la clave quedó corrupta o desactualizada, use &quot;Quitar credencial&quot; y vuelva a guardar. La entrada
          en almacenamiento es <code className="font-mono text-slate-400">{STORAGE_KEY_API_KEY}</code>.
        </p>
        {apiKey ? (
          <p className="mt-2 text-[11px] text-muted">
            Activa: <span className="font-mono text-slate-400">{apiKey.slice(0, 4)}…{apiKey.slice(-2)}</span> ·{' '}
            {apiKey.length} caracteres.
          </p>
        ) : (
          <p className="mt-2 text-[11px] text-amber-200/90">
            No hay clave guardada. En modo API la operacion puede fallar por credencial ausente.
          </p>
        )}
      </section>
    </div>
  )
}

function maskKey(key: string): string {
  if (!key) return 'No configurada'
  if (key.length < 7) return `${key.slice(0, 1)}***${key.slice(-1)}`
  return `${key.slice(0, 3)}***${key.slice(-3)}`
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
      {ok ? 'Si' : 'No'} · {text}
    </span>
  )
}
