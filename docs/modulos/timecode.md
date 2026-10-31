# Módulo `timecode`

Nivel: trivial.
Responsabilidad: convertir entre fotogramas, segundos y timecode, y dar formato a duraciones.

## Ficheros
- Código: `core/timecode.js` (ES module, sin dependencias).
- Pruebas: `test/timecode.test.js` (`node:test` + `node:assert/strict`).
- Vecinos de referencia para el estilo: `core/config.js`.

## Interfaz pública
```js
export function fpsFromRate(timebase: number, ntsc: boolean): number
export function framesToSeconds(frames: number, fps: number): number
export function secondsToFrames(seconds: number, fps: number): number   // redondea al entero más próximo
export function frameSeekTime(frame: number, fps: number): number        // segundo (frame + 0.5) / fps
export function formatDuration(seconds: number): string                  // 'MM:SS'
export function formatSoundbiteSeconds(frames: number, fps: number): string // '23sec'
export function formatShotSeconds(frames: number, fps: number): string   // (frames / fps).toFixed(1) + 's'
export function formatTimecode(seconds: number, fps: number): string     // 'HH:MM:SS:FF'
```
- `fpsFromRate`: `ntsc ? timebase * 1000 / 1001 : timebase`.
- `framesToSeconds`: `frames / fps`.
- `secondsToFrames`: `Math.round(seconds * fps)`.
- `frameSeekTime`: instante a mitad del fotograma, para que un `video.currentTime` caiga dentro del fotograma y no en la frontera con el anterior.
- `formatDuration`: redondea los segundos al entero más próximo (`Math.round`), minutos sin límite de 59, dos dígitos como mínimo: 172.32 → `'02:52'`; 183.4 → `'03:03'`; 0 → `'00:00'`; 3599.6 → `'60:00'`.
- `formatSoundbiteSeconds`: `Math.round(frames / fps)` seguido de `sec`, sin espacio: (584, 25) → `'23sec'`.
- `formatTimecode`: fotogramas totales = `Math.round(seconds * fps)`; `nominal = Math.round(fps)` (25 para 25, 30 para 29.97: timecode sin pérdida de fotogramas); `FF = total % nominal`; segundos enteros = `floor(total / nominal)` y de ahí HH, MM, SS; todos con 2 dígitos: (83.16, 25) → `'00:01:23:04'`.

## Errores
- `RangeError('fps must be a positive number')` si `fps` no es un número finito > 0 (en las funciones que lo reciben).
- `RangeError('seconds must be a finite number >= 0')` / `RangeError('frames must be a finite number >= 0')` si el valor es negativo, NaN o infinito.

## Dependencias
- Internas: ninguna. Externas: ninguna.

## Criterio de aceptación
1. `fpsFromRate(25,false)` = 25; `fpsFromRate(30,true)` ≈ 29.97002997.
2. `framesToSeconds(4308,25)` = 172.32; `secondsToFrames(172.32,25)` = 4308.
3. `frameSeekTime(0,25)` = 0.02; `frameSeekTime(100,25)` = 4.02 (tolerancia 1e-9).
4. `formatDuration`: los cuatro ejemplos de arriba.
5. `formatSoundbiteSeconds(584,25)` = `'23sec'`; (711,25) → `'28sec'`; (278,25) → `'11sec'`.
6. `formatTimecode(83.16,25)` = `'00:01:23:04'`; `formatTimecode(0,25)` = `'00:00:00:00'`; `formatTimecode(3661.04,25)` = `'01:01:01:01'`.
7. fps 0, negativo o NaN lanza `RangeError`; segundos negativos lanza `RangeError`.
8. `formatShotSeconds(105,25)` = `'4.2s'`; `formatShotSeconds(250,25)` = `'10.0s'`.

## Comando de pruebas
`node --test test/timecode.test.js`
