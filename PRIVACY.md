# Política de privacidad

browser-tune está diseñada para operar íntegramente en tu navegador.

- **Sin cuenta** ni registro.
- **Sin servidor**: no hace requests a servidores propios ni de terceros.
- **Sin telemetría**: no recolecta ni transmite datos de uso.
- **Local**: toda la configuración se guarda en `storage.local` de tu
  navegador; la actividad de pestañas en `storage.session` (volátil).
- **Sin código remoto**: todo el código se distribuye dentro del paquete.
- **Sin lectura de páginas**: la extensión no lee el contenido de los sitios
  que visitás.

El bloqueo de dominios usa reglas declarativas (`declarativeNetRequest`):
la lista la aplica el navegador; la extensión no observa el tráfico.
