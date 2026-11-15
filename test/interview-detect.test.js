// Pruebas de la detección de entrevistas (duración, voz, avisos y estimación) (función pura, sin red ni DOM).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  detectInterviewStart,
  estimateTranscriptionSeconds,
  formatEstimate,
  interviewNotes,
  looksLikeInterview,
  voiceFractions,
} from '../core/interview-detect.js';
import { INTERVIEW_MIN_SECONDS, INTERVIEW_MIN_VOICE } from '../core/config.js';

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

// --- Fracción de voz por corte ---

test('voiceFractions mide la unión de segmentos solapados', () => {
  const shots = [{ startFrame: 0, endFrame: 250 }]; // 0–10 s a 25 fps
  const fractions = voiceFractions(shots, 25, [
    { start: 3, end: 6 },
    { start: 2, end: 4 },
  ]);
  assert.equal(fractions.length, 1);
  assert.ok(Math.abs(fractions[0] - 0.4) < 1e-9);
});

test('voiceFractions solo cuenta la parte del segmento dentro del corte', () => {
  const shots = [{ startFrame: 250, endFrame: 500 }]; // 10–20 s a 25 fps
  const fractions = voiceFractions(shots, 25, [
    { start: 5, end: 12 },
    { start: 18, end: 30 },
  ]);
  assert.ok(Math.abs(fractions[0] - 0.4) < 1e-9);
});

test('voiceFractions devuelve 0 con corte de duración 0', () => {
  assert.deepEqual(voiceFractions([{ startFrame: 75, endFrame: 75 }], 25, [{ start: 0, end: 10 }]), [0]);
});

test('voiceFractions devuelve todo 0 sin segmentos', () => {
  const shots = [
    { startFrame: 0, endFrame: 250 },
    { startFrame: 250, endFrame: 500 },
  ];
  assert.deepEqual(voiceFractions(shots, 25, []), [0, 0]);
});

test('voiceFractions lanza RangeError con fps no positivo', () => {
  for (const fps of [0, -25]) {
    assert.throws(() => voiceFractions([], fps, []), {
      name: 'RangeError',
      message: 'fps must be positive',
    });
  }
});

// --- ¿Parece entrevista? ---

test('looksLikeInterview exige duración mínima y voz suficiente', () => {
  assert.equal(looksLikeInterview(12, null), true);
  assert.equal(looksLikeInterview(12, 0.85), true);
  assert.equal(looksLikeInterview(12, 0.1), false);
  assert.equal(looksLikeInterview(8, null), false);
  assert.equal(looksLikeInterview(12, 0.5, 10.5, 0.6), false);
  assert.equal(looksLikeInterview(12, 0.6, 10.5, 0.6), true);
});

test('INTERVIEW_MIN_VOICE vale 0.3', () => {
  assert.equal(INTERVIEW_MIN_VOICE, 0.3);
});

// --- Detección con voces ---

test('detectInterviewStart descarta un corte largo sin voz', () => {
  const shots = shotsFromSeconds([7, 8, 13, 20, 15], 25);
  assert.equal(detectInterviewStart(shots, 25, INTERVIEW_MIN_SECONDS, [0, 0, 0.02, 0.9, 0.85]), 4);
  assert.equal(detectInterviewStart(shots, 25), 3);
});

test('detectInterviewStart devuelve null si los cortes largos no tienen voz', () => {
  const shots = shotsFromSeconds([7, 20, 15], 25);
  assert.equal(detectInterviewStart(shots, 25, INTERVIEW_MIN_SECONDS, [0, 0.01, 0]), null);
  assert.equal(detectInterviewStart(shots, 25), 2);
});

test('detectInterviewStart lanza RangeError si voices no mide como shots', () => {
  const shots = shotsFromSeconds([7, 8], 25);
  assert.throws(() => detectInterviewStart(shots, 25, INTERVIEW_MIN_SECONDS, [0]), {
    name: 'RangeError',
    message: 'voices must match shots',
  });
});

// --- Avisos del límite ---

test('interviewNotes avisa de un largo fuera y una voz baja dentro', () => {
  const shots = shotsFromSeconds([12, 8, 20, 15], 25);
  assert.deepEqual(interviewNotes(shots, 25, 3, [0.8, 0, 0.9, 0.1]), [
    { kind: 'long-image', number: 1, seconds: 12, voice: 0.8 },
    { kind: 'low-voice', number: 4, seconds: 15, voice: 0.1 },
  ]);
  assert.deepEqual(interviewNotes(shots, 25, 3), [
    { kind: 'long-image', number: 1, seconds: 12, voice: null },
  ]);
});

test('interviewNotes devuelve la lista ordenada por número', () => {
  const shots = shotsFromSeconds([12, 20, 8], 25);
  assert.deepEqual(interviewNotes(shots, 25, 2, [0.5, 0.1, 0.5]).map((note) => note.number), [1, 2]);
});

test('interviewNotes lanza RangeError con fps no positivo o voices descuadrado', () => {
  const shots = shotsFromSeconds([12], 25);
  assert.throws(() => interviewNotes(shots, 0, 1), {
    name: 'RangeError',
    message: 'fps must be positive',
  });
  assert.throws(() => interviewNotes(shots, 25, 1, []), {
    name: 'RangeError',
    message: 'voices must match shots',
  });
});

// --- Estimación de transcripción ---

test('estimateTranscriptionSeconds suma fijo más proporcional', () => {
  const seconds = estimateTranscriptionSeconds([20, 60]);
  assert.ok(Math.abs(seconds - 35.8) < 1e-9);
});

test('estimateTranscriptionSeconds de una lista vacía es 0', () => {
  assert.equal(estimateTranscriptionSeconds([]), 0);
});

test('formatEstimate escribe la estimación en minutos', () => {
  assert.equal(formatEstimate(0), '');
  assert.equal(formatEstimate(35.8), 'under 1 min');
  assert.equal(formatEstimate(150), '≈ 3 min');
  assert.equal(formatEstimate(60), '≈ 1 min');
  assert.equal(formatEstimate(90), '≈ 2 min');
});
