// Pruebas de main/transcribe.js con runProcess falso. Sin binarios reales ni red.
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildFfmpegArgs,
  buildWhisperArgs,
  createTranscriber,
  parseWhisperJson,
  resolveTranscriberPaths,
  transcriberStatus,
} from '../main/transcribe.js';

// Carpeta de herramientas con ficheros vacíos (o sin alguno) y carpeta temporal aparte.
async function makeEnv(t, { omit = [] } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'dsw-test-transcribe-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const paths = resolveTranscriberPaths(path.join(root, 'tools'));
  for (const [key, file] of Object.entries(paths)) {
    if (!omit.includes(key)) {
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, '');
    }
  }
  const tmpRoot = path.join(root, 'tmp');
  await mkdir(tmpRoot);
  return { paths, tmpRoot };
}

const SPEECH_JSON = {
  result: { language: 'es' },
  transcription: [{ text: ' Hola ' }, { text: '' }, { text: ' mundo.' }],
};

// runProcess falso: ffmpeg y whisper según las respuestas; whisper escribe el JSON en -of.
function makeRunner({ ffmpeg = { code: 0 }, whisper = { code: 0 }, json = SPEECH_JSON } = {}) {
  const calls = [];
  const runProcess = async (command, args, options) => {
    calls.push({ command, args, options });
    if (command.endsWith('ffmpeg.exe')) {
      if (ffmpeg instanceof Error) throw ffmpeg;
      return { stdout: '', stderr: '', ...ffmpeg };
    }
    if (whisper instanceof Error) throw whisper;
    if (whisper.code === 0) {
      await writeFile(`${args[args.indexOf('-of') + 1]}.json`, JSON.stringify(json));
    }
    return { stdout: '', stderr: '', ...whisper };
  };
  return { runProcess, calls };
}

test('resolveTranscriberPaths: une la base con cada fichero', () => {
  const paths = resolveTranscriberPaths('/base');
  assert.equal(paths.ffmpeg, path.join('/base', 'ffmpeg.exe'));
  assert.equal(paths.vadModel, path.join('/base', 'models/ggml-silero-v6.2.0.bin'));
});

test('transcriberStatus: lista en orden las rutas que no existen', async () => {
  const paths = { ffmpeg: 'a', whisper: 'b', model: 'c', vadModel: 'd' };
  const access = async (file) => {
    if (file === 'b' || file === 'd') throw new Error('ENOENT');
  };

  assert.deepEqual(await transcriberStatus(paths, { access }), {
    available: false,
    missing: ['b', 'd'],
  });
  assert.deepEqual(await transcriberStatus(paths, { access: async () => {} }), {
    available: true,
    missing: [],
  });
});

test('buildFfmpegArgs: -ss y -t antes de -i y acaba en el wav', () => {
  const args = buildFfmpegArgs('v.mp4', 1.5, 4, 'c.wav');

  assert.equal(args[args.indexOf('-ss') + 1], '1.500');
  assert.equal(args[args.indexOf('-t') + 1], '2.500');
  assert.ok(args.indexOf('-ss') < args.indexOf('-i'));
  assert.ok(args.indexOf('-t') < args.indexOf('-i'));
  assert.equal(args[args.indexOf('-i') + 1], 'v.mp4');
  assert.equal(args.at(-1), 'c.wav');
});

test('buildWhisperArgs: idioma automático, haz 5, VAD y salida JSON', () => {
  const paths = { model: 'm.bin', vadModel: 'v.bin' };
  const args = buildWhisperArgs(paths, 'c.wav', 'out', 3).join(' ');

  assert.match(args, /-m m\.bin -f c\.wav -l auto -t 3 -bs 5 --vad -vm v\.bin/);
  assert.match(args, /-vt 0\.5 -vspd 250 -vsd 2000 -vp 400 -oj -of out -np$/);
});

test('buildWhisperArgs: con idioma lleva -l fr; sin idioma, -l auto', () => {
  const paths = { model: 'm.bin', vadModel: 'v.bin' };
  const forced = buildWhisperArgs(paths, 'c.wav', 'out', 3, 'fr');
  assert.equal(forced[forced.indexOf('-l') + 1], 'fr');

  const automatic = buildWhisperArgs(paths, 'c.wav', 'out', 3);
  assert.equal(automatic[automatic.indexOf('-l') + 1], 'auto');
});

test('parseWhisperJson: une segmentos recortados y devuelve el idioma', () => {
  assert.deepEqual(parseWhisperJson(SPEECH_JSON), { text: 'Hola mundo.', language: 'es' });
  assert.deepEqual(
    parseWhisperJson({ result: { language: 'en' }, transcription: [{ text: ' Hello ' }, { text: ' world.' }] }),
    { text: 'Hello world.', language: 'en' },
  );
});

test('parseWhisperJson: idioma auto o ausente es null y sin transcription falla', () => {
  assert.equal(parseWhisperJson({ result: { language: 'auto' }, transcription: [] }).language, null);
  assert.equal(parseWhisperJson({ transcription: [] }).language, null);
  assert.throws(() => parseWhisperJson({}), { message: 'Unexpected transcriber output.' });
  assert.throws(() => parseWhisperJson({ transcription: 'x' }), { message: 'Unexpected transcriber output.' });
});

test('transcribe: devuelve texto e idioma y borra el temporal', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  const { runProcess, calls } = makeRunner();
  const transcriber = createTranscriber({ paths, runProcess, tmpRoot, threads: 2 });

  assert.deepEqual(await transcriber.transcribe('v.mp4', 1, 5), {
    text: 'Hola mundo.',
    language: 'es',
    languageName: 'Spanish',
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0].options, { timeoutMs: 600000 });
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('transcribe: con idioma forzado manda el pedido aunque el JSON diga otro', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  const { runProcess, calls } = makeRunner();
  const transcriber = createTranscriber({ paths, runProcess, tmpRoot, threads: 2 });

  assert.deepEqual(await transcriber.transcribe('v.mp4', 1, 5, 'fr'), {
    text: 'Hola mundo.',
    language: 'fr',
    languageName: 'French',
  });
  const whisper = calls[1].args;
  assert.equal(whisper[whisper.indexOf('-l') + 1], 'fr');
});

test('transcribe: un idioma desconocido es RangeError sin lanzar procesos', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  const { runProcess, calls } = makeRunner();
  const transcriber = createTranscriber({ paths, runProcess, tmpRoot });

  await assert.rejects(transcriber.transcribe('v.mp4', 0, 5, 'xx'), {
    name: 'RangeError',
    message: 'Unsupported transcription language: xx.',
  });
  assert.equal(calls.length, 0);
});

test('transcribe: ffmpeg sin pista de audio da el error específico y limpia', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  const { runProcess } = makeRunner({
    ffmpeg: { code: 1, stderr: "Stream map '0:a:0' matches no streams.\n" },
  });
  const transcriber = createTranscriber({ paths, runProcess, tmpRoot });

  await assert.rejects(transcriber.transcribe('v.mp4', 0, 5), {
    message: 'This video has no audio track to transcribe.',
  });
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('transcribe: ffmpeg y whisper con error informan la última línea de stderr', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);

  const ffmpegFails = makeRunner({ ffmpeg: { code: 1, stderr: 'primera\nboom\n\n' } });
  await assert.rejects(
    createTranscriber({ paths, runProcess: ffmpegFails.runProcess, tmpRoot }).transcribe('v.mp4', 0, 5),
    { message: 'Could not extract the audio of this cut (ffmpeg: boom).' },
  );

  const whisperFails = makeRunner({ whisper: { code: 3, stderr: 'fallo del modelo' } });
  await assert.rejects(
    createTranscriber({ paths, runProcess: whisperFails.runProcess, tmpRoot }).transcribe('v.mp4', 0, 5),
    { message: 'The transcriber failed (fallo del modelo).' },
  );
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('transcribe: falta una herramienta y no se lanza ningún proceso', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t, { omit: ['model'] });
  const { runProcess, calls } = makeRunner();
  const transcriber = createTranscriber({ paths, runProcess, tmpRoot });

  await assert.rejects(transcriber.transcribe('v.mp4', 0, 5), (error) => {
    assert.match(error.message, /^Transcription is not installed: missing /);
    assert.ok(error.message.includes(paths.model));
    assert.match(error.message, /Reinstall Dopesheet Writer\.$/);
    return true;
  });
  assert.equal(calls.length, 0);
});

test('transcribe: una sola a la vez y se puede repetir al acabar', { timeout: 5000 }, async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const inner = makeRunner();
  const runProcess = async (command, args, options) => {
    await gate;
    return inner.runProcess(command, args, options);
  };
  const transcriber = createTranscriber({ paths, runProcess, tmpRoot });

  const first = transcriber.transcribe('v.mp4', 0, 5);
  try {
    await assert.rejects(transcriber.transcribe('v.mp4', 0, 5), {
      message: 'Another cut is being transcribed. Wait for it to finish.',
    });
  } finally {
    release();
  }
  assert.equal((await first).text, 'Hola mundo.');
  assert.equal((await transcriber.transcribe('v.mp4', 0, 5)).text, 'Hola mundo.');
});

test('transcribe: rangos inválidos son RangeError y más de 600 s es error de longitud', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  const { runProcess, calls } = makeRunner();
  const transcriber = createTranscriber({ paths, runProcess, tmpRoot });

  for (const [start, end] of [[5, 5], [6, 5], [-1, 4], [NaN, 4], [0, Infinity]]) {
    await assert.rejects(transcriber.transcribe('v.mp4', start, end), RangeError);
  }
  await assert.rejects(transcriber.transcribe('', 0, 5), RangeError);
  await assert.rejects(transcriber.transcribe('v.mp4', 0, 601), {
    message: 'The cut is too long to transcribe (max 10 minutes).',
  });
  assert.equal(calls.length, 0);
});

test('transcribe: tiempo agotado en cualquiera de los procesos se informa', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);

  for (const failing of [
    { ffmpeg: Object.assign(new Error('x'), { killed: true }) },
    { whisper: Object.assign(new Error('x'), { code: 'ETIMEDOUT' }) },
  ]) {
    const { runProcess } = makeRunner(failing);
    await assert.rejects(createTranscriber({ paths, runProcess, tmpRoot }).transcribe('v.mp4', 0, 5), {
      message: 'Transcription took too long and was stopped.',
    });
  }
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('transcribe: sin habla da error y un idioma desconocido da languageName null', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);

  const silent = makeRunner({ json: { result: { language: 'es' }, transcription: [{ text: '  ' }] } });
  await assert.rejects(
    createTranscriber({ paths, runProcess: silent.runProcess, tmpRoot }).transcribe('v.mp4', 0, 5),
    { message: 'No speech found in this cut.' },
  );

  const odd = makeRunner({ json: { result: { language: 'xx' }, transcription: [{ text: 'hi' }] } });
  assert.deepEqual(
    await createTranscriber({ paths, runProcess: odd.runProcess, tmpRoot }).transcribe('v.mp4', 0, 5),
    { text: 'hi', language: 'xx', languageName: null },
  );
});

test('transcribe: JSON de whisper ausente o mal formado es salida inesperada', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  const runProcess = async (command) => ({ code: 0, stdout: '', stderr: '', command });

  await assert.rejects(createTranscriber({ paths, runProcess, tmpRoot }).transcribe('v.mp4', 0, 5), {
    message: 'Unexpected transcriber output.',
  });

  const badJson = async (command, args) => {
    if (!command.endsWith('ffmpeg.exe')) {
      await writeFile(`${args[args.indexOf('-of') + 1]}.json`, '{no json');
    }
    return { code: 0, stdout: '', stderr: '' };
  };
  await assert.rejects(createTranscriber({ paths, runProcess: badJson, tmpRoot }).transcribe('v.mp4', 0, 5), {
    message: 'Unexpected transcriber output.',
  });
  assert.deepEqual(await readdir(tmpRoot), []);
});

test('transcribe: superar maxBuffer no se informa como tiempo agotado', async (t) => {
  const { paths, tmpRoot } = await makeEnv(t);
  const { runProcess } = makeRunner({
    whisper: Object.assign(new Error('maxBuffer'), { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', killed: true }),
  });

  await assert.rejects(createTranscriber({ paths, runProcess, tmpRoot }).transcribe('v.mp4', 0, 5), {
    message: 'A transcription process produced too much output and was stopped.',
  });
});
