// Modelo puro e inmutable de los planos anotados (shotlist).
// Ninguna función muta la entrada: siempre se devuelven arrays/objetos nuevos.
// Nota: los planos no modificados se comparten por referencia entre la entrada y la
// salida (estructura compartida); solo se reconstruyen los planos afectados.

import { SHOT_SIZES, MOVEMENTS, GENDERS, DEFAULT_LANGUAGE } from './config.js';

const SOUNDBITE_KEYS = ['name', 'profession', 'age', 'language', 'gender', 'translation', 'original'];

// La edad es una cadena de 0 a 3 dígitos (vacía permitida).
const AGE_PATTERN = /^\d{0,3}$/;

// Etiquetas humanas (inglés) de cada campo que puede faltar en un plano.
const MISSING_LABELS = {
  size: 'shot size',
  description: 'description',
  name: 'name',
  gender: 'gender',
  language: 'language',
};

// Soundbite vacío con el idioma por defecto.
function emptySoundbite() {
  return {
    name: '',
    profession: '',
    age: '',
    language: DEFAULT_LANGUAGE,
    gender: '',
    translation: '',
    original: '',
  };
}

function indexOfNumber(shots, number) {
  return shots.findIndex((shot) => shot.number === number);
}

function isSize(value) {
  return value === '' || SHOT_SIZES.includes(value);
}

function isMovement(value) {
  return value === '' || MOVEMENTS.includes(value);
}

// Valida y aplica un soundbite parcial sobre el actual; devuelve un objeto nuevo.
function mergeSoundbite(current, patch) {
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new RangeError(`Invalid value for soundbite: ${patch}.`);
  }
  const merged = { ...current };
  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (!SOUNDBITE_KEYS.includes(key)) {
      throw new RangeError(`Unknown field "${key}" in shot update.`);
    }
    if (key === 'gender') {
      if (!(value === '' || GENDERS.includes(value))) {
        throw new RangeError(`Invalid value for gender: ${value}.`);
      }
    } else if (key === 'age') {
      if (typeof value !== 'string' || !AGE_PATTERN.test(value)) {
        throw new RangeError(`Invalid value for age: ${value}.`);
      }
    } else if (typeof value !== 'string') {
      throw new RangeError(`Invalid value for ${key}: ${value}.`);
    }
    merged[key] = value;
  }
  return merged;
}

/**
 * Crea un plano por corte, numerados 1..n en el orden recibido.
 * @param {{ startFrame:number, endFrame:number }[]} cuts
 * @returns {object[]}
 */
export function createShots(cuts) {
  return cuts.map((cut, index) => ({
    number: index + 1,
    startFrame: cut.startFrame,
    endFrame: cut.endFrame,
    size: '',
    movement: '',
    description: '',
    interview: false,
    soundbite: emptySoundbite(),
  }));
}

/**
 * Fusiona un patch de claves permitidas sobre el plano indicado.
 * `interview` no se cambia por aquí.
 */
export function updateShot(shots, number, patch) {
  const index = indexOfNumber(shots, number);
  if (index === -1) throw new RangeError(`Shot ${number} does not exist.`);
  if (patch === null || typeof patch !== 'object' || Array.isArray(patch)) {
    throw new RangeError(`Invalid value for patch: ${patch}.`);
  }

  const shot = shots[index];
  let { size, movement, description, soundbite } = shot;

  for (const key of Object.keys(patch)) {
    const value = patch[key];
    if (key === 'size') {
      if (!isSize(value)) throw new RangeError(`Invalid value for size: ${value}.`);
      size = value;
    } else if (key === 'movement') {
      if (!isMovement(value)) throw new RangeError(`Invalid value for movement: ${value}.`);
      movement = value;
    } else if (key === 'description') {
      if (typeof value !== 'string') throw new RangeError(`Invalid value for description: ${value}.`);
      description = value;
    } else if (key === 'soundbite') {
      soundbite = mergeSoundbite(shot.soundbite, value);
    } else {
      throw new RangeError(`Unknown field "${key}" in shot update.`);
    }
  }

  const updated = { ...shot, size, movement, description, soundbite };
  return shots.map((item, i) => (i === index ? updated : item));
}

/**
 * value true: marca como entrevista los planos number..último.
 * value false: desmarca los planos 1..number.
 */
export function setInterview(shots, number, value) {
  const index = indexOfNumber(shots, number);
  if (index === -1) throw new RangeError(`Shot ${number} does not exist.`);

  return shots.map((shot) => {
    const inRange = value ? shot.number >= number : shot.number <= number;
    if (!inRange || shot.interview === value) return shot;
    return { ...shot, interview: value };
  });
}

/**
 * Copia del plano anterior al plano indicado.
 * Plano de imagen: size, movement y description del anterior no-entrevista.
 * Plano de entrevista: name, age, profession, language y gender del anterior
 * (que debe ser entrevista); translation y original quedan intactos.
 */
export function copyFromPrevious(shots, number) {
  const index = indexOfNumber(shots, number);
  if (index === -1) throw new RangeError(`Shot ${number} does not exist.`);
  if (index === 0) throw new Error('Shot 1 has no previous shot.');

  const current = shots[index];
  const previous = shots[index - 1];

  if (current.interview) {
    if (!previous.interview) throw new Error('The previous shot is not an interview.');
    const updated = {
      ...current,
      soundbite: {
        ...current.soundbite,
        name: previous.soundbite.name,
        age: previous.soundbite.age,
        profession: previous.soundbite.profession,
        language: previous.soundbite.language,
        gender: previous.soundbite.gender,
      },
    };
    return shots.map((item, i) => (i === index ? updated : item));
  }

  if (previous.interview) throw new Error('The previous shot is an interview.');

  const updated = {
    ...current,
    size: previous.size,
    movement: previous.movement,
    description: previous.description,
  };
  return shots.map((item, i) => (i === index ? updated : item));
}

/** Lista de claves que faltan en el plano, en el orden documentado. */
export function shotMissing(shot) {
  if (shot.interview) {
    const missing = [];
    if (shot.soundbite.name.trim() === '') missing.push('name');
    if (shot.soundbite.gender === '') missing.push('gender');
    if (shot.soundbite.language.trim() === '') missing.push('language');
    return missing;
  }
  const missing = [];
  if (shot.size === '') missing.push('size');
  if (shot.description.trim() === '') missing.push('description');
  return missing;
}

export function isShotComplete(shot) {
  return shotMissing(shot).length === 0;
}

export function progress(shots) {
  return {
    done: shots.filter(isShotComplete).length,
    total: shots.length,
  };
}

/** Primer incompleto con número > fromNumber; si no, el primero desde el principio. */
export function nextPending(shots, fromNumber) {
  const later = shots.find((shot) => shot.number > fromNumber && !isShotComplete(shot));
  if (later) return later.number;
  const any = shots.find((shot) => !isShotComplete(shot));
  return any ? any.number : null;
}

/** Posición 1..n del plano entre los de entrevista; 0 si no es de entrevista. */
export function soundbiteIndex(shots, number) {
  const shot = shots.find((item) => item.number === number);
  if (!shot || !shot.interview) return 0;
  const interviews = shots.filter((item) => item.interview);
  return interviews.findIndex((item) => item.number === number) + 1;
}

/**
 * Números de plano de entrevista con Original escrito y Translation aún vacía,
 * en orden de plano. Los planos de imagen y los ya traducidos se ignoran.
 */
export function pendingTranslations(shots) {
  return shots
    .filter(
      (shot) =>
        shot.interview &&
        shot.soundbite.original.trim() !== '' &&
        shot.soundbite.translation.trim() === '',
    )
    .map((shot) => shot.number);
}

/** Problemas (en inglés) que impiden exportar; `ok` es true si la lista está vacía. */
export function validateForExport(shots) {
  if (shots.length === 0) return { ok: false, problems: ['No shots.'] };

  const problems = [];
  let seenInterview = false;
  for (const shot of shots) {
    const missing = shotMissing(shot);
    if (missing.length > 0) {
      const labels = missing.map((key) => MISSING_LABELS[key]).join(', ');
      problems.push(`Shot ${shot.number}: missing ${labels}`);
    }
    if (shot.interview) {
      seenInterview = true;
    } else if (seenInterview) {
      problems.push(`Shot ${shot.number}: interviews must be at the end.`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/** Serializa las anotaciones indexadas por `startFrame-endFrame`. */
export function exportAnnotations(shots) {
  const annotations = {};
  for (const shot of shots) {
    annotations[`${shot.startFrame}-${shot.endFrame}`] = {
      size: shot.size,
      movement: shot.movement,
      description: shot.description,
      interview: shot.interview,
      soundbite: { ...shot.soundbite },
    };
  }
  return annotations;
}

// Construye un soundbite desde los valores por defecto, ignorando los inválidos.
function buildSoundbite(raw) {
  const base = emptySoundbite();
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return base;

  for (const key of SOUNDBITE_KEYS) {
    const value = raw[key];
    if (key === 'gender') {
      if (value === '' || GENDERS.includes(value)) base.gender = value;
    } else if (key === 'age') {
      if (typeof value === 'string' && AGE_PATTERN.test(value)) base.age = value;
    } else if (typeof value === 'string') {
      base[key] = value;
    }
  }
  return base;
}

/** Aplica anotaciones a los planos con clave presente; el resto queda intacto. */
export function applyAnnotations(shots, annotations) {
  return shots.map((shot) => {
    const key = `${shot.startFrame}-${shot.endFrame}`;
    if (!Object.prototype.hasOwnProperty.call(annotations, key)) return shot;

    const data = annotations[key];
    const source = data !== null && typeof data === 'object' && !Array.isArray(data) ? data : {};

    const size = isSize(source.size) ? source.size : '';
    const movement = isMovement(source.movement) ? source.movement : '';
    const description = typeof source.description === 'string' ? source.description : '';
    const interview = typeof source.interview === 'boolean' ? source.interview : false;

    return {
      ...shot,
      size,
      movement,
      description,
      interview,
      soundbite: buildSoundbite(source.soundbite),
    };
  });
}
