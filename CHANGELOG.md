# Changelog

El formato sigue [Keep a Changelog](https://keepachangelog.com/) y el
proyecto usa versionado semántico.

## [Unreleased]

### Added

- Atajo de teclado para descartar pestañas inactivas (Alt+Shift+D, personalizable).
- Contador de pestañas descartadas en el ícono de la extensión.
- Historial de actividad: qué hizo la extensión y cuándo (perfil aplicado, pausas, descartes, importaciones, errores), en Opciones.
- Lista de todos los sitios en pausa en el popup, con botón para reanudar.
- Benchmark automatizado (`npm run bench`): mide solicitudes bloqueadas y tiempo de carga.

### Fixed

- Elegir el perfil "Personalizado" ahora queda seleccionado; antes el selector volvía a mostrar el perfil que coincidía con la configuración.

## [0.2.0] - 2026-10-11

### Added

- Controles por sitio en el popup: no bloquear, no descartar, o pausar el bloqueo por 15 min, 1 h o 4 h.
- Botón "Descartar pestañas inactivas ahora" y contador de pestañas descartadas.
- Lista ampliada opcional de rastreadores y anuncios (activa en el perfil Privacidad).
- Bloqueo opcional por tipo de recurso (scripts, imágenes, etc.).
- Exportar a archivo e importar desde archivo.
- Avisos de líneas inválidas y del límite de dominios al escribir.
- Aviso de cambios sin guardar con opción de descartarlos.
- Reintentar desde la interfaz cuando falla la aplicación de reglas.
- Idiomas francés y alemán, y selector manual de idioma.
- Modo oscuro y mejoras de accesibilidad (lectores de pantalla y teclado).
- Íconos definitivos.
- Pruebas automáticas en navegadores reales (Chromium y Firefox).

## [0.1.0] - 2026-10-11

Primera versión de desarrollo.

### Added

- Perfiles de optimización: Equilibrado, Ahorro de recursos, Privacidad y Personalizado.
- Bloqueo de dominios configurable con listas predefinidas y exclusiones.
- Descarte seguro de pestañas inactivas, con protección de pestañas fijadas, activas o con audio.
- Interfaz en inglés, español y portugués, según el idioma del navegador.
- Sugerencias de ajustes del navegador con enlaces de ayuda.
- Importación y exportación de la configuración.
- Popup y página de opciones.
- Avisos cuando una función no está disponible en el navegador.
- Documentación de limitaciones, metodología de pruebas y privacidad.
