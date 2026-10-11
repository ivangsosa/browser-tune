# Contributing

## Entorno

Node 24+. Ver [docs/development.md](docs/development.md) para comandos y cómo
cargar la extensión en modo desarrollador.

## Flujo

1. Trabajar en una feature branch desde `develop` (o directo en `develop` en
   cambios chicos). Nunca commits directos a `main`.
2. Antes de PR: `npm run lint && npm run typecheck && npm test && npm run build`.
3. Las fases se implementan incrementales — no mandar todo en un solo cambio.

## Estilo y reglas del proyecto

- TypeScript estricto. UI sin framework (HTML/CSS/TS vanilla).
- `core/` no importa APIs del navegador ni de la UI (puro y testeable).
- Aplicación de cambios siempre idempotente; solo se tocan reglas/pestañas
  administradas por la extensión.
- Mínimo privilegio: justificar cada permiso nuevo en el PR.
- Sin telemetría ni código remoto ejecutable.
- No afirmar compatibilidad Chrome/Firefox sin probarlo o verificarlo contra
  documentación vigente.

## Reportar bugs

Abrir un issue con: versión de la extensión, navegador y versión, pasos para
reproducir, y comportamiento esperado vs observado.

Para vulnerabilidades de seguridad: ver [SECURITY.md](SECURITY.md).
