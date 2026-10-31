// Pruebas del módulo xml-shots: lectura de xmeml y comparación con la duración del vídeo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseXmeml, checkVideoMatch, XmlShotsError } from '../core/xml-shots.js';

// Envuelve pistas de vídeo y un rate/duration en un xmeml mínimo.
function buildXml({ timebase = '25', ntsc = 'FALSE', duration = '100', width = '1920', height = '1080', tracks }) {
  const tracksXml = tracks.map((track) => `<track>${track}</track>`).join('');
  return [
    '<!DOCTYPE xmeml>',
    '<xmeml version="4">',
    '<sequence id="seq-1">',
    `<rate><timebase>${timebase}</timebase><ntsc>${ntsc}</ntsc></rate>`,
    `<duration>${duration}</duration>`,
    '<media><video>',
    `<format><samplecharacteristics><width>${width}</width><height>${height}</height></samplecharacteristics></format>`,
    tracksXml,
    '</video><audio><track><clipitem><start>0</start><end>10</end></clipitem></track></audio></media>',
    '</sequence>',
    '</xmeml>',
  ].join('');
}

// Clip activo con start/end indicados.
function clip(start, end, { name = 'clip', enabled = 'TRUE' } = {}) {
  return `<clipitem><name>${name}</name><enabled>${enabled}</enabled><start>${start}</start><end>${end}</end></clipitem>`;
}

test('lee fps, totalFrames, dimensiones y cortes de V1 ignorando capas de ajuste', () => {
  const xml = buildXml({
    duration: '100',
    tracks: [
      clip(0, 40) + clip(40, 70) + clip(75, 100),
      clip(0, 100, { name: 'Capa de ajuste' }),
    ],
  });

  const parsed = parseXmeml(xml);

  assert.equal(parsed.fps, 25);
  assert.equal(parsed.timebase, 25);
  assert.equal(parsed.ntsc, false);
  assert.equal(parsed.totalFrames, 100);
  assert.equal(parsed.width, 1920);
  assert.equal(parsed.height, 1080);
  assert.equal(parsed.trackIndex, 0);
  assert.deepEqual(parsed.cuts, [
    { startFrame: 0, endFrame: 40 },
    { startFrame: 40, endFrame: 70 },
    { startFrame: 75, endFrame: 100 },
  ]);
  assert.deepEqual(parsed.warnings, []);
});

test('usa la primera pista de vídeo que tenga clips activos', () => {
  const xml = buildXml({
    tracks: [
      '<clipitem><name>Apagado</name><enabled>FALSE</enabled><start>0</start><end>100</end></clipitem>',
      clip(10, 50, { name: 'V2' }) + clip(50, 90, { name: 'V2b' }),
    ],
  });

  const parsed = parseXmeml(xml);

  assert.equal(parsed.trackIndex, 1);
  assert.deepEqual(parsed.cuts, [
    { startFrame: 10, endFrame: 50 },
    { startFrame: 50, endFrame: 90 },
  ]);
});

test('ignora los clips con enabled FALSE', () => {
  const xml = buildXml({
    tracks: [
      clip(0, 30) + clip(30, 60, { enabled: 'FALSE' }) + clip(60, 100),
    ],
  });

  const parsed = parseXmeml(xml);

  assert.deepEqual(parsed.cuts, [
    { startFrame: 0, endFrame: 30 },
    { startFrame: 60, endFrame: 100 },
  ]);
});

test('ntsc TRUE ajusta los fps a la base 1000/1001', () => {
  const xml = buildXml({ timebase: '30', ntsc: 'TRUE', tracks: [clip(0, 30)] });

  const parsed = parseXmeml(xml);

  assert.ok(Math.abs(parsed.fps - 29.97002997) < 1e-6);
  assert.equal(parsed.ntsc, true);
});

test('resuelve los -1 de transición y avisa una sola vez', () => {
  const xml = buildXml({
    duration: '100',
    tracks: [
      clip(0, 40) + clip(-1, 70) + clip(70, -1),
    ],
  });

  const parsed = parseXmeml(xml);

  assert.deepEqual(parsed.cuts, [
    { startFrame: 0, endFrame: 40 },
    { startFrame: 40, endFrame: 70 },
    { startFrame: 70, endFrame: 100 },
  ]);
  assert.deepEqual(parsed.warnings, [
    'Transitions found: cut positions near them are approximate.',
  ]);
});

test('ordena los clips desordenados, descarta los inválidos y avisa de solapes', () => {
  const xml = buildXml({
    duration: '100',
    tracks: [
      clip(50, 80) + clip(0, 30) + clip(20, 25) + clip(30, 50) + clip(90, 90),
    ],
  });

  const parsed = parseXmeml(xml);

  assert.deepEqual(parsed.cuts, [
    { startFrame: 0, endFrame: 30 },
    { startFrame: 20, endFrame: 25 },
    { startFrame: 30, endFrame: 50 },
    { startFrame: 50, endFrame: 80 },
  ]);
  assert.deepEqual(parsed.warnings, [
    'Overlapping clips found on the video track: check the edit.',
  ]);
});

test('parsea xmeml con DOCTYPE, atributos largos y la sequence dentro de project', () => {
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE xmeml>',
    '<xmeml version="4"><project><children>',
    '<sequence id="seq-9" TL.SQTrackShy="0" TL.SQTrackExpandedHeight="25">',
    '<rate><timebase>25</timebase><ntsc>FALSE</ntsc></rate>',
    '<duration>50</duration>',
    '<media><video><track><clipitem id="c1" premiereChannel="1">',
    '<name>Plano</name><enabled>TRUE</enabled><start>0</start><end>50</end>',
    '</clipitem></track></video></media>',
    '</sequence></children></project></xmeml>',
  ].join('');

  const parsed = parseXmeml(xml);

  assert.equal(parsed.totalFrames, 50);
  assert.deepEqual(parsed.cuts, [{ startFrame: 0, endFrame: 50 }]);
  assert.equal(parsed.width, 0);
  assert.equal(parsed.height, 0);
});

test('lanza XmlShotsError con el mensaje exacto en cada caso de error', () => {
  const cases = [
    ['', 'The file is not a valid XML. Export it again from the editor as "Final Cut Pro XML".'],
    ['no soy un xml', 'The file is not a valid XML. Export it again from the editor as "Final Cut Pro XML".'],
    ['<foo></foo>', 'The file is not a Final Cut / Premiere XML (xmeml).'],
    ['<xmeml><project><children></children></project></xmeml>', 'The XML has no sequence. Export the sequence, not the project bin.'],
    [
      '<xmeml><sequence><duration>10</duration><media><video><track>' +
        clip(0, 5) +
        '</track></video></media></sequence></xmeml>',
      'The XML sequence has no frame rate.',
    ],
    [
      '<xmeml><sequence><rate><timebase>0</timebase></rate><duration>10</duration>' +
        '<media><video><track></track></video></media></sequence></xmeml>',
      'The XML sequence has no frame rate.',
    ],
    [
      buildXml({ tracks: ['<clipitem><name>Apagado</name><enabled>FALSE</enabled><start>0</start><end>10</end></clipitem>'] }),
      'The XML has no video clips on any track.',
    ],
  ];

  for (const [xml, message] of cases) {
    assert.throws(() => parseXmeml(xml), (error) => {
      assert.ok(error instanceof XmlShotsError);
      assert.equal(error.message, message);
      return true;
    });
  }
});

test('checkVideoMatch calla si las duraciones coinciden dentro de la tolerancia', () => {
  const parsed = { fps: 25, totalFrames: 5922, timebase: 25, ntsc: false, width: 0, height: 0, trackIndex: 0, cuts: [], warnings: [] };

  assert.equal(checkVideoMatch(parsed, 236.88), null);
  assert.equal(checkVideoMatch(parsed, 237.8), null);
});

test('checkVideoMatch describe el desajuste con las dos duraciones', () => {
  const parsed = { fps: 25, totalFrames: 5922, timebase: 25, ntsc: false, width: 0, height: 0, trackIndex: 0, cuts: [], warnings: [] };

  assert.equal(
    checkVideoMatch(parsed, 250),
    'The XML sequence lasts 03:57 but the video lasts 04:10. Check that both files belong to the same edit.',
  );
});
