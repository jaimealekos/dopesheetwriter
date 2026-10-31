// Pruebas del módulo feedback: textos exactos del banner (6.2), clase desconocida,
// modales de reemplazo y modal de detección de entrevistas (15.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bannerCopy,
  confirmReplaceOriginal,
  confirmReplaceTranslation,
  confirmInterviews,
  confirmRetranscribe,
} from '../renderer/feedback.js';

test("bannerCopy('unsupported-codec') es error con el texto exacto", () => {
  assert.deepEqual(bannerCopy('unsupported-codec', {}), {
    type: 'error',
    title: "This video can't be played.",
    detail:
      "Its codec isn't supported (ProRes, DNxHD and similar). Export an H.264 MP4 and load it again.",
  });
});

test("bannerCopy('unreadable-video') interpola el fichero", () => {
  assert.deepEqual(bannerCopy('unreadable-video', { file: 'clip.mov' }), {
    type: 'error',
    title: 'Couldn\'t open "clip.mov".',
    detail: "Check the file still exists and isn't open in another program.",
  });
});

test("bannerCopy('invalid-xml') cita el fichero y explica la exportación", () => {
  assert.deepEqual(bannerCopy('invalid-xml', { file: 'a.xml' }), {
    type: 'error',
    title: '"a.xml" isn\'t a valid Final Cut / Premiere XML.',
    detail: 'Export the sequence as Final Cut Pro XML (xmeml v4) and load it again.',
  });
});

test("bannerCopy('no-clips') es error", () => {
  assert.deepEqual(bannerCopy('no-clips', {}), {
    type: 'error',
    title: 'The XML has no clips on video track V1.',
    detail: 'Check you exported the edited sequence, not a bin or a single clip.',
  });
});

test("bannerCopy('mismatch') es aviso e interpola los dos timecodes", () => {
  assert.deepEqual(
    bannerCopy('mismatch', { xmlTime: '00:03:57:00', videoTime: '00:04:10:00' }),
    {
      type: 'warning',
      title: "The XML doesn't match the video.",
      detail:
        'The sequence lasts 00:03:57:00 but the video lasts 00:04:10:00. Make sure both come from the same export.',
    },
  );
});

test("bannerCopy('bad-drop') es aviso", () => {
  assert.deepEqual(bannerCopy('bad-drop', { file: 'notes.txt' }), {
    type: 'warning',
    title: '"notes.txt" can\'t be loaded.',
    detail: 'Drop a video (.mp4, .mov, .m4v) or an .xml file.',
  });
});

test("bannerCopy('save-failed') antepone la causa del sistema y nombra la carpeta", () => {
  assert.deepEqual(
    bannerCopy('save-failed', {
      name: 'shotlist',
      detail: 'Permission denied.',
      folder: 'D:/Export',
    }),
    {
      type: 'error',
      title: 'Couldn\'t save "shotlist.txt".',
      detail: 'Permission denied. Check you can write to D:/Export.',
    },
  );
});

test("bannerCopy('translate-failed') es aviso con el detalle del servicio", () => {
  assert.deepEqual(
    bannerCopy('translate-failed', { detail: "You're offline." }),
    {
      type: 'warning',
      title: "Couldn't translate the text.",
      detail: "You're offline.",
    },
  );
});

test("bannerCopy('translate-failed') sin detalle usa el texto por defecto", () => {
  assert.deepEqual(bannerCopy('translate-failed', {}), {
    type: 'warning',
    title: "Couldn't translate the text.",
    detail: 'Try again in a moment.',
  });
});

test('bannerCopy solo mismatch, bad-drop y los fallos de traducción y transcripción son aviso', () => {
  const kinds = [
    'unsupported-codec',
    'unreadable-video',
    'invalid-xml',
    'no-clips',
    'mismatch',
    'bad-drop',
    'save-failed',
    'translate-failed',
    'transcribe-failed',
  ];
  for (const kind of kinds) {
    const warning = kind === 'mismatch' || kind === 'bad-drop' ||
      kind === 'translate-failed' ||
      kind === 'transcribe-failed';
    assert.equal(bannerCopy(kind, {}).type, warning ? 'warning' : 'error', kind);
  }
});

test('bannerCopy con clase desconocida lanza el error exacto', () => {
  assert.throws(() => bannerCopy('otra-cosa', {}), {
    name: 'Error',
    message: 'Unknown banner kind: otra-cosa.',
  });
});

test("bannerCopy('transcribe-failed') es aviso con el plano y el detalle del error", () => {
  assert.deepEqual(
    bannerCopy('transcribe-failed', { number: 24, detail: 'No speech found in this cut.' }),
    {
      type: 'warning',
      title: "Couldn't transcribe shot 24.",
      detail: 'No speech found in this cut.',
    },
  );
  assert.equal(bannerCopy('transcribe-failed', { number: 3 }).detail, 'Try again in a moment.');
});

test("bannerCopy('interview-queue-failed') titula según el tipo de fallo", () => {
  const transcribeFailure = {
    number: 28,
    step: 'transcribe',
    error: new Error('No speech found in this cut.'),
  };
  const translateFailure = { number: 30, step: 'translate', error: new Error('Offline.') };

  assert.deepEqual(bannerCopy('interview-queue-failed', { failures: [transcribeFailure] }), {
    type: 'warning',
    title: "Couldn't transcribe 1 soundbite.",
    detail: 'Shot 28: No speech found in this cut.',
  });

  assert.deepEqual(bannerCopy('interview-queue-failed', { failures: [translateFailure] }), {
    type: 'warning',
    title: "Couldn't translate 1 soundbite.",
    detail: 'Shot 30: Offline.',
  });

  const both = bannerCopy('interview-queue-failed', {
    failures: [transcribeFailure, translateFailure],
  });
  assert.equal(both.title, "Couldn't finish 2 soundbites.");
  assert.equal(both.detail, 'Shot 28: No speech found in this cut.; Shot 30: Offline.');

  const many = bannerCopy('interview-queue-failed', {
    failures: [transcribeFailure, translateFailure, { ...translateFailure, number: 31 }],
  });
  assert.equal(many.title, "Couldn't finish 3 soundbites.");
  assert.equal(many.detail, 'Shot 28: No speech found in this cut.; Shot 30: Offline. and 1 more.');
});

test("bannerCopy('retranscribe-failed') usa los mismos títulos que la cola", () => {
  const transcribeFailure = {
    number: 7,
    step: 'transcribe',
    error: new Error('No speech found in this cut.'),
  };
  assert.deepEqual(bannerCopy('retranscribe-failed', { failures: [transcribeFailure] }), {
    type: 'warning',
    title: "Couldn't transcribe 1 soundbite.",
    detail: 'Shot 7: No speech found in this cut.',
  });
  assert.equal(
    bannerCopy('retranscribe-failed', {
      failures: [transcribeFailure, { ...transcribeFailure, number: 8 }],
    }).title,
    "Couldn't transcribe 2 soundbites.",
  );
});

// --- Modales de reemplazo, con un DOM mínimo --------------------------------

class FakeNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = new Map();
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.style = {};
  }

  append(...nodes) {
    this.children.push(...nodes);
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  addEventListener() {}

  focus() {}

  remove() {}

  get text() {
    const own = this.textContent ?? '';
    return own + this.children.map((child) => child.text ?? child.textContent ?? '').join('');
  }
}

// Abre un modal con un document falso y devuelve el texto de su título y de su cuerpo.
function openedModalText(open) {
  const root = new FakeNode('div');
  globalThis.document = {
    activeElement: null,
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (_ns, tag) => new FakeNode(tag),
    createTextNode: (text) => ({ textContent: String(text) }),
    addEventListener() {},
    removeEventListener() {},
  };
  open(root);
  const find = (node, id) => {
    if (node.attributes?.get('id') === id) return node;
    for (const child of node.children ?? []) {
      const found = find(child, id);
      if (found) return found;
    }
    return null;
  };
  const title = find(root, 'modal-title').text;
  const body = find(root, 'modal-body').text;
  delete globalThis.document;
  return { title, body };
}

test('confirmReplaceOriginal avisa de que el original se sustituirá por una transcripción', () => {
  const { title, body } = openedModalText((root) => confirmReplaceOriginal(root));
  assert.equal(title, 'Replace the current original text?');
  assert.equal(body, 'The original text of this soundbite will be replaced by a new transcription.');
});

test('confirmReplaceTranslation nombra el idioma destino (por defecto inglés)', () => {
  const english = openedModalText((root) => confirmReplaceTranslation(root));
  assert.equal(
    english.body,
    'The English text of this soundbite will be replaced by a new machine translation.',
  );
  const spanish = openedModalText((root) => confirmReplaceTranslation(root, 'es'));
  assert.equal(
    spanish.body,
    'The Spanish text of this soundbite will be replaced by a new machine translation.',
  );
});

test('confirmRetranscribe nombra el plano y el idioma nuevos', () => {
  const { title, body } = openedModalText((root) =>
    confirmRetranscribe(root, { number: 7, languageName: 'French' }),
  );
  assert.equal(title, 'Transcribe shot 7 again in French?');
  assert.equal(
    body,
    'The original text will be replaced by a new transcription in French, and the translation will be updated. This runs in the background; you can keep working.',
  );
});

// --- Modal de detección de entrevistas (15.1), con un DOM mínimo -------------

class ModalNode {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = new Map();
    this._classes = new Set();
    const classes = this._classes;
    this.classList = {
      add: (name) => classes.add(name),
      remove: (name) => classes.delete(name),
      toggle: (name, force) => {
        const on = force === undefined ? !classes.has(name) : Boolean(force);
        if (on) classes.add(name);
        else classes.delete(name);
        return on;
      },
      contains: (name) => classes.has(name),
    };
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.scrollTop = 0;
    this.hidden = false;
    this.value = '';
    this._listeners = new Map();
  }

  set className(value) {
    this._classes.clear();
    for (const name of String(value).split(/\s+/).filter(Boolean)) this._classes.add(name);
    // Simula una lista que desborda en cuanto recibe su clase.
    if (this._listOverflows && this._classes.has('interview-detect__list')) {
      this.scrollHeight = 240;
      this.clientHeight = 200;
    }
  }

  get className() {
    return [...this._classes].join(' ');
  }

  set textContent(value) {
    this.children = [];
    this._text = String(value);
  }

  get textContent() {
    return this._text ?? '';
  }

  append(...nodes) {
    for (const node of nodes) this.children.push(node);
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

  focus() {
    document.activeElement = this;
  }

  remove() {
    const parent = document.body;
    parent.children = parent.children.filter((child) => child !== this);
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some((child) => child.contains?.(node));
  }

  querySelector(selector) {
    const className = selector.startsWith('.') ? selector.slice(1) : null;
    if (!className) return null;
    return findByClass(this, className);
  }

  get text() {
    return (this._text ?? '') + this.children.map((child) => child.text ?? child.textContent ?? '').join('');
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

// Instala el document falso y abre el modal con el DOM mínimo.
function openInterviewModal({
  shots,
  fps = 25,
  first = 4,
  transcriberAvailable = true,
  listOverflows = false,
} = {}) {
  const body = new ModalNode('body');
  const makeNode = (tag) => {
    const node = new ModalNode(tag);
    node._listOverflows = listOverflows;
    return node;
  };
  const documentState = {
    body,
    activeElement: null,
    createElement: makeNode,
    createElementNS: (_ns, tag) => makeNode(tag),
    createTextNode: (text) => ({ textContent: String(text) }),
    addEventListener(type, handler) {
      if (!this._listeners.has(type)) this._listeners.set(type, new Set());
      this._listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      this._listeners.get(type)?.delete(handler);
    },
    dispatch(type, event = {}) {
      const full = { type, ...event };
      full.defaultPrevented = false;
      full.preventDefault = () => {
        full.defaultPrevented = true;
      };
      for (const handler of this._listeners.get(type) ?? []) handler(full);
      return full;
    },
    querySelector: () => null,
    _listeners: new Map(),
  };
  globalThis.document = documentState;

  const root = body;
  const promise = confirmInterviews(root, {
    shots,
    fps,
    first,
    transcriberAvailable,
  });
  const backdrop = findByClass(root, 'modal-backdrop');
  return { root, body, promise, backdrop, documentState };
}

// Planos 1..5 de 10 s (largos los dos últimos), con los frames a 25 fps.
function interviewShots() {
  return [
    { number: 1, startFrame: 0, endFrame: 100 },
    { number: 2, startFrame: 100, endFrame: 200 },
    { number: 3, startFrame: 200, endFrame: 300 },
    { number: 4, startFrame: 300, endFrame: 550 },
    { number: 5, startFrame: 550, endFrame: 800 },
  ];
}

test('confirmInterviews:Fewer ajusta el primer plano y actualiza lista y recuento', () => {
  const h = openInterviewModal({ shots: interviewShots() });
  const count = findByClass(h.root, 'interview-detect__count');
  assert.equal(count.text, 'Shots 4\u20135 \u00b7 2 soundbites');
  assert.deepEqual(
    findAllByClass(h.root, 'interview-detect__shot').map((node) => node.text),
    ['Shot 4', 'Shot 5'],
  );
  assert.equal(findAllByClass(h.root, 'interview-detect__duration')[0].text, '10.0s');

  findByClass(h.root, 'interview-detect__more').dispatch('click');
  assert.equal(count.text, 'Shots 3\u20135 \u00b7 3 soundbites');
  assert.equal(findAllByClass(h.root, 'interview-detect__shot')[0].text, 'Shot 3');

  findByClass(h.root, 'interview-detect__fewer').dispatch('click');
  assert.equal(count.text, 'Shots 4\u20135 \u00b7 2 soundbites');
});

test('confirmInterviews: sin planos el principal queda desactivado y aparece el aviso', async () => {
  const h = openInterviewModal({ shots: interviewShots() });
  const count = findByClass(h.root, 'interview-detect__count');
  const confirm = findByClass(h.root, 'interview-detect__confirm');

  findByClass(h.root, 'interview-detect__fewer').dispatch('click');
  findByClass(h.root, 'interview-detect__fewer').dispatch('click');

  assert.equal(count.text, 'No shots selected');
  assert.equal(confirm.classList.contains('is-disabled'), true);
  assert.equal(confirm.getAttribute('aria-disabled'), 'true');
  assert.equal(findByClass(h.root, 'interview-detect__empty').hidden, false);
  assert.equal(findByClass(h.root, 'interview-detect__list').hidden, true);

  // El clic en un botón desactivado no cierra el modal.
  let settled = false;
  h.promise.then(() => {
    settled = true;
  });
  confirm.dispatch('click');
  await Promise.resolve();
  assert.equal(settled, false);

  findByClass(h.root, 'interview-detect__cancel').dispatch('click');
  assert.equal(await h.promise, null);
});

test('confirmInterviews: el principal resuelve con el primer plano elegido', async () => {
  const h = openInterviewModal({ shots: interviewShots() });
  findByClass(h.root, 'interview-detect__more').dispatch('click');
  findByClass(h.root, 'interview-detect__confirm').dispatch('click');
  assert.equal(await h.promise, 3);
});

test('confirmInterviews: Esc, fondo y «Not interviews» resuelven null', async () => {
  const esc = openInterviewModal({ shots: interviewShots() });
  esc.documentState.dispatch('keydown', { key: 'Escape' });
  assert.equal(await esc.promise, null);

  const backdrop = openInterviewModal({ shots: interviewShots() });
  backdrop.backdrop.dispatch('pointerdown', { target: backdrop.backdrop });
  assert.equal(await backdrop.promise, null);

  const cancel = openInterviewModal({ shots: interviewShots() });
  findByClass(cancel.root, 'interview-detect__cancel').dispatch('click');
  assert.equal(await cancel.promise, null);
});

test('confirmInterviews: cuerpo según la transcripción, título y foco inicial', () => {
  const withTool = openInterviewModal({ shots: interviewShots() });
  assert.equal(findById(withTool.root, 'modal-title').text, 'Interview cuts detected');
  assert.equal(
    findById(withTool.root, 'modal-body').text,
    'These shots at the end of the sequence are long enough to be interviews. Marking them as soundbites also transcribes and translates them in the background.',
  );
  assert.equal(withTool.documentState.activeElement, findByClass(withTool.root, 'interview-detect__confirm'));
  delete globalThis.document;

  const withoutTool = openInterviewModal({
    shots: interviewShots(),
    transcriberAvailable: false,
  });
  assert.equal(
    findById(withoutTool.root, 'modal-body').text,
    'These shots at the end of the sequence are long enough to be interviews. Mark them as soundbites?',
  );
  delete globalThis.document;
});

test('confirmInterviews: Tab atrapa el foco y la lista solo entra si desborda', async () => {
  const overflowing = openInterviewModal({ shots: interviewShots(), listOverflows: true });
  const list = findByClass(overflowing.root, 'interview-detect__list');
  // El desbordamiento se mide con el modal ya insertado.
  assert.equal(list.getAttribute('tabindex'), '0');

  const fewer = findByClass(overflowing.root, 'interview-detect__fewer');
  const confirm = findByClass(overflowing.root, 'interview-detect__confirm');

  overflowing.documentState.activeElement = confirm;
  const forward = overflowing.documentState.dispatch('keydown', { key: 'Tab' });
  assert.equal(forward.defaultPrevented, true);
  assert.equal(overflowing.documentState.activeElement, fewer);

  overflowing.documentState.activeElement = fewer;
  const backward = overflowing.documentState.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(backward.defaultPrevented, true);
  assert.equal(overflowing.documentState.activeElement, confirm);

  findByClass(overflowing.root, 'interview-detect__cancel').dispatch('click');
  assert.equal(await overflowing.promise, null);

  const plain = openInterviewModal({ shots: interviewShots() });
  assert.equal(findByClass(plain.root, 'interview-detect__list').getAttribute('tabindex'), null);

  const plainFewer = findByClass(plain.root, 'interview-detect__fewer');
  plain.documentState.activeElement = findByClass(plain.root, 'interview-detect__confirm');
  plain.documentState.dispatch('keydown', { key: 'Tab' });
  assert.equal(plain.documentState.activeElement, plainFewer);

  plain.documentState.activeElement = plainFewer;
  plain.documentState.dispatch('keydown', { key: 'Tab', shiftKey: true });
  assert.equal(
    plain.documentState.activeElement,
    findByClass(plain.root, 'interview-detect__confirm'),
  );

  findByClass(plain.root, 'interview-detect__cancel').dispatch('click');
  assert.equal(await plain.promise, null);
});
