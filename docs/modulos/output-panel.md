# Módulo `output-panel`

Nivel: normal.
Responsabilidad: vista previa viva del `.txt` en su propia columna, conmutador de la vista previa, contador de progreso y botón Generate, según `docs/DISENO-GRAFICO.md` 6.1 (progress, generate), 6.10 (preview) y la sección 13 (columna Preview y conmutador).

## Ficheros
- Código: `renderer/output-panel.js` (ES module; sin `document` a nivel de módulo).
- Pruebas: `test/output-panel.test.js`, solo de las funciones puras.
- Vecinos de referencia: `renderer/ui-kit.js`, `core/shotlist-format.js`, `core/shot-model.js`.

## Interfaz pública
```js
export function progressLabel(done: number, total: number): string                        // «18/26 shots complete»
export function missingSummary(o: { headerErrors: object, shots: Shot[] }): string[]      // líneas del tooltip de Generate
export function rangeText(numbers: number[]): string                                      // «3, 7, 12–16»
export function splitPreview(text: string, shots: Shot[], currentNumber: number): Array<{ text: string, current: boolean, number: number | null, segments: Array<{ text: string, missing: boolean }> }>

export function mountProgress(root: HTMLElement /* #topbar-actions */, o: { onGenerate: () => void }): {
  update(o: { done: number, total: number, missingLines: string[], fileName: string }): void,   // missingLines vacío = habilitado
  setBusy(busy: boolean): void,
  buttonsEl: HTMLElement,                // `div.topbar__buttons` (contiene Generate), donde se monta el conmutador
  destroy(): void,
}

export function mountPreviewToggle(buttonsEl: HTMLElement /* mountProgress(...).buttonsEl */, o: {
  onToggle: (open: boolean) => void,    // el usuario pulsa el botón
}): {
  setOpen(open: boolean): void,          // fija el estado visual (aria-pressed) sin llamar a onToggle
  isOpen(): boolean,
  destroy(): void,
}

export function mountPreview(root: HTMLElement /* #preview-pane, la 2ª columna (aside.preview-pane) */, o: {
  onClose: () => void,                   // botón cerrar de la cabecera de la columna
  onSelect: (number: number) => void,    // clic en el bloque de un plano: saltar a ese plano
}): {
  update(o: { text: string, shots: Shot[], currentNumber: number, fileName: string }): void,
  scrollToCurrent(): void,
  setOpen(open: boolean): void,          // muestra/oculta la columna (`root.hidden`) y gestiona su clase de animación; no llama a onClose
  destroy(): void,
}
```
- `progressLabel`: `${done}/${total} shots complete` (con `total` 1: `1/1 shots complete` no se cambia a singular; el formato es fijo).
- `rangeText`: números ordenados ascendentes; rachas consecutivas de 3 o más → `a–b` (guion corto); parejas consecutivas se escriben sueltas; separador `, `. `[3,7,12,13,14,15,16]` → `3, 7, 12–16`; `[1,2]` → `1, 2`; `[]` → `''`.
- `missingSummary`: líneas en este orden: una por cada clave de `headerErrors` con el nombre del campo (`Location`, `Date`, `Source`); `Shots <rangeText>` para los planos de imagen incompletos (no entrevista); `Soundbites <rangeText>` con los índices de soundbite (`soundbiteIndex`) de las entrevistas incompletas. Máximo 6 líneas; si hay más, las 6 primeras y una última `and <N> more` con N = resto… (la 6.ª línea se sustituye por `and <N> more`, con N = líneas ocultas).
- `splitPreview(text, shots, currentNumber)`: trocea el texto de `buildShotlist(..., {strict:false})` en bloques: el bloque inicial (cabecera + `IMAGES (…)` y su línea vacía) y un bloque por plano: desde la línea que empieza por `<n>. ` (n = número de plano) hasta justo antes de la siguiente línea que empieza por `<n+1>. ` (o el final). `current` = true para el bloque del plano `currentNumber`. `number` = número del plano del bloque, y `null` en el bloque de cabecera. Dentro de cada bloque, `segments` separa los marcadores de falta (`[SHOT SIZE]`, `[DESCRIPTION]`, `[NAME]`, `[GENDER]`, `[LANGUAGE]`, `[LOCATION]`, `[DATE]`, `[SOURCE]`) con `missing: true` del resto del texto. Invariante: la concatenación de todos los `segments.text` de todos los bloques es el texto original. El texto y su concatenación no cambian respecto a la versión anterior.
- `mountProgress`: monta `div.progress` (6.1) y `div.topbar__buttons` con el botón `generate` (`button--primary`, «Generate», min-width 96px) en `root` y los muestra (`root.hidden = false`). `update`: anchura de `progress__fill`, etiqueta, `is-complete` si `done === total && total > 0`; `missingLines` vacío → habilitado con tooltip `Save <fileName> next to the video` + kbd `Ctrl+S`; con líneas → `is-disabled` (`setDisabled`, sigue enfocable) y tooltip con título `Complete these to generate:` y una línea por cada elemento. Clic con el botón deshabilitado también llama a `onGenerate` (la lógica de «ir al primer pendiente» es de `app`). `setBusy` → `setLoading`.
- `mountPreviewToggle`: inserta como primer hijo de `buttonsEl` el botón `button.button--secondary.preview-toggle` de 13.2.1 (icono `panel-right`, etiqueta «Preview», `is-active` cuando abierto), `aria-pressed`, `aria-controls="preview-pane"`, tooltip `Preview · Alt+P` (kbd); un clic llama a `onToggle(!isOpen())` tras actualizar su propio estado.
- `mountPreview`: monta la columna completa (cabecera con nombre de fichero, texto `Live preview` y botón cerrar `iconButton` `close`, más el cuerpo de 6.10) en `root`; el botón cerrar (`preview-pane__close`) y la tecla Esc con el foco dentro de la columna llaman a `onClose()`; título `h2.preview-pane__title` = `<fileName>` (con `title`), nota `Live preview`. Estructura del cuerpo de 6.10 con un `span.preview__block` por bloque (`is-current`) y `span.preview__missing` por cada segmento con falta; los bloques de plano (no el de cabecera) llevan `data-shot="<number>"`. Un único listener `click` delegado en el `<pre>` busca el `.preview__block[data-shot]` más cercano al objetivo y llama a `onSelect(number)`; si no lo encuentra (clic en la cabecera) no hace nada, y si `window.getSelection()` tiene texto seleccionado con el ancla dentro del `<pre>` tampoco salta, para poder copiar texto. `destroy` quita ese listener. `update` sustituye el contenido completo sin animación y conserva la posición del scroll salvo que cambie el plano actual; `scrollToCurrent` centra el bloque actual (`scrollIntoView({block:'center'})`).

## Errores
No lanza.

## Dependencias
- Internas: `renderer/ui-kit.js`, `core/shot-model.js` (`isShotComplete`, `soundbiteIndex`). Externas: ninguna. (`app` llama a `buildShotlist` y pasa el texto.)

## Criterio de aceptación
1. `progressLabel(18,26)` → `18/26 shots complete`.
2. `rangeText`: `[3,7,12,13,14,15,16]` → `3, 7, 12–16`; `[1,2]` → `1, 2`; `[5,6,7]` → `5–7`; desordenado `[7,3]` → `3, 7`; `[]` → `''`.
3. `missingSummary` con `{source:'Enter the source.'}`, planos 3, 7 y 12–16 de imagen incompletos y la entrevista 2 incompleta → `['Source','Shots 3, 7, 12–16','Soundbites 2']`; con 8 faltas → 6 líneas, la última `and <N> more`.
4. `splitPreview`: texto de 3 planos → 4 bloques (cabecera + 3), `current` solo en el del plano pedido, `number` = `[null, 1, 2, 3]`, el marcador `[DESCRIPTION]` aparece como segmento `missing: true`, y la concatenación de segmentos = texto original.
5. `mountPreview`: los bloques de plano llevan `data-shot` con su número y el de cabecera no; un clic en un bloque de plano llama a `onSelect` con ese número; un clic en la cabecera o con selección de texto dentro del `<pre>` no lo llama; `destroy` deja de responder al clic.
6. El módulo se importa en Node sin lanzar.

## Comando de pruebas
`node --test test/output-panel.test.js`

## Adenda: botón «Translate all»
```js
export function mountTranslateAll(buttonsEl: HTMLElement /* mountProgress(...).buttonsEl */, o: {
  onClick: () => void,
}): {
  update(o: { pending: number, busy: boolean }): void,
  setVisible(visible: boolean): void,
  destroy(): void,
}
```
Inserta como primer hijo de `buttonsEl` (antes del conmutador Preview) `button.button.button--secondary.translate-all`: icono `translate` 16 px + etiqueta «Translate all», alto 32 px, mismos estados que `translate-button` (13.3.1). `update`: `pending > 0` y no `busy` → habilitado, tooltip `Translate <pending> soundbite(s) without translation (online service)` (singular con 1: `soundbite`); `pending === 0` → `is-disabled` (sigue enfocable, un clic no hace nada), tooltip `No soundbites to translate`; `busy` → `is-loading` (spinner, ancho fijo, no reacciona), tooltip `Translating…`. El botón solo se muestra si hay al menos un plano de entrevista (`app` llama a `root.hidden`-equivalente con el atributo `hidden` del botón: añade `setVisible(visible: boolean)` a lo devuelto).
