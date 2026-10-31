// Pantalla de inicio (zonas de soltar), chips de fuente de la barra superior y
// campos de cabecera (Location, Date, Source). Ver docs/DISENO-GRAFICO.md 5.6, 6.3, 6.7.

import { VIDEO_EXTENSIONS, XML_EXTENSIONS, DEFAULT_LOCATION, MONTHS } from '../core/config.js';
import { formatTimecode } from '../core/timecode.js';
import { el, icon, spinner, button, setDisabled, createField, tooltip } from './ui-kit.js';

// --- Funciones puras -------------------------------------------------------

// Extensión (con punto, en minúsculas) de un nombre de fichero, o '' si no tiene.
function extensionOf(fileName) {
  const dot = String(fileName).lastIndexOf('.');
  return dot === -1 ? '' : String(fileName).slice(dot).toLowerCase();
}

// Clasifica por extensión: 'video', 'xml' o null.
export function classifyFile(fileName) {
  const ext = extensionOf(fileName);
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  if (XML_EXTENSIONS.includes(ext)) return 'xml';
  return null;
}

// Primer vídeo y primer xml del arrastre; el resto de nombres van a rejected.
export function classifyDrop(files) {
  let video = null;
  let xml = null;
  const rejected = [];
  for (const file of files) {
    const kind = classifyFile(file.name);
    if (kind === 'video' && video === null) video = file;
    else if (kind === 'xml' && xml === null) xml = file;
    else rejected.push(file.name);
  }
  return { video, xml, rejected };
}

// Último componente de una ruta, con / o \.
export function baseName(path) {
  return String(path).split(/[\\/]/).pop();
}

// Errores de los campos obligatorios de cabecera; solo las claves con error.
export function headerErrors(header) {
  const errors = {};
  if ((header.location ?? '').trim() === '') errors.location = 'Enter the location.';
  if ((header.date ?? '').trim() === '') errors.date = 'Enter the date, e.g. MARCH 11, 2026.';
  if ((header.source ?? '').trim() === '') errors.source = 'Enter the source.';
  return errors;
}

// fps sin decimales si es entero y con dos si no (25, 29.97).
function formatFps(fps) {
  return Number.isInteger(fps) ? String(fps) : fps.toFixed(2);
}

// «00:03:12:05 · 1920×1080 · 25 fps»
export function videoMeta(o) {
  return `${formatTimecode(o.duration, o.fps)} · ${o.width}×${o.height} · ${formatFps(o.fps)} fps`;
}

// «26 shots · 25 fps · 00:03:12:05»
export function xmlMeta(o) {
  const shots = o.shots === 1 ? '1 shot' : `${o.shots} shots`;
  return `${shots} · ${formatFps(o.fps)} fps · ${formatTimecode(o.totalFrames / o.fps, o.fps)}`;
}

// --- Textos de la pantalla de inicio --------------------------------------

const DROPZONE_TEXT = {
  video: {
    title: 'Video source',
    hint: 'Drag an .mp4, .mov or .m4v file here',
    loading: 'Reading video…',
  },
  xml: {
    title: 'Xml',
    hint: 'Drag the sequence .xml exported from Final Cut or Premiere',
    loading: 'Reading XML…',
  },
};

function dropzoneIcon(name) {
  const svg = icon(name);
  svg.classList.add('dropzone__icon');
  return svg;
}

// --- Zonas de soltar (6.3) ------------------------------------------------

function buildDropzone(kind, o) {
  const texts = DROPZONE_TEXT[kind];
  const defaultIconName = kind === 'video' ? 'film' : 'xml';
  const titleId = `dropzone-${kind}-title`;

  const section = el('section', {
    class: `dropzone dropzone--${kind}`,
    'aria-labelledby': titleId,
    on: { click: () => { if (!loading) o.onBrowse(kind); } },
  });

  let iconEl = dropzoneIcon(defaultIconName);
  iconEl.dataset.icon = defaultIconName;

  const title = el('h2', { class: 'dropzone__title', id: titleId, text: texts.title });
  const hint = el('p', { class: 'dropzone__hint', text: texts.hint });

  const file = el('div', { class: 'dropzone__file', hidden: true });
  const fileName = el('p', { class: 'dropzone__name' });
  const fileMeta = el('p', { class: 'dropzone__meta' });
  const fileNote = el('p', { class: 'dropzone__note' });
  file.append(fileName, fileMeta, fileNote);

  const status = el('p', { class: 'dropzone__status', hidden: true });
  const statusText = el('span');
  status.append(spinner('sm'), statusText);

  const error = el('p', { class: 'dropzone__error', role: 'alert', hidden: true });

  const browse = button({
    variant: 'secondary',
    label: 'Examinar',
    className: 'dropzone__browse',
    onClick: (event) => {
      event.stopPropagation();
      if (!loading) o.onBrowse(kind);
    },
  });

  section.append(iconEl, title, hint, file, status, error, browse);

  let loading = false;

  function setIcon(name) {
    if (iconEl.dataset.icon === name) return;
    const next = dropzoneIcon(name);
    next.dataset.icon = name;
    iconEl.replaceWith(next);
    iconEl = next;
  }

  function clearDragover() {
    section.classList.remove('is-dragover');
    hint.textContent = texts.hint;
  }

  section.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (loading) return;
    section.classList.add('is-dragover');
    hint.textContent = 'Release to load';
  });
  section.addEventListener('dragleave', (event) => {
    event.preventDefault();
    clearDragover();
  });
  section.addEventListener('drop', (event) => {
    event.preventDefault();
    clearDragover();
    const dropped = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (dropped) o.onDropFiles(kind, dropped);
  });

  function apply(state) {
    const s = state || { status: 'empty' };
    loading = s.status === 'loading';

    section.classList.toggle('is-loading', s.status === 'loading');
    section.classList.toggle('is-loaded', s.status === 'loaded');
    section.classList.toggle('is-error', s.status === 'error');

    hint.hidden = true;
    file.hidden = true;
    status.hidden = true;
    error.hidden = true;

    if (s.status === 'loading') {
      setIcon(defaultIconName);
      statusText.textContent = texts.loading;
      status.hidden = false;
      setDisabled(browse, true);
    } else if (s.status === 'loaded') {
      setIcon('check');
      fileName.textContent = s.name || baseName(s.path || '');
      fileName.title = s.path || s.name || '';
      fileMeta.textContent = s.meta || '';
      fileMeta.hidden = !s.meta;
      fileNote.textContent = s.note || '';
      fileNote.hidden = !s.note;
      file.hidden = false;
      setDisabled(browse, false);
    } else if (s.status === 'error') {
      setIcon('error');
      error.textContent = s.error || '';
      error.hidden = false;
      setDisabled(browse, false);
    } else {
      setIcon(defaultIconName);
      hint.textContent = texts.hint;
      hint.hidden = false;
      setDisabled(browse, false);
    }
  }

  return { kind, section, apply, clearDragover };
}

// `root` es #home-zones.
export function mountHome(root, o) {
  const home = root.closest('.home');
  const zones = {
    video: buildDropzone('video', o),
    xml: buildDropzone('xml', o),
  };

  root.replaceChildren(zones.video.section, zones.xml.section);

  return {
    setState(kind, state) {
      zones[kind].apply(state);
    },
    setGlobalDragover(active) {
      if (home) home.classList.toggle('is-dragover', active);
    },
    destroy() {
      root.replaceChildren();
      if (home) home.classList.remove('is-dragover');
    },
  };
}

// --- Chips de fuente de la barra superior (5.6) ---------------------------

function setChip(chip, name) {
  chip.querySelector('.source-chip__name').textContent = name || '';
  chip.title = name || '';
}

// `root` es #topbar-sources.
export function mountChips(root, o) {
  const chips = {};
  for (const kind of ['video', 'xml']) {
    const isVideo = kind === 'video';
    const chip = el('button', {
      type: 'button',
      class: `source-chip source-chip--${kind}`,
      on: { click: () => o.onChange(kind) },
    });
    chip.append(icon(isVideo ? 'film' : 'xml'), el('span', { class: 'source-chip__name' }));
    tooltip(chip, isVideo ? 'Change video · Examinar' : 'Change XML · Examinar');
    chips[kind] = chip;
  }
  root.append(chips.video, chips.xml);

  return {
    set(state) {
      setChip(chips.video, state.videoName);
      setChip(chips.xml, state.xmlName);
    },
    destroy() {
      chips.video.remove();
      chips.xml.remove();
    },
  };
}

// --- Campos de cabecera (6.7) ---------------------------------------------

// Fecha de hoy en el formato de la cabecera: «MARCH 11, 2026».
function todayHeader() {
  const now = new Date();
  return `${MONTHS[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
}

// `root` es la `section.header-fields` ya existente en index.html.
export function mountHeaderFields(root, o) {
  root.replaceChildren();
  root.setAttribute('aria-labelledby', 'header-fields-title');

  const title = el('h2', { class: 'header-fields__title', id: 'header-fields-title', text: 'HEADER' });
  const row = el('div', { class: 'header-fields__row' });

  const location = createField({
    kind: 'input',
    id: 'header-location',
    label: 'Location',
    placeholder: 'CITY, COUNTRY',
    value: DEFAULT_LOCATION,
    onInput: emit,
  });
  const date = createField({
    kind: 'input',
    id: 'header-date',
    label: 'Date',
    placeholder: 'MARCH 11, 2026',
    value: todayHeader(),
    onInput: emit,
  });
  const source = createField({
    kind: 'input',
    id: 'header-source',
    label: 'Source',
    placeholder: 'e.g. AFPTV',
    onInput: emit,
  });
  source.setHelp('Remembered for next time.');

  row.append(location.root, date.root);
  root.append(title, row, source.root);

  const fields = { location, date, source };

  function currentHeader() {
    return {
      location: location.getValue(),
      date: date.getValue(),
      source: source.getValue(),
    };
  }

  function emit() {
    o.onChange(currentHeader());
  }

  return {
    setHeader(header) {
      for (const key of ['location', 'date', 'source']) fields[key].setValue(header[key] ?? '');
    },
    showErrors(errors) {
      const list = errors || {};
      for (const key of ['location', 'date', 'source']) fields[key].setError(list[key] ?? null);
    },
    focusFirstEmpty() {
      for (const key of ['location', 'date', 'source']) {
        if (fields[key].getValue().trim() === '') {
          fields[key].control.focus();
          return;
        }
      }
    },
    destroy() {
      root.replaceChildren();
      root.removeAttribute('aria-labelledby');
    },
  };
}
