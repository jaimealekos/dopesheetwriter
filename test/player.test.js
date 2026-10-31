// Pruebas del módulo player: funciones puras y API de mount con un DOM mínimo.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shotAtFrame, shotLabel, percentOf, stepFrame, mount } from '../renderer/player.js';

// Planos de prueba con un hueco entre el 250 y el 260.
function shotsWithHole() {
  return [
    { number: 1, startFrame: 0, endFrame: 100, interview: false },
    { number: 2, startFrame: 100, endFrame: 250, interview: false },
    { number: 3, startFrame: 260, endFrame: 400, interview: false },
  ];
}

// 26 planos con las dos últimas entrevistas.
function shotsWithInterviews() {
  return Array.from({ length: 26 }, (_, index) => ({
    number: index + 1,
    startFrame: index * 100,
    endFrame: index * 100 + 99,
    interview: index + 1 >= 24,
  }));
}

test('shotAtFrame devuelve el plano por startFrame, con hueco y extremos', () => {
  const shots = shotsWithHole();
  assert.equal(shotAtFrame(shots, 0), 1);
  assert.equal(shotAtFrame(shots, 99), 1);
  assert.equal(shotAtFrame(shots, 100), 2);
  assert.equal(shotAtFrame(shots, 255), 2);
  assert.equal(shotAtFrame(shots, 260), 3);
  assert.equal(shotAtFrame(shots, 9999), 3);
});

test('shotAtFrame con frame anterior al primero devuelve el plano 1', () => {
  assert.equal(shotAtFrame(shotsWithHole(), -10), 1);
});

test('shotAtFrame con lista vacía devuelve 0', () => {
  assert.equal(shotAtFrame([], 0), 0);
  assert.equal(shotAtFrame([], 9999), 0);
});

test('shotLabel numera el plano normal sobre el total', () => {
  const shots = shotsWithInterviews();
  assert.equal(shotLabel(shots, 12), 'Shot 12 of 26');
});

test('shotLabel nombra la entrevista con su índice de soundbite', () => {
  const shots = shotsWithInterviews();
  assert.equal(shotLabel(shots, 24), 'Soundbite 1 · shot 24 of 26');
  assert.equal(shotLabel(shots, 25), 'Soundbite 2 · shot 25 of 26');
});

test('percentOf da el tanto por ciento limitado a 0..100', () => {
  assert.equal(percentOf(50, 200), 25);
  assert.equal(percentOf(-5, 200), 0);
  assert.equal(percentOf(500, 200), 100);
});

test('percentOf con total no positivo devuelve 0', () => {
  assert.equal(percentOf(50, 0), 0);
  assert.equal(percentOf(50, -200), 0);
});

test('stepFrame suma y limita a [0, totalFrames - 1]', () => {
  assert.equal(stepFrame(0, -1, 100), 0);
  assert.equal(stepFrame(99, 1, 100), 99);
  assert.equal(stepFrame(10, 25, 100), 35);
});

test('el módulo se importa en Node sin lanzar', async () => {
  const player = await import('../renderer/player.js');
  assert.equal(typeof player.mount, 'function');
  assert.equal(typeof player.shotAtFrame, 'function');
});

// --- DOM mínimo para ejercitar mount() sin navegador -----------------------

class FakeNode {
  constructor(tag) {
    this.tagName = tag;
    this.children = [];
    this.attributes = new Map();
    this.dataset = {};
    this.style = {};
    this._classes = new Set();
    this._listeners = new Map();
    this._captured = new Set();
    this.textContent = '';
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

  setPointerCapture(id) {
    this._captured.add(id);
  }

  hasPointerCapture(id) {
    return this._captured.has(id);
  }

  releasePointerCapture(id) {
    this._captured.delete(id);
  }

  matches() {
    return false;
  }

  remove() {}
}

class FakeVideo extends FakeNode {
  constructor() {
    super('video');
    this.videoWidth = 1920;
    this.videoHeight = 1080;
    this.duration = 60;
    this._currentTime = 0;
    this.paused = true;
    this.muted = false;
    this.volume = 1;
    this.error = null;
  }

  get currentTime() {
    return this._currentTime;
  }

  set currentTime(value) {
    this._currentTime = value;
  }

  get src() {
    return this._src;
  }

  set src(value) {
    this._src = value;
    // `probeVideo` y `load` esperan «loadedmetadata»: se emite en microtarea.
    queueMicrotask(() => this.dispatch('loadedmetadata'));
  }

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    if (this.paused) return;
    this.paused = true;
    // Como el navegador: el evento 'pause' llega en una tarea posterior.
    queueMicrotask(() => this.dispatch('pause'));
  }

  load() {}
}

function fakeDocument() {
  return {
    body: new FakeNode('body'),
    createElement: (tag) => (tag === 'video' ? new FakeVideo() : new FakeNode(tag)),
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

function mountPlayer() {
  globalThis.document = fakeDocument();
  globalThis.window = { innerWidth: 1200 };
  const root = new FakeNode('div');
  const changes = [];
  const player = mount(root, {
    onShotChange: (number) => changes.push(number),
    onError: (error) => changes.push(`error: ${error.message}`),
  });
  return {
    player,
    changes,
    timeline: findByClass(root, 'player__timeline'),
    video: findByClass(root, 'player__video'),
  };
}

const SHOTS = shotsWithHole();
const FPS = 25;
const TOTAL_FRAMES = 400;

async function loadPlayer({ shots = SHOTS } = {}) {
  const harness = mountPlayer();
  await harness.player.load({ url: 'video.mp4', name: 'video.mp4' });
  if (shots !== null) harness.player.setShots(shots, FPS, TOTAL_FRAMES);
  return harness;
}

function dragTimeline(timeline, clientX = 100) {
  timeline.dispatch('pointerdown', { pointerId: 1, clientX });
  timeline.dispatch('pointerup', { pointerId: 1, clientX });
}

function pressKey(timeline, key, shiftKey = false) {
  timeline.dispatch('keydown', { key, shiftKey });
}

test('la barra: un clic en pausa deja el vídeo reproduciendo', async () => {
  const harness = await loadPlayer();
  assert.equal(harness.player.isPlaying(), false);

  dragTimeline(harness.timeline);
  await Promise.resolve();

  assert.equal(harness.player.isPlaying(), true);
});

test('la barra: PageDown mientras reproduce cambia de plano y sigue reproduciendo', async () => {
  const harness = await loadPlayer();
  harness.player.togglePlay();
  assert.equal(harness.player.isPlaying(), true);

  pressKey(harness.timeline, 'PageDown');
  await Promise.resolve();

  assert.equal(harness.player.getCurrentShot(), 2);
  assert.equal(harness.player.isPlaying(), true);

  // «Stop at end» no debe parar en el primer tick tras caer en otro plano.
  harness.video.dispatch('timeupdate');
  assert.equal(harness.player.isPlaying(), true);
});

test('la barra: Shift+ArrowRight posiciona y reproduce', async () => {
  const harness = await loadPlayer();

  pressKey(harness.timeline, 'ArrowRight', true);
  await Promise.resolve();

  assert.equal(harness.player.isPlaying(), true);
});

test('la barra: un salto que deja el último fotograma no reanuda', async () => {
  const harness = await loadPlayer();
  harness.player.selectShot(3, { play: true });
  await Promise.resolve();

  pressKey(harness.timeline, 'PageDown');
  await Promise.resolve();

  assert.equal(harness.player.isPlaying(), false);
});

test('la barra: ArrowRight sin Shift mueve un fotograma y deja en pausa', async () => {
  const harness = await loadPlayer();

  pressKey(harness.timeline, 'ArrowRight');
  await Promise.resolve();

  assert.equal(harness.player.isPlaying(), false);
  assert.ok(harness.video.currentTime > 0);
});

test('la barra: cancelar el gesto reanuda como al soltar', async () => {
  const harness = await loadPlayer();

  harness.timeline.dispatch('pointerdown', { pointerId: 1, clientX: 100 });
  harness.timeline.dispatch('pointercancel', { pointerId: 1, clientX: 100 });
  await Promise.resolve();

  assert.equal(harness.player.isPlaying(), true);
});

test('la barra: sin vídeo cargado no reproduce al soltar ni con PageDown', async () => {
  const harness = mountPlayer();
  harness.player.setShots(SHOTS, FPS, TOTAL_FRAMES);

  dragTimeline(harness.timeline);
  pressKey(harness.timeline, 'PageDown');
  pressKey(harness.timeline, 'ArrowRight', true);

  assert.equal(harness.player.isPlaying(), false);
});

test('la barra: sin planos no reproduce', async () => {
  const harness = await loadPlayer({ shots: null });
  harness.player.setShots([], FPS, TOTAL_FRAMES);

  dragTimeline(harness.timeline);
  pressKey(harness.timeline, 'PageDown');

  assert.equal(harness.player.isPlaying(), false);
});
