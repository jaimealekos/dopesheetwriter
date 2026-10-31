# Módulo `player`

Nivel: normal.
Responsabilidad: reproductor que preside la ventana: vídeo, barra de progreso con cortes, controles y reproducción de un plano de principio a fin, según `docs/DISENO-GRAFICO.md` 6.5.

## Ficheros
- Código: `renderer/player.js` (ES module; sin `document` a nivel de módulo).
- Pruebas: `test/player.test.js`: funciones puras y la API de `mount` sobre un DOM mínimo (sin navegador ni red).
- Vecinos de referencia para el estilo: `renderer/ui-kit.js`, `renderer/frames.js`.

## Interfaz pública
```js
export function shotAtFrame(shots: Shot[], frame: number): number      // número del plano que contiene `frame`
export function shotLabel(shots: Shot[], number: number): string
export function percentOf(frame: number, totalFrames: number): number  // 0..100
export function stepFrame(frame: number, deltaFrames: number, totalFrames: number): number  // con tope 0..totalFrames-1

export function mount(root: HTMLElement, o: {
  onShotChange: (number: number) => void,     // cuando el plano actual cambia por reproducción o por la barra
  onError: (error: Error) => void,            // fallo de decodificación en reproducción
}): {
  load(o: { url: string, name: string }): Promise<{ duration: number, width: number, height: number }>,   // rechaza con VideoError
  setShots(shots: Shot[], fps: number, totalFrames: number): void,  // se puede llamar de nuevo al cambiar las entrevistas
  selectShot(number: number, o?: { play?: boolean }): void,          // sitúa en el primer fotograma del plano; con play, reproduce
  togglePlay(): void,
  replayShot(): void,
  stepShot(delta: -1 | 1): void,
  getCurrentShot(): number,
  isPlaying(): boolean,
  destroy(): void,
}
```
(`Shot` = tipo de `core/shot-model.js`; aquí solo se usan `number`, `startFrame`, `endFrame`, `interview`.)

### Funciones puras
- `shotAtFrame`: el plano con mayor `startFrame <= frame`; si `frame` es anterior al primero → plano 1. `shots` vacío → 0.
- `shotLabel`: `Shot 12 of 26`; para una entrevista `Soundbite 1 · shot 24 of 26` (el índice sale de `soundbiteIndex` de `core/shot-model.js`; separador `·` con espacios).
- `percentOf`: `frame / totalFrames * 100` limitado a 0..100; `totalFrames` ≤ 0 → 0.
- `stepFrame`: suma y limita a `[0, totalFrames - 1]`.

### `mount`
Construye en `root` la estructura de 6.5 con las clases del diseño (`player__stage`, `player__video`, `player__overlay`, `player__controls`, `player__timeline` y sus hijos, `player__bar`, botones prev/play/next, `player__time`, `player__shot-label`, conmutador «Stop at end of shot» (`createSwitch`, activado por defecto), `volume`). Iconos y tooltips con `renderer/ui-kit.js` (`tooltip` con atajos: «Previous shot» `Alt+↑`, «Play»/«Pause» `Space`, «Next shot» `Alt+↓`). Comportamiento:
- Tiempo = fotograma / fps. Timecode mostrado con `formatTimecode(video.currentTime, fps)` (de `core/timecode.js`) y duración total con `formatTimecode(totalFrames / fps, fps)`; se actualiza con `requestVideoFrameCallback` si existe, si no con `timeupdate`.
- Plano actual = `shotAtFrame(shots, frameActual)`; cuando cambia, actualiza la etiqueta, el tramo `player__shot-range` (de su `startFrame` a su `endFrame`, en %), y llama `onShotChange`.
- `selectShot(n, {play})`: pausa, `video.currentTime = frameSeekTime(startFrame, fps)`, y si `play` reproduce. Nunca llama a `onShotChange` si el plano ya era el actual.
- «Stop at end of shot» activado: al alcanzar `endFrame` del plano que se reproduce, pausa y deja el último fotograma del plano (`frameSeekTime(endFrame - 1, fps)`). Desactivado: sigue reproduciendo y el plano actual cambia solo. Se comprueba con `requestVideoFrameCallback` (`metadata.mediaTime >= endFrame / fps`), con `timeupdate` como alternativa.
- `togglePlay` ante un vídeo en el último fotograma del plano con «Stop at end» activado reproduce ese plano desde su inicio. `replayShot`: `selectShot(actual, {play: true})`.
- `stepShot(±1)`: va al plano anterior/siguiente (topes 1 y último) y lo reproduce si se estaba reproduciendo.
- Barra de progreso: clic o arrastre con `pointer events` (captura de puntero) → sitúa. Durante el arrastre se puede pausar para que el seek sea fluido; al soltar (`pointerup`) el vídeo termina reproduciendo (un clic simple también). `role=slider` con los atributos de 6.5; teclado con foco: ←/→ un fotograma (`stepFrame`), Mayús+←/→ un segundo (`round(fps)` fotogramas), RePág/AvPág corte anterior/siguiente, Inicio/Fin; Mayús+←/→, RePág/AvPág, Inicio y Fin terminan reproduciendo, mientras que ←/→ sin Mayús solo mueven un fotograma y dejan el vídeo en pausa. `aria-valuenow` (segundos) y `aria-valuetext` (`«<timecode>, shot N»`) se actualizan; tooltip de tiempo bajo el puntero (`player__hover-time`).
- Volumen y silencio: `input[type=range]` 0–1 (paso 0.01) y botón mute con `aria-pressed`; estado mudo con clase `is-muted` en `.volume`.
- Estados: `player__stage` con `is-loading` hasta `load` resuelto; en error de `load`, `is-error` con icono y texto del diseño (el banner lo pone `app`). Un error del elemento durante la reproducción → `onError`.
- `load({url, name})`: usa `probeVideo` de `renderer/frames.js`; asigna `video.src = url` y `aria-label="Video: <name>"`; devuelve metadatos. `destroy`: quita listeners, pausa, libera `src`.
- Sin `setShots` previo, los controles de plano no hacen nada.

## Errores
- `RangeError('Shot <n> does not exist.')` en `selectShot` con número inexistente.
- Los rechazos de `load` son `VideoError` (de `frames.js`).

## Dependencias
- Internas: `renderer/ui-kit.js`, `renderer/frames.js`, `core/timecode.js`, `core/shot-model.js` (`soundbiteIndex`). Externas: ninguna.

## Criterio de aceptación
1. `shotAtFrame` con planos `[0-100, 100-250, 260-400]`: frame 0 → 1; 99 → 1; 100 → 2; 255 → 2 (hueco); 260 → 3; 9999 → 3; lista vacía → 0.
2. `shotLabel`: plano 12 normal de 26 → `Shot 12 of 26`; plano 24 primera entrevista → `Soundbite 1 · shot 24 of 26`.
3. `percentOf(50,200)` → 25; negativo → 0; > total → 100; total 0 → 0.
4. `stepFrame(0,-1,100)` → 0; `(99,1,100)` → 99; `(10,25,100)` → 35.
5. El módulo se importa en Node sin lanzar.

## Comando de pruebas
`node --test test/player.test.js`

## Adenda (revisión)
- `togglePlay` no hace nada si no hay vídeo cargado o no hay planos.
- Los eventos `pause` y `ended` del `<video>` sincronizan `isPlaying()` y el botón Play/Pause; un `AbortError` de `play()` (por una pausa inmediata) no se trata como error.
- `load()` pausa y reinicia el estado de reproducción; si falla, deja el reproductor como no cargado.
- Mover la posición en la barra (soltar el puntero o las teclas de salto) deja el vídeo reproduciendo, tanto si estaba en play como en pausa, siempre que haya vídeo cargado y planos (misma condición que `togglePlay`). `updateCurrentShot` se ejecuta antes de `play()`, de modo que «Stop at end» no para al caer en otro plano.
- Cancelar el gesto de la barra (`pointercancel`) se trata como soltar (`pointerup`): reanuda.
- Si el salto de teclado deja el último fotograma (`totalFrames - 1`) no se reanuda: reproducir ahí pararía de inmediato.
