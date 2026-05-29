import { useState, type ReactNode } from 'react'

const card =
  'portal-card admin-card transition-shadow duration-200 hover:shadow-card-hover'

export function Card({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`${card} ${className}`}>
      {(title || subtitle) && (
        <div className="admin-card-header">
          {title ? <h2 className="admin-card-title">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-muted">{subtitle}</p> : null}
        </div>
      )}
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  )
}

export function Button({
  children,
  variant = 'primary',
  className = '',
  disabled,
  loading,
  type = 'button',
  onClick,
}: {
  children: ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  className?: string
  disabled?: boolean
  loading?: boolean
  type?: 'button' | 'submit'
  onClick?: () => void
}) {
  const portal =
    variant === 'primary'
      ? 'portal-btn-primary admin-btn-primary'
      : variant === 'danger'
        ? 'portal-btn-danger admin-btn-danger'
        : variant === 'ghost'
          ? 'portal-btn-ghost admin-btn-ghost'
          : 'portal-btn-secondary admin-btn-secondary'
  return (
    <button
      type={type}
      className={`${portal} ${className}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? 'Procesando…' : children}
    </button>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'success' | 'danger' | 'neutral' | 'warn'
}) {
  const portal =
    tone === 'success'
      ? 'portal-badge-success border-success/30 bg-success-soft text-success-ink'
      : tone === 'danger'
        ? 'portal-badge-danger border-danger/30 bg-danger-soft text-danger-ink'
        : tone === 'warn'
          ? 'portal-badge-warn border-warning/35 bg-warning-soft text-warning-ink'
          : 'portal-badge-neutral border-line bg-gray-100 text-ink-secondary'
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${portal}`}>
      {children}
    </span>
  )
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-secondary">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs leading-relaxed text-muted">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-xs font-medium text-danger-ink">{error}</p> : null}
    </label>
  )
}

const inputClass = 'portal-field admin-input'

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={[inputClass, props.className].filter(Boolean).join(' ')} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={[inputClass, props.className].filter(Boolean).join(' ')} />
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={[inputClass, props.className].filter(Boolean).join(' ')} />
}

export function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-md border border-line bg-gray-50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-ink-secondary hover:bg-white"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <span className="text-muted">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="border-t border-line px-3 py-2 text-xs leading-relaxed text-muted">{children}</div>
      ) : null}
    </div>
  )
}

export function Modal({
  open,
  title,
  children,
  footer,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
}) {
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-md border border-line bg-surface shadow-card-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="admin-card-header flex items-start justify-between">
          <h3 className="text-base font-semibold text-ink">{title}</h3>
          <button
            type="button"
            className="rounded-md px-2 py-1 text-sm text-muted transition-colors hover:bg-gray-100 hover:text-ink"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div className="px-5 py-4 text-sm leading-relaxed text-ink-secondary">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-gray-50 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
