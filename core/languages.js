// Idiomas de la transcripción y de la traducción. Módulo puro, sin Node: lo importa también el renderer.

// Código ISO 639-1 → nombre en inglés, tal como lo escribe el campo Language del soundbite.
export const LANGUAGE_NAMES = {
  es: 'Spanish',
  en: 'English',
  ca: 'Catalan',
  eu: 'Basque',
  gl: 'Galician',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
};

// Nombres castellanos de cada idioma, ya sin acentos y en minúsculas.
const SPANISH_NAMES = {
  es: ['espanol', 'castellano'],
  en: ['ingles'],
  ca: ['catalan'],
  eu: ['euskera', 'vasco'],
  gl: ['gallego'],
  fr: ['frances'],
  de: ['aleman'],
  it: ['italiano'],
  pt: ['portugues'],
};

// Valores del campo Language que se consideran inglés, ya sin acentos y en minúsculas.
const ENGLISH_VALUES = ['english', 'ingles', 'en'];

const TARGET_LABELS = { es: 'Spanish', en: 'English' };

// Recorta, pasa a minúsculas y quita los acentos de un nombre de idioma.
function normalizeLanguage(value) {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim()
    .toLowerCase();
}

// Código ISO de un idioma por su código, su nombre inglés o su nombre castellano.
// 'French', 'french', 'Francés', 'frances', 'fr', ' FR ' → 'fr'; desconocido → null.
export function languageCodeFromName(value) {
  if (typeof value !== 'string') {
    return null;
  }
  const key = normalizeLanguage(value);
  if (key === '') {
    return null;
  }
  if (Object.hasOwn(LANGUAGE_NAMES, key)) {
    return key;
  }
  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    if (normalizeLanguage(name) === key) return code;
  }
  for (const [code, aliases] of Object.entries(SPANISH_NAMES)) {
    if (aliases.includes(key)) return code;
  }
  return null;
}

// Nombre del idioma de un código ('es' o 'ES' → 'Spanish'); desconocido o vacío → null.
export function languageNameFromCode(code) {
  if (typeof code !== 'string') {
    return null;
  }
  const key = code.trim().toLowerCase();
  return Object.hasOwn(LANGUAGE_NAMES, key) ? LANGUAGE_NAMES[key] : null;
}

// Indica si el campo Language de un soundbite designa el inglés.
export function isEnglish(language) {
  if (typeof language !== 'string') {
    return false;
  }
  return ENGLISH_VALUES.includes(normalizeLanguage(language));
}

// Sentido de la traducción: del inglés al español; de cualquier otro al inglés.
export function translationTarget(language) {
  return isEnglish(language) ? 'es' : 'en';
}

// Nombre del idioma destino para los textos de la interfaz.
export function targetLanguageLabel(target) {
  if (!Object.hasOwn(TARGET_LABELS, target)) {
    throw new RangeError(`Unsupported target language: ${target}. Use 'es' or 'en'.`);
  }
  return TARGET_LABELS[target];
}
