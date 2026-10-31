// Pruebas de setup-panel: solo las funciones puras y la importación del módulo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyFile,
  classifyDrop,
  baseName,
  headerErrors,
  videoMeta,
  xmlMeta,
} from '../renderer/setup-panel.js';

test('classifyFile reconoce las extensiones de vídeo y xml sin distinguir mayúsculas', () => {
  assert.equal(classifyFile('a.mp4'), 'video');
  assert.equal(classifyFile('A.MOV'), 'video');
  assert.equal(classifyFile('b.M4V'), 'video');
  assert.equal(classifyFile('c.XML'), 'xml');
  assert.equal(classifyFile('d.txt'), null);
  assert.equal(classifyFile('sin-extension'), null);
});

test('classifyDrop se queda con el primer vídeo y el primer xml y rechaza el resto', () => {
  const a = { name: 'a.mp4' };
  const b = { name: 'b.xml' };
  const result = classifyDrop([a, { name: 'c.mov' }, b, { name: 'd.txt' }]);
  assert.equal(result.video, a);
  assert.equal(result.xml, b);
  assert.deepEqual(result.rejected, ['c.mov', 'd.txt']);
});

test('classifyDrop sin ficheros válidos devuelve null y todos rechazados', () => {
  const result = classifyDrop([{ name: 'nota.txt' }]);
  assert.equal(result.video, null);
  assert.equal(result.xml, null);
  assert.deepEqual(result.rejected, ['nota.txt']);
});

test('baseName extrae el último componente con / o \\', () => {
  assert.equal(baseName('F:\\x\\y\\v.mp4'), 'v.mp4');
  assert.equal(baseName('/a/b/c.xml'), 'c.xml');
});

test('headerErrors exige location, date y source', () => {
  assert.deepEqual(headerErrors({ location: '', date: '   ', source: '' }), {
    location: 'Enter the location.',
    date: 'Enter the date, e.g. MARCH 11, 2026.',
    source: 'Enter the source.',
  });
  assert.deepEqual(headerErrors({ location: 'MADRID', date: 'MARCH 11, 2026', source: 'AFPTV' }), {});
});

test('headerErrors solo incluye las claves con error', () => {
  assert.deepEqual(headerErrors({ location: 'MADRID', date: 'MARCH 11, 2026', source: '  ' }), {
    source: 'Enter the source.',
  });
});

test('videoMeta compone timecode, resolución y fps', () => {
  assert.equal(
    videoMeta({ duration: 192.2, width: 1920, height: 1080, fps: 25 }),
    '00:03:12:05 · 1920×1080 · 25 fps',
  );
  assert.ok(videoMeta({ duration: 192.2, width: 1920, height: 1080, fps: 29.97002997 })
    .endsWith('1920×1080 · 29.97 fps'));
});

test('xmlMeta compone planos, fps y timecode, con shot en singular', () => {
  assert.equal(
    xmlMeta({ shots: 26, fps: 25, totalFrames: 4805 }),
    '26 shots · 25 fps · 00:03:12:05',
  );
  assert.equal(
    xmlMeta({ shots: 1, fps: 25, totalFrames: 4805 }),
    '1 shot · 25 fps · 00:03:12:05',
  );
});
