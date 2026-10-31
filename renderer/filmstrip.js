// Tira horizontal de tarjetas de plano según docs/DISENO-GRAFICO.md 6.6.
// No toca `document` a nivel de módulo: solo dentro de mount.

import { el, icon, spinner, tooltip } from './ui-kit.js';
import { formatShotSeconds } from '../core/timecode.js';
import { isShotComplete, soundbiteIndex } from '../core/shot-model.js';

const THUMB_ERROR_TOOLTIP = "Couldn't read this frame";

// Etiqueta accesible de una tarjeta. `complete` y el índice de soundbite los calcula quien llama.
// `processing` ('transcribing' | 'translating' | null) añade el sufijo de 15.2.3.
export function cardAriaLabel(shot, fps, complete, soundbite, processing = null) {
  const frames = shot.endFrame - shot.startFrame;
  const status = complete ? 'complete' : 'incomplete';
  const suffix = processing ? `, ${processing}` : '';
  if (shot.interview) {
    return `Shot ${shot.number}, soundbite ${soundbite}, ${Math.round(frames / fps)} seconds, ${status}${suffix}`;
  }
  return `Shot ${shot.number}, ${(frames / fps).toFixed(1)} seconds, ${status}${suffix}`;
}

// Índice destino para una tecla de navegación; null si la tecla no navega o no hay planos.
export function nextIndexForKey(key, current, total) {
  if (total <= 0) return null;
  switch (key) {
    case 'ArrowRight':
      return Math.min(current + 1, total - 1);
    case 'ArrowLeft':
      return Math.max(current - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}

export function mount(root, o) {
  const onSelect = o.onSelect;

  root.classList.add('filmstrip');
  root.setAttribute('aria-label', 'Shots');

  const list = el('ol', {
    class: 'filmstrip__list',
    role: 'listbox',
    'aria-orientation': 'horizontal',
    'aria-label': 'Shots',
  });
  root.append(list);
  root.classList.add('is-loading');

  let shots = [];
  let fps = 25;
  let selected = 0;
  let progress = null;
  let progressFill = null;
  let divider = null;
  // Plano en proceso y su tipo (15.2.3): se refleja en el aria-label y en la marca.
  let processing = { number: null, kind: null };
  const cards = new Map();        // number -> referencias de la tarjeta
  const loadedThumbs = new Map(); // number -> dataUrl | null (null = fallo)

  function shotByNumber(number) {
    return shots.find((shot) => shot.number === number) || null;
  }

  function buildDivider() {
    return el('li', { class: 'filmstrip__divider', role: 'none', 'aria-hidden': 'true' });
  }

  function processingKind(number) {
    return processing.number === number ? processing.kind : null;
  }

  function applyStatus(shot, card) {
    const complete = isShotComplete(shot);
    const soundbite = soundbiteIndex(shots, shot.number);
    const kind = processingKind(shot.number);
    card.li.classList.toggle('is-complete', complete);
    card.li.classList.toggle('is-incomplete', !complete);
    card.li.classList.toggle('is-interview', shot.interview);
    card.li.classList.toggle('is-selected', shot.number === selected);
    card.li.classList.toggle('is-processing', Boolean(kind));
    card.li.setAttribute('aria-selected', shot.number === selected ? 'true' : 'false');
    card.li.tabIndex = shot.number === selected ? 0 : -1;
    card.li.setAttribute('aria-label', cardAriaLabel(shot, fps, complete, soundbite, kind));
    card.badge.hidden = !shot.interview;
    card.badge.textContent = shot.interview ? `SB ${soundbite}` : '';
  }

  function buildCard(shot) {
    const li = el('li', { class: 'shot-card is-loading', role: 'option', tabindex: '-1' });
    const image = el('img', { class: 'shot-card__image', alt: '' });
    const errorIcon = icon('image-off');
    errorIcon.hidden = true;
    const badge = el('span', { class: 'shot-card__badge', hidden: true });
    const thumb = el('div', { class: 'shot-card__thumb' }, image, errorIcon, badge);
    const numberEl = el('span', { class: 'shot-card__number', text: String(shot.number) });
    const durationEl = el('span', {
      class: 'shot-card__duration',
      text: formatShotSeconds(shot.endFrame - shot.startFrame, fps),
    });
    const statusEl = el('span', { class: 'shot-card__status', 'aria-hidden': 'true' });
    const spinnerEl = spinner();
    spinnerEl.classList.add('shot-card__spinner');
    const meta = el('div', { class: 'shot-card__meta' }, numberEl, durationEl, statusEl, spinnerEl);
    li.append(thumb, meta);

    const card = { li, image, errorIcon, badge, error: false };
    cards.set(shot.number, card);
    applyStatus(shot, card);

    li.addEventListener('click', () => selectCard(shot.number, true));
    // El tooltip solo tiene contenido cuando la miniatura falló.
    tooltip(thumb, () => (card.error ? THUMB_ERROR_TOOLTIP : ''));
    return li;
  }

  function positionDivider() {
    const firstInterview = shots.findIndex((shot) => shot.interview);
    if (firstInterview === -1) {
      if (divider) divider.remove();
      divider = null;
      return;
    }
    if (!divider) divider = buildDivider();
    list.insertBefore(divider, cards.get(shots[firstInterview].number).li);
  }

  function render() {
    list.textContent = '';
    cards.clear();
    divider = null;
    for (const shot of shots) list.append(buildCard(shot));
    positionDivider();
  }

  function applyThumbnail(number, dataUrl) {
    const card = cards.get(number);
    card.li.classList.remove('is-loading');
    if (dataUrl === null) {
      card.error = true;
      card.image.removeAttribute('src');
      card.image.hidden = true;
      card.errorIcon.hidden = false;
      card.li.classList.add('is-thumb-error');
    } else {
      card.error = false;
      card.image.src = dataUrl;
      card.image.hidden = false;
      card.errorIcon.hidden = true;
      card.li.classList.remove('is-thumb-error');
    }
    loadedThumbs.set(number, dataUrl);
  }

  function markSelection(number) {
    const card = cards.get(number);
    for (const item of cards.values()) {
      const isSelected = item === card;
      item.li.classList.toggle('is-selected', isSelected);
      item.li.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      item.li.tabIndex = isSelected ? 0 : -1;
    }
  }

  // La selección visual no mueve el foco: solo la siguen clic y teclado.
  function selectCard(number, notify) {
    setSelected(number);
    cards.get(number).li.focus();
    if (notify) onSelect(number);
  }

  function onKeyDown(event) {
    const next = nextIndexForKey(event.key, selected, shots.length);
    if (next === null) return;
    event.preventDefault();
    selectCard(shots[next].number, true);
  }
  list.addEventListener('keydown', onKeyDown);

  function setShots(nextShots, nextFps) {
    const preserved = new Map();
    for (const [number, dataUrl] of loadedThumbs) {
      if (dataUrl === null) continue;
      const previous = shotByNumber(number);
      const next = nextShots.find((shot) => shot.number === number);
      if (previous && next && previous.startFrame === next.startFrame && previous.endFrame === next.endFrame) {
        preserved.set(number, dataUrl);
      }
    }
    shots = nextShots;
    fps = nextFps;
    if (shots.length === 0) selected = 0;
    else if (!shotByNumber(selected)) selected = shots[0].number;
    loadedThumbs.clear();
    render();
    for (const [number, dataUrl] of preserved) applyThumbnail(number, dataUrl);
  }

  function setSelected(number) {
    if (!cards.has(number)) throw new RangeError(`Shot ${number} does not exist.`);
    selected = number;
    markSelection(number);
    cards.get(number).li.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  function setThumbnail(number, dataUrl) {
    if (!cards.has(number)) throw new RangeError(`Shot ${number} does not exist.`);
    applyThumbnail(number, dataUrl);
  }

  function setLoadingProgress(loaded, total) {
    if (!progress) {
      progressFill = el('div', { class: 'filmstrip__progress-fill' });
      progress = el('div', {
        class: 'filmstrip__progress',
        role: 'progressbar',
        'aria-label': 'Loading thumbnails',
        'aria-valuemin': '0',
      }, progressFill);
      root.insertBefore(progress, list);
    }
    progress.setAttribute('aria-valuemax', String(total));
    progress.setAttribute('aria-valuenow', String(loaded));
    if (total > 0 && loaded < total) {
      progressFill.style.width = `${Math.round((loaded / total) * 100)}%`;
      root.classList.add('is-loading');
    } else {
      progress.remove();
      progress = null;
      progressFill = null;
      root.classList.remove('is-loading');
    }
  }

  function refreshStatus(nextShots) {
    shots = nextShots;
    for (const shot of shots) {
      const card = cards.get(shot.number);
      if (card) applyStatus(shot, card);
    }
    positionDivider();
  }

  // Marca en la tira el plano en proceso (15.2.3). `null` lo quita.
  function setProcessing(number, kind) {
    processing = { number: number ?? null, kind: kind ?? null };
    for (const shot of shots) {
      const card = cards.get(shot.number);
      if (card) {
        const current = processingKind(shot.number);
        card.li.classList.toggle('is-processing', Boolean(current));
        card.li.setAttribute(
          'aria-label',
          cardAriaLabel(shot, fps, isShotComplete(shot), soundbiteIndex(shots, shot.number), current),
        );
      }
    }
  }

  function destroy() {
    list.removeEventListener('keydown', onKeyDown);
    root.textContent = '';
    root.classList.remove('is-loading');
    cards.clear();
    loadedThumbs.clear();
    progress = null;
    progressFill = null;
    divider = null;
  }

  return { setShots, setSelected, setThumbnail, setLoadingProgress, refreshStatus, setProcessing, destroy };
}
