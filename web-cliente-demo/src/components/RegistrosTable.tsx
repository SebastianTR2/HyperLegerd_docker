import type { Registro } from '../types/registro'
import { formatShortDate } from '../lib/format'

interface RegistrosTableProps {
  items: Registro[]
  loading?: boolean
  selectedId: string | null
  onSelect: (id: string) => void
  onEdit: (id: string) => void
  onDelete: (id: string) => void
  /** Si true, la tabla ocupa altura disponible y hace scroll interno */
  fillHeight?: boolean
  /** Modo API: solo selección / ver detalle, sin editar ni eliminar */
  readOnly?: boolean
  allowMutations?: boolean
}

export function RegistrosTable({
  items,
  loading = false,
  selectedId,
  onSelect,
  onEdit,
  onDelete,
  fillHeight = false,
  readOnly = false,
  allowMutations = true,
}: RegistrosTableProps) {
  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-elevated/90 shadow-card ${
        fillHeight ? 'min-h-0 flex-1' : ''
      }`}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Registros</h2>
          <p className="text-xs text-muted">Selecciona una fila para ver el detalle al costado</p>
        </div>
        {loading ? (
          <span className="text-xs text-muted">Cargando…</span>
        ) : (
          <span className="text-xs text-muted">{items.length} filas</span>
        )}
      </div>
      <div className={`min-h-0 ${fillHeight ? 'flex-1 overflow-auto' : 'overflow-x-auto'}`}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur-sm">
            <tr className="text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium sm:px-5">Documento</th>
              <th className="px-4 py-3 font-medium sm:px-5">Nombre</th>
              <th className="px-4 py-3 font-medium sm:px-5">Notas</th>
              <th className="px-4 py-3 font-medium sm:px-5">Estado</th>
              <th className="px-4 py-3 font-medium sm:px-5">Fecha</th>
              <th className="px-4 py-3 text-right font-medium sm:px-5">{readOnly ? 'Ver' : 'Acciones'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {items.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-sm text-muted">
                  No hay registros. Usa el formulario para agregar uno.
                </td>
              </tr>
            ) : null}
            {items.map((r) => {
              const active = r.id === selectedId
              return (
                <tr
                  key={r.id}
                  className={[
                    'transition-colors',
                    active ? 'bg-accent-soft/25' : 'hover:bg-surface/40',
                  ].join(' ')}
                >
                  <td className="px-4 py-3 sm:px-5">
                    <button
                      type="button"
                      className="text-left font-medium text-slate-200 hover:text-accent-hover"
                      onClick={() => onSelect(r.id)}
                    >
                      {r.tipoDocumento} {r.documento}
                    </button>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-muted sm:px-5">{r.nombreCompleto}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted sm:px-5">{r.facultad}</td>
                  <td className="px-4 py-3 sm:px-5">
                    <EstadoBadge estado={r.estado} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted sm:px-5">
                    {formatShortDate(r.fechaRegistro)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right sm:px-5">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg px-2 py-1 text-xs font-medium text-accent hover:bg-accent-soft/30"
                        onClick={() => onSelect(r.id)}
                      >
                        Ver
                      </button>
                      {readOnly || !allowMutations ? null : (
                        <>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-slate-300 hover:bg-surface"
                            onClick={() => onEdit(r.id)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="rounded-lg px-2 py-1 text-xs font-medium text-danger/90 hover:bg-danger/10"
                            onClick={() => onDelete(r.id)}
                          >
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EstadoBadge({ estado }: { estado: Registro['estado'] }) {
  const map = {
    activo: 'bg-success/15 text-success border-success/25',
    inactivo: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
    pendiente: 'bg-amber-500/10 text-amber-200/90 border-amber-500/20',
    baja: 'bg-rose-500/10 text-rose-200/95 border-rose-500/25',
  }
  return (
    <span
      className={[
        'inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize',
        map[estado],
      ].join(' ')}
    >
      {estado}
    </span>
  )
}
