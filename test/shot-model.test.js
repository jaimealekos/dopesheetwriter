// Pruebas del módulo shot-model. Sin red y sin mutar las entradas.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  createShots,
  updateShot,
  setInterview,
  copyFromPrevious,
  shotMissing,
  isShotComplete,
  progress,
  nextPending,
  soundbiteIndex,
  pendingTranslations,
  validateForExport,
  exportAnnotations,
  applyAnnotations,
} from '../core/shot-model.js';

// Construye un plano completo a mano para los casos que no deben pasar por las funciones.
function makeShot(number, overrides = {}) {
  const base = {
    number,
    startFrame: number * 10,
    endFrame: number * 10 + 10,
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

const THREE_CUTS = [
  { startFrame: 0, endFrame: 24 },
  { startFrame: 24, endFrame: 48 },
  { startFrame: 48, endFrame: 72 },
];

test('createShots: un plano por corte con campos por defecto', () => {
  const cuts = [...THREE_CUTS.map((cut) => ({ ...cut }))];
  const before = JSON.parse(JSON.stringify(cuts));
  const shots = createShots(cuts);

  assert.equal(shots.length, 3);
  assert.deepEqual(shots.map((shot) => shot.number), [1, 2, 3]);
  assert.deepEqual(shots[0], {
    number: 1,
    startFrame: 0,
    endFrame: 24,
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
  });
  assert.equal(shots[2].soundbite.language, 'Spanish');
  // Cada plano tiene su propio soundbite y no se mutó la entrada.
  assert.notEqual(shots[0].soundbite, shots[1].soundbite);
  assert.deepEqual(cuts, before);
});

test('updateShot: no muta la entrada y fusiona el soundbite parcial', () => {
  const shots = createShots(THREE_CUTS);
  const before = JSON.parse(JSON.stringify(shots));

  const result = updateShot(shots, 1, {
    size: 'Wide shot',
    movement: 'Pan left',
    description: 'Plano de apertura',
    soundbite: { name: 'Ana', gender: 'woman' },
  });

  assert.notEqual(result, shots);
  assert.notEqual(result[0], shots[0]);
  assert.equal(result[0].size, 'Wide shot');
  assert.equal(result[0].movement, 'Pan left');
  assert.equal(result[0].description, 'Plano de apertura');
  assert.equal(result[0].soundbite.name, 'Ana');
  assert.equal(result[0].soundbite.gender, 'woman');
  // El resto del soundbite se conserva.
  assert.equal(result[0].soundbite.language, 'Spanish');
  assert.equal(result[0].interview, false);

  // La entrada no cambió en absoluto.
  assert.deepEqual(shots, before);

  // Un segundo patch parcial sigue conservando lo anterior.
  const merged = updateShot(result, 1, { soundbite: { age: '30' } });
  assert.equal(merged[0].soundbite.name, 'Ana');
  assert.equal(merged[0].soundbite.gender, 'woman');
  assert.equal(merged[0].soundbite.age, '30');
});

test('updateShot: guarda las cadenas tal cual, sin trim', () => {
  const shots = createShots(THREE_CUTS);
  const result = updateShot(shots, 1, { description: '  con espacios  ' });
  assert.equal(result[0].description, '  con espacios  ');
});

test('updateShot: rechaza valores y claves no permitidos', () => {
  const shots = createShots(THREE_CUTS);

  assert.throws(() => updateShot(shots, 1, { size: 'Huge' }), /Invalid value for size: Huge\./);
  assert.throws(() => updateShot(shots, 1, { movement: 'Zoom' }), /Invalid value for movement: Zoom\./);
  assert.throws(() => updateShot(shots, 1, { description: 7 }), /Invalid value for description: 7\./);
  assert.throws(() => updateShot(shots, 1, { soundbite: { age: '5a' } }), /Invalid value for age: 5a\./);
  assert.throws(() => updateShot(shots, 1, { soundbite: { gender: 'other' } }), /Invalid value for gender: other\./);
  assert.throws(() => updateShot(shots, 1, { interview: true }), /Unknown field "interview" in shot update\./);
  assert.throws(() => updateShot(shots, 1, { foo: 1 }), /Unknown field "foo" in shot update\./);
  assert.throws(() => updateShot(shots, 9, { size: '' }), /Shot 9 does not exist\./);
});

test('updateShot: rechaza patches que no son objetos', () => {
  const shots = createShots(THREE_CUTS);

  assert.throws(() => updateShot(shots, 1, null), /Invalid value for patch: null\./);
  assert.throws(() => updateShot(shots, 1, undefined), /Invalid value for patch: undefined\./);
  assert.throws(() => updateShot(shots, 1, 'size'), /Invalid value for patch: size\./);
  assert.throws(() => updateShot(shots, 1, 7), /Invalid value for patch: 7\./);
  assert.throws(() => updateShot(shots, 1, ['size']), /Invalid value for patch: size\./);
});

test('setInterview: cascada hacia delante y hacia atrás sin tocar la entrada', () => {
  const shots = createShots([
    { startFrame: 0, endFrame: 10 },
    { startFrame: 10, endFrame: 20 },
    { startFrame: 20, endFrame: 30 },
    { startFrame: 30, endFrame: 40 },
  ]);

  const marked = setInterview(shots, 2, true);
  assert.deepEqual(marked.map((shot) => shot.interview), [false, true, true, true]);
  assert.deepEqual(shots.map((shot) => shot.interview), [false, false, false, false]);

  const cleared = setInterview(marked, 3, false);
  assert.deepEqual(cleared.map((shot) => shot.interview), [false, false, false, true]);
});

test('copyFromPrevious: copia size, movement y description', () => {
  let shots = createShots(THREE_CUTS);
  shots = updateShot(shots, 1, { size: 'Mid shot', movement: 'Tilt up', description: 'Uno' });

  const result = copyFromPrevious(shots, 2);
  assert.equal(result[1].size, 'Mid shot');
  assert.equal(result[1].movement, 'Tilt up');
  assert.equal(result[1].description, 'Uno');
  assert.notEqual(result, shots);
});

test('copyFromPrevious: entrevista copia los cinco campos del hablante', () => {
  const shots = [
    makeShot(1, {
      interview: true,
      soundbite: {
        name: 'Ana',
        age: '34',
        profession: 'Periodista',
        language: 'Spanish',
        gender: 'woman',
        translation: 'Hello',
        original: 'Hola',
      },
    }),
    makeShot(2, {
      interview: true,
      soundbite: { translation: 'Adiós', original: 'Bye' },
    }),
  ];
  const before = JSON.parse(JSON.stringify(shots));

  const result = copyFromPrevious(shots, 2);
  assert.equal(result[1].soundbite.name, 'Ana');
  assert.equal(result[1].soundbite.age, '34');
  assert.equal(result[1].soundbite.profession, 'Periodista');
  assert.equal(result[1].soundbite.language, 'Spanish');
  assert.equal(result[1].soundbite.gender, 'woman');
  // translation y original del actual quedan intactos.
  assert.equal(result[1].soundbite.translation, 'Adiós');
  assert.equal(result[1].soundbite.original, 'Bye');
  // Objeto nuevo, sin mutar la entrada.
  assert.notEqual(result, shots);
  assert.notEqual(result[1], shots[1]);
  assert.notEqual(result[1].soundbite, shots[1].soundbite);
  assert.deepEqual(shots, before);
});

test('copyFromPrevious: errores de plano 1, anterior entrevista y actual entrevista', () => {
  const shots = createShots(THREE_CUTS);
  assert.throws(() => copyFromPrevious(shots, 1), /Shot 1 has no previous shot\./);

  const previousInterview = [makeShot(1, { interview: true }), makeShot(2)];
  assert.throws(
    () => copyFromPrevious(previousInterview, 2),
    /The previous shot is an interview\./,
  );

  const currentInterview = [makeShot(1), makeShot(2, { interview: true })];
  assert.throws(
    () => copyFromPrevious(currentInterview, 2),
    /The previous shot is not an interview\./,
  );
});

test('shotMissing e isShotComplete: plano normal y de entrevista', () => {
  const emptyNormal = makeShot(1);
  assert.deepEqual(shotMissing(emptyNormal), ['size', 'description']);
  assert.equal(isShotComplete(emptyNormal), false);

  const spacedDescription = makeShot(1, { size: 'Wide shot', description: '   ' });
  assert.deepEqual(shotMissing(spacedDescription), ['description']);

  const completeNormal = makeShot(1, { size: 'Close-up', description: 'Algo' });
  assert.deepEqual(shotMissing(completeNormal), []);
  assert.equal(isShotComplete(completeNormal), true);

  const emptyInterview = makeShot(1, { interview: true });
  assert.deepEqual(shotMissing(emptyInterview), ['name', 'gender']);

  const spacedLanguage = makeShot(1, {
    interview: true,
    soundbite: { name: 'Ana', gender: 'woman', language: '  ' },
  });
  assert.deepEqual(shotMissing(spacedLanguage), ['language']);
});

test('progress: cuenta planos completos sobre el total', () => {
  const shots = [
    makeShot(1, { size: 'Wide shot', description: 'Completo' }),
    makeShot(2, { size: 'Close-up', description: 'Completo' }),
    makeShot(3),
    makeShot(4, { interview: true }),
  ];
  assert.deepEqual(progress(shots), { done: 2, total: 4 });
});

test('nextPending: salta al posterior, da la vuelta o devuelve null', () => {
  const gap = [makeShot(1), makeShot(2, { size: 'Wide shot', description: 'ok' }), makeShot(3), makeShot(4, { size: 'Wide shot', description: 'ok' })];
  assert.equal(nextPending(gap, 2), 3);

  const onlyBefore = [makeShot(1), makeShot(2, { size: 'Wide shot', description: 'ok' }), makeShot(3, { size: 'Wide shot', description: 'ok' })];
  assert.equal(nextPending(onlyBefore, 2), 1);

  const allComplete = [makeShot(1, { size: 'Wide shot', description: 'ok' })];
  assert.equal(nextPending(allComplete, 0), null);
});

test('soundbiteIndex: posición entre entrevistas o 0', () => {
  const shots = [
    makeShot(1, { size: 'Wide shot', description: 'normal' }),
    makeShot(2, { interview: true }),
    makeShot(3, { interview: true }),
  ];
  assert.equal(soundbiteIndex(shots, 1), 0);
  assert.equal(soundbiteIndex(shots, 2), 1);
  assert.equal(soundbiteIndex(shots, 3), 2);
});

test('pendingTranslations: entrevistas con Original y sin Translation', () => {
  assert.deepEqual(pendingTranslations([]), []);

  const shots = [
    makeShot(1, { size: 'Wide shot', description: 'normal' }),
    makeShot(2, { interview: true, soundbite: { original: 'Hola' } }),
    makeShot(3, { interview: true, soundbite: { original: 'Adiós', translation: '   ' } }),
    makeShot(4, { interview: true, soundbite: { original: 'Ya está', translation: 'Done' } }),
    makeShot(5, { interview: true, soundbite: { original: '   ' } }),
    makeShot(6, { interview: true }),
  ];

  assert.deepEqual(pendingTranslations(shots), [2, 3]);
  // No muta la entrada.
  assert.equal(shots[1].soundbite.translation, '');
});

test('validateForExport: lista vacía, faltantes y entrevistas al final', () => {
  assert.deepEqual(validateForExport([]), { ok: false, problems: ['No shots.'] });

  assert.deepEqual(validateForExport([makeShot(1)]), {
    ok: false,
    problems: ['Shot 1: missing shot size, description'],
  });

  const normalAfterInterview = [
    makeShot(1, { interview: true }),
    makeShot(2, { interview: true }),
    makeShot(3, { size: 'Wide shot', description: 'normal' }),
  ];
  const problems = validateForExport(normalAfterInterview).problems;
  assert.ok(problems.includes('Shot 3: interviews must be at the end.'));

  assert.deepEqual(
    validateForExport([makeShot(1, { size: 'Wide shot', description: 'ok' })]),
    { ok: true, problems: [] },
  );
});

test('exportAnnotations y applyAnnotations: ida y vuelta', () => {
  const cuts = [
    { startFrame: 0, endFrame: 24 },
    { startFrame: 24, endFrame: 48 },
  ];
  let shots = createShots(cuts);
  shots = updateShot(shots, 1, {
    size: 'Close-up',
    movement: 'Tilt up',
    description: 'Primer plano',
    soundbite: { name: 'Ana', profession: 'Periodista', age: '35', gender: 'woman' },
  });
  shots = setInterview(shots, 2, true);
  shots = updateShot(shots, 2, {
    soundbite: { name: 'Luis', gender: 'man', language: 'Spanish', age: '40' },
  });

  const annotations = exportAnnotations(shots);
  assert.deepEqual(Object.keys(annotations).sort(), ['0-24', '24-48']);
  assert.equal(annotations['0-24'].interview, false);
  assert.equal(annotations['24-48'].interview, true);

  const restored = applyAnnotations(createShots(cuts), annotations);
  assert.deepEqual(restored, shots);
  // El soundbite exportado es una copia, no una referencia viva.
  annotations['0-24'].soundbite.name = 'Mutado';
  assert.equal(shots[0].soundbite.name, 'Ana');
});

test('applyAnnotations: valores inválidos a por defecto y claves ajenas ignoradas', () => {
  const cuts = [{ startFrame: 0, endFrame: 24 }];
  const defaults = createShots(cuts);

  const invalid = applyAnnotations(defaults, {
    '0-24': {
      size: 'Huge',
      movement: 'Zoom',
      description: 7,
      interview: 'sí',
      soundbite: { gender: 'other', age: '5a', name: 42 },
    },
  });
  assert.equal(invalid[0].size, '');
  assert.equal(invalid[0].movement, '');
  assert.equal(invalid[0].description, '');
  assert.equal(invalid[0].interview, false);
  assert.equal(invalid[0].soundbite.gender, '');
  assert.equal(invalid[0].soundbite.age, '');
  assert.equal(invalid[0].soundbite.name, '');
  assert.equal(invalid[0].soundbite.language, 'Spanish');

  const untouched = applyAnnotations(defaults, { '999-1000': { size: 'Wide shot' } });
  assert.deepEqual(untouched, defaults);
});
