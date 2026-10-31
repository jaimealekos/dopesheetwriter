# Módulo: retranscribe

Responsabilidad: cuando el usuario cambia a mano el campo Language de un plano de entrevista ya transcrito, preguntar si se retranscribe en ese idioma y, si acepta, retranscribirlo (forzando el idioma en whisper) y retraducirlo en segundo plano, en una cola que acepta planos nuevos mientras trabaja. La transcripción normal (botón Transcribe y cola de entrevistas, 15) sigue autodetectando el idioma y escribiéndolo en Language, como ya hace. Textos y estados: `docs/DISENO-GRAFICO.md` §16, literal. Nivel: normal.

## Ficheros
- `core/languages.js`: `languageCodeFromName(value)`.
- `main/transcribe.js`: `transcribe(videoPath, start, end, language?)`; `buildWhisperArgs(paths, wav, outBase, threads, language = null)` pone `-l <language>` o `-l auto`.
- `main/ipc.js`, `main/preload.cjs`: `dsw.transcribe(videoPath, start, end, language?)` pasa el cuarto argumento.
- `renderer/flow-transcribe.js`: opción nueva `language` de `transcribeShot`.
- `renderer/flow-translate.js`: opción `replace` en `translateShot`.
- `renderer/flow-retranscribe.js` (nuevo): el flujo y su cola.
- `renderer/shot-editor.js`: opción `o.onLanguageCommit(number, previous, value)`; datalist de idiomas en Language.
- `renderer/feedback.js`: `confirmRetranscribe(rootEl, { number, languageName })`; copias `retranscribe-failed` del banner.
- `renderer/app.js`: crea y cablea el flujo; arbitra el indicador `queue-status`, `editor.setQueued` y `filmstrip.setProcessing` entre las dos colas.
- Pruebas: `test/languages.test.js`, `test/transcribe.test.js`, `test/ipc.test.js`, `test/flows.test.js`, `test/shot-editor.test.js`, `test/feedback.test.js`.

## Interfaz pública

### `core/languages.js`
```js
// 'French', 'french', 'Francés', 'frances', 'fr', ' FR ' → 'fr'; desconocido, vacío o no texto → null.
export function languageCodeFromName(value: unknown): string | null
```
Acepta, sin distinguir mayúsculas ni acentos y recortando espacios: el código ISO de `LANGUAGE_NAMES`, el nombre inglés de `LANGUAGE_NAMES` y el nombre castellano (Español/Castellano, Inglés, Catalán, Euskera/Vasco, Gallego, Francés, Alemán, Italiano, Portugués). Los alias castellanos van en una tabla junto a `LANGUAGE_NAMES`.

### `main/transcribe.js`
- `transcribe(videoPath, startSeconds, endSeconds, language = null)`: `language` es `null` (autodetección) o una clave de `LANGUAGE_NAMES`; otro valor → `RangeError('Unsupported transcription language: <x>.')` antes de lanzar ningún proceso.
- Con idioma forzado, el resultado es `{ text, language, languageName }` con el idioma forzado (no el que diga el JSON).

### `renderer/flow-transcribe.js`
`transcribeShot(number, { quiet = false, language = null } = {})`:
- `language` null: comportamiento actual, sin cambios.
- `language` código: retranscripción. Reemplaza Original sin pedir confirmación (el usuario ya aceptó en el modal) aunque tenga texto; llama a `dsw.transcribe(path, start, end, language)`; NO toca el campo Language ni hace `flashLanguage`. Si al volver el plano cambió de cortes, dejó de ser entrevista, o `languageCodeFromName(shot.soundbite.language)` ya no es `language` → `discarded` sin escribir.
- Nunca dos `dsw.transcribe` a la vez (como ahora).

### `renderer/flow-translate.js`
`translateShot(number, { quiet = false, replace = false } = {})`: `replace: true` traduce aunque Translation tenga texto, sin modal.

### `renderer/flow-retranscribe.js`
```js
export function createRetranscribeFlow(ctx: {
  state, banner, bannerRegion, toasts, announce, refreshAll,
  confirmRetranscribe: ({ number, languageName }) => Promise<boolean>,
  transcribeShot, translateShot, transcriberAvailable: () => boolean,
  setProgress(text | null), setProcessing(number | null, kind | null), setQueued(numbers[]),
}): {
  onLanguageCommit(number, previous: string, value: string): Promise<void>,
  isRunning(): boolean,
}
```
`onLanguageCommit` pregunta solo si se cumplen todas: el plano existe y es entrevista; transcriptor disponible; hay vídeo cargado; Original no está vacío; `languageCodeFromName(value)` no es null y es distinto de `languageCodeFromName(previous)`. Si no, no hace nada.
- Modal aceptado → encola `{ number, code }`. Si el plano ya está en espera, se cambia su código (no se duplica). Si está en curso, se añade de nuevo al final (la pasada en curso se descartará al volver porque Language ya no coincide).
- Modal rechazado («Not now»): nada; el Language nuevo se queda.
- Cola: un solo trabajador; mientras haya entradas, toma la primera y llama `transcribeShot(n, { quiet: true, language: code })`; con `done`, lanza `translateShot(n, { quiet: true, replace: true })` sin esperarla. El trabajador termina cuando no quedan entradas ni traducciones pendientes. Las entradas añadidas durante la marcha entran en la misma cola y suben N.
- Fallos (`failed` de transcribir o traducir): se acumulan; al final, banner `retranscribe-failed` con «Try again», que reencola los fallidos desde el paso que falló (traducción fallida → solo `translateShot(..., { replace: true })`).
- Cambio de vídeo o XML (identidad `video.path` + `xml.path`, como en 15): se vacía la cola en silencio y no se pinta nada más.
- `discarded`, `skipped` y `stale` no cuentan como fallo ni como hecho.

### `renderer/shot-editor.js`
- Language guarda el valor al enfocar; en el evento `change` (al salir del campo o pulsar Intro con el valor cambiado) llama a `o.onLanguageCommit(number, valorAlEnfocar, valorActual)` si son distintos. `onInput` sigue igual.
- `<datalist id="shot-editor-language-list">` con los nombres ingleses de `LANGUAGE_NAMES`, enlazado con el atributo `list` del input (sin `style=` ni scripts en línea).

### `renderer/app.js`
Las dos colas (entrevistas y retranscripción) comparten indicador, marca de la tira y «en espera» del editor. Cada una escribe en su propia ranura; app.js muestra: progreso = el de entrevistas si no es null, si no el de retranscripción; procesando = igual; en espera = unión de las dos listas. «Translate all» deshabilitado también mientras la retranscripción esté en marcha.

## Criterios de aceptación
1. `languageCodeFromName`: 'Francés' → 'fr', 'english' → 'en', 'EU' → 'eu', 'Klingon' → null, '' → null, 42 → null.
2. `buildWhisperArgs` con 'fr' lleva `-l fr`; sin idioma, `-l auto`. `transcribe` con 'xx' rechaza con RangeError sin ejecutar procesos; con 'fr' devuelve `languageName: 'French'` aunque el JSON diga 'es'.
3. Cambiar Language de 'Spanish' a 'French' en una entrevista transcrita abre el modal; aceptarlo llama `dsw.transcribe(..., 'fr')`, reemplaza Original sin `confirmReplace`, deja Language en 'French' y retraduce reemplazando Translation.
4. 'Spanish' → 'Castellano' (mismo código), valor desconocido, plano no entrevista u Original vacío: sin modal.
5. Tres cambios aceptados seguidos (plano 3, plano 5, plano 3 otra vez con otro idioma mientras 3 está en curso): nunca dos `dsw.transcribe` a la vez; el plano 5 se transcribe una vez; la primera pasada de 3 se descarta y gana la última; el indicador muestra «Retranscribing k of N…» con N creciendo.
6. Un fallo de transcripción no detiene la cola; al final, banner `retranscribe-failed`; «Try again» reencola solo el fallido.
7. Cambio de carga a mitad: la cola para y no escribe nada.
8. Con la cola de entrevistas en marcha, el indicador muestra la de entrevistas; al terminar ésta, la de retranscripción.
