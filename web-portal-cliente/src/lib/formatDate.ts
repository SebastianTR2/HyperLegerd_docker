export function formatDisplayDate(isoDate: string): string {
  const d = new Date(isoDate.includes('T') ? isoDate : `${isoDate}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDate
  return d.toLocaleDateString('es-PE', { dateStyle: 'medium' })
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })
}
