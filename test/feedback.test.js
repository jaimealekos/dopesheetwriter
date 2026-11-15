// Pruebas del módulo feedback: textos exactos del banner (6.2), clase desconocida,
// modales de reemplazo y modal de detección de entrevistas (15.1).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  bannerCopy,
  confirmReplaceOriginal,
  confirmReplaceTranslation,
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
