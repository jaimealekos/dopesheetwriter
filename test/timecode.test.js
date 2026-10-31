// Pruebas del módulo timecode: conversiones y formateo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  fpsFromRate,
  framesToSeconds,
  secondsToFrames,
  frameSeekTime,
  formatDuration,
  formatSoundbiteSeconds,
  formatShotSeconds,
  formatTimecode,
} from '../core/timecode.js';

test('fpsFromRate devuelve la base tal cual o ajustada a NTSC', () => {
  assert.equal(fpsFromRate(25, false), 25);
  assert.ok(Math.abs(fpsFromRate(30, true) - 29.97002997) < 1e-6);
});

test('framesToSeconds y secondsToFrames son coherentes', () => {
  assert.equal(framesToSeconds(4308, 25), 172.32);
  assert.equal(secondsToFrames(172.32, 25), 4308);
});

test('frameSeekTime apunta al centro del fotograma', () => {
  assert.ok(Math.abs(frameSeekTime(0, 25) - 0.02) < 1e-9);
  assert.ok(Math.abs(frameSeekTime(100, 25) - 4.02) < 1e-9);
});

test('formatDuration usa MM:SS con minutos sin límite', () => {
  assert.equal(formatDuration(172.32), '02:52');
  assert.equal(formatDuration(183.4), '03:03');
  assert.equal(formatDuration(0), '00:00');
  assert.equal(formatDuration(3599.6), '60:00');
});

test('formatSoundbiteSeconds redondea y añade el sufijo sec', () => {
  assert.equal(formatSoundbiteSeconds(584, 25), '23sec');
  assert.equal(formatSoundbiteSeconds(711, 25), '28sec');
  assert.equal(formatSoundbiteSeconds(278, 25), '11sec');
});

test('formatTimecode produce HH:MM:SS:FF sin pérdida de fotogramas', () => {
  assert.equal(formatTimecode(83.16, 25), '00:01:23:04');
  assert.equal(formatTimecode(0, 25), '00:00:00:00');
  assert.equal(formatTimecode(3661.04, 25), '01:01:01:01');
});

test('formatShotSeconds da la duración con un decimal', () => {
  assert.equal(formatShotSeconds(105, 25), '4.2s');
  assert.equal(formatShotSeconds(250, 25), '10.0s');
});

test('fps inválido lanza RangeError con el mensaje exacto', () => {
  for (const fps of [0, -25, NaN, Infinity]) {
    const expected = { name: 'RangeError', message: 'fps must be a positive number' };
    assert.throws(() => framesToSeconds(1, fps), expected);
    assert.throws(() => secondsToFrames(1, fps), expected);
    assert.throws(() => frameSeekTime(1, fps), expected);
    assert.throws(() => formatSoundbiteSeconds(1, fps), expected);
    assert.throws(() => formatShotSeconds(1, fps), expected);
    assert.throws(() => formatTimecode(1, fps), expected);
  }
});

test('valores negativos, NaN o infinito lanzan RangeError con el mensaje exacto', () => {
  const framesError = { name: 'RangeError', message: 'frames must be a finite number >= 0' };
  const secondsError = { name: 'RangeError', message: 'seconds must be a finite number >= 0' };
  for (const bad of [-1, NaN, Infinity]) {
    assert.throws(() => framesToSeconds(bad, 25), framesError);
    assert.throws(() => formatSoundbiteSeconds(bad, 25), framesError);
    assert.throws(() => formatShotSeconds(bad, 25), framesError);
    assert.throws(() => secondsToFrames(bad, 25), secondsError);
    assert.throws(() => formatDuration(bad), secondsError);
    assert.throws(() => formatTimecode(bad, 25), secondsError);
  }
});
