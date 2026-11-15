// Pruebas del módulo styles: esqueleto HTML, tokens y hojas CSS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel) => readFileSync(path.join(root, rel), 'utf8');

const cssDir = path.join(root, 'renderer', 'css');
const allCss = () =>
  readdirSync(cssDir)
    .filter((name) => name.endsWith('.css'))
    .map((name) => readFileSync(path.join(cssDir, name), 'utf8'))
    .join('\n');

const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; " +
  "img-src 'self' data: blob:; media-src 'self' file: blob:; " +
  "font-src 'self'; base-uri 'none'; form-action 'none'";

const IDS = [
  'app', 'topbar', 'topbar-sources', 'topbar-actions', 'banner-region',
  'home', 'home-zones', 'home-status', 'workspace', 'player-root',
  'filmstrip-root', 'header-fields-root', 'editor-root', 'preview-pane',
  'drop-overlay', 'toast-region', 'modal-root', 'sr-status',
];

const BLOCKS = [
  'topbar', 'banner', 'dropzone', 'drop-overlay', 'player', 'filmstrip',
  'shot-card', 'header-fields', 'shot-editor', 'preview', 'preview-pane',
  'preview-toggle', 'translate-button', 'transcribe-button', 'sidebar__editor', 'modal',
  'toast', 'field', 'switch', 'segmented', 'source-chip', 'tooltip',
  'button', 'icon-button', 'progress', 'interview-picker',
];

test('index.html contiene los ids y la CSP del contrato', () => {
  const html = read('renderer/index.html');

  for (const id of IDS) {
    assert.ok(html.includes(`id="${id}"`), `falta el id "${id}"`);
  }

  assert.ok(html.includes(CSP), 'la meta CSP no coincide con la del contrato');
});

test('index.html no lleva atributos style= ni scripts en línea', () => {
  const html = read('renderer/index.html');

  assert.equal(/\sstyle\s*=/.test(html), false, 'hay un atributo style= en el HTML');
  assert.equal(
    /<script(?![^>]*\bsrc=)/i.test(html),
    false,
    'hay un <script> en línea en el HTML',
  );
});

test('revisión 2: sin pestañas y con los selectores nuevos en css/*.css', () => {
  const html = read('renderer/index.html');
  const css = allCss();

  assert.ok(html.includes('id="editor-root"'), 'falta el id "editor-root"');
  assert.ok(html.includes('id="preview-pane"'), 'falta el id "preview-pane"');
  assert.equal(html.includes('tabs-root'), false, 'sigue el id "tabs-root"');
  assert.equal(html.includes('panel-shot'), false, 'sigue el id "panel-shot"');

  for (const selector of ['.preview-pane', '.preview-toggle', '.translate-button', '.transcribe-button', '.is-autofilled', '.is-preview-open']) {
    assert.ok(css.includes(selector), `falta el selector ${selector}`);
  }
});

test('tokens.css declara todas las variables de la sección 1 del diseño', () => {
  const design = read('docs/DISENO-GRAFICO.md');
  const tokens = read('renderer/css/tokens.css');

  const keys = new Set(
    [...design.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]),
  );
  assert.ok(keys.size > 100, `solo se extrajeron ${keys.size} variables del diseño`);

  // --size-detect-list-max se borró con el modal 15.1 (17.15).
  keys.delete('--size-detect-list-max');

  for (const key of keys) {
    assert.ok(tokens.includes(`${key}:`), `falta la variable ${key} en tokens.css`);
  }
});

test('cada bloque de clases del diseño tiene su selector en css/*.css', () => {
  const css = allCss();

  for (const block of BLOCKS) {
    const selector = new RegExp(`\\.${block}(?![\\w-])`);
    assert.ok(selector.test(css), `falta el selector .${block}`);
  }
});

test('aparecen los media queries de la sección 11 y prefers-reduced-motion', () => {
  const css = allCss();
  const queries = [
    '(max-width: 1280px)',
    '(min-width: 1680px)',
    '(max-height: 760px)',
    '(prefers-reduced-motion: reduce)',
  ];

  for (const query of queries) {
    assert.ok(css.includes(query), `falta el media query ${query}`);
  }
});

test('§17: tokens, clases del selector y de la cola en la barra', () => {
  const html = read('renderer/index.html');
  const css = allCss();
  const tokens = read('renderer/css/tokens.css');

  assert.ok(tokens.includes('--size-picker:'), 'falta --size-picker');
  assert.ok(tokens.includes('--color-chart-image:'), 'falta --color-chart-image');
  assert.equal(tokens.includes('--size-detect-list-max:'), false, 'sigue --size-detect-list-max');
  assert.ok(html.includes('id="queue-status"'), 'falta el nodo de la cola');

  const selectors = [
    '.interview-picker__chart',
    '.interview-picker__legend',
    '.interview-picker__bars',
    '.interview-picker__bar',
    '.interview-picker__fill',
    '.interview-picker__speech',
    '.interview-picker__handle',
    '.interview-picker__grip',
    '.interview-picker__peek',
    '.interview-picker__notes',
    '.interview-picker__rows',
    '.interview-picker__rows:focus-visible',
    '.interview-picker__row',
    '.interview-picker__pick',
    '.interview-picker__done',
    '.interview-picker__empty',
    '.interview-picker__estimate',
    '.checkbox',
    '.checkbox__input',
    '.checkbox__box',
    '.queue-status',
    '.queue-status__label',
    '.queue-status__short',
    '.shot-card__spinner',
    '.shot-card.is-processing .shot-card__status',
    '.shot-card.is-processing .shot-card__spinner',
    '.interviews-button',
    '.shot-card__untranscribed',
    '.shot-card.is-untranscribed .shot-card__untranscribed',
  ];
  for (const selector of selectors) {
    assert.ok(css.includes(selector), `falta el selector ${selector}`);
  }
  for (const selector of ['.interview-detect__range', '.interview-detect__list']) {
    assert.equal(css.includes(selector), false, `sigue el selector ${selector}`);
  }
});

test('§17.10: la barra superior deja sitio al botón Interviews…', () => {
  const screens = read('renderer/css/screens.css');
  const tokens = read('renderer/css/tokens.css');

  assert.match(screens, /\.topbar__brand\s*\{[^}]*flex:\s*none/);
  assert.match(screens, /\.topbar__brand\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(screens, /\.topbar__sources\s*\{[^}]*min-width:\s*0/);
  assert.match(tokens, /@media \(max-width: 1679px\)\s*\{\s*:root\s*\{\s*--size-chip-max:\s*200px/);
});
