# Módulo: auto-interviews

Responsabilidad: al entrar al espacio de trabajo con un vídeo y un XML nuevos (sin borrador), detectar por duración y por voz qué cortes del final son entrevistas y abrir el selector gráfico (`interview-picker`, §17); también abrirlo a mano desde la barra superior o con Alt+I. Con lo elegido marca el límite imagen/entrevistas, fija el idioma de las que se piden con idioma y transcribe y traduce en segundo plano, de uno en uno, sin bloquear la edición. Aspecto, textos y estados: `docs/DISENO-GRAFICO.md` §15 y §17, que son literales y mandan.

Nivel: normal. La detección (`core/interview-detect.js`) y la voz (`main/voice-activity.js`) ya están hechas.

## Ficheros
- `core/interview-detect.js`: `voiceFractions`, `looksLikeInterview`, `detectInterviewStart` (con `voices`), `interviewNotes`, `estimateTranscriptionSeconds` y `formatEstimate`.
- `core/config.js`: `INTERVIEW_MIN_SECONDS`, `INTERVIEW_MIN_VOICE`, `TRANSCRIBE_ESTIMATE_*`, `INTERVIEW_NOTES_MAX`, `INTERVIEW_CHART_*`, `INTERVIEW_PREVIEW_SECONDS`.
- `main/voice-activity.js` y `main/transcribe.js`: detección de voz; `transcriberStatus().voiceAvailable` no depende de que exista la herramienta de transcripción.
- `renderer/interview-picker.js`: `openInterviewPicker(rootEl, o)` (§17 y `docs/modulos/interview-picker.md`, Parte C).
- `renderer/flow-auto-interviews.js`: orquesta detección, selector, marcado y cola.
- `renderer/flow-transcribe.js`: `transcribeShot(number, { quiet, language })`.
- `renderer/flow-translate.js`: `translateShot(number, { quiet })`.
- `renderer/flow-load.js`: `restoreDraft` devuelve si había borrador; al final de `tryEnterWorkspace` llama `ctx.onWorkspaceReady?.({ draftRestored })`.
- `renderer/filmstrip.js`: `setProcessing`, `setQueued` y la marca `.is-untranscribed` de §17.11; expone `thumbnails` para el selector.
- `renderer/shot-editor.js`: `setQueued(numbers)` (planos en espera: Transcribe desactivado con «Queued for transcription», §15.2.4).
- `renderer/index.html`: nodo `div.queue-status` de §15.2.2 dentro de `.topbar__actions`. Sin cambios por el botón «Interviews…»: lo monta `app.js` en `.topbar__buttons`.
- `renderer/app.js`: monta el botón «Interviews…» y Alt+I; crea el flujo y lo cablea; `setProgress` pinta `queue-status`; «Translate all» desactivado mientras `isRunning()`.
- `renderer/css/*.css` y, si §15/§17 lo piden, `renderer/index.html` (sin `style=` en línea ni scripts en línea: la CSP y `styles.md` lo vetan; `test/styles.test.js` comprueba listas de clases).
- Pruebas: `test/interview-detect.test.js`, `test/voice-activity.test.js`, `test/interview-picker.test.js`, `test/flows.test.js`, `test/filmstrip.test.js`, `test/styles.test.js`.

## Interfaz pública

### `renderer/flow-auto-interviews.js`
```js
export function createAutoInterviewsFlow(ctx: {
  state, banner, bannerRegion, toasts, announce, commit, refreshAll,
  openPicker: (o) => Promise<null | {
    first: number, transcribe: number[], languages: Record<number, string | null>,
  }>,
  voiceActivity: (videoPath: string) => Promise<Array<{ start, end }>>,
  voiceAvailable: () => boolean,
  transcribeShot: (number, o) => Promise<result>,
  translateShot: (number, o) => Promise<result>,
  transcriberAvailable: () => boolean,
  setProgress: (text: string | null) => void,                     // texto de queue-status (§15.2.2); null lo oculta
  setProcessing: (number | null, kind: 'transcribing' | 'translating' | null) => void,
  setQueued: (numbers: number[]) => void,
}): {
  onWorkspaceReady({ draftRestored: boolean }): Promise<void>,
  openManual(): Promise<void>,
  isRunning(): boolean,
  isPicking(): boolean,
}
```
`openPicker` es `openInterviewPicker(dom.modalRoot, o)` con `languages` (de `LANGUAGE_NAMES`, en orden), `thumbnails` (de `filmstrip.thumbnails`), `videoUrl` (la misma URL que usa el reproductor) y `onPreviewStart` (pausa el reproductor principal), que pone `app.js`.

### `renderer/filmstrip.js` (añadidos)
```js
setQueued(numbers: number[]): void
thumbnails: {
  get(number): string | null | undefined,           // miniaturas ya cargadas; undefined = aún no llegó
  subscribe(fn: (number, url) => void): () => void, // avisa al aplicar cada miniatura
}
```
`cardAriaLabel(shot, fps, complete, soundbite, processing = null, untranscribed = false)` añade `, not transcribed` (§17.11).

## Comportamiento
1. `onWorkspaceReady`: no hace nada si `draftRestored`, si no hay planos, si algún plano ya es entrevista, si falta el XML o si `isPicking()`. Con `voiceAvailable()`, pide `voiceActivity(state.video.path)`; un error o una carga cambiada durante la detección da `voices = null` o termina sin abrir, sin aviso al usuario. `voices = voiceFractions(shots, fps, segments)`. `first = detectInterviewStart(shots, fps, INTERVIEW_MIN_SECONDS, voices)`; `null` → nada. Abre el selector en modo `'auto'` con `voices`.
2. `openManual`: no hace nada si `isRunning()`, `isPicking()` o sin espacio de trabajo. Reutiliza las voces de la carga (la segunda vez no vuelve a pedirlas). `first` = número de la primera entrevista actual; sin entrevistas, la detección; sin detección, último + 1. Modo `'manual'`.
3. Desde el inicio de la detección de voz hasta que el selector se cierra, `isPicking()` es verdadero y las dos entradas no hacen nada: no se lanzan dos detecciones ni se apilan dos selectores. La detección de voz en curso se guarda por carga.
4. Resultado `{ first, transcribe, languages }`: si `first > 1` → `setInterview(shots, first - 1, false)`; si `first <= último` → `setInterview(shots, first, true)`. Para cada número de `transcribe` con `languages[n]` no nulo, Language del soundbite = `languageNameFromCode(code)` antes de encolar; un código desconocido lanza `Error('Unknown language code "<code>".')`. `commit()` y `refreshAll()`. Sin `transcribe` → ni cola ni toast.
5. Cola (§15.2, sin cambios): solo con los números de `transcribe`, en orden. Toast inicial de §15.2.1; `setQueued(<pendientes>)` al empezar y tras cada plano. Para cada plano: `setProgress('Transcribing k of N…')`, `setProcessing(number, 'transcribing')` y `transcribeShot(number, { quiet: true, language: code })` si lleva idioma, o `{ quiet: true }` si no. Con `'done'` o `'skipped'` lanza `translateShot(number, { quiet: true })` sin esperarla. `'stale'` → para en silencio y `setProgress(null)`. `'failed'` → anota el fallo y sigue.
6. Cada traducción marca `setProcessing(number, 'translating')` mientras dura si no hay transcripción en curso. Al acabar las transcripciones, `setProgress('Translating k of N…')` mientras queden traducciones; espera todas. Un plano cuya transcripción falla no se traduce.
7. Final: `setProgress(null)`, `setProcessing(null, null)`, `setQueued([])`. Con fallos → banner warning `interview-queue-failed` de §15.2.5, con «Try again» que repite solo los fallidos desde el paso que falló. Con un banner de error visible, solo se anuncia el título. Sin fallos y con algo hecho → toast de éxito de §15.2. Cambio de carga en cualquier punto → nada.
8. `isRunning()` verdadero desde que arranca la cola hasta su final. Una segunda cola de otra carga deja que la vieja se pare sola por `'stale'`.
9. El usuario sigue editando: nada de lo anterior bloquea el renderer; un plano desmarcado durante la cola da `'skipped'` y no se traduce.

## Botón «Interviews…» y atajo (17.10)
- Primer hijo de `.topbar__buttons`, antes de «Translate all», «Preview» y «Generate»: icono `transcribe` + «Interviews…». Llama `openManual()`.
- Desactivado (`is-disabled` + `aria-disabled`) sin espacio de trabajo («Load a video and its XML first») o con cualquiera de las dos colas en marcha («Wait for the background transcription to finish»). Listo: «Choose interview cuts» con `.kbd` Alt+I.
- Alt+I tiene el mismo efecto, también dentro de campos de texto; no actúa con un modal abierto ni con el botón desactivado.

## Marca `is-untranscribed` en la tira (17.11)
Entrevista con Original vacío, sin `is-processing` y fuera de las colas (`filmstrip.setQueued`): clase `is-untranscribed`, icono `transcribe` en la miniatura y sufijo «, not transcribed» en el `aria-label`. Se recalcula en `setShots`, `refreshStatus`, `setProcessing` y `setQueued`.

## Criterio de aceptación
1. Con voz disponible: `voiceActivity` se llama una vez y el selector recibe `voices`; con error de voz, recibe `voices: null` y el selector abre igual, sin aviso.
2. Resultado `{ first: 4, transcribe: [5], languages: { 5: 'fr' } }` de 5 cortes → 4 y 5 entrevista; Language del 5 = «French»; `transcribeShot` solo del 5 con `language: 'fr'`.
3. `openManual` con entrevistas desde el 3 y resultado `first: 4` → el 3 deja de ser entrevista.
4. `openManual` con resultado `first: último + 1` → ninguna entrevista y sin cola.
5. Cambio de carga durante `voiceActivity` o con el selector abierto → no abre o no cambia nada.
6. Cola: progreso, marcas y `setQueued` acaban limpios; un fallo no detiene el resto y «Try again» repite solo lo fallido; `'stale'` para sin banner ni toast.
7. `filmstrip`: entrevista sin Original → `is-untranscribed`; con texto, en proceso o en espera → sin la clase. `thumbnails.get` y `thumbnails.subscribe` entregan las miniaturas cargadas.
8. `npm test` entero en verde.

## Comando de pruebas
`node --test test/flows.test.js test/filmstrip.test.js test/styles.test.js` y después `npm test`.
