// Pruebas de integración sin Electron ni red:
// (a) núcleo de punta a punta: XML sintético → createShots → anotar → buildShotlist;
// (b) storage + shot-model: anotaciones → borrador → recarga.
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseXmeml, checkVideoMatch } from '../core/xml-shots.js';
import {
  createShots,
  updateShot,
  setInterview,
  exportAnnotations,
  applyAnnotations,
  progress,
  validateForExport,
} from '../core/shot-model.js';
import { buildShotlist } from '../core/shotlist-format.js';
import { createStorage } from '../main/storage.js';

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'montaje.xml',
);

// Anotaciones de ejemplo sobre los cuatro cortes del fixture: dos planos y dos
// entrevistas, con las cifras que documenta el módulo shotlist-format.
function annotate(cuts) {
  let shots = createShots(cuts);
  shots = updateShot(shots, 1, { size: 'Wide shot', description: 'Tractors march' });
  shots = updateShot(shots, 2, {
    size: 'Wide shot',
    movement: 'Pan right',
    description: 'General view',
  });
  shots = setInterview(shots, 3, true);
  shots = updateShot(shots, 3, {
    soundbite: {
      name: 'Vicente Aragón',
      profession: 'Vineyard farmer from Tarancón',
      age: '33',
      language: 'Spanish',
      gender: 'man',
      translation: 'We are suffering an unfair competition.',
      original: 'Tenemos una competencia desleal.',
    },
  });
  shots = updateShot(shots, 4, {
    soundbite: {
      name: 'Milagros Muñoz',
      gender: 'woman',
      translation: 'Translation two.',
      original: 'Original dos.',
    },
  });
  return shots;
}

const HEADER = { location: 'MADRID, SPAIN', date: 'MARCH 17, 2024', source: 'AFPTV' };

test('núcleo de punta a punta: XML → planos → anotaciones → shotlist exacto', async () => {
  const xml = await readFile(FIXTURE, 'utf8');
  const parsed = parseXmeml(xml);

  assert.equal(parsed.fps, 25);
  assert.equal(parsed.totalFrames, 1520);
  assert.deepEqual(parsed.cuts, [
    { startFrame: 0, endFrame: 100 },
    { startFrame: 100, endFrame: 225 },
    { startFrame: 225, endFrame: 809 },
    { startFrame: 809, endFrame: 1520 },
  ]);
  assert.equal(checkVideoMatch(parsed, 1520 / 25), null);
  assert.ok(checkVideoMatch(parsed, 200) !== null);

  const shots = annotate(parsed.cuts);
  assert.deepEqual(progress(shots), { done: 4, total: 4 });
  assert.equal(validateForExport(shots).ok, true);

  const text = buildShotlist({ header: HEADER, shots, fps: parsed.fps });

  const expected = [
    'SHOTLIST',
    'MADRID, SPAIN',
    'MARCH 17, 2024',
    'SOURCE: AFPTV',
    '',
    'IMAGES (00:09)',
    '',
    '1. Wide shot - Tractors march',
    '2. Wide shot, pan right - General view',
    '',
    '',
    '3. SOUNDBITE 1 - Vicente Aragón, Vineyard farmer from Tarancón, 33 years (Spanish, man, 23sec):',
    '',
    '"We are suffering an unfair competition."',
    '',
    '"Tenemos una competencia desleal."',
    '',
    '',
    '4. SOUNDBITE 2 - Milagros Muñoz (Spanish, woman, 28sec):',
    '',
    '"Translation two."',
    '',
    '"Original dos."',
    '',
  ].join('\n');

  assert.equal(text, expected);
});

test('storage + shot-model: anotaciones → borrador → recarga', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dopesheet-integration-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const storage = createStorage(dir);
  const videoPath = path.join(dir, 'Mani tractores.mp4');

  const cuts = [
    { startFrame: 0, endFrame: 100 },
    { startFrame: 100, endFrame: 225 },
    { startFrame: 225, endFrame: 809 },
    { startFrame: 809, endFrame: 1520 },
  ];
  const shots = annotate(cuts);
  const draft = { annotations: exportAnnotations(shots), header: HEADER };

  await storage.saveDraft(videoPath, draft);
  const loaded = await storage.loadDraft(videoPath);
  assert.deepEqual(loaded, draft);

  // La recarga sobre planos nuevos reproduce exactamente el estado anotado.
  const reloaded = applyAnnotations(createShots(cuts), loaded.annotations);
  assert.deepEqual(reloaded, shots);

  // Otro vídeo no comparte borrador.
  assert.equal(await storage.loadDraft(path.join(dir, 'otro.mp4')), null);
});

test('soundbite traducido: la traducción entra por updateShot y sale en el texto exacto', async () => {
  const parsed = parseXmeml(await readFile(FIXTURE, 'utf8'));
  let shots = createShots(parsed.cuts.slice(0, 3));
  shots = updateShot(shots, 1, { size: 'Close-up', movement: 'Tilt up', description: 'Hands on the wheel' });
  shots = updateShot(shots, 2, { size: 'Wide shot', description: 'General view' });
  shots = setInterview(shots, 3, true);
  shots = updateShot(shots, 3, {
    soundbite: {
      name: 'Vicente Aragón',
      age: '1',
      language: 'Spanish',
      gender: 'man',
      original: 'Tenemos una competencia\ndesleal.',
    },
  });

  // Sin traducir, el bloque solo lleva el original.
  const untranslated = buildShotlist({ header: HEADER, shots, fps: parsed.fps });
  assert.ok(!untranslated.includes('unfair'));
  assert.ok(untranslated.endsWith('"Tenemos una competencia desleal."\n'));

  // Lo que hace el botón Translate: un parche de la traducción sobre el mismo plano.
  shots = updateShot(shots, 3, { soundbite: { translation: '"We are suffering\nan unfair competition."' } });
  shots = updateShot(shots, 3, { soundbite: { translation: 'We are suffering an unfair competition.' } });

  assert.deepEqual(progress(shots), { done: 3, total: 3 });
  const text = buildShotlist({ header: HEADER, shots, fps: parsed.fps });
  const expected = [
    'SHOTLIST',
    'MADRID, SPAIN',
    'MARCH 17, 2024',
    'SOURCE: AFPTV',
    '',
    'IMAGES (00:09)',
    '',
    '1. Close-up, tilt up - Hands on the wheel',
    '2. Wide shot - General view',
    '',
    '',
    '3. SOUNDBITE 1 - Vicente Aragón, 1 year (Spanish, man, 23sec):',
    '',
    '"We are suffering an unfair competition."',
    '',
    '"Tenemos una competencia desleal."',
    '',
  ].join('\n');
  assert.equal(text, expected);
});
