import type { Registro, RegistroInput } from '../types/registro'

/**
 * Contrato pensado para una futura integración HTTP con `api-middleware`.
 * La demo actual usa `DemoStoreProvider` + localStorage en lugar de esta interfaz.
 */
export interface RegistroService {
  list(): Promise<Registro[]>
  getById(id: string): Promise<Registro | null>
  create(input: RegistroInput): Promise<Registro>
  update(id: string, input: RegistroInput): Promise<Registro>
  delete(id: string): Promise<void>
}
