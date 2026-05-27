import { useMemo, useState } from 'react'
import { ActivityFeed } from '../components/ActivityFeed'
import { useDemoStore } from '../context/DemoStoreContext'
import type { DemoEventType } from '../types/demo'

// Filtros del historial: la consola del puente es audit-only y no maneja
// tokens, por lo que ocultamos los filtros de token_emitido/transferido.
const filtrosHistorialLista: { id: DemoEventType | 'all'; label: string }[] = [
  { id: 'all', label: 'Todos' },
  { id: 'registro_creado', label: 'Alta' },
  { id: 'registro_editado', label: 'Edición' },
  { id: 'registro_eliminado', label: 'Baja' },
  { id: 'consulta', label: 'Consultas' },
]

function filtrosHistorial(): typeof filtrosHistorialLista {
  return filtrosHistorialLista
}

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
        {filtrosHistorial().map((f) => (
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
        emptyText={
          eventos.length === 0 && tipo === 'all'
            ? 'No hay operaciones registradas.'
            : 'No hay operaciones con este filtro.'
        }
        showHistorialLink={false}
        className="min-h-0 flex-1"
      />
    </div>
  )
}
