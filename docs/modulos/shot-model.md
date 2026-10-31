# Módulo `shot-model`

Nivel: normal.
Responsabilidad: modelo puro e inmutable de los planos anotados: creación desde los cortes, edición, cascada de entrevistas, copia del anterior, validación, progreso y (de)serialización de anotaciones para el borrador.

## Ficheros
- Código: `core/shot-model.js`.
- Pruebas: `test/shot-model.test.js`.
- Vecinos de referencia para el estilo: `core/timecode.js`, `core/config.js` (constantes `SHOT_SIZES`, `MOVEMENTS`, `GENDERS`, `DEFAULT_LANGUAGE`).

## Interfaz pública
```js
/** @typedef {{ name:string, profession:string, age:string, language:string, gender:string,
 *              translation:string, original:string }} Soundbite
 *  @typedef {{ number:number, startFrame:number, endFrame:number, size:string, movement:string,
 *              description:string, interview:boolean, soundbite:Soundbite }} Shot
 *  @typedef {{ startFrame:number, endFrame:number }} Cut */

export function createShots(cuts: Cut[]): Shot[]
export function updateShot(shots: Shot[], number: number, patch: object): Shot[]
export function setInterview(shots: Shot[], number: number, value: boolean): Shot[]
export function copyFromPrevious(shots: Shot[], number: number): Shot[]
export function shotMissing(shot: Shot): string[]
export function isShotComplete(shot: Shot): boolean
export function progress(shots: Shot[]): { done: number, total: number }
export function nextPending(shots: Shot[], fromNumber: number): number | null
export function soundbiteIndex(shots: Shot[], number: number): number
export function validateForExport(shots: Shot[]): { ok: boolean, problems: string[] }
export function exportAnnotations(shots: Shot[]): Record<string, object>
export function applyAnnotations(shots: Shot[], annotations: Record<string, object>): Shot[]
```
Todas devuelven estructuras nuevas; nunca mutan la entrada (ni las arrays ni los objetos `soundbite`).

- `createShots(cuts)`: un `Shot` por corte, `number` 1..n en el orden recibido; `size`, `movement`, `description` `''`; `interview` false; `soundbite` con todo `''` salvo `language: DEFAULT_LANGUAGE`.
- `updateShot(shots, number, patch)`: fusiona claves permitidas: `size` (uno de `SHOT_SIZES` o `''`), `movement` (uno de `MOVEMENTS` o `''`), `description` (string), y `soundbite` (objeto parcial; fusión superficial; claves `name, profession, age, language, gender, translation, original`; `gender` uno de `GENDERS` o `''`; `age` cadena que cumpla `/^\d{0,3}$/`). Las cadenas de texto se guardan tal cual (sin `trim`; el recorte lo hace el formateador). `interview` NO se cambia por aquí.
- `setInterview(shots, number, value)`: `value` true → `interview = true` en los planos `number..último`; `value` false → `interview = false` en los planos `1..number`. No toca ningún otro dato.
- `copyFromPrevious(shots, number)`: copia del plano `number - 1` al plano `number`. Plano de imagen: `size`, `movement` y `description` del anterior (que no debe ser entrevista). Plano de entrevista: `soundbite.name`, `soundbite.age`, `soundbite.profession`, `soundbite.language` y `soundbite.gender` del anterior (que debe ser entrevista); `translation` y `original` del actual quedan intactos. Siempre devuelve un objeto nuevo para el plano afectado.
- `shotMissing(shot)`: lista de claves que faltan: plano normal → `'size'` si `size === ''`, `'description'` si `description.trim() === ''`; plano de entrevista → `'name'` si `soundbite.name.trim() === ''`, `'gender'` si `soundbite.gender === ''`, `'language'` si `soundbite.language.trim() === ''`. Orden: el de esta descripción.
- `isShotComplete(shot)`: `shotMissing(shot).length === 0`.
- `progress(shots)`: `total` = nº de planos; `done` = nº de completos.
- `nextPending(shots, fromNumber)`: primer plano incompleto con número > `fromNumber`; si no hay, el primer incompleto desde el principio (vuelta); `null` si todos están completos. Con `fromNumber` 0 empieza en el plano 1.
- `soundbiteIndex(shots, number)`: posición (1, 2, …) del plano entre los de entrevista en orden de número; 0 si el plano no es de entrevista.
- `validateForExport(shots)`: `problems` en inglés, en orden de plano: lista vacía de planos → `No shots.`; por cada plano incompleto `Shot N: missing <etiquetas>` con etiquetas `shot size`, `description`, `name`, `gender`, `language` separadas por `, `; por cada plano no-entrevista que tenga antes otro plano de entrevista → `Shot N: interviews must be at the end.`. `ok` = sin problemas.
- `exportAnnotations(shots)`: objeto con clave `` `${startFrame}-${endFrame}` `` y valor `{ size, movement, description, interview, soundbite }` (copia profunda del soundbite).
- `applyAnnotations(shots, annotations)`: por cada plano con clave presente, toma esos campos; valores inválidos (tipo erróneo, enumeración fuera de lista, edad no numérica) se sustituyen por el valor vacío/por defecto del plano recién creado, sin lanzar; claves desconocidas se ignoran; planos sin clave quedan intactos.

## Errores
- `RangeError('Shot <n> does not exist.')` si `number` no está en `shots`.
- `RangeError('Unknown field "<campo>" in shot update.')` / `RangeError('Invalid value for <campo>: <valor>.')` en `updateShot` con clave o valor no permitido.
- `Error('Shot 1 has no previous shot.')` en `copyFromPrevious` del plano 1; `Error('The previous shot is an interview.')` si el plano actual es de imagen y el anterior es entrevista; `Error('The previous shot is not an interview.')` si el plano actual es entrevista y el anterior no lo es.

## Dependencias
- Internas: `core/config.js`. Externas: ninguna.

## Criterio de aceptación
1. `createShots` de 3 cortes: números 1,2,3, campos vacíos, `language` `'Spanish'`.
2. `updateShot` no muta la entrada (`assert.notEqual` de referencias y original intacto), fusiona `soundbite` parcial sin perder las otras claves, rechaza `size: 'Huge'`, `age: '5a'`, clave `interview` y clave desconocida.
3. `setInterview(shots, 2, true)` en 4 planos → planos 2,3,4 en true y el 1 en false; `setInterview(res, 3, false)` → solo el 4 sigue en true y 1..3 en false.
4. `copyFromPrevious` copia size/movement/description entre planos de imagen; entre entrevistas copia los cinco campos del hablante y deja `translation`/`original` intactos; errores en plano 1, anterior entrevista (actual imagen) y anterior no-entrevista (actual entrevista).
5. `shotMissing` y `isShotComplete` para plano normal (vacío → `['size','description']`; con size y descripción de solo espacios → `['description']`) y de entrevista (vacío → `['name','gender']`; con `language` `'  '` → incluye `'language'`).
6. `progress`: 2 de 4 completos → `{done:2,total:4}`.
7. `nextPending(shots, 2)` salta al primer incompleto posterior; con incompletos solo antes da la vuelta; todos completos → `null`.
8. `soundbiteIndex` da 1 y 2 para dos entrevistas y 0 para un plano normal.
9. `validateForExport`: lista vacía → `['No shots.']`; plano 1 incompleto → `['Shot 1: missing shot size, description']`; construye a mano (sin usar `setInterview`) un plano normal tras uno de entrevista → contiene `Shot 3: interviews must be at the end.`; todo completo → `ok: true`.
10. `exportAnnotations` → `applyAnnotations` sobre `createShots` de los mismos cortes reproduce size, movement, description, interview y soundbite; una anotación con `size: 'Huge'` deja `size` en `''`; una clave de otro corte se ignora.

## Comando de pruebas
`node --test test/shot-model.test.js`

## Adenda: traducciones pendientes
```js
export function pendingTranslations(shots: Shot[]): number[]   // números de plano
```
Devuelve, en orden, los números de los planos de entrevista cuyo `soundbite.original` recortado no está vacío y cuyo `soundbite.translation` recortado sí está vacío. No muta. Pruebas: lista vacía → `[]`; planos de imagen se ignoran; entrevista con original y sin traducción → incluida; con traducción de solo espacios → incluida; con traducción → excluida; con original vacío → excluida.
