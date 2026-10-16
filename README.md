# SitioGato 2.0 — extensión Chrome Manifest V3

Captura un sitio desde el navegador en un archivo ZIP. Incluye las páginas que Chrome puede abrir y los recursos accesibles. El gato animado se superpone al sitio mientras recorre las páginas, con el fondo visible, y puede **pausarse, reanudarse o minimizarse**.

## Instalación

1. Descomprime `SitioGato-Chrome-Extension-V2.zip` en una carpeta estable.
2. Abre `chrome://extensions/` en Chrome.
3. Activa **Modo desarrollador** y haz clic en **Cargar descomprimida**.
4. Selecciona la carpeta `sitiogato-extension` que contiene `manifest.json`.
5. Abre la página web que deseas guardar, pulsa el icono de SitioGato y configura las opciones.
6. Concede el permiso del sitio **solo si quieres descargar sus archivos estáticos**. Chrome usa la pestaña activa para navegar y mostrar el gato, y descargará el ZIP al finalizar.

**Si ya tenías instalada V1:** reemplaza los archivos de la carpeta por los de V2 y pulsa **Actualizar** (↻) en `chrome://extensions/`. Si cargaste V1 desde otra ruta, quítala y carga la nueva carpeta para evitar duplicados.

## Opciones del panel

| Ajuste | Qué hace |
| --- | --- |
| **Máximo de páginas** | Cantidad total de páginas distintas que se intentarán capturar, incluida la inicial. 30 de forma predeterminada. |
| **Sin límite de páginas** | Elimina el tope numérico de páginas y desactiva el campo. La captura sigue limitada por profundidad, contenido disponible, recursos del ordenador, el formato ZIP y tu acción **Detener**. No equivale a capacidad infinita. |
| **Profundidad: 1 salto** | Página inicial y enlaces directos de esa página. |
| **Profundidad: 2 saltos** | También los enlaces presentes en las páginas alcanzadas con 1 salto. |
| **Profundidad: 3 / 5 saltos** | Recorridos más extensos; pueden ser mucho más lentos y consumir más memoria. |
| **Espera por página** | Tiempo extra después de cada carga: 0,75 / 1,5 / 3 / 5 segundos. Ayuda a que aparezca contenido asincrónico. No obliga a terminar todas las descargas de un sitio. |
| **Incluir archivos estáticos** | Intenta guardar CSS, JS, imágenes, fuentes, audio/vídeo y WASM del mismo origen cuando Chrome tiene permiso. |
| **Generar DESIGN.md** | Crea un análisis visual automático de los estilos computados: colores, tipografías, variables CSS, navegación, controles, layouts y animaciones identificadas. |

## Cómo se anima el gato

El overlay utiliza el gato en HTML y CSS de tu ejemplo, **no una imagen estática**. Conserva las animaciones: `writeHand` de la pata derecha y el lápiz (1,6 s), `writeLine` del trazo en la libreta (1,6 s), `headBob` de la cabeza (2 s) y `blink` de los ojos (4 s). La animación está activa durante la navegación, incluso si Chrome prefiere menos movimiento; en la esquina superior del panel puedes usar **Ⅱ / ▶** para pausarla o reanudarla. También hay controles de minimizar y detener. El panel es translúcido, por lo que puedes ver la página de fondo.

## Estructura del ZIP descargado

- `index.html`: índice de páginas guardadas.
- `DESIGN.md`: guía visual observada, si se seleccionó la opción.
- `snapshots/*.mhtml`: capturas MHTML con recursos integrados cuando Chrome puede guardarlos.
- `screenshots/*.png`: vista visible de cada página **sin el overlay del gato**.
- `source/*.html`: DOM renderizado tal como estaba en el navegador, no el código privado original.
- `mirror/*.html`: intento de HTML navegable offline, enlazando recursos locales cuando es posible.
- `assets/`: archivos estáticos recuperables del origen inicial; hasta 12 MB por recurso, 85 MB acumulados y 180 archivos.
- `manifest.json`: URLs, archivos, estado, errores y parámetros de captura.
- `LEEME.txt`: guía del archivo exportado.

## Compatibilidad y límites

Puede empezar desde **cualquier URL http:// o https:// normal** que abras en Chrome, no está restringida a Launchpage. Sigue enlaces HTML del **mismo origen** (protocolo + host + puerto). Por seguridad no hace clic en botones ni envía formularios. No copia todo Internet, subdominios diferentes ni sitios ajenos al origen elegido.

- No recupera backend, bases de datos ni fuentes privadas. Tampoco evita CAPTCHA ni restricciones de Vercel u otros servidores.
- Una página SPA con rutas dinámicas sin enlaces HTML, contenido después de autenticarse, canvas, WebGL o llamadas a APIs puede quedar incompleta.
- No descarga CDNs de terceros como recursos individuales; el formato MHTML puede conservar algunos elementos que Chrome haya cargado.
- **Sin límite** significa sin tope numérico de páginas, no sin límites de memoria o tamaño. La cola en memoria se mantiene en un máximo de 8.000 URL pendientes; el máximo técnico del ZIP32 es 4 GiB y Chrome puede terminar antes por memoria. Para sitios enormes, utiliza capturas por secciones.
- `DESIGN.md` documenta lo observado en el tamaño de pantalla usado, no sustituye un diseño en Figma ni puede garantizar todos los estados responsive o animaciones.
- No cierres Chrome ni la pestaña durante la captura. En un reinicio completo, una captura en curso puede interrumpirse.
- Si la opción de recursos está activada, Chrome solicitará permiso de acceso al dominio abierto. Los datos de captura no se suben a un servicio propio.

## Desarrolladores

Código local HTML/CSS/JS sin dependencias externas para capturar, generar `DESIGN.md` o montar ZIP. El empaquetador ZIP32 está en `zip.js`; el análisis visual se obtiene con `getComputedStyle` y reglas CSS visibles en `background.js`; el ZIP y `DESIGN.md` se generan en `offscreen.js`.
