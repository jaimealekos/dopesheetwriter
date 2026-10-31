// Traducción al inglés o al español con servicios gratuitos sin clave. Corre en el proceso
// principal porque la CSP del renderer prohíbe la red. No importa electron.
import {
  TRANSLATE_CHUNK_CHARS,
  TRANSLATE_MAX_CHARS,
  TRANSLATE_TIMEOUT_MS,
} from '../core/config.js';

const GOOGLE_URL = 'https://translate.googleapis.com/translate_a/single';
const MYMEMORY_URL = 'https://api.mymemory.translated.net/get';

// Idiomas destino admitidos y el de por defecto.
const TARGET_LANGS = ['en', 'es'];
const DEFAULT_TARGET_LANG = 'en';

// Signos tras los que se corta una línea larga; el signo queda en el fragmento anterior.
const SENTENCE_BREAKS = ['. ', '? ', '! ', '; ', ': '];

// Busca el punto de corte de una línea de más de maxChars: tras un signo de
// frase, en el último espacio anterior al límite o, si no hay, en el límite.
function findCut(line, maxChars) {
  let sentenceCut = -1;
  for (let i = 0; i < maxChars; i += 1) {
    if (SENTENCE_BREAKS.includes(line.slice(i, i + 2))) {
      sentenceCut = i + 1;
    }
  }
  if (sentenceCut !== -1) {
    return sentenceCut;
  }

  const spaceCut = line.lastIndexOf(' ', maxChars - 1);
  if (spaceCut > 0) {
    return spaceCut;
  }

  return maxChars;
}

// Divide una línea en fragmentos de como máximo maxChars caracteres.
function splitLine(line, maxChars) {
  const fragments = [];
  let rest = line;
  while (rest.length > maxChars) {
    const cut = findCut(rest, maxChars);
    fragments.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut);
  }
  fragments.push(rest.trim());
  return fragments;
}

// Parte el texto en fragmentos que, unidos, reproducen las palabras. Cada salto
// de línea produce un fragmento (una línea vacía produce '').
export function splitForTranslation(text, maxChars) {
  const fragments = [];
  for (const line of text.split('\n')) {
    fragments.push(...splitLine(line, maxChars));
  }
  return fragments;
}

// Decodifica las entidades que devuelve mymemory; &amp; se deja para el final.
function decodeEntities(text) {
  return text
    .replaceAll('&#39;', "'")
    .replaceAll('&quot;', '"')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&amp;', '&');
}

// Lanza una petición GET y devuelve el JSON. Un tiempo agotado se informa claro.
async function requestJson(url, { fetchFn, timeoutMs }) {
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    // La lectura del cuerpo también puede agotar el tiempo: se informa igual.
    return await response.json();
  } catch (cause) {
    if (cause?.name === 'TimeoutError' || cause?.name === 'AbortError') {
      throw new Error(`timed out after ${timeoutMs / 1000} s`);
    }
    throw cause;
  }
}

// Extrae el texto de la respuesta de google; exige un formato conocido.
function parseGoogle(data) {
  if (!Array.isArray(data?.[0])) {
    throw new Error('Unexpected response format.');
  }
  const text = data[0]
    .map((segment) => (Array.isArray(segment) ? segment[0] : undefined))
    .filter((piece) => typeof piece === 'string')
    .join('');
  if (text === '') {
    throw new Error('Unexpected response format.');
  }
  return text;
}

// Extrae el texto de la respuesta de mymemory; exige estado 200 y texto no vacío.
function parseMyMemory(data) {
  const status = Number(data?.responseStatus);
  const translated = data?.responseData?.translatedText;
  if (status === 200 && typeof translated === 'string' && translated !== '') {
    return decodeEntities(translated);
  }
  const detail = data?.responseDetails ? `: ${data.responseDetails}` : '';
  throw new Error(`Unexpected response format${detail}.`);
}

async function translateWithGoogle(fragment, context) {
  const url = `${GOOGLE_URL}?client=gtx&sl=auto&tl=${context.targetLang}&dt=t&q=${encodeURIComponent(fragment)}`;
  return parseGoogle(await requestJson(url, context));
}

async function translateWithMyMemory(fragment, context) {
  const url = `${MYMEMORY_URL}?q=${encodeURIComponent(fragment)}&langpair=Autodetect%7C${context.targetLang}`;
  return parseMyMemory(await requestJson(url, context));
}

async function translateFragment(fragment, provider, context) {
  return provider === 'google'
    ? translateWithGoogle(fragment, context)
    : translateWithMyMemory(fragment, context);
}

// Traduce las líneas en secuencia; los fragmentos vacíos no generan petición.
async function translateLines(lines, provider, context) {
  const translatedLines = [];
  for (const line of lines) {
    const pieces = [];
    for (const fragment of splitForTranslation(line, TRANSLATE_CHUNK_CHARS)) {
      pieces.push(fragment === '' ? '' : await translateFragment(fragment, provider, context));
    }
    translatedLines.push(pieces.join(' '));
  }
  return translatedLines.join('\n');
}

// Traduce un texto a o.targetLang ('en' por defecto, o 'es'). Prueba google y, si falla, repite todo con mymemory.
export async function translateText(text, options = {}) {
  const fetchFn = options.fetchFn ?? globalThis.fetch;
  const timeoutMs = options.timeoutMs ?? TRANSLATE_TIMEOUT_MS;
  const targetLang = options.targetLang ?? DEFAULT_TARGET_LANG;

  if (!TARGET_LANGS.includes(targetLang)) {
    throw new RangeError(`Unsupported target language: ${targetLang}. Use 'en' or 'es'.`);
  }

  if (typeof text !== 'string' || text.trim() === '') {
    throw new Error('There is no text to translate.');
  }
  if (text.length > TRANSLATE_MAX_CHARS) {
    throw new Error(`The text is too long to translate (max ${TRANSLATE_MAX_CHARS} characters).`);
  }

  const lines = text.split('\n');
  let lastCause;
  for (const provider of ['google', 'mymemory']) {
    try {
      const translated = await translateLines(lines, provider, { fetchFn, timeoutMs, targetLang });
      return { text: translated.trim(), provider };
    } catch (cause) {
      lastCause = cause;
    }
  }
  throw new Error(
    `Translation service unavailable (${lastCause.message}). Check your internet connection and try again.`,
  );
}
