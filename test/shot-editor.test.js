// Pruebas del módulo shot-editor: solo las funciones puras. Sin red y sin DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  interviewHelp,
  copyTooltip,
  missingText,
  fieldErrors,
  translateTooltip,
  transcribeTooltip,
  mount,
} from '../renderer/shot-editor.js';

// Construye un plano con los valores por defecto, permitiendo sobrescribir campos.
function makeShot(number, overrides = {}) {
  const base = {
    number,
    startFrame: number * 10,
    endFrame: number * 10 + 10,
    size: '',
    movement: '',
    description: '',
    interview: false,
    soundbite: {
      name: '',
      profession: '',
      age: '',
      language: 'Spanish',
      gender: '',
      translation: '',
      original: '',
    },
  };
  return { ...base, ...overrides, soundbite: { ...base.soundbite, ...(overrides.soundbite ?? {}) } };
}

function makeShots(count) {
  return Array.from({ length: count }, (_, index) => makeShot(index + 1));
}

test('interviewHelp: encendido, apagado y primera entrevista = plano actual', () => {
  const normal = makeShots(26);
  assert.equal(
    interviewHelp(normal, 24),
    'Turning this on marks shots 24–26 as soundbites.',
  );

  const interviews = normal.map((shot) => (
    shot.number >= 24 ? { ...shot, interview: true } : shot
  ));
  assert.equal(
    interviewHelp(interviews, 25),
    'Turning this off unmarks shots 24–25.',
  );
  assert.equal(
    interviewHelp(interviews, 24),
    'Turning this off unmarks this shot.',
  );
});

test('copyTooltip: plano 1, plano de imagen y entrevista', () => {
  const shots = makeShots(24);
  assert.equal(copyTooltip(shots, 1), 'No previous shot');
  assert.equal(
    copyTooltip(shots, 12),
    'Copy shot size, movement and description from shot 11',
  );

  // Entrevista con anterior entrevista: copia los datos del hablante.
  const interviews = shots.map((shot) => (
    shot.number >= 23 ? { ...shot, interview: true } : shot
  ));
  assert.equal(
    copyTooltip(interviews, 24),
    'Copy speaker details from shot 23',
  );

  // Entrevista con anterior de imagen: no se puede copiar.
  const firstInterview = shots.map((shot) => (
    shot.number === 24 ? { ...shot, interview: true } : shot
  ));
  assert.equal(
    copyTooltip(firstInterview, 24),
    'The previous shot is not an interview',
  );

  // Plano de imagen con anterior entrevista: no se puede copiar.
  const imageAfterInterview = shots.map((shot) => (
    shot.number === 23 ? { ...shot, interview: true } : shot
  ));
  assert.equal(
    copyTooltip(imageAfterInterview, 24),
    'The previous shot is an interview',
  );
});

test('missingText: plano normal, entrevista y completos', () => {
  assert.equal(missingText(makeShot(1)), 'Missing: shot size, description');
  assert.equal(missingText(makeShot(1, { interview: true })), 'Missing: name, gender');
  assert.equal(
    missingText(makeShot(1, { size: 'Wide shot', description: 'Algo' })),
    '',
  );
  assert.equal(
    missingText(makeShot(1, {
      interview: true,
      soundbite: { name: 'Ana', gender: 'woman', language: 'Spanish' },
    })),
    '',
  );
});

test('fieldErrors: obligatorios vacíos y edad inválida', () => {
  assert.deepEqual(fieldErrors(makeShot(1)), {
    size: 'Choose a shot size.',
    description: 'Write a description.',
  });

  assert.deepEqual(fieldErrors(makeShot(1, { interview: true })), {
    name: "Enter the speaker's name.",
    gender: 'Choose man or woman.',
  });

  const invalidAge = makeShot(1, {
    interview: true,
    soundbite: {
      name: 'Ana',
      gender: 'woman',
      language: 'Spanish',
      age: '3a',
    },
  });
  assert.deepEqual(fieldErrors(invalidAge), {
    age: 'Age must be digits only, e.g. 34.',
  });

  const validAge = makeShot(1, {
    interview: true,
    soundbite: {
      name: 'Ana',
      gender: 'woman',
      language: 'Spanish',
      age: '34',
    },
  });
  assert.deepEqual(fieldErrors(validAge), {});
});

test('translateTooltip: original vacío, con texto y en traducción', () => {
  const empty = makeShot(1, { interview: true });
  assert.equal(translateTooltip(empty, false), 'Write the original text first');

  const blank = makeShot(1, {
    interview: true,
    soundbite: { original: '   ' },
  });
  assert.equal(translateTooltip(blank, false), 'Write the original text first');

  const withText = makeShot(1, {
    interview: true,
    soundbite: { original: 'Hola' },
  });
  assert.equal(
    translateTooltip(withText, false),
    'Translate Original into English (online service)',
  );

  // El destino sigue al idioma (14.4): inglés → español; otro o vacío → inglés.
  const english = makeShot(1, { interview: true, soundbite: { original: 'Hi', language: 'English' } });
  assert.equal(translateTooltip(english, false), 'Translate Original into Spanish (online service)');
  const unset = makeShot(1, { interview: true, soundbite: { original: 'Hola', language: '' } });
  assert.equal(translateTooltip(unset, false), 'Translate Original into English (online service)');

  // Mientras se transcribe, espera (pero `busy` sigue mandando).
  assert.equal(translateTooltip(withText, false, true), 'Wait for the transcription to finish');
  assert.equal(translateTooltip(withText, true, true), 'Translating…');

  // `busy` tiene prioridad incluso con el original vacío.
  assert.equal(translateTooltip(empty, true), 'Translating…');
  assert.equal(translateTooltip(withText, true), 'Translating…');
});

test('transcribeTooltip: un texto por estado y respetando la prioridad', () => {
  const shot = makeShot(1, { interview: true });
  const ready = { busy: false, available: true, hasVideo: true, otherBusy: false };
  assert.equal(
    transcribeTooltip(shot, ready),
    'Transcribe this cut from the video (runs on this computer)',
  );
  assert.equal(transcribeTooltip(shot, { ...ready, otherBusy: true }), 'Another cut is being transcribed');
  assert.equal(transcribeTooltip(shot, { ...ready, hasVideo: false, otherBusy: true }), 'Load the video first');
  assert.equal(
    transcribeTooltip(shot, { ...ready, available: false, hasVideo: false }),
    'Transcription is not installed',
  );
  assert.equal(
    transcribeTooltip(shot, { busy: true, available: false, hasVideo: false, otherBusy: true }),
    'Transcribing…',
  );
});

test('el módulo se importa en Node sin lanzar y expone la interfaz pública', () => {
  assert.equal(typeof mount, 'function');
  assert.equal(typeof interviewHelp, 'function');
  assert.equal(typeof copyTooltip, 'function');
  assert.equal(typeof missingText, 'function');
  assert.equal(typeof fieldErrors, 'function');
  assert.equal(typeof translateTooltip, 'function');
  assert.equal(typeof transcribeTooltip, 'function');
  assert.equal(typeof globalThis.document, 'undefined');
});

// --- DOM mínimo para ejercitar mount() sin navegador -----------------------

class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.childNodes = this.children;
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this._classes = new Set();
    this._listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.checked = false;
    this.hidden = false;
    this.disabled = false;
  }

  get classList() {
    const classes = this._classes;
    return {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => {
        const on = force === undefined ? !classes.has(name) : force;
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
      contains: (name) => classes.has(name),
    };
  }

  set className(value) {
    this._classes = new Set(String(value).split(/\s+/).filter(Boolean));
  }

  get className() {
    return [...this._classes].join(' ');
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  append(...nodes) {
    nodes.forEach((node) => this.appendChild(node));
  }

  replaceChildren(...nodes) {
    this.children = [];
    this.append(...nodes);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = value;
    if (name === 'id') this.id = String(value);
    if (name === 'value') this.value = String(value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  dispatch(type, event = {}) {
    const full = { type, preventDefault() {}, ...event };
    for (const handler of this._listeners.get(type) ?? []) handler(full);
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: 200, height: 20, right: 200, bottom: 20 };
  }

  querySelector(selector) {
    const className = selector.startsWith('.') ? selector.slice(1) : null;
    if (!className) return null;
    return findByClass(this, className);
  }

  matches() {
    return false;
  }

  contains() {
    return false;
  }

  remove() {}
}

function fakeDocument() {
  return {
    body: new FakeNode('body'),
    activeElement: null,
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (_ns, tag) => new FakeNode(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
    addEventListener() {},
  };
}

function findByClass(node, className) {
  if (node._classes?.has(className)) return node;
  for (const child of node.children ?? []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function mountEditor() {
  globalThis.document = fakeDocument();
  globalThis.window = { innerWidth: 1200 };
  const root = new FakeNode('div');
  const calls = [];
  const editor = mount(root, {
    onPatch: (number, patch) => calls.push({ type: 'patch', number, patch }),
    onInterview: (number, value) => calls.push({ type: 'interview', number, value }),
    onCopyPrevious: (number) => calls.push({ type: 'copy', number }),
    onNextPending: () => calls.push({ type: 'next' }),
    onTranslate: (number) => calls.push({ type: 'translate', number }),
    onTranscribe: (number) => calls.push({ type: 'transcribe', number }),
    onLanguageCommit: (number, previous, value) =>
      calls.push({ type: 'language', number, previous, value }),
  });
  return { editor, root, calls, copyButton: findByClass(root, 'shot-editor__copy') };
}

test('mount: el textarea Original lleva spellcheck="false" (texto en otro idioma)', () => {
  const { root } = mountEditor();
  const original = findById(root, 'shot-editor-original');
  assert.equal(original.getAttribute('spellcheck'), 'false');

  // El resto de campos siguen con el corrector por defecto (sin atributo).
  assert.equal(findById(root, 'shot-editor-translation').getAttribute('spellcheck'), null);
  assert.equal(findById(root, 'shot-editor-description').getAttribute('spellcheck'), null);
  assert.equal(findById(root, 'shot-editor-name').getAttribute('spellcheck'), null);
});

test('mount: «Copy from previous» se habilita entre entrevistas y copia', () => {
  const { editor, calls, copyButton } = mountEditor();
  const shots = [
    makeShot(1, { interview: true }),
    makeShot(2, { interview: true }),
  ];

  editor.render({ shots, number: 2, fps: 25, nextPending: null, showErrors: false });
  assert.equal(copyButton.classList.contains('is-disabled'), false);

  copyButton.dispatch('click');
  assert.deepEqual(calls, [{ type: 'copy', number: 2 }]);
});

test('mount: «Copy from previous» deshabilitado en plano 1 y por tipo distinto', () => {
  const { editor, calls, copyButton } = mountEditor();

  // Plano 1: sin anterior.
  editor.render({
    shots: [makeShot(1, { interview: true })],
    number: 1,
    fps: 25,
    nextPending: null,
    showErrors: false,
  });
  assert.equal(copyButton.classList.contains('is-disabled'), true);

  // Primera entrevista tras planos de imagen: anterior no es entrevista.
  editor.render({
    shots: [makeShot(1), makeShot(2, { interview: true })],
    number: 2,
    fps: 25,
    nextPending: null,
    showErrors: false,
  });
  assert.equal(copyButton.classList.contains('is-disabled'), true);

  // Plano de imagen tras entrevista: anterior no es imagen.
  editor.render({
    shots: [makeShot(1, { interview: true }), makeShot(2)],
    number: 2,
    fps: 25,
    nextPending: null,
    showErrors: false,
  });
  assert.equal(copyButton.classList.contains('is-disabled'), true);

  // Un clic deshabilitado no emite nada.
  copyButton.dispatch('click');
  assert.deepEqual(calls, []);
});

test('mount: tras copiar, el editor refleja los nuevos valores del hablante', () => {
  const { editor, root } = mountEditor();
  const shots = [
    makeShot(1, {
      interview: true,
      soundbite: { name: 'Ana', age: '34', profession: 'Periodista', gender: 'woman' },
    }),
    makeShot(2, { interview: true }),
  ];

  editor.render({ shots, number: 2, fps: 25, nextPending: null, showErrors: false });
  assert.equal(findById(root, 'shot-editor-name').value, '');
  assert.equal(findById(root, 'shot-editor-age').value, '');
  assert.equal(findById(root, 'shot-editor-profession').value, '');

  // El editor refleja el estado nuevo que le pasa app.js tras el commit.
  const copied = [
    shots[0],
    { ...shots[1], soundbite: { ...shots[1].soundbite, name: 'Ana', age: '34', profession: 'Periodista', gender: 'woman' } },
  ];
  editor.render({ shots: copied, number: 2, fps: 25, nextPending: null, showErrors: false });
  assert.equal(findById(root, 'shot-editor-name').value, 'Ana');
  assert.equal(findById(root, 'shot-editor-age').value, '34');
  assert.equal(findById(root, 'shot-editor-profession').value, 'Periodista');
  const genderInputs = [];
  const collect = (node) => {
    if (node.tagName === 'input' && node.getAttribute('name') === 'shot-editor-gender') {
      genderInputs.push(node);
    }
    for (const child of node.children ?? []) collect(child);
  };
  collect(root);
  assert.equal(genderInputs.find((input) => input.checked)?.value, 'woman');
});

test('mount: copiar sobrescribe una edad inválida escrita en el campo', () => {
  const { editor, root } = mountEditor();
  const shots = [
    makeShot(1, { interview: true, soundbite: { age: '34' } }),
    makeShot(2, { interview: true }),
  ];

  editor.render({ shots, number: 2, fps: 25, nextPending: null, showErrors: false });
  const ageInput = findById(root, 'shot-editor-age');
  // El usuario escribe una edad inválida (no llega al modelo).
  ageInput.value = '5a';
  ageInput.dispatch('input');

  // Tras copiar, el modelo tiene la edad del anterior y el campo se sincroniza.
  const copied = [
    shots[0],
    { ...shots[1], soundbite: { ...shots[1].soundbite, age: '34' } },
  ];
  editor.render({ shots: copied, number: 2, fps: 25, nextPending: null, showErrors: false });
  assert.equal(ageInput.value, '34');
});

function renderInterview(editor, { original = '', language = 'Spanish', number = 1, count = 1 } = {}) {
  const shots = Array.from({ length: count }, (_, index) =>
    makeShot(index + 1, { interview: true, soundbite: { original: index + 1 === number ? original : '', language } }),
  );
  editor.render({ shots, number, fps: 25, nextPending: null, showErrors: false });
}

test('mount: Transcribe está en la fila de Original, desactivado hasta que haya herramienta', () => {
  const { editor, root, calls } = mountEditor();
  renderInterview(editor);
  const transcribe = findByClass(root, 'transcribe-button');
  assert.equal(transcribe.getAttribute('aria-label'), 'Transcribe');
  assert.equal(transcribe.classList.contains('is-disabled'), true);

  transcribe.dispatch('click');
  assert.deepEqual(calls, []);

  editor.setTranscriberAvailable(true);
  assert.equal(transcribe.classList.contains('is-disabled'), false);
  transcribe.dispatch('click');
  assert.deepEqual(calls, [{ type: 'transcribe', number: 1 }]);
});

test('mount: transcribiendo el plano mostrado, Original es de solo lectura y Translate se desactiva', () => {
  const { editor, root, calls } = mountEditor();
  renderInterview(editor, { original: 'Hola' });
  editor.setTranscriberAvailable(true);
  const original = findById(root, 'shot-editor-original');
  const transcribe = findByClass(root, 'transcribe-button');
  const translate = findByClass(root, 'translate-button');
  assert.equal(translate.classList.contains('is-disabled'), false);

  editor.setTranscribing(1);
  assert.equal(original.readOnly, true);
  assert.equal(original.getAttribute('aria-busy'), 'true');
  assert.equal(transcribe.classList.contains('is-loading'), true);
  assert.equal(translate.classList.contains('is-disabled'), true);
  translate.dispatch('click');
  assert.deepEqual(calls, []);

  editor.setTranscribing(null);
  assert.equal(original.readOnly, false);
  assert.equal(original.getAttribute('aria-busy'), null);
  assert.equal(translate.classList.contains('is-disabled'), false);
});

test('mount: con otro plano en transcripción, Transcribe queda desactivado y Original editable', () => {
  const { editor, root, calls } = mountEditor();
  renderInterview(editor, { count: 2, number: 2 });
  editor.setTranscriberAvailable(true);
  editor.setTranscribing(1);
  const original = findById(root, 'shot-editor-original');
  const transcribe = findByClass(root, 'transcribe-button');
  assert.equal(original.readOnly, false);
  assert.equal(transcribe.classList.contains('is-disabled'), true);
  transcribe.dispatch('click');
  assert.deepEqual(calls, []);
});

test('mount: el marcador de Translation y de Original siguen al estado', () => {
  const { editor, root } = mountEditor();
  renderInterview(editor, { language: 'English' });
  const translation = findById(root, 'shot-editor-translation');
  const original = findById(root, 'shot-editor-original');
  assert.equal(translation.placeholder, 'Spanish translation of what they say');

  renderInterview(editor, { language: 'Spanish' });
  assert.equal(translation.placeholder, 'English translation of what they say');

  editor.setTranscribing(1);
  assert.equal(original.placeholder, 'Transcribing…');
  editor.setTranscribing(null);
  assert.equal(original.placeholder, 'What they say, in the original language');
});

test('mount: flashLanguage marca Language y animationend lo quita', () => {
  const { editor, root } = mountEditor();
  renderInterview(editor);
  const language = findById(root, 'shot-editor-language');
  editor.flashLanguage();
  assert.equal(language.classList.contains('is-autofilled'), true);
  language.dispatch('animationend');
  assert.equal(language.classList.contains('is-autofilled'), false);

  editor.flashLanguage();
  renderInterview(editor, { count: 2, number: 2 });
  assert.equal(language.classList.contains('is-autofilled'), false);
});

test('mount: sin vídeo cargado Transcribe se desactiva, y vuelve al cargarlo', () => {
  const { editor, root, calls } = mountEditor();
  renderInterview(editor);
  editor.setTranscriberAvailable(true);
  const transcribe = findByClass(root, 'transcribe-button');
  editor.setVideoLoaded(false);
  assert.equal(transcribe.classList.contains('is-disabled'), true);
  transcribe.dispatch('click');
  assert.deepEqual(calls, []);

  editor.setVideoLoaded(true);
  assert.equal(transcribe.classList.contains('is-disabled'), false);
});

test('mount: Language trae la lista de idiomas y avisa al cambiar el valor', () => {
  const { editor, root, calls } = mountEditor();
  renderInterview(editor, { language: 'Spanish' });
  const language = findById(root, 'shot-editor-language');

  assert.equal(language.getAttribute('list'), 'shot-editor-language-list');
  const list = findById(root, 'shot-editor-language-list');
  assert.deepEqual(
    list.children.map((option) => option.getAttribute('value')),
    ['English', 'Spanish', 'Catalan', 'Basque', 'Galician', 'French', 'German', 'Italian', 'Portuguese'],
  );

  // Cambia el texto (onInput sigue igual) y al confirmar avisa con el valor al enfocar.
  language.value = 'French';
  language.dispatch('input');
  assert.deepEqual(calls.at(-1), { type: 'patch', number: 1, patch: { soundbite: { language: 'French' } } });

  language.dispatch('focus');
  language.value = 'German';
  language.dispatch('change');
  assert.deepEqual(calls.at(-1), {
    type: 'language',
    number: 1,
    previous: 'French',
    value: 'German',
  });

  // Sin cambio real no avisa.
  const before = calls.length;
  language.dispatch('focus');
  language.dispatch('change');
  assert.equal(calls.length, before);
});

test('mount: un plano en espera desactiva Transcribe con «Queued for transcription»', () => {
  const { editor, root, calls } = mountEditor();
  renderInterview(editor);
  editor.setTranscriberAvailable(true);
  const transcribe = findByClass(root, 'transcribe-button');
  assert.equal(transcribe.classList.contains('is-disabled'), false);

  editor.setQueued([1]);
  assert.equal(transcribe.classList.contains('is-disabled'), true);
  assert.equal(
    transcribeTooltip(makeShot(1, { interview: true }), {
      busy: false,
      available: true,
      hasVideo: true,
      otherBusy: false,
      queued: true,
    }),
    'Queued for transcription',
  );
  transcribe.dispatch('click');
  assert.deepEqual(calls, []);

  editor.setQueued([]);
  assert.equal(transcribe.classList.contains('is-disabled'), false);
});
