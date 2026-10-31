// Pruebas del módulo shotlist-format: formato de fecha, validación de cabecera
// y construcción del texto final. Sin red y sin mutar las entradas.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ShotlistError, formatDate, validateHeader, buildShotlist } from '../core/shotlist-format.js';
import { createShots, setInterview, updateShot } from '../core/shot-model.js';

// Construye un plano a mano para los casos que no pasan por shot-model.
function makeShot(number, overrides = {}) {
  const base = {
    number,
    startFrame: 0,
    endFrame: 25,
    size: '',
    movement: '',
    description: '',
    interview: false,
    soundbite: {
      name: '',
      profession: '',
      age: '',
      language: 'Spanish',
      gender: '',
      translation: '',
      original: '',
    },
  };
  return { ...base, ...overrides, soundbite: { ...base.soundbite, ...(overrides.soundbite ?? {}) } };
}

const VALID_HEADER = { location: 'MADRID, SPAIN', date: 'MARCH 17, 2024', source: 'AFPTV' };

test('formatDate: mes en mayúsculas y día sin ceros a la izquierda', () => {
  assert.equal(formatDate(new Date(2026, 2, 11)), 'MARCH 11, 2026');
  assert.equal(formatDate(new Date(2026, 9, 1)), 'OCTOBER 1, 2026');
  assert.equal(formatDate(new Date(2026, 0, 31)), 'JANUARY 31, 2026');
});

test('validateHeader: campos vacíos tras trim, en orden, y cabecera válida', () => {
  assert.deepEqual(validateHeader({ location: '', date: '', source: '' }), [
    'Location is empty.',
    'Date is empty.',
    'Source is empty.',
  ]);
  assert.deepEqual(validateHeader({ location: '   ', date: 'MARCH 17, 2024', source: '' }), [
    'Location is empty.',
    'Source is empty.',
  ]);
  assert.deepEqual(validateHeader(VALID_HEADER), []);
});

test('buildShotlist: texto exacto del criterio de aceptación', () => {
  const cuts = [
    { startFrame: 0, endFrame: 100 },
    { startFrame: 100, endFrame: 225 },
    { startFrame: 225, endFrame: 809 },
    { startFrame: 809, endFrame: 1520 },
  ];
  let shots = createShots(cuts);
  shots = updateShot(shots, 1, { size: 'Wide shot', description: 'Tractors march' });
  shots = updateShot(shots, 2, { size: 'Wide shot', movement: 'Pan right', description: 'General view' });
  shots = setInterview(shots, 3, true);
  shots = updateShot(shots, 3, {
    soundbite: {
      name: 'Vicente Aragón',
      profession: 'Vineyard farmer from Tarancón',
      age: '33',
      language: 'Spanish',
      gender: 'man',
      translation: 'We are suffering an unfair competition.',
      original: 'Tenemos una competencia desleal.',
    },
  });
  shots = updateShot(shots, 4, {
    soundbite: {
      name: 'Milagros Muñoz',
      language: 'Spanish',
      gender: 'woman',
      translation: 'Translation two.',
      original: 'Original dos.',
    },
  });

  const expected = [
    'SHOTLIST',
    'MADRID, SPAIN',
    'MARCH 17, 2024',
    'SOURCE: AFPTV',
    '',
    'IMAGES (00:09)',
    '',
    '1. Wide shot - Tractors march',
    '2. Wide shot, pan right - General view',
    '',
    '',
    '3. SOUNDBITE 1 - Vicente Aragón, Vineyard farmer from Tarancón, 33 years (Spanish, man, 23sec):',
    '',
    '"We are suffering an unfair competition."',
    '',
    '"Tenemos una competencia desleal."',
    '',
    '',
    '4. SOUNDBITE 2 - Milagros Muñoz (Spanish, woman, 28sec):',
    '',
    '"Translation two."',
    '',
    '"Original dos."',
  ].join('\n') + '\n';

  assert.equal(buildShotlist({ header: VALID_HEADER, shots, fps: 25 }), expected);
});

test('buildShotlist: sin entrevistas no añade líneas vacías finales', () => {
  const shots = [
    makeShot(1, { startFrame: 0, endFrame: 50, size: 'Wide shot', description: 'Uno' }),
    makeShot(2, { startFrame: 50, endFrame: 100, size: 'Close-up', description: 'Dos' }),
  ];
  const text = buildShotlist({ header: VALID_HEADER, shots, fps: 25 });

  assert.ok(text.endsWith('2. Close-up - Dos\n'));
  assert.ok(!text.endsWith('\n\n'));
});

test('buildShotlist: translation y original opcionales en el soundbite', () => {
  const withOriginal = makeShot(1, {
    interview: true,
    soundbite: { name: 'Ana', gender: 'woman', language: 'Spanish', original: 'Original uno.' },
  });
  const onlyTranslation = makeShot(1, {
    interview: true,
    soundbite: { name: 'Ana', gender: 'woman', language: 'Spanish', translation: 'Hola.' },
  });
  const emptyBoth = makeShot(1, {
    interview: true,
    soundbite: { name: 'Ana', gender: 'woman', language: 'Spanish' },
  });

  // Descarta el último elemento vacío que deja el salto de línea final.
  const block = (shot) => buildShotlist({ header: VALID_HEADER, shots: [shot], fps: 25 }).split('\n').slice(0, -1);
  const headerLine = '1. SOUNDBITE 1 - Ana (Spanish, woman, 1sec):';

  // Con original vacío, no queda su bloque (ni la línea vacía previa).
  assert.deepEqual(block(onlyTranslation).slice(-3), [headerLine, '', '"Hola."']);
  // Con translation vacía, va directo al original precedido de una línea vacía.
  assert.deepEqual(block(withOriginal).slice(-3), [headerLine, '', '"Original uno."']);
  // Ambos vacíos: solo la línea de cabecera.
  assert.equal(block(emptyBoth).at(-1), headerLine);
  assert.equal(block(emptyBoth).at(-2), '');
});

test('buildShotlist: quién con profession y edad opcionales', () => {
  const base = { interview: true, soundbite: { name: 'Ana', gender: 'woman', language: 'Spanish' } };
  const lineOf = (soundbite) => {
    const shot = makeShot(1, { interview: true, soundbite });
    return buildShotlist({ header: VALID_HEADER, shots: [shot], fps: 25 })
      .split('\n')
      .find((line) => line.startsWith('1. SOUNDBITE'));
  };

  assert.equal(lineOf({ ...base.soundbite }), '1. SOUNDBITE 1 - Ana (Spanish, woman, 1sec):');
  assert.equal(
    lineOf({ ...base.soundbite, age: '33' }),
    '1. SOUNDBITE 1 - Ana, 33 years (Spanish, woman, 1sec):',
  );
  assert.equal(
    lineOf({ ...base.soundbite, profession: 'Farmer', age: '1' }),
    '1. SOUNDBITE 1 - Ana, Farmer, 1 year (Spanish, woman, 1sec):',
  );
});

test('buildShotlist: colapsa saltos y espacios interiores en una sola línea', () => {
  const shot = makeShot(1, {
    size: 'Wide shot',
    description: 'Tractors   march\n\nthrough the   square',
  });
  const text = buildShotlist({ header: VALID_HEADER, shots: [shot], fps: 25 });
  assert.match(text, /\n1\. Wide shot - Tractors march through the square\n/);
});

test('buildShotlist: no duplica las comillas ya presentes', () => {
  const shot = makeShot(1, {
    interview: true,
    soundbite: {
      name: 'Ana',
      gender: 'woman',
      language: 'Spanish',
      translation: '"Hello"',
      original: 'Original',
    },
  });
  const text = buildShotlist({ header: VALID_HEADER, shots: [shot], fps: 25 });
  assert.ok(text.includes('\n"Hello"\n'));
  assert.ok(!text.includes('""Hello""'));
});

test('buildShotlist: solo entrevistas coloca las dos líneas vacías tras IMAGES', () => {
  const shot = makeShot(1, {
    interview: true,
    soundbite: { name: 'Ana', gender: 'woman', language: 'Spanish' },
  });
  const expected = [
    'SHOTLIST',
    'MADRID, SPAIN',
    'MARCH 17, 2024',
    'SOURCE: AFPTV',
    '',
    'IMAGES (00:00)',
    '',
    '',
    '',
    '1. SOUNDBITE 1 - Ana (Spanish, woman, 1sec):',
  ].join('\n') + '\n';
  assert.equal(buildShotlist({ header: VALID_HEADER, shots: [shot], fps: 25 }), expected);
});

test('buildShotlist: estricto lanza ShotlistError con problems', () => {
  const header = { location: '', date: '', source: '' };
  const problems = [
    'Location is empty.',
    'Date is empty.',
    'Source is empty.',
    'Shot 1: missing shot size, description',
  ];

  assert.throws(
    () => buildShotlist({ header, shots: [makeShot(1)], fps: 25 }),
    (error) => {
      assert.equal(error instanceof ShotlistError, true);
      assert.deepEqual(error.problems, problems);
      assert.equal(error.message, problems.join('\n'));
      return true;
    },
  );
});

test('buildShotlist: sin estricto sustituye lo que falta por marcadores', () => {
  const header = { location: '', date: '', source: '' };
  const normal = buildShotlist({ header, shots: [makeShot(1)], fps: 25 }, { strict: false });
  assert.ok(normal.includes('[LOCATION]'));
  assert.ok(normal.includes('[DATE]'));
  assert.ok(normal.includes('SOURCE: [SOURCE]'));
  assert.ok(normal.includes('1. [SHOT SIZE] - [DESCRIPTION]'));

  const interview = buildShotlist(
    {
      header: VALID_HEADER,
      shots: [makeShot(1, { interview: true, soundbite: { name: '', language: '', gender: '' } })],
      fps: 25,
    },
    { strict: false },
  );
  assert.ok(interview.includes('1. SOUNDBITE 1 - [NAME] ([LANGUAGE], [GENDER], 1sec):'));
});

test('buildShotlist: lista vacía sin estricto devuelve solo cabecera e IMAGES', () => {
  const expected = [
    'SHOTLIST',
    'MADRID, SPAIN',
    'MARCH 17, 2024',
    'SOURCE: AFPTV',
    '',
    'IMAGES (00:00)',
  ].join('\n') + '\n';
  assert.equal(buildShotlist({ header: VALID_HEADER, shots: [], fps: 25 }, { strict: false }), expected);
});

test('buildShotlist: fps no positivo lanza RangeError en estricto y en laxo', () => {
  for (const fps of [0, -25, NaN, '25']) {
    assert.throws(
      () => buildShotlist({ header: VALID_HEADER, shots: [makeShot(1)], fps }),
      (error) => error instanceof RangeError && error.message === 'fps must be a positive number',
    );
    assert.throws(
      () => buildShotlist({ header: VALID_HEADER, shots: [], fps }, { strict: false }),
      RangeError,
    );
  }
});
