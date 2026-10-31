# Módulo `feedback`

Nivel: normal.
Responsabilidad: banner de error/aviso, toast y modal de confirmación de sobrescritura, según `docs/DISENO-GRAFICO.md` (6.2, 6.11, 6.12).

## Ficheros
- Código: `renderer/feedback.js`.
- Pruebas: `test/feedback.test.js`: `bannerCopy` y el texto de los modales de reemplazo (DOM falso mínimo); el resto del DOM se comprueba en la integración.
- Vecinos de referencia para el estilo: `renderer/ui-kit.js`.

## Interfaz pública
```js
export function bannerCopy(kind: 'unsupported-codec'|'unreadable-video'|'invalid-xml'|'no-clips'|'mismatch'|'bad-drop'|'save-failed'|'translate-failed'|'transcribe-failed',
                           args: { file?: string, number?: number, detail?: string, xmlTime?: string, videoTime?: string, folder?: string, name?: string }):
  { type: 'error'|'warning', title: string, detail: string }

export function createBanner(regionEl: HTMLElement): {
  showError(o: { title: string, detail?: string, action?: { label: string, onClick: Function } }): void,
  showWarning(o: { title: string, detail?: string, action?: { label: string, onClick: Function } }): void,
  clear(): void,
  current(): 'error' | 'warning' | null,
}
export function createToasts(regionEl: HTMLElement): {
  show(o: { kind: 'success'|'info', title: string, detail?: string, action?: { label: string, icon?: string, onClick: Function } }): void,
  hide(): void,
}
export function confirmOverwrite(rootEl: HTMLElement, o: { fileName: string, folder: string }): Promise<boolean>
export function confirmReplaceTranslation(rootEl: HTMLElement, target?: 'es'|'en'): Promise<boolean>  // target por defecto 'en'
export function confirmReplaceOriginal(rootEl: HTMLElement): Promise<boolean>
```
- `bannerCopy` devuelve los textos EXACTOS de la tabla de 6.2 (título y detalle con `<file>`, `<HH:MM:SS:FF>`, `<name>`, `<folder>` sustituidos; para `save-failed` el detalle es `${detail} Check you can write to ${folder}.` con `detail` = causa del sistema). Tipos: `mismatch`, `bad-drop`, `translate-failed` y `transcribe-failed` son `'warning'`, el resto `'error'`. `translate-failed`: título `Couldn't translate the text.`, detalle = `args.detail` (mensaje del servicio, ya completo; si falta, `Try again in a moment.`).
- `createBanner`: estructura de 6.2 dentro de `regionEl` (se vacía y se vuelve a rellenar; uno solo a la vez; `showWarning` no sustituye a un error visible). Error: `role="alert"`; aviso: `role="status"` con botón «Dismiss» (`iconButton` close) que llama a `clear()`. La acción opcional es un `button--secondary`.
- `createToasts`: estructura de 6.12 en `regionEl`; un solo toast a la vez (uno nuevo sustituye al anterior); cierre automático a 8000 ms (success) o 5000 ms (info) con la cuenta pausada con `pointerenter`/`focusin` y reanudada con `pointerleave`/`focusout`; botón cerrar «Dismiss»; no roba el foco. Entrada/salida con las clases `is-visible` (la transición está en CSS); al salir se elimina del DOM en `transitionend` o tras 160 ms.
- `confirmReplaceTranslation`: mismo modal de 6.11 con título `Replace the current translation?`, texto `The English text of this soundbite will be replaced by a new machine translation.`, botones «Cancel» (foco inicial) y «Replace» (`true`); sin `modal__filename`.
- `confirmReplaceTranslation(rootEl, target)`: el cuerpo nombra el idioma destino: `The <Spanish|English> text of this soundbite will be replaced by a new machine translation.` (`targetLanguageLabel(target)`).
- `confirmReplaceOriginal`: mismo modal, título `Replace the current original text?`, texto `The original text of this soundbite will be replaced by a new transcription.`
- `transcribe-failed`: título `Couldn't transcribe shot <args.number>.`, detalle = `args.detail` (o `Try again in a moment.`).
- `confirmOverwrite`: estructura de 6.11 en `rootEl`; `Promise<boolean>`: `true` con «Replace», `false` con «Cancel», Esc o clic en el fondo. Foco inicial en «Cancel»; Tab y Mayús+Tab atrapados dentro del diálogo; (mismo comportamiento y teclado para los dos modales; comparten una función interna) al cerrar devuelve el foco al elemento que lo tenía antes de abrirlo; retira el modal del DOM. `fileName` se muestra en `span` con clase `modal__filename`.

## Errores
- `Error('Unknown banner kind: <kind>.')` en `bannerCopy` con clase desconocida.

## Dependencias
- Internas: `renderer/ui-kit.js` (`el`, `icon`, `button`, `iconButton`), `core/languages.js` (`targetLanguageLabel`). Externas: ninguna.

## Criterio de aceptación
1. `bannerCopy('unsupported-codec', {})` → `type 'error'`, título `This video can't be played.`, detalle `Its codec isn't supported (ProRes, DNxHD and similar). Export an H.264 MP4 and load it again.`
2. `bannerCopy('mismatch', {xmlTime:'00:03:57:00', videoTime:'00:04:10:00'})` → `type 'warning'`, título `The XML doesn't match the video.`, detalle `The sequence lasts 00:03:57:00 but the video lasts 00:04:10:00. Make sure both come from the same export.`
3. `bannerCopy('invalid-xml', {file:'a.xml'})` → título `"a.xml" isn't a valid Final Cut / Premiere XML.`; `bad-drop` y `save-failed` con sus textos; los ocho casos cubiertos (incluido `translate-failed`: título exacto, `type warning`, detalle = `detail` o el texto por defecto).
4. Clase desconocida lanza el error exacto.

## Comando de pruebas
`node --test test/feedback.test.js`
