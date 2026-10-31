# Módulo: transcribe-ui

Responsabilidad: en el renderer, el botón «Transcribe» de los planos de entrevista (transcribe el corte del vídeo y rellena Original y Language) y el sentido de la traducción según el campo Language (inglés → español; resto → inglés). Aspecto, textos y estados: `docs/DISENO-GRAFICO.md` §14, que es literal y manda. Proceso principal y puente (`window.dsw.transcribe`, `transcriberStatus`, `translate(text, targetLang)`): `docs/modulos/transcribe.md`, ya implementado.

## Ficheros
- `renderer/flow-transcribe.js` (nuevo): flujo del botón, gemelo de `renderer/flow-translate.js`.
- `renderer/shot-editor.js`: botón Transcribe, estados, tooltips, realce de Language, textos de Translate según el idioma.
- `renderer/flow-translate.js`: pasa `translationTarget(shot.soundbite.language)` a `dsw.translate`; el modal de reemplazo recibe el destino.
- `renderer/feedback.js`: `confirmReplaceOriginal(rootEl)`; `confirmReplaceTranslation(rootEl, target = 'en')` con el cuerpo de §14.4; copia de banner `transcribe-failed`.
- `renderer/ui-kit.js`: icono `transcribe` (§14.1).
- `renderer/app.js`: crea el flujo, lo cablea al editor (`onTranscribe`), consulta `dsw.transcriberStatus()` una vez al arrancar.
- `renderer/css/*.css`: reglas de §14.1 y §14.3 (sin `style=` en línea; la CSP y `styles.md` lo vetan).
- Pruebas: `test/flows.test.js` (flujo con `dsw` falso), `test/shot-editor.test.js`, `test/feedback.test.js`, `test/ui-kit.test.js`, `test/styles.test.js` si comprueba listas de iconos o clases.

## Interfaz pública

### `renderer/flow-transcribe.js`
```js
export function createTranscribeFlow(ctx: {
  state, dsw, banner, bannerRegion, editor, announce, commit, refreshAll?,
  confirmReplace: () => Promise<boolean>,          // confirmReplaceOriginal(dom.modalRoot)
}): {
  onTranscribe(number: number): Promise<void>,
  refreshTranscribing(): void,                      // refleja en el editor el estado del plano mostrado
  setAvailability(status: { available: boolean, missing: string[] }): void,
}
```

### `renderer/shot-editor.js` (añadidos)
- Opción nueva `o.onTranscribe(number)`.
- API: `setTranscribing(number | null)` (plano en curso, o null), `setTranscriberAvailable(boolean)` (por defecto `false` hasta que llegue el estado), `flashLanguage()` (realce de §14.3 en el plano mostrado).
- `export function transcribeTooltip(shot, { busy, available, hasVideo, otherBusy })`: textos de §14.1 en su orden de prioridad (cargando, no instalado, sin vídeo, otro en curso, listo).
- `translateTooltip(shot, busy, transcribing = false)`: con `transcribing` → «Wait for the transcription to finish»; listo → «Translate Original into <Spanish|English> (online service)» según `translationTarget(shot.soundbite.language)`. El resto de textos actuales sigue igual.
- Placeholder de Translation según el destino (§14.4), recalculado en cada render.

## Comportamiento del flujo
1. `onTranscribe(number)`: solo planos de entrevista; sin vídeo cargado (`state.video.loaded` falso o sin `state.video.path`), con la herramienta no disponible o con otra transcripción en curso → no hace nada.
2. Original con texto (recortado) → `confirmReplace()`; si devuelve false, termina sin cambios.
3. Marca el plano en curso (`editor.setTranscribing(number)`), anuncia «Transcribing…», calcula `start = framesToSeconds(shot.startFrame, state.xml.parsed.fps)` y `end = framesToSeconds(shot.endFrame, state.xml.parsed.fps)` (de `core/timecode.js`) y llama `dsw.transcribe(state.video.path, start, end)`.
4. Al volver: si cambió la carga (vídeo o XML; misma idea de `loadToken` que en flow-translate) → descarta en silencio. Si el plano ya no es de entrevista o cambiaron sus fotogramas → anuncia «Transcription discarded» y no toca nada. Si el usuario editó Original mientras tanto, se sustituye igual (el campo estaba en solo lectura).
5. Éxito: `updateShot(state.shots, number, { soundbite: { original: text, ...(languageName ? { language: languageName } : {}) } })`, `commit()`, quita un banner `transcribe-failed` propio que siga visible, anuncia según §14.3 (con «Shot <n>: …» si el plano mostrado ya es otro) y, si el plano está a la vista y Language cambió de verdad (sin mayúsculas ni espacios en los extremos), `editor.flashLanguage()`.
6. Fallo: banner warning de §14.5 (`Couldn't transcribe shot <n>.`, detalle = `error.message`, acción «Try again» que repite `onTranscribe(n)`); con un banner de error visible, solo se anuncia el título (igual que flow-translate).
7. Siempre (finally): `editor.setTranscribing(null)` y `refreshAll?.()` para que el resto de planos vuelvan a «listo».
8. `setAvailability(status)` → `editor.setTranscriberAvailable(status.available)`. En app.js, si `dsw.transcriberStatus()` rechaza, se trata como `{ available:false }` sin banner (el tooltip lo explica) — no se silencia: se escribe con `console.warn` el mensaje.

## Traducción según el idioma
- `flow-translate.runTranslation`: `const target = translationTarget(shot.soundbite.language)`; `dsw.translate(shot.soundbite.original, target)`; confirmación de reemplazo con `ctx.confirmReplace(target)` (app.js: `(target) => confirmReplaceTranslation(dom.modalRoot, target)`).
- `isUnchanged` añade la comparación de `soundbite.language` (si cambia el idioma durante la petición, la traducción se descarta).
- Mientras el plano mostrado se transcribe, Translate desactivado (tooltip de arriba) y `onTranslate` no actúa en ese plano.

## Criterio de aceptación
1. `transcribeTooltip` devuelve cada texto de §14.1 según el estado, respetando la prioridad (busy gana a no disponible, etc.).
2. `translateTooltip(shot con language 'English')` → «Translate Original into Spanish (online service)»; con 'Spanish' o vacío → «… into English …»; con `transcribing` → «Wait for the transcription to finish».
3. Flujo con `dsw` falso: un plano de entrevista con startFrame 50, endFrame 175 a 25 fps → `dsw.transcribe(path, 2, 7)`; el resultado `{ text:'Hola', language:'es', languageName:'Spanish' }` deja `original:'Hola'`, `language:'Spanish'` y llama a `commit`.
4. `languageName:null` → Language no cambia.
5. Original con texto y `confirmReplace` → false: no llama a `dsw.transcribe`.
6. Error de `dsw.transcribe` → banner warning con título `Couldn't transcribe shot <n>.` y detalle del mensaje; Original sin cambios.
7. Cambio de vídeo durante la petición → sin cambios ni banner. Fotogramas del plano cambiados → «Transcription discarded».
8. Sin vídeo, no disponible u otra en curso → `dsw.transcribe` no se llama.
9. Translate en un plano con Language 'English' llama a `dsw.translate(text, 'es')`; con 'Spanish' a `(text, 'en')`; «Translate all» usa el destino de cada plano.
10. Editor: el botón existe en la fila de la etiqueta de Original con `aria-label` «Transcribe», está desactivado mientras `setTranscriberAvailable(false)`, y con `setTranscribing(n)` del plano mostrado Original queda `readOnly` con `aria-busy`.
11. `npm test` entero en verde (las pruebas existentes de translate/flows se adaptan a la nueva firma, sin perder casos).

## Comando de pruebas
`node --test test/flows.test.js test/shot-editor.test.js test/feedback.test.js test/ui-kit.test.js test/styles.test.js` y al final `npm test`.
