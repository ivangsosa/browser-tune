# Metodología de benchmarks

Ninguna afirmación de mejora de rendimiento se publica sin un benchmark
reproducible. Diferenciar siempre: memoria de procesos del navegador,
memoria de páginas y métricas del sistema.

## Entorno controlado

- Perfil de navegador limpio, sin otras extensiones (baseline).
- Registrar: versión del navegador, OS, hardware, versión de la extensión.
- Misma máquina, mismas condiciones de red entre corridas.

## Escenarios

0. Baseline: navegador limpio, sin extensión.
1. browser-tune activa con perfil Balanced.
2. browser-tune activa con perfil Low Resource.
3. Conjunto de 20–50 pestañas sobre una suite fija de sitios (lista congelada
   en `tests/fixtures/` o documentada en la corrida).
4. Sitios con login, reproducción multimedia, formularios y webapps.
5. Cambios de perfil repetidos + reinicio del navegador + actualización de la
   extensión (verifica restauración de estado).

## Qué registrar (por corrida, ≥3 repeticiones)

- Tiempo de carga de la suite, metodología fija (misma herramienta/orden).
- Solicitudes bloqueadas y cantidad de reglas activas.
- Pestañas descartadas y comportamiento al reactivarlas.
- Errores de consola y fallos funcionales.
- Overhead de CPU/memoria atribuible a la extensión:
  - Chrome: `chrome://process-internals` / Task Manager (Shift+Esc).
  - Firefox: `about:processes`.
- Versiones y condiciones completas de la corrida.

## Regla

No publicar porcentajes universales de mejora. Reportar siempre la
metodología junto a los números.
