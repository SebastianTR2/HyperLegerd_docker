import { useEffect, useState } from 'react'
import type { ClienteApi } from '../types/api'
import type { Registro } from '../types/registro'
import { emptyClienteForm, registroToClienteForm } from '../lib/clienteFormMappers'

type Modo = 'crear' | 'editar'

const inputClass =
  'w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-slate-200 outline-none transition-shadow placeholder:text-slate-500 focus:border-accent-soft focus:ring-2 focus:ring-accent/25'

const btnPrimary =
  'inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-slate-100 shadow-sm transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50'

const btnSecondary =
  'inline-flex items-center justify-center rounded-xl border border-line bg-transparent px-4 py-2.5 text-sm font-medium text-slate-300 transition-colors hover:bg-surface hover:text-slate-100'

export interface RegistroFormProps {
  mode: 'demo' | 'api'
  modo: Modo
  inicial?: Registro | null
  busy: boolean
  onSubmit: (body: ClienteApi) => Promise<void>
  onCancelarEdicion: () => void
  onLimpiar: () => void
  onPedirNuevo: () => void
  onPedirEditar: () => void
  puedeEditar: boolean
  /** Solo API + modo crear: ofrecer crear cuenta token visible con el mismo clienteId. */
  opcionCrearCuentaTokenVisible?: { checked: boolean; onChange: (v: boolean) => void } | null
}

export function RegistroForm({
  mode,
  modo,
  inicial,
  busy,
  onSubmit,
  onCancelarEdicion,
  onLimpiar,
  onPedirNuevo,
  onPedirEditar,
  puedeEditar,
  opcionCrearCuentaTokenVisible,
}: RegistroFormProps) {
  const [form, setForm] = useState<ClienteApi>(emptyClienteForm)

  useEffect(() => {
    if (modo === 'editar' && inicial) {
      setForm(registroToClienteForm(inicial))
    } else {
      setForm(emptyClienteForm())
    }
  }, [modo, inicial])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await onSubmit(form)
      if (modo === 'crear') setForm(emptyClienteForm())
    } catch {
      /* el padre muestra error; no limpiar */
    }
  }

  const headerTitle = mode === 'api' ? 'Registrar cliente (API)' : 'Registro de cliente'
  const headerHint =
    mode === 'api'
      ? 'Mismo esquema que POST /clientes. clienteId ej. CLI001. Opcionales: teléfono, email, notas (facultad u observaciones).'
      : 'Mismos campos que el backend; en modo sin API los datos quedan solo en este navegador. clienteId define el id de la fila (ej. CLI001).'

  return (
    <div className="rounded-2xl border border-line bg-elevated/90 shadow-card">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        {mode === 'demo' ? (
          <>
            <h2 className="text-sm font-semibold text-slate-100">Registro de cliente</h2>
            <div className="mt-2 flex gap-1 rounded-xl bg-surface/80 p-1">
            <button
              type="button"
              className={[
                'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
                modo === 'crear' ? 'bg-elevated text-slate-100 shadow-sm' : 'text-muted hover:text-slate-200',
              ].join(' ')}
              onClick={() => onPedirNuevo()}
            >
              Nuevo registro
            </button>
            <button
              type="button"
              disabled={!puedeEditar}
              className={[
                'flex-1 rounded-lg px-3 py-2 text-xs font-medium transition-colors sm:text-sm',
                modo === 'editar' ? 'bg-elevated text-slate-100 shadow-sm' : 'text-muted hover:text-slate-200',
                !puedeEditar ? 'cursor-not-allowed opacity-40' : '',
              ].join(' ')}
            onClick={() => onPedirEditar()}
          >
            Editar selección
          </button>
            </div>
          </>
        ) : (
          <h2 className="text-sm font-semibold text-slate-100">{headerTitle}</h2>
        )}
        {mode === 'demo' ? (
          <p className="mt-2 text-xs text-muted">{headerHint}</p>
        ) : (
          <p className="mt-1 text-xs text-muted">{headerHint}</p>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="clienteId *">
            <input
              className={inputClass}
              required
              disabled={mode === 'demo' && modo === 'editar'}
              value={form.clienteId}
              onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))}
              placeholder="CLI001"
            />
          </Field>
          <Field label="nombre *">
            <input
              className={inputClass}
              required
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              placeholder="Nombre completo"
            />
          </Field>
          <Field label="tipoDocumento *">
            <select
              className={inputClass}
              value={form.tipoDocumento}
              onChange={(e) => setForm((f) => ({ ...f, tipoDocumento: e.target.value }))}
            >
              <option value="CI">CI</option>
              <option value="NIT">NIT</option>
              <option value="PASAPORTE">PASAPORTE</option>
            </select>
          </Field>
          <Field label="numeroDocumento *">
            <input
              className={inputClass}
              required
              value={form.numeroDocumento}
              onChange={(e) => setForm((f) => ({ ...f, numeroDocumento: e.target.value }))}
              placeholder="Número de documento"
            />
          </Field>
          <Field label="fechaAlta * (YYYY-MM-DD)">
            <input
              className={inputClass}
              type="date"
              required
              value={form.fechaAlta}
              onChange={(e) => setForm((f) => ({ ...f, fechaAlta: e.target.value }))}
            />
          </Field>
          <Field label="estado *">
            <select
              className={inputClass}
              value={form.estado}
              onChange={(e) => setForm((f) => ({ ...f, estado: e.target.value }))}
            >
              <option value="ACTIVO">ACTIVO</option>
              <option value="INACTIVO">INACTIVO</option>
            </select>
          </Field>
          <Field label="telefono (opcional)">
            <input
              className={inputClass}
              value={form.telefono ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              placeholder="Opcional"
            />
          </Field>
          <Field label="email (opcional)">
            <input
              className={inputClass}
              type="email"
              value={form.email ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="Opcional"
            />
          </Field>
          <Field label="notas (opcional)" className="sm:col-span-2">
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={form.notas ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              placeholder="Facultad, dependencia u observaciones (se envían como notas en API)"
            />
          </Field>
        </div>
        {mode === 'api' && modo === 'crear' && opcionCrearCuentaTokenVisible ? (
          <label className="mb-1 flex cursor-pointer items-start gap-2 rounded-xl border border-line bg-surface/50 px-3 py-2.5 text-xs text-slate-300">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={opcionCrearCuentaTokenVisible.checked}
              onChange={(e) => opcionCrearCuentaTokenVisible.onChange(e.target.checked)}
            />
            <span>
              Tras el alta, crear también una{' '}
              <strong className="text-slate-200">cuenta token visible</strong> cuyo alias sea el mismo{' '}
              <code className="font-mono text-slate-400">clienteId</code> (recomendado: minúsculas, sin espacios).
            </span>
          </label>
        ) : null}
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className={btnSecondary}
            onClick={() => {
              onLimpiar()
              setForm(modo === 'editar' && inicial ? registroToClienteForm(inicial) : emptyClienteForm())
            }}
          >
            Limpiar
          </button>
          {mode === 'demo' && modo === 'editar' ? (
            <button type="button" className={btnSecondary} onClick={onCancelarEdicion}>
              Cancelar edición
            </button>
          ) : null}
          <button type="submit" className={`${btnPrimary} ml-auto`} disabled={busy}>
            {busy
              ? 'Guardando…'
              : mode === 'api'
                ? 'Registrar en blockchain (API)'
                : modo === 'editar'
                  ? 'Guardar cambios'
                  : 'Guardar registro'}
          </button>
        </div>
      </form>
    </div>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={['block', className ?? ''].join(' ')}>
      <span className="mb-1.5 block text-xs font-medium text-muted">{label}</span>
      {children}
    </label>
  )
}
