/** DTO de formulario (lenguaje de pantalla). */
export interface ClienteFormDto {
  codigoCliente: string
  nombreCompleto: string
  tipoDocumento: string
  numeroDocumento: string
  fechaAlta: string
  estado: string
  telefono: string
  correo: string
  notas: string
}

/** Fila de tabla de listado. */
export interface ClienteListItemDto {
  codigo: string
  documentoEtiqueta: string
  nombre: string
  /** ACTIVO | INACTIVO | DADO_DE_BAJA */
  estadoCodigo: string
  estadoEtiqueta: string
  fechaRegistro: string
  /** True si está dado de baja (DADO_DE_BAJA o INACTIVO con marca de baja en notas). */
  esBajaLogica: boolean
}

/** Ficha de detalle. */
export interface ClienteDetalleDto {
  codigo: string
  nombre: string
  tipoDocumento: string
  numeroDocumento: string
  /** Valor API (ACTIVO / INACTIVO / DADO_DE_BAJA). */
  estadoCodigo: string
  estadoEtiqueta: string
  fechaAlta: string
  telefono: string
  correo: string
  notas: string
}
