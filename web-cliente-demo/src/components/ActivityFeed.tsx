import { Link } from 'react-router-dom'
import type { DemoEvent, DemoEventType } from '../types/demo'
import { formatDemoDateTime } from '../lib/format'

function tipoOperacionLabel(t: DemoEventType): string {
  const m: Record<DemoEventType, string> = {
    registro_creado: 'Alta de cliente',
    registro_editado: 'Actualización de cliente',
    registro_eliminado: 'Baja lógica (vista)',
    token_emitido: 'Emisión de token',
    token_transferido: 'Transferencia de token',
    consulta: 'Consulta',
  }
  return m[t]
}

function looksLikeFabricTxId(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s.trim())
}

interface ActivityFeedProps {
  items: DemoEvent[]
  title?: string
  subtitle?: string
  emptyText?: string
  showHistorialLink?: boolean
  className?: string
  bodyClassName?: string
}

export function ActivityFeed({
  items,
  title = 'Actividad reciente',
  subtitle = 'Datos obtenidos desde la red/API o acciones en esta ventana',
  emptyText = 'No hay actividades recientes.',
  showHistorialLink = true,
  className = '',
  bodyClassName = '',
}: ActivityFeedProps) {
  return (
    <div
      className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-elevated/90 shadow-card ${className}`}
    >
      <div className="shrink-0 border-b border-line px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <div className={`min-h-0 flex-1 space-y-2 overflow-y-auto p-3 sm:p-4 ${bodyClassName}`}>
        {items.length === 0 ? (
          <p className="py-8 text-center text-xs text-muted">{emptyText}</p>
        ) : null}
        {items.map((a) => {
          const ok = a.estado === 'exito'
          const cardClass = ok
            ? 'rounded-xl border border-success/30 bg-success/[0.11] p-3 shadow-sm transition-colors hover:border-success/45 hover:bg-success/[0.14]'
            : 'rounded-xl border border-danger/30 bg-danger/[0.11] p-3 shadow-sm transition-colors hover:border-danger/45 hover:bg-danger/[0.14]'
          const badgeClass = ok
            ? 'shrink-0 rounded-full border border-success/45 bg-success/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-100 shadow-[0_0_0_1px_rgba(74,157,122,0.12)]'
            : 'shrink-0 rounded-full border border-danger/45 bg-danger/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-100 shadow-[0_0_0_1px_rgba(184,92,92,0.12)]'
          const ref = a.referencia?.trim() ?? ''
          const txId = ref && looksLikeFabricTxId(ref) ? ref : null
          const refShort =
            ref && !txId ? `${ref.slice(0, 10)}…${ref.slice(-6)}` : null
          return (
            <article key={a.id} className={cardClass}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    {tipoOperacionLabel(a.tipo)}
                  </p>
                  <p className="text-sm font-medium text-slate-200">{a.titulo}</p>
                </div>
                <span className={badgeClass}>{ok ? 'ÉXITO' : 'ERROR'}</span>
              </div>
              <p className="mt-1 text-xs text-muted">{a.mensaje}</p>
              <div className="mt-2 flex flex-col gap-1 text-[11px] text-muted">
                <div className="flex flex-wrap items-center gap-2">
                  <span>{formatDemoDateTime(a.fechaIso)}</span>
                  {refShort ? (
                    <>
                      <span className="text-line">·</span>
                      <span className="font-mono text-slate-500" title={ref}>
                        {refShort}
                      </span>
                    </>
                  ) : null}
                </div>
                {txId ? (
                  <p className="break-all font-mono text-[10px] text-slate-500" title={txId}>
                    TXID: {txId}
                  </p>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
      {showHistorialLink ? (
        <div className="shrink-0 border-t border-line p-3 sm:p-4">
          <Link
            to="/historial"
            className="block w-full rounded-xl border border-line bg-surface/60 py-2.5 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-elevated hover:text-slate-100"
          >
            Ver historial completo
          </Link>
        </div>
      ) : null}
    </div>
  )
}
