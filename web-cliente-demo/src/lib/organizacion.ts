/** Etiqueta legible para el id técnico de organización (tenant en backend). */
export function etiquetaOrganizacion(tenantId: string | undefined | null): string {
  const t = (tenantId ?? '').trim().toLowerCase()
  if (!t) return '—'
  if (t === 'clientes') return 'Clientes'
  if (t === 'agricultura') return 'Agricultura'
  return t.charAt(0).toUpperCase() + t.slice(1)
}
