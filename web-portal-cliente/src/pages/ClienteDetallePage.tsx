import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { consultarClienteDesdeApi, darBajaClienteDesdeApi } from '../services/clientesApi'
import type { ClienteDetalleDto } from '../types/dto'
import { ApiHttpError } from '../services/apiClient'
import {
  logTechnicalApiFailure,
  mensajeClienteNoEncontrado,
} from '../lib/apiErrors'
import { AccesoServicioBloqueado } from '../components/PortalServiceMessages'
import { Card, Button, Badge, Modal, Accordion } from '../components/ui'
import { formatDisplayDate } from '../lib/formatDate'
import { logClienteBaja, logConsultaCliente, useSessionLog } from '../context/SessionLogContext'
import { useAuth } from '../context/AuthContext'

export default function ClienteDetallePage() {
  const { clienteId: rawId } = useParams()
  const clienteId = rawId ? decodeURIComponent(rawId) : ''
  const [search] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryStr = search.toString()
  const [data, setData] = useState<ClienteDetalleDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [accessBlocked, setAccessBlocked] = useState(false)
  const [confirmBaja, setConfirmBaja] = useState(false)
  const [bajaSubmitting, setBajaSubmitting] = useState(false)
  const [bajaError, setBajaError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const log = useSessionLog()
  const { readOnly } = useAuth()

  useEffect(() => {
    const st = location.state as { flashCliente?: string } | null
    if (st?.flashCliente) {
      setFlash(st.flashCliente)
      navigate({ pathname: location.pathname, search: location.search }, { replace: true, state: {} })
    }
  }, [location.pathname, location.search, location.state, navigate])

  useEffect(() => {
    const sp = new URLSearchParams(queryStr)
    if (sp.get('intent') !== 'baja') return
    setConfirmBaja(true)
    sp.delete('intent')
    const qs = sp.toString()
    navigate({ pathname: `/clientes/${encodeURIComponent(clienteId)}`, search: qs ? `?${qs}` : '' }, { replace: true })
  }, [clienteId, navigate, queryStr])

  function recargarDetalle() {
    if (!clienteId) return
    consultarClienteDesdeApi(clienteId)
      .then((d) => {
        if (d) {
          setData(d)
          logConsultaCliente(log, true, clienteId)
        } else {
          setNotFound(true)
        }
      })
      .catch((e: unknown) => {
        if (e instanceof ApiHttpError && e.status === 404) {
          setNotFound(true)
        }
      })
  }

  useEffect(() => {
    if (!clienteId) return
    let ok = true
    setLoading(true)
    setNotFound(false)
    setAccessBlocked(false)
    consultarClienteDesdeApi(clienteId)
      .then((d) => {
        if (!ok) return
        if (d) {
          setData(d)
          logConsultaCliente(log, true, clienteId)
        } else {
          setNotFound(true)
          logConsultaCliente(log, false, clienteId)
        }
      })
      .catch((e: unknown) => {
        if (!ok) return
        if (e instanceof ApiHttpError && (e.status === 401 || e.status === 403)) {
          logTechnicalApiFailure('clientes.detalle', e)
          setAccessBlocked(true)
          return
        }
        if (e instanceof ApiHttpError && e.status === 404) {
          setNotFound(true)
          logConsultaCliente(log, false, clienteId)
        } else {
          setNotFound(true)
        }
      })
      .finally(() => {
        if (ok) setLoading(false)
      })
    return () => {
      ok = false
    }
  }, [clienteId])

  if (!clienteId) {
    return <p className="text-sm text-muted">Indique un código de cliente válido.</p>
  }

  if (loading) {
    return <p className="text-sm text-muted">Cargando…</p>
  }

  if (accessBlocked) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <AccesoServicioBloqueado />
        <Link className="text-sm text-accent hover:underline" to="/clientes">
          Volver al listado
        </Link>
      </div>
    )
  }

  if (notFound || !data) {
    return (
      <div className="mx-auto max-w-lg">
        <Card title="Consulta">
          <p className="text-sm text-muted">{mensajeClienteNoEncontrado()}</p>
          <Link className="mt-4 inline-block text-sm text-accent hover:underline" to="/clientes">
            Volver al listado
          </Link>
        </Card>
      </div>
    )
  }

  const esBaja = data.esBajaLogica
  const badgeTone =
    data.estadoCodigo === 'ACTIVO' ? 'success' : esBaja ? 'danger' : 'neutral'

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {flash ? (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {flash}
        </div>
      ) : null}

      <Card title="Ficha del cliente">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-[11px] font-medium uppercase text-muted">Código</dt>
            <dd className="mt-1 font-mono text-sm text-ink">{data.codigo}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase text-muted">Estado</dt>
            <dd className="mt-1">
              <Badge tone={badgeTone}>{data.estadoEtiqueta}</Badge>
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium uppercase text-muted">Nombre</dt>
            <dd className="mt-1 text-sm text-ink">{data.nombre}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase text-muted">Documento</dt>
            <dd className="mt-1 text-sm text-ink">
              {data.tipoDocumento} {data.numeroDocumento}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase text-muted">Fecha de registro</dt>
            <dd className="mt-1 text-sm text-ink">{formatDisplayDate(data.fechaAlta)}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase text-muted">Teléfono</dt>
            <dd className="mt-1 text-sm text-ink">{data.telefono || '—'}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-medium uppercase text-muted">Correo</dt>
            <dd className="mt-1 text-sm text-ink">{data.correo || '—'}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-[11px] font-medium uppercase text-muted">Notas</dt>
            <dd className="mt-1 text-sm text-muted">{data.notas || '—'}</dd>
          </div>
        </dl>

        {data.informacionAuditoria ? (
          <div className="mt-4 border-t border-line pt-4">
            <Accordion title="Información de auditoría">
              <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-muted">
                {data.informacionAuditoria}
              </pre>
            </Accordion>
          </div>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link to="/clientes">
            <Button variant="secondary">Volver</Button>
          </Link>
          <Link to={`/clientes/${encodeURIComponent(data.codigo)}/editar`}>
            <Button disabled={readOnly || esBaja}>Editar</Button>
          </Link>
          <Button variant="secondary" disabled={readOnly || esBaja} onClick={() => setConfirmBaja(true)}>
            Dar de baja
          </Button>
        </div>
      </Card>

      <Modal
        open={confirmBaja}
        title="Dar de baja"
        onClose={() => {
          if (!bajaSubmitting) {
            setConfirmBaja(false)
            setBajaError(null)
          }
        }}
        footer={
          <>
            <Button variant="secondary" disabled={bajaSubmitting} onClick={() => setConfirmBaja(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={bajaSubmitting}
              onClick={async () => {
                setBajaError(null)
                setBajaSubmitting(true)
                try {
                  await darBajaClienteDesdeApi(data.codigo)
                  setConfirmBaja(false)
                  setFlash('Cliente dado de baja correctamente.')
                  logClienteBaja(log, data.codigo)
                  recargarDetalle()
                } catch (e: unknown) {
                  logTechnicalApiFailure('clientes.baja', e)
                  if (e instanceof ApiHttpError && e.payload?.mensaje) {
                    setBajaError(e.payload.mensaje)
                  } else {
                    setBajaError('No se pudo completar la baja. Intente nuevamente.')
                  }
                } finally {
                  setBajaSubmitting(false)
                }
              }}
            >
              Confirmar baja
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink">¿Deseas dar de baja este cliente?</p>
        <p className="mt-2 text-sm text-muted">Esta acción quedará registrada.</p>
        {bajaError ? <p className="mt-3 text-sm text-danger-ink">{bajaError}</p> : null}
      </Modal>
    </div>
  )
}
