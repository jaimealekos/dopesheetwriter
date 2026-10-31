# Módulo `shotlist-format`

Nivel: normal.
Responsabilidad: construir el texto final del shotlist (cabecera, IMAGES, planos y soundbites) y dar formato a la fecha de cabecera.

## Ficheros
- Código: `core/shotlist-format.js`.
- Pruebas: `test/shotlist-format.test.js`.
- Vecinos de referencia para el estilo: `core/timecode.js`, `core/shot-model.js`.

## Interfaz pública
```js
export class ShotlistError extends Error {}   // error.problems: string[]

/** @typedef {{ location:string, date:string, source:string }} Header */

export function formatDate(date: Date): string                 // 'MARCH 11, 2026'
export function validateHeader(header: Header): string[]       // problemas en inglés
export function buildShotlist(input: { header: Header, shots: Shot[], fps: number },
                              options?: { strict?: boolean }): string
```
- `formatDate(date)`: usa `getFullYear()`, `getMonth()`, `getDate()` locales y `MONTHS` de `core/config.js`: `new Date(2026, 2, 11)` → `'MARCH 11, 2026'`; `new Date(2026, 9, 1)` → `'OCTOBER 1, 2026'` (día sin cero a la izquierda).
- `validateHeader`: `Location is empty.`, `Date is empty.`, `Source is empty.` (campos vacíos tras `trim`), en ese orden.
- `buildShotlist` con `strict` true (por defecto): si hay problemas (cabecera o `validateForExport(shots)` de `core/shot-model.js`) lanza `ShotlistError` con `message` = problemas unidos por `\n` y `problems` = la lista. Con `strict: false` no lanza nunca y sustituye lo que falta por marcadores: `[SHOT SIZE]`, `[DESCRIPTION]`, `[NAME]`, `[GENDER]`, `[LANGUAGE]`, y cabecera vacía por `[LOCATION]`, `[DATE]`, `[SOURCE]`. Con lista de planos vacía y `strict: false` devuelve solo la cabecera y `IMAGES (00:00)`.

### Formato exacto (saltos de línea `\n`, el texto termina en un único `\n`)
```
SHOTLIST
{location}
{date}
SOURCE: {source}
<vacía>
IMAGES ({MM:SS})
<vacía>
{n}. {size}[, {movement en minúsculas}] - {description}        // una línea por plano que no es entrevista
<vacía>                                                          // solo si hay entrevistas
<vacía>
{n}. SOUNDBITE {k} - {who} ({language}, {gender}, {N}sec):
<vacía>
"{translation}"                                                  // omitida si está vacía
<vacía>
"{original}"                                                     // omitida (con su línea vacía anterior) si está vacía
<vacía>                                                          // entre entrevistas: dos líneas vacías; tras la última ninguna
<vacía>
```
- Todos los textos se recortan (`trim`) y cualquier salto de línea o secuencia de espacios interior se sustituye por un solo espacio.
- `{n}` es `shot.number`. `{k}` es `soundbiteIndex`. `{N}sec` con `formatSoundbiteSeconds(endFrame - startFrame, fps)`.
- `{who}` = `name`, y detrás, separados por `, `, `profession` si no está vacía y la edad si no está vacía (`'55'` → `55 years`; `'1'` → `1 year`).
- IMAGES = `formatDuration(framesToSeconds(suma de (endFrame - startFrame) de los planos que no son entrevista, fps))`.
- Las comillas de translation y original son `"` rectas; no se añaden si el texto ya empieza y termina por `"` (se quitan y se vuelven a poner una sola vez).
- Sin entrevistas: el texto acaba en la última línea de plano + `\n`. Sin planos normales pero con entrevistas: tras `IMAGES (00:00)` y su línea vacía van las dos vacías y el primer soundbite.

## Errores
- `ShotlistError` descrito arriba.
- `RangeError('fps must be a positive number')` si `fps` no es un número > 0 (estricto o no).

## Dependencias
- Internas: `core/timecode.js`, `core/shot-model.js`, `core/config.js`. Externas: ninguna.

## Criterio de aceptación
1. `formatDate` de los dos ejemplos y de `new Date(2026, 0, 31)` → `'JANUARY 31, 2026'`.
2. Cabecera `{location:'MADRID, SPAIN', date:'MARCH 17, 2024', source:'AFPTV'}`, fps 25, dos planos normales (`1. Wide shot` 0-100 frames «Tractors march»; `2. Wide shot` con movimiento `Pan right` 100-225 «General view»), dos entrevistas (números 3 y 4, 584 y 711 fotogramas) → texto exacto:
```
SHOTLIST
MADRID, SPAIN
MARCH 17, 2024
SOURCE: AFPTV

IMAGES (00:09)

1. Wide shot - Tractors march
2. Wide shot, pan right - General view


3. SOUNDBITE 1 - Vicente Aragón, Vineyard farmer from Tarancón, 33 years (Spanish, man, 23sec):

"We are suffering an unfair competition."

"Tenemos una competencia desleal."


4. SOUNDBITE 2 - Milagros Muñoz (Spanish, woman, 28sec):

"Translation two."

"Original dos."
```
   (la prueba compara la cadena entera, con `\n` final único).
3. Sin entrevistas: sin líneas vacías finales extra.
4. Entrevista con `translation` vacía → sin su línea; con `original` vacío → sin su bloque; ambos vacíos → solo la línea de cabecera de la entrevista.
5. Profession y edad vacías → `Name (Spanish, man, 23sec):`; solo edad → `Name, 33 years (...)`.
6. Descripción con saltos de línea y espacios dobles → una línea con espacios simples.
7. Texto ya entrecomillado `"Hello"` → una sola pareja de comillas.
8. Estricto con plano incompleto o cabecera vacía → `ShotlistError` con `problems`; `strict: false` → texto con marcadores y sin lanzar.
9. `fps` 0 → `RangeError`.

## Comando de pruebas
`node --test test/shotlist-format.test.js`
