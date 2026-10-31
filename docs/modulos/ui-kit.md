# Módulo `ui-kit`

Nivel: normal.
Responsabilidad: utilidades de DOM y controles comunes de la interfaz (elementos, iconos, botones, tooltip, campos, conmutador, segmentado, pestañas) según `docs/DISENO-GRAFICO.md`.

## Ficheros
- Código: `renderer/ui-kit.js` (ES module; no toca `document` al importarlo, solo dentro de las funciones).
- Pruebas: `test/ui-kit.test.js`, solo de las funciones puras (`ICON_NAMES`, `iconMarkup`, `formatKbd`, `normalizeAge`); los controles con DOM se comprueban en la integración.
- Referencia: `docs/DISENO-GRAFICO.md` secciones 3 (iconos), 5 (controles comunes), 6.8 (pestañas). Usa EXACTAMENTE las clases y la estructura DOM que describe.

## Interfaz pública
```js
export const ICON_NAMES: string[]          // play, pause, shot-prev, shot-next, volume, mute, film, xml, drop, check, error, warning, close, chevron-down, copy, next-pending, folder, image-off, spinner
export function iconMarkup(name: string): string            // contenido interior del <svg> (paths/rect/circle) de la tabla de iconos; lanza Error('Unknown icon "<name>".')
export function icon(name: string, size?: 'sm' | 'player' | 'dropzone'): SVGElement   // svg.icon.icon--<name> [icon--player|icon--dropzone], 24x24 viewBox, atributos de la sección 3
export function spinner(size?: 'sm' | 'player'): SVGElement  // icon('spinner') con clase extra `spinner`
export function el(tag: string, attrs?: object, ...children: any[]): HTMLElement
export function button(o: { variant?: 'primary'|'secondary'|'ghost', label: string, icon?: string, kbd?: string, className?: string, onClick?: Function }): HTMLButtonElement
export function iconButton(o: { icon: string, label: string, className?: string, iconSize?: 'sm'|'player', onClick?: Function }): HTMLButtonElement
export function setDisabled(btn: HTMLButtonElement, disabled: boolean): void
export function setLoading(btn: HTMLButtonElement, loading: boolean): void
export function tooltip(target: HTMLElement, content: string | (() => string | Node), o?: { kbd?: string }): void
export function createSwitch(o: { id: string, label: string, checked?: boolean, onChange?: (checked: boolean) => void }): { root: HTMLElement, input: HTMLInputElement, setChecked(v: boolean): void, setDisabled(v: boolean): void }
export function createField(o: { kind: 'input'|'select'|'textarea', id: string, label: string, optional?: boolean, placeholder?: string,
    options?: Array<{ value: string, label: string }>, value?: string, inputMode?: string, maxLength?: number, required?: boolean,
    minHeight?: 'default'|'quote', spellcheck?: boolean, onInput?: (value: string) => void, onBlur?: (value: string) => void }):
  { root: HTMLElement, control: HTMLElement, getValue(): string, setValue(v: string): void, setError(message: string | null): void, setHelp(text: string): void, setDisabled(v: boolean): void }
export function createSegmented(o: { id: string, label: string, options: string[], value?: string, onChange?: (value: string) => void }):
  { root: HTMLElement, getValue(): string, setValue(v: string): void, setError(message: string | null): void }
export function formatKbd(keys: string): string              // 'Ctrl+S' en Windows/Linux; en macOS ('darwin' según navigator.platform contiene 'Mac') 'Ctrl' → '⌘' y 'Alt' → '⌥'; el resto igual
export function normalizeAge(text: string): { value: string, valid: boolean }   // valid si /^\d{0,3}$/; value = text sin espacios alrededor
```

### Comportamiento
- `el(tag, attrs, ...children)`: `attrs.class` → `className`; `attrs.text` → `textContent`; `attrs.on` = `{ evento: fn }` → `addEventListener`; `attrs.dataset` = objeto → `dataset`; valores `true` → atributo vacío; `false`, `null`, `undefined` se omiten; el resto `setAttribute(clave, String(valor))`. `children`: nodos, cadenas (→ texto), arrays (se aplanan), `null`/`false` se omiten.
- `button`: `<button type="button" class="button button--<variant> [className]">` con `svg.icon` si hay `icon`, `<span class="button__label">`, y `<kbd class="kbd">` (texto `formatKbd(kbd)`) si hay `kbd`. Variante por defecto `secondary`.
- `iconButton`: `<button type="button" class="icon-button [className]" aria-label="<label>">` con el icono; tooltip automático con `label`.
- `setDisabled(btn, true)`: añade `is-disabled` y `aria-disabled="true"`; false los quita. No usa el atributo `disabled` (los botones siguen enfocables). Los manejadores de clic los decide cada módulo; `setDisabled` nunca bloquea eventos.
- `setLoading`: añade/quita `is-loading` y `aria-busy`; en carga fija el ancho actual con `style.width` (CSSOM) y sustituye el contenido por `spinner()`; al terminar restaura contenido y ancho.
- `tooltip(target, content, {kbd})`: UN `div.tooltip-layer` (creado la primera vez en `document.body`) con un `div.tooltip[role=tooltip]`; se enlaza por `aria-describedby` al objetivo (id generado). Aparece tras 500 ms con el puntero encima o al instante con `focus-visible` (`focusin` si el objetivo coincide con `:focus-visible`); se oculta con `pointerleave`, `blur`, `keydown` Escape y `pointerdown`. Posición: centrado sobre el objetivo a 8 px por encima; si no cabe arriba, debajo; limitado horizontalmente al viewport con margen de 8 px. `content` función → se evalúa al mostrar (así refleja el estado actual); `Node` se inserta tal cual; cadena vacía → no se muestra. `kbd` añade `kbd.kbd` tras el texto. Aparición: clase `is-visible` en el tooltip.
- `createSwitch`: estructura de 5.4 (`label.switch > input.switch__input[type=checkbox][role=switch] + span.switch__track > span.switch__thumb + span.switch__label`).
- `createField`: estructura de 5.3: `div.field [field--select|field--textarea]` con `label.field__label[for=id]`, `span.field__optional` «Optional» si `optional`, control con clase `field__input|field__select|field__textarea` y `id`; select = `div.field__select-wrap > select.field__select + svg.icon--chevron-down.field__chevron`; `is-empty` en el select cuando su valor es `''` (actualizado al cambiar); `aria-required="true"` si `required`; `p.field__help` (id `<id>-help`) y `p.field__error` (id `<id>-error`, con icono `error` de 14px delante) creados bajo demanda; `setError(msg)` pone/quita `is-error` en `.field`, `aria-invalid` en el control y mantiene `aria-describedby` con los ids existentes; `setError(null)` los limpia. Textarea: `rows` no se usa; altura automática: en cada `input` fija `style.height = 'auto'` y luego `style.height = Math.min(scrollHeight, 240) + 'px'` (CSSOM) y `overflow-y: auto` al pasar de 240. `onInput` en evento `input`; `onBlur` en `blur`. `setValue` asigna sin disparar `onInput` y actualiza `is-empty` y la altura del textarea. `inputMode`/`maxLength` → atributos `inputmode`/`maxlength`. `spellcheck` (solo textarea) → atributo `spellcheck="true"|"false"`; sin la opción no se pone el atributo (queda el corrector por defecto del navegador).
- `createSegmented`: estructura de 5.5 (radiogroup, `label.segmented__option[.is-checked] > input[type=radio][name=id] + span`); opciones en el orden dado; `setError` muestra `p.field__error` «Choose man or woman.» cuando recibe mensaje (el mensaje lo pone quien llama).
- Iconos: la tabla de la sección 3 del diseño más `panel-right` y `translate` de 13.3.4 (un elemento SVG por cada trazado indicado; los `fill="currentColor"` donde el diseño lo dice; `spinner` con `stroke-dasharray="42 15"`). Se construyen con `document.createElementNS('http://www.w3.org/2000/svg', ...)`; `iconMarkup` devuelve el mismo contenido como cadena para poder probarlo.

## Errores
- `Error('Unknown icon "<name>".')` en `iconMarkup`/`icon`/`spinner`/`iconButton`/`button` con icono inexistente.

## Dependencias
- Internas: ninguna. Externas: ninguna.

## Criterio de aceptación
1. `ICON_NAMES` tiene los 19 nombres; `iconMarkup('check')` contiene `M5 12.5l4.5 4.5L19 7.5`; `iconMarkup('play')` contiene `M8 5.5v13l10.5-6.5z`; nombre desconocido lanza el error exacto.
2. `normalizeAge('34')` → `{value:'34',valid:true}`; `'  7 '` → `{value:'7',valid:true}`; `''` → `valid:true`; `'3a'` y `'1234'` → `valid:false`.
3. `formatKbd` devuelve `'Ctrl+S'` cuando no hay `navigator` o no es Mac (la prueba no define `navigator` global).
4. El módulo se importa en Node sin lanzar (no hay referencia a `document` a nivel de módulo).
5. `createField` con `spellcheck: false` pone `spellcheck="false"` en el control; sin la opción no pone el atributo.

## Comando de pruebas
`node --test test/ui-kit.test.js`
