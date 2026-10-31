// Pruebas del módulo output-panel: funciones puras y el clic delegado de
// mountPreview (con un DOM mínimo, sin navegador ni red).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { progressLabel, missingSummary, rangeText, splitPreview, mountProgress, mountPreviewToggle, mountTranslateAll, translateAllState, mountPreview } from '../renderer/output-panel.js';
import { buildShotlist } from '../core/shotlist-format.js';

const VALID_HEADER = { location: 'MADRID, SPAIN', date: 'MARCH 17, 2024', source: 'AFPTV' };

// Plano a mano: imagen completa si tiene size y description; entrevista completa
// si tiene name, gender y language.
function makeShot(number, overrides = {}) {
  const base = {
    number,
    startFrame: (number - 1) * 25,
    endFrame: number * 25,
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

function imageShot(number, complete) {
  return makeShot(number, complete ? { size: 'Wide shot', description: 'Desc' } : {});
}

function interviewShot(number, complete) {
  return makeShot(number, {
    interview: true,
    soundbite: complete ? { name: 'Ana', gender: 'woman', language: 'Spanish' } : {},
  });
}

test('el módulo se importa en Node y expone la interfaz pública', () => {
  assert.equal(typeof mountProgress, 'function');
  assert.equal(typeof mountPreviewToggle, 'function');
  assert.equal(typeof mountTranslateAll, 'function');
  assert.equal(typeof translateAllState, 'function');
  assert.equal(typeof mountPreview, 'function');
});

test('translateAllState: pendientes 0, 1 y 3, y el estado busy', () => {
  assert.deepEqual(translateAllState({ pending: 0, busy: false }), {
    disabled: true,
    loading: false,
    tooltip: 'No soundbites to translate',
  });
  assert.deepEqual(translateAllState({ pending: 1, busy: false }), {
    disabled: false,
    loading: false,
    tooltip: 'Translate 1 soundbite without translation (online service)',
  });
  assert.deepEqual(translateAllState({ pending: 3, busy: false }), {
    disabled: false,
    loading: false,
    tooltip: 'Translate 3 soundbites without translation (online service)',
  });
  assert.deepEqual(translateAllState({ pending: 3, busy: true }), {
    disabled: false,
    loading: true,
    tooltip: 'Translating…',
  });
});

test('progressLabel: formato fijo con total 0, 1 o varios', () => {
  assert.equal(progressLabel(18, 26), '18/26 shots complete');
  assert.equal(progressLabel(1, 1), '1/1 shots complete');
  assert.equal(progressLabel(0, 0), '0/0 shots complete');
});

test('rangeText: ordena, agrupa rachas de 3 o más y deja las parejas sueltas', () => {
  assert.equal(rangeText([3, 7, 12, 13, 14, 15, 16]), '3, 7, 12\u201316');
  assert.equal(rangeText([1, 2]), '1, 2');
  assert.equal(rangeText([5, 6, 7]), '5\u20137');
  assert.equal(rangeText([7, 3]), '3, 7');
  assert.equal(rangeText([]), '');
  assert.equal(rangeText([4]), '4');
  assert.equal(rangeText([10, 11, 12, 13]), '10\u201313');
});

test('missingSummary: cabecera, planos de imagen y entrevistas por índice', () => {
  const shots = [
    imageShot(1, true),
    interviewShot(2, true),
    imageShot(3, false),
    imageShot(4, true),
    imageShot(5, true),
    imageShot(6, true),
    imageShot(7, false),
    imageShot(8, true),
    imageShot(9, true),
    imageShot(10, true),
    imageShot(11, true),
    imageShot(12, false),
    imageShot(13, false),
    imageShot(14, false),
    imageShot(15, false),
    imageShot(16, false),
    interviewShot(17, false),
  ];

  assert.deepEqual(missingSummary({ headerErrors: { source: 'Enter the source.' }, shots }), [
    'Source',
    'Shots 3, 7, 12\u201316',
    'Soundbites 2',
  ]);
});

test('missingSummary: sin faltas devuelve lista vacía y respeta el orden de cabecera', () => {
  const shots = [imageShot(1, true)];
  assert.deepEqual(missingSummary({ headerErrors: {}, shots }), []);
  assert.deepEqual(
    missingSummary({
      headerErrors: { source: 'x', location: 'x', date: 'x' },
      shots,
    }),
    ['Location', 'Date', 'Source'],
  );
});

test('missingSummary: con más de 6 líneas muestra 5 y recorta con and N more', () => {
  const errors = { location: 'x', date: 'x', source: 'x', a: '', b: '', c: '', d: '', e: '' };
  const lines = missingSummary({ headerErrors: errors, shots: [] });

  assert.equal(lines.length, 6);
  assert.equal(lines.at(-1), 'and 3 more');
});

test('splitPreview: bloque de cabecera más uno por plano, current y segmentos', () => {
  const shots = [
    makeShot(1, { size: 'Wide shot', description: 'Uno' }),
    makeShot(2),
    makeShot(3, { size: 'Close-up', description: 'Tres' }),
  ];
  const text = buildShotlist({ header: VALID_HEADER, shots, fps: 25 }, { strict: false });

  const blocks = splitPreview(text, shots, 2);

  assert.equal(blocks.length, 4);
  assert.equal(blocks[0].current, false);
  assert.match(blocks[0].text, /^SHOTLIST\n/);
  assert.ok(blocks[0].text.includes('IMAGES (00:03)'));
  assert.deepEqual(
    blocks.map((block) => block.current),
    [false, false, true, false],
  );
  assert.deepEqual(
    blocks.map((block) => block.number),
    [null, 1, 2, 3],
  );

  // Invariante: los textos de todos los segmentos reconstruyen el texto original.
  const joined = blocks
    .flatMap((block) => block.segments.map((segment) => segment.text))
    .join('');
  assert.equal(joined, text);

  // El marcador de la descripción falta como segmento independiente.
  const missingSegments = blocks[2].segments.filter((segment) => segment.missing);
  assert.deepEqual(
    missingSegments.map((segment) => segment.text),
    ['[SHOT SIZE]', '[DESCRIPTION]'],
  );
});

test('splitPreview: sin plano actual ninguno queda marcado', () => {
  const shots = [makeShot(1, { size: 'Wide shot', description: 'Uno' })];
  const text = buildShotlist({ header: VALID_HEADER, shots, fps: 25 }, { strict: false });
  const blocks = splitPreview(text, shots, 99);

  assert.equal(blocks.length, 2);
  assert.equal(blocks.some((block) => block.current), false);
  assert.deepEqual(
    blocks.map((block) => block.number),
    [null, 1],
  );
});

// --- DOM mínimo para el clic delegado de mountPreview ----------------------

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
    this.hidden = false;
    this.scrollTop = 0;
    this.parentNode = null;
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
    if (child && typeof child === 'object') child.parentNode = this;
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
    else if (name === 'id') this.id = String(value);
    else if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_all, letter) => letter.toUpperCase());
      this.dataset[key] = String(value);
    }
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
    const full = { type, target: this, preventDefault() {}, ...event };
    for (const handler of this._listeners.get(type) ?? []) handler(full);
  }

  matches(selector) {
    const wantsShot = selector.includes('[data-shot]');
    const classes = selector.replace(/\[[^\]]*\]/g, '').split('.').filter(Boolean);
    if (classes.length === 0) return false;
    if (!classes.every((name) => this._classes.has(name))) return false;
    if (wantsShot && !('shot' in this.dataset)) return false;
    return true;
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (typeof node.matches === 'function' && node.matches(selector)) return node;
      node = node.parentNode;
    }
    return null;
  }

  contains(node) {
    if (node === this) return true;
    for (const child of this.children) {
      if (child === node) return true;
      if (child && typeof child.contains === 'function' && child.contains(node)) return true;
    }
    return false;
  }

  querySelector(selector) {
    const classes = selector.split('.').filter(Boolean);
    return findNode(this, (node) => classes.every((name) => node._classes?.has(name)));
  }

  scrollIntoView() {}

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }
}

function findNode(node, predicate) {
  if (predicate(node)) return node;
  for (const child of node.children ?? []) {
    if (!child || typeof child !== 'object') continue;
    const found = findNode(child, predicate);
    if (found) return found;
  }
  return null;
}

function collectNodes(node, predicate, out = []) {
  if (predicate(node)) out.push(node);
  for (const child of node.children ?? []) {
    if (child && typeof child === 'object') collectNodes(child, predicate, out);
  }
  return out;
}

function fakeDocument() {
  return {
    body: new FakeNode('body'),
    activeElement: null,
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (_ns, tag) => new FakeNode(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text), parentNode: null }),
    addEventListener() {},
  };
}

// Tres planos de imagen: la cabecera queda como primer bloque (sin data-shot).
function previewFixture() {
  const shots = [
    makeShot(1, { size: 'Wide shot', description: 'Uno' }),
    makeShot(2, { size: 'Close-up', description: 'Dos' }),
    makeShot(3, { size: 'Mid shot', description: 'Tres' }),
  ];
  const text = buildShotlist({ header: VALID_HEADER, shots, fps: 25 }, { strict: false });
  return { shots, text };
}

function mountPreviewPanel(t) {
  const previousDocument = globalThis.document;
  const previousWindow = globalThis.window;
  globalThis.document = fakeDocument();
  globalThis.window = { getSelection: () => ({ toString: () => '', anchorNode: null }) };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });
  const root = new FakeNode('div');
  const calls = [];
  const panel = mountPreview(root, {
    onClose: () => calls.push({ type: 'close' }),
    onSelect: (number) => calls.push({ type: 'select', number }),
  });
  return { panel, root, calls };
}

test('mountPreview: los bloques de plano llevan data-shot y los de cabecera no', (t) => {
  const { panel, root } = mountPreviewPanel(t);
  const { shots, text } = previewFixture();
  panel.update({ text, shots, currentNumber: 1, fileName: 'clip.txt' });

  const pre = findNode(root, (node) => node._classes?.has('preview__text'));
  const blocks = collectNodes(pre, (node) => node._classes?.has('preview__block'));
  assert.equal(blocks.length, 4);
  assert.equal('shot' in blocks[0].dataset, false);
  assert.deepEqual(
    blocks.slice(1).map((block) => block.dataset.shot),
    ['1', '2', '3'],
  );
});

test('mountPreview: clic en un bloque de plano llama a onSelect con su número', (t) => {
  const { panel, root, calls } = mountPreviewPanel(t);
  const { shots, text } = previewFixture();
  panel.update({ text, shots, currentNumber: 1, fileName: 'clip.txt' });

  const pre = findNode(root, (node) => node._classes?.has('preview__text'));
  const blocks = collectNodes(pre, (node) => node.dataset && 'shot' in node.dataset);

  pre.dispatch('click', { target: blocks[1] });
  assert.deepEqual(calls, [{ type: 'select', number: 2 }]);
});

test('mountPreview: clic en la cabecera no llama a onSelect', (t) => {
  const { panel, root, calls } = mountPreviewPanel(t);
  const { shots, text } = previewFixture();
  panel.update({ text, shots, currentNumber: 1, fileName: 'clip.txt' });

  const pre = findNode(root, (node) => node._classes?.has('preview__text'));
  const header = collectNodes(
    pre,
    (node) => node._classes?.has('preview__block') && !('shot' in node.dataset),
  )[0];

  pre.dispatch('click', { target: header });
  assert.deepEqual(calls, []);
});

test('mountPreview: con selección de texto dentro del pre no salta al plano', (t) => {
  const { panel, root, calls } = mountPreviewPanel(t);
  const { shots, text } = previewFixture();
  panel.update({ text, shots, currentNumber: 1, fileName: 'clip.txt' });

  const pre = findNode(root, (node) => node._classes?.has('preview__text'));
  const blocks = collectNodes(pre, (node) => node.dataset && 'shot' in node.dataset);

  // Selección dentro de la vista previa: el clic no navega (se está copiando).
  globalThis.window.getSelection = () => ({ toString: () => 'Wide shot', anchorNode: blocks[0] });
  pre.dispatch('click', { target: blocks[1] });
  assert.deepEqual(calls, []);

  // Selección fuera de la vista previa: el clic sí navega.
  globalThis.window.getSelection = () => ({ toString: () => 'otro texto', anchorNode: globalThis.document.body });
  pre.dispatch('click', { target: blocks[1] });
  assert.deepEqual(calls, [{ type: 'select', number: 2 }]);
});

test('mountPreview: destroy quita el listener de clic', (t) => {
  const { panel, root, calls } = mountPreviewPanel(t);
  const { shots, text } = previewFixture();
  panel.update({ text, shots, currentNumber: 1, fileName: 'clip.txt' });

  const pre = findNode(root, (node) => node._classes?.has('preview__text'));
  const blocks = collectNodes(pre, (node) => node.dataset && 'shot' in node.dataset);

  panel.destroy();
  pre.dispatch('click', { target: blocks[1] });
  assert.deepEqual(calls, []);
});
