// Construye el texto final del shotlist (cabecera, IMAGES, planos y soundbites)
// y da formato a la fecha de cabecera. Sin dependencias externas.

import { MONTHS } from './config.js';
import { framesToSeconds, formatDuration, formatSoundbiteSeconds } from './timecode.js';
import { soundbiteIndex, validateForExport } from './shot-model.js';

// Error de exportación con la lista de problemas que lo provocaron.
export class ShotlistError extends Error {
  constructor(problems) {
    super(problems.join('\n'));
    this.name = 'ShotlistError';
    this.problems = problems;
  }
}

// Devuelve el valor si es una cadena; en cualquier otro caso, cadena vacía.
function toText(value) {
  return typeof value === 'string' ? value : '';
}

// Recorta y colapsa saltos de línea y espacios interiores en un solo espacio.
function collapse(value) {
  return toText(value).trim().replace(/\s+/g, ' ');
}

// Asegura una única pareja de comillas rectas alrededor del texto.
function quote(text) {
  let body = text;
  if (body.length >= 2 && body.startsWith('"') && body.endsWith('"')) {
    body = body.slice(1, -1);
  }
  return `"${body}"`;
}

// '33' -> '33 years'; '1' -> '1 year'.
function formatAge(age) {
  const years = Number.parseInt(age, 10);
  return `${years} ${years === 1 ? 'year' : 'years'}`;
}

// Línea de un plano normal, con movimiento en minúsculas si lo hay.
function formatNormalShot(shot) {
  const size = collapse(shot.size) || '[SHOT SIZE]';
  const description = collapse(shot.description) || '[DESCRIPTION]';
  const movement = collapse(shot.movement).toLowerCase();
  const movementPart = movement === '' ? '' : `, ${movement}`;
  return `${shot.number}. ${size}${movementPart} - ${description}`;
}

// Líneas del bloque de un soundbite: cabecera y textos opcionales precedidos de línea vacía.
function formatSoundbiteBlock(shot, index, fps) {
  const soundbite = shot.soundbite ?? {};
  const name = collapse(soundbite.name) || '[NAME]';
  const language = collapse(soundbite.language) || '[LANGUAGE]';
  const gender = collapse(soundbite.gender) || '[GENDER]';
  const seconds = formatSoundbiteSeconds(shot.endFrame - shot.startFrame, fps);

  const who = [name];
  const profession = collapse(soundbite.profession);
  if (profession !== '') who.push(profession);
  const age = collapse(soundbite.age);
  if (age !== '') who.push(formatAge(age));

  const block = [
    `${shot.number}. SOUNDBITE ${index} - ${who.join(', ')} (${language}, ${gender}, ${seconds}):`,
  ];

  const translation = collapse(soundbite.translation);
  if (translation !== '') block.push('', quote(translation));

  const original = collapse(soundbite.original);
  if (original !== '') block.push('', quote(original));

  return block;
}

// Fecha de cabecera en mayúsculas: 'MARCH 11, 2026' (día sin ceros a la izquierda).
export function formatDate(date) {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Problemas de la cabecera, en inglés y en orden: location, date, source.
export function validateHeader(header) {
  const data = header ?? {};
  const problems = [];
  if (collapse(data.location) === '') problems.push('Location is empty.');
  if (collapse(data.date) === '') problems.push('Date is empty.');
  if (collapse(data.source) === '') problems.push('Source is empty.');
  return problems;
}

/**
 * Construye el texto completo del shotlist.
 * @param {{ header: object, shots: object[], fps: number }} input
 * @param {{ strict?: boolean }} [options]
 * @returns {string}
 */
export function buildShotlist(input, options = {}) {
  const { header, shots, fps } = input;
  const strict = options.strict !== false;

  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('fps must be a positive number');
  }

  const problems = [...validateHeader(header), ...validateForExport(shots).problems];
  if (strict && problems.length > 0) {
    throw new ShotlistError(problems);
  }

  const data = header ?? {};
  const location = collapse(data.location) || '[LOCATION]';
  const date = collapse(data.date) || '[DATE]';
  const source = collapse(data.source) || '[SOURCE]';

  const normals = shots.filter((shot) => !shot.interview);
  const interviews = shots.filter((shot) => shot.interview);

  const totalFrames = normals.reduce(
    (sum, shot) => sum + (shot.endFrame - shot.startFrame),
    0,
  );
  const images = formatDuration(framesToSeconds(totalFrames, fps));

  const lines = [
    'SHOTLIST',
    location,
    date,
    `SOURCE: ${source}`,
    '',
    `IMAGES (${images})`,
  ];

  // La línea vacía tras IMAGES solo existe si hay planos que mostrar.
  if (shots.length > 0) lines.push('');
  lines.push(...normals.map((shot) => formatNormalShot(shot)));

  if (interviews.length > 0) {
    // Dos líneas vacías antes de la primera entrevista; dos más entre entrevistas.
    lines.push('', '');
    interviews.forEach((shot, index) => {
      if (index > 0) lines.push('', '');
      const position = soundbiteIndex(shots, shot.number);
      lines.push(...formatSoundbiteBlock(shot, position, fps));
    });
  }

  return `${lines.join('\n')}\n`;
}
