// Pruebas de las funciones puras de state.js (sin DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDraftToShots,
  draftHeader,
  countAnnotated,
  textName,
  folderOf,
} from '../renderer/state.js';
import { createShots, updateShot, setInterview } from '../core/shot-model.js';

// Tres planos con el primero anotado; el resto vacíos.
function sampleShots() {
  let shots = createShots([
    { startFrame: 0, endFrame: 100 },
    { startFrame: 100, endFrame: 200 },
    { startFrame: 200, endFrame: 300 },
  ]);
  shots = updateShot(shots, 1, { size: 'Wide shot', description: 'Uno' });
  return shots;
}

test('applyDraftToShots con borrador nulo o inválido deja los planos igual', () => {
  const shots = sampleShots();
  assert.deepEqual(applyDraftToShots(shots, null), shots);
  assert.deepEqual(applyDraftToShots(shots, {}), shots);
  assert.deepEqual(applyDraftToShots(shots, { annotations: [] }), shots);
  assert.deepEqual(applyDraftToShots(shots, { annotations: 'x' }), shots);
});

test('applyDraftToShots aplica las anotaciones por inicio-fin y respeta las ausentes', () => {
  const shots = sampleShots();
  const draft = {
    annotations: {
      '100-200': {
        size: 'Close-up',
        movement: 'Pan right',
        description: 'Dos',
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
      },
    },
  };

  const applied = applyDraftToShots(shots, draft);
  assert.equal(applied.length, 3);
  assert.equal(applied[0], shots[0]);
  assert.equal(applied[2], shots[2]);
  assert.equal(applied[1].size, 'Close-up');
  assert.equal(applied[1].movement, 'Pan right');
  assert.equal(applied[1].description, 'Dos');
});

test('draftHeader devuelve null sin cabecera y normaliza los tipos', () => {
  assert.equal(draftHeader(null), null);
  assert.equal(draftHeader({}), null);
  assert.equal(draftHeader({ header: null }), null);
  assert.equal(draftHeader({ header: 'x' }), null);
  assert.deepEqual(draftHeader({ header: { location: 'MADRID', date: 7, source: 'AFPTV' } }), {
    location: 'MADRID',
    date: '',
    source: 'AFPTV',
  });
});

test('draftHeader copia la cabecera completa', () => {
  const header = { location: 'MADRID, SPAIN', date: 'MARCH 11, 2026', source: 'AFPTV' };
  assert.deepEqual(draftHeader({ header }), header);
});

test('countAnnotated cuenta solo los planos con algún dato', () => {
  let shots = createShots([
    { startFrame: 0, endFrame: 100 },
    { startFrame: 100, endFrame: 200 },
    { startFrame: 200, endFrame: 300 },
    { startFrame: 300, endFrame: 400 },
    { startFrame: 400, endFrame: 500 },
  ]);
  assert.equal(countAnnotated(shots), 0);

  shots = updateShot(shots, 1, { size: 'Wide shot' });
  shots = updateShot(shots, 2, { movement: 'Pan left' });
  shots = updateShot(shots, 3, { description: 'Algo' });
  shots = updateShot(shots, 4, { soundbite: { name: 'Ana' } });

  // 1 (tipo), 2 (movimiento), 3 (descripción) y 4 (nombre); el 5 vacío no.
  assert.equal(countAnnotated(shots), 4);
});

test('countAnnotated cuenta una entrevista aunque no tenga más datos', () => {
  let shots = createShots([{ startFrame: 0, endFrame: 100 }]);
  shots = setInterview(shots, 1, true);
  assert.equal(countAnnotated(shots), 1);
});

test('textName cambia la extensión del vídeo por .txt', () => {
  assert.equal(textName('Mani tractores.mp4'), 'Mani tractores.txt');
  assert.equal(textName('clip.mov'), 'clip.txt');
  assert.equal(textName('archivo.tar.gz'), 'archivo.tar.txt');
  assert.equal(textName('sin-extension'), 'sin-extension.txt');
  assert.equal(textName(''), '.txt');
});

test('folderOf devuelve la carpeta con / o \\ y vacío sin separador', () => {
  assert.equal(folderOf('C:/videos/clip.mp4'), 'C:/videos');
  assert.equal(folderOf('C:\\videos\\clip.mp4'), 'C:\\videos');
  assert.equal(folderOf('a/b\\c'), 'a/b');
  assert.equal(folderOf('clip.mp4'), '');
  assert.equal(folderOf(''), '');
});
