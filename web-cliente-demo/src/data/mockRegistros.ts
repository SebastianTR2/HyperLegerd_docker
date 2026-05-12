import type { Registro } from '../types/registro'

export const MOCK_REGISTROS_SEED: Registro[] = [
  {
    id: 'r-1001',
    tipoDocumento: 'DNI',
    documento: '45123456',
    nombreCompleto: 'María Fernández López',
    email: 'maria.fernandez@universidad.edu',
    facultad: 'Ingeniería de Sistemas',
    estado: 'activo',
    fechaRegistro: '2026-04-12T14:22:00',
    referenciaTrazabilidad: 'a3f2c91b8e4d2a10f0c8b7e6d5c4b3a2',
  },
  {
    id: 'r-1002',
    tipoDocumento: 'DNI',
    documento: '47890123',
    nombreCompleto: 'Carlos Ruiz Medina',
    email: 'c.ruiz@universidad.edu',
    facultad: 'Ciencias Económicas',
    estado: 'activo',
    fechaRegistro: '2026-04-15T09:10:00',
    referenciaTrazabilidad: 'b7e6d5c4b3a2918f7e6d5c4b3a291807',
  },
  {
    id: 'r-1003',
    tipoDocumento: 'Pasaporte',
    documento: 'AB902341',
    nombreCompleto: 'Ana Gómez Prieto',
    email: 'ana.gomez@universidad.edu',
    facultad: 'Derecho',
    estado: 'inactivo',
    fechaRegistro: '2026-04-20T11:45:00',
  },
]
