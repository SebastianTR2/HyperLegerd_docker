import { useState } from 'react'
import type { Registro } from '../types/registro'

interface RegistroDetailPanelProps {
  registro: Registro | null
  onEditar: () => void
  onEliminar: () => void
  /** Ocupa altura disponible y hace scroll interno en el contenido */
  fill?: boolean
  /** Solo lectura (modo API): oculta editar / eliminar */
  readOnly?: boolean
}

export function RegistroDetailPanel({
  registro,
  onEditar,
  onEliminar,
  fill = false,
  readOnly = false,
}: RegistroDetailPanelProps) {
  const [copied, setCopied] = useState(false)

  const shell = fill
    ? 'flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-line bg-elevated/90 shadow-card'
    : 'rounded-2xl border border-line bg-elevated/90 shadow-card'

  if (!registro) {
    return (
      <div
        className={`${shell} flex flex-col items-center justify-center p-6 text-center ${
          fill ? 'min-h-[200px] flex-1 border-dashed bg-elevated/40' : 'min-h-[280px] border-dashed bg-elevated/40'
        }`}
      >
        <p className="text-sm font-medium text-slate-300">Sin registro seleccionado</p>
        <p className="mt-2 max-w-xs text-xs text-muted">
          Elige una fila en la tabla o pulsa <span className="text-slate-400">Ver</span> para ver el detalle aquí.
        </p>
      </div>
    )
  }

  const copyTx = async () => {
    const t = registro.referenciaTrazabilidad
    if (!t) return
    try {
      await navigator.clipboard.writeText(t)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const rows: { k: string; v: string }[] = [
    { k: 'clienteId', v: registro.id },
    { k: 'Tipo y documento', v: `${registro.tipoDocumento} ${registro.documento}` },
    { k: 'Nombre completo', v: registro.nombreCompleto },
    { k: 'Correo', v: registro.email || '—' },
    ...(registro.telefono ? [{ k: 'telefono', v: registro.telefono }] : []),
    { k: 'notas', v: registro.facultad },
    { k: 'Estado', v: registro.estado },
    {
      k: 'Fecha de registro / alta',
      v: new Date(registro.fechaRegistro).toLocaleString('es-PE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    },
  ]

  return (
    <div className={shell}>
      <div className="flex shrink-0 flex-wrap items-start justify-between gap-3 border-b border-line p-4 sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Detalle del registro</h2>
          <p className="text-xs text-muted">
            {readOnly ? 'Datos desde la API / caché de la aplicación' : 'Vista sin API · mismos campos que el backend'}
          </p>
        </div>
        {readOnly ? null : (
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={onEditar}>
              Editar
            </button>
            <button type="button" className={btnDanger} onClick={onEliminar}>
              Eliminar
            </button>
          </div>
        )}
      </div>
      <dl className={`space-y-3 p-4 sm:p-5 ${fill ? 'min-h-0 flex-1 overflow-y-auto' : ''}`}>
        {rows.map((r) => (
          <div key={r.k}>
            <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{r.k}</dt>
            <dd className="mt-0.5 text-sm text-slate-200">{r.v}</dd>
          </div>
        ))}
        <div>
          <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {readOnly ? 'txId / referencia' : 'Referencia generada (solo navegador)'}
          </dt>
          <dd className="mt-1 break-all font-mono text-xs text-slate-400">
            {registro.referenciaTrazabilidad ?? '— Sin referencia en este registro —'}
          </dd>
          {registro.referenciaTrazabilidad ? (
            <button type="button" className={`${btnGhost} mt-2 text-xs`} onClick={() => void copyTx()}>
              {copied ? 'Copiado' : 'Copiar referencia'}
            </button>
          ) : null}
        </div>
      </dl>
    </div>
  )
}

const btnGhost =
  'rounded-xl border border-line bg-surface/60 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-elevated'

const btnDanger =
  'rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs font-medium text-danger/95 transition-colors hover:bg-danger/20'
