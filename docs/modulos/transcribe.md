# Módulo: transcribe

Responsabilidad: transcribir localmente el audio de un tramo del vídeo (el corte de entrevista que marca el XML) con el mismo sistema que Hispatrans (whisper.cpp, modelo Whisper large-v3 q8_0, detección de voz Silero con los mismos parámetros, búsqueda en haz 5), detectar su idioma, y elegir el sentido de la traducción según el idioma del soundbite. Corre en el proceso principal: el renderer no puede lanzar procesos.

## Ficheros
- `core/languages.js` (nuevo, ES module puro, sin Node: lo importa también el renderer).
- `main/transcribe.js` (nuevo; solo `node:`; no importa electron).
- `main/translate.js` (cambia: idioma destino por parámetro).
- `main/ipc.js`, `main/preload.cjs`, `main/main.js` (canales nuevos y cableado).
- `core/config.js` (constantes nuevas).
- `package.json` (empaquetado de las herramientas), `scripts/fetch-transcriber.ps1` (nuevo), `.gitignore` (`vendor/`).
- Pruebas: `test/languages.test.js`, `test/transcribe.test.js` (nuevos, sin red ni binarios reales: `runProcess` falso), y ampliar `test/translate.test.js` y `test/ipc.test.js`.

## Configuración (`core/config.js`)
```js
// Transcripción local (mismo sistema que Hispatrans). Rutas relativas a la carpeta de herramientas.
export const TRANSCRIBER_DIR_NAME = 'transcriber';          // vendor/transcriber en desarrollo; resources/transcriber empaquetado
export const TRANSCRIBER_FILES = {
  ffmpeg: 'ffmpeg.exe',
  whisper: 'whisper/whisper-cli.exe',
  model: 'models/ggml-large-v3-q8_0.bin',
  vadModel: 'models/ggml-silero-v6.2.0.bin',
};
export const TRANSCRIBE_BEAM_SIZE = 5;
export const TRANSCRIBE_VAD = { threshold: 0.5, minSpeechMs: 250, minSilenceMs: 2000, speechPadMs: 400 };
export const TRANSCRIBE_TIMEOUT_MS = 600000;               // por proceso (ffmpeg o whisper)
export const TRANSCRIBE_MAX_SECONDS = 600;                 // tramo máximo
// TRANSLATE_TARGET_LANG desaparece: el destino lo decide translationTarget().
```

## Interfaz pública

### `core/languages.js`
```js
export const LANGUAGE_NAMES  // { es:'Spanish', en:'English', ca:'Catalan', eu:'Basque', gl:'Galician', fr:'French', de:'German', it:'Italian', pt:'Portuguese' }
export function languageNameFromCode(code: string): string | null   // 'es' → 'Spanish'; 'ES' también; desconocido o vacío → null
export function isEnglish(language: string): boolean                // campo Language del soundbite: 'English', ' english ', 'inglés', 'Ingles', 'en' → true; resto → false
export function translationTarget(language: string): 'es' | 'en'    // isEnglish → 'es'; cualquier otro (incluido vacío) → 'en'
export function targetLanguageLabel(target: 'es' | 'en'): string    // 'es' → 'Spanish', 'en' → 'English'; otro → RangeError
```

### `main/transcribe.js`
```js
export function resolveTranscriberPaths(baseDir: string): { ffmpeg, whisper, model, vadModel }   // path.join(baseDir, TRANSCRIBER_FILES[k])
export async function transcriberStatus(paths, o?: { access? }): Promise<{ available: boolean, missing: string[] }>
  // missing: rutas absolutas que no existen (fs.access por defecto), en el orden ffmpeg, whisper, model, vadModel.
export function buildFfmpegArgs(videoPath: string, startSeconds: number, endSeconds: number, wavPath: string): string[]
export function buildWhisperArgs(paths, wavPath: string, outBase: string, threads: number): string[]
export function parseWhisperJson(json: any): { text: string, language: string | null }
export function createTranscriber(o: {
  paths, runProcess?, tmpRoot?, threads?, readFile?,      // inyectables para pruebas
}): { transcribe(videoPath: string, startSeconds: number, endSeconds: number): Promise<{ text: string, language: string | null, languageName: string | null }> }
```

## Comportamiento
- `buildFfmpegArgs`: `['-nostdin','-hide_banner','-loglevel','error','-ss', s(start),'-t', s(end-start),'-i', videoPath,'-map','0:a:0','-vn','-sn','-dn','-ac','1','-ar','16000','-c:a','pcm_s16le','-y', wavPath]`, con `s(x)` = segundos con 3 decimales (`x.toFixed(3)`).
- `buildWhisperArgs`: `['-m', model, '-f', wavPath, '-l', 'auto', '-t', String(threads), '-bs', String(TRANSCRIBE_BEAM_SIZE), '--vad', '-vm', vadModel, '-vt', '0.5', '-vspd', '250', '-vsd', '2000', '-vp', '400', '-oj', '-of', outBase, '-np']` (valores de `TRANSCRIBE_VAD`). whisper-cli escribe `<outBase>.json`.
- `threads` por defecto: `Math.max(1, Math.floor(os.availableParallelism() / 2))` (como Hispatrans con `threads: 0`).
- `parseWhisperJson(json)`: texto = `json.transcription[i].text` recortados, sin vacíos, unidos con un espacio y con espacios repetidos colapsados; idioma = `json.result.language` si es string no vacío distinto de `'auto'`, si no `null`. `transcription` ausente o no array → `Error('Unexpected transcriber output.')`.
- `transcribe(videoPath, start, end)`:
  1. Validación: `videoPath` string no vacío; `start` y `end` números finitos, `0 <= start < end` → si no, `RangeError('Invalid cut range.')`. `end - start > TRANSCRIBE_MAX_SECONDS` → `Error('The cut is too long to transcribe (max 10 minutes).')`.
  2. Una sola transcripción a la vez: si hay otra en curso → `Error('Another cut is being transcribed. Wait for it to finish.')`.
  3. `transcriberStatus(paths)`; con faltas → `Error('Transcription is not installed: missing <rutas separadas por ", ">. Reinstall Dopesheet Writer.')`.
  4. Crea un directorio temporal (`fs.mkdtemp(path.join(tmpRoot ?? os.tmpdir(), 'dsw-transcribe-'))`), ejecuta ffmpeg y luego whisper con `runProcess(cmd, args, { timeoutMs: TRANSCRIBE_TIMEOUT_MS })`, lee `<outBase>.json` (UTF-8) y lo analiza. Siempre borra el directorio temporal (`fs.rm(..., { recursive: true, force: true })`) en `finally`.
  5. ffmpeg con código ≠ 0: si su stderr contiene `matches no streams` → `Error('This video has no audio track to transcribe.')`; si no → `Error('Could not extract the audio of this cut (ffmpeg: <última línea no vacía de stderr>).')`. whisper con código ≠ 0 → `Error('The transcriber failed (<última línea no vacía de stderr>).')`. Tiempo agotado (`runProcess` rechaza con `error.code === 'ETIMEDOUT'` o `error.killed`) → `Error('Transcription took too long and was stopped.')`.
  6. Texto vacío → `Error('No speech found in this cut.')`.
  7. Devuelve `{ text, language, languageName: languageNameFromCode(language) }`.
- `runProcess` por defecto: `child_process.execFile(cmd, args, { windowsHide: true, timeout, maxBuffer: 16 MiB })` envuelto en promesa que resuelve `{ code, stdout, stderr }` (código ≠ 0 resuelve, no rechaza; solo rechaza por tiempo agotado o si el ejecutable no arranca).
- `translateText(text, o)`: nuevo `o.targetLang` (`'en'` por defecto; solo `'en'` o `'es'`, otro → `RangeError`). Google `tl=<targetLang>`, mymemory `langpair=Autodetect%7C<targetLang>`. Resto igual.

## Canales IPC y puente
- `dsw:translate (text, targetLang)` → `translateText(text, { targetLang })`. Puente: `translate(text, targetLang)`.
- `dsw:transcriberStatus ()` → `transcriberStatus(paths)`. Puente: `transcriberStatus()`.
- `dsw:transcribe (videoPath, startSeconds, endSeconds)` → `transcriber.transcribe(...)`. Puente: `transcribe(videoPath, startSeconds, endSeconds)`.
- `registerIpc` recibe dos dependencias nuevas: `transcriber` y `transcriberStatus` (función sin argumentos).
- `main/main.js`: `baseDir = app.isPackaged ? path.join(process.resourcesPath, TRANSCRIBER_DIR_NAME) : path.join(<raíz del repo>, 'vendor', TRANSCRIBER_DIR_NAME)`; crea `paths` y `createTranscriber({ paths })`.

## Empaquetado
- `vendor/transcriber/` no va a git (`.gitignore`: `vendor/`). Lo llena `scripts/fetch-transcriber.ps1 [-Origen F:\code\github\hispatrans]` (UTF-8 con BOM, PowerShell 5.1): copia `tools/ffmpeg/ffmpeg.exe` → `ffmpeg.exe`; de `tools/whisper-cpp/`: `whisper-cli.exe`, `whisper.dll`, `ggml.dll`, `ggml-base.dll` y todos los `ggml-cpu-*.dll` → `whisper/`; `models/ggml-large-v3-q8_0.bin` y `models/ggml-silero-v6.2.0.bin` → `models/`; copia también `tools/ffmpeg/LICENSE.txt` → `licenses/ffmpeg-LICENSE.txt`. Salta lo que ya existe con el mismo tamaño. Falta un origen → `throw` con la ruta y «ejecuta build/fetch-deps.ps1 en hispatrans». Al final escribe la lista de lo copiado.
- `package:win`: añade `--extra-resource=vendor/transcriber` y `vendor` a la lista `--ignore`. `package:mac`: solo `vendor` en `--ignore` (en Mac la transcripción queda no disponible).
- `scripts/deploy.ps1`: antes de las pruebas, si falta `vendor\transcriber\whisper\whisper-cli.exe` en la raíz del repo, ejecuta `scripts\fetch-transcriber.ps1`. La copia a `-Compilacion` ya incluye `vendor/`.

## Errores
Los listados; mensajes en inglés (la interfaz es inglesa) que llegan al usuario tal cual por un banner. Nunca se silencia una excepción, salvo el borrado del temporal (`force: true`).

## Dependencias
Internas: `core/config.js`, `core/languages.js`. Externas: ninguna nueva.

## Criterio de aceptación
1. `languageNameFromCode('es')` → `'Spanish'`, `('EN')` → `'English'`, `('xx')` y `('')` → `null`. `isEnglish(' english ')`, `isEnglish('Inglés')`, `isEnglish('en')` → true; `isEnglish('Spanish')`, `isEnglish('')` → false. `translationTarget('English')` → `'es'`, `('Spanish')` → `'en'`. `targetLanguageLabel('fr')` → RangeError.
2. `buildFfmpegArgs('v.mp4', 1.5, 4, 'c.wav')` contiene `-ss 1.500` y `-t 2.500` antes de `-i v.mp4`, y acaba en `c.wav`. `buildWhisperArgs` contiene `-l auto`, `-bs 5`, `--vad`, `-vsd 2000`, `-vp 400`, `-oj`, `-of <outBase>`.
3. `parseWhisperJson({ result:{language:'en'}, transcription:[{text:' Hello '},{text:''},{text:' world.'}] })` → `{ text:'Hello world.', language:'en' }`; sin `transcription` → error de formato; `language:'auto'` → `null`.
4. `transcribe` con `runProcess` falso que devuelve código 0 y escribe el JSON en `<outBase>.json` (lo crea el falso en el directorio de `-of`) → `{ text, language:'es', languageName:'Spanish' }`; el temporal ya no existe al terminar, también cuando falla.
5. ffmpeg falso con código 1 y stderr `Stream map '0:a:0' matches no streams.` → el error de sin pista de audio; código 1 con otra salida → mensaje con esa última línea.
6. Falta el modelo (`access` falso) → error `Transcription is not installed: missing …` que nombra la ruta, sin llamar a `runProcess`.
7. Dos `transcribe` simultáneos → el segundo rechaza con `Another cut is being transcribed…`; al acabar el primero, otro vuelve a funcionar.
8. Rango inválido (`start >= end`, negativo, NaN) → RangeError; 601 s → error de longitud.
9. `runProcess` que rechaza con `{ killed: true }` → `Transcription took too long and was stopped.`
10. `translateText('Hello', { targetLang:'es', fetchFn })` pide `tl=es`; mymemory con `langpair=Autodetect%7Ces`; `targetLang:'fr'` → RangeError sin red. Las pruebas existentes siguen verdes (por defecto `'en'`).
11. `ipc.test.js`: `dsw:transcribe` llama a `transcriber.transcribe` con los tres argumentos; `dsw:transcriberStatus` devuelve el estado; `dsw:translate` pasa `targetLang`.

## Comando de pruebas
`node --test test/languages.test.js test/transcribe.test.js test/translate.test.js test/ipc.test.js`
