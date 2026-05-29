import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSessionLog } from '../context/SessionLogContext'
import { Card } from '../components/ui'
import { formatDateTime } from '../lib/formatDate'

type Merged =
  | { kind: 'message'; at: string; id: string; variant: 'success' | 'error'; titulo: string; detalle?: string }
  | { kind: 'activity'; at: string; id: string; variant: 'ok' | 'err' | 'info'; texto: string }

export default function HistorialPage() {
  const { messages, activities } = useSessionLog()

  const merged = useMemo(() => {
    const list: Merged[] = [
      ...messages.map((m) => ({
        kind: 'message' as const,
        at: m.at,
        id: m.id,
        variant: m.variant,
        titulo: m.titulo,
        detalle: m.detalle,
      })),
      ...activities.map((a) => ({
        kind: 'activity' as const,
        at: a.at,
        id: a.id,
        variant: a.variant,
        texto: a.texto,
      })),
    ]
    list.sort((x, y) => y.at.localeCompare(x.at))
    return list
  }, [messages, activities])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm leading-relaxed text-muted">
        Registro de acciones en esta sesión. Para revisar el historial completo, consulte el panel administrativo.
      </p>
      <Card title="Historial de la sesión">
        {merged.length === 0 ? (
          <p className="text-sm text-muted">Aún no hay acciones registradas en esta sesión.</p>
        ) : (
          <ul className="space-y-3">
            {merged.map((row) =>
              row.kind === 'message' ? (
                <li
                  key={row.id}
                  className={[
                    'rounded-xl border px-4 py-3 text-sm leading-snug',
                    row.variant === 'success'
                      ? 'border-success/30 bg-success-soft text-success-ink'
                      : 'border-danger/30 bg-danger-soft text-danger-ink',
                  ].join(' ')}
                >
                  <p className="font-medium">{row.titulo}</p>
                  {row.detalle ? <p className="mt-1 text-sm opacity-90">{row.detalle}</p> : null}
                  <p className="mt-2 text-xs text-muted">{formatDateTime(row.at)}</p>
                </li>
              ) : (
                <li key={row.id} className="flex gap-3 rounded-xl border border-line bg-white/80 px-4 py-3 text-sm leading-snug">
                  <span
                    className={
                      row.variant === 'ok'
                        ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-success'
                        : row.variant === 'err'
                          ? 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-danger'
                          : 'mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gray-400'
                    }
                  />
                  <div>
                    <p className="text-ink">{row.texto}</p>
                    <p className="mt-0.5 text-xs text-muted">{formatDateTime(row.at)}</p>
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </Card>
      <Link className="portal-link text-sm text-accent hover:underline" to="/">
        Volver al inicio
      </Link>
    </div>
  )
}
