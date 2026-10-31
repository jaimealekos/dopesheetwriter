// Pruebas de la elección pura de idiomas del corrector ortográfico. Sin Electron.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { chooseSpellcheckLanguages } from '../main/spellcheck.js';

test('chooseSpellcheckLanguages: conserva los idiomas pedidos que estén disponibles', () => {
  assert.deepEqual(
    chooseSpellcheckLanguages(['en-US'], ['es-ES', 'en-US']),
    ['en-US'],
  );
});

test('chooseSpellcheckLanguages: sin ninguno disponible devuelve lista vacía', () => {
  assert.deepEqual(chooseSpellcheckLanguages(['en-US'], ['es-ES']), []);
});

test('chooseSpellcheckLanguages: respeta el orden pedido y descarta los ausentes', () => {
  assert.deepEqual(
    chooseSpellcheckLanguages(['en-US', 'en-GB'], ['en-GB', 'en-US']),
    ['en-US', 'en-GB'],
  );
  assert.deepEqual(chooseSpellcheckLanguages(['en-US', 'en-GB'], ['en-GB']), ['en-GB']);
});

test('chooseSpellcheckLanguages: listas vacías o no válidas devuelven lista vacía', () => {
  assert.deepEqual(chooseSpellcheckLanguages([], ['en-US']), []);
  assert.deepEqual(chooseSpellcheckLanguages(['en-US'], []), []);
  assert.deepEqual(chooseSpellcheckLanguages(['en-US'], undefined), []);
  assert.deepEqual(chooseSpellcheckLanguages(undefined, ['en-US']), []);
});

test('chooseSpellcheckLanguages: no muta las entradas', () => {
  const wanted = ['en-US'];
  const available = ['es-ES', 'en-US'];
  const wantedSnapshot = [...wanted];
  const availableSnapshot = [...available];

  chooseSpellcheckLanguages(wanted, available);

  assert.deepEqual(wanted, wantedSnapshot);
  assert.deepEqual(available, availableSnapshot);
});
