// Pruebas del módulo filmstrip: funciones puras y marca de plano en proceso.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createShots } from '../core/shot-model.js';
import { cardAriaLabel, nextIndexForKey, mount as mountFilmstrip } from '../renderer/filmstrip.js';

// Plano mínimo con los campos que usa cardAriaLabel.
function makeShot(overrides = {}) {
  return { number: 1, startFrame: 0, endFrame: 100, interview: false, ...overrides };
}

test('cardAriaLabel describe un plano con la duración en segundos y un decimal', () => {
  const shot = makeShot({ number: 12, startFrame: 0, endFrame: 105 });
  assert.equal(cardAriaLabel(shot, 25, false, 0), 'Shot 12, 4.2 seconds, incomplete');
});

test('cardAriaLabel describe una entrevista con soundbite y segundos redondeados', () => {
  const shot = makeShot({ number: 24, startFrame: 100, endFrame: 684, interview: true });
  assert.equal(cardAriaLabel(shot, 25, true, 1), 'Shot 24, soundbite 1, 23 seconds, complete');
});

test('nextIndexForKey respeta los topes en 0 y n-1', () => {
  assert.equal(nextIndexForKey('ArrowRight', 0, 3), 1);
  assert.equal(nextIndexForKey('ArrowRight', 2, 3), 2);
  assert.equal(nextIndexForKey('ArrowLeft', 0, 3), 0);
  assert.equal(nextIndexForKey('ArrowLeft', 2, 3), 1);
});

test('nextIndexForKey salta al primero y al último con Home y End', () => {
  assert.equal(nextIndexForKey('Home', 2, 5), 0);
  assert.equal(nextIndexForKey('End', 1, 5), 4);
});

test('nextIndexForKey devuelve null si la tecla no navega o no hay planos', () => {
  assert.equal(nextIndexForKey('a', 1, 5), null);
  assert.equal(nextIndexForKey('Enter', 0, 3), null);
  assert.equal(nextIndexForKey('ArrowRight', 0, 0), null);
  assert.equal(nextIndexForKey('Home', 0, 0), null);
});

test('el módulo se importa en Node sin lanzar', () => {
  assert.equal(typeof cardAriaLabel, 'function');
  assert.equal(typeof nextIndexForKey, 'function');
});

// --- Marca de plano en proceso (15.2.3), con un DOM mínimo ----------------

class Node {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.attributes = new Map();
    this._classes = new Set();
    this._listeners = new Map();
    this.hidden = false;
    this.value = '';
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
  }

  set className(value) {
    this._classes.clear();
    for (const name of String(value).split(/\s+/).filter(Boolean)) this._classes.add(name);
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
    this.children.push(...nodes);
  }

  appendChild(node) {
    this.children.push(node);
    return node;
  }

  insertBefore(node, reference) {
    const index = this.children.indexOf(reference);
    if (index < 0) this.children.push(node);
    else this.children.splice(index, 0, node);
    return node;
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

  remove() {}

  focus() {}

  scrollIntoView() {}

  querySelector() {
    return null;
  }
}

function fakeDocument() {
  return {
    body: new Node('body'),
    activeElement: null,
    createElement: (tag) => new Node(tag),
    createElementNS: (_ns, tag) => new Node(tag),
    createTextNode: (text) => ({ textContent: String(text) }),
    addEventListener() {},
    removeEventListener() {},
  };
}

// Nodos con la clase indicada, en orden de aparición.
function collectByClass(node, className, found = []) {
  if (node._classes?.has(className)) found.push(node);
  for (const child of node.children ?? []) collectByClass(child, className, found);
  return found;
}

test('cardAriaLabel añade el sufijo del plano en proceso', () => {
  const shot = makeShot({ number: 24, startFrame: 100, endFrame: 684, interview: true });
  assert.equal(
    cardAriaLabel(shot, 25, true, 1, 'translating'),
    'Shot 24, soundbite 1, 23 seconds, complete, translating',
  );
});

test('setProcessing pone y quita is-processing y el sufijo del aria-label', () => {
  globalThis.document = fakeDocument();
  const root = new Node('div');
  const filmstrip = mountFilmstrip(root, { onSelect: () => {} });
  filmstrip.setShots(
    createShots([
      { startFrame: 0, endFrame: 100 },
      { startFrame: 100, endFrame: 200 },
      { startFrame: 200, endFrame: 300 },
      { startFrame: 300, endFrame: 350 },
    ]),
    25,
  );

  const cards = collectByClass(root, 'shot-card');
  assert.equal(cards.length, 4);
  const card = cards[3];
  assert.equal(collectByClass(card, 'shot-card__spinner').length, 1);

  filmstrip.setProcessing(4, 'transcribing');
  assert.equal(card.classList.contains('is-processing'), true);
  assert.equal(card.getAttribute('aria-label'), 'Shot 4, 2.0 seconds, incomplete, transcribing');

  filmstrip.setProcessing(4, 'translating');
  assert.equal(card.getAttribute('aria-label'), 'Shot 4, 2.0 seconds, incomplete, translating');
  assert.equal(cards[0].classList.contains('is-processing'), false);

  filmstrip.setProcessing(null, null);
  assert.equal(card.classList.contains('is-processing'), false);
  assert.equal(card.getAttribute('aria-label'), 'Shot 4, 2.0 seconds, incomplete');
});
