# Módulo `filmstrip`

Nivel: normal.
Responsabilidad: tira horizontal de tarjetas de plano (miniatura, número, duración, estado), según `docs/DISENO-GRAFICO.md` 6.6.

## Ficheros
- Código: `renderer/filmstrip.js` (ES module; sin `document` a nivel de módulo).
- Pruebas: `test/filmstrip.test.js`, solo de las funciones puras.
- Vecinos de referencia: `renderer/ui-kit.js`, `core/timecode.js`.

## Interfaz pública
```js
export function cardAriaLabel(shot: Shot, fps: number, complete: boolean, soundbiteIndex: number): string
export function nextIndexForKey(key: string, current: number, total: number): number | null   // null si la tecla no navega

export function mount(root: HTMLElement, o: { onSelect: (number: number) => void }): {
  setShots(shots: Shot[], fps: number): void,            // reconstruye la tira; conserva miniaturas ya cargadas por número de plano solo si el inicio-fin no cambió
  setSelected(number: number): void,                     // marca is-selected, tabindex itinerante y scrollIntoView({inline:'nearest',block:'nearest'})
  setThumbnail(number: number, dataUrl: string | null): void,   // null → is-thumb-error con tooltip «Couldn't read this frame»
  setLoadingProgress(loaded: number, total: number): void,      // barra filmstrip__progress; al llegar a total (o total 0) se retira y quita is-loading
  refreshStatus(shots: Shot[]): void,                    // solo actualiza is-complete/is-incomplete/is-interview, insignia, divisor y aria-label sin reconstruir las miniaturas
  destroy(): void,
}
```
(`Shot` de `core/shot-model.js`; aquí se usan `number, startFrame, endFrame, interview` y, para el estado, `isShotComplete` y `soundbiteIndex`.)

- `cardAriaLabel`: `Shot 12, 4.2 seconds, incomplete`; entrevista: `Shot 24, soundbite 1, 23 seconds, complete`. Los segundos de planos son `(endFrame - startFrame) / fps` con un decimal; los de entrevista, `Math.round` sin decimales (igual que el soundbite).
- `nextIndexForKey('ArrowRight', i, n)` → `min(i+1, n-1)`; `ArrowLeft` → `max(i-1, 0)`; `Home` → 0; `End` → `n-1`; otra tecla → `null`; `total` 0 → `null`.
- `mount` construye EXACTAMENTE la estructura de 6.6 (`section.filmstrip`, `div.filmstrip__progress` bajo demanda, `ol.filmstrip__list[role=listbox]`, `li.shot-card`, `div.filmstrip__divider` antes de la primera entrevista). Duración de tarjeta: `formatShotSeconds` de `core/timecode.js`. Clic en tarjeta → `onSelect(number)`. Teclado sobre la lista con `nextIndexForKey`; la selección sigue al foco y llama a `onSelect`. Las tarjetas nuevas nacen `is-loading` hasta recibir `setThumbnail`. `setSelected` no llama a `onSelect`.

## Errores
- `RangeError('Shot <n> does not exist.')` en `setSelected`/`setThumbnail` con número inexistente.

## Dependencias
- Internas: `renderer/ui-kit.js` (`el`, `icon`, `tooltip`), `core/timecode.js`, `core/shot-model.js`. Externas: ninguna.

## Criterio de aceptación
1. `cardAriaLabel` con los dos ejemplos de arriba (plano 105 fotogramas a 25 fps = `4.2 seconds`; entrevista 584 fotogramas = `23 seconds`).
2. `nextIndexForKey`: topes en 0 y `n-1`; `'Home'`/`'End'`; `'a'` → `null`; `total` 0 → `null`.
3. El módulo se importa en Node sin lanzar.

## Comando de pruebas
`node --test test/filmstrip.test.js`
