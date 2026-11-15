# Módulo: interview-picker

Responsabilidad: sustituir el modal de confirmación de entrevistas (§15.1) por un selector gráfico que muestra todos los cortes de la secuencia con su duración y su proporción de voz, propone qué cortes del final son entrevistas y deja elegir, una a una, cuáles se transcriben y traducen y en qué idioma. Se abre solo al cargar un reportaje nuevo (como hoy) y también a mano con un botón de la barra superior. Aspecto, textos y estados: `docs/DISENO-GRAFICO.md` §17, literal, que manda sobre §15.1.

Nivel: normal. Se implementa en cuatro partes, en este orden: A (core), B (proceso principal), C (selector), D (flujo y cableado). A y B no dependen entre sí.

## Reglas que no cambian
- Las entrevistas son siempre una cola seguida al final de la secuencia (`core/shot-model.js` lo valida). El selector elige un **límite**: el primer corte de entrevista F. Los cortes F..último son entrevista; los anteriores, imagen.
- Dentro de la cola, cada entrevista tiene una casilla «transcribir». Una entrevista sin marcar queda como soundbite, con Original vacío.
- La transcripción sigue siendo de uno en uno (nunca dos `dsw.transcribe` a la vez).

## Parte A — `core/interview-detect.js` (+ `core/config.js`, ya con las constantes)

Constantes (ya en `core/config.js`): `INTERVIEW_MIN_SECONDS`, `INTERVIEW_MIN_VOICE`, `TRANSCRIBE_ESTIMATE_FIXED_SECONDS`, `TRANSCRIBE_ESTIMATE_SECONDS_PER_SECOND`, `INTERVIEW_NOTES_MAX`.

```js
// Fracción [0,1] de cada corte cubierta por voz. segments: [{ start, end }] en segundos del vídeo,
// en cualquier orden, pueden solaparse entre sí (se unen antes de medir). Duración 0 → 0.
// Tiempos del corte: startFrame / fps .. endFrame / fps (los mismos que usa la transcripción).
export function voiceFractions(shots, fps, segments): number[]

// ¿Parece entrevista? duración >= minSeconds y (voice null o voice >= minVoice).
export function looksLikeInterview(durationSeconds, voice /* number | null */, minSeconds = INTERVIEW_MIN_SECONDS, minVoice = INTERVIEW_MIN_VOICE): boolean

// Igual que hoy, con un quinto parámetro opcional: voices (array paralelo a shots, o null).
// El predicado «largo» de la puntuación pasa a ser looksLikeInterview(d_i, voices?.[i] ?? null, ...).
export function detectInterviewStart(shots, fps, minSeconds = INTERVIEW_MIN_SECONDS, voices = null, minVoice = INTERVIEW_MIN_VOICE): number | null

// Avisos para un límite F concreto (F = último + 1 si no hay entrevistas). Orden: por número de corte.
export function interviewNotes(shots, fps, first, voices = null, minSeconds, minVoice): Array<
  | { kind: 'long-image', number, seconds, voice /* number|null */ }   // corte < F que parece entrevista
  | { kind: 'low-voice',  number, seconds, voice /* number */ }        // corte >= F con voice conocido < minVoice
>

// Segundos estimados para transcribir cortes de esas duraciones: Σ (FIXED + PER_SECOND × d). [] → 0.
export function estimateTranscriptionSeconds(durationsSeconds: number[]): number

// Texto de la estimación: 0 → '' ; < 60 s → 'under 1 min' ; si no, '≈ N min' con N = Math.round(s / 60).
export function formatEstimate(seconds: number): string
```
Errores: `fps <= 0` → `RangeError('fps must be positive')` en `voiceFractions`, `detectInterviewStart` e `interviewNotes`. `voices` con longitud distinta de `shots` → `RangeError('voices must match shots')`.

Criterio de aceptación A:
1. Todos los casos actuales de `test/interview-detect.test.js` siguen en verde sin cambios (sin `voices` el resultado es idéntico).
2. `voiceFractions`: corte 0–10 s y segmentos `[{2,4},{3,6}]` → 0.4 (unión 2–6); segmento que sale del corte cuenta solo la parte de dentro; corte de duración 0 → 0; sin segmentos → todo 0.
3. Duraciones `[7, 8, 13, 20, 15]` con voces `[0, 0, 0.02, 0.9, 0.85]` → 4.º corte (el 3.º es largo pero sin voz); las mismas duraciones sin voces → 3.º. Duraciones `[7, 20, 15]` con voces `[0, 0.01, 0]` → `null` (sin voces → 2.º).
4. `interviewNotes` con `[12, 8, 20, 15]`, voces `[0.8, 0, 0.9, 0.1]`, F=3 → `[{long-image, 1}, {low-voice, 4}]`; sin voces, el 4.º no da aviso y el 1.º sí.
5. `estimateTranscriptionSeconds([20, 60])` = 6.3+5.8 + 6.3+17.4 = 35.8 (tolerancia 1e-9). `formatEstimate(0)` → `''`, `(35.8)` → `'under 1 min'`, `(150)` → `'≈ 3 min'`.

Pruebas: `node --test test/interview-detect.test.js`.

## Parte B — detector de voz en el proceso principal

Ficheros: `main/voice-activity.js` (nuevo), `main/transcribe.js` (solo `transcriberStatus`), `main/ipc.js`, `main/preload.cjs`, `scripts/fetch-transcriber.ps1`, pruebas `test/voice-activity.test.js` (nueva), `test/ipc.test.js`, `test/transcribe.test.js`.

```js
// main/voice-activity.js — solo módulos de node, como main/transcribe.js.
export function buildVoiceFfmpegArgs(videoPath, wavPath): string[]
//   ['-nostdin','-hide_banner','-loglevel','error','-i',videoPath,'-map','0:a:0','-vn','-sn','-dn',
//    '-ac','1','-ar','16000','-c:a','pcm_s16le','-y',wavPath]
export function buildVoiceToolArgs(paths, wavPath, threads): string[]
//   ['-np','-t',String(threads),'-vm',paths.vadModel,'-vt',String(VOICE_VAD.threshold),
//    '-vspd',String(VOICE_VAD.minSpeechMs),'-vsd',String(VOICE_VAD.minSilenceMs),
//    '-vp',String(VOICE_VAD.speechPadMs),'-f',wavPath]
export function parseVoiceSegments(stdout: string): Array<{ start: number, end: number }>
//   Líneas «Speech segment <i>: start = <cs>, end = <cs>» (centisegundos) → segundos (cs / 100).
//   Ignora el resto de líneas. Sin líneas → []. end < start en una línea → Error('Unexpected voice detector output.').
export function createVoiceDetector({ paths, runProcess, tmpRoot, threads }): {
  detect(videoPath: string): Promise<Array<{ start, end }>>
}
```
`paths` = el de `resolveTranscriberPaths` más `paths.voiceTool` (ruta absoluta de `VOICE_TOOL_FILE`). `detect`: carpeta temporal `dsw-voice-*` (se borra siempre, también con error), ffmpeg con `buildVoiceFfmpegArgs`, herramienta con `buildVoiceToolArgs`, parseo del stdout. Tiempo máximo por proceso `VOICE_TIMEOUT_MS`. Mismo `runProcess` por defecto que `main/transcribe.js` (puede exportarse de allí y reutilizarse; no lo dupliques). Errores (mensajes literales): ruta vacía → `TypeError('A video path is required.')`; stderr de ffmpeg con «matches no streams» → `Error('This video has no audio track.')`; ffmpeg con código ≠ 0 → `Error('Could not extract the audio (ffmpeg: <última línea>).')`; herramienta con código ≠ 0 → `Error('The voice detector failed (<última línea>).')`; tiempo agotado → `Error('Voice detection took too long and was stopped.')`. Hilos por defecto: los mismos que el transcriptor.

`transcriberStatus(paths)` añade `voiceAvailable: boolean`: `available` y además existe `paths.voiceTool`. `available` NO depende de la herramienta de voz.

IPC: canal `dsw:voiceActivity(videoPath)` → `detector.detect(videoPath)`; preload `dsw.voiceActivity(videoPath)`. Mismo patrón de errores que `dsw:transcribe` (el renderer recibe el rechazo con el mensaje).

`scripts/fetch-transcriber.ps1`: copia además `whisper-vad-speech-segments.exe` a `vendor\transcriber\whisper\`. Origen: `tools\whisper-cpp\` de Hispatrans y, si no está ahí, `.cache\extract-whisper-cpp\Release\` (misma compilación: `whisper.dll` idéntica, comprobado por md5). Si no aparece en ninguno, avisa y sigue (la herramienta es opcional). `scripts/deploy.ps1` no cambia (empaqueta `vendor/transcriber` entero).

Criterio de aceptación B:
1. `parseVoiceSegments` con la salida real de abajo → `[{start:0.3,end:4.12},{start:47.3,end:51.07}]`; texto sin segmentos → `[]`.
   ```
   Detected 2 speech segments:
   Speech segment 0: start = 30.00, end = 412.00
   Speech segment 1: start = 4730.00, end = 5107.00
   ```
2. `detect` con `runProcess` doble: llama primero a ffmpeg y luego a la herramienta con los argumentos exactos; borra la carpeta temporal en éxito y en fallo; cada error de arriba con su mensaje.
3. `transcriberStatus`: sin `voiceTool` → `{ available: true, voiceAvailable: false }`; sin modelo → `available: false, voiceAvailable: false`.
4. `test/ipc.test.js`: el canal existe y pasa la ruta.

Pruebas: `node --test test/voice-activity.test.js test/transcribe.test.js test/ipc.test.js`.

## Parte C — selector `renderer/interview-picker.js` (nuevo)

Sustituye a `confirmInterviews` de `renderer/feedback.js` (se borra de allí, con sus constantes de texto, su CSS `.interview-detect*` y sus pruebas; `test/styles.test.js` se actualiza). Reutiliza de `feedback.js` y `ui-kit.js` lo que ya exista (trampa de foco, `restoreModalFocus`, `el`, `button`, `tooltip`); si hace falta exportar algo de allí, se exporta, no se copia.

```js
export function openInterviewPicker(rootEl, o: {
  shots: Array<{ number, startFrame, endFrame, interview, soundbite: { original, language } }>,  // en orden
  fps: number,
  first: number,                 // límite propuesto; last + 1 = ninguna entrevista
  voices: number[] | null,       // paralelo a shots; null = sin datos de voz
  transcriberAvailable: boolean,
  languages: Array<{ code, name }>,   // de LANGUAGE_NAMES, en ese orden
  thumbnails: { get(number): string | null | undefined, subscribe(fn: (number, url) => void): () => void },
  videoUrl: string | null,       // para la escucha previa; null la desactiva
  onPreviewStart?: () => void,   // app.js pausa el reproductor principal
  mode: 'auto' | 'manual',       // auto = al cargar; manual = botón de la barra
}): Promise<null | {
  first: number,                          // límite elegido
  transcribe: number[],                   // entrevistas marcadas para transcribir, ascendente
  languages: Record<number, string | null>,  // solo para las de `transcribe`; código o null = auto
}>
```

Comportamiento (aspecto y textos literales en §17):
1. Gráfico: una barra por corte, en orden, ancho proporcional a su duración (con un mínimo visual fijado en §17) y altura proporcional a su duración (escala común, tope fijado en §17). Línea horizontal del umbral `INTERVIEW_MIN_SECONDS`. Las barras >= F con aspecto de entrevista; las anteriores, de imagen. Con `voices`, cada barra muestra además su fracción de voz (§17).
2. Límite: un tirador entre la última barra de imagen y la primera de entrevista. Se mueve arrastrando (puntero; se ajusta al hueco entre barras más cercano), con las flechas Izquierda/Derecha cuando tiene el foco, y con Inicio/Fin (todas entrevista / ninguna). Rango de F: 1..último+1. Cada cambio actualiza gráfico, filas, recuento (región aria-live), avisos y estimación.
3. Filas: una por entrevista (F..último), con número, duración (formato «23.4s» de §15.1), voz si la hay («85% speech»), casilla «Transcribe» y selector de idioma («Auto» + `languages`). Por defecto, al abrir: marcadas todas las entrevistas con Original vacío; las de Original con texto se muestran «Transcribed», con casilla desactivada y sin selector. Una entrevista que entra al mover el límite llega marcada (si su Original está vacío); una que sale y vuelve a entrar recupera su estado anterior. Botones «All» y «None» sobre las casillas habilitadas. Espacio sobre una fila enfocada alterna su casilla.
4. Sin transcripción disponible (`transcriberAvailable` false): ni casillas ni idioma ni estimación; el resultado lleva `transcribe: []`.
5. Hover o foco sobre una barra: tarjeta flotante con la miniatura (`thumbnails.get`; `undefined` = cargando, `null` = sin miniatura) y «Shot 27 · 23.4s · 85% speech». Las miniaturas que llegan con el selector abierto se pintan al llegar (`subscribe`; se cancela al cerrar).
6. Escucha previa: clic en una barra (o Intro con la barra enfocada) reproduce ese corte desde su inicio, como mucho `INTERVIEW_PREVIEW_SECONDS` o hasta su final, en un elemento `<video>` propio del selector sin imagen visible (solo audio) con `videoUrl`; llama `onPreviewStart()` al empezar. Otro clic en la misma barra la para; clic en otra cambia de corte. La barra que suena se marca (§17). Se para al cerrar. Si falla la reproducción: se para en silencio y se anuncia «Can't play this cut.».
7. Avisos: `interviewNotes` del límite actual, como mucho `INTERVIEW_NOTES_MAX`, y «and N more» si hay más. Textos en §17.
8. Estimación: `formatEstimate(estimateTranscriptionSeconds(<duraciones de las marcadas>))` («≈ 3 min to transcribe»; vacío si no hay marcadas).
9. Botones: principal «Mark as interviews» (con k = 0 entrevistas en modo auto: desactivado; en modo manual: habilitado y su texto pasa a «Clear interviews» si hay entrevistas actuales, que el resultado quita); secundario «Not interviews» (modo auto) / «Cancel» (modo manual). Esc y clic en el fondo = secundario → `null`.
10. Foco inicial en el principal. Trampa de foco con Tab como `openConfirm`, recalculando los enfocables en cada Tab. Al cerrar, foco como `restoreModalFocus`.

Criterio de aceptación C (DOM falso, como `test/feedback.test.js`; prueba nueva `test/interview-picker.test.js`):
1. Abre con F=4 de 5 → filas 4 y 5 marcadas; principal resuelve `{ first: 4, transcribe: [4,5], languages: {4:null,5:null} }`.
2. Flecha izquierda en el límite → F=3, fila 3 marcada; Fin → sin filas, principal desactivado (auto).
3. Desmarcar la fila 4 y elegir francés en la 5 → `{ first: 4, transcribe: [5], languages: {5:'fr'} }`.
4. Entrevista con Original con texto → «Transcribed», fuera de `transcribe`.
5. `transcriberAvailable: false` → sin casillas; `transcribe: []`.
6. Esc → `null`; fondo → `null`.
7. Miniatura que llega por `subscribe` con la tarjeta abierta se pinta; al cerrar se cancela la suscripción.
8. Avisos y estimación cambian al mover el límite.
9. Modo manual sin entrevistas propuestas (F = último+1) → principal habilitado; con entrevistas actuales su texto es «Clear interviews».

Pruebas: `node --test test/interview-picker.test.js test/feedback.test.js test/styles.test.js`.

## Parte D — flujo y cableado

Ficheros: `renderer/flow-auto-interviews.js`, `renderer/app.js`, `renderer/filmstrip.js`, `renderer/index.html`, `renderer/css/*.css`, `docs/modulos/auto-interviews.md` (actualizar a la nueva firma), pruebas `test/flows.test.js`, `test/filmstrip.test.js`, `test/styles.test.js`.

`createAutoInterviewsFlow(ctx)`: `ctx.confirmInterviews` se sustituye por `ctx.openPicker(o)` (= `openInterviewPicker(dom.modalRoot, o)` con `languages`, `thumbnails`, `videoUrl` y `onPreviewStart` que pone app.js) y se añaden `ctx.voiceActivity(videoPath) → Promise<segments>` y `ctx.voiceAvailable() → boolean`. Devuelve además `openManual(): Promise<void>`.

1. `onWorkspaceReady` (condiciones de entrada iguales que hoy). Si `voiceAvailable()`: `segments = await voiceActivity(state.video.path)`; error → `voices = null`, sin aviso al usuario (la detección sigue por duración). `voices = voiceFractions(...)`. `first = detectInterviewStart(shots, fps, INTERVIEW_MIN_SECONDS, voices)`; `null` → nada. Abre el selector en modo `'auto'`. Cambio de carga durante la detección de voz o con el selector abierto → termina sin cambios.
2. `openManual()`: no hace nada si `isRunning()` (el botón ya está desactivado). Voces como en 1 (se guardan por carga: la segunda vez no se vuelve a llamar a `voiceActivity` con la misma carga). `first` = número de la primera entrevista actual; sin entrevistas, la detección; sin detección, último + 1. Modo `'manual'`.
3. Resultado `{ first, transcribe, languages }`: si `first > 1` → `setInterview(shots, first - 1, false)`; si `first <= último` → `setInterview(shots, first, true)`. Para cada número de `transcribe` con `languages[n]` no nulo: Language del soundbite = `languageNameFromCode(code)` (antes de encolar). `commit()`, `refreshAll()`. Cola (§15.2, sin cambios en su comportamiento) solo con los números de `transcribe`; los que llevan idioma se transcriben con `transcribeShot(n, { quiet: true, language: code })`, el resto sin `language`. `transcribe` vacío → sin cola ni toast.
4. `isRunning()` igual que hoy.

`renderer/filmstrip.js`: tarjeta de entrevista con Original vacío y sin marca de proceso ni en espera → clase `is-untranscribed` y sufijo «, not transcribed» en el `aria-label` (§17). Se recalcula en `setShots` y `refreshStatus`.

`renderer/index.html` + `app.js`: botón «Interviews…» en `.topbar__actions` (§17) que llama `flow.openManual()`; desactivado (`is-disabled`, tooltip de §17) sin espacio de trabajo o con cualquiera de las dos colas en marcha (la de entrevistas o la de retranscripción). Atajo Alt+I con el mismo efecto (comprueba antes que Alt+I está libre en `app.js`; si no, el de §17).

Criterio de aceptación D (dobles, `test/flows.test.js`):
1. Con voz disponible: llama a `voiceActivity` una vez y pasa `voices` al selector; con error de voz, pasa `voices: null` y abre igual.
2. Resultado `{ first: 4, transcribe: [5], languages: {5:'fr'} }` de 5 cortes → 4 y 5 entrevista; Language del 5 = «French»; `transcribeShot` solo del 5 con `language: 'fr'`.
3. `openManual` con entrevistas desde el 3 y resultado `first: 4` → el 3 deja de ser entrevista.
4. `openManual` con resultado `first: último+1` → ninguna entrevista.
5. Cambio de carga durante `voiceActivity` → no abre el selector.
6. `filmstrip`: entrevista sin Original → `is-untranscribed`; con texto o en proceso → sin la clase.
7. `npm test` entero en verde.

## Comando de pruebas
Por parte, el indicado; al final, `npm test`.
