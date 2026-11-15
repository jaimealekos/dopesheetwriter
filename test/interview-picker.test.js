// Pruebas del selector de entrevistas (17): DOM mínimo, sin red ni Electron.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { openInterviewPicker } from '../renderer/interview-picker.js';

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this._classes = new Set();
    this._listeners = new Map();
    this._text = '';
    this.style = {
      values: new Map(),
      setProperty(name, value) {
        this.values.set(name, value);
      },
    };
    const classes = this._classes;
    this.classList = {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name)),
      toggle: (name, force) => {
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
      contains: (name) => classes.has(name),
    };
    this.hidden = false;
    this.disabled = false;
    this.checked = false;
    this.value = '';
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.clientWidth = 0;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this.currentTime = 0;
    this.src = '';
    this.paused = true;
    this.loadCount = 0;
  }

  set className(value) {
    this._classes.clear();
    for (const name of String(value).split(/\s+/).filter(Boolean)) this._classes.add(name);
    if (this._barsWidth !== undefined && this._classes.has('interview-picker__bars')) {
      this.clientWidth = this._barsWidth;
    }
  }

  get className() {
    return [...this._classes].join(' ');
  }

  set textContent(value) {
    this._text = String(value);
    this.children = [];
  }

  get textContent() {
    return this._text;
  }

  append(...nodes) {
    for (const node of nodes) {
      if (node === null || node === undefined) continue;
      this.children.push(node);
    }
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  replaceChildren(...nodes) {
    this.children = [...nodes];
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name === 'class') this.className = value;
    if (name === 'id') this.id = String(value);
    if (name === 'hidden') this.hidden = true;
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  removeAttribute(name) {
    this.attributes.delete(name);
    if (name === 'src') this.src = '';
    if (name === 'hidden') this.hidden = false;
  }

  addEventListener(type, handler) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
  }

  removeEventListener(type, handler) {
    this._listeners.get(type)?.delete(handler);
  }

  dispatch(type, event = {}) {
    const full = {
      type,
      target: this,
      preventDefault() {},
      ...event,
    };
    for (const handler of this._listeners.get(type) ?? []) handler(full);
    return full;
  }

  focus() {
    document.activeElement = this;
  }

  blur() {}

  remove() {
    document.body.children = document.body.children.filter((child) => child !== this);
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains?.(node));
  }

  querySelector(selector) {
    if (selector.startsWith('.')) return findByClass(this, selector.slice(1));
    return null;
  }

  matches() {
    return false;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }

  scrollIntoView() {}

  setPointerCapture() {}

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }

  load() {
    this.loadCount += 1;
    this.paused = true;
  }

  get text() {
    return this._text + this.children.map((child) => child.text ?? child.textContent ?? '').join('');
  }
}

function findByClass(node, className) {
  if (node._classes?.has(className)) return node;
  for (const child of node.children ?? []) {
    const found = findByClass(child, className);
    if (found) return found;
  }
  return null;
}

function findAllByClass(node, className, found = []) {
  if (node._classes?.has(className)) found.push(node);
  for (const child of node.children ?? []) findAllByClass(child, className, found);
  return found;
}

function findById(node, id) {
  if (node.id === id) return node;
  for (const child of node.children ?? []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

function byNumber(node, className, number) {
  return findAllByClass(node, className).find(
    (item) => item.dataset.number === String(number),
  );
}

function barByNumber(node, number) {
  return findAllByClass(node, 'interview-picker__bar').find((bar) =>
    String(bar.getAttribute('aria-label')).startsWith(`Shot ${number},`),
  );
}

// Documento falso mínimo, como el de test/feedback.test.js.
function installDocument({ barsWidth } = {}) {
  const body = new FakeNode('body');
  const listeners = new Map();
  const createNode = (tag) => {
    const node = new FakeNode(tag);
    node._barsWidth = barsWidth;
    return node;
  };
  const documentState = {
    body,
    activeElement: null,
    createElement: createNode,
    createElementNS: (_ns, tag) => createNode(tag),
    createTextNode: (text) => ({ textContent: String(text) }),
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    dispatch(type, event = {}) {
      const full = { type, preventDefault() {}, ...event };
      for (const handler of listeners.get(type) ?? []) handler(full);
      return full;
    },
    querySelector: () => null,
  };
  globalThis.document = documentState;
  return documentState;
}

function makeShots(durations, options = {}) {
  const fps = 25;
  let frame = 0;
  return durations.map((seconds, index) => {
    const startFrame = frame;
    frame += Math.round(seconds * fps);
    return {
      number: index + 1,
      startFrame,
      endFrame: frame,
      interview: options.interviews?.[index] ?? false,
      soundbite: { original: options.originals?.[index] ?? '', language: '' },
    };
  });
}

function openPicker(overrides = {}) {
  const documentState = installDocument({ barsWidth: overrides.barsWidth });
  const root = documentState.body;
  const shots = overrides.shots ?? makeShots([10, 10, 10, 20, 15]);
  const options = {
    shots,
    fps: 25,
    first: 4,
    voices: null,
    transcriberAvailable: true,
    languages: [
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
    ],
    thumbnails: { get: () => null, subscribe: () => () => {} },
    videoUrl: null,
    mode: 'auto',
    ...overrides,
  };
  const promise = openInterviewPicker(root, options);
  return { root, promise, documentState, shots };
}

test('abre en F=4 de 5 con las filas 4 y 5 marcadas y resuelve el objeto', async () => {
  const h = openPicker();
  const inputs = findAllByClass(h.root, 'checkbox__input');
  assert.equal(inputs.length, 2);
  assert.equal(inputs[0].checked, true);
  assert.equal(inputs[1].checked, true);

  findByClass(h.root, 'interview-picker__confirm').dispatch('click');
  assert.deepEqual(await h.promise, {
    first: 4,
    transcribe: [4, 5],
    languages: { 4: null, 5: null },
  });
});

test('flecha izquierda en el límite añade la fila 3; Fin no deja entrevistas y desactiva el principal', async () => {
  const h = openPicker();
  const handle = findByClass(h.root, 'interview-picker__handle');
  handle.dispatch('keydown', { key: 'ArrowLeft' });
  assert.equal(findAllByClass(h.root, 'interview-picker__row').length, 3);
  const third = byNumber(h.root, 'checkbox__input', 3);
  assert.equal(third.checked, true);

  handle.dispatch('keydown', { key: 'End' });
  assert.equal(findAllByClass(h.root, 'interview-picker__row').length, 0);
  assert.equal(findByClass(h.root, 'interview-picker__count').text, 'No interviews');
  const confirm = findByClass(h.root, 'interview-picker__confirm');
  assert.equal(confirm.classList.contains('is-disabled'), true);
  assert.equal(confirm.getAttribute('aria-disabled'), 'true');
  findByClass(h.root, 'interview-picker__cancel').dispatch('click');
  assert.equal(await h.promise, null);
});

test('desmarcar la 4 y elegir francés en la 5 devuelve solo la 5 con su idioma', async () => {
  const h = openPicker();
  const fourth = byNumber(h.root, 'checkbox__input', 4);
  fourth.checked = false;
  fourth.dispatch('change');

  const fifth = byNumber(h.root, 'field__select', 5);
  fifth.value = 'fr';
  fifth.dispatch('change');

  findByClass(h.root, 'interview-picker__confirm').dispatch('click');
  assert.deepEqual(await h.promise, {
    first: 4,
    transcribe: [5],
    languages: { 5: 'fr' },
  });
});

test('una entrevista con Original se muestra «Transcribed» y no entra en transcribe', async () => {
  const shots = makeShots([10, 10, 10, 20, 15], {
    originals: ['', '', '', 'Texto ya escrito', ''],
  });
  const h = openPicker({ shots });

  const row = findAllByClass(h.root, 'interview-picker__row')[0];
  assert.equal(row.classList.contains('is-transcribed'), true);
  assert.equal(findByClass(row, 'interview-picker__done').text, 'Transcribed');
  assert.equal(byNumber(h.root, 'checkbox__input', 4).disabled, true);
  assert.equal(byNumber(h.root, 'field__select', 4), undefined);

  findByClass(h.root, 'interview-picker__confirm').dispatch('click');
  assert.deepEqual(await h.promise, {
    first: 4,
    transcribe: [5],
    languages: { 5: null },
  });
});

test('sin transcripción no hay casillas, estimación ni idioma y transcribe va vacío', async () => {
  const h = openPicker({ transcriberAvailable: false });
  assert.equal(findAllByClass(h.root, 'checkbox__input').length, 0);
  assert.equal(findAllByClass(h.root, 'field__select').length, 0);
  assert.equal(findByClass(h.root, 'interview-picker__estimate').hidden, true);
  assert.equal(findByClass(h.root, 'interview-picker__bulk').hidden, true);

  findByClass(h.root, 'interview-picker__confirm').dispatch('click');
  assert.deepEqual(await h.promise, { first: 4, transcribe: [], languages: {} });
});

test('Esc y clic en el fondo resuelven null', async () => {
  const esc = openPicker();
  esc.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await esc.promise, null);

  const backdropCase = openPicker();
  const backdrop = findByClass(backdropCase.root, 'modal-backdrop');
  backdrop.dispatch('pointerdown', { target: backdrop });
  assert.equal(await backdropCase.promise, null);
});

test('la miniatura que llega con la tarjeta abierta se pinta y se cancela la suscripción al cerrar', async () => {
  let listener = null;
  let unsubscribed = false;
  const thumbnails = {
    get: () => undefined,
    subscribe(fn) {
      listener = fn;
      return () => {
        unsubscribed = true;
      };
    },
  };
  const h = openPicker({ thumbnails });
  const bar4 = findAllByClass(h.root, 'interview-picker__bar').find((bar) =>
    String(bar.getAttribute('aria-label')).startsWith('Shot 4,'),
  );
  bar4.dispatch('pointerenter');

  const peek = findByClass(h.root, 'interview-picker__peek');
  assert.equal(peek.classList.contains('is-visible'), true);
  assert.equal(findByClass(h.root, 'interview-picker__peek-thumb').classList.contains('is-loading'), true);

  listener(4, 'blob:thumb-4');
  const image = findByClass(h.root, 'interview-picker__peek-image');
  assert.equal(image.src, 'blob:thumb-4');
  assert.equal(image.hidden, false);
  assert.equal(findByClass(h.root, 'interview-picker__peek-thumb').classList.contains('is-loading'), false);

  h.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await h.promise, null);
  assert.equal(unsubscribed, true);
});

test('avisos y estimación cambian al mover el límite', async () => {
  const shots = makeShots([30, 5, 5, 30, 30]);
  const voices = [0.8, 0.5, 0.5, 0.1, 0.4];
  const h = openPicker({ shots, voices, first: 4 });

  const notes = findAllByClass(h.root, 'interview-picker__note').map((note) => note.text);
  assert.deepEqual(notes, [
    'Shot 1 is marked as image but looks like an interview (30.0s, 80% speech).',
    'Shot 4 is marked as interview but has little speech (10%).',
  ]);
  assert.equal(
    findByClass(h.root, 'interview-picker__estimate').text,
    'Under 1 min to transcribe',
  );

  findByClass(h.root, 'interview-picker__handle').dispatch('keydown', { key: 'Home' });
  assert.deepEqual(
    findAllByClass(h.root, 'interview-picker__note').map((note) => note.text),
    ['Shot 4 is marked as interview but has little speech (10%).'],
  );
  assert.equal(
    findByClass(h.root, 'interview-picker__estimate').text,
    '\u2248 1 min to transcribe',
  );
  findByClass(h.root, 'interview-picker__cancel').dispatch('click');
  await h.promise;
});

test('modo manual sin entrevistas propuestas deja el principal habilitado y cambia a «Clear interviews»', async () => {
  const empty = openPicker({ first: 6, mode: 'manual' });
  const confirmEmpty = findByClass(empty.root, 'interview-picker__confirm');
  assert.equal(confirmEmpty.classList.contains('is-disabled'), false);
  assert.equal(findByClass(confirmEmpty, 'button__label').text, 'Mark as interviews');
  findByClass(empty.root, 'interview-picker__cancel').dispatch('click');
  assert.equal(await empty.promise, null);

  const shots = makeShots([10, 10, 10, 20, 15], {
    interviews: [false, false, false, true, true],
  });
  const existing = openPicker({ shots, first: 6, mode: 'manual' });
  const confirmExisting = findByClass(existing.root, 'interview-picker__confirm');
  assert.equal(confirmExisting.classList.contains('is-disabled'), false);
  assert.equal(findByClass(confirmExisting, 'button__label').text, 'Clear interviews');
  findByClass(existing.root, 'interview-picker__cancel').dispatch('click');
  assert.equal(await existing.promise, null);
});

test('los textos de título y cuerpo siguen 17.3 en auto y manual', () => {
  const auto = openPicker();
  assert.equal(findById(auto.root, 'modal-title').text, 'Interview cuts detected');
  assert.equal(
    findById(auto.root, 'modal-body').text,
    'The cuts right of the line look like interviews. Drag the line to adjust it, and choose which ones to transcribe and translate in the background.',
  );
  findByClass(auto.root, 'interview-picker__cancel').dispatch('click');

  const manual = openPicker({ mode: 'manual' });
  assert.equal(findById(manual.root, 'modal-title').text, 'Interview cuts');
  assert.equal(
    findById(manual.root, 'modal-body').text,
    'The cuts right of the line are interviews. Drag the line to change them, and choose which ones to transcribe and translate in the background.',
  );
  findByClass(manual.root, 'interview-picker__cancel').dispatch('click');
});

test('la escucha previa arranca, se para con otro clic y se libera al cerrar', async () => {
  let starts = 0;
  const h = openPicker({
    videoUrl: 'file:///video.mp4',
    onPreviewStart: () => {
      starts += 1;
    },
  });
  const audio = findByClass(h.root, 'interview-picker__audio');
  assert.equal(audio.src, 'file:///video.mp4');

  const bar4 = barByNumber(h.root, 4);
  bar4.dispatch('click');
  assert.equal(starts, 1);
  assert.equal(bar4.classList.contains('is-playing'), true);
  assert.equal(findByClass(h.root, 'interview-picker__status').text, 'Playing shot 4');
  assert.equal(audio.currentTime, h.shots[3].startFrame / 25);

  bar4.dispatch('click');
  assert.equal(bar4.classList.contains('is-playing'), false);
  assert.equal(findByClass(h.root, 'interview-picker__status').text, '');

  bar4.dispatch('click');
  h.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await h.promise, null);
  assert.equal(audio.paused, true);
  assert.equal(audio.src, '');
  assert.ok(audio.loadCount >= 1);
});

test('un fallo de reproducción se anuncia y no deja la barra sonando', async () => {
  const h = openPicker({ videoUrl: 'file:///video.mp4' });
  const audio = findByClass(h.root, 'interview-picker__audio');
  audio.play = () => Promise.reject(new Error('boom'));

  const bar4 = barByNumber(h.root, 4);
  bar4.dispatch('click');
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(findByClass(h.root, 'interview-picker__status').text, "Can't play this cut.");
  assert.equal(bar4.classList.contains('is-playing'), false);

  h.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await h.promise, null);
});

test('el AbortError de la barra anterior al cambiar de corte se ignora', async () => {
  const h = openPicker({ videoUrl: 'file:///video.mp4' });
  const audio = findByClass(h.root, 'interview-picker__audio');
  const pending = [];
  audio.play = () => new Promise((_resolve, reject) => pending.push(reject));

  const bar4 = barByNumber(h.root, 4);
  const bar5 = barByNumber(h.root, 5);
  bar4.dispatch('click');
  bar5.dispatch('click');
  assert.equal(pending.length, 2);

  pending[0](Object.assign(new Error('aborted'), { name: 'AbortError' }));
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(bar5.classList.contains('is-playing'), true);
  assert.equal(findByClass(h.root, 'interview-picker__status').text, 'Playing shot 5');

  h.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await h.promise, null);
});

test('arrastrar el tirador ajusta el límite al hueco más cercano', async () => {
  const h = openPicker({
    barsWidth: 300,
    shots: makeShots([10, 10, 10, 10, 10]),
  });
  const handle = findByClass(h.root, 'interview-picker__handle');
  const modal = findByClass(h.root, 'interview-picker');

  handle.dispatch('pointerdown', { button: 0, pointerId: 1, clientX: 200 });
  assert.equal(handle.getAttribute('aria-valuenow'), '4');
  assert.equal(modal.classList.contains('is-dragging'), true);

  h.documentState.dispatch('pointermove', { clientX: 12 });
  assert.equal(handle.getAttribute('aria-valuenow'), '1');

  h.documentState.dispatch('pointermove', { clientX: 130 });
  assert.equal(handle.getAttribute('aria-valuenow'), '3');

  h.documentState.dispatch('pointerup');
  assert.equal(modal.classList.contains('is-dragging'), false);
  h.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await h.promise, null);
});

test('Tab y Mayús+Tab quedan atrapados entre el tirador y el principal', async () => {
  const h = openPicker();
  const handle = findByClass(h.root, 'interview-picker__handle');
  const confirm = findByClass(h.root, 'interview-picker__confirm');

  confirm.focus();
  h.documentState.dispatch('keydown', { key: 'Tab' });
  assert.equal(h.documentState.activeElement, handle);

  handle.focus();
  h.documentState.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(h.documentState.activeElement, confirm);

  h.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await h.promise, null);
});

test('All y None marcan y desmarcan las casillas habilitadas', async () => {
  const h = openPicker();
  const all = findByClass(h.root, 'interview-picker__all');
  const none = findByClass(h.root, 'interview-picker__none');
  assert.equal(all.classList.contains('is-disabled'), true);

  none.dispatch('click');
  assert.equal(findAllByClass(h.root, 'checkbox__input').every((input) => !input.checked), true);
  assert.equal(none.classList.contains('is-disabled'), true);
  assert.equal(all.classList.contains('is-disabled'), false);
  assert.equal(findByClass(h.root, 'interview-picker__estimate').hidden, true);
  assert.match(findByClass(h.root, 'interview-picker__count').text, /none to transcribe/);

  all.dispatch('click');
  assert.equal(findAllByClass(h.root, 'checkbox__input').every((input) => input.checked), true);
  assert.equal(all.classList.contains('is-disabled'), true);
  assert.equal(findByClass(h.root, 'interview-picker__estimate').hidden, false);

  findByClass(h.root, 'interview-picker__cancel').dispatch('click');
  assert.equal(await h.promise, null);
});

test('una fila que sale del rango y vuelve recupera casilla e idioma', async () => {
  const h = openPicker();
  const fourth = byNumber(h.root, 'checkbox__input', 4);
  fourth.checked = false;
  fourth.dispatch('change');
  const fifth = byNumber(h.root, 'field__select', 5);
  fifth.value = 'fr';
  fifth.dispatch('change');

  const handle = findByClass(h.root, 'interview-picker__handle');
  handle.dispatch('keydown', { key: 'Home' });
  assert.equal(byNumber(h.root, 'checkbox__input', 4).checked, false);
  assert.equal(byNumber(h.root, 'field__select', 5).value, 'fr');

  for (let step = 0; step < 3; step += 1) {
    handle.dispatch('keydown', { key: 'ArrowRight' });
  }
  assert.equal(byNumber(h.root, 'checkbox__input', 4).checked, false);
  assert.equal(byNumber(h.root, 'field__select', 5).value, 'fr');

  findByClass(h.root, 'interview-picker__confirm').dispatch('click');
  assert.deepEqual(await h.promise, {
    first: 4,
    transcribe: [5],
    languages: { 5: 'fr' },
  });
});

test('los anchos respetan el mínimo y reparten todo el ancho útil', () => {
  const h = openPicker({ barsWidth: 106, shots: makeShots([1, 9, 20]) });
  const widths = findAllByClass(h.root, 'interview-picker__bar').map((bar) =>
    Number.parseFloat(bar.style.width),
  );
  assert.ok(Math.abs(widths[0] - 8) < 1e-9);
  const total = widths.reduce((sum, width) => sum + width, 0);
  assert.ok(Math.abs(total - 100) < 1e-9);
  assert.ok(widths[2] > widths[1] && widths[1] > widths[0]);
  findByClass(h.root, 'interview-picker__cancel').dispatch('click');
});

test('el principal desactivado no cierra aunque se pulse', async () => {
  const h = openPicker();
  const handle = findByClass(h.root, 'interview-picker__handle');
  handle.dispatch('keydown', { key: 'End' });
  const confirm = findByClass(h.root, 'interview-picker__confirm');
  assert.equal(confirm.classList.contains('is-disabled'), true);

  let settled = false;
  h.promise.then(() => {
    settled = true;
  });
  confirm.dispatch('click');
  await Promise.resolve();
  assert.equal(settled, false);

  h.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await h.promise, null);
});

test('con todas las entrevistas «Transcribed» el grupo All/None se oculta', async () => {
  const shots = makeShots([10, 10, 10, 20, 15], {
    originals: ['', '', '', 'Texto 4', 'Texto 5'],
  });
  const h = openPicker({ shots });
  assert.equal(findByClass(h.root, 'interview-picker__bulk').hidden, true);
  assert.equal(
    findAllByClass(h.root, 'checkbox__input').every((input) => input.disabled),
    true,
  );
  findByClass(h.root, 'interview-picker__cancel').dispatch('click');
  assert.equal(await h.promise, null);
});
