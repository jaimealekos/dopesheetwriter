// Pruebas del módulo frames: cálculo del tamaño de miniatura y clasificación del fallo del vídeo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { thumbnailSize, classifyMediaError } from '../renderer/frames.js';

test('thumbnailSize mantiene el ancho objetivo y calcula el alto proporcional', () => {
  assert.deepEqual(thumbnailSize(1920, 1080, 320), { width: 320, height: 180 });
  assert.deepEqual(thumbnailSize(3840, 2160, 128), { width: 128, height: 72 });
  assert.deepEqual(thumbnailSize(1000, 1000, 100), { width: 100, height: 100 });
});

test('thumbnailSize redondea el alto al píxel más cercano', () => {
  assert.deepEqual(thumbnailSize(1920, 1080, 100), { width: 100, height: 56 });
  assert.deepEqual(thumbnailSize(2, 3, 1), { width: 1, height: 2 });
});

test('thumbnailSize lanza RangeError con el mensaje exacto si el ancho no es positivo', () => {
  const expected = { name: 'RangeError', message: 'video width must be positive' };
  assert.throws(() => thumbnailSize(0, 1080, 320), expected);
  assert.throws(() => thumbnailSize(-1920, 1080, 320), expected);
});

test('classifyMediaError marca decode cuando no hay imagen o el códec falla', () => {
  assert.equal(classifyMediaError(4, 1920), 'decode');
  assert.equal(classifyMediaError(3, 1920), 'decode');
  assert.equal(classifyMediaError(null, 0), 'decode');
  assert.equal(classifyMediaError(2, 0), 'decode');
});

test('classifyMediaError marca unreadable en el resto de casos', () => {
  assert.equal(classifyMediaError(2, 1920), 'unreadable');
  assert.equal(classifyMediaError(null, 1920), 'unreadable');
  assert.equal(classifyMediaError(1, 1920), 'unreadable');
});

test('el módulo se importa en Node sin lanzar', () => {
  assert.equal(typeof thumbnailSize, 'function');
  assert.equal(typeof classifyMediaError, 'function');
});
