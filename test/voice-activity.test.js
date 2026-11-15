// Pruebas de main/voice-activity.js con runProcess falso. Sin binarios reales ni red.
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { VOICE_TIMEOUT_MS } from '../core/config.js';

import {
  buildVoiceFfmpegArgs,
  buildVoiceToolArgs,
  createVoiceDetector,
  parseVoiceSegments,
} from '../main/voice-activity.js';

const PATHS = {
  ffmpeg: '/tools/ffmpeg.exe',
  whisper: '/tools/whisper/whisper-cli.exe',
  model: '/tools/models/model.bin',
  vadModel: '/tools/models/vad.bin',
  voiceTool: '/tools/whisper/whisper-vad-speech-segments.exe',
};

const OUTPUT = [
  'Detected 2 speech segments:',
  'Speech segment 0: start = 30.00, end = 412.00',
  'Speech segment 1: start = 4730.00, end = 5107.00',
  '',
].join('\n');

// Carpeta temporal aislada para comprobar que detect la borra siempre.
async function makeTmpRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), 'dsw-test-voice-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const tmpRoot = path.join(root, 'tmp');
  await mkdir(tmpRoot);
  return { tmpRoot };
}

// runProcess falso: ffmpeg y herramienta de voz según las respuestas.
function makeRunner({ ffmpeg = {}, tool = { stdout: OUTPUT } } = {}) {
  const calls = [];
  const runProcess = async (command, args, options) => {
    calls.push({ command, args, options });
    const behaviour = command === PATHS.ffmpeg ? ffmpeg : tool;
    if (behaviour instanceof Error) {
      throw behaviour;
    }
    return { code: 0, stdout: '', stderr: '', ...behaviour };
  };
  return { runProcess, calls };
}

test('buildVoiceFfmpegArgs: extrae el audio entero a wav mono 16 kHz', () => {
  assert.deepEqual(buildVoiceFfmpegArgs('v.mp4', 'a.wav'), [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-i', 'v.mp4',
    '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
    '-y', 'a.wav',
  ]);
});

test('buildVoiceToolArgs: umbrales de VOICE_VAD y salida plana', () => {
  assert.deepEqual(buildVoiceToolArgs(PATHS, 'a.wav', 3), [
    '-np', '-t', '3',
    '-vm', PATHS.vadModel,
    '-vt', '0.5',
    '-vspd', '250',
    '-vsd', '100',
    '-vp', '30',
    '-f', 'a.wav',
  ]);
});

test('parseVoiceSegments: centisegundos a segundos e ignora otras líneas', () => {
  assert.deepEqual(parseVoiceSegments(OUTPUT), [
    { start: 0.3, end: 4.12 },
    { start: 47.3, end: 51.07 },
  ]);
  assert.deepEqual(parseVoiceSegments('Detected 0 speech segments:\n'), []);
  assert.deepEqual(parseVoiceSegments(''), []);
});

test('parseVoiceSegments: un final anterior al inicio es salida inesperada', () => {
  assert.throws(() => parseVoiceSegments('Speech segment 0: start = 500, end = 100'), {
    message: 'Unexpected voice detector output.',
  });
});

test('detect: ffmpeg y herramienta con los argumentos exactos y limpia el temporal', async (t) => {
  const { tmpRoot } = await makeTmpRoot(t);
  const { runProcess, calls } = makeRunner();
  const detector = createVoiceDetector({ paths: PATHS, runProcess, tmpRoot, threads: 3 });

  assert.deepEqual(await detector.detect('/videos/v.mp4'), [
    { start: 0.3, end: 4.12 },
    { start: 47.3, end: 51.07 },
  ]);

  assert.equal(calls.length, 2);
  const wavPath = calls[0].args.at(-1);
  assert.equal(calls[0].command, PATHS.ffmpeg);
  assert.deepEqual(calls[0].args, buildVoiceFfmpegArgs('/videos/v.mp4', wavPath));
  assert.deepEqual(calls[0].options, { timeoutMs: VOICE_TIMEOUT_MS });
  assert.equal(path.basename(wavPath), 'voice.wav');
  assert.match(path.basename(path.dirname(wavPath)), /^dsw-voice-/);
  assert.ok(path.dirname(wavPath).startsWith(tmpRoot));
  assert.equal(calls[1].command, PATHS.voiceTool);
  assert.deepEqual(calls[1].args, buildVoiceToolArgs(PATHS, wavPath, 3));
  assert.deepEqual(calls[1].options, { timeoutMs: VOICE_TIMEOUT_MS });
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('detect: una ruta vacía es TypeError y no lanza procesos', async (t) => {
  const { tmpRoot } = await makeTmpRoot(t);
  const { runProcess, calls } = makeRunner();
  const detector = createVoiceDetector({ paths: PATHS, runProcess, tmpRoot });

  await assert.rejects(detector.detect(''), {
    name: 'TypeError',
    message: 'A video path is required.',
  });
  assert.equal(calls.length, 0);
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('detect: ffmpeg sin pista de audio da el error específico y limpia', async (t) => {
  const { tmpRoot } = await makeTmpRoot(t);
  const { runProcess } = makeRunner({
    ffmpeg: { code: 1, stderr: "Stream map '0:a:0' matches no streams.\n" },
  });
  const detector = createVoiceDetector({ paths: PATHS, runProcess, tmpRoot });

  await assert.rejects(detector.detect('v.mp4'), {
    message: 'This video has no audio track.',
  });
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('detect: ffmpeg con error informa su última línea y limpia', async (t) => {
  const { tmpRoot } = await makeTmpRoot(t);
  const { runProcess } = makeRunner({ ffmpeg: { code: 1, stderr: 'primera\nboom\n\n' } });
  const detector = createVoiceDetector({ paths: PATHS, runProcess, tmpRoot });

  await assert.rejects(detector.detect('v.mp4'), {
    message: 'Could not extract the audio (ffmpeg: boom).',
  });
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('detect: la herramienta con error informa su última línea y limpia', async (t) => {
  const { tmpRoot } = await makeTmpRoot(t);
  const { runProcess } = makeRunner({ tool: { code: 2, stderr: 'fallo del detector' } });
  const detector = createVoiceDetector({ paths: PATHS, runProcess, tmpRoot });

  await assert.rejects(detector.detect('v.mp4'), {
    message: 'The voice detector failed (fallo del detector).',
  });
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('detect: tiempo agotado en cualquiera de los procesos se informa y limpia', async (t) => {
  const { tmpRoot } = await makeTmpRoot(t);

  for (const failing of [
    { ffmpeg: Object.assign(new Error('x'), { killed: true }) },
    { tool: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) },
  ]) {
    const { runProcess } = makeRunner(failing);
    const detector = createVoiceDetector({ paths: PATHS, runProcess, tmpRoot });
    await assert.rejects(detector.detect('v.mp4'), {
      message: 'Voice detection took too long and was stopped.',
    });
    assert.deepEqual(await readdir(tmpRoot), []);
  }
});
