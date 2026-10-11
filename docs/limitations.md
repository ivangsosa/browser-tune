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

- **Solapamiento con protecciones nativas**: Brave Shields y la Protección
  mejorada contra rastreo de Firefox ya cubren gran parte de lo que bloquean
  las listas incluidas; en esos navegadores el aporte del bloqueo es pequeño.
- **Listas incluidas**: son listas chicas, curadas a mano y empaquetadas (sin
  descargas remotas). No reemplazan a un bloqueador de contenido dedicado. La
  lista ampliada ("tracking") es más estricta y puede romper algunos sitios.
- **Pausa por sitio**: se aplica con reglas de sesión y vence mediante una
  alarma (puede demorar unos segundos). Al reiniciar el navegador la pausa se
  reconstruye únicamente si todavía no venció.
- **Idioma manual**: cambia la interfaz (popup/opciones); el nombre y la
  descripción de la extensión en la página de extensiones siguen el idioma del
  navegador.

## Pruebas automáticas y sus límites

- `npm run test:e2e` carga la extensión en Chromium real y comprueba bloqueo
  real de solicitudes, pausa, exclusiones, tipos de recurso, idempotencia,
  reinicio del service worker, idiomas y validación en la UI.
- `npm run test:e2e:firefox` hace lo equivalente en Firefox real vía
  geckodriver (incluye descarte real de pestañas).
- **Descarte en Chromium bajo Playwright**: Chromium (153) se cierra de forma
  fatal ~1 s después de `tabs.discard()` cuando está controlado por CDP, incluso
  con una llamada directa sin código de la extensión. Por eso el test de
  descarte real en Chromium es opcional (`BT_DISCARD=1`); la lógica está cubierta
  por tests unitarios y por el e2e de Firefox. No se pudo verificar si el
  cierre ocurre también fuera de automatización: confirmarlo manualmente en
  Chrome/Brave antes de publicar.
- Brave no se probó automáticamente (se espera el mismo comportamiento que
  Chromium, sin verificar).

## Notas de compatibilidad

- Chrome ≥121, Firefox ≥140 (desktop) / ≥142 (Android).
- En Firefox ≤132 había un bug donde las reglas dinámicas podían no aplicarse
  tras reiniciar (bugzilla 1921353); el manifiesto incluye un ruleset estático
  habilitado que lo mitiga. Con el mínimo actual (140) no aplica.
