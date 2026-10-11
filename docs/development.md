# Desarrollo

## Requisitos

- Node 24+
- Chrome ≥121 y/o Firefox ≥128

## Comandos

```bash
npm install          # dependencias
npm run build        # genera dist/chrome y dist/firefox
npm run build:chrome # solo Chrome
npm run build:firefox# solo Firefox
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # vitest (unit + verificación de dist/)
npm run test:e2e     # Chromium real con la extensión (requiere `npx playwright install chromium`)
npm run test:e2e:firefox  # Firefox real vía geckodriver (requiere firefox + geckodriver)
SCREENSHOTS=1 npm run test:e2e   # además regenera store-assets/*.png
npm run icons        # regenera los iconos (requiere ImageMagick)
npm run webext:lint  # valida el paquete de Firefox (addons-linter)
npm run webext:run   # abre Firefox temporal con la extensión (usa npx web-ext, opcional)
```

## Cargar la extensión en desarrollo

### Chrome

1. `npm run build:chrome`
2. Abrir `chrome://extensions`
3. Activar "Developer mode"
4. "Load unpacked" → seleccionar `dist/chrome`

### Firefox

1. `npm run build:firefox`
2. `npm run webext:run` (abre un perfil temporal), o manualmente:
   `about:debugging` → "This Firefox" → "Load Temporary Add-on" → `dist/firefox/manifest.json`

La carga temporal no requiere firma; la firma de AMO solo es necesaria para distribución.

## Ramas

- `develop`: desarrollo y default branch. Todo commit va acá (o via feature branch + PR).
- `main`: production. Congelada hasta el primer release (`merge develop → main` + tag).
