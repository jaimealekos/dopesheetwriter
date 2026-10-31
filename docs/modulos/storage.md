# Módulo `storage`

Nivel: normal.
Responsabilidad: todo el acceso a disco de la app: ajustes, borradores, ruta de salida, búsqueda del XML hermano y escritura atómica del `.txt`.

## Ficheros
- Código: `main/storage.js` (corre en el proceso principal de Electron, pero no importa `electron`: recibe el directorio de datos).
- Pruebas: `test/storage.test.js` (usa `fs.mkdtemp` en `os.tmpdir()` y limpia al acabar).
- Vecinos de referencia para el estilo: `core/xml-shots.js`, `core/config.js`.

## Interfaz pública
```js
export class StorageError extends Error {}

export function createStorage(dataDir: string): {
  loadSettings(): Promise<{ location: string, source: string }>,
  saveSettings(partial: { location?: string, source?: string }): Promise<void>,
  loadDraft(videoPath: string): Promise<object | null>,
  saveDraft(videoPath: string, draft: object): Promise<void>,
  outputPathFor(videoPath: string): string,
  shotlistExists(videoPath: string): Promise<boolean>,
  writeShotlist(videoPath: string, text: string): Promise<string>,
  findSiblingXml(videoPath: string): Promise<string | null>,
}
```
- `loadSettings`: lee `<dataDir>/settings.json`; si no existe devuelve `{ location: DEFAULT_LOCATION, source: '' }` (`core/config.js`); si existe pero es ilegible o JSON inválido, escribe `console.warn` con el motivo y devuelve los valores por defecto. Campos ausentes o que no sean cadena se sustituyen por el defecto.
- `saveSettings`: fusiona `partial` (solo `location` y `source`, cadenas) con lo guardado y escribe el JSON (escritura atómica).
- `loadDraft`/`saveDraft`: fichero `<dataDir>/drafts/<clave>.json`, con `clave` = SHA-1 hexadecimal (`node:crypto`) de `path.resolve(videoPath).toLowerCase()`. `loadDraft` devuelve `null` si no existe; si es JSON inválido hace `console.warn` y devuelve `null`. `saveDraft` crea `drafts/` si hace falta y escribe el objeto con `JSON.stringify(draft)` (escritura atómica).
- `outputPathFor(videoPath)`: misma carpeta y mismo nombre base que el vídeo con extensión `.txt` (`D:\x\Mani tractores.mp4` → `D:\x\Mani tractores.txt`). Función síncrona; no toca el disco.
- `shotlistExists`: `true` si existe el fichero de `outputPathFor`.
- `writeShotlist(videoPath, text)`: escribe en `outputPathFor(videoPath)` el BOM UTF-8 (`\uFEFF`) seguido de `text` codificado en UTF-8, de forma atómica (fichero temporal `<salida>.tmp` en la misma carpeta y `fs.rename` encima); devuelve la ruta escrita. Sobrescribe si existe (la confirmación es cosa de la interfaz).
- `findSiblingXml`: lista la carpeta del vídeo y devuelve la ruta (carpeta del vídeo + nombre real del fichero) del fichero cuyo nombre en minúsculas sea `<nombre base del vídeo en minúsculas>.xml`; `null` si no hay.
- Escritura atómica: escribir en `<destino>.tmp` y `fs.rename`; si falla, borrar el `.tmp` (ignorando que no exista) y lanzar `StorageError`.

## Errores
Todos `StorageError`, con el motivo original y qué hacer:
- Fallo al escribir el `.txt`: `Could not save <ruta>: <motivo>. Check that the folder is writable and that the file is not open in another program.`
- Fallo al escribir ajustes o borrador: `Could not save <ajustes|draft>: <motivo>.`
- Carpeta ilegible en `findSiblingXml`: `Could not read the folder of <ruta>: <motivo>.`
- `videoPath` vacío o que no sea cadena en cualquier función: `StorageError('A video path is required.')`.

## Dependencias
- Internas: `core/config.js`. Externas: ninguna (`node:fs/promises`, `node:path`, `node:crypto`).

## Criterio de aceptación
1. Sin `settings.json` → `{ location: 'MADRID, SPAIN', source: '' }`; `saveSettings({source:'AFPTV'})` y recarga → location por defecto y source `AFPTV`; `saveSettings({location:'PARIS, FRANCE'})` después conserva source.
2. `settings.json` corrupto → defaults y un `console.warn` (la prueba lo sustituye por un espía).
3. `saveDraft` + `loadDraft` devuelven un objeto igual (`deepEqual`); ruta distinta → `null`; la misma ruta con otra capitalización da el mismo borrador; draft corrupto → `null`.
4. `outputPathFor` con rutas de Windows y de POSIX construidas con `path.join` del directorio temporal (nombre con espacios y acentos: `Manifestación Sanidad.mp4` → `Manifestación Sanidad.txt`).
5. `writeShotlist` crea el fichero: los 3 primeros bytes son `EF BB BF`, el resto es el texto en UTF-8 (con `ñ`, `é`); sobrescribir funciona; no queda ningún `.tmp`; `shotlistExists` pasa de false a true.
6. `writeShotlist` en una carpeta que no existe → `StorageError` con el texto `Could not save`.
7. `findSiblingXml`: encuentra `Video.XML` para `video.mp4` (capitalización distinta) y devuelve `null` si no existe.
8. `videoPath` vacío → `StorageError`.

## Comando de pruebas
`node --test test/storage.test.js`
