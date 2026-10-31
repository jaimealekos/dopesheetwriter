# Módulo `frames`

Nivel: normal.
Responsabilidad: abrir el vídeo en un `<video>` oculto para leer sus metadatos y extraer la miniatura del primer fotograma de cada plano.

## Ficheros
- Código: `renderer/frames.js` (ES module; sin `document` a nivel de módulo).
- Pruebas: `test/frames.test.js`, solo de las funciones puras `thumbnailSize` y `classifyMediaError`.
- Vecinos de referencia para el estilo: `core/timecode.js`.

## Interfaz pública
```js
export class VideoError extends Error { code: 'decode' | 'unreadable' }

export function thumbnailSize(videoWidth: number, videoHeight: number, targetWidth: number): { width: number, height: number }
export function classifyMediaError(mediaErrorCode: number | null, videoWidth: number): 'decode' | 'unreadable'

export function probeVideo(videoUrl: string): Promise<{ duration: number, width: number, height: number }>

export function extractFrames(o: {
  videoUrl: string,
  cuts: Array<{ startFrame: number }>,
  fps: number,
  width?: number,                               // por defecto THUMBNAIL_WIDTH de core/config.js
  onFrame: (index: number, dataUrl: string | null) => void,   // index base 0 en el orden de cuts; null si ese fotograma falló
  signal?: AbortSignal,
}): Promise<void>
```
- `thumbnailSize`: `width = targetWidth`, `height = Math.round(targetWidth * videoHeight / videoWidth)`; con `videoWidth` 0 o negativo lanza `RangeError('video width must be positive')`.
- `classifyMediaError(code, videoWidth)`: devuelve `'decode'` si `videoWidth === 0` (hay audio pero no se decodifica la imagen, típico de ProRes) o si `code` es 3 (`MEDIA_ERR_DECODE`) o 4 (`MEDIA_ERR_SRC_NOT_SUPPORTED`); en otro caso `'unreadable'`. `code` null con `videoWidth > 0` → `'unreadable'`.
- `probeVideo`: crea `document.createElement('video')` con `muted = true`, `preload = 'metadata'`, `src = videoUrl`; espera `loadedmetadata` (o `error`); devuelve `duration`, `videoWidth`, `videoHeight`; libera el elemento (`removeAttribute('src')`, `load()`). Con error o `videoWidth === 0` rechaza con `VideoError` cuyo `code` sale de `classifyMediaError` y cuyo mensaje es `The video could not be opened (<code>).`.
- `extractFrames`: un único `<video>` oculto (`muted`, `preload = 'auto'`, `src`); espera `loadeddata`; para cada corte en orden, SECUENCIALMENTE: `video.currentTime = frameSeekTime(startFrame, fps)` (de `core/timecode.js`), espera el evento `seeked` (con tiempo máximo `SEEK_TIMEOUT_MS` de `core/config.js`), dibuja el fotograma en un `canvas` de `thumbnailSize(...)` con `drawImage`, y llama `onFrame(index, canvas.toDataURL('image/jpeg', 0.8))`. Si un fotograma agota el tiempo o falla el dibujo, `onFrame(index, null)` y se sigue con el siguiente. Si `signal` se aborta: se detiene sin llamar más a `onFrame`, libera el elemento y la promesa se resuelve. Si el vídeo no carga (`error` antes de `loadeddata`), rechaza con `VideoError`. Al terminar (éxito, aborto o error) libera el elemento.

## Errores
- `VideoError` (mensaje `The video could not be opened (<code>).`), `RangeError` de `thumbnailSize`.

## Dependencias
- Internas: `core/timecode.js` (`frameSeekTime`), `core/config.js` (`THUMBNAIL_WIDTH`, `SEEK_TIMEOUT_MS`). Externas: ninguna.

## Criterio de aceptación
1. `thumbnailSize(1920,1080,320)` → `{width:320,height:180}`; `(3840,2160,128)` → `{128,72}`; `(1000,1000,100)` → `{100,100}`; ancho 0 lanza `RangeError`.
2. `classifyMediaError(4, 1920)` → `'decode'`; `(3, 1920)` → `'decode'`; `(null, 0)` → `'decode'`; `(2, 1920)` → `'unreadable'`; `(null, 1920)` → `'unreadable'`.
3. El módulo se importa en Node sin lanzar.

## Comando de pruebas
`node --test test/frames.test.js`

## Adenda (revisión)
`SEEK_TIMEOUT_MS` también limita la espera de `loadeddata`, y esa espera respeta `signal` (abortar la detiene).
