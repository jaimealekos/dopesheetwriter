// Pruebas de los flujos de preview, traducción y transcripción con dependencias falsas (sin DOM, sin red).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createShots, setInterview, updateShot } from '../core/shot-model.js';
import { createPreviewFlow } from '../renderer/flow-preview.js';
import { createTranslateFlow } from '../renderer/flow-translate.js';
import { createTranscribeFlow } from '../renderer/flow-transcribe.js';
import { createAutoInterviewsFlow } from '../renderer/flow-auto-interviews.js';
import { createRetranscribeFlow } from '../renderer/flow-retranscribe.js';

// --- Preview --------------------------------------------------------------

function previewHarness({ adjust = async (delta) => delta, focusInside = false } = {}) {
  const log = [];
  const classes = new Set();
  const flow = createPreviewFlow({
    dsw: {
      adjustWindowWidth: async (delta) => {
        log.push(`adjust ${delta}`);
        return adjust(delta);
      },
    },
    appEl: {
      classList: {
        add: (name) => {
          classes.add(name);
          log.push(`class+ ${name}`);
        },
        remove: (name) => {
          classes.delete(name);
          log.push(`class- ${name}`);
        },
      },
    },
    previewPanel: {
      setOpen: (open) => log.push(`panel ${open}`),
      scrollToCurrent: () => log.push('scroll'),
    },
    toggle: { setOpen: (open) => log.push(`toggle ${open}`) },
    refreshPreview: () => log.push('refresh'),
    isAvailable: () => true,
    hasFocusInside: () => focusInside,
    focusToggle: () => log.push('focus toggle'),
    readPreviewWidth: () => 440,
  });
  return { flow, log, classes };
}

// Ejecuta `action` con console.warn silenciado (el flujo avisa por consola de los fallos del ensanche).
async function withoutWarnings(action) {
  const warn = console.warn;
  console.warn = () => {};
  try {
    await action();
  } finally {
    console.warn = warn;
  }
}

test('preview: abre tras la respuesta del ensanche y cierra devolviendo lo aplicado', async () => {
  const { flow, log, classes } = previewHarness({ adjust: async (delta) => (delta > 0 ? 160 : delta) });
  await flow.setPreviewOpen(true);
  assert.deepEqual(log, ['adjust 440', 'class+ is-preview-open', 'panel true', 'toggle true', 'refresh', 'scroll']);
  assert.equal(flow.isOpen(), true);

  log.length = 0;
  await flow.setPreviewOpen(false);
  assert.deepEqual(log, ['class- is-preview-open', 'panel false', 'toggle false', 'adjust -160']);
  assert.equal(classes.size, 0);
});

test('preview: si el ensanche falla, revierte el ancho pedido', async () => {
  const calls = [];
  const { flow } = previewHarness({
    adjust: async (delta) => {
      calls.push(delta);
      if (delta > 0) throw new Error('no window');
      return delta;
    },
  });

  await withoutWarnings(() => flow.setPreviewOpen(true));

  assert.deepEqual(calls, [440, -440]);
  assert.equal(flow.isOpen(), true);
});

test('preview: si el ensanche falla o devuelve 0 abre igualmente y no estrecha al cerrar', async () => {
  const failing = previewHarness({
    adjust: async () => {
      throw new Error('no window');
    },
  });
  await withoutWarnings(() => failing.flow.setPreviewOpen(true));
  assert.equal(failing.flow.isOpen(), true);
  failing.log.length = 0;
  await failing.flow.setPreviewOpen(false);
  assert.ok(!failing.log.some((line) => line.startsWith('adjust')));

  const maximized = previewHarness({ adjust: async () => 0 });
  await maximized.flow.setPreviewOpen(true);
  maximized.log.length = 0;
  await maximized.flow.setPreviewOpen(false);
  assert.ok(!maximized.log.some((line) => line.startsWith('adjust')));
});

test('preview: devuelve el foco al conmutador solo si estaba dentro de la columna', async () => {
  const inside = previewHarness({ focusInside: true });
  await inside.flow.setPreviewOpen(true);
  await inside.flow.setPreviewOpen(false);
  assert.ok(inside.log.includes('focus toggle'));

  const outside = previewHarness({ focusInside: false });
  await outside.flow.setPreviewOpen(true);
  await outside.flow.setPreviewOpen(false);
  assert.ok(!outside.log.includes('focus toggle'));
});

test('preview: órdenes seguidas se aplican en orden', async () => {
  const { flow } = previewHarness();
  await Promise.all([flow.toggleOpen(), flow.toggleOpen()]);
  assert.equal(flow.isOpen(), false);
  await Promise.all([flow.setPreviewOpen(true), flow.setPreviewOpen(false), flow.setPreviewOpen(true)]);
  assert.equal(flow.isOpen(), true);
});

// --- Translate ------------------------------------------------------------

function translateHarness({ translate, confirm = async () => true, errorVisible = false, isTranscribing }) {
  let shots = createShots([
    { startFrame: 0, endFrame: 100 },
    { startFrame: 100, endFrame: 200 },
  ]);
  shots = setInterview(shots, 2, true);
  shots = updateShot(shots, 2, { soundbite: { original: 'Hola mundo' } });
  const state = {
    shots,
    selected: 2,
    video: { path: 'video.mp4' },
    xml: { path: 'montaje.xml' },
  };
  const log = [];
  const warnings = [];
  const flow = createTranslateFlow({
    state,
    dsw: { translate: (text, target) => translate(text, state, target) },
    banner: {
      current: () => (errorVisible ? 'error' : null),
      showWarning: (options) => warnings.push(options),
      clear: () => log.push('banner clear'),
    },
    bannerRegion: { querySelector: () => null },
    editor: { setTranslating: (number) => log.push(`translating ${number}`) },
    announce: (text) => log.push(`say ${text}`),
    commit: () => log.push('commit'),
    isTranscribing,
    confirmReplace: async (target) => {
      log.push(target ? `confirm ${target}` : 'confirm');
      return confirm();
    },
  });
  return { flow, state, log, warnings };
}

test('translate: aplica la traducción y anuncia el estado', async () => {
  const { flow, state, log } = translateHarness({
    translate: async () => ({ text: 'Hello world', provider: 'google' }),
  });
  await flow.onTranslate(2);
  assert.equal(state.shots[1].soundbite.translation, 'Hello world');
  assert.deepEqual(log, ['translating 2', 'say Translating…', 'commit', 'say Translation ready', 'translating null']);
});

test('translate: no hace nada en un plano de imagen ni con Original vacío', async () => {
  const calls = [];
  const { flow, state } = translateHarness({
    translate: async (text) => {
      calls.push(text);
      return { text: 'x' };
    },
  });
  await flow.onTranslate(1);
  state.shots = updateShot(state.shots, 2, { soundbite: { original: '   ' } });
  await flow.onTranslate(2);
  assert.deepEqual(calls, []);
});

test('translate: con traducción previa pide confirmación y respeta el «no»', async () => {
  const calls = [];
  const { flow, state, log } = translateHarness({
    translate: async (text) => {
      calls.push(text);
      return { text: 'new' };
    },
    confirm: async () => false,
  });
  state.shots = updateShot(state.shots, 2, { soundbite: { translation: 'old' } });
  await flow.onTranslate(2);
  assert.deepEqual(calls, []);
  assert.equal(state.shots[1].soundbite.translation, 'old');
  assert.deepEqual(log, ['confirm en', 'translating null']);
});

test('translate: descarta el resultado si el Original cambió o el plano dejó de ser entrevista', async () => {
  const edited = translateHarness({
    translate: async (_text, state) => {
      state.shots = updateShot(state.shots, 2, { soundbite: { original: 'Otro texto' } });
      return { text: 'Hello world' };
    },
  });
  await edited.flow.onTranslate(2);
  assert.equal(edited.state.shots[1].soundbite.translation, '');
  assert.ok(edited.log.includes('say Translation discarded'));

  const unmarked = translateHarness({
    translate: async (_text, state) => {
      state.shots = setInterview(state.shots, 2, false);
      return { text: 'Hello world' };
    },
  });
  await unmarked.flow.onTranslate(2);
  assert.equal(unmarked.state.shots[1].soundbite.translation, '');
  assert.ok(unmarked.log.includes('say Translation discarded'));
});

test('translate: descarta el resultado si Translation cambió durante la petición', async () => {
  const { flow, state, log } = translateHarness({
    translate: async (_text, state) => {
      state.shots = updateShot(state.shots, 2, { soundbite: { translation: 'Escrito a mano' } });
      return { text: 'Hello world' };
    },
  });

  await flow.onTranslate(2);

  assert.equal(state.shots[1].soundbite.translation, 'Escrito a mano');
  assert.ok(log.includes('say Translation discarded'));
});

test('translate: al cambiar de plano muestra el estado del plano mostrado', async () => {
  const releases = new Map();
  const { flow, state, log } = translateHarness({
    translate: (text) => new Promise((resolve) => releases.set(text, resolve)),
  });
  state.shots = setInterview(state.shots, 1, true);
  state.shots = updateShot(state.shots, 1, { soundbite: { original: 'Uno' } });

  state.selected = 1;
  const first = flow.onTranslate(1);
  state.selected = 2;
  const second = flow.onTranslate(2);
  assert.deepEqual(log, ['translating 1', 'say Translating…', 'translating 2', 'say Translating…']);

  state.selected = 1;
  flow.refreshTranslating();
  assert.equal(log.at(-1), 'translating 1');
  state.selected = 2;
  flow.refreshTranslating();
  assert.equal(log.at(-1), 'translating 2');

  releases.get('Uno')({ text: 'One' });
  releases.get('Hola mundo')({ text: 'Hello world' });
  await Promise.all([first, second]);
  assert.equal(log.at(-1), 'translating null');
});

test('translate: si cambia el vídeo o el XML durante la petición, descarta sin banner', async () => {
  const { flow, state, warnings, log } = translateHarness({
    translate: async (_text, state) => {
      state.video = { path: 'otro.mp4' };
      return { text: 'Hello world' };
    },
  });

  await flow.onTranslate(2);

  assert.equal(state.shots[1].soundbite.translation, '');
  assert.equal(warnings.length, 0);
  assert.ok(!log.includes('say Translation discarded'));
});

test('translate: si la carga cambia y la petición falla, no muestra banner ni reintento', async () => {
  const { flow, state, warnings } = translateHarness({
    translate: async (_text, state) => {
      state.xml = { path: 'otro.xml' };
      throw new Error('Translation service unavailable (offline).');
    },
  });

  await flow.onTranslate(2);

  assert.equal(warnings.length, 0);
});

test('translate: ignora una segunda petición del mismo plano en curso', async () => {
  let release;
  const calls = [];
  const { flow } = translateHarness({
    translate: (text) => {
      calls.push(text);
      return new Promise((resolve) => {
        release = () => resolve({ text: 'Hello' });
      });
    },
  });
  const first = flow.onTranslate(2);
  await flow.onTranslate(2);
  release();
  await first;
  assert.deepEqual(calls, ['Hola mundo']);
});

// --- Translate all (masiva) -----------------------------------------------

// Espera `promise` como mucho `ms`: si no termina, falla en vez de colgar el test.
function withTimeout(promise, ms = 1000) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(`La promesa no terminó en ${ms} ms.`)), ms);
    }),
  ]);
}

// Tres entrevistas pendientes (planos 2, 3 y 4) sobre cuatro planos.
function massHarness({ translate, errorVisible = false, isTranscribing } = {}) {
  let shots = createShots([
    { startFrame: 0, endFrame: 100 },
    { startFrame: 100, endFrame: 200 },
    { startFrame: 200, endFrame: 300 },
    { startFrame: 300, endFrame: 400 },
  ]);
  shots = setInterview(shots, 2, true);
  shots = updateShot(shots, 2, { soundbite: { original: 'Dos' } });
  shots = updateShot(shots, 3, { soundbite: { original: 'Tres' } });
  shots = updateShot(shots, 4, { soundbite: { original: 'Cuatro' } });

  const state = {
    shots,
    selected: 0,
    video: { path: 'video.mp4' },
    xml: { path: 'montaje.xml' },
  };
  const log = [];
  const warnings = [];
  const toasts = [];
  // Banner y región realistas: permiten comprobar qué aviso está visible y cuál se retira.
  let bannerState = errorVisible ? 'error' : null;
  let bannerTitle = '';
  const flow = createTranslateFlow({
    state,
    dsw: { translate: (text, target) => translate(text, state, target) },
    banner: {
      current: () => bannerState,
      showWarning: (options) => {
        warnings.push(options);
        if (bannerState === 'error') return;
        bannerState = 'warning';
        bannerTitle = options.title;
      },
      clear: () => {
        log.push('banner clear');
        bannerState = null;
        bannerTitle = '';
      },
    },
    bannerRegion: { querySelector: () => ({ textContent: bannerTitle }) },
    editor: { setTranslating: (number) => log.push(`translating ${number}`) },
    announce: (text) => log.push(`say ${text}`),
    commit: () => log.push('commit'),
    toasts: { show: (options) => toasts.push(options) },
    refreshAll: () => log.push('refresh'),
    isTranscribing,
    confirmReplace: async () => {
      log.push('confirm');
      return true;
    },
  });
  return { flow, state, log, warnings, toasts };
}

test('translateAll: traduce los pendientes en secuencia y aplica los resultados', async () => {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const { flow, state, log, toasts } = massHarness({
    translate: async (text) => {
      calls.push(text);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      return { text: `EN ${text}` };
    },
  });

  await flow.translateAll();

  assert.deepEqual(calls, ['Dos', 'Tres', 'Cuatro']);
  assert.equal(maxActive, 1);
  assert.equal(state.shots[1].soundbite.translation, 'EN Dos');
  assert.equal(state.shots[2].soundbite.translation, 'EN Tres');
  assert.equal(state.shots[3].soundbite.translation, 'EN Cuatro');
  assert.ok(!log.includes('confirm'));
  assert.ok(log.includes('say Translating 1 of 3\u2026'));
  assert.ok(log.includes('say Translating 3 of 3\u2026'));
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].kind, 'success');
  assert.equal(toasts[0].title, 'Translated 3 soundbites.');
  assert.equal(toasts[0].detail, 'Review the translations before generating.');
  assert.equal(flow.isTranslatingAll(), false);
});

test('translateAll: un fallo no detiene el resto y sale el banner con el plano fallido', async () => {
  const { flow, state, warnings, toasts } = massHarness({
    translate: async (text) => {
      if (text === 'Tres') throw new Error('The translation service returned an error (500).');
      return { text: `EN ${text}` };
    },
  });

  await flow.translateAll();

  assert.equal(state.shots[1].soundbite.translation, 'EN Dos');
  assert.equal(state.shots[2].soundbite.translation, '');
  assert.equal(state.shots[3].soundbite.translation, 'EN Cuatro');
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].title, "Couldn't translate 1 soundbite.");
  assert.equal(warnings[0].detail, 'Shot 3: The translation service returned an error (500).');
  assert.equal(warnings[0].action.label, 'Try again');
  assert.equal(toasts.length, 0);
});

test('translateAll: el detalle del aviso muestra dos fallos y cuenta el resto', async () => {
  const { flow, warnings } = massHarness({
    translate: async (text) => {
      throw new Error(`${text} roto`);
    },
  });

  await flow.translateAll();

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].title, "Couldn't translate 3 soundbites.");
  assert.equal(warnings[0].detail, 'Shot 2: Dos roto Shot 3: Tres roto and 1 more');
});

test('translateAll: no toca las traducciones ya existentes', async () => {
  const calls = [];
  const { flow, state } = massHarness({
    translate: async (text) => {
      calls.push(text);
      return { text: `EN ${text}` };
    },
  });
  state.shots = updateShot(state.shots, 3, { soundbite: { translation: 'Ya traducido' } });

  await flow.translateAll();

  assert.deepEqual(calls, ['Dos', 'Cuatro']);
  assert.equal(state.shots[2].soundbite.translation, 'Ya traducido');
});

test('translateAll: descarta el resultado si Translation cambió durante la petición', async () => {
  const { flow, state, toasts } = massHarness({
    translate: async (text, state) => {
      if (text === 'Dos') {
        state.shots = updateShot(state.shots, 2, { soundbite: { translation: 'Manual' } });
      }
      return { text: `EN ${text}` };
    },
  });

  await flow.translateAll();

  assert.equal(state.shots[1].soundbite.translation, 'Manual');
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].title, 'Translated 2 soundbites.');
});

test('translateAll: salta un plano traducido por la vía individual mientras esperaba', async () => {
  const calls = [];
  const releases = new Map();
  const { flow, state, toasts } = massHarness({
    translate: (text) =>
      new Promise((resolve) => {
        calls.push(text);
        releases.set(text, () => resolve({ text: `EN ${text}` }));
      }),
  });

  const mass = flow.translateAll();
  await Promise.resolve();
  assert.deepEqual(calls, ['Dos']);

  // Mientras la masiva espera en el plano 2, el usuario traduce el 3 a mano.
  const single = flow.onTranslate(3);
  await Promise.resolve();
  assert.deepEqual(calls, ['Dos', 'Tres']);
  releases.get('Tres')();
  await single;
  assert.equal(state.shots[2].soundbite.translation, 'EN Tres');

  releases.get('Dos')();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(calls, ['Dos', 'Tres', 'Cuatro']);
  releases.get('Cuatro')();
  await withTimeout(mass);

  assert.deepEqual(calls, ['Dos', 'Tres', 'Cuatro']);
  assert.equal(state.shots[2].soundbite.translation, 'EN Tres');
  assert.equal(state.shots[3].soundbite.translation, 'EN Cuatro');
  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].title, 'Translated 2 soundbites.');
});

test('translateAll: al empezar borra el aviso de fallo masivo anterior', async () => {
  let fail = true;
  const { flow, log } = massHarness({
    translate: async (text) => {
      if (fail) throw new Error(`${text} roto`);
      return { text: `EN ${text}` };
    },
  });

  await flow.translateAll();
  assert.ok(!log.includes('banner clear'));

  fail = false;
  log.length = 0;
  await flow.translateAll();

  assert.ok(log.includes('banner clear'));
  assert.ok(log.includes('refresh'));
});

test('translate: un éxito individual retira el aviso de fallo masivo', async () => {
  let fail = true;
  const { flow, log } = massHarness({
    translate: async (text) => {
      if (fail) throw new Error(`${text} roto`);
      return { text: `EN ${text}` };
    },
  });

  await flow.translateAll();
  log.length = 0;
  fail = false;

  await flow.onTranslate(2);

  assert.ok(log.includes('banner clear'));
  assert.equal(log.at(-1), 'translating null');
});

test('translateAll: con un error visible anuncia el título del fallo masivo', async () => {
  const { flow, log, warnings } = massHarness({
    translate: async (text) => {
      throw new Error(`${text} roto`);
    },
    errorVisible: true,
  });

  await flow.translateAll();

  assert.equal(warnings.length, 1);
  assert.ok(log.includes("say Couldn't translate 3 soundbites."));
});

test('translateAll: con un solo pendiente usa el singular', async () => {
  const { flow, state, toasts } = massHarness({
    translate: async (text) => ({ text: `EN ${text}` }),
  });
  state.shots = updateShot(state.shots, 3, { soundbite: { translation: 'Ya' } });
  state.shots = updateShot(state.shots, 4, { soundbite: { translation: 'Ya' } });

  await flow.translateAll();

  assert.equal(toasts.length, 1);
  assert.equal(toasts[0].title, 'Translated 1 soundbite.');
});

test('translateAll: ignora un segundo lanzamiento mientras dura', async () => {
  const calls = [];
  const releases = [];
  const { flow } = massHarness({
    translate: (text) =>
      new Promise((resolve) => {
        calls.push(text);
        releases.push(() => resolve({ text: `EN ${text}` }));
      }),
  });

  const first = flow.translateAll();
  await Promise.resolve();
  assert.deepEqual(calls, ['Dos']);

  const second = flow.translateAll();
  await withTimeout(second);
  assert.deepEqual(calls, ['Dos']); // el segundo lanzamiento no arranca ninguna llamada

  for (let i = 0; i < 3; i += 1) {
    releases[i]();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  await withTimeout(first);
  assert.deepEqual(calls, ['Dos', 'Tres', 'Cuatro']);
});

test('translateAll: si cambia la carga a mitad, se detiene sin avisar', async () => {
  const calls = [];
  const { flow, state, warnings, toasts, log } = massHarness({
    translate: async (text) => {
      calls.push(text);
      if (text === 'Dos') state.xml = { path: 'otro.xml' };
      return { text: `EN ${text}` };
    },
  });

  await flow.translateAll();

  assert.deepEqual(calls, ['Dos']);
  assert.equal(state.shots[1].soundbite.translation, '');
  assert.equal(warnings.length, 0);
  assert.equal(toasts.length, 0);
  // El finally refresca también al detenerse por cambio de carga.
  assert.equal(log.at(-1), 'refresh');
});

test('translate: un fallo sale como aviso translate-failed; con un error visible solo se anuncia', async () => {
  const failing = async () => {
    throw new Error('Translation service unavailable (offline).');
  };
  const normal = translateHarness({ translate: failing });
  await normal.flow.onTranslate(2);
  assert.equal(normal.warnings.length, 1);
  assert.equal(normal.warnings[0].title, "Couldn't translate the text.");
  assert.equal(normal.warnings[0].detail, 'Translation service unavailable (offline).');
  assert.equal(normal.warnings[0].action.label, 'Try again');
  assert.equal(normal.log.at(-1), 'translating null');

  const blocked = translateHarness({ translate: failing, errorVisible: true });
  await blocked.flow.onTranslate(2);
  assert.ok(blocked.log.includes("say Couldn't translate the text."));
});

test('translate: el destino sigue al idioma del plano (inglés → es; resto → en)', async () => {
  const targets = [];
  const { flow, state, log } = translateHarness({
    translate: async (_text, _state, target) => {
      targets.push(target);
      return { text: 'x' };
    },
  });
  state.shots = updateShot(state.shots, 2, { soundbite: { language: 'English', translation: 'old' } });
  await flow.onTranslate(2);
  state.shots = updateShot(state.shots, 2, { soundbite: { language: 'Spanish' } });
  await flow.onTranslate(2);
  state.shots = updateShot(state.shots, 2, { soundbite: { language: '' } });
  await flow.onTranslate(2);
  assert.deepEqual(targets, ['es', 'en', 'en']);
  assert.deepEqual(log.filter((entry) => entry.startsWith('confirm')), ['confirm es', 'confirm en', 'confirm en']);
});

test('translate: descarta el resultado si Language cambió durante la petición', async () => {
  const { flow, state, log } = translateHarness({
    translate: async (_text, state) => {
      state.shots = updateShot(state.shots, 2, { soundbite: { language: 'English' } });
      return { text: 'Hello world' };
    },
  });
  await flow.onTranslate(2);
  assert.equal(state.shots[1].soundbite.translation, '');
  assert.ok(log.includes('say Translation discarded'));
});

// --- Transcribe -----------------------------------------------------------

function transcribeHarness({
  transcribe,
  confirm = async () => true,
  errorVisible = false,
  available = true,
  video = { loaded: true, path: 'video.mp4' },
} = {}) {
  let shots = createShots([
    { startFrame: 0, endFrame: 100 },
    { startFrame: 50, endFrame: 175 },
  ]);
  shots = setInterview(shots, 2, true);
  const state = {
    shots,
    selected: 2,
    video,
    xml: { path: 'montaje.xml', parsed: { fps: 25 } },
  };
  const log = [];
  const warnings = [];
  const calls = [];
  // Banner y región realistas: permiten comprobar qué aviso está visible y cuál se retira.
  let bannerState = errorVisible ? 'error' : null;
  let bannerTitle = '';
  const flow = createTranscribeFlow({
    state,
    dsw: {
      transcribe: (path, start, end, language) => {
        calls.push(language === undefined ? [path, start, end] : [path, start, end, language]);
        return transcribe(state, path, start, end, language);
      },
    },
    banner: {
      current: () => bannerState,
      showWarning: (options) => {
        warnings.push(options);
        if (bannerState === 'error') return;
        bannerState = 'warning';
        bannerTitle = options.title;
      },
      clear: () => {
        log.push('banner clear');
        bannerState = null;
        bannerTitle = '';
      },
    },
    bannerRegion: { querySelector: () => ({ textContent: bannerTitle }) },
    editor: {
      setTranscribing: (number) => log.push(`transcribing ${number}`),
      setTranscriberAvailable: (value) => log.push(`available ${value}`),
      flashLanguage: () => log.push('flash'),
    },
    announce: (text) => log.push(`say ${text}`),
    commit: () => log.push('commit'),
    refreshAll: () => log.push('refresh'),
    confirmReplace: async () => {
      log.push('confirm');
      return confirm();
    },
  });
  flow.setAvailability({ available, missing: [] });
  return { flow, state, log, warnings, calls };
}

const SPANISH = { text: 'Hola', language: 'es', languageName: 'Spanish' };

test('transcribe: transcribe el corte y rellena Original y Language', async () => {
  const { flow, state, log, calls } = transcribeHarness({ transcribe: async () => SPANISH });
  state.shots = updateShot(state.shots, 2, { soundbite: { language: 'English' } });
  await flow.onTranscribe(2);
  assert.deepEqual(calls, [['video.mp4', 2, 7]]);
  assert.equal(state.shots[1].soundbite.original, 'Hola');
  assert.equal(state.shots[1].soundbite.language, 'Spanish');
  assert.deepEqual(log, [
    'available true',
    'transcribing 2',
    'say Transcribing…',
    'commit',
    'say Transcription ready (Spanish)',
    'flash',
    'transcribing null',
    'refresh',
  ]);
});

test('transcribe: sin idioma detectado no toca Language ni realza', async () => {
  const { flow, state, log } = transcribeHarness({
    transcribe: async () => ({ text: 'Hola', language: null, languageName: null }),
  });
  state.shots = updateShot(state.shots, 2, { soundbite: { language: 'Basque' } });
  await flow.onTranscribe(2);
  assert.equal(state.shots[1].soundbite.original, 'Hola');
  assert.equal(state.shots[1].soundbite.language, 'Basque');
  assert.ok(log.includes('say Transcription ready'));
  assert.ok(!log.includes('flash'));
});

test('transcribe: sin cambio real de Language (mayúsculas, espacios) no realza', async () => {
  const { flow, state, log } = transcribeHarness({ transcribe: async () => SPANISH });
  state.shots = updateShot(state.shots, 2, { soundbite: { language: ' spanish ' } });
  await flow.onTranscribe(2);
  assert.equal(state.shots[1].soundbite.language, 'Spanish');
  assert.ok(!log.includes('flash'));
});

test('transcribe: si el plano mostrado es otro, el anuncio lleva el plano y no realza', async () => {
  const { flow, log } = transcribeHarness({
    transcribe: async (state) => {
      state.selected = 1;
      return SPANISH;
    },
  });
  await flow.onTranscribe(2);
  assert.ok(log.includes('say Shot 2: transcription ready (Spanish)'));
  assert.ok(!log.includes('flash'));
});

test('transcribe: con Original con texto pide confirmación y respeta el «no»', async () => {
  const { flow, state, log, calls } = transcribeHarness({
    transcribe: async () => SPANISH,
    confirm: async () => false,
  });
  state.shots = updateShot(state.shots, 2, { soundbite: { original: 'Antes' } });
  await flow.onTranscribe(2);
  assert.deepEqual(calls, []);
  assert.equal(state.shots[1].soundbite.original, 'Antes');
  assert.ok(log.includes('confirm'));
});

test('transcribe: con Original con texto y «sí» lo sustituye', async () => {
  const { flow, state } = transcribeHarness({ transcribe: async () => SPANISH });
  state.shots = updateShot(state.shots, 2, { soundbite: { original: 'Antes' } });
  await flow.onTranscribe(2);
  assert.equal(state.shots[1].soundbite.original, 'Hola');
});

test('transcribe: un fallo sale como aviso transcribe-failed con Try again y no cambia nada', async () => {
  const { flow, state, warnings, calls, log } = transcribeHarness({
    transcribe: async () => {
      throw new Error('No speech found in this cut.');
    },
  });
  await flow.onTranscribe(2);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].title, "Couldn't transcribe shot 2.");
  assert.equal(warnings[0].detail, 'No speech found in this cut.');
  assert.equal(warnings[0].action.label, 'Try again');
  assert.equal(state.shots[1].soundbite.original, '');

  await warnings[0].action.onClick();
  assert.equal(calls.length, 2);
  assert.ok(log.includes('banner clear'));
});

test('transcribe: con un error visible solo anuncia el título', async () => {
  const { flow, log } = transcribeHarness({
    errorVisible: true,
    transcribe: async () => {
      throw new Error('boom');
    },
  });
  await flow.onTranscribe(2);
  assert.ok(log.includes("say Couldn't transcribe shot 2."));
});

test('transcribe: si cambia el vídeo durante la petición, descarta sin banner ni cambios', async () => {
  const { flow, state, warnings, log } = transcribeHarness({
    transcribe: async (state) => {
      state.video = { loaded: true, path: 'otro.mp4' };
      return SPANISH;
    },
  });
  await flow.onTranscribe(2);
  assert.equal(state.shots[1].soundbite.original, '');
  assert.equal(warnings.length, 0);
  assert.ok(!log.includes('say Transcription discarded'));
  assert.ok(!log.includes('commit'));
});

test('transcribe: si cambian los fotogramas del plano (inicio o fin), anuncia el descarte', async () => {
  for (const change of [{ endFrame: 200 }, { startFrame: 60 }]) {
    const { flow, state, log } = transcribeHarness({
      transcribe: async (state) => {
        state.shots = state.shots.map((shot) => (shot.number === 2 ? { ...shot, ...change } : shot));
        return SPANISH;
      },
    });
    await flow.onTranscribe(2);
    assert.equal(state.shots[1].soundbite.original, '', JSON.stringify(change));
    assert.ok(log.includes('say Transcription discarded'), JSON.stringify(change));
    assert.ok(!log.includes('commit'), JSON.stringify(change));
  }
});

test('transcribe: si el plano dejó de ser entrevista, anuncia el descarte', async () => {
  const { flow, log } = transcribeHarness({
    transcribe: async (state) => {
      state.shots = setInterview(state.shots, 2, false);
      return SPANISH;
    },
  });
  await flow.onTranscribe(2);
  assert.ok(log.includes('say Transcription discarded'));
});

test('transcribe: no llama a dsw sin vídeo, sin herramienta, en plano de imagen o con otra en curso', async () => {
  const noVideo = transcribeHarness({ transcribe: async () => SPANISH, video: { loaded: false, path: 'video.mp4' } });
  await noVideo.flow.onTranscribe(2);
  const noPath = transcribeHarness({ transcribe: async () => SPANISH, video: { loaded: true, path: '' } });
  await noPath.flow.onTranscribe(2);
  const noTool = transcribeHarness({ transcribe: async () => SPANISH, available: false });
  await noTool.flow.onTranscribe(2);
  const image = transcribeHarness({ transcribe: async () => SPANISH });
  await image.flow.onTranscribe(1);
  assert.deepEqual([noVideo.calls, noPath.calls, noTool.calls, image.calls], [[], [], [], []]);

  let release;
  const busy = transcribeHarness({
    transcribe: () =>
      new Promise((resolve) => {
        release = () => resolve(SPANISH);
      }),
  });
  busy.state.shots = setInterview(busy.state.shots, 1, true);
  const first = busy.flow.onTranscribe(2);
  await busy.flow.onTranscribe(1);
  assert.equal(busy.calls.length, 1);
  release();
  await first;
});

test('transcribe: refreshTranscribing marca el plano en curso y setAvailability avisa al editor', async () => {
  let release;
  const { flow, log } = transcribeHarness({
    transcribe: () =>
      new Promise((resolve) => {
        release = () => resolve(SPANISH);
      }),
  });
  const run = flow.onTranscribe(2);
  flow.refreshTranscribing();
  assert.equal(log.at(-1), 'transcribing 2');
  release();
  await run;
  assert.ok(log.includes('transcribing null'));
  flow.setAvailability({ available: false, missing: ['x'] });
  assert.equal(log.at(-1), 'available false');
});

test('transcribe: un éxito retira el aviso transcribe-failed propio', async () => {
  let fail = true;
  const { flow, warnings, log } = transcribeHarness({
    transcribe: async () => {
      if (fail) throw new Error('No speech found in this cut.');
      return SPANISH;
    },
  });
  await flow.onTranscribe(2);
  assert.equal(warnings.length, 1);
  assert.ok(!log.includes('banner clear'));

  fail = false;
  await flow.onTranscribe(2);
  assert.ok(log.includes('banner clear'));
});

test('translate: con el plano en transcripción, Try again y Translate all lo saltan', async () => {
  const calls = [];
  const { flow, state, log } = translateHarness({
    translate: async (text) => {
      calls.push(text);
      return { text: 'x' };
    },
    isTranscribing: (number) => number === 2,
  });
  await flow.onTranslate(2);
  assert.deepEqual(calls, []);
  assert.ok(!log.includes('say Translating…'));
  assert.equal(state.shots[1].soundbite.translation, '');

  const massCalls = [];
  const mass = massHarness({
    translate: async (text) => {
      massCalls.push(text);
      return { text: `EN ${text}` };
    },
    isTranscribing: (number) => number === 3,
  });
  await mass.flow.translateAll();
  assert.deepEqual(massCalls, ['Dos', 'Cuatro']);
});

test('translateAll: cada plano usa su destino (English → es, Spanish → en)', async () => {
  const targets = [];
  const { flow, state } = massHarness({
    translate: async (_text, _state, target) => {
      targets.push(target);
      return { text: 'x' };
    },
  });
  state.shots = updateShot(state.shots, 2, { soundbite: { language: 'English' } });
  state.shots = updateShot(state.shots, 3, { soundbite: { language: 'Spanish' } });
  state.shots = updateShot(state.shots, 4, { soundbite: { language: 'Spanish' } });
  await flow.translateAll();
  assert.deepEqual(targets, ['es', 'en', 'en']);
});

// --- Transcripción silenciosa (transcribeShot) ----------------------------

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('transcribeShot: sin confirmación, un Original con texto se salta', async () => {
  const { flow, state, log, calls } = transcribeHarness({ transcribe: async () => SPANISH });
  state.shots = updateShot(state.shots, 2, { soundbite: { original: 'Antes' } });

  const result = await flow.transcribeShot(2);

  assert.deepEqual(result, { status: 'skipped' });
  assert.deepEqual(calls, []);
  assert.ok(!log.includes('confirm'));
});

test('transcribeShot: en silencio no anuncia y devuelve el resultado', async () => {
  const { flow, state, log } = transcribeHarness({ transcribe: async () => SPANISH });

  const result = await flow.transcribeShot(2, { quiet: true });

  assert.deepEqual(result, { status: 'done' });
  assert.equal(state.shots[1].soundbite.original, 'Hola');
  assert.ok(!log.some((entry) => entry.startsWith('say ')));
  assert.ok(log.includes('commit'));
});

test('transcribeShot: plano de imagen, sin vídeo o sin herramienta se saltan', async () => {
  const image = transcribeHarness({ transcribe: async () => SPANISH });
  const noVideo = transcribeHarness({
    transcribe: async () => SPANISH,
    video: { loaded: false, path: 'video.mp4' },
  });
  const noTool = transcribeHarness({ transcribe: async () => SPANISH, available: false });

  assert.deepEqual(await image.flow.transcribeShot(1), { status: 'skipped' });
  assert.deepEqual(await noVideo.flow.transcribeShot(2), { status: 'skipped' });
  assert.deepEqual(await noTool.flow.transcribeShot(2), { status: 'skipped' });
  assert.deepEqual([image.calls, noVideo.calls, noTool.calls], [[], [], []]);
});

test('transcribeShot: un fallo vuelve como failed sin banner', async () => {
  const { flow, warnings } = transcribeHarness({
    transcribe: async () => {
      throw new Error('No speech found in this cut.');
    },
  });

  const result = await flow.transcribeShot(2, { quiet: true });

  assert.equal(result.status, 'failed');
  assert.equal(result.error.message, 'No speech found in this cut.');
  assert.equal(warnings.length, 0);
});

test('transcribeShot: con una transcripción manual en curso espera su turno', async () => {
  let active = 0;
  let maxActive = 0;
  const releases = [];
  const { flow, state, calls } = transcribeHarness({
    transcribe: () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        releases.push(() => {
          active -= 1;
          resolve(SPANISH);
        });
      });
    },
  });
  // La manual va sobre el plano 1 y la de la cola sobre el 2: al acabar la primera,
  // el Original del 2 sigue vacío y la cola arranca.
  state.shots = setInterview(state.shots, 1, true);

  const manual = flow.onTranscribe(1);
  await flush();
  assert.equal(calls.length, 1);

  const auto = flow.transcribeShot(2, { quiet: true });
  await flush();
  assert.equal(calls.length, 1, 'no debe lanzar una segunda transcripción a la vez');

  releases[0]();
  await manual;
  await flush();
  assert.equal(calls.length, 2, 'al terminar la manual, la de la cola arranca');

  releases[1]();
  const result = await auto;
  assert.equal(result.status, 'done');
  assert.equal(maxActive, 1);
});

// --- Traducción silenciosa (translateShot) --------------------------------

test('translateShot: traduce en silencio y devuelve el resultado', async () => {
  const { flow, state, log } = translateHarness({
    translate: async () => ({ text: 'Hello world' }),
  });

  const result = await flow.translateShot(2, { quiet: true });

  assert.deepEqual(result, { status: 'done' });
  assert.equal(state.shots[1].soundbite.translation, 'Hello world');
  assert.ok(!log.some((entry) => entry.startsWith('say ')));
  assert.ok(!log.includes('confirm'));
});

test('translateShot: no pisa una traducción existente y no confirma', async () => {
  const calls = [];
  const { flow, state, log } = translateHarness({
    translate: async (text) => {
      calls.push(text);
      return { text: 'new' };
    },
  });
  state.shots = updateShot(state.shots, 2, { soundbite: { translation: 'old' } });

  const result = await flow.translateShot(2, { quiet: true });

  assert.deepEqual(result, { status: 'skipped' });
  assert.deepEqual(calls, []);
  assert.equal(state.shots[1].soundbite.translation, 'old');
  assert.ok(!log.includes('confirm'));
});

test('translateShot: un fallo vuelve con el error y sin banner', async () => {
  const { flow, warnings } = translateHarness({
    translate: async () => {
      throw new Error('Translation service unavailable (offline).');
    },
  });

  const result = await flow.translateShot(2, { quiet: true });

  assert.equal(result.status, 'failed');
  assert.equal(result.error.message, 'Translation service unavailable (offline).');
  assert.equal(warnings.length, 0);
});

// --- Detección automática de entrevistas (15) -----------------------------

// Cinco planos de 7, 8, 6, 20 y 15 segundos a 25 fps: la detección propone el 4.º.
const AUTO_CUTS = [
  [0, 175],
  [175, 375],
  [375, 525],
  [525, 1025],
  [1025, 1400],
];

function autoHarness(options = {}) {
  const {
    cuts = AUTO_CUTS,
    fps = 25,
    available = true,
    voiceAvailable = false,
    segments = [],
    voiceError = null,
    onVoice = null,
    pickerResult = { first: 4, transcribe: [4, 5], languages: { 4: null, 5: null } },
    onPicker = null,
    transcribe = async () => ({ status: 'done' }),
    translate = async () => ({ status: 'done' }),
  } = options;
  const state = {
    shots: createShots(cuts.map(([startFrame, endFrame]) => ({ startFrame, endFrame }))),
    selected: 1,
    video: { path: 'video.mp4', name: 'video.mp4', url: '', loaded: true },
    xml: { path: 'montaje.xml', name: 'montaje.xml', parsed: { fps } },
  };
  const log = [];
  const toasts = [];
  const warnings = [];
  const progress = [];
  const processing = [];
  const queued = [];
  const pickerArgs = [];
  const voiceCalls = [];
  const transcribeCalls = [];
  const translateCalls = [];
  const timeline = [];
  let bannerState = null;

  const flow = createAutoInterviewsFlow({
    state,
    banner: {
      current: () => bannerState,
      showWarning: (o) => {
        warnings.push(o);
        if (bannerState !== 'error') bannerState = 'warning';
      },
      clear: () => {
        bannerState = null;
      },
    },
    bannerRegion: { querySelector: () => null },
    toasts: { show: (o) => toasts.push(o) },
    announce: (text) => log.push(`say ${text}`),
    commit: () => log.push('commit'),
    refreshAll: () => log.push('refresh'),
    openPicker: async (o) => {
      pickerArgs.push(o);
      return onPicker ? onPicker(o, state) : pickerResult;
    },
    voiceActivity: async (path) => {
      voiceCalls.push(path);
      if (voiceError) throw voiceError;
      if (onVoice) await onVoice(state);
      return segments;
    },
    voiceAvailable: () => voiceAvailable,
    transcribeShot: async (number, transcribeOptions = {}) => {
      transcribeCalls.push({ number, ...transcribeOptions });
      timeline.push(`t${number}`);
      return transcribe(number, transcribeOptions);
    },
    translateShot: async (number, translateOptions = {}) => {
      translateCalls.push(number);
      timeline.push(`x${number}`);
      return translate(number, translateOptions);
    },
    transcriberAvailable: () => available,
    setProgress: (text) => progress.push(text),
    setProcessing: (number, kind) => processing.push([number, kind]),
    setQueued: (numbers) => queued.push([...numbers]),
  });

  return {
    flow,
    state,
    log,
    toasts,
    warnings,
    progress,
    processing,
    queued,
    pickerArgs,
    voiceCalls,
    transcribeCalls,
    translateCalls,
    timeline,
  };
}

test('auto-interviews: propone, marca y transcribe y traduce los cortes marcados', async () => {
  const h = autoHarness();

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.equal(h.pickerArgs.length, 1);
  assert.equal(h.pickerArgs[0].first, 4);
  assert.equal(h.pickerArgs[0].fps, 25);
  assert.equal(h.pickerArgs[0].mode, 'auto');
  assert.equal(h.pickerArgs[0].transcriberAvailable, true);
  assert.equal(h.pickerArgs[0].voices, null);
  assert.deepEqual(h.state.shots.map((shot) => shot.interview), [false, false, false, true, true]);
  assert.deepEqual(h.transcribeCalls.map((call) => call.number), [4, 5]);
  assert.deepEqual(h.translateCalls, [4, 5]);
  // Cada traducción arranca al acabar su transcripción, sin esperar a la siguiente.
  assert.deepEqual(h.timeline, ['t4', 'x4', 't5', 'x5']);
});

test('auto-interviews: progreso, marcas y cola acaban limpios', async () => {
  const h = autoHarness();

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.equal(h.progress[0], 'Transcribing 1 of 2\u2026');
  assert.equal(h.progress[1], 'Transcribing 2 of 2\u2026');
  assert.ok(h.progress.some((text) => text && text.startsWith('Translating ')));
  assert.equal(h.progress.at(-1), null);
  assert.deepEqual(h.processing.at(-1), [null, null]);
  assert.deepEqual(h.queued.at(-1), []);

  assert.deepEqual(h.toasts[0], {
    kind: 'info',
    title: 'Transcribing 2 soundbites in the background',
    detail: 'You can keep working.',
  });
  assert.deepEqual(h.toasts.at(-1), {
    kind: 'success',
    title: '2 soundbites transcribed and translated.',
    detail: 'Review them before generating.',
  });
});

test('auto-interviews: no actúa con borrador restaurado ni si ya hay entrevistas', async () => {
  const draft = autoHarness();
  await draft.flow.onWorkspaceReady({ draftRestored: true });
  assert.deepEqual(draft.pickerArgs, []);
  assert.deepEqual(draft.transcribeCalls, []);

  const marked = autoHarness();
  marked.state.shots = setInterview(marked.state.shots, 5, true);
  await marked.flow.onWorkspaceReady({ draftRestored: false });
  assert.deepEqual(marked.pickerArgs, []);
  assert.deepEqual(marked.transcribeCalls, []);
});

test('auto-interviews: sin detección no abre el selector', async () => {
  const h = autoHarness({
    cuts: [
      [0, 175],
      [175, 375],
      [375, 525],
    ],
  });
  await h.flow.onWorkspaceReady({ draftRestored: false });
  assert.deepEqual(h.pickerArgs, []);
});

test('auto-interviews: cerrar el selector deja los planos sin cambios y sin cola', async () => {
  const h = autoHarness({ pickerResult: null });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.deepEqual(h.state.shots.map((shot) => shot.interview), [false, false, false, false, false]);
  assert.deepEqual(h.transcribeCalls, []);
  assert.deepEqual(h.translateCalls, []);
  assert.deepEqual(h.toasts, []);
});

test('auto-interviews: cambio de carga con el selector abierto no cambia nada', async () => {
  const h = autoHarness({
    onPicker: (_options, state) => {
      state.xml = { path: 'otro.xml', name: 'otro.xml', parsed: { fps: 25 } };
      return { first: 4, transcribe: [4, 5], languages: { 4: null, 5: null } };
    },
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.deepEqual(h.state.shots.map((shot) => shot.interview), [false, false, false, false, false]);
  assert.deepEqual(h.transcribeCalls, []);
  assert.deepEqual(h.toasts, []);
});

test('auto-interviews: sin transcripción disponible marca y no encola', async () => {
  const h = autoHarness({
    available: false,
    pickerResult: { first: 4, transcribe: [], languages: {} },
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.equal(h.pickerArgs[0].transcriberAvailable, false);
  assert.deepEqual(h.state.shots.map((shot) => shot.interview), [false, false, false, true, true]);
  assert.deepEqual(h.transcribeCalls, []);
  assert.deepEqual(h.translateCalls, []);
  assert.deepEqual(h.toasts, []);
});

test('auto-interviews: un fallo de transcripción no detiene el resto y ofrece reintentar', async () => {
  let fail = true;
  const h = autoHarness({
    transcribe: async (number) => {
      if (fail && number === 5) {
        return { status: 'failed', error: new Error('No speech found in this cut.') };
      }
      return { status: 'done' };
    },
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.deepEqual(h.transcribeCalls.map((call) => call.number), [4, 5]);
  // El plano cuya transcripción falla no se traduce.
  assert.deepEqual(h.translateCalls, [4]);
  assert.equal(h.warnings.length, 1);
  assert.equal(h.warnings[0].title, "Couldn't transcribe 1 soundbite.");
  assert.equal(h.warnings[0].detail, 'Shot 5: No speech found in this cut.');
  assert.equal(h.warnings[0].action.label, 'Try again');
  assert.ok(!h.toasts.some((toast) => toast.kind === 'success'));

  fail = false;
  h.transcribeCalls.length = 0;
  h.translateCalls.length = 0;
  await h.warnings[0].action.onClick();

  // Solo se repite el plano fallido, desde su transcripción.
  assert.deepEqual(h.transcribeCalls.map((call) => call.number), [5]);
  assert.deepEqual(h.translateCalls, [5]);
  assert.equal(h.toasts.at(-1).title, '1 soundbite transcribed and translated.');
});

test('auto-interviews: un fallo de traducción se reintenta solo traduciendo', async () => {
  let fail = true;
  const h = autoHarness({
    translate: async (number) => {
      if (fail && number === 5) {
        return { status: 'failed', error: new Error('Translation service unavailable.') };
      }
      return { status: 'done' };
    },
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.equal(h.warnings.length, 1);
  assert.equal(h.warnings[0].title, "Couldn't translate 1 soundbite.");

  fail = false;
  h.transcribeCalls.length = 0;
  h.translateCalls.length = 0;
  await h.warnings[0].action.onClick();

  assert.deepEqual(h.transcribeCalls, []);
  assert.deepEqual(h.translateCalls, [5]);
});

test('auto-interviews: fallos de los dos tipos usan el título agrupado', async () => {
  const h = autoHarness({
    transcribe: async (number) =>
      number === 4
        ? { status: 'failed', error: new Error('No speech found in this cut.') }
        : { status: 'done' },
    translate: async () => ({ status: 'failed', error: new Error('Service offline.') }),
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.equal(h.warnings.length, 1);
  assert.equal(h.warnings[0].title, "Couldn't finish 2 soundbites.");
});

test('auto-interviews: «stale» para la cola sin banner ni toast final', async () => {
  const h = autoHarness({ transcribe: async () => ({ status: 'stale' }) });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.deepEqual(h.warnings, []);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.toasts[0].kind, 'info');
  assert.equal(h.progress.at(-1), null);
  assert.deepEqual(h.processing.at(-1), [null, null]);
  assert.deepEqual(h.queued.at(-1), []);
});

test('auto-interviews: isRunning cubre de la confirmación al final de la cola', async () => {
  const releases = [];
  const h = autoHarness({
    transcribe: () =>
      new Promise((resolve) => {
        releases.push(() => resolve({ status: 'done' }));
      }),
  });

  const run = h.flow.onWorkspaceReady({ draftRestored: false });
  await flush();
  assert.equal(h.flow.isRunning(), true);

  releases[0]();
  await flush();
  releases[1]();
  await withTimeout(run);
  assert.equal(h.flow.isRunning(), false);
});

test('auto-interviews: con voz disponible la pide una vez y pasa las fracciones al selector', async () => {
  const h = autoHarness({ voiceAvailable: true, segments: [{ start: 0, end: 100 }] });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.deepEqual(h.voiceCalls, ['video.mp4']);
  assert.deepEqual(h.pickerArgs[0].voices, [1, 1, 1, 1, 1]);
  assert.equal(h.pickerArgs[0].first, 4);
});

test('auto-interviews: un fallo de la voz abre con voices null y sin aviso', async () => {
  const h = autoHarness({ voiceAvailable: true, voiceError: new Error('no audio') });

  await withoutWarnings(() => h.flow.onWorkspaceReady({ draftRestored: false }));

  assert.equal(h.pickerArgs.length, 1);
  assert.equal(h.pickerArgs[0].voices, null);
  assert.deepEqual(h.warnings, []);
});

test('auto-interviews: un cambio de carga durante la voz no abre el selector', async () => {
  const h = autoHarness({
    voiceAvailable: true,
    segments: [{ start: 0, end: 100 }],
    onVoice: (state) => {
      state.xml = { path: 'otro.xml', name: 'otro.xml', parsed: { fps: 25 } };
    },
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.deepEqual(h.pickerArgs, []);
  assert.equal(h.state.shots.some((shot) => shot.interview), false);
});

test('auto-interviews: mientras se detecta la voz no abre otro selector', async () => {
  let releaseVoice;
  const h = autoHarness({
    voiceAvailable: true,
    segments: [{ start: 0, end: 100 }],
    onVoice: () =>
      new Promise((resolve) => {
        releaseVoice = resolve;
      }),
  });

  const first = h.flow.onWorkspaceReady({ draftRestored: false });
  await flush();
  assert.equal(h.flow.isPicking(), true);

  await h.flow.openManual();
  await h.flow.onWorkspaceReady({ draftRestored: false });
  assert.equal(h.voiceCalls.length, 1);
  assert.equal(h.pickerArgs.length, 0);

  releaseVoice();
  await withTimeout(first);
  assert.equal(h.pickerArgs.length, 1);
  assert.equal(h.flow.isPicking(), false);
});

test('auto-interviews: un idioma desconocido lanza un error claro y no encola', async () => {
  const h = autoHarness({
    pickerResult: { first: 4, transcribe: [5], languages: { 5: 'xx' } },
  });

  await assert.rejects(
    h.flow.onWorkspaceReady({ draftRestored: false }),
    /Unknown language code "xx"/,
  );

  assert.deepEqual(h.transcribeCalls, []);
  assert.equal(h.state.shots.some((shot) => shot.interview), false);
  assert.equal(h.flow.isPicking(), false);
});

test('auto-interviews: fija Language antes de encolar y transcribe solo las marcadas', async () => {
  const h = autoHarness({
    pickerResult: { first: 4, transcribe: [5], languages: { 5: 'fr' } },
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.deepEqual(h.state.shots.map((shot) => shot.interview), [false, false, false, true, true]);
  assert.equal(h.state.shots[4].soundbite.language, 'French');
  assert.deepEqual(h.transcribeCalls, [{ number: 5, quiet: true, language: 'fr' }]);
  assert.deepEqual(h.translateCalls, [5]);
});

test('openManual: abre en modo manual con la primera entrevista actual', async () => {
  const h = autoHarness();
  h.state.shots = setInterview(h.state.shots, 3, true);

  await h.flow.openManual();

  assert.equal(h.pickerArgs[0].mode, 'manual');
  assert.equal(h.pickerArgs[0].first, 3);
  assert.equal(h.pickerArgs[0].voices, null);
});

test('openManual: mover el límite a la derecha quita la entrevista que sale', async () => {
  const h = autoHarness({
    pickerResult: { first: 4, transcribe: [4, 5], languages: { 4: null, 5: null } },
  });
  h.state.shots = setInterview(h.state.shots, 3, true);

  await h.flow.openManual();

  assert.deepEqual(h.state.shots.map((shot) => shot.interview), [false, false, false, true, true]);
  assert.deepEqual(h.transcribeCalls.map((call) => call.number), [4, 5]);
});

test('openManual: con el límite tras el último corte quita todas las entrevistas', async () => {
  const h = autoHarness({
    pickerResult: { first: 6, transcribe: [], languages: {} },
  });
  h.state.shots = setInterview(h.state.shots, 3, true);

  await h.flow.openManual();

  assert.deepEqual(h.state.shots.map((shot) => shot.interview), [false, false, false, false, false]);
  assert.deepEqual(h.transcribeCalls, []);
  assert.deepEqual(h.toasts, []);
});

test('openManual: reutiliza las voces de la carga sin volver a pedirlas', async () => {
  const h = autoHarness({ voiceAvailable: true, segments: [{ start: 0, end: 100 }] });

  await h.flow.onWorkspaceReady({ draftRestored: false });
  await h.flow.openManual();

  assert.equal(h.voiceCalls.length, 1);
  assert.deepEqual(h.pickerArgs[1].voices, [1, 1, 1, 1, 1]);
});

test('openManual: no hace nada con una cola en marcha', async () => {
  const releases = [];
  const h = autoHarness({
    transcribe: () =>
      new Promise((resolve) => {
        releases.push(() => resolve({ status: 'done' }));
      }),
  });

  const run = h.flow.onWorkspaceReady({ draftRestored: false });
  await flush();
  assert.equal(h.flow.isRunning(), true);

  await h.flow.openManual();
  assert.equal(h.pickerArgs.length, 1);

  releases[0]();
  await flush();
  releases[1]();
  await withTimeout(run);
});


// --- Correcciones de la revisión ------------------------------------------

test('auto-interviews: una cola vieja que termina tarde no limpia la nueva', async () => {
  let releaseOld;
  let oldPending = true;
  const h = autoHarness({
    transcribe: () => {
      if (oldPending) {
        oldPending = false;
        return new Promise((resolve) => {
          releaseOld = () => resolve({ status: 'stale' });
        });
      }
      return Promise.resolve({ status: 'done' });
    },
  });

  const first = h.flow.onWorkspaceReady({ draftRestored: false });
  await flush();
  assert.equal(h.transcribeCalls.length, 1);

  // Carga nueva de verdad: cambia el vídeo y el XML, y llegan planos nuevos.
  h.state.video = { path: 'otro.mp4', name: 'otro.mp4', url: '', loaded: true };
  h.state.xml = { path: 'otro.xml', name: 'otro.xml', parsed: { fps: 25 } };
  h.state.shots = createShots(AUTO_CUTS.map(([startFrame, endFrame]) => ({ startFrame, endFrame })));

  const second = h.flow.onWorkspaceReady({ draftRestored: false });
  for (let i = 0; i < 10 && h.transcribeCalls.length < 3; i += 1) await flush();
  await withTimeout(second);
  // La vieja pidió el 4 y la nueva el 4 y el 5 del montaje nuevo.
  assert.equal(h.transcribeCalls.length, 3);

  const before = {
    progress: h.progress.length,
    queued: h.queued.length,
    processing: h.processing.length,
    cleared: h.queued.filter((numbers) => numbers.length === 0).length,
    finished: h.progress.filter((text) => text === null).length,
  };

  // La cola vieja despierta ahora y sale por 'stale': no debe tocar la interfaz.
  releaseOld();
  await withTimeout(first);

  assert.equal(h.progress.length, before.progress);
  assert.equal(h.queued.length, before.queued);
  assert.equal(h.processing.length, before.processing);
  assert.equal(h.queued.filter((numbers) => numbers.length === 0).length, before.cleared);
  assert.equal(h.progress.filter((text) => text === null).length, before.finished);
  assert.equal(h.flow.isRunning(), false);
});

test('auto-interviews: sin ningún paso «done» no hay toast de éxito', async () => {
  const h = autoHarness({
    transcribe: async () => ({ status: 'skipped' }),
    translate: async () => ({ status: 'skipped' }),
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.equal(h.toasts.length, 1);
  assert.equal(h.toasts[0].kind, 'info');
});

test('auto-interviews: sin traducciones lanzadas no anuncia la fase de traducción', async () => {
  const h = autoHarness({
    transcribe: async () => ({ status: 'failed', error: new Error('boom') }),
  });

  await h.flow.onWorkspaceReady({ draftRestored: false });

  assert.ok(!h.progress.some((text) => text && text.startsWith('Translating ')));
  assert.equal(h.progress.at(-1), null);
  assert.equal(h.warnings.length, 1);
});


// --- Retranscripción y traducción forzada (16) ----------------------------

test('translateShot: replace sustituye la traducción existente sin confirmar', async () => {
  const { flow, state, log } = translateHarness({
    translate: async () => ({ text: 'Nouveau' }),
  });
  state.shots = updateShot(state.shots, 2, { soundbite: { translation: 'Ancienne' } });

  const result = await flow.translateShot(2, { quiet: true, replace: true });

  assert.deepEqual(result, { status: 'done' });
  assert.equal(state.shots[1].soundbite.translation, 'Nouveau');
  assert.ok(!log.includes('confirm'));
});

test('translateShot: replace espera a la pasada anterior y traduce el Original actual', async () => {
  const calls = [];
  const releases = new Map();
  const { flow, state } = translateHarness({
    translate: (text) =>
      new Promise((resolve) => {
        calls.push(text);
        releases.set(text, () => resolve({ text: `EN ${text}` }));
      }),
  });
  state.shots = updateShot(state.shots, 2, {
    soundbite: { original: 'Bonjour', translation: '' },
  });

  const first = flow.translateShot(2, { quiet: true, replace: true });
  await flush();
  assert.deepEqual(calls, ['Bonjour']);

  // La retranscripción nueva cambia Original mientras la traducción vieja sigue viva.
  state.shots = updateShot(state.shots, 2, { soundbite: { original: 'Hallo' } });
  const second = flow.translateShot(2, { quiet: true, replace: true });
  await flush();
  assert.deepEqual(calls, ['Bonjour']);

  releases.get('Bonjour')();
  assert.deepEqual(await first, { status: 'discarded' });
  await flush();
  assert.deepEqual(calls, ['Bonjour', 'Hallo']);

  releases.get('Hallo')();
  assert.deepEqual(await second, { status: 'done' });
  assert.equal(state.shots[1].soundbite.translation, 'EN Hallo');
});

test('transcribeShot: con language fuerza el idioma sin confirmar ni tocar Language', async () => {
  const { flow, state, log, calls } = transcribeHarness({
    transcribe: async () => ({ text: 'Bonjour', language: 'fr', languageName: 'French' }),
  });
  state.shots = updateShot(state.shots, 2, {
    soundbite: { original: 'Ancien', language: 'French' },
  });

  const result = await flow.transcribeShot(2, { quiet: true, language: 'fr' });

  assert.deepEqual(result, { status: 'done' });
  assert.deepEqual(calls, [['video.mp4', 2, 7, 'fr']]);
  assert.equal(state.shots[1].soundbite.original, 'Bonjour');
  assert.equal(state.shots[1].soundbite.language, 'French');
  assert.ok(!log.includes('confirm'));
  assert.ok(!log.includes('flash'));
});

test('transcribeShot: descarta si Language ya no coincide con el forzado', async () => {
  const { flow, state, log } = transcribeHarness({
    transcribe: async () => ({ text: 'Bonjour', language: 'fr', languageName: 'French' }),
  });
  state.shots = updateShot(state.shots, 2, {
    soundbite: { original: 'Ancien', language: 'German' },
  });

  const result = await flow.transcribeShot(2, { quiet: true, language: 'fr' });

  assert.deepEqual(result, { status: 'discarded' });
  assert.equal(state.shots[1].soundbite.original, 'Ancien');
  assert.ok(!log.includes('say Transcription discarded'));
});

// --- Cola de retranscripción (16.3) ---------------------------------------

function retranscribeShots() {
  return createShots([
    { startFrame: 0, endFrame: 50 },
    { startFrame: 50, endFrame: 175 },
    { startFrame: 175, endFrame: 225 },
    { startFrame: 225, endFrame: 300 },
    { startFrame: 300, endFrame: 450 },
    { startFrame: 450, endFrame: 500 },
  ]).map((shot) => {
    if (shot.number !== 3 && shot.number !== 5) return shot;
    return {
      ...shot,
      interview: true,
      soundbite: { ...shot.soundbite, original: 'Hola', language: 'Spanish' },
    };
  });
}

function retranscribeHarness({
  transcribe = async () => ({ status: 'done' }),
  translate = async () => ({ status: 'done' }),
  confirm = async () => true,
  available = true,
  video = { loaded: true, path: 'video.mp4' },
} = {}) {
  const state = {
    shots: retranscribeShots(),
    selected: 3,
    video,
    xml: { path: 'montaje.xml', parsed: { fps: 25 } },
  };
  const log = [];
  const toasts = [];
  const warnings = [];
  const progress = [];
  const processing = [];
  const queued = [];
  const modalArgs = [];
  const transcribeCalls = [];
  const translateCalls = [];
  let bannerState = null;

  const flow = createRetranscribeFlow({
    state,
    banner: {
      current: () => bannerState,
      showWarning: (options) => {
        warnings.push(options);
        if (bannerState !== 'error') bannerState = 'warning';
      },
      clear: () => {
        bannerState = null;
      },
    },
    bannerRegion: { querySelector: () => null },
    toasts: { show: (options) => toasts.push(options) },
    announce: (text) => log.push(`say ${text}`),
    refreshAll: () => log.push('refresh'),
    confirmRetranscribe: async (options) => {
      modalArgs.push(options);
      return confirm(options);
    },
    transcribeShot: async (number, options) => {
      transcribeCalls.push([number, options.language]);
      return transcribe(number, options);
    },
    translateShot: async (number, options) => {
      translateCalls.push([number, options.replace]);
      return translate(number, options);
    },
    transcriberAvailable: () => available,
    setProgress: (text) => progress.push(text),
    setProcessing: (number, kind) => processing.push([number, kind]),
    setQueued: (numbers) => queued.push([...numbers]),
  });

  return {
    flow,
    state,
    log,
    toasts,
    warnings,
    progress,
    processing,
    queued,
    modalArgs,
    transcribeCalls,
    translateCalls,
  };
}

async function waitIdle(flow) {
  for (let i = 0; i < 50 && flow.isRunning(); i += 1) await flush();
  assert.equal(flow.isRunning(), false);
}

// Flujo real de transcripción y traducción para comprobar el reemplazo de 16.
function retranscribeWithFlows() {
  const state = {
    shots: retranscribeShots(),
    selected: 2,
    video: { loaded: true, path: 'video.mp4' },
    xml: { path: 'montaje.xml', parsed: { fps: 25 } },
  };
  state.shots = state.shots.map((shot) =>
    shot.number === 2
      ? {
          ...shot,
          interview: true,
          soundbite: {
            ...shot.soundbite,
            original: 'Hola',
            language: 'Spanish',
            translation: 'Ancienne',
          },
        }
      : shot,
  );
  const log = [];
  const transcribeCalls = [];
  const translateCalls = [];
  const toasts = [];
  const modalArgs = [];
  let bannerState = null;
  const banner = {
    current: () => bannerState,
    showWarning: () => {
      bannerState = 'warning';
    },
    clear: () => {
      bannerState = null;
    },
  };
  const commit = () => log.push('commit');
  const refreshAll = () => log.push('refresh');
  const announce = (text) => log.push(`say ${text}`);

  const transcribeFlow = createTranscribeFlow({
    state,
    dsw: {
      transcribe: async (...args) => {
        transcribeCalls.push(args);
        return { text: 'Bonjour', language: 'fr', languageName: 'French' };
      },
    },
    banner,
    bannerRegion: { querySelector: () => null },
    editor: {
      setTranscribing: (number) => log.push(`transcribing ${number}`),
      setTranscriberAvailable: () => {},
      flashLanguage: () => log.push('flash'),
    },
    announce,
    commit,
    refreshAll,
    confirmReplace: async () => {
      log.push('confirmReplace');
      return true;
    },
  });
  transcribeFlow.setAvailability({ available: true, missing: [] });

  const translateFlow = createTranslateFlow({
    state,
    dsw: {
      translate: async (text, target) => {
        translateCalls.push([text, target]);
        return { text: 'Hello' };
      },
    },
    banner,
    bannerRegion: { querySelector: () => null },
    editor: { setTranslating: () => {} },
    announce,
    commit,
    toasts: { show: (options) => toasts.push(options) },
    refreshAll,
    isTranscribing: (number) => transcribeFlow.isTranscribing(number),
    confirmReplace: async () => {
      log.push('confirmTranslateReplace');
      return true;
    },
  });

  const flow = createRetranscribeFlow({
    state,
    banner,
    bannerRegion: { querySelector: () => null },
    toasts: { show: (options) => toasts.push(options) },
    announce,
    refreshAll,
    confirmRetranscribe: async (options) => {
      modalArgs.push(options);
      return true;
    },
    transcribeShot: (number, options) => transcribeFlow.transcribeShot(number, options),
    translateShot: (number, options) => translateFlow.translateShot(number, options),
    transcriberAvailable: () => true,
    setProgress: () => {},
    setProcessing: () => {},
    setQueued: () => {},
  });

  return { flow, state, log, toasts, modalArgs, transcribeCalls, translateCalls };
}

test('retranscribe: aceptar reemplaza Original y Translation sin modales', async () => {
  const h = retranscribeWithFlows();
  h.state.shots = updateShot(h.state.shots, 2, { soundbite: { language: 'French' } });

  await h.flow.onLanguageCommit(2, 'Spanish', 'French');
  await waitIdle(h.flow);

  assert.deepEqual(h.modalArgs, [{ number: 2, languageName: 'French' }]);
  assert.deepEqual(h.transcribeCalls, [['video.mp4', 2, 7, 'fr']]);
  assert.deepEqual(h.translateCalls, [['Bonjour', 'en']]);
  assert.equal(h.state.shots[1].soundbite.original, 'Bonjour');
  assert.equal(h.state.shots[1].soundbite.language, 'French');
  assert.equal(h.state.shots[1].soundbite.translation, 'Hello');
  assert.ok(!h.log.includes('confirmReplace'));
  assert.ok(!h.log.includes('confirmTranslateReplace'));
  assert.ok(!h.log.includes('flash'));
  assert.equal(h.toasts.at(-1).title, '1 soundbite retranscribed.');
});

test('retranscribe: no pregunta por mismo idioma, desconocido, imagen o sin Original', async () => {
  const same = retranscribeHarness();
  await same.flow.onLanguageCommit(3, 'Spanish', 'Castellano');
  assert.deepEqual(same.modalArgs, []);

  const unknown = retranscribeHarness();
  await unknown.flow.onLanguageCommit(3, 'Spanish', 'Klingon');
  assert.deepEqual(unknown.modalArgs, []);

  const image = retranscribeHarness();
  await image.flow.onLanguageCommit(4, 'Spanish', 'French');
  assert.deepEqual(image.modalArgs, []);

  const empty = retranscribeHarness();
  empty.state.shots = updateShot(empty.state.shots, 3, { soundbite: { original: '  ' } });
  await empty.flow.onLanguageCommit(3, 'Spanish', 'French');
  assert.deepEqual(empty.modalArgs, []);

  const noVideo = retranscribeHarness({ video: { loaded: false, path: 'video.mp4' } });
  await noVideo.flow.onLanguageCommit(3, 'Spanish', 'French');
  assert.deepEqual(noVideo.modalArgs, []);

  const noTool = retranscribeHarness({ available: false });
  await noTool.flow.onLanguageCommit(3, 'Spanish', 'French');
  assert.deepEqual(noTool.modalArgs, []);
});

test('retranscribe: cola secuencial, N crece y la pasada vieja se descarta', async () => {
  const pending = [];
  let active = 0;
  let maxActive = 0;
  const h = retranscribeHarness({
    transcribe: (number, options) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        pending.push({
          number,
          language: options.language,
          resolve: (result) => {
            active -= 1;
            resolve(result);
          },
        });
      });
    },
  });

  h.state.shots = updateShot(h.state.shots, 3, { soundbite: { language: 'French' } });
  await h.flow.onLanguageCommit(3, 'Spanish', 'French');
  assert.deepEqual(h.transcribeCalls, [[3, 'fr']]);

  h.state.shots = updateShot(h.state.shots, 5, { soundbite: { language: 'French' } });
  await h.flow.onLanguageCommit(5, 'Spanish', 'French');

  h.state.shots = updateShot(h.state.shots, 3, { soundbite: { language: 'German' } });
  await h.flow.onLanguageCommit(3, 'French', 'German');

  assert.ok(h.progress.includes('Retranscribing 1 of 1\u2026'));
  assert.ok(h.progress.includes('Retranscribing 1 of 2\u2026'));
  assert.ok(h.progress.includes('Retranscribing 1 of 3\u2026'));

  pending[0].resolve({ status: 'discarded' });
  await flush();
  assert.deepEqual(h.transcribeCalls, [[3, 'fr'], [5, 'fr']]);

  pending[1].resolve({ status: 'done' });
  await flush();
  assert.deepEqual(h.transcribeCalls, [[3, 'fr'], [5, 'fr'], [3, 'de']]);

  pending[2].resolve({ status: 'done' });
  await waitIdle(h.flow);

  assert.equal(maxActive, 1);
  assert.deepEqual(h.translateCalls, [[5, true], [3, true]]);
  assert.ok(h.progress.includes('Retranscribing 2 of 3\u2026'));
  assert.ok(h.progress.includes('Retranscribing 3 of 3\u2026'));
  assert.equal(h.toasts.length, 2);
  assert.equal(h.toasts[0].title, 'Retranscribing 1 soundbite in the background');
  assert.equal(h.toasts.at(-1).title, '2 soundbites retranscribed.');
  assert.equal(h.progress.at(-1), null);
  assert.deepEqual(h.queued.at(-1), []);
});

test('retranscribe: un fallo no detiene la cola y Try again repite solo el fallido', async () => {
  let fail = true;
  const h = retranscribeHarness({
    transcribe: async (number) => {
      if (fail && number === 5) {
        return { status: 'failed', error: new Error('No speech found in this cut.') };
      }
      return { status: 'done' };
    },
  });

  h.state.shots = updateShot(h.state.shots, 3, { soundbite: { language: 'French' } });
  await h.flow.onLanguageCommit(3, 'Spanish', 'French');
  h.state.shots = updateShot(h.state.shots, 5, { soundbite: { language: 'French' } });
  await h.flow.onLanguageCommit(5, 'Spanish', 'French');
  await waitIdle(h.flow);

  assert.deepEqual(h.transcribeCalls, [[3, 'fr'], [5, 'fr']]);
  assert.deepEqual(h.translateCalls, [[3, true]]);
  assert.equal(h.warnings.length, 1);
  assert.equal(h.warnings[0].title, "Couldn't transcribe 1 soundbite.");
  assert.equal(h.warnings[0].detail, 'Shot 5: No speech found in this cut.');
  assert.equal(h.warnings[0].action.label, 'Try again');
  assert.ok(!h.toasts.some((toast) => toast.kind === 'success'));

  fail = false;
  h.transcribeCalls.length = 0;
  h.translateCalls.length = 0;
  await h.warnings[0].action.onClick();
  await waitIdle(h.flow);

  assert.deepEqual(h.transcribeCalls, [[5, 'fr']]);
  assert.deepEqual(h.translateCalls, [[5, true]]);
  assert.equal(h.toasts.at(-1).title, '1 soundbite retranscribed.');
});

test('retranscribe: Try again de una traducción fallida no retranscribe', async () => {
  let fail = true;
  const h = retranscribeHarness({
    translate: async (number) => {
      if (fail && number === 5) return { status: 'failed', error: new Error('Offline.') };
      return { status: 'done' };
    },
  });

  h.state.shots = updateShot(h.state.shots, 5, { soundbite: { language: 'French' } });
  await h.flow.onLanguageCommit(5, 'Spanish', 'French');
  await waitIdle(h.flow);

  assert.equal(h.warnings[0].title, "Couldn't translate 1 soundbite.");

  fail = false;
  h.transcribeCalls.length = 0;
  h.translateCalls.length = 0;
  await h.warnings[0].action.onClick();
  await waitIdle(h.flow);

  assert.deepEqual(h.transcribeCalls, []);
  assert.deepEqual(h.translateCalls, [[5, true]]);
});

test('retranscribe: un cambio de carga para la cola y no pinta nada más', async () => {
  let release;
  const h = retranscribeHarness({
    transcribe: () =>
      new Promise((resolve) => {
        release = () => resolve({ status: 'done' });
      }),
  });
  h.state.shots = updateShot(h.state.shots, 3, { soundbite: { language: 'French' } });

  await h.flow.onLanguageCommit(3, 'Spanish', 'French');
  assert.equal(h.flow.isRunning(), true);

  h.state.xml = { path: 'otro.xml', parsed: { fps: 25 } };
  release();
  await waitIdle(h.flow);

  assert.deepEqual(h.warnings, []);
  assert.deepEqual(h.translateCalls, []);
  assert.equal(h.toasts.length, 1);
  assert.equal(h.toasts[0].kind, 'info');
  assert.equal(h.progress.at(-1), null);
  assert.deepEqual(h.processing.at(-1), [null, null]);
  assert.deepEqual(h.queued.at(-1), []);
});
