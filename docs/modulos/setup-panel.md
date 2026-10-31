# Módulo `setup-panel`

Nivel: normal.
Responsabilidad: zonas de soltar/Examinar de vídeo y XML en la pantalla de inicio, chips de fuente de la barra superior y campos de cabecera (Location, Date, Source), según `docs/DISENO-GRAFICO.md` 5.6, 6.3, 6.4 y 6.7.

## Ficheros
- Código: `renderer/setup-panel.js` (ES module; sin `document` a nivel de módulo).
- Pruebas: `test/setup-panel.test.js`, solo de las funciones puras.
- Vecinos de referencia: `renderer/ui-kit.js`, `core/config.js`.

## Interfaz pública
```js
export function classifyFile(fileName: string): 'video' | 'xml' | null     // por extensión, sin distinguir mayúsculas (VIDEO_EXTENSIONS, XML_EXTENSIONS de core/config.js)
export function classifyDrop(files: Array<{ name: string }>): { video: object | null, xml: object | null, rejected: string[] }   // primer vídeo y primer xml; los demás nombres en rejected
export function baseName(path: string): string                             // último componente, con / o \
export function headerErrors(header: { location: string, date: string, source: string }): { location?: string, date?: string, source?: string }
export function videoMeta(o: { duration: number, width: number, height: number, fps: number }): string    // «00:03:12:05 · 1920×1080 · 25 fps»
export function xmlMeta(o: { shots: number, fps: number, totalFrames: number }): string                   // «26 shots · 25 fps · 00:03:12:05»

export function mountHome(root: HTMLElement /* #home-zones */, o: {
  onBrowse: (kind: 'video' | 'xml') => void,
  onDropFiles: (kind: 'video' | 'xml', file: File) => void,
}): {
  setState(kind: 'video' | 'xml', state: { status: 'empty' | 'loading' | 'loaded' | 'error', name?: string, path?: string, meta?: string, note?: string, error?: string }): void,
  setGlobalDragover(active: boolean): void,
  destroy(): void,
}

export function mountChips(root: HTMLElement /* #topbar-sources */, o: { onChange: (kind: 'video' | 'xml') => void }): {
  set(o: { videoName: string, xmlName: string }): void,
  destroy(): void,
}

export function mountHeaderFields(root: HTMLElement /* #header-fields-root */, o: {
  onChange: (header: { location: string, date: string, source: string }) => void,
}): {
  setHeader(header: { location: string, date: string, source: string }): void,
  showErrors(errors: object): void,                 // resultado de headerErrors; vacío los limpia
  focusFirstEmpty(): void,
  destroy(): void,
}
```
- `classifyFile('A.MP4')` → `'video'`; `'x.xml'` → `'xml'`; otros → `null`.
- `classifyDrop`: recorre en orden; el primer vídeo y el primer xml se devuelven; cualquier otro nombre (segundos vídeos/xml o extensiones desconocidas) va a `rejected` (por nombre).
- `headerErrors`: `location` vacío tras `trim` → `Enter the location.`; `date` → `Enter the date, e.g. MARCH 11, 2026.`; `source` → `Enter the source.`; solo incluye las claves con error.
- `videoMeta`: `formatTimecode(duration, fps)` + ` · ${width}×${height} · ${fps} fps`, con `fps` mostrado sin decimales si es entero y con dos decimales si no (29.97).
- `xmlMeta`: `${shots} shots · ${fps} fps · ${formatTimecode(totalFrames / fps, fps)}`, con `shot` en singular si es 1.

### Componentes
- `mountHome`: dos `section.dropzone` exactas de 6.3 (video/xml) dentro de `root`, con sus estados (`setState`) y textos; clic en la caja o en «Examinar» → `onBrowse(kind)` (el botón es el único enfocable); soltar un fichero sobre una zona → `onDropFiles(kind, file)` sin mirar su extensión (la clasificación global la hace `app`); `dragover`/`dragleave`/`drop` con `preventDefault` y clase `is-dragover` en la zona bajo el puntero. `setGlobalDragover(true)` añade `is-dragover` al `.home` (elemento padre `#home`) para el borde discontinuo de ambas zonas (6.3). `is-loading` desactiva «Examinar» (`setDisabled`) y muestra `spinner`.
- `mountChips`: los dos `button.source-chip` de 5.6 con la etiqueta del nombre (con elipsis y `title`); clic → `onChange(kind)`.
- `mountHeaderFields`: estructura de 6.7 (`section.header-fields` ya existe en `index.html`; rellena su contenido) con placeholders y ayuda «Remembered for next time.» en Source; `input` en cualquier campo → `onChange(header)` con los tres valores actuales; `setHeader` asigna sin disparar; `showErrors` aplica `setError`; `focusFirstEmpty` enfoca el primero vacío (Location, Date, Source).

## Errores
No lanza.

## Dependencias
- Internas: `renderer/ui-kit.js`, `core/config.js`, `core/timecode.js`. Externas: ninguna.

## Criterio de aceptación
1. `classifyFile`: `'a.mp4'`, `'A.MOV'`, `'b.M4V'` → `'video'`; `'c.XML'` → `'xml'`; `'d.txt'`, `'sin-extension'` → `null`.
2. `classifyDrop([{name:'a.mp4'},{name:'b.xml'},{name:'c.mov'},{name:'d.txt'}])` → video `a.mp4`, xml `b.xml`, `rejected` `['c.mov','d.txt']`.
3. `baseName('F:\\x\\y\\v.mp4')` → `'v.mp4'`; `baseName('/a/b/c.xml')` → `'c.xml'`.
4. `headerErrors` con los tres vacíos (y uno con solo espacios) → las tres claves con sus textos; completo → `{}`.
5. `videoMeta({duration:192.2, width:1920, height:1080, fps:25})` → `00:03:12:05 · 1920×1080 · 25 fps`; fps 29.97002997 → `29.97 fps`.
6. `xmlMeta({shots:26, fps:25, totalFrames:4805})` → `26 shots · 25 fps · 00:03:12:05`; `shots:1` → `1 shot`.
7. El módulo se importa en Node sin lanzar.

## Comando de pruebas
`node --test test/setup-panel.test.js`
