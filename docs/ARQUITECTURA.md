# Arquitectura — Dopesheet Writer

## Objetivo y alcance
Hace: el periodista carga el vídeo de un reportaje de agencia y el XML de Final Cut/Premiere (xmeml v4) de su montaje; la app deduce los cortes de cada plano, extrae el primer fotograma de cada uno, deja reproducir cada plano, pide por plano el tipo (obligatorio), el movimiento de cámara (opcional) y una descripción (obligatoria), permite marcar los planos de entrevista (soundbites) con sus datos, y genera `<nombre del vídeo>.txt` (UTF-8 con BOM, saltos de línea LF) en la carpeta del vídeo con el formato SHOTLIST de agencia.
No hace: no edita ni exporta vídeo; no lee ficheros de texto ya escritos; la transcripción de un soundbite es una ayuda opcional (botón «Transcribe»: transcribe en local el tramo del corte con el mismo sistema que Hispatrans —whisper.cpp, Whisper large-v3 q8_0, VAD Silero— y rellena Original y Language con el idioma detectado; solo Windows, herramientas en `vendor/transcriber` empaquetadas en `resources/transcriber`); la traducción de un soundbite es otra ayuda opcional (botón «Translate», servicio gratuito de internet, el texto sale del equipo) que va al inglés, o al español si Language es inglés, y el usuario debe revisarla; no permite cambiar el nombre ni la carpeta de salida; no gestiona varios vídeos a la vez; no decodifica códecs que Chromium no reproduce (ProRes, etc.): en ese caso muestra un error claro.

Plataformas: Windows 11 (objetivo) y macOS (mismo código, sin cambios de fuente; empaquetado con `npm run package:mac` desde un Mac, sin probar aquí).

## Stack
- Electron 44.5.1 (proceso principal + renderer con `contextIsolation: true`, `sandbox: true`, preload `.cjs`). JavaScript ES modules (`"type": "module"`), sin framework ni paso de compilación en el renderer.
- `fast-xml-parser` 5.11.2 (único paquete de producción; solo en `core/xml-shots.js`, que corre en el proceso principal).
- Pruebas: `node --test` (runner integrado de Node 24), sin dependencias.
- Empaquetado: `@electron/packager` 20.3.0 (devDependency). Sin instalador: la carpeta empaquetada se copia a `C:\jaime\apps\dopesheetwriter` (despliegue).
- Fotogramas y reproducción: elemento `<video>` de Chromium (H.264/AAC de los MP4 de agencia). Sin ffmpeg. Miniaturas con `<canvas>`.

## Reglas de dominio (fijadas con los ejemplos reales de AFP)
- El vídeo es el export de la secuencia: el fotograma N de la secuencia XML es el fotograma N del vídeo. Tiempo = fotograma / fps. fps = `timebase` (× 1000/1001 si `ntsc` es TRUE).
- Los cortes son los `start`/`end` de los `clipitem` de la pista de vídeo V1 (la primera pista con clips activos). Las capas de ajuste de V2+ se ignoran. Hay huecos entre planos (p. ej. antes de una entrevista); no cuentan.
- Duración de IMAGES = suma de (end − start) de los planos que no son entrevista, en segundos redondeados al entero más próximo, formato `MM:SS`. Ejemplo verificado: 4308 fotogramas a 25 fps = 172,32 s = `02:52`.
- Tiempo de cada entrevista = (end − start)/fps redondeado al entero más próximo, sufijo `sec` sin espacio. Ejemplo verificado: 584 fotogramas = 23,36 s = `23sec`.
- Las entrevistas son siempre la cola de la lista. Marcar el plano N como entrevista marca N..último; desmarcar el plano N desmarca 1..N. Así la cola siempre es contigua.
- Numeración: los planos se numeran 1..total por orden del montaje; las entrevistas continúan la numeración y además llevan `SOUNDBITE k` (k = 1, 2, …).
- Formato de salida exacto (LF; `{…}` se sustituye):

```
SHOTLIST
{location}
{date}
SOURCE: {source}

IMAGES ({MM:SS})

1. Wide shot - {description}
2. Wide shot, pan right - {description}
<línea en blanco>
<línea en blanco>
24. SOUNDBITE 1 - {name}, {profession}, {age} years ({language}, {gender}, {N}sec):

"{translation}"

"{original}"
<línea en blanco>
<línea en blanco>
25. SOUNDBITE 2 - …
```
  El movimiento va en minúsculas tras el tipo (`Wide shot, pan right`). `profession` y `age` se omiten, con su coma, si están vacíos. El fichero termina en un único `\n`. Fecha por defecto: hoy, en inglés, mes en mayúsculas y día sin cero a la izquierda (`MARCH 11, 2026`). Location por defecto `MADRID, SPAIN`.

## Módulos
| Módulo | Responsabilidad (una frase) | Nivel | Depende de | Contrato |
|---|---|---|---|---|
| `timecode` | Conversiones fotograma/segundo/timecode y formatos de duración. | trivial | — | docs/modulos/timecode.md |
| `xml-shots` | Lee un XML xmeml v4 y devuelve fps, duración y la lista de cortes de la pista V1; compara con la duración del vídeo. | normal | fast-xml-parser | docs/modulos/xml-shots.md |
| `shot-model` | Modelo puro de los planos anotados: creación, edición inmutable, cascada de entrevistas, copia del anterior, validación, progreso y anotaciones para el borrador. | normal | — | docs/modulos/shot-model.md |
| `video-match` | Compara la duración del vídeo con la del XML (módulo puro importado por el renderer; `xml-shots` lo reexporta). | trivial | `timecode` | `core/video-match.js` |
| `shotlist-format` | Construye el texto final del shotlist a partir de cabecera y planos. | normal | `timecode`, `shot-model` | docs/modulos/shotlist-format.md |
| `storage` | Ajustes, borradores, ruta de salida y escritura atómica del `.txt` en el disco. | normal | — | docs/modulos/storage.md |
| `translate` | Traduce un texto al inglés o al español con un servicio gratuito de internet (con respaldo) desde el proceso principal. | normal | `config` | docs/modulos/translate.md |
| `transcribe` | Transcribe en local un tramo del vídeo (ffmpeg + whisper-cli, mismo sistema que Hispatrans), detecta el idioma y fija el sentido de la traducción (`core/languages.js`). | normal | `config` | docs/modulos/transcribe.md |
| `transcribe-ui` | Botón «Transcribe» del editor, flujo `renderer/flow-transcribe.js` y traducción según Language. | normal | `transcribe`, `shot-editor`, `feedback` | docs/modulos/transcribe-ui.md |
| `auto-interviews` | Al cargar vídeo y XML sin borrador, detecta por duración los cortes de entrevista del final (`core/interview-detect.js`), los confirma en un modal y los transcribe y traduce en segundo plano (`renderer/flow-auto-interviews.js`). | normal | `shot-model`, `transcribe-ui`, `feedback` | docs/modulos/auto-interviews.md |
| `main-process` | Ventana Electron (incl. ensanche para la columna Preview), preload y manejadores IPC sobre `storage`, `xml-shots`, `translate` y `transcribe`. | normal | `storage`, `xml-shots`, `translate`, `transcribe` | docs/modulos/main-process.md |
| `frames` | Extrae en el renderer la miniatura del primer fotograma de cada plano. | normal | `timecode` | docs/modulos/frames.md |
| `player` | Reproductor con controles, marcas de corte y reproducción de un plano de principio a fin. | normal | `timecode` | docs/modulos/player.md |
| `filmstrip` | Tira horizontal de tarjetas de plano (miniatura, número, duración, estado). | normal | `timecode` | docs/modulos/filmstrip.md |
| `shot-editor` | Formulario del plano seleccionado (tipo, movimiento, descripción, entrevista y sus datos). | normal | `shot-model` | docs/modulos/shot-editor.md |
| `setup-panel` | Zonas de soltar/Examinar para vídeo y XML, campos de cabecera (Location, Date, Source). | normal | — | docs/modulos/setup-panel.md |
| `output-panel` | Columna de vista previa viva del `.txt` con su conmutador, contador de progreso y botón Generate. | normal | `shotlist-format`, `shot-model` | docs/modulos/output-panel.md |
| `styles` | Hoja de estilos y `index.html` según `docs/DISENO-GRAFICO.md`. | normal | — | docs/modulos/styles.md |
| `app` | Estado global, cableado de todos los módulos, atajos de teclado, autoguardado y flujo Generate (integrador). | normal | todos | (fase integrar) |

## Orden de implementación
1. `timecode`, `shot-model`, `xml-shots`, `storage` (puros o de disco, sin UI).
2. `shotlist-format`, `translate`, `main-process`.
3. `styles`, `frames`, `player`, `filmstrip`, `shot-editor`, `setup-panel`, `output-panel`.
4. Fase integrar: `app`, `scripts/deploy.ps1`, README.
Sin dependencias circulares.

## Integración
Punto de entrada: `main/main.js` (campo `main` del package.json) → carga `renderer/index.html` → `renderer/app.js`.
Configuración: constantes en `core/config.js` (ver contrato de `shot-model`); ajustes del usuario (Location y Source recordados) y borradores en `app.getPath('userData')`.
Flujo de datos: el renderer llama a `window.dsw` (preload) para todo lo que toca disco o diálogos; nunca usa Node directamente. `app.js` guarda el estado (`video`, `xml`, `header`, `shots`, `selected`) y cada panel recibe sus datos y callbacks por su `mount()`; ningún panel conoce a otro.
Pruebas de integración previstas: (a) `core` de punta a punta: XML sintético → `createShots` → anotar → `buildShotlist` → texto esperado carácter a carácter; (b) `storage` + `shot-model`: anotaciones → borrador → recarga → mismas anotaciones; (c) comprobación manual contra los dos ejemplos reales de AFP (`\\amparitoroca\ARCHIVO\EXPORT\AFP\...`): número de cortes y cifras IMAGES/soundbite esperadas (26 cortes, `03:03`; 28 cortes, `02:52`); (d) arranque de la app Electron y captura de pantalla.

## Interfaz de usuario
Dos pantallas en una ventana (mín. 1280×700, inicial 1760×900 limitada al área de trabajo de la pantalla; menú nativo oculto):
1. **Inicio** (sin vídeo o sin XML): dos zonas grandes «Video source» y «Xml» (Examinar o arrastrar). Se puede soltar cualquiera de los dos ficheros en cualquier parte de la ventana; se clasifica por extensión (`.mp4 .mov .m4v` vídeo; `.xml` XML). Al elegir un vídeo, si existe `<mismo nombre>.xml` en su carpeta se carga solo (editable). Cuando hay los dos, pasa a Espacio de trabajo tras calcular planos.
2. **Espacio de trabajo**: barra superior (nombre de la app; chips con nombre de vídeo y XML, pulsables para cambiarlos; progreso «18/26 shots complete»; botón Generate). Columna principal: reproductor presidiendo la ventana, con la tira de planos debajo. Columna de edición, de doble ancho que antes (800 px): campos de cabecera (Location, Date, Source) y editor del plano. Columna Preview (2ª columna a su derecha, cerrada por defecto): texto final en vivo; el botón conmutador «Preview» (barra superior, Alt+P) la abre o cierra y, al abrirla, el proceso principal ensancha la ventana (`dsw:adjustWindowWidth`, limitado a la pantalla) y la estrecha al cerrarla; si no cabe, el vídeo cede ancho hasta su mínimo. En un soundbite, el botón «Translate» pone en el campo Translation la traducción del campo Original (`dsw:translate`, al inglés o, si Language es inglés, al español); el botón «Transcribe» pone en Original la transcripción local del corte (`dsw:transcribe`) y en Language el idioma detectado, con fallos en un banner `transcribe-failed`; si Translation ya tenía texto, pide confirmación; al entrar con un vídeo y un XML sin borrador, la app propone en un modal los cortes de entrevista detectados por duración y, si se confirman, los marca y los transcribe y traduce en segundo plano mientras se sigue editando (`docs/DISENO-GRAFICO.md` §15); los fallos salen en un banner `translate-failed`. Estados: cargando miniaturas (progreso por plano), plano normal, plano de entrevista, plano incompleto (marca visible), error de vídeo/XML (banner con causa y cómo corregir), confirmación de sobrescritura, éxito (aviso con «Show in folder»).
Atajos: Alt+P abre/cierra la columna Preview; Ctrl+Espacio reproducir/pausa en cualquier sitio; Espacio solo fuera de campos de texto; Alt+↓ / Alt+↑ plano siguiente/anterior; Ctrl+Intro siguiente plano pendiente; Alt+R repetir el plano; Ctrl+S Generate; Esc quita el foco del campo.
Estilo: minimalista, oscuro por defecto con soporte de tema claro del sistema; lo fija `docs/DISENO-GRAFICO.md` (valores exactos y nombres de clase), que manda sobre cualquier valor visual.

## Decisiones de diseño
- Electron + JS puro — mismo código en Win y Mac, reproducción H.264 sin dependencias, sin ffmpeg ni compilador.
- Miniaturas y reproducción con `<video>` — cero dependencias; limitación: códecs que Chromium no decodifica (se avisa).
- Lógica de dominio en `core/` como funciones puras — se prueba con `node --test` sin Electron.
- Pista V1 como fuente de cortes — los dos ejemplos reales tienen capas de ajuste en V2 que generan falsos cortes.
- Entrevistas como cola contigua con cascada — garantiza el formato (imágenes primero) sin validaciones confusas.
- Gestos extra aceptados por el usuario: cascada de entrevistas, autoguardado de borrador en userData (clave = hash de la ruta del vídeo; anotaciones enlazadas por `inicio-fin` del plano), «Copiar del anterior», vista previa, recordar Location y Source, atajos, avisos de seguridad (XML que no casa con el vídeo, confirmación antes de sobrescribir), contador de planos incompletos. Añadidos por diseño sin pedir confirmación por ser triviales: carga automática del `.xml` hermano, clasificación por extensión al soltar, «Show in folder».
- Salida UTF-8 con BOM, LF — elegido por el usuario; los ejemplos antiguos son Windows-1252 y no se replican.
- Un solo movimiento de cámara por plano (desplegable con «None») — así lo pidió el usuario.
- Género (man/woman) obligatorio sin valor por defecto, para no inventar un dato de una persona; edad solo dígitos (se escribe `N years`).
