// Pruebas del módulo ui-kit: solo las funciones puras (ICON_NAMES, iconMarkup,
// formatKbd, normalizeAge). Los controles con DOM se cubren en la integración.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ICON_NAMES, iconMarkup, formatKbd, normalizeAge, createField } from '../renderer/ui-kit.js';

const EXPECTED_ICONS = [
  'play',
  'pause',
  'shot-prev',
  'shot-next',
  'volume',
  'mute',
  'film',
  'xml',
  'drop',
  'check',
  'error',
  'warning',
  'close',
  'chevron-down',
  'copy',
  'next-pending',
  'folder',
  'image-off',
  'spinner',
  'panel-right',
  'translate',
  'transcribe',
];

test('ICON_NAMES contiene los 22 iconos, sin duplicados', () => {
  assert.equal(ICON_NAMES.length, 22);
  assert.equal(new Set(ICON_NAMES).size, 22);
  for (const name of EXPECTED_ICONS) assert.ok(ICON_NAMES.includes(name), `falta ${name}`);
});

test('iconMarkup de check y play contiene los trazados del diseño', () => {
  assert.ok(iconMarkup('check').includes('M5 12.5l4.5 4.5L19 7.5'));
  assert.ok(iconMarkup('play').includes('M8 5.5v13l10.5-6.5z'));
  assert.ok(iconMarkup('play').includes('fill="currentColor"'));
});

test('iconMarkup de panel-right y translate contiene sus trazados (13.3.4)', () => {
  assert.ok(iconMarkup('panel-right').includes('M15 4v16'));
  assert.ok(iconMarkup('panel-right').includes('M17.5 8.5h1.5'));
  assert.ok(iconMarkup('translate').includes('M11 5c-.8 4-3.2 7-6.5 8.5'));
  assert.ok(iconMarkup('translate').includes('M14.2 17.5h5.1'));
});

test('iconMarkup de transcribe contiene los trazados de 14.1', () => {
  for (const d of ['M4 10v4', 'M7 6v12', 'M10 9v6', 'M14 8h6', 'M14 12h6', 'M14 16h4']) {
    assert.ok(iconMarkup('transcribe').includes(d), `falta ${d}`);
  }
});

test('iconMarkup devuelve contenido interior, no el <svg>', () => {
  const markup = iconMarkup('spinner');
  assert.ok(!markup.includes('<svg'));
  assert.ok(markup.includes('<circle'));
  assert.ok(markup.includes('stroke-dasharray="42 15"'));
});

test('iconMarkup lanza el error exacto con un icono desconocido', () => {
  assert.throws(() => iconMarkup('nope'), { name: 'Error', message: 'Unknown icon "nope".' });
});

test('normalizeAge recorta espacios y valida de 0 a 3 dígitos', () => {
  assert.deepEqual(normalizeAge('34'), { value: '34', valid: true });
  assert.deepEqual(normalizeAge('  7 '), { value: '7', valid: true });
  assert.deepEqual(normalizeAge(''), { value: '', valid: true });
  assert.deepEqual(normalizeAge('000'), { value: '000', valid: true });
  assert.deepEqual(normalizeAge('3a'), { value: '3a', valid: false });
  assert.deepEqual(normalizeAge('12.5'), { value: '12.5', valid: false });
  assert.deepEqual(normalizeAge('1234'), { value: '1234', valid: false });
});

test('formatKbd deja los atajos igual fuera de macOS', () => {
  assert.equal(formatKbd('Ctrl+S'), 'Ctrl+S');
  assert.equal(formatKbd('Alt+ArrowUp'), 'Alt+ArrowUp');
  assert.equal(formatKbd('Ctrl+Enter'), 'Ctrl+Enter');
});

test('el módulo se importa en Node sin lanzar (sin document a nivel de módulo)', () => {
  assert.equal(typeof iconMarkup, 'function');
  assert.equal(typeof formatKbd, 'function');
  assert.equal(typeof normalizeAge, 'function');
});

// --- createField: opción spellcheck (DOM mínimo, sin navegador) ------------

class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this._classes = new Set();
    this._listeners = new Map();
    this.textContent = '';
    this.value = '';
    this.scrollHeight = 0;
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

  addEventListener() {}

  querySelector() {
    return null;
  }
}

function withFakeDocument(run) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: (tag) => new FakeNode(tag),
    createElementNS: (_ns, tag) => new FakeNode(tag),
    createTextNode: (text) => ({ nodeType: 3, textContent: String(text) }),
  };
  try {
    return run();
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
}

test('createField con spellcheck:false pone el atributo; sin la opción no lo pone', () => {
  withFakeDocument(() => {
    const off = createField({ kind: 'textarea', id: 'original', label: 'Original', spellcheck: false });
    assert.equal(off.control.getAttribute('spellcheck'), 'false');

    const on = createField({ kind: 'textarea', id: 'translation', label: 'Translation' });
    assert.equal(on.control.getAttribute('spellcheck'), null);

    const input = createField({ kind: 'input', id: 'name', label: 'Name' });
    assert.equal(input.control.getAttribute('spellcheck'), null);
  });
});
