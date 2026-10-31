// Pruebas de la detección de entrevistas por duración (función pura, sin red ni DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { detectInterviewStart } from '../core/interview-detect.js';
import { INTERVIEW_MIN_SECONDS } from '../core/config.js';

// Planos de 1..n con las duraciones dadas, en fotogramas a los fps indicados.
function shotsFromSeconds(seconds, fps) {
  let start = 0;
  return seconds.map((duration, index) => {
    const end = start + Math.round(duration * fps);
    const shot = { number: index + 1, startFrame: start, endFrame: end };
    start = end;
    return shot;
  });
}

test('detectInterviewStart encuentra el primer plano largo al final', () => {
  const shots = shotsFromSeconds([7, 8, 6, 20, 15], 25);
  assert.equal(detectInterviewStart(shots, 25), 4);
});

test('detectInterviewStart respeta minSeconds', () => {
  const shots = shotsFromSeconds([7, 8, 13], 25);
  assert.equal(detectInterviewStart(shots, 25, 10.5), 3);
  // Con 14 s de umbral, el de 13 ya no cuenta como entrevista.
  assert.equal(detectInterviewStart(shots, 25, 14), null);
});

test('detectInterviewStart devuelve null si ningún corte es una entrevista', () => {
  assert.equal(detectInterviewStart(shotsFromSeconds([7, 8, 6], 25), 25), null);
});

test('detectInterviewStart con lista vacía devuelve null', () => {
  assert.equal(detectInterviewStart([], 25), null);
});

test('detectInterviewStart incluye los cortos finales en la entrevista', () => {
  const shots = shotsFromSeconds([8.4, 0.1, 16.4, 17, 19.5, 13.5, 7.2, 6.8], 25);
  assert.equal(detectInterviewStart(shots, 25), 3);
});

test('detectInterviewStart en empate elige menos entrevistas', () => {
  // [largo, corto]: k=0 y k=2 empatan; manda el k mayor, que no deja entrevistas.
  const shots = shotsFromSeconds([20, 5], 25);
  assert.equal(detectInterviewStart(shots, 25), null);
});

test('detectInterviewStart lanza RangeError con fps no positivo', () => {
  const shots = shotsFromSeconds([20], 25);
  for (const fps of [0, -25]) {
    assert.throws(() => detectInterviewStart(shots, fps), {
      name: 'RangeError',
      message: 'fps must be positive',
    });
  }
});

test('INTERVIEW_MIN_SECONDS vale 10.5 segundos', () => {
  assert.equal(INTERVIEW_MIN_SECONDS, 10.5);
});
