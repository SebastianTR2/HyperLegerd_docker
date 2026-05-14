import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { listarClientesDesdeApi } from '../services/clientesApi'
import type { ClienteListItemDto } from '../types/dto'
import {
  esErrorAccesoServicio,
  logTechnicalApiFailure,
  mensajeErrorCargaGenerica,
  MENSAJE_ACCESO_SERVICIO,
} from '../lib/apiErrors'
import { Card, Button, Badge } from '../components/ui'
import { formatDisplayDate } from '../lib/formatDate'
import { useSessionLog } from '../context/SessionLogContext'
import { useSettings } from '../context/SettingsContext'
import { AccesoServicioBloqueado, ServicioNoConfigurado } from '../components/PortalServiceMessages'

export default function InicioPage() {
  const { messages, activities } = useSessionLog()
  const { isServiceConfigured } = useSettings()
  const [items, setItems] = useState<ClienteListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessBlocked, setAccessBlocked] = useState(false)

  useEffect(() => {
    if (!isServiceConfigured) {
      setItems([])
      setError(null)
      setAccessBlocked(false)
      setLoading(false)
      return
    }
    let ok = true
    setLoading(true)
    setError(null)
    setAccessBlocked(false)
    listarClientesDesdeApi()
      .then((list) => {
        if (ok) setItems(list)
      })
      .catch((e: unknown) => {
        if (!ok) return
        logTechnicalApiFailure('inicio.listarClientes', e)
        setError(mensajeErrorCargaGenerica(e))
        setAccessBlocked(esErrorAccesoServicio(e))
      })
      .finally(() => {
        if (ok) setLoading(false)
      })
    return () => {
      ok = false
    }
  }, [isServiceConfigured])

  const recientes = items.slice(0, 5)
  const total = items.length

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {!isServiceConfigured ? (
        <ServicioNoConfigurado />
      ) : accessBlocked && error ? (
        <AccesoServicioBloqueado />
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card title="Resumen" subtitle="Clientes disponibles en el listado.">
              {loading ? (
                <p className="text-sm text-[#6B7280]">Cargando…</p>
              ) : !isServiceConfigured ? (
                <div className="space-y-1">
                  <p className="text-2xl font-semibold text-[#6B7280]">—</p>
                  <p className="text-xs text-[#6B7280]">Conecte el portal para ver datos actualizados.</p>
                </div>
              ) : error && !accessBlocked ? (
                <p className="text-sm text-red-800">{error}</p>
              ) : accessBlocked ? (
                <div className="space-y-1">
                  <p className="text-2xl font-semibold text-[#6B7280]">—</p>
                  <p className="text-xs text-[#6B7280]">No se pudieron obtener los datos en este momento.</p>
                </div>
              ) : (
                <>
                  <p className="text-2xl font-semibold text-[#1F2937]">{total}</p>
                  <p className="mt-1 text-xs text-[#6B7280]">Clientes registrados en el sistema.</p>
                </>
              )}
            </Card>
            <Card title="Accesos rápidos" subtitle="Operaciones habituales.">
              <div className="flex flex-col gap-2">
                <Link to="/clientes/nuevo">
                  <Button className="w-full" disabled={!isServiceConfigured}>
                    Registrar nuevo cliente
                  </Button>
                </Link>
                <Link to="/clientes">
                  <Button variant="secondary" className="w-full">
                    Ver clientes
                  </Button>
                </Link>
              </div>
            </Card>
          </div>

          <Card title="Clientes recientes" subtitle="Últimos registros visibles en el listado.">
            {loading ? (
              <p className="text-sm text-[#6B7280]">Cargando…</p>
            ) : !isServiceConfigured ? (
              <div className="rounded-xl border border-dashed border-[#E8E1D8] bg-white/60 px-4 py-8 text-center">
                <p className="text-sm text-[#1F2937]">No hay clientes registrados todavía.</p>
                <p className="mt-2 text-xs text-[#6B7280]">Cuando el portal esté conectado y registre clientes, aparecerán aquí.</p>
              </div>
            ) : accessBlocked ? (
              <div className="rounded-xl border border-dashed border-[#E8E1D8] bg-white/60 px-4 py-8 text-center">
                <p className="text-sm text-[#1F2937]">No hay datos para mostrar.</p>
                <p className="mt-2 text-xs text-[#6B7280]">Cuando el acceso al servicio se restablezca, podrá ver el listado aquí.</p>
              </div>
            ) : error ? (
              <p className="text-sm text-red-800">{error}</p>
            ) : recientes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E8E1D8] bg-white/60 px-4 py-8 text-center">
                <p className="text-sm text-[#1F2937]">No hay clientes registrados todavía.</p>
                <p className="mt-2 text-xs text-[#6B7280]">Cuando registres clientes, aparecerán aquí.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[#E8E1D8] text-xs text-[#6B7280]">
                      <th className="pb-2 pr-3 font-medium">Código</th>
                      <th className="pb-2 pr-3 font-medium">Documento</th>
                      <th className="pb-2 pr-3 font-medium">Nombre</th>
                      <th className="pb-2 pr-3 font-medium">Estado</th>
                      <th className="pb-2 font-medium">Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recientes.map((r) => (
                      <tr key={r.codigo} className="border-b border-[#E8E1D8]/80 hover:bg-[#F5F2EC]/70">
                        <td className="py-2 pr-3 font-mono text-xs text-[#6B7280]">
                          <Link className="portal-link text-[#D97706] hover:underline" to={`/clientes/${encodeURIComponent(r.codigo)}`}>
                            {r.codigo}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 text-[#6B7280]">{r.documentoEtiqueta}</td>
                        <td className="py-2 pr-3 text-[#1F2937]">{r.nombre}</td>
                        <td className="py-2 pr-3">
                          <Badge
                            tone={
                              r.estadoCodigo === 'ACTIVO'
                                ? 'success'
                                : r.esBajaLogica || r.estadoCodigo === 'DADO_DE_BAJA'
                                  ? 'danger'
                                  : 'neutral'
                            }
                          >
                            {r.estadoEtiqueta}
                          </Badge>
                        </td>
                        <td className="py-2 text-xs text-[#6B7280]">{formatDisplayDate(r.fechaRegistro)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card title="Mensajes recientes" subtitle="Avisos de esta sesión.">
            {messages.length === 0 ? (
              <p className="text-sm text-[#6B7280]">No hay mensajes en esta sesión.</p>
            ) : (
              <ul className="space-y-2">
                {messages.slice(0, 6).map((m) => {
                  const acceso = m.titulo === MENSAJE_ACCESO_SERVICIO
                  return (
                    <li
                      key={m.id}
                      className={[
                        'rounded-xl border px-3 py-2.5 text-xs',
                        m.variant === 'success'
                          ? 'border-green-200 bg-green-50 text-green-800'
                          : acceso
                            ? 'border-amber-200 bg-amber-50 text-amber-900'
                            : m.variant === 'error'
                              ? 'border-red-200 bg-red-50 text-red-800'
                              : 'border-[#E8E1D8] bg-[#F5F2EC] text-[#1F2937]',
                      ].join(' ')}
                    >
                      <p className="font-medium">{m.titulo}</p>
                      {m.detalle ? <p className="mt-0.5 text-[11px] opacity-90">{m.detalle}</p> : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <Card title="Actividad reciente" subtitle="Movimientos registrados en esta sesión.">
            {activities.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#E8E1D8] bg-white/60 px-4 py-6 text-center">
                <p className="text-sm text-[#6B7280]">No hay actividad reciente en esta sesión.</p>
              </div>
            ) : (
              <ul className="space-y-2">
                {activities.slice(0, 8).map((a) => (
                  <li key={a.id} className="flex gap-2 text-sm leading-snug text-[#6B7280]">
                    <span
                      className={
                        a.variant === 'ok'
                          ? 'mt-1 h-2 w-2 shrink-0 rounded-full bg-green-700'
                          : a.variant === 'err'
                            ? 'mt-1 h-2 w-2 shrink-0 rounded-full bg-[#C75C5C]'
                            : 'mt-1 h-2 w-2 shrink-0 rounded-full bg-[#9CA3AF]'
                      }
                    />
                    <span className="text-[#6B7280]">{a.texto}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
