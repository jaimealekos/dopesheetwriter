# Módulo: translate

Responsabilidad: traducir un texto al inglés o al español con un servicio gratuito de internet, sin clave de API, desde el proceso principal (la CSP del renderer prohíbe toda red).

## Ficheros
- Código: `main/translate.js` (ES module; solo `node:` y `fetch` global de Node/Electron).
- Configuración: se añaden a `core/config.js`: `TRANSLATE_CHUNK_CHARS = 450`, `TRANSLATE_MAX_CHARS = 5000`, `TRANSLATE_TIMEOUT_MS = 10000`. `TRANSLATE_TARGET_LANG` desaparece: el idioma destino llega por `o.targetLang`. (El corrector ortográfico usa `SPELLCHECK_LANGUAGES = ['en-US']`, documentado en `main-process`.)
- Pruebas: `test/translate.test.js` (con `fetchFn` falso; sin red).

## Interfaz pública
```js
export function splitForTranslation(text: string, maxChars: number): string[]

export async function translateText(text: string, o?: {
  fetchFn?: (url: string, init?: object) => Promise<{ ok: boolean, status: number, json(): Promise<any> }>,  // por defecto globalThis.fetch
  timeoutMs?: number,        // por defecto TRANSLATE_TIMEOUT_MS; cada petición HTTP
  targetLang?: 'en' | 'es',  // por defecto 'en'; otro valor → RangeError sin red
}): Promise<{ text: string, provider: 'google' | 'mymemory' }>
```

## Comportamiento
- `splitForTranslation`: devuelve fragmentos de como máximo `maxChars` caracteres que, unidos, reproducen el texto sin perder palabras. Primero se parte por saltos de línea `\n` (una línea vacía produce un fragmento `''` que se conserva para mantener los párrafos); una línea de más de `maxChars` se parte tras `. `, `? `, `! `, `; ` o `: ` (el signo se queda en el fragmento anterior) y, si aún sobra, en el último espacio antes del límite; si no hay espacio, corte duro en `maxChars`. Los fragmentos se recortan de espacios en los extremos, salvo los vacíos que representan línea en blanco.
- `translateText(text)`:
  1. `text` recortado vacío → `Error('There is no text to translate.')`. Más de `TRANSLATE_MAX_CHARS` caracteres → `Error('The text is too long to translate (max 5000 characters).')`.
  2. Parte con `splitForTranslation(text, TRANSLATE_CHUNK_CHARS)`; los fragmentos vacíos se devuelven vacíos sin llamar a la red. Traduce los demás **en secuencia** (no en paralelo) con el proveedor `google`; si cualquier fragmento falla (error de red, tiempo agotado, HTTP no ok, respuesta con formato inesperado), descarta lo hecho y repite TODO el texto con `mymemory`. Si también falla: `Error('Translation service unavailable (<causa del último proveedor>). Check your internet connection and try again.')`.
  3. Une los fragmentos traducidos de una misma línea con un espacio y las líneas con `\n`; el resultado se recorta. Devuelve `{ text, provider }` con el proveedor que respondió.
- Proveedor `google` (endpoint no oficial pero gratuito y sin clave): `GET https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=<targetLang>&dt=t&q=<encodeURIComponent(fragmento)>`. Respuesta: JSON `[[[traducido, original, ...], ...], ...]`; el texto es la unión de `data[0][i][0]` para todo `i`. Si `data[0]` no es un array, o no queda texto → formato inesperado.
- Proveedor `mymemory` (API pública gratuita): `GET https://api.mymemory.translated.net/get?q=<encodeURIComponent(fragmento)>&langpair=Autodetect%7C<targetLang>`. Respuesta: `{ responseStatus, responseData: { translatedText } }`; válido solo si `Number(responseStatus) === 200` y `translatedText` es un string no vacío; si no, formato inesperado con `responseDetails` como causa cuando exista. Se decodifican las entidades `&#39;`, `&quot;`, `&amp;`, `&lt;`, `&gt;` en el texto devuelto.
- Cada petición lleva `signal: AbortSignal.timeout(timeoutMs)`; un aborto se informa como `timed out after <s> s`.
- No se reintenta el mismo proveedor; no se guarda caché; no se envía nada más que el texto del fragmento (sin cabeceras personalizadas ni identificadores).

## Errores
Solo los listados arriba; los mensajes llegan tal cual al usuario (vía `dsw:translate` y un banner). Nunca se silencia una excepción.

## Dependencias
Internas: `core/config.js`. Externas: ninguna.

## Criterio de aceptación
1. `splitForTranslation('a\n\nb', 450)` → `['a', '', 'b']`; un texto de 1000 caracteres con frases se parte en fragmentos ≤ 450 que, unidos con espacio, contienen todas las palabras en orden; una palabra sola de 600 caracteres se corta en 450 + 150.
2. Con `fetchFn` falso que responde `[[["Hello world","Hola mundo",null,null,1]],null,"es"]`: `translateText('Hola mundo')` → `{ text:'Hello world', provider:'google' }`, y la URL pedida contiene `client=gtx`, `sl=auto`, `tl=en` y `q=Hola%20mundo`.
3. Respuesta de google con varios segmentos `[[["Hello. ","Hola. "],["World","Mundo"]]]` → `Hello. World`.
4. Si `fetchFn` lanza para `translate.googleapis.com` y responde bien para `mymemory` → `provider:'mymemory'`; entidades decodificadas (`It&#39;s` → `It's`); la URL contiene `langpair=Autodetect%7C<targetLang>`.
5. HTTP no ok o formato inesperado en google → pasa a mymemory; en ambos → el error `Translation service unavailable (...)` que contiene la causa.
6. Texto de dos líneas `'Uno\nDos'` → dos peticiones y resultado `'One\nTwo'` (con respuestas falsas distintas por fragmento); una línea en blanco intermedia no genera petición.
7. Texto vacío o solo espacios → `Error('There is no text to translate.')`; texto de 5001 caracteres → el error de longitud; ambos sin llamar a `fetchFn`.
8. Las peticiones se hacen en secuencia (el segundo `fetchFn` no empieza antes de que resuelva el primero).
9. Un fragmento aborta por tiempo (`fetchFn` falso que rechaza con `DOMException('...', 'TimeoutError')`) → mensaje con `timed out after`.

## Comando de pruebas
`node --test test/translate.test.js`
