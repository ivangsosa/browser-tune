# Limitaciones conocidas

Lo que browser-tune **no** puede hacer (por diseño de las APIs de extensiones):

- **Medir RAM por pestaña**: no existe API de extensión para eso. La memoria
  solo se evalúa en benchmarks manuales (`chrome://process-internals`,
  `about:processes`). La UI no muestra métricas de memoria.
- **Garantizar memoria liberada**: `tabs.discard()` libera lo que el
  navegador decida; no hay número fijo garantizado.
- **Cambiar flags internos del navegador**: las extensiones no pueden.
- **Estado de formularios**: una pestaña descartada recarga al seleccionarla
  y puede perder contenido de formularios no enviados. Mitigación: exclusiones
  por dominio y las protecciones activas (fijadas, activa, con audio).
- **Dominios bloqueados por el usuario**: tope de 5.000 (límite de reglas
  dinámicas de Firefox; Chrome permite 30.000 — se mantiene el menor por paridad).

## Notas de compatibilidad

- Chrome ≥121, Firefox ≥140 (desktop) / ≥142 (Android).
- En Firefox ≤132 había un bug donde las reglas dinámicas podían no aplicarse
  tras reiniciar (bugzilla 1921353); el manifiesto incluye un ruleset estático
  habilitado que lo mitiga. Con el mínimo actual (140) no aplica.
