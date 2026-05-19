import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { listarClientesDesdeApi } from '../services/clientesApi'
import type { ClienteListItemDto } from '../types/dto'
import {
  esErrorAccesoServicio,
  logTechnicalApiFailure,
  mensajeErrorCargaGenerica,
} from '../lib/apiErrors'
import { Card, Button, Badge } from '../components/ui'
import { formatDisplayDate } from '../lib/formatDate'
import { useAuth } from '../context/AuthContext'
import { AccesoServicioBloqueado } from '../components/PortalServiceMessages'

export default function ClientesPage() {
  const [params] = useSearchParams()
  const buscar = (params.get('buscar') ?? '').trim().toLowerCase()
  const [rows, setRows] = useState<ClienteListItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [accessBlocked, setAccessBlocked] = useState(false)
  const { readOnly } = useAuth()

  useEffect(() => {
    let ok = true
    setLoading(true)
    setError(null)
    setAccessBlocked(false)
    listarClientesDesdeApi()
      .then((list) => {
        if (ok) setRows(list)
      })
      .catch((e: unknown) => {
        if (!ok) return
        logTechnicalApiFailure('clientes.listar', e)
        setError(mensajeErrorCargaGenerica(e))
        setAccessBlocked(esErrorAccesoServicio(e))
      })
      .finally(() => {
        if (ok) setLoading(false)
      })
    return () => {
      ok = false
    }
  }, [])

  const filtrados = useMemo(() => {
    if (!buscar) return rows
    return rows.filter(
      (r) =>
        r.codigo.toLowerCase().includes(buscar) ||
        r.nombre.toLowerCase().includes(buscar) ||
        r.documentoEtiqueta.toLowerCase().includes(buscar),
    )
  }, [rows, buscar])

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      {accessBlocked ? <AccesoServicioBloqueado /> : null}

      <Card title="Listado de clientes" subtitle="Consulta y gestión de registros.">
        {readOnly ? (
          <p className="mb-3 rounded-xl border border-[#E8E1D8] bg-white/70 px-3 py-2 text-xs text-[#6B7280]">
            Su perfil solo permite consultar información.
          </p>
        ) : null}
        {loading ? (
          <p className="text-sm text-[#6B7280]">Cargando…</p>
        ) : accessBlocked ? (
          <div className="rounded-xl border border-dashed border-[#E8E1D8] bg-white/60 px-4 py-8 text-center text-sm text-[#6B7280]">
            No se pudieron cargar los datos. Intente más tarde o contacte al administrador.
          </div>
        ) : error ? (
          <p className="text-sm text-red-800">{error}</p>
        ) : filtrados.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E8E1D8] bg-white/60 px-4 py-8 text-center">
            <p className="text-sm text-[#1F2937]">No hay clientes registrados todavía.</p>
            <p className="mt-2 text-xs text-[#6B7280]">Cuando registre clientes, aparecerán en esta tabla.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-[#E8E1D8] text-xs text-[#6B7280]">
                  <th className="pb-3 pr-3 font-medium">Código</th>
                  <th className="pb-3 pr-3 font-medium">Documento</th>
                  <th className="pb-3 pr-3 font-medium">Nombre</th>
                  <th className="pb-3 pr-3 font-medium">Estado</th>
                  <th className="pb-3 pr-3 font-medium">Fecha de registro</th>
                  <th className="pb-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.codigo} className="border-b border-[#E8E1D8]/70 hover:bg-[#F5F2EC]/60">
                    <td className="py-3 pr-3 font-mono text-xs text-[#6B7280]">{r.codigo}</td>
                    <td className="py-3 pr-3 text-[#6B7280]">{r.documentoEtiqueta}</td>
                    <td className="py-3 pr-3 text-[#1F2937]">{r.nombre}</td>
                    <td className="py-3 pr-3">
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
                    <td className="py-3 pr-3 text-xs text-[#6B7280]">{formatDisplayDate(r.fechaRegistro)}</td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2">
                        <Link to={`/clientes/${encodeURIComponent(r.codigo)}`}>
                          <Button variant="secondary">Ver</Button>
                        </Link>
                        {!readOnly ? (
                          <>
                            <Link to={`/clientes/${encodeURIComponent(r.codigo)}/editar`}>
                              <Button
                                variant="secondary"
                                disabled={r.esBajaLogica || r.estadoCodigo === 'DADO_DE_BAJA'}
                              >
                                Editar
                              </Button>
                            </Link>
                            <Link to={`/clientes/${encodeURIComponent(r.codigo)}?intent=baja`}>
                              <Button
                                variant="secondary"
                                disabled={r.esBajaLogica || r.estadoCodigo === 'DADO_DE_BAJA'}
                              >
                                Dar de baja
                              </Button>
                            </Link>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
