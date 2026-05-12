import { useMemo, useState } from 'react'
import { ActivityFeed } from '../components/ActivityFeed'
import { useDemoStore } from '../context/DemoStoreContext'
import type { DemoEventType } from '../types/demo'

const filtros: { id: DemoEventType | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'registro_creado', label: 'Alta' },
  { id: 'registro_editado', label: 'Edición' },
  { id: 'registro_eliminado', label: 'Baja' },
  { id: 'token_emitido', label: 'Token emitido' },
  { id: 'token_transferido', label: 'Transferencia' },
  { id: 'consulta', label: 'Consultas' },
]

export default function HistorialPage() {
  const { eventos } = useDemoStore()
  const [tipo, setTipo] = useState<DemoEventType | 'all'>('all')

  const filtrados = useMemo(() => {
    if (tipo === 'all') return eventos
    return eventos.filter((e) => e.tipo === tipo)
  }, [eventos, tipo])

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap gap-2">
        {filtros.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTipo(f.id)}
            className={[
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              tipo === f.id
                ? 'border-accent-soft bg-accent-soft/30 text-slate-100'
                : 'border-line bg-surface/50 text-muted hover:border-accent-soft/40 hover:text-slate-200',
            ].join(' ')}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ActivityFeed
        items={filtrados}
        title="Historial de operaciones"
        subtitle={`${filtrados.length} operación(es) con el filtro actual`}
        emptyText="No hay operaciones con este filtro."
        showHistorialLink={false}
        className="min-h-0 flex-1"
      />
    </div>
  )
}
