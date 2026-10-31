# Módulo: auto-interviews

Responsabilidad: al entrar al espacio de trabajo con un vídeo y un XML nuevos (sin borrador), detectar por duración qué cortes del final son entrevistas, pedir confirmación en un modal y, si el usuario confirma, marcarlos y transcribirlos y traducirlos en segundo plano, de uno en uno, sin bloquear la edición. Aspecto, textos y estados: `docs/DISENO-GRAFICO.md` §15, que es literal y manda.

Nivel: normal. La detección (`core/interview-detect.js`) es trivial.

## Ficheros
- `core/interview-detect.js` (nuevo): función pura de detección.
- `core/config.js`: `INTERVIEW_MIN_SECONDS = 10.5` (documentado: duración que separa un corte de entrevista de un plano de imagen; calibrado con 8 reportajes reales, aciertan los 8 entre 10 y 11 s).
- `renderer/flow-auto-interviews.js` (nuevo): orquesta modal, marcado y cola.
- `renderer/flow-transcribe.js`: añade `transcribeShot(number, { quiet })`.
- `renderer/flow-translate.js`: añade `translateShot(number, { quiet })`.
- `renderer/flow-load.js`: `restoreDraft` devuelve si había borrador; al final de `tryEnterWorkspace` llama `ctx.onWorkspaceReady?.({ draftRestored })`.
- `renderer/feedback.js`: `confirmInterviews(rootEl, o)` (modal de §15.1) y la copia de banner de §15.
- `renderer/filmstrip.js`: `setProcessing(number | null, kind: 'transcribing' | 'translating' | null)` (marca `.shot-card.is-processing` y sufijo del `aria-label`, §15.2.3).
- `renderer/shot-editor.js`: `setQueued(numbers: number[])` (planos en espera: Transcribe desactivado con «Queued for transcription», §15.2.4); `setTranscribing`/`setTranslating` ya existentes cubren el plano en curso.
- `renderer/index.html`: nodo `div.queue-status` de §15.2.2 dentro de `.topbar__actions`.
- `renderer/app.js`: crea el flujo y lo cablea; `setProgress` pinta `queue-status`; «Translate all» desactivado mientras `isRunning()` (tooltip de §15.2.2).
- `renderer/css/*.css` y, si §15 lo pide, `renderer/index.html` (sin `style=` en línea ni scripts en línea: la CSP y `styles.md` lo vetan; `test/styles.test.js` comprueba listas de clases).
- Pruebas: `test/interview-detect.test.js` (nuevo), `test/flows.test.js`, `test/feedback.test.js`, `test/styles.test.js` si toca.

## Interfaz pública

### `core/interview-detect.js`
```js
// Número del primer plano de entrevista detectado, o null si no hay.
export function detectInterviewStart(
  shots: Array<{ number, startFrame, endFrame }>,   // en orden
  fps: number,
  minSeconds = INTERVIEW_MIN_SECONDS,
): number | null
```
Algoritmo (exacto): duración `d_i = (endFrame - startFrame) / fps`. Para cada punto de corte `k` en `0..n` (los planos `k..n-1` serían entrevista) la puntuación es `#{i < k : d_i < minSeconds} + #{i >= k : d_i >= minSeconds}`. Se elige el `k` de mayor puntuación; en empate, el mayor `k` (menos entrevistas). `k = n` → `null`; si no, `shots[k].number`. Lista vacía → `null`. `fps <= 0` → `RangeError('fps must be positive')`.

### `renderer/flow-transcribe.js` (añadido)
```js
transcribeShot(number, { quiet = false } = {}): Promise<{ status: 'done'|'skipped'|'discarded'|'stale'|'failed', error? }>
```
Igual que `onTranscribe` pero: sin confirmación (Original con texto → `'skipped'`), sin banner de fallo (devuelve `'failed'` con `error`), con `quiet` no anuncia «Transcribing…» ni «Transcription ready». Plano que no es entrevista, sin vídeo o herramienta no disponible → `'skipped'`. Si hay otra transcripción en curso, espera a que termine y entonces lo intenta (nunca dos a la vez). Cambio de carga → `'stale'`. `onTranscribe` pasa a usar el mismo núcleo; su comportamiento no cambia.

### `renderer/flow-translate.js` (añadido)
```js
translateShot(number, { quiet = false } = {}): Promise<{ status, error? }>
```
`runTranslation(number, { allowReplace: false })` con `quiet` que suprime los anuncios; sin banner. Devuelve el resultado tal cual.

### `renderer/feedback.js` (añadido)
```js
confirmInterviews(rootEl, o: { shots: Array<{ number, startFrame, endFrame }>, fps, first: number, transcriberAvailable: boolean }): Promise<number | null>
```
Modal de §15.1. Muestra los planos `first..último` con su duración en el formato de §15.1 («23.4s»), el cuerpo según `transcriberAvailable`, deja ajustar el primer plano con los controles de §15.1 (rango 1..último; al ajustar se actualiza la lista y el recuento en la región aria-live). Principal → resuelve con el primer plano elegido; secundario, Esc o clic en el fondo → `null`. Foco y teclado como `openConfirm`.

### `renderer/flow-auto-interviews.js`
```js
export function createAutoInterviewsFlow(ctx: {
  state, banner, bannerRegion, toasts, announce, commit, refreshAll,
  confirmInterviews: (o) => Promise<number | null>,
  transcribeShot: (number, o) => Promise<result>,
  translateShot: (number, o) => Promise<result>,
  transcriberAvailable: () => boolean,
  setProgress: (text: string | null) => void,                     // texto de queue-status (§15.2.2); null lo oculta
  setProcessing: (number | null, kind: 'transcribing' | 'translating' | null) => void, // filmstrip.setProcessing
  setQueued: (numbers: number[]) => void,                         // editor.setQueued
}): {
  onWorkspaceReady({ draftRestored: boolean }): Promise<void>,
  isRunning(): boolean,
}
```

## Comportamiento
1. `onWorkspaceReady`: no hace nada si `draftRestored`, si no hay planos o si algún plano ya es entrevista. Calcula `first = detectInterviewStart(state.shots, state.xml.parsed.fps)`; `null` → nada (sin modal).
2. Abre `confirmInterviews({ shots: state.shots, fps, first })`. Si mientras está abierto cambia la carga (vídeo o XML, mismo `loadToken` que los otros flujos) o devuelve `null` → termina sin cambios.
3. Confirmado con `f`: `state.shots = setInterview(state.shots, f, true)`, `commit()`, `refreshAll()`. Sin transcripción disponible, termina aquí. Si no, cola con los números `f..último`, cada uno con paso inicial `'transcribe'`.
4. Cola (textos literales de §15.2): toast inicial de §15.2.1; `setQueued(<pendientes de transcribir>)` al empezar y tras cada plano. Para cada plano con paso `'transcribe'`, en orden: `setProgress('Transcribing k of N…')`, `setProcessing(number, 'transcribing')` y `await transcribeShot(number, { quiet: true })`. Con `'done'` o `'skipped'` lanza `translateShot(number, { quiet: true })` sin esperarla (la transcripción del siguiente arranca ya). `'stale'` → para la cola en silencio y `setProgress(null)`. `'failed'` → anota el fallo y sigue.
5. Cada traducción marca `setProcessing(number, 'translating')` mientras dura si no hay transcripción en curso (la transcripción tiene prioridad en la marca). Al acabar las transcripciones, `setProgress('Translating k of N…')` mientras queden traducciones; espera todas. Traducción `'failed'` → fallo anotado con paso `'translate'`. Un plano cuya transcripción falla no se traduce.
6. Final: `setProgress(null)`, `setProcessing(null, null)`, `setQueued([])`. Con fallos → banner warning `interview-queue-failed` de §15.2.5 (título según el tipo de fallo; detalle con los dos primeros fallos «Shot <n>: <mensaje>» separados por «; » y « and N more.»; acción «Try again» que quita el banner y repite la cola solo con los fallidos, cada uno desde el paso que falló, con el toast inicial de §15.2.5). Con un banner de error visible, solo se anuncia el título. Sin fallos y con algo hecho → toast de éxito de §15.2. Cambio de carga en cualquier punto → nada.
7. `isRunning()` verdadero desde la confirmación hasta el final de la cola. Una segunda llamada a `onWorkspaceReady` con la cola en marcha de otra carga: la cola vieja se para sola por `'stale'`.
8. El usuario sigue editando: nada de lo anterior bloquea el renderer; un plano desmarcado durante la cola da `'skipped'` y no se traduce (translateShot ya lo salta).

## Criterio de aceptación
1. `detectInterviewStart` con duraciones `[7, 8, 6, 20, 15]` s a 25 fps → número del 4.º plano; `[7, 8, 13]` con `minSeconds` 10.5 → 3.º; `[7, 8, 6]` → `null`; `[]` → `null`; `[8.4, 0.1, 16.4, 17, 19.5, 13.5, 7.2, 6.8]` → 3.º (el corto final cuenta como entrevista, el corto de 0,1 s anterior no); empate `[20, 5]` (k=0 y k=2 puntúan 1) → `null`; `fps` 0 → `RangeError`.
2. Flujo con dobles: sin borrador y detección `first=4` de 5 → modal recibe `first:4`; confirmar con 4 marca 4 y 5 y llama `transcribeShot(4)`, luego `transcribeShot(5)`, y `translateShot` de cada uno tras su transcripción.
3. `draftRestored: true`, o un plano ya de entrevista → ni modal ni detección.
4. Modal devuelve `null` → planos sin cambios, sin cola.
5. Cambio de carga con el modal abierto → sin cambios.
6. `transcribeShot` devuelve `'failed'` en un plano → los demás siguen; banner agrupado con «Try again» que solo repite ese plano; sin toast de éxito.
7. `'stale'` → la cola para sin banner ni toast y `setProgress(null)`.
8. `setProgress` recibe «Transcribing 1 of 2…», «Transcribing 2 of 2…», luego «Translating …» y acaba en `null`; `setProcessing` acaba en `(null, null)`; `setQueued` acaba en `[]`.
12. Sin transcripción disponible: confirmar marca los planos y no llama a `transcribeShot`.
13. Fallo de traducción en un plano → banner «Couldn't translate 1 soundbite.»; «Try again» llama solo a `translateShot` de ese plano (sin transcribir de nuevo). Fallos de los dos tipos → «Couldn't finish N soundbites.».
14. `filmstrip.setProcessing` pone y quita `is-processing` y el sufijo «, transcribing» / «, translating» del `aria-label`; `editor.setQueued([4])` con el plano 4 mostrado → Transcribe desactivado con «Queued for transcription».
9. `transcribeShot`: Original con texto → `'skipped'` sin llamar a `dsw.transcribe`; `quiet` → sin anuncios; con una transcripción manual en curso espera a que termine (nunca dos `dsw.transcribe` simultáneos).
10. `confirmInterviews` (DOM falso): ajustar el primer plano cambia la lista y el recuento; principal resuelve con el número; Esc → `null`; con 0 entrevistas el principal está desactivado.
11. `npm test` entero en verde.

## Comando de pruebas
`node --test test/interview-detect.test.js test/flows.test.js test/feedback.test.js test/styles.test.js` y después `npm test`.
