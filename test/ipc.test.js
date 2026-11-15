// Pruebas de los manejadores IPC (main/ipc.js). Sin Electron y sin red.
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { registerIpc } from '../main/ipc.js';

// Dobles de storage para las dependencias que no tocan disco.
function makeStorage() {
  return {
    findSiblingXml: async () => null,
    loadSettings: async () => ({ location: 'MADRID, SPAIN', source: '' }),
    saveSettings: async () => {},
    loadDraft: async () => null,
    saveDraft: async () => {},
    shotlistExists: async () => false,
    outputPathFor: () => '/tmp/video.txt',
    writeShotlist: async () => '/tmp/video.txt',
  };
}

// Registra el módulo con dobles y devuelve el mapa de canales para invocarlos.
function setup({ dialogResult, storage, ...rest } = {}) {
  const handlers = new Map();
  const openDialogCalls = [];
  const shownInFolder = [];

  registerIpc({
    ipcMain: { handle: (channel, fn) => handlers.set(channel, fn) },
    dialog: {
      async showOpenDialog(...args) {
        openDialogCalls.push(args);
        return dialogResult ?? { canceled: false, filePaths: ['/tmp/video.mp4'] };
      },
    },
    shell: { showItemInFolder: (target) => shownInFolder.push(target) },
    storage: { ...makeStorage(), ...storage },
    parseXmeml: (xmlText) => ({ parsed: xmlText }),
    readFile: async () => '<xmeml/>',
    getWindow: () => undefined,
    translateText: async (text) => ({ text, provider: 'google' }),
    transcriber: { transcribe: async () => ({ text: '', language: null, languageName: null }) },
    transcriberStatus: async () => ({ available: true, missing: [], voiceAvailable: false }),
    voiceDetector: { detect: async () => [] },
    adjustWindowWidth: (delta) => delta,
    ...rest,
  });

  return {
    handlers,
    invoke: (channel, ...args) => handlers.get(channel)({}, ...args),
    openDialogCalls,
    shownInFolder,
  };
}

// El contrato usa dos aridades según haya ventana padre; las opciones son el último argumento.
function dialogOptions(call) {
  return call[call.length - 1];
}

test('registerIpc: registra exactamente los 18 canales de la tabla', () => {
  const { handlers } = setup();

  assert.equal(handlers.size, 18);
  assert.deepEqual(
    [...handlers.keys()].sort(),
    [
      'dsw:adjustWindowWidth',
      'dsw:fileExists',
      'dsw:findSiblingXml',
      'dsw:loadDraft',
      'dsw:loadSettings',
      'dsw:loadXml',
      'dsw:outputPathFor',
      'dsw:pickFile',
      'dsw:saveDraft',
      'dsw:saveSettings',
      'dsw:shotlistExists',
      'dsw:showInFolder',
      'dsw:transcribe',
      'dsw:transcriberStatus',
      'dsw:translate',
      'dsw:videoUrl',
      'dsw:voiceActivity',
      'dsw:writeShotlist',
    ],
  );
});

test('dsw:pickFile: devuelve la ruta elegida con el filtro de vídeo', async () => {
  const { invoke, openDialogCalls } = setup();

  assert.deepEqual(await invoke('dsw:pickFile', 'video'), {
    ok: true,
    value: '/tmp/video.mp4',
  });
  assert.deepEqual(dialogOptions(openDialogCalls[0]), {
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v'] }],
  });
});

test('dsw:pickFile: cancelado devuelve null y xml usa su filtro', async () => {
  const { invoke, openDialogCalls } = setup({ dialogResult: { canceled: true, filePaths: [] } });

  assert.deepEqual(await invoke('dsw:pickFile', 'xml'), { ok: true, value: null });
  assert.deepEqual(dialogOptions(openDialogCalls[0]), {
    filters: [{ name: 'Xml', extensions: ['xml'] }],
  });
});

test('dsw:pickFile: kind desconocido devuelve el error exacto y no abre diálogo', async () => {
  const { invoke, openDialogCalls } = setup();

  assert.deepEqual(await invoke('dsw:pickFile', 'audio'), {
    ok: false,
    error: 'Unknown file kind: audio.',
  });
  assert.equal(openDialogCalls.length, 0);
});

test('dsw:pickFile: usa la ventana como padre del diálogo', async () => {
  const window = { id: 1 };
  const { invoke, openDialogCalls } = setup({ getWindow: () => window });

  await invoke('dsw:pickFile', 'video');

  assert.equal(openDialogCalls[0][0], window);
  assert.deepEqual(openDialogCalls[0][1], {
    filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v'] }],
  });
});

test('dsw:loadXml: lee en utf8 y devuelve lo que devuelve parseXmeml', async () => {
  const reads = [];
  const { invoke } = setup({
    readFile: async (filePath, encoding) => {
      reads.push([filePath, encoding]);
      return '<xmeml>ok</xmeml>';
    },
    parseXmeml: (xmlText) => ({ shots: [], xmlText }),
  });

  assert.deepEqual(await invoke('dsw:loadXml', 'C:/montaje.xml'), {
    ok: true,
    value: { shots: [], xmlText: '<xmeml>ok</xmeml>' },
  });
  assert.deepEqual(reads, [['C:/montaje.xml', 'utf8']]);
});

test('dsw:loadXml: si parseXmeml lanza, devuelve { ok: false, error }', async () => {
  const { invoke } = setup({
    parseXmeml: () => {
      throw new Error('XML inválido.');
    },
  });

  assert.deepEqual(await invoke('dsw:loadXml', 'C:/montaje.xml'), {
    ok: false,
    error: 'XML inválido.',
  });
});

test('dsw:videoUrl: devuelve una URL file con la ruta escapada', async () => {
  const { invoke } = setup();
  const videoPath = process.platform === 'win32' ? 'F:\\a b\\v.mp4' : '/tmp/a b/v.mp4';

  const result = await invoke('dsw:videoUrl', videoPath);

  assert.equal(result.ok, true);
  assert.match(result.value, /^file:\/\/\//);
  assert.match(result.value, /%20/);
  assert.match(result.value, /v\.mp4$/);
});

test('dsw:writeShotlist y dsw:saveDraft delegan en storage con los mismos argumentos', async () => {
  const calls = [];
  const { invoke } = setup({
    storage: {
      writeShotlist: async (videoPath, text) => {
        calls.push(['writeShotlist', videoPath, text]);
        return '/salida/video.txt';
      },
      saveDraft: async (videoPath, draft) => {
        calls.push(['saveDraft', videoPath, draft]);
      },
    },
  });

  assert.deepEqual(await invoke('dsw:writeShotlist', '/v.mp4', 'texto'), {
    ok: true,
    value: '/salida/video.txt',
  });
  assert.deepEqual(await invoke('dsw:saveDraft', '/v.mp4', { notes: 'hola' }), {
    ok: true,
    value: undefined,
  });
  assert.deepEqual(calls, [
    ['writeShotlist', '/v.mp4', 'texto'],
    ['saveDraft', '/v.mp4', { notes: 'hola' }],
  ]);
});

test('dsw:saveDraft: un storage que lanza devuelve { ok: false }', async () => {
  const { invoke } = setup({
    storage: {
      saveDraft: async () => {
        throw new Error('Could not save draft: disco lleno.');
      },
    },
  });

  assert.deepEqual(await invoke('dsw:saveDraft', '/v.mp4', {}), {
    ok: false,
    error: 'Could not save draft: disco lleno.',
  });
});

test('un manejador que lanza un valor no-Error devuelve su texto', async () => {
  const { invoke } = setup({
    storage: {
      loadDraft: async () => {
        throw 'fallo de texto';
      },
    },
  });

  assert.deepEqual(await invoke('dsw:loadDraft', '/v.mp4'), {
    ok: false,
    error: 'fallo de texto',
  });
});

test('dsw:fileExists: true para un fichero real y false si no existe', async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'dopesheet-ipc-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const existing = path.join(dir, 'existe.txt');
  await writeFile(existing, 'x');
  const { invoke } = setup();

  assert.deepEqual(await invoke('dsw:fileExists', existing), { ok: true, value: true });
  assert.deepEqual(await invoke('dsw:fileExists', path.join(dir, 'no-existe.txt')), {
    ok: true,
    value: false,
  });
});

test('dsw:showInFolder: llama a shell.showItemInFolder con la ruta', async () => {
  const { invoke, shownInFolder } = setup();

  assert.deepEqual(await invoke('dsw:showInFolder', '/v.mp4'), { ok: true, value: undefined });
  assert.deepEqual(shownInFolder, ['/v.mp4']);
});

test('dsw:translate: delega en translateText y devuelve su resultado', async () => {
  const calls = [];
  const { invoke } = setup({
    translateText: async (text, options) => {
      calls.push([text, options]);
      return { text: 'Hello', provider: 'google' };
    },
  });

  assert.deepEqual(await invoke('dsw:translate', 'hola', 'en'), {
    ok: true,
    value: { text: 'Hello', provider: 'google' },
  });
  assert.deepEqual(calls, [['hola', { targetLang: 'en' }]]);
});

test('dsw:transcribe: llama a transcriber.transcribe con los argumentos de la petición', async () => {
  const calls = [];
  const { invoke } = setup({
    transcriber: {
      transcribe: async (...args) => {
        calls.push(args);
        return { text: 'Hola', language: 'es', languageName: 'Spanish' };
      },
    },
  });

  assert.deepEqual(await invoke('dsw:transcribe', '/v.mp4', 1.5, 4), {
    ok: true,
    value: { text: 'Hola', language: 'es', languageName: 'Spanish' },
  });
  assert.deepEqual(calls, [['/v.mp4', 1.5, 4, undefined]]);
});

test('dsw:transcribe: pasa el cuarto argumento (idioma) al transcriptor', async () => {
  const calls = [];
  const { invoke } = setup({
    transcriber: {
      transcribe: async (...args) => {
        calls.push(args);
        return { text: 'Bonjour', language: 'fr', languageName: 'French' };
      },
    },
  });

  assert.deepEqual(await invoke('dsw:transcribe', '/v.mp4', 1.5, 4, 'fr'), {
    ok: true,
    value: { text: 'Bonjour', language: 'fr', languageName: 'French' },
  });
  assert.deepEqual(calls, [['/v.mp4', 1.5, 4, 'fr']]);
});

test('dsw:transcribe: un error de la transcripción llega como { ok: false, error }', async () => {
  const { invoke } = setup({
    transcriber: {
      transcribe: async () => {
        throw new Error('No speech found in this cut.');
      },
    },
  });

  assert.deepEqual(await invoke('dsw:transcribe', '/v.mp4', 0, 4), {
    ok: false,
    error: 'No speech found in this cut.',
  });
});

test('dsw:voiceActivity: pasa la ruta al detector y devuelve los segmentos', async () => {
  const calls = [];
  const { invoke } = setup({
    voiceDetector: {
      detect: async (...args) => {
        calls.push(args);
        return [{ start: 0.3, end: 4.12 }];
      },
    },
  });

  assert.deepEqual(await invoke('dsw:voiceActivity', '/v.mp4'), {
    ok: true,
    value: [{ start: 0.3, end: 4.12 }],
  });
  assert.deepEqual(calls, [['/v.mp4']]);
});

test('dsw:voiceActivity: un error del detector llega como { ok: false, error }', async () => {
  const { invoke } = setup({
    voiceDetector: {
      detect: async () => {
        throw new Error('This video has no audio track.');
      },
    },
  });

  assert.deepEqual(await invoke('dsw:voiceActivity', '/v.mp4'), {
    ok: false,
    error: 'This video has no audio track.',
  });
});

test('dsw:transcriberStatus: devuelve el estado de las herramientas', async () => {
  const { invoke } = setup({
    transcriberStatus: async () => ({ available: false, missing: ['/x/ffmpeg.exe'], voiceAvailable: false }),
  });

  assert.deepEqual(await invoke('dsw:transcriberStatus'), {
    ok: true,
    value: { available: false, missing: ['/x/ffmpeg.exe'], voiceAvailable: false },
  });
});

test('dsw:translate: un translateText que rechaza devuelve { ok: false, error }', async () => {
  const { invoke } = setup({
    translateText: async () => {
      throw new Error('There is no text to translate.');
    },
  });

  assert.deepEqual(await invoke('dsw:translate', '   '), {
    ok: false,
    error: 'There is no text to translate.',
  });
});

test('dsw:adjustWindowWidth: delega con un entero y devuelve el delta aplicado', async () => {
  const applied = [];
  const { invoke } = setup({
    adjustWindowWidth: (delta) => {
      applied.push(delta);
      return 440;
    },
  });

  assert.deepEqual(await invoke('dsw:adjustWindowWidth', 440), { ok: true, value: 440 });
  assert.deepEqual(applied, [440]);
});

test('dsw:adjustWindowWidth: rechaza deltas no enteros sin llamar a adjustWindowWidth', async () => {
  const applied = [];
  const { invoke } = setup({
    adjustWindowWidth: (delta) => {
      applied.push(delta);
      return delta;
    },
  });

  for (const delta of [1.5, NaN, 'a']) {
    assert.deepEqual(await invoke('dsw:adjustWindowWidth', delta), {
      ok: false,
      error: 'delta must be a finite integer.',
    });
  }
  assert.deepEqual(applied, []);
});
