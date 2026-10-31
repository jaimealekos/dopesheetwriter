// Pruebas del cálculo puro de main/window-width.js. Sin Electron.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeWidthChange } from '../main/window-width.js';

const WORK_AREA = { x: 0, y: 0, width: 1920, height: 1040 };

// Completa unos bounds mínimos con y/height por defecto.
function bounds(partial) {
  return { x: 0, y: 0, width: 0, height: 100, ...partial };
}

test('computeWidthChange: ensancha hasta el área de trabajo y se desplaza a la izquierda', () => {
  const result = computeWidthChange({ bounds: bounds({ x: 100, width: 1760 }), workArea: WORK_AREA, delta: 440, minWidth: 1280 });

  assert.equal(result.applied, 160);
  assert.equal(result.bounds.x, 0);
  assert.equal(result.bounds.width, 1920);
});

test('computeWidthChange: ensancha sin desbordar manteniendo x', () => {
  const result = computeWidthChange({ bounds: bounds({ x: 100, width: 1200 }), workArea: WORK_AREA, delta: 440, minWidth: 1280 });

  assert.equal(result.applied, 440);
  assert.equal(result.bounds.x, 100);
  assert.equal(result.bounds.width, 1640);
});

test('computeWidthChange: al desbordar por la derecha desplaza x a la izquierda', () => {
  const result = computeWidthChange({ bounds: bounds({ x: 1000, width: 900 }), workArea: WORK_AREA, delta: 440, minWidth: 1280 });

  assert.equal(result.applied, 440);
  assert.equal(result.bounds.width, 1340);
  assert.equal(result.bounds.x, 580);
});

test('computeWidthChange: estrecha sin bajar de minWidth', () => {
  const capped = computeWidthChange({ bounds: bounds({ width: 1640 }), workArea: WORK_AREA, delta: -440, minWidth: 1280 });
  assert.equal(capped.applied, -360);
  assert.equal(capped.bounds.width, 1280);

  const free = computeWidthChange({ bounds: bounds({ width: 1700 }), workArea: WORK_AREA, delta: -440, minWidth: 1280 });
  assert.equal(free.applied, -420);
  assert.equal(free.bounds.width, 1280);
});

test('computeWidthChange: delta 0 devuelve los mismos bounds y applied 0', () => {
  const input = bounds({ x: 20, y: 30, width: 900, height: 600 });
  const result = computeWidthChange({ bounds: input, workArea: WORK_AREA, delta: 0, minWidth: 1280 });

  assert.equal(result.applied, 0);
  assert.deepEqual(result.bounds, input);
});

test('computeWidthChange: no muta la entrada y conserva y/height', () => {
  const input = bounds({ x: 100, y: 40, width: 1760, height: 800 });
  const snapshot = { ...input };

  const result = computeWidthChange({ bounds: input, workArea: WORK_AREA, delta: 440, minWidth: 1280 });

  assert.deepEqual(input, snapshot);
  assert.equal(result.bounds.y, 40);
  assert.equal(result.bounds.height, 800);
});
