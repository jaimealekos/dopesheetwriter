# Módulo `shot-editor`

Nivel: normal.
Responsabilidad: formulario del plano seleccionado (tipo, movimiento, descripción, entrevista y sus datos), según `docs/DISENO-GRAFICO.md` 6.9.

## Ficheros
- Código: `renderer/shot-editor.js` (ES module; sin `document` a nivel de módulo).
- Pruebas: `test/shot-editor.test.js`: funciones puras y `mount` con un DOM falso mínimo (botón Transcribe, estados, marcadores, realce).
- Vecinos de referencia: `renderer/ui-kit.js`, `core/shot-model.js`, `core/timecode.js`.

## Interfaz pública
```js
export function interviewHelp(shots: Shot[], number: number): string
export function copyTooltip(shots: Shot[], number: number): string
export function missingText(shot: Shot): string                       // «Missing: shot size, description» o ''
export function translateTooltip(shot: Shot, busy: boolean, transcribing?: boolean): string  // tooltip de Translate
export function transcribeTooltip(shot: Shot, s: { busy, available, hasVideo, otherBusy: boolean }): string  // tooltip de Transcribe (14.1)
export function fieldErrors(shot: Shot): Record<string, string>       // clave de campo → mensaje; solo de los campos obligatorios vacíos

export function mount(root: HTMLElement, o: {
  onPatch: (number: number, patch: object) => void,        // patch de updateShot (size, movement, description, soundbite parcial)
  onInterview: (number: number, value: boolean) => void,   // conmutador
  onCopyPrevious: (number: number) => void,
  onNextPending: () => void,
  onTranslate: (number: number) => void,                   // botón «Translate» del soundbite; la traducción la hace `app`
  onTranscribe: (number: number) => void,                  // botón «Transcribe» de Original; la transcripción la hace `app`
}): {
  render(o: { shots: Shot[], number: number, fps: number, nextPending: number | null, showErrors: boolean }): void,
  focusFirstMissing(): void,
  setTranslating(number: number | null): void,             // número del plano en traducción (null = ninguno)
  setTranscribing(number: number | null): void,            // plano en transcripción (null = ninguno)
  setTranscriberAvailable(available: boolean): void,       // false hasta que llegue el estado
  setVideoLoaded(loaded: boolean): void,                   // true por defecto; `app` lo actualiza en cada refresco
  flashLanguage(): void,                                   // realce de Language (14.3)
  destroy(): void,
}
```
- `interviewHelp`: apagado → `Turning this on marks shots <n>–<last> as soundbites.` (guion corto `–`); encendido → `Turning this off unmarks shots <first>–<n>.` con `first` = número de la primera entrevista; si `first === n` → `Turning this off unmarks this shot.`
- `copyTooltip`: plano 1 → `No previous shot`; si el actual y el anterior no son del mismo tipo (entrevista/imagen) → `The previous shot is not an interview` (actual entrevista) o `The previous shot is an interview` (actual imagen); plano de imagen → `Copy shot size, movement and description from shot <n-1>`; entrevista → `Copy speaker details from shot <n-1>`. El botón «Copy from previous» está `is-disabled` cuando el plano es el 1 o cuando el actual y el anterior no son del mismo tipo.
- `translateTooltip`: `busy` → `Translating…`; `transcribing` → `Wait for the transcription to finish`; si `shot.soundbite.original` recortado está vacío → `Write the original text first`; si no → `Translate Original into <Spanish|English> (online service)` según `translationTarget(shot.soundbite.language)`.
- `transcribeTooltip` (prioridad): `busy` → `Transcribing…`; `!available` → `Transcription is not installed`; `!hasVideo` → `Load the video first`; `otherBusy` → `Another cut is being transcribed`; listo → `Transcribe this cut from the video (runs on this computer)`.
- Transcribe (`button.transcribe-button`, `aria-label` «Transcribe») va en la fila de la etiqueta de Original. Desactivado si no hay herramienta o se transcribe otro plano; con `setTranscribing(n)` del plano mostrado pasa a `is-loading` y Original queda `readOnly` con `aria-busy` (marcador «Transcribing…» si estaba vacío); Translate se desactiva. `hasVideo` es el último valor de `setVideoLoaded`. El marcador de Translation es «<Spanish|English> translation of what they say» según el idioma, recalculado en cada render. `flashLanguage` pone `is-autofilled` en Language hasta `animationend` o hasta cambiar de plano.
- `missingText`: `Missing: ` + etiquetas legibles de `shotMissing(shot)` (`size`→`shot size`, `description`→`description`, `name`→`name`, `gender`→`gender`, `language`→`language`) separadas por `, `; `''` si está completo.
- `fieldErrors`: por cada clave de `shotMissing`: `size` → `Choose a shot size.`, `description` → `Write a description.`, `name` → `Enter the speaker's name.`, `gender` → `Choose man or woman.`, `language` → `Enter the language.`. Además, si `soundbite.age` no cumple `normalizeAge(...).valid` (de `renderer/ui-kit.js`), `age` → `Age must be digits only, e.g. 34.` (el modelo no permite guardar edades inválidas; la entrada inválida se queda en el campo y se avisa sin emitir `onPatch`).

### `mount`
Los soundbites se muestran con la maquetación de la sección 13 del diseño (campos Translation y Original lado a lado). El botón «Translate» (sección 13, en la fila de la etiqueta del campo Translation, solo en planos de entrevista) está `is-disabled` (sigue enfocable, sin acción) cuando `translateTooltip` no es el de traducir; si no, un clic o Intro llama a `onTranslate(number)`. `setTranslating(n)`: si `n` es el plano mostrado, el botón pasa a `is-loading` (`setLoading`) y el textarea Translation queda `readOnly` con `aria-busy="true"`; con `null` o con otro plano, se restablece. Al cambiar de plano `render` respeta el estado de `setTranslating`.
Estructura de 6.9 con clases exactas, campos con `createField`/`createSwitch`/`createSegmented` de `ui-kit`. `render` es idempotente: reutiliza los controles y solo asigna valores (`setValue`) cuando el valor del modelo difiere del actual del control, para no perder el cursor mientras se escribe. Reglas:
- Cabecera: título `Shot <n>`; en entrevista, `SOUNDBITE <k> · <N>sec` (con `soundbiteIndex` y `formatSoundbiteSeconds`); temporización `<formatTimecode(start)> – <formatTimecode(end)> · <formatShotSeconds>`.
- Clases `is-interview` (oculta el grupo de imagen, muestra el de soundbite) e `is-incomplete` + línea `missingText`.
- Las opciones de los select salen de `SHOT_SIZES` y `MOVEMENTS` (`core/config.js`): Shot size con opción vacía «Select shot size»; Camera movement con «None» (valor `''`) primero.
- Los errores de campo se muestran solo con `showErrors` true (tras un intento de Generate), o en el campo de edad cuando la entrada es inválida (siempre), usando `setError`.
- Eventos: `input` de cada campo → `onPatch(number, {...})` inmediato (`size`, `movement`, `description`, `{ soundbite: { name|profession|age|language|gender|translation|original } }`); edad inválida no emite.
- Corrector ortográfico: el textarea Original (texto en el idioma original, normalmente español) se crea con `spellcheck: false` (atributo `spellcheck="false"`), para que el corrector en inglés no lo subraye; el resto de campos (Description, Translation, Name…) quedan con el corrector por defecto (inglés, fijado en `main-process`).
- Conmutador → `onInterview(number, checked)`. «Copy from previous» y «Next pending» con `setDisabled` (siguen enfocables); al pulsarlos deshabilitados no hacen nada. «Copy from previous» se habilita solo si el anterior es del mismo tipo (entrevista con entrevista, imagen con imagen); al pulsarlo llama a `onCopyPrevious(number)`. «Next pending» con `nextPending` (número o null): tooltip `Go to shot <n> · Ctrl+Enter` o `All shots are complete`.
- Foco: al re-renderizar por cambio de plano, si el campo enfocado existe en el nuevo plano sigue enfocado; si no, foco al primer campo del grupo visible. `focusFirstMissing()` enfoca el primer campo obligatorio vacío.

## Errores
No lanza; un `number` inexistente en `render` lanza `RangeError('Shot <n> does not exist.')`.

## Dependencias
- Internas: `renderer/ui-kit.js`, `core/shot-model.js`, `core/timecode.js`, `core/config.js`, `core/languages.js`. Externas: ninguna.

## Criterio de aceptación
1. `interviewHelp`: 26 planos, sin entrevistas, plano 24 → `Turning this on marks shots 24–26 as soundbites.`; entrevistas 24–26, plano 25 → `Turning this off unmarks shots 24–25.`; primera entrevista = plano actual → `Turning this off unmarks this shot.`
2. `copyTooltip`: plano 1, plano 12 de imagen, plano 24 entrevista con los textos exactos. `mount`: «Copy from previous» habilitado entre entrevistas y entre planos de imagen; deshabilitado en el plano 1 y cuando el anterior es de otro tipo.
3. `missingText` plano vacío → `Missing: shot size, description`; entrevista vacía → `Missing: name, gender`; completo → `''`.
4. `fieldErrors` de un plano de imagen vacío → `{ size:'Choose a shot size.', description:'Write a description.' }`; de entrevista vacía → `{ name:..., gender:... }`.
5. `translateTooltip`: original vacío o solo espacios → `Write the original text first`; con texto → `Translate Original into English (online service)` (o `Spanish` si Language es inglés); con `transcribing` → `Wait for the transcription to finish`; con `busy` true → `Translating…` (tiene prioridad).
6. El módulo se importa en Node sin lanzar.
7. `mount`: el textarea Original tiene `spellcheck="false"`; Translation, Description y Name no llevan el atributo.

## Comando de pruebas
`node --test test/shot-editor.test.js`
