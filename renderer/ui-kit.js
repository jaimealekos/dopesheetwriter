// Utilidades de DOM y controles comunes de la interfaz.
// Ver docs/DISENO-GRAFICO.md 3 (iconos) y 5 (controles).
// Sin referencias a `document` a nivel de módulo: solo dentro de las funciones.

const SVG_NS = 'http://www.w3.org/2000/svg';

// --- Iconos (sección 3) ---------------------------------------------------

// Forma de cada icono: lista de [etiqueta, atributos].
const ICON_SHAPES = {
  play: [['path', { d: 'M8 5.5v13l10.5-6.5z', fill: 'currentColor' }]],
  pause: [
    ['rect', { x: '7', y: '5', width: '3.5', height: '14', rx: '1', fill: 'currentColor' }],
    ['rect', { x: '13.5', y: '5', width: '3.5', height: '14', rx: '1', fill: 'currentColor' }],
  ],
  'shot-prev': [
    ['path', { d: 'M6 6v12' }],
    ['path', { d: 'M18 6 9 12l9 6z' }],
  ],
  'shot-next': [
    ['path', { d: 'M18 6v12' }],
    ['path', { d: 'M6 6l9 6-9 6z' }],
  ],
  volume: [
    ['path', { d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z' }],
    ['path', { d: 'M15.5 9a4 4 0 0 1 0 6' }],
    ['path', { d: 'M18 6.5a7.5 7.5 0 0 1 0 11' }],
  ],
  mute: [
    ['path', { d: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4z' }],
    ['path', { d: 'M16 9.5l5 5' }],
    ['path', { d: 'M21 9.5l-5 5' }],
  ],
  film: [
    ['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }],
    ['path', { d: 'M7 4v16' }],
    ['path', { d: 'M17 4v16' }],
    ['path', { d: 'M3 9h4' }],
    ['path', { d: 'M3 15h4' }],
    ['path', { d: 'M17 9h4' }],
    ['path', { d: 'M17 15h4' }],
  ],
  xml: [
    ['path', { d: 'M6 3h8l4 4v14H6z' }],
    ['path', { d: 'M14 3v4h4' }],
    ['path', { d: 'M10 12l-2 2 2 2' }],
    ['path', { d: 'M14 12l2 2-2 2' }],
  ],
  drop: [
    ['path', { d: 'M12 15V4' }],
    ['path', { d: 'M7.5 8.5 12 4l4.5 4.5' }],
    ['path', { d: 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' }],
  ],
  check: [['path', { d: 'M5 12.5l4.5 4.5L19 7.5' }]],
  error: [
    ['circle', { cx: '12', cy: '12', r: '9' }],
    ['path', { d: 'M12 7.5v5.5' }],
    ['path', { d: 'M12 16.5v.01' }],
  ],
  warning: [
    ['path', { d: 'M12 3.5 21.5 20h-19z' }],
    ['path', { d: 'M12 10v4' }],
    ['path', { d: 'M12 17v.01' }],
  ],
  close: [
    ['path', { d: 'M6 6l12 12' }],
    ['path', { d: 'M18 6 6 18' }],
  ],
  'chevron-down': [['path', { d: 'M6 9l6 6 6-6' }]],
  copy: [
    ['rect', { x: '8', y: '8', width: '12', height: '12', rx: '2' }],
    ['path', { d: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' }],
  ],
  'next-pending': [
    ['path', { d: 'M5 12h12' }],
    ['path', { d: 'M13 7l5 5-5 5' }],
    ['path', { d: 'M20 6v12' }],
  ],
  folder: [
    ['path', { d: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z' }],
  ],
  'image-off': [
    ['rect', { x: '3', y: '5', width: '18', height: '14', rx: '2' }],
    ['path', { d: 'M3 5l18 14' }],
  ],
  'panel-right': [
    ['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }],
    ['path', { d: 'M15 4v16' }],
    ['path', { d: 'M17.5 8.5h1.5' }],
    ['path', { d: 'M17.5 12h1.5' }],
    ['path', { d: 'M17.5 15.5h1.5' }],
  ],
  translate: [
    ['path', { d: 'M4 5h9' }],
    ['path', { d: 'M8.5 3v2' }],
    ['path', { d: 'M11 5c-.8 4-3.2 7-6.5 8.5' }],
    ['path', { d: 'M6.5 9c1.2 1.8 3 3.2 5 4' }],
    ['path', { d: 'M12.5 21l4.25-9 4.25 9' }],
    ['path', { d: 'M14.2 17.5h5.1' }],
  ],
  transcribe: [
    ['path', { d: 'M4 10v4' }],
    ['path', { d: 'M7 6v12' }],
    ['path', { d: 'M10 9v6' }],
    ['path', { d: 'M14 8h6' }],
    ['path', { d: 'M14 12h6' }],
    ['path', { d: 'M14 16h4' }],
  ],
  spinner: [['circle', { cx: '12', cy: '12', r: '9', 'stroke-dasharray': '42 15' }]],
};

export const ICON_NAMES = Object.keys(ICON_SHAPES);

function shapeMarkup([tag, attrs]) {
  const pairs = Object.entries(attrs)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');
  return `<${tag}${pairs}></${tag}>`;
}

/** Contenido interior del <svg> de un icono, como cadena. */
export function iconMarkup(name) {
  const shapes = ICON_SHAPES[name];
  if (!shapes) throw new Error(`Unknown icon "${name}".`);
  return shapes.map(shapeMarkup).join('');
}

/** Crea el <svg> de un icono (16px por defecto, 20px 'player', 32px 'dropzone'). */
export function icon(name, size) {
  const shapes = ICON_SHAPES[name];
  if (!shapes) throw new Error(`Unknown icon "${name}".`);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.75');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  let className = `icon icon--${name}`;
  if (size === 'player') className += ' icon--player';
  else if (size === 'dropzone') className += ' icon--dropzone';
  svg.setAttribute('class', className);

  for (const [tag, attrs] of shapes) {
    const shape = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(attrs)) shape.setAttribute(key, value);
    svg.appendChild(shape);
  }
  return svg;
}

/** Icono `spinner` con la clase extra que lo hace girar. */
export function spinner(size) {
  const svg = icon('spinner', size);
  svg.classList.add('spinner');
  return svg;
}

// --- Utilidades de DOM ----------------------------------------------------

function appendChild(node, child) {
  if (child === null || child === undefined || child === false) return;
  if (Array.isArray(child)) {
    for (const item of child) appendChild(node, item);
    return;
  }
  if (typeof child === 'string') {
    node.appendChild(document.createTextNode(child));
    return;
  }
  node.appendChild(child);
}

/** Crea un elemento: class/text/on/dataset con azúcar, el resto como atributos. */
export function el(tag, attrs, ...children) {
  const node = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === false || value === null || value === undefined) continue;
      if (key === 'class') {
        node.className = value;
      } else if (key === 'text') {
        node.textContent = value;
      } else if (key === 'on') {
        for (const [event, handler] of Object.entries(value)) {
          node.addEventListener(event, handler);
        }
      } else if (key === 'dataset') {
        Object.assign(node.dataset, value);
      } else if (value === true) {
        node.setAttribute(key, '');
      } else {
        node.setAttribute(key, String(value));
      }
    }
  }

  for (const child of children) appendChild(node, child);
  return node;
}

// --- Botones (5.1, 5.2) ---------------------------------------------------

/** Botón `.button` con variante, icono, etiqueta y atajo opcionales. */
export function button(o) {
  const variant = o.variant ?? 'secondary';
  const className = ['button', `button--${variant}`, o.className].filter(Boolean).join(' ');
  const btn = el('button', { type: 'button', class: className });

  if (o.icon) btn.appendChild(icon(o.icon));
  btn.appendChild(el('span', { class: 'button__label', text: o.label }));
  if (o.kbd) btn.appendChild(el('kbd', { class: 'kbd', text: formatKbd(o.kbd) }));
  if (o.onClick) btn.addEventListener('click', o.onClick);
  return btn;
}

/** Botón de icono `.icon-button` con tooltip automático. */
export function iconButton(o) {
  const className = ['icon-button', o.className].filter(Boolean).join(' ');
  const btn = el('button', { type: 'button', class: className, 'aria-label': o.label });
  btn.appendChild(icon(o.icon, o.iconSize));
  tooltip(btn, o.label);
  if (o.onClick) btn.addEventListener('click', o.onClick);
  return btn;
}

/** Añade o quita `is-disabled` + `aria-disabled` (sigue enfocable). */
export function setDisabled(btn, disabled) {
  btn.classList.toggle('is-disabled', disabled);
  if (disabled) btn.setAttribute('aria-disabled', 'true');
  else btn.removeAttribute('aria-disabled');
}

// Estado guardado al poner un botón en carga, para poder restaurarlo.
const loadingState = new WeakMap();

/** Sustituye el contenido del botón por un spinner y fija su ancho. */
export function setLoading(btn, loading) {
  if (loading) {
    if (loadingState.has(btn)) return;
    const state = { children: Array.from(btn.childNodes), width: btn.style.width };
    const rect = btn.getBoundingClientRect();
    if (rect.width) btn.style.width = `${rect.width}px`;
    btn.replaceChildren(spinner());
    btn.classList.add('is-loading');
    btn.setAttribute('aria-busy', 'true');
    loadingState.set(btn, state);
    return;
  }

  const state = loadingState.get(btn);
  if (!state) return;
  btn.replaceChildren(...state.children);
  btn.style.width = state.width;
  btn.classList.remove('is-loading');
  btn.removeAttribute('aria-busy');
  loadingState.delete(btn);
}

// --- Tooltip (5.7) --------------------------------------------------------

const TOOLTIP_DELAY_MS = 500;
const TOOLTIP_MARGIN = 8;

let tooltipLayer = null;
let tooltipEl = null;
let activeTarget = null;
let activeContent = null;
let activeKbd = null;
let tooltipTimer = null;

function hideTooltip() {
  if (tooltipTimer !== null) {
    clearTimeout(tooltipTimer);
    tooltipTimer = null;
  }
  activeTarget = null;
  if (tooltipEl) tooltipEl.classList.remove('is-visible');
}

function ensureTooltipLayer() {
  if (tooltipLayer) return;
  tooltipLayer = el('div', { class: 'tooltip-layer' });
  tooltipEl = el('div', { class: 'tooltip', role: 'tooltip', id: 'ui-kit-tooltip' });
  tooltipLayer.appendChild(tooltipEl);
  document.body.appendChild(tooltipLayer);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') hideTooltip();
  });
  document.addEventListener('pointerdown', () => hideTooltip(), true);
}

function positionTooltip() {
  if (!activeTarget || !tooltipEl) return;
  const rect = activeTarget.getBoundingClientRect();
  const tip = tooltipEl.getBoundingClientRect();
  const viewport = window.innerWidth || 0;

  let left = rect.left + rect.width / 2 - tip.width / 2;
  left = Math.max(TOOLTIP_MARGIN, Math.min(left, viewport - tip.width - TOOLTIP_MARGIN));
  let top = rect.top - tip.height - TOOLTIP_MARGIN;
  if (top < TOOLTIP_MARGIN) top = rect.bottom + TOOLTIP_MARGIN;

  tooltipEl.style.left = `${left}px`;
  tooltipEl.style.top = `${top}px`;
}

function showTooltip() {
  tooltipTimer = null;
  if (!activeTarget) return;
  const raw = activeContent ? activeContent() : '';
  tooltipEl.replaceChildren();
  if (raw === '' || raw === null || raw === undefined) {
    tooltipEl.classList.remove('is-visible');
    return;
  }
  if (typeof Node !== 'undefined' && raw instanceof Node) tooltipEl.appendChild(raw);
  else tooltipEl.appendChild(document.createTextNode(String(raw)));
  if (activeKbd) tooltipEl.appendChild(el('kbd', { class: 'kbd', text: formatKbd(activeKbd) }));
  positionTooltip();
  tooltipEl.classList.add('is-visible');
}

function showsOnFocusVisible(target) {
  try {
    return target.matches(':focus-visible');
  } catch (error) {
    return false;
  }
}

/** Enlaza un tooltip al objetivo; `content` puede ser texto, Node o función. */
export function tooltip(target, content, o = {}) {
  ensureTooltipLayer();
  const getContent = typeof content === 'function' ? content : () => content;
  const kbd = o.kbd ?? null;

  target.setAttribute('aria-describedby', tooltipEl.id || 'ui-kit-tooltip');

  function activate() {
    activeTarget = target;
    activeContent = getContent;
    activeKbd = kbd;
  }

  target.addEventListener('pointerenter', () => {
    activate();
    if (tooltipTimer !== null) clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(showTooltip, TOOLTIP_DELAY_MS);
  });
  target.addEventListener('pointerleave', hideTooltip);
  target.addEventListener('focusin', () => {
    if (!showsOnFocusVisible(target)) return;
    activate();
    showTooltip();
  });
  target.addEventListener('focusout', hideTooltip);
}

// --- Conmutador (5.4) -----------------------------------------------------

/** Conmutador de 5.4 con API de estado. */
export function createSwitch(o) {
  const input = el('input', { type: 'checkbox', class: 'switch__input', id: o.id, role: 'switch' });
  input.checked = Boolean(o.checked);

  const track = el('span', { class: 'switch__track' }, el('span', { class: 'switch__thumb' }));
  const root = el(
    'label',
    { class: 'switch', for: o.id },
    input,
    track,
    el('span', { class: 'switch__label', text: o.label }),
  );

  if (o.onChange) input.addEventListener('change', () => o.onChange(input.checked));

  return {
    root,
    input,
    setChecked(value) {
      input.checked = Boolean(value);
    },
    setDisabled(value) {
      root.classList.toggle('is-disabled', Boolean(value));
      input.disabled = Boolean(value);
    },
  };
}

// --- Campo (5.3) ----------------------------------------------------------

const TEXTAREA_MAX_HEIGHT = 240;

/** Campo de 5.3: input, select o textarea con ayuda y error bajo demanda. */
export function createField(o) {
  const kind = o.kind;
  const fieldClass = ['field'];
  if (kind === 'select') fieldClass.push('field--select');
  if (kind === 'textarea') fieldClass.push('field--textarea');
  const root = el('div', { class: fieldClass.join(' ') });

  const labelRow = el(
    'div',
    { class: 'field__label-row' },
    el('label', { class: 'field__label', for: o.id, text: o.label }),
  );
  if (o.optional) labelRow.appendChild(el('span', { class: 'field__optional', text: 'Optional' }));
  root.appendChild(labelRow);

  let control;
  let helpEl = null;
  let errorEl = null;

  function updateDescribedBy() {
    const ids = [];
    if (helpEl) ids.push(`${o.id}-help`);
    if (errorEl) ids.push(`${o.id}-error`);
    if (ids.length > 0) control.setAttribute('aria-describedby', ids.join(' '));
    else control.removeAttribute('aria-describedby');
  }

  function autoHeight() {
    control.style.height = 'auto';
    const height = Math.min(control.scrollHeight, TEXTAREA_MAX_HEIGHT);
    control.style.height = `${height}px`;
    control.style.overflowY = control.scrollHeight > TEXTAREA_MAX_HEIGHT ? 'auto' : 'hidden';
  }

  if (kind === 'select') {
    control = el('select', { class: 'field__select', id: o.id });
    for (const option of o.options ?? []) {
      control.appendChild(el('option', { value: option.value, text: option.label }));
    }
    control.value = o.value ?? '';

    const updateEmpty = () => control.classList.toggle('is-empty', control.value === '');
    updateEmpty();
    control.addEventListener('change', updateEmpty);
    control.addEventListener('input', () => o.onInput?.(control.value));

    const chevron = icon('chevron-down');
    chevron.classList.add('field__chevron');
    root.appendChild(el('div', { class: 'field__select-wrap' }, control, chevron));
  } else if (kind === 'textarea') {
    control = el('textarea', { class: 'field__textarea', id: o.id });
    if (o.placeholder !== undefined) control.placeholder = o.placeholder;
    if (o.value !== undefined) control.value = o.value;
    if (o.minHeight === 'quote') control.classList.add('is-quote');
    if (o.spellcheck !== undefined) control.setAttribute('spellcheck', String(o.spellcheck));
    control.addEventListener('input', () => {
      autoHeight();
      o.onInput?.(control.value);
    });
    control.addEventListener('blur', () => o.onBlur?.(control.value));
    root.appendChild(control);
  } else {
    control = el('input', { class: 'field__input', id: o.id, type: 'text' });
    if (o.placeholder !== undefined) control.placeholder = o.placeholder;
    if (o.value !== undefined) control.value = o.value;
    if (o.inputMode !== undefined) control.setAttribute('inputmode', o.inputMode);
    if (o.maxLength !== undefined) control.setAttribute('maxlength', String(o.maxLength));
    control.addEventListener('input', () => o.onInput?.(control.value));
    control.addEventListener('blur', () => o.onBlur?.(control.value));
    root.appendChild(control);
  }

  if (o.required) control.setAttribute('aria-required', 'true');

  return {
    root,
    control,
    getValue() {
      return control.value;
    },
    setValue(value) {
      control.value = value;
      if (kind === 'select') control.classList.toggle('is-empty', control.value === '');
      if (kind === 'textarea') autoHeight();
    },
    setError(message) {
      if (message) {
        if (!errorEl) {
          errorEl = el('p', { class: 'field__error', id: `${o.id}-error` });
          root.appendChild(errorEl);
        }
        errorEl.replaceChildren(icon('error'), document.createTextNode(String(message)));
        root.classList.add('is-error');
        control.setAttribute('aria-invalid', 'true');
      } else {
        if (errorEl) {
          errorEl.remove();
          errorEl = null;
        }
        root.classList.remove('is-error');
        control.removeAttribute('aria-invalid');
      }
      updateDescribedBy();
    },
    setHelp(text) {
      if (text === null || text === undefined || text === '') {
        if (helpEl) {
          helpEl.remove();
          helpEl = null;
        }
      } else {
        if (!helpEl) {
          helpEl = el('p', { class: 'field__help', id: `${o.id}-help` });
          root.appendChild(helpEl);
        }
        helpEl.textContent = text;
      }
      updateDescribedBy();
    },
    setDisabled(value) {
      root.classList.toggle('is-disabled', Boolean(value));
      control.disabled = Boolean(value);
    },
  };
}

// --- Control segmentado (5.5) ---------------------------------------------

/** Grupo de radios de 5.5 (Gender). */
export function createSegmented(o) {
  const labelId = `${o.id}-label`;
  const root = el('div', { class: 'field field--segmented' });
  root.appendChild(el('span', { class: 'field__label', id: labelId, text: o.label }));

  const group = el('div', {
    class: 'segmented',
    role: 'radiogroup',
    'aria-labelledby': labelId,
    'aria-required': 'true',
  });
  const entries = [];

  for (const value of o.options) {
    const input = el('input', { type: 'radio', name: o.id, value });
    const option = el('label', { class: 'segmented__option' }, input, el('span', { text: value }));
    input.addEventListener('change', () => {
      if (!input.checked) return;
      syncChecked();
      o.onChange?.(value);
    });
    entries.push({ input, option });
    group.appendChild(option);
  }
  root.appendChild(group);

  let errorEl = null;

  function syncChecked() {
    for (const entry of entries) entry.option.classList.toggle('is-checked', entry.input.checked);
  }

  if (o.value !== undefined) {
    for (const entry of entries) entry.input.checked = entry.input.value === o.value;
  }
  syncChecked();

  return {
    root,
    getValue() {
      const found = entries.find((entry) => entry.input.checked);
      return found ? found.input.value : '';
    },
    setValue(value) {
      for (const entry of entries) entry.input.checked = entry.input.value === value;
      syncChecked();
    },
    setError(message) {
      if (message) {
        if (!errorEl) {
          errorEl = el('p', { class: 'field__error', id: `${o.id}-error` });
          root.appendChild(errorEl);
        }
        errorEl.textContent = message;
        root.classList.add('is-error');
      } else {
        if (errorEl) {
          errorEl.remove();
          errorEl = null;
        }
        root.classList.remove('is-error');
      }
    },
  };
}

// --- Teclado y edades -----------------------------------------------------

/** Atajo de teclado: en macOS Ctrl→⌘ y Alt→⌥. */
export function formatKbd(keys) {
  const platform = typeof navigator !== 'undefined' ? String(navigator.platform ?? '') : '';
  if (!/Mac/.test(platform)) return keys;
  return keys.replace(/\bCtrl\b/g, '\u2318').replace(/\bAlt\b/g, '\u2325');
}

/** Edad: recorta espacios y valida de 0 a 3 dígitos. */
export function normalizeAge(text) {
  const value = String(text ?? '').trim();
  return { value, valid: /^\d{0,3}$/.test(value) };
}
