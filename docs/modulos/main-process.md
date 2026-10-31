# Módulo `main-process`

Nivel: normal.
Responsabilidad: proceso principal de Electron: ventana, seguridad, preload con la API `window.dsw` y manejadores IPC sobre `storage` y `xml-shots`.

## Ficheros
- Código: `main/main.js` (arranque y ventana), `main/window-width.js` (cálculo puro del ensanche de ventana), `main/spellcheck.js` (elección pura de idiomas del corrector), `main/ipc.js` (manejadores, testeable sin Electron), `main/preload.cjs` (puente; CommonJS obligatorio).
- Pruebas: `test/ipc.test.js` (solo `main/ipc.js`), `test/window-width.test.js` (solo `main/window-width.js`), `test/spellcheck.test.js` (solo `main/spellcheck.js`; `main.js` y `preload.cjs` se comprueban en la integración).
- Vecinos de referencia para el estilo: `main/storage.js`, `core/xml-shots.js`.

## Interfaz pública

### `main/ipc.js`
```js
export function registerIpc(deps: {
  ipcMain: { handle(channel: string, fn: Function): void },
  dialog: { showOpenDialog(options: object): Promise<{ canceled: boolean, filePaths: string[] }> },
  shell: { showItemInFolder(path: string): void },
  storage: ReturnType<typeof createStorage>,
  parseXmeml: (xmlText: string) => object,
  readFile: (path: string, encoding: string) => Promise<string>,
  getWindow: () => object | undefined,        // ventana padre de los diálogos
  translateText: (text: string) => Promise<{ text: string, provider: string }>,   // `main/translate.js`
  adjustWindowWidth: (delta: number) => number,   // ensancha/estrecha la ventana; devuelve el delta aplicado
}): void
```
Registra estos canales con `ipcMain.handle`. Cada manejador recibe `(event, ...args)` y devuelve SIEMPRE `{ ok: true, value }` o `{ ok: false, error: <mensaje del Error> }` (un `try/catch` común; nunca deja escapar la excepción). Canal → argumentos → `value`:
| Canal | Argumentos | `value` |
|---|---|---|
| `dsw:pickFile` | `kind` (`'video'` o `'xml'`) | ruta elegida (string) o `null` si cancela. Filtros: video → `{ name: 'Video', extensions: ['mp4','mov','m4v'] }` (de `VIDEO_EXTENSIONS` sin punto); xml → `{ name: 'Xml', extensions: ['xml'] }`. `kind` desconocido → error `Unknown file kind: <kind>.` |
| `dsw:loadXml` | `xmlPath` | resultado de `parseXmeml(await readFile(xmlPath, 'utf8'))` |
| `dsw:videoUrl` | `videoPath` | `pathToFileURL(videoPath).href` (`node:url`) |
| `dsw:findSiblingXml` | `videoPath` | `storage.findSiblingXml` |
| `dsw:loadSettings` | — | `storage.loadSettings()` |
| `dsw:saveSettings` | `partial` | `undefined` |
| `dsw:loadDraft` | `videoPath` | `storage.loadDraft` |
| `dsw:saveDraft` | `videoPath, draft` | `undefined` |
| `dsw:shotlistExists` | `videoPath` | boolean |
| `dsw:outputPathFor` | `videoPath` | string |
| `dsw:writeShotlist` | `videoPath, text` | ruta escrita |
| `dsw:showInFolder` | `path` | `undefined` (llama a `shell.showItemInFolder`) |
| `dsw:fileExists` | `path` | boolean (`fs.promises.access`; `false` si falla) |
| `dsw:translate` | `text` | `await translateText(text)` → `{ text, provider }` (los errores de `translate` pasan al `{ok:false,error}` habitual) |
| `dsw:adjustWindowWidth` | `delta` (número entero finito; si no, `Error('delta must be a finite integer.')`) | `adjustWindowWidth(delta)` → delta realmente aplicado (puede ser 0) |

### `main/main.js`
Script de arranque, sin exports:
- `app.requestSingleInstanceLock()`; si no se obtiene, `app.quit()`; al llegar una segunda instancia, enfocar la ventana existente.
- `app.whenReady()` → crea `createStorage(app.getPath('userData'))`, llama a `registerIpc` con las dependencias reales (`parseXmeml` de `core/xml-shots.js`, `readFile` de `node:fs/promises`) y abre la ventana.
- Ventana: 1760 × 900 (constantes locales de `main.js`) (limitados al área de trabajo de la pantalla principal: `screen.getPrimaryDisplay().workAreaSize`), `minWidth` 1280, `minHeight` 700, `show: false` (se muestra en `ready-to-show`), `backgroundColor` = el valor de `--color-bg` del tema oscuro de `docs/DISENO-GRAFICO.md`, título `Dopesheet Writer`, `webPreferences: { preload: <ruta a main/preload.cjs>, contextIsolation: true, sandbox: true, nodeIntegration: false, webSecurity: true }`. Carga `renderer/index.html` con `loadFile`.
- Seguridad: `webContents.setWindowOpenHandler(() => ({ action: 'deny' }))`; `will-navigate` con `preventDefault()`; `session.defaultSession.setPermissionRequestHandler((_w, _p, cb) => cb(false))`.
- Corrector ortográfico: al arrancar, `applySpellcheck()` llama a `chooseSpellcheckLanguages(SPELLCHECK_LANGUAGES, session.defaultSession.availableSpellCheckerLanguages)` (de `main/spellcheck.js` y `core/config.js`) y, si devuelve idiomas, `session.defaultSession.setSpellCheckerLanguages(languages)`. Si no hay ninguno disponible, `console.warn` con los idiomas pedidos y los disponibles, sin lanzar (la app arranca igual).
- Menú: en `darwin` un menú mínimo con los roles `appMenu` y `editMenu` (para copiar/pegar); en otras plataformas `Menu.setApplicationMenu(null)`.
- Herramientas de desarrollo solo si la variable de entorno `DSW_DEVTOOLS` vale `1`.
- `window-all-closed` → `app.quit()` en todas las plataformas.

### `main/window-width.js`
```js
export function computeWidthChange(o: {
  bounds: { x: number, y: number, width: number, height: number },
  workArea: { x: number, y: number, width: number, height: number },
  delta: number,            // píxeles; positivo ensancha, negativo estrecha
  minWidth: number,
}): { applied: number, bounds: { x: number, y: number, width: number, height: number } }
```
- `delta > 0`: `width' = min(bounds.width + delta, workArea.width)`; `x' = max(workArea.x, min(bounds.x, workArea.x + workArea.width - width'))` (si desborda por la derecha se desplaza a la izquierda); `applied = width' - bounds.width`.
- `delta < 0`: `width' = max(minWidth, bounds.width + delta)`; `x' = bounds.x`; `applied = width' - bounds.width` (≤ 0).
- `delta === 0`: `applied 0`, bounds iguales. `y` y `height` nunca cambian. No muta `bounds`.
`main/main.js` implementa `adjustWindowWidth(delta)`: si la ventana está maximizada, a pantalla completa o minimizada devuelve 0; si no, busca la pantalla con `screen.getDisplayMatching(win.getBounds()).workArea`, llama a `computeWidthChange`, aplica con `win.setBounds(bounds, false)` (sin animación; al estrechar no se deshace el desplazamiento a la izquierda) y devuelve `applied`.

### `main/spellcheck.js`
```js
export function chooseSpellcheckLanguages(wanted: string[], available: string[]): string[]
```
Devuelve, en el orden de `wanted`, los idiomas que estén en `available`; `[]` si no hay ninguno o si alguna entrada no es un array. No muta las entradas. `main.js` la usa con `SPELLCHECK_LANGUAGES` (`core/config.js`, `['en-US']`) y `session.defaultSession.availableSpellCheckerLanguages`.

### `main/preload.cjs`
Con `contextBridge.exposeInMainWorld('dsw', {...})`, incluidos `translate(text)` y `adjustWindowWidth(delta)`. Cada función llama a `ipcRenderer.invoke(canal, ...args)`, y si el resultado es `{ ok: false }` lanza `new Error(resultado.error)`; si es `{ ok: true }` devuelve `value`. Funciones (nombre → canal): `pickFile`, `loadXml`, `videoUrl`, `findSiblingXml`, `loadSettings`, `saveSettings`, `loadDraft`, `saveDraft`, `shotlistExists`, `outputPathFor`, `writeShotlist`, `showInFolder`, `fileExists` → `dsw:<nombre>` con los mismos argumentos. Además:
- `pathForFile(file)` → `webUtils.getPathForFile(file)` (síncrona; devuelve la ruta de un `File` soltado).
- `platform` → `process.platform`.
Sin más lógica.

## Errores
Los errores de los manejadores llegan al renderer como `Error` con el mensaje original de `storage`/`xml-shots`/Node, ya redactado para el usuario.

## Dependencias
- Internas: `main/storage.js`, `main/translate.js`, `main/spellcheck.js`, `core/xml-shots.js`, `core/config.js`.
- Externas: `electron` (devDependency ya instalada, solo en `main.js`/`preload.cjs`).

## Criterio de aceptación
Pruebas de `registerIpc` con `ipcMain` falso que guarda los manejadores en un `Map`, y dependencias falsas:
1. Se registran exactamente los 15 canales de la tabla.
2. `dsw:pickFile('video')` con diálogo que devuelve una ruta → `{ok:true,value:ruta}` y `showOpenDialog` se llamó con el filtro de vídeo; cancelado → `{ok:true,value:null}`; `'audio'` → `{ok:false,error:'Unknown file kind: audio.'}`.
3. `dsw:loadXml` lee con `readFile(ruta,'utf8')` y devuelve lo que devuelve el `parseXmeml` falso; si `parseXmeml` lanza → `{ok:false,error:<mensaje>}`.
4. `dsw:videoUrl('F:\\a b\\v.mp4')` (en Windows) o ruta POSIX equivalente devuelve una URL `file:///` con `%20`.
5. `dsw:writeShotlist` y `dsw:saveDraft` delegan en `storage` con los mismos argumentos; un `storage` que lanza → `{ok:false,...}`.
6. `dsw:fileExists` → `true`/`false` según exista (usa un fichero temporal real).
7. `dsw:showInFolder` llama a `shell.showItemInFolder(ruta)`.
8. `dsw:translate('hola')` delega en `translateText('hola')` y devuelve su resultado; si `translateText` rechaza → `{ok:false,error:<mensaje>}`.
9. `dsw:adjustWindowWidth(440)` devuelve lo que devuelve `adjustWindowWidth(440)`; con `1.5`, `NaN` o `'a'` → `{ok:false,error:'delta must be a finite integer.'}` sin llamar a `adjustWindowWidth`.
10. `computeWidthChange` con `workArea {x:0,y:0,width:1920,height:1040}`: bounds `{x:100,width:1760}` y delta 440 → `applied 160`, `x 0`, `width 1920`; bounds `{x:100,width:1200}` y delta 440 → `applied 440`, `x 100`; bounds `{x:1000,width:900}` y delta 440 → `width 1340`, `x 580`; bounds `width 1640` y delta -440 con `minWidth 1280` → `applied -360`; bounds `width 1700` y delta -440 → `applied -420`; delta 0 → `applied 0`; el objeto `bounds` de entrada no se muta; `y` y `height` no cambian.
11. `chooseSpellcheckLanguages(['en-US'], ['es-ES','en-US'])` → `['en-US']`; `(['en-US'], ['es-ES'])` → `[]`; respeta el orden de `wanted` y descarta los ausentes; listas vacías o no válidas → `[]`; no muta las entradas.

## Comando de pruebas
`node --test test/ipc.test.js`
