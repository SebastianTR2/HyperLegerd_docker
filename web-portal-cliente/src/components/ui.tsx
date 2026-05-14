import { useState, type ReactNode } from 'react'

const card =
  'portal-card rounded-2xl border border-[#E8E1D8] bg-white shadow-card transition-shadow duration-200 hover:shadow-card-hover'

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
        <div className="border-b border-[#E8E1D8]/80 bg-[#F5F2EC]/50 px-5 py-4 sm:px-6">
          {title ? <h2 className="text-base font-semibold tracking-tight text-[#1F2937]">{title}</h2> : null}
          {subtitle ? <p className="mt-1 text-sm leading-relaxed text-[#6B7280]">{subtitle}</p> : null}
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
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none'
  const portal =
    variant === 'primary'
      ? 'portal-btn-primary bg-[#D97706] text-white hover:bg-[#C96E0A] hover:shadow-md active:scale-[0.98]'
      : variant === 'danger'
        ? 'portal-btn-danger border border-[#FECACA] bg-white text-[#991B1B] hover:bg-[#FEE2E2] hover:border-[#FECACA]'
        : variant === 'ghost'
          ? 'portal-btn-ghost border border-transparent bg-transparent text-[#374151] shadow-none hover:bg-[#F5F2EC]'
          : 'portal-btn-secondary border border-[#E8E1D8] bg-white text-[#1F2937] shadow-none hover:border-[#D97706]/30 hover:bg-[#FFF1E6]/50'
  return (
    <button
      type={type}
      className={`${base} ${portal} ${className}`}
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
      ? 'portal-badge-success border-green-200 bg-green-50 text-green-800'
      : tone === 'danger'
        ? 'portal-badge-danger border-red-200 bg-red-50 text-red-800'
        : tone === 'warn'
          ? 'portal-badge-warn border-amber-200 bg-amber-50 text-amber-900'
          : 'portal-badge-neutral border-[#E8E1D8] bg-[#F5F2EC] text-[#374151]'
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
      <span className="mb-1.5 block text-sm font-medium text-[#374151]">
        {label}
        {required ? <span className="text-[#C75C5C]"> *</span> : null}
      </span>
      {children}
      {hint && !error ? <p className="mt-1.5 text-xs leading-relaxed text-[#6B7280]">{hint}</p> : null}
      {error ? <p className="mt-1.5 text-xs font-medium text-[#991B1B]">{error}</p> : null}
    </label>
  )
}

const inputClass =
  'portal-field w-full rounded-xl border border-[#E8E1D8] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition-shadow placeholder:text-[#6B7280]/70 focus:border-[#D97706] focus:ring-2 focus:ring-[#D97706]/20 disabled:bg-[#F5F2EC] disabled:text-[#6B7280]'

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
    <div className="rounded-xl border border-[#E8E1D8] bg-[#F5F2EC]/50">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm font-medium text-[#374151] hover:bg-white/90"
        onClick={() => setOpen((o) => !o)}
      >
        {title}
        <span className="text-[#6B7280]">{open ? '−' : '+'}</span>
      </button>
      {open ? (
        <div className="border-t border-[#E8E1D8] px-3 py-2 text-xs leading-relaxed text-[#6B7280]">{children}</div>
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#1F2937]/40 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[#E8E1D8] bg-white shadow-[0_20px_50px_rgba(31,41,55,0.15)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-[#E8E1D8] bg-[#F5F2EC]/40 px-5 py-4">
          <h3 className="text-base font-semibold text-[#1F2937]">{title}</h3>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-sm text-[#6B7280] transition-colors hover:bg-white hover:text-[#1F2937]"
            onClick={onClose}
          >
            Cerrar
          </button>
        </div>
        <div className="px-5 py-4 text-sm leading-relaxed text-[#374151]">{children}</div>
        {footer ? (
          <div className="flex flex-wrap justify-end gap-2 border-t border-[#E8E1D8] bg-[#F5F2EC]/30 px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
