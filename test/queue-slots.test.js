// Pruebas de renderer/queue-slots.js: mezcla de las dos colas en la interfaz.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createQueueSlots } from '../renderer/queue-slots.js';

function makeSlots() {
  const status = [];
  const processing = [];
  const queued = [];
  const slots = createQueueSlots({
    setStatus: (text) => status.push(text),
    setProcessing: (number, kind) => processing.push([number, kind]),
    setQueued: (numbers) => queued.push([...numbers]),
  });
  return { slots, status, processing, queued };
}

test('queueSlots: el progreso de entrevistas manda y si no hay se usa el otro', () => {
  const { slots, status } = makeSlots();

  slots.setProgress('retranscribe', 'Retranscribing 1 of 2…');
  assert.equal(status.at(-1), 'Retranscribing 1 of 2…');

  slots.setProgress('interviews', 'Transcribing 2 of 4…');
  assert.equal(status.at(-1), 'Transcribing 2 of 4…');

  slots.setProgress('interviews', null);
  assert.equal(status.at(-1), 'Retranscribing 1 of 2…');

  slots.setProgress('retranscribe', null);
  assert.equal(status.at(-1), null);
});

test('queueSlots: el proceso de entrevistas manda y si no hay se usa el otro', () => {
  const { slots, processing } = makeSlots();

  slots.setProcessing('retranscribe', 5, 'translating');
  assert.deepEqual(processing.at(-1), [5, 'translating']);

  slots.setProcessing('interviews', 3, 'transcribing');
  assert.deepEqual(processing.at(-1), [3, 'transcribing']);

  slots.setProcessing('interviews', null, null);
  assert.deepEqual(processing.at(-1), [5, 'translating']);

  slots.setProcessing('retranscribe', null, null);
  assert.deepEqual(processing.at(-1), [null, null]);
});

test('queueSlots: en espera es la unión sin duplicados de las dos listas', () => {
  const { slots, queued } = makeSlots();

  slots.setQueued('interviews', [3, 5]);
  assert.deepEqual(queued.at(-1), [3, 5]);

  slots.setQueued('retranscribe', [5, 7]);
  assert.deepEqual(queued.at(-1), [3, 5, 7]);

  slots.setQueued('interviews', []);
  assert.deepEqual(queued.at(-1), [5, 7]);

  slots.setQueued('retranscribe', []);
  assert.deepEqual(queued.at(-1), []);
});
