# Módulo `xml-shots`

Nivel: normal.
Responsabilidad: leer un XML xmeml v4 (Final Cut 7 / Premiere) y devolver la frecuencia, la duración y la lista de cortes de la pista de vídeo V1, y comparar con la duración del vídeo.

## Ficheros
- Código: `core/xml-shots.js`.
- Pruebas: `test/xml-shots.test.js`; los XML sintéticos mínimos van como cadenas dentro de la prueba (no copies los XML reales de la NAS).
- Vecinos de referencia para el estilo: `core/timecode.js`, `core/config.js`.

## Interfaz pública
```js
export class XmlShotsError extends Error {}

/** @typedef {{ startFrame: number, endFrame: number }} Cut   // endFrame exclusivo, startFrame < endFrame */
/** @typedef {{ fps: number, timebase: number, ntsc: boolean, totalFrames: number,
 *             width: number, height: number, trackIndex: number, cuts: Cut[], warnings: string[] }} ParsedXml */

export function parseXmeml(xmlText: string): ParsedXml
export function checkVideoMatch(parsed: ParsedXml, videoDurationSeconds: number): string | null
```

### Estructura del XML (fija, verificada con ficheros reales de Premiere)
```
xmeml > sequence > rate > timebase ("25") y ntsc ("FALSE"|"TRUE")
                 > duration ("5922")                          // fotogramas de la secuencia
                 > media > video > format > samplecharacteristics > width / height
                 > media > video > track (varias)             // V1 = la primera; cada una con hijos clipitem y otros
                     clipitem > name, enabled ("TRUE"|"FALSE"), start, end, in, out
                 > media > audio > track ...                  // se ignora
```
También puede venir `xmeml > project > children > sequence`: usa la primera `sequence` que encuentres en cualquier nivel. Dentro de un `clipitem` hay `rate`, `file`, etc. que se ignoran: lee solo los hijos directos `start`, `end` y `enabled`.

### Reglas de `parseXmeml`
1. Parsear con `fast-xml-parser` (`ignoreAttributes: false`, `parseTagValue: false` para manejar los números tú mismo; fuerza arrays en `track` y `clipitem` con `isArray`). El DOCTYPE `<!DOCTYPE xmeml>` no debe dar error.
2. `timebase`, `ntsc`, `totalFrames` (`sequence/duration`), `width`, `height` (`sequence/media/video/format/samplecharacteristics`) son los de la secuencia, no los de los clips. `ntsc` es verdadero si el texto en mayúsculas es `TRUE`. `fps = fpsFromRate(timebase, ntsc)` (de `core/timecode.js`). `width`/`height`/`totalFrames` a 0 si faltan.
3. `trackIndex` = índice (base 0) de la primera pista de vídeo que contenga al menos un `clipitem` activo (`enabled` distinto de `FALSE`). Solo se usa esa pista; las demás (capas de ajuste, rótulos) se ignoran sin aviso.
4. Por cada `clipitem` activo de esa pista se toman `start` y `end` como enteros. Regla de `-1`: Premiere escribe `-1` en `start` o `end` cuando hay una transición pegada. Si `start === -1` se usa el `endFrame` del corte anterior (o 0 si es el primero); si `end === -1` se usa el `start` del corte siguiente (o `totalFrames` si es el último); en ambos casos se añade el aviso `Transitions found: cut positions near them are approximate.` una sola vez.
5. Se ordena por `startFrame`. Se descartan los cortes con `endFrame <= startFrame`. Si un corte empieza antes de que termine el anterior se conserva y se añade el aviso `Overlapping clips found on the video track: check the edit.` una sola vez. Los huecos entre cortes son normales y no dan aviso.
6. `cuts` tiene uno por clip, en orden, con `startFrame` y `endFrame` (exclusivo).

### `checkVideoMatch`
Devuelve `null` si `Math.abs(totalFrames / fps - videoDurationSeconds) <= MISMATCH_TOLERANCE_SECONDS` (de `core/config.js`); si no, devuelve el texto en inglés `The XML sequence lasts MM:SS but the video lasts MM:SS. Check that both files belong to the same edit.` (formatos con `formatDuration` de `core/timecode.js`).

## Errores
Todos son `XmlShotsError` con mensaje en inglés que dice qué falló y cómo corregirlo:
- Texto vacío o no XML: `The file is not a valid XML. Export it again from the editor as "Final Cut Pro XML".`
- Sin `xmeml` en la raíz: `The file is not a Final Cut / Premiere XML (xmeml).`
- Sin `sequence`: `The XML has no sequence. Export the sequence, not the project bin.`
- Sin `timebase` válido (número > 0) en la secuencia: `The XML sequence has no frame rate.`
- Ningún clip activo en ninguna pista de vídeo: `The XML has no video clips on any track.`

## Dependencias
- Internas: `core/timecode.js`, `core/config.js`.
- Externas: `fast-xml-parser` 5.11.2 (ya en package.json; `import { XMLParser } from 'fast-xml-parser'`).

## Criterio de aceptación
1. XML mínimo con sequence rate 25/FALSE, duration 100, V1 con 3 clips `0-40`, `40-70`, `75-100`, y V2 con un clip `Capa de ajuste` `0-100` → `cuts` = `[{0,40},{40,70},{75,100}]`, `fps` 25, `trackIndex` 0, `totalFrames` 100, sin avisos.
2. Si V1 está vacía y V2 tiene clips → usa V2 (`trackIndex` 1).
3. Clip con `enabled` FALSE se ignora.
4. `ntsc` TRUE con timebase 30 → `fps` ≈ 29.97002997.
5. Clip con `start` -1 (segundo clip) y el anterior terminando en 40 → `startFrame` 40 y aviso de transiciones (una sola vez aunque haya varios).
6. Clips desordenados en el XML → `cuts` ordenados. Solapado → aviso de solapes.
7. XML con DOCTYPE y atributos largos en `sequence` se parsea.
8. Cada error de la sección Errores, con su mensaje exacto.
9. `checkVideoMatch`: secuencia 5922 fotogramas a 25 fps (236.88 s) y vídeo 236.88 → `null`; vídeo 250 → texto con `03:57` y `04:10`.

## Comando de pruebas
`node --test test/xml-shots.test.js`
