# Política de seguridad

## Reportar una vulnerabilidad

No abras un issue público. Reportá por GitHub Security Advisories del repo
(o contactá al mantenedor por el canal indicado en el perfil).

Incluí: descripción, impacto, pasos de reproducción y versión afectada.

## Alcance

browser-tune corre enteramente en el navegador del usuario: sin servidor,
sin cuenta y sin telemetría. Las superficies relevantes son:

- Importación de configuración (JSON validado y sanitizado).
- Reglas de red declarativas (solo `block`/`allow`, sin redirects ni
  modificación de headers).
- Descarte de pestañas (protecciones activas por defecto).

## Compromisos

- Mínimo privilegio de permisos; cada permiso está justificado.
- Sin código remoto ejecutable.
- Configuración almacenada localmente.
