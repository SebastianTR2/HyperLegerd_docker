import { useDemoStore } from '../context/DemoStoreContext'

export function ToastStack() {
  const { toasts, dismissToast } = useDemoStore()
  if (toasts.length === 0) return null
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex max-w-sm flex-col gap-2 sm:bottom-6 sm:right-6"
      role="status"
    >
      {toasts.map((t) => (
        <button
          key={t.id}
          type="button"
          className={[
            'pointer-events-auto w-full rounded-xl border px-4 py-3 text-left text-sm shadow-card backdrop-blur-md transition-transform',
            t.variant === 'success' && 'border-success/30 bg-success/15 text-success',
            t.variant === 'error' && 'border-danger/35 bg-danger/15 text-danger/95',
            t.variant === 'info' && 'border-line bg-elevated/95 text-slate-200',
          ]
            .filter(Boolean)
            .join(' ')}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
          <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-muted">
            Clic para cerrar
          </span>
        </button>
      ))}
    </div>
  )
}
