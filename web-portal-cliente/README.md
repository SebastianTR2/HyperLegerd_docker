# Gestión de Clientes (portal)

Aplicación web orientada al **usuario de negocio** para registrar y consultar clientes. La consola administrativa del equipo (`web-cliente-demo`) cubre auditoría y control avanzado.

## Requisitos

- Node.js 18+
- Servicio de datos en ejecución (puerto típico **3000** en integración)

## Instalación

```bash
cd web-portal-cliente
npm install
```

## Variables de entorno

Copie `.env.example` a `.env` o cree **`.env.local`** (recomendado; no lo suba a Git) con el destino del proxy y la clave interna del portal:

```env
VITE_API_TARGET=http://localhost:3000
VITE_PORTAL_API_KEY=
```

Ejemplo si el servicio corre en otra máquina (p. ej. WSL):

```env
VITE_API_TARGET=http://172.19.63.107:3000
VITE_PORTAL_API_KEY=sec-admin
```

La clave debe coincidir con la que acepta el servicio en integración. Opcionalmente, en desarrollo puede guardarse una clave en el almacenamiento del navegador como respaldo (misma clave que en `VITE_PORTAL_API_KEY`).

## Desarrollo

```bash
npm run dev
```

La app se sirve en el puerto **5174**. Las peticiones usan rutas relativas `/api/...`; Vite las reenvía al valor de `VITE_API_TARGET`.

## Build

```bash
npm run build
```

Salida en `dist/`.
