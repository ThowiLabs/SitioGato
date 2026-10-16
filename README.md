# SitioGato 🐈

**Extensión para Google Chrome (Manifest V3)** que recorre enlaces del mismo sitio y genera un archivo ZIP con capturas de páginas, recursos accesibles y un informe de estilo `DESIGN.md`. Mientras navega, un gato CSS escribe en su libreta sobre un overlay translúcido.

**Estado:** v2.0.0 · Proyecto privado · JavaScript, HTML y CSS sin frameworks.

## Características

- Rastreo de enlaces del mismo origen, con límite de páginas opcional y profundidad configurable.
- Capturas MHTML, pantallazos PNG, HTML del DOM renderizado y una versión espejo offline cuando es posible.
- Recursos CSS, JS, imágenes, fuentes, multimedia y WASM que Chrome puede recuperar con los permisos correspondientes.
- `DESIGN.md`: resumen automático de fuentes, colores, composición y animaciones observadas.
- Gato animado con `writeHand`, `writeLine`, `headBob` y `blink`; controles para pausar, minimizar y detener.
- Exportación local a ZIP, sin servicio backend propio.

## Instalación en Chrome

1. Descarga este repositorio o clónalo con acceso autorizado.
2. Abre `chrome://extensions/`.
3. Activa **Modo desarrollador**.
4. Elige **Cargar descomprimida** y selecciona la carpeta raíz del repositorio (contiene `manifest.json`).
5. Abre el sitio que quieres archivar, pulsa el icono de SitioGato y configura la captura.

## Parámetros

| Opción | Qué controla |
|---|---|
| Máximo de páginas | Tope de URLs únicas, incluyendo la inicial. |
| Sin límite | Quita solo el límite numérico; profundidad y memoria siguen acotadas. |
| Profundidad 1 / 2 / 3 / 5 | Número de niveles de enlaces que se siguen desde la página inicial. |
| Espera por página | Tiempo extra para que se renderice contenido dinámico. |
| Archivos estáticos | Captura recursos accesibles del mismo origen. |
| Generar `DESIGN.md` | Describe el diseño observable de las páginas visitadas. |

## Estructura

```text
SitioGato/
├── manifest.json          Permisos, background y metadatos
├── popup.html / popup.css / popup.js
├── background.js           Navegación y análisis de páginas
├── overlay.js              Gato animado y panel de progreso
├── offscreen.html / offscreen.js
├── zip.js                  Escritura ZIP32
├── icons/
└── README.md
```

## Desarrollo

No requiere npm ni un paso de compilación. Para validar el código:

```bash
for f in *.js; do node --check "$f"; done
python3 -m json.tool manifest.json >/dev/null
```

Para las pruebas integrales es necesario cargar la extensión en Chrome y usar un sitio de prueba local.

## Seguridad y limitaciones

El usuario inicia la captura de forma explícita. Chrome puede solicitar permisos de host para descargar recursos. Se recorren enlaces HTML del **mismo origen** y no se ejecutan formularios ni acciones de autenticación. No se eluden CAPTCHA ni restricciones de acceso.

Las capturas no incluyen backend, bases de datos ni necesariamente todos los estados de una SPA. Los recursos de CDNs externos pueden aparecer integrados en MHTML, pero no se garantiza su descarga individual. El modo `Sin límite` no evita límites físicos de memoria, tamaño de ZIP o la cola de URL. Consulta `INSTRUCCIONES.txt` para detalles operativos.

## Licencia

Código reservado en un repositorio privado de ThowiLabs. No se concede autorización pública para reutilizar o redistribuirlo.
