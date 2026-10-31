// Vista previa viva del .txt, contador de progreso y botón Generate.
// Funciones puras (etiqueta, resumen de faltas, rangos, troceado de la vista previa)
// y montajes de DOM según docs/DISENO-GRAFICO.md 6.1, 6.10 y 13.2.

import { el, button, icon, iconButton, setDisabled, setLoading, tooltip, formatKbd } from './ui-kit.js';
import { isShotComplete, soundbiteIndex } from '../core/shot-model.js';

// Nombres humanos de los campos de cabecera que puede traer `headerErrors`.
const HEADER_NAMES = { location: 'Location', date: 'Date', source: 'Source' };

// Marcadores de falta que escribe buildShotlist en modo no estricto.
const MISSING_MARKERS = [
  '[SHOT SIZE]',
  '[DESCRIPTION]',
  '[NAME]',
  '[GENDER]',
  '[LANGUAGE]',
  '[LOCATION]',
  '[DATE]',
  '[SOURCE]',
];

const MARKER_PATTERN = new RegExp(MISSING_MARKERS.map(escapeRegExp).join('|'), 'g');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Etiqueta del contador de progreso: «18/26 shots complete». */
export function progressLabel(done, total) {
  return `${done}/${total} shots complete`;
}

/**
 * Texto de una lista de números: ordena, agrupa rachas de 3 o más con guion corto
 * y une con «, ». `[3,7,12,13,14,15,16]` → `3, 7, 12–16`.
 */
export function rangeText(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const parts = [];
  let index = 0;
  while (index < sorted.length) {
    let end = index;
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end] + 1) end += 1;
    const runLength = end - index + 1;
    if (runLength >= 3) {
      parts.push(`${sorted[index]}\u2013${sorted[end]}`);
    } else {
      for (let i = index; i <= end; i += 1) parts.push(String(sorted[i]));
    }
    index = end + 1;
  }
  return parts.join(', ');
}

/**
 * Líneas del tooltip de Generate: cabecera, planos de imagen incompletos y
 * entrevistas incompletas (por índice de soundbite). Máximo 6 líneas.
 */
export function missingSummary({ headerErrors, shots }) {
  const errors = headerErrors ?? {};
  const lines = [];

  for (const key of ['location', 'date', 'source']) {
    if (Object.prototype.hasOwnProperty.call(errors, key)) lines.push(HEADER_NAMES[key]);
  }
  for (const key of Object.keys(errors)) {
    if (!['location', 'date', 'source'].includes(key)) lines.push(key);
  }

  const incompleteShots = shots
    .filter((shot) => !shot.interview && !isShotComplete(shot))
    .map((shot) => shot.number);
  if (incompleteShots.length > 0) lines.push(`Shots ${rangeText(incompleteShots)}`);

  const incompleteInterviews = shots
    .filter((shot) => shot.interview && !isShotComplete(shot))
    .map((shot) => soundbiteIndex(shots, shot.number));
  if (incompleteInterviews.length > 0) {
    lines.push(`Soundbites ${rangeText(incompleteInterviews)}`);
  }

  if (lines.length <= 6) return lines;
  return [...lines.slice(0, 5), `and ${lines.length - 5} more`];
}

// Separa un texto en segmentos, marcando como `missing` los marcadores de falta.
function tokenize(text) {
  const segments = [];
  let last = 0;
  MARKER_PATTERN.lastIndex = 0;
  let match;
  while ((match = MARKER_PATTERN.exec(text)) !== null) {
    if (match.index > last) segments.push({ text: text.slice(last, match.index), missing: false });
    segments.push({ text: match[0], missing: true });
    last = match.index + match[0].length;
  }
  if (last < text.length || segments.length === 0) {
    segments.push({ text: text.slice(last), missing: false });
  }
  return segments;
}

/**
 * Trocea el texto de buildShotlist en el bloque de cabecera y un bloque por
 * plano. La concatenación de todos los segmentos es el texto original.
 */
export function splitPreview(text, shots, currentNumber) {
  const planNumbers = new Set((shots ?? []).map((shot) => shot.number));
  const starts = [];
  const pattern = /^(\d+)\. /gm;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    const number = Number(match[1]);
    if (planNumbers.has(number)) starts.push({ offset: match.index, number });
  }

  const headerEnd = starts.length > 0 ? starts[0].offset : text.length;
  const blocks = [
    {
      text: text.slice(0, headerEnd),
      current: false,
      number: null,
      segments: tokenize(text.slice(0, headerEnd)),
    },
  ];

  for (let i = 0; i < starts.length; i += 1) {
    const end = i + 1 < starts.length ? starts[i + 1].offset : text.length;
    const blockText = text.slice(starts[i].offset, end);
    blocks.push({
      text: blockText,
      current: starts[i].number === currentNumber,
      number: starts[i].number,
      segments: tokenize(blockText),
    });
  }

  return blocks;
}

// Monta el contador y el botón Generate en #topbar-actions.
export function mountProgress(root, { onGenerate }) {
  const fill = el('div', { class: 'progress__fill' });
  const label = el('span', { class: 'progress__label' });
  const progress = el(
    'div',
    { class: 'progress' },
    el('div', { class: 'progress__bar', 'aria-hidden': 'true' }, fill),
    label,
  );
  const generate = button({ variant: 'primary', label: 'Generate', className: 'generate' });
  generate.style.minWidth = '96px';
  const buttonsEl = el('div', { class: 'topbar__buttons' }, generate);

  let missingLines = [];
  let fileName = '';

  function labelContent(done, total) {
    label.replaceChildren();
    if (total > 0 && done === total) label.append(icon('check'));
    label.append(document.createTextNode(progressLabel(done, total)));
  }

  function tooltipContent() {
    if (missingLines.length === 0) {
      return el(
        'span',
        {},
        `Save ${fileName} next to the video `,
        el('kbd', { class: 'kbd', text: formatKbd('Ctrl+S') }),
      );
    }
    return el(
      'div',
      {},
      el('strong', { text: 'Complete these to generate:' }),
      ...missingLines.map((line) => el('div', { text: line })),
    );
  }

  const onClick = () => onGenerate();
  generate.addEventListener('click', onClick);
  tooltip(generate, () => tooltipContent());

  function update(options) {
    const { done, total } = options;
    missingLines = options.missingLines ?? [];
    fileName = options.fileName ?? '';

    const ratio = total > 0 ? Math.min(Math.max(done / total, 0), 1) : 0;
    fill.style.width = `${ratio * 100}%`;
    progress.classList.toggle('is-complete', total > 0 && done === total);
    labelContent(done, total);
    setDisabled(generate, missingLines.length > 0);
  }

  function setBusy(busy) {
    setLoading(generate, busy);
  }

  function destroy() {
    generate.removeEventListener('click', onClick);
    progress.remove();
    buttonsEl.remove();
  }

  root.append(progress, buttonsEl);
  root.hidden = false;

  return { update, setBusy, buttonsEl, destroy };
}

// Monta el conmutador Preview (13.2.1) como primer hijo de div.topbar__buttons.
export function mountPreviewToggle(buttonsEl, { onToggle }) {
  const toggle = button({
    variant: 'secondary',
    icon: 'panel-right',
    label: 'Preview',
    className: 'preview-toggle',
  });
  toggle.setAttribute('aria-pressed', 'false');
  toggle.setAttribute('aria-controls', 'preview-pane');
  tooltip(toggle, 'Preview', { kbd: 'Alt+P' });

  let open = false;

  function setOpen(value) {
    open = Boolean(value);
    toggle.classList.toggle('is-active', open);
    toggle.setAttribute('aria-pressed', open ? 'true' : 'false');
  }

  const onClick = () => {
    setOpen(!open);
    onToggle(open);
  };
  toggle.addEventListener('click', onClick);
  buttonsEl.prepend(toggle);

  return {
    setOpen,
    isOpen() {
      return open;
    },
    destroy() {
      toggle.removeEventListener('click', onClick);
      toggle.remove();
    },
  };
}

/**
 * Estado del botón «Translate all» a partir de los pendientes y de si hay una
 * traducción masiva en curso o la cola automática de entrevistas (15.2.2).
 * Función pura: sin DOM.
 */
export function translateAllState({ pending, busy, waiting = false }) {
  const count = Math.max(0, pending ?? 0);
  const disabled = count === 0;
  if (waiting) {
    return {
      disabled: true,
      loading: false,
      tooltip: 'Wait for the background transcription to finish',
    };
  }
  if (busy) return { disabled, loading: true, tooltip: 'Translating…' };
  if (disabled) return { disabled: true, loading: false, tooltip: 'No soundbites to translate' };
  const noun = count === 1 ? 'soundbite' : 'soundbites';
  return {
    disabled: false,
    loading: false,
    tooltip: `Translate ${count} ${noun} without translation (online service)`,
  };
}

// Monta el botón «Translate all» (13.8) como primer hijo de div.topbar__buttons.
export function mountTranslateAll(buttonsEl, { onClick }) {
  const btn = button({
    variant: 'secondary',
    icon: 'translate',
    label: 'Translate all',
    className: 'translate-all',
  });

  let state = translateAllState({ pending: 0, busy: false });

  function apply() {
    setLoading(btn, state.loading);
    setDisabled(btn, state.disabled);
    btn.setAttribute('aria-label', state.tooltip);
  }

  const onClickHandler = () => {
    if (state.loading || state.disabled) return;
    onClick();
  };

  btn.addEventListener('click', onClickHandler);
  tooltip(btn, () => state.tooltip);
  btn.hidden = true;
  apply();
  buttonsEl.prepend(btn);

  return {
    update(options) {
      state = translateAllState({
        pending: options.pending ?? 0,
        busy: Boolean(options.busy),
        waiting: Boolean(options.waiting),
      });
      apply();
    },
    setVisible(visible) {
      btn.hidden = !visible;
    },
    destroy() {
      btn.removeEventListener('click', onClickHandler);
      btn.remove();
    },
  };
}

// Monta la columna Preview (13.2 y 6.10) en #preview-pane.
export function mountPreview(root, { onClose, onSelect } = {}) {
  const title = el('h2', { class: 'preview-pane__title' });
  const close = iconButton({
    icon: 'close',
    label: 'Close preview',
    className: 'preview-pane__close',
  });
  const header = el(
    'header',
    { class: 'preview-pane__header' },
    title,
    el('span', { class: 'preview-pane__note', text: 'Live preview' }),
    close,
  );
  const pre = el('pre', {
    class: 'preview__text',
    tabindex: '0',
    'aria-label': 'Shotlist preview',
  });
  const preview = el('div', { class: 'preview' }, pre);

  let previousCurrent = null;
  let currentBlock = null;

  function renderBlock(block) {
    const children = block.segments.map((segment) =>
      segment.missing
        ? el('span', { class: 'preview__missing', text: segment.text })
        : segment.text,
    );
    const className = block.current ? 'preview__block is-current' : 'preview__block';
    const attrs = { class: className };
    if (block.number !== null) attrs['data-shot'] = String(block.number);
    return el('span', attrs, ...children);
  }

  function scrollToCurrent() {
    if (currentBlock && typeof currentBlock.scrollIntoView === 'function') {
      currentBlock.scrollIntoView({ block: 'center' });
    }
  }

  function update(options) {
    const { text, shots, currentNumber, fileName } = options;
    const scrollTop = pre.scrollTop;

    title.textContent = fileName;
    title.title = fileName;
    pre.replaceChildren(...splitPreview(text, shots, currentNumber).map(renderBlock));
    currentBlock = pre.querySelector('.preview__block.is-current');

    if (previousCurrent !== currentNumber) scrollToCurrent();
    else pre.scrollTop = scrollTop;
    previousCurrent = currentNumber;
  }

  function setOpen(value) {
    const open = Boolean(value);
    root.hidden = !open;
    root.classList.toggle('is-open', open);
    if (open) scrollToCurrent();
  }

  function onKeydown(event) {
    if (event.key === 'Escape') onClose?.();
  }

  // Copiar texto de la vista previa tiene prioridad sobre saltar al plano.
  function isSelectingText() {
    const selection = window.getSelection();
    if (!selection || selection.toString() === '') return false;
    const node = selection.anchorNode;
    return node ? pre.contains(node) : false;
  }

  const onPreviewClick = (event) => {
    if (isSelectingText()) return;
    const block = event.target?.closest?.('.preview__block[data-shot]');
    if (!block) return;
    const number = Number(block.dataset.shot);
    if (!Number.isNaN(number)) onSelect?.(number);
  };

  const onCloseClick = () => onClose?.();

  close.addEventListener('click', onCloseClick);
  root.addEventListener('keydown', onKeydown);
  pre.addEventListener('click', onPreviewClick);

  function destroy() {
    close.removeEventListener('click', onCloseClick);
    root.removeEventListener('keydown', onKeydown);
    pre.removeEventListener('click', onPreviewClick);
    header.remove();
    preview.remove();
    currentBlock = null;
    previousCurrent = null;
  }

  root.append(header, preview);

  return { update, scrollToCurrent, setOpen, destroy };
}
