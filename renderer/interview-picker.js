// Selector gráfico de entrevistas (17): muestra los cortes de la secuencia, deja
// ajustar el límite entre imagen y entrevistas y elegir cuáles se transcriben.
// Ver docs/modulos/interview-picker.md (Parte C) y docs/DISENO-GRAFICO.md 17.

import {
  INTERVIEW_CHART_BOUNDARY_PX,
  INTERVIEW_CHART_SCALE_SECONDS,
  INTERVIEW_CHART_SLOT_MIN_PX,
  INTERVIEW_MIN_SECONDS,
  INTERVIEW_NOTES_MAX,
  INTERVIEW_PREVIEW_SECONDS,
} from '../core/config.js';
import { estimateTranscriptionSeconds, formatEstimate, interviewNotes } from '../core/interview-detect.js';
import { formatShotSeconds } from '../core/timecode.js';
import { restoreModalFocus } from './feedback.js';
import { button, el, icon, setDisabled, tooltip } from './ui-kit.js';

const TRACK_PADDING = 12;
const STATUS_ERROR_MS = 4000;
const PEEK_WIDTH = 174;
const PEEK_HEIGHT = 126;
const PEEK_MARGIN = 8;

const BODY_AUTO_TRANSCRIBER =
  'The cuts right of the line look like interviews. Drag the line to adjust it, and choose which ones to transcribe and translate in the background.';
const BODY_AUTO_PLAIN =
  'The cuts right of the line look like interviews. Drag the line to adjust it, then mark them as soundbites.';
const BODY_MANUAL_TRANSCRIBER =
  'The cuts right of the line are interviews. Drag the line to change them, and choose which ones to transcribe and translate in the background.';
const BODY_MANUAL_PLAIN =
  'The cuts right of the line are interviews. Drag the line to change them.';

// Segundos con un decimal y sufijo, el formato de la tarjeta (6.6).
function formatSeconds(seconds) {
  return `${seconds.toFixed(1)}s`;
}

function shotSeconds(shot, fps) {
  return (shot.endFrame - shot.startFrame) / fps;
}

function isTranscribed(shot) {
  const original = shot.soundbite?.original;
  return typeof original === 'string' && original.trim() !== '';
}

function voicePercent(voice) {
  return `${Math.round(voice * 100)}%`;
}

// Reparte el ancho útil entre las barras (17.5).
function barWidths(durations, available) {
  const count = durations.length;
  if (count === 0) return [];

  const minimum = INTERVIEW_CHART_SLOT_MIN_PX;
  if (count * minimum <= available) {
    const total = durations.reduce((sum, duration) => sum + duration, 0);
    if (total <= 0) return new Array(count).fill(available / count);

    const fixed = new Set();
    let scale = 0;
    for (;;) {
      const free = available - fixed.size * minimum;
      const remaining = durations.reduce(
        (sum, duration, index) => (fixed.has(index) ? sum : sum + duration),
        0,
      );
      scale = remaining > 0 ? free / remaining : 0;
      let added = false;
      durations.forEach((duration, index) => {
        if (!fixed.has(index) && duration * scale < minimum) {
          fixed.add(index);
          added = true;
        }
      });
      if (!added) break;
    }
    return durations.map((duration, index) =>
      fixed.has(index) ? minimum : duration * scale,
    );
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
  const scale = minimum / median;
  return durations.map((duration) => Math.max(minimum, duration * scale));
}

function countText(shots, first, last, hasTranscriber, checkedCount) {
  const selected = shots.filter((shot) => shot.number >= first && shot.number <= last);
  if (selected.length === 0) return 'No interviews';

  const firstNumber = selected[0].number;
  const lastNumber = selected[selected.length - 1].number;
  let text =
    selected.length === 1
      ? `Shot ${firstNumber} \u00b7 1 interview`
      : `Shots ${firstNumber}\u2013${lastNumber} \u00b7 ${selected.length} interviews`;
  if (hasTranscriber) {
    text +=
      checkedCount > 0
        ? ` \u00b7 ${checkedCount} to transcribe`
        : ' \u00b7 none to transcribe';
  }
  return text;
}

function noteText(note) {
  const seconds = formatSeconds(note.seconds);
  if (note.kind === 'long-image') {
    if (note.voice === null) {
      return `Shot ${note.number} is marked as image but is long enough to be an interview (${seconds}).`;
    }
    return `Shot ${note.number} is marked as image but looks like an interview (${seconds}, ${voicePercent(note.voice)} speech).`;
  }
  return `Shot ${note.number} is marked as interview but has little speech (${voicePercent(note.voice)}).`;
}

/**
 * Abre el selector de entrevistas. Resuelve `null` con el secundario, Esc o el fondo;
 * si se confirma, con el límite, las entrevistas a transcribir y su idioma.
 */
export function openInterviewPicker(rootEl, o) {
  return new Promise((resolve) => {
    const shots = o.shots ?? [];
    const fps = o.fps;
    const last = shots.length > 0 ? shots[shots.length - 1].number : 0;
    const maximum = last + 1;
    const hasVoices = Array.isArray(o.voices);
    const voices = hasVoices ? o.voices : null;
    const hasTranscriber = Boolean(o.transcriberAvailable);
    const auto = o.mode !== 'manual';
    const languages = o.languages ?? [];
    const thumbnails = o.thumbnails ?? null;
    const videoUrl = o.videoUrl ?? null;

    const previous = document.activeElement;
    let first = Math.min(Math.max(1, o.first ?? maximum), maximum);
    let settled = false;
    let dragging = false;
    let dragTarget = null;
    let playingNumber = null;
    let peekNumber = null;
    let peekHoverNumber = null;
    let peekFocusNumber = null;
    let unsubscribeThumbnails = null;
    let previewTimer = null;
    let errorTimer = null;
    let barTabIndex = Math.max(0, Math.min(first, shots.length) - 1);

    // Estado de cada fila, conservado mientras el corte siga en el rango.
    const rowsState = new Map();
    const rowControls = new Map();

    const backdrop = el('div', { class: 'modal-backdrop is-open' });
    const modalClass = ['modal', 'interview-picker'];
    if (hasVoices) modalClass.push('has-voices');
    if (!hasTranscriber) modalClass.push('no-transcriber');
    const modal = el('div', {
      class: modalClass.join(' '),
      role: 'dialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-body',
    });

    const bodyText = auto
      ? hasTranscriber
        ? BODY_AUTO_TRANSCRIBER
        : BODY_AUTO_PLAIN
      : hasTranscriber
        ? BODY_MANUAL_TRANSCRIBER
        : BODY_MANUAL_PLAIN;
    const title = el('h2', {
      class: 'modal__title',
      id: 'modal-title',
      text: auto ? 'Interview cuts detected' : 'Interview cuts',
    });
    const body = el('p', {
      class: 'modal__body',
      id: 'modal-body',
      text: videoUrl ? `${bodyText} Click a cut to hear it.` : bodyText,
    });

    // --- Gráfico ----------------------------------------------------------
    const chart = el('div', { class: 'interview-picker__chart' });
    const chartHead = el('div', { class: 'interview-picker__chart-head' });
    const legend = el('ul', { class: 'interview-picker__legend' });
    const legendItems = [
      ['--image', 'Image'],
      ['--interview', 'Interview'],
      ...(hasVoices
        ? [['--silent', 'No speech']]
        : [['is-note', 'No speech data']]),
      ['--threshold', 'Min. interview length'],
    ];
    for (const [kind, text] of legendItems) {
      const itemClass =
        kind === 'is-note'
          ? 'interview-picker__legend-item is-note'
          : `interview-picker__legend-item interview-picker__legend-item${kind}`;
      const item = el('li', { class: itemClass });
      if (kind !== 'is-note') item.append(el('span', { class: 'interview-picker__swatch', 'aria-hidden': 'true' }));
      item.append(el('span', { text }));
      legend.append(item);
    }
    const status = el('p', { class: 'interview-picker__status', 'aria-live': 'polite' });
    chartHead.append(legend, status);

    const plot = el('div', { class: 'interview-picker__plot' });
    const axis = el('div', { class: 'interview-picker__axis', 'aria-hidden': 'true' });
    const axisCap = el('span', {
      class: 'interview-picker__axis-label interview-picker__axis-label--cap',
      text: '30s+',
    });
    const thresholdLabel = formatShotSeconds(INTERVIEW_MIN_SECONDS * fps, fps);
    const axisThreshold = el('span', {
      class: 'interview-picker__axis-label interview-picker__axis-label--threshold',
      text: thresholdLabel,
    });
    axisThreshold.style.bottom = `calc(${(
      (INTERVIEW_MIN_SECONDS / INTERVIEW_CHART_SCALE_SECONDS) *
      100
    ).toFixed(1)}% - 8px)`;
    axis.append(axisCap, axisThreshold);

    const scroller = el('div', { class: 'interview-picker__scroller' });
    const track = el('div', { class: 'interview-picker__track' });

    const handle = el('div', {
      class: 'interview-picker__handle',
      role: 'slider',
      tabindex: '0',
      'aria-label': 'Interview boundary',
      'aria-orientation': 'horizontal',
      'aria-valuemin': '1',
      'aria-valuemax': String(maximum),
    });
    handle.append(el('span', { class: 'interview-picker__grip' }));

    const bars = el('div', {
      class: 'interview-picker__bars',
      role: 'toolbar',
      'aria-label': 'Cuts',
      'aria-orientation': 'horizontal',
    });
    const threshold = el('div', { class: 'interview-picker__threshold', 'aria-hidden': 'true' });
    threshold.style.bottom = `${(
      (INTERVIEW_MIN_SECONDS / INTERVIEW_CHART_SCALE_SECONDS) *
      100
    ).toFixed(1)}%`;
    bars.append(threshold);

    const barEntries = [];
    for (const shot of shots) {
      const duration = shotSeconds(shot, fps);
      const fill = el('span', { class: 'interview-picker__fill' });
      const bar = el('button', { type: 'button', class: 'interview-picker__bar', tabindex: '-1' }, fill);
      if (hasVoices) {
        const index = shots.indexOf(shot);
        const voice = voices[index];
        if (voice !== null && voice !== undefined) {
          const speech = el('span', { class: 'interview-picker__speech' });
          speech.style.height = `${voice * 100}%`;
          fill.append(speech);
        }
      }
      const height = Math.min(duration, INTERVIEW_CHART_SCALE_SECONDS) / INTERVIEW_CHART_SCALE_SECONDS;
      fill.style.height = `${height * 100}%`;
      if (duration >= INTERVIEW_CHART_SCALE_SECONDS) bar.classList.add('is-capped');
      if (videoUrl) bar.setAttribute('aria-pressed', 'false');

      bar.addEventListener('click', () => togglePreview(shot));
      bar.addEventListener('keydown', (event) => onBarKeydown(event, shot));
      bar.addEventListener('pointerenter', () => {
        peekHoverNumber = shot.number;
        refreshPeek();
      });
      bar.addEventListener('focus', () => {
        setBarTabIndex(barEntries.indexOf(bar));
        peekFocusNumber = shot.number;
        refreshPeek();
      });
      bar.addEventListener('pointerleave', () => {
        if (peekHoverNumber === shot.number) peekHoverNumber = null;
        refreshPeek();
      });
      bar.addEventListener('blur', () => {
        if (peekFocusNumber === shot.number) peekFocusNumber = null;
        refreshPeek();
      });

      bars.append(bar);
      barEntries.push({ bar, shot, duration });
    }

    const rail = el('div', { class: 'interview-picker__rail', 'aria-hidden': 'true' });
    track.append(handle, bars, rail);
    scroller.append(track);
    plot.append(axis, scroller);
    chart.append(chartHead, plot);

    const peek = el('div', { class: 'interview-picker__peek', 'aria-hidden': 'true' });
    const peekThumb = el('div', { class: 'interview-picker__peek-thumb' });
    const peekImage = el('img', { class: 'interview-picker__peek-image', alt: '' });
    const peekMissing = icon('image-off');
    peekMissing.classList.add('icon--image-off');
    peekThumb.append(peekImage, peekMissing);
    const peekLabel = el('p', { class: 'interview-picker__peek-label' });
    peek.append(peekThumb, peekLabel);

    // --- Avisos, recuento, filas y pie ------------------------------------
    const notes = el('ul', { class: 'interview-picker__notes' });
    notes.hidden = true;

    const rowsHead = el('div', { class: 'interview-picker__rows-head' });
    const count = el('p', {
      class: 'interview-picker__count',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    const bulk = el('div', {
      class: 'interview-picker__bulk',
      role: 'group',
      'aria-labelledby': 'interview-picker-bulk-label',
    });
    const bulkLabel = el('span', {
      class: 'interview-picker__bulk-label',
      id: 'interview-picker-bulk-label',
      text: 'Transcribe',
    });
    const allButton = button({ variant: 'ghost', label: 'All', className: 'interview-picker__all' });
    allButton.setAttribute('aria-label', 'Transcribe all');
    const noneButton = button({ variant: 'ghost', label: 'None', className: 'interview-picker__none' });
    noneButton.setAttribute('aria-label', 'Transcribe none');
    bulk.append(bulkLabel, allButton, noneButton);
    rowsHead.append(count, bulk);

    const rows = el('ul', { class: 'interview-picker__rows', 'aria-label': 'Interviews' });
    const empty = el('p', {
      class: 'interview-picker__empty',
      text: 'No interviews. Drag the line left to add cuts.',
    });

    const actions = el('div', { class: 'modal__actions' });
    const estimate = el('p', { class: 'interview-picker__estimate' });
    const cancel = button({
      variant: 'secondary',
      label: auto ? 'Not interviews' : 'Cancel',
      className: 'interview-picker__cancel',
      onClick: () => close(null),
    });
    const confirm = button({
      variant: 'primary',
      label: 'Mark as interviews',
      className: 'interview-picker__confirm',
      onClick: () => {
        if (auto && interviews().length === 0) return;
        close(result());
      },
    });
    tooltip(confirm, () =>
      auto && interviews().length === 0 ? 'Move the line left to include at least one cut' : '',
    );
    actions.append(estimate, cancel, confirm);

    const audio = el('video', {
      class: 'interview-picker__audio',
      hidden: true,
      'aria-hidden': 'true',
      preload: 'metadata',
    });
    if (videoUrl) audio.src = videoUrl;
    audio.addEventListener('ended', stopPreview);
    audio.addEventListener('timeupdate', () => {
      if (playingNumber === null) return;
      const entry = barEntries.find((item) => item.shot.number === playingNumber);
      if (!entry) return;
      const limit =
        entry.shot.startFrame / fps + Math.min(INTERVIEW_PREVIEW_SECONDS, entry.duration);
      if (audio.currentTime >= limit) stopPreview();
    });

    modal.append(title, body, chart, peek, notes, rowsHead, rows, empty, actions, audio);
    backdrop.append(modal);

    // --- Estado de las filas ---------------------------------------------

    function interviews() {
      return shots.filter((shot) => shot.number >= first);
    }

    function stateFor(shot) {
      if (!rowsState.has(shot.number)) {
        rowsState.set(shot.number, {
          checked: !isTranscribed(shot),
          language: null,
        });
      }
      return rowsState.get(shot.number);
    }

    function checkedNumbers() {
      return interviews()
        .filter((shot) => stateFor(shot).checked)
        .map((shot) => shot.number)
        .sort((a, b) => a - b);
    }

    function result() {
      if (!hasTranscriber) return { first, transcribe: [], languages: {} };
      const transcribe = checkedNumbers();
      const languagesResult = {};
      for (const number of transcribe) {
        const shot = shots.find((item) => item.number === number);
        languagesResult[number] = stateFor(shot).language;
      }
      return { first, transcribe, languages: languagesResult };
    }

    function applyBulk(value) {
      for (const shot of interviews()) {
        if (isTranscribed(shot)) continue;
        stateFor(shot).checked = value;
        const control = rowControls.get(shot.number);
        if (control?.input) control.input.checked = value;
        if (control?.select) control.select.disabled = !value;
      }
      refreshSummary();
    }

    function updateBulk(list) {
      if (!hasTranscriber) {
        bulk.hidden = true;
        return;
      }
      const enabled = list.filter((shot) => !isTranscribed(shot));
      bulk.hidden = enabled.length === 0;
      if (bulk.hidden) return;
      const checked = enabled.filter((shot) => stateFor(shot).checked).length;
      setDisabled(allButton, checked === enabled.length);
      setDisabled(noneButton, checked === 0);
    }

    function refreshSummary() {
      const list = interviews();
      count.textContent = countText(
        shots,
        first,
        last,
        hasTranscriber,
        checkedNumbers().length,
      );
      updateBulk(list);
      renderEstimate();
    }

    allButton.addEventListener('click', () => {
      if (allButton.classList.contains('is-disabled')) return;
      applyBulk(true);
    });
    noneButton.addEventListener('click', () => {
      if (noneButton.classList.contains('is-disabled')) return;
      applyBulk(false);
    });

    // --- Render -----------------------------------------------------------

    function renderBars() {
      barEntries.forEach((entry, index) => {
        const { bar, shot } = entry;
        const interview = shot.number >= first;
        bar.classList.toggle('is-interview', interview);
        bar.classList.toggle('is-boundary', interview && shot.number === first);
        bar.classList.toggle(
          'is-boundary-end',
          !interview && index === barEntries.length - 1,
        );
        bar.classList.toggle('is-playing', playingNumber === shot.number);
        bar.setAttribute('tabindex', String(index === barTabIndex ? 0 : -1));

        const parts = [`Shot ${shot.number}`, `${entry.duration.toFixed(1)} seconds`];
        if (hasVoices) {
          const voice = voices[index];
          if (voice !== null && voice !== undefined) {
            parts.push(`${voicePercent(voice)} speech`);
          }
        }
        parts.push(interview ? 'interview' : 'image');
        bar.setAttribute('aria-label', parts.join(', '));
        if (videoUrl) {
          bar.setAttribute('aria-pressed', String(playingNumber === shot.number));
          bar.style.cursor = '';
        } else {
          bar.removeAttribute('aria-pressed');
          bar.style.cursor = 'default';
        }
        bar.style.marginLeft = '';
        bar.style.marginRight = '';
        if (interview && shot.number === first) {
          bar.style.marginLeft = `${INTERVIEW_CHART_BOUNDARY_PX}px`;
        } else if (!interview && index === barEntries.length - 1) {
          bar.style.marginRight = `${INTERVIEW_CHART_BOUNDARY_PX}px`;
        }
      });
      updateHandle();
    }

    function boundaryPosition() {
      const before = barEntries
        .slice(0, Math.max(0, first - 1))
        .reduce((sum, entry) => sum + entry.width, 0);
      return TRACK_PADDING + before + INTERVIEW_CHART_BOUNDARY_PX / 2;
    }

    function updateHandle() {
      handle.style.left = `${boundaryPosition()}px`;
      handle.setAttribute('aria-valuemax', String(maximum));
      handle.setAttribute('aria-valuenow', String(first));
      handle.setAttribute(
        'aria-valuetext',
        first <= last ? `From shot ${shots[first - 1].number}` : 'No interviews',
      );
      if (document.activeElement === handle) {
        handle.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
      }
    }

    function renderRows() {
      const list = interviews();
      rows.replaceChildren();
      rowControls.clear();
      for (const shot of list) {
        const transcribed = isTranscribed(shot);
        const state = stateFor(shot);
        const row = el('li', { class: 'interview-picker__row' });
        if (transcribed) row.classList.add('is-transcribed');

        const pick = el('label', { class: 'interview-picker__pick' });
        let input = null;
        let select = null;
        if (hasTranscriber) {
          const box = el('span', { class: 'checkbox' });
          if (transcribed) box.classList.add('is-disabled');
          input = el('input', {
            type: 'checkbox',
            class: 'checkbox__input',
            'aria-label': `Transcribe shot ${shot.number}`,
          });
          input.checked = transcribed ? false : state.checked;
          input.disabled = transcribed;
          input.dataset.number = String(shot.number);
          input.addEventListener('change', () => {
            state.checked = input.checked;
            if (select) select.disabled = !state.checked;
            refreshSummary();
          });
          box.append(
            input,
            el('span', { class: 'checkbox__box', 'aria-hidden': 'true' }, icon('check')),
          );
          pick.append(box);
        }
        pick.append(
          el('span', { class: 'interview-picker__shot', text: `Shot ${shot.number}` }),
        );
        row.append(pick);

        row.append(
          el('span', {
            class: 'interview-picker__length',
            text: formatShotSeconds(shot.endFrame - shot.startFrame, fps),
          }),
        );

        if (hasVoices) {
          const index = shots.indexOf(shot);
          const voice = voices[index];
          row.append(
            el('span', {
              class: 'interview-picker__voice',
              text:
                voice === null || voice === undefined
                  ? ''
                  : `${voicePercent(voice)} speech`,
            }),
          );
        }

        if (hasTranscriber) {
          if (transcribed) {
            row.append(
              el(
                'p',
                { class: 'interview-picker__done' },
                icon('check'),
                el('span', { text: 'Transcribed' }),
              ),
            );
          } else {
            select = el('select', {
              class: 'field__select',
              'aria-label': `Language of shot ${shot.number}`,
            });
            select.append(el('option', { value: '', text: 'Auto' }));
            for (const language of languages) {
              select.append(el('option', { value: language.code, text: language.name }));
            }
            select.value = state.language ?? '';
            select.disabled = !state.checked;
            select.dataset.number = String(shot.number);
            select.addEventListener('change', () => {
              state.language = select.value || null;
            });
            const wrap = el(
              'div',
              { class: 'field__select-wrap interview-picker__language' },
              select,
            );
            const chevron = icon('chevron-down');
            chevron.classList.add('field__chevron');
            wrap.append(chevron);
            row.append(wrap);
          }
        }

        row.addEventListener('keydown', (event) => {
          const tag = String(event.target?.tagName ?? event.target?.tag ?? '').toLowerCase();
          if (event.key !== ' ' || tag === 'select' || tag === 'input' || tag === 'textarea') {
            return;
          }
          if (!hasTranscriber || transcribed) return;
          event.preventDefault();
          state.checked = !state.checked;
          if (input) input.checked = state.checked;
          if (select) select.disabled = !state.checked;
          refreshSummary();
        });
        row.addEventListener('pointerenter', () => linkBar(shot.number, true));
        row.addEventListener('pointerleave', () => linkBar(shot.number, false));
        row.addEventListener('focusin', () => linkBar(shot.number, true));
        row.addEventListener('focusout', () => linkBar(shot.number, false));

        rows.append(row);
        if (hasTranscriber && !transcribed) {
          rowControls.set(shot.number, { input, select });
        }
      }

      rows.hidden = list.length === 0;
      empty.hidden = list.length > 0;
    }

    function linkBar(number, linked) {
      const entry = barEntries.find((item) => item.shot.number === number);
      if (entry) entry.bar.classList.toggle('is-linked', linked);
    }

    function renderNotes() {
      const list = interviewNotes(
        shots,
        fps,
        first,
        voices,
        INTERVIEW_MIN_SECONDS,
      );
      notes.replaceChildren();
      for (const note of list.slice(0, INTERVIEW_NOTES_MAX)) {
        notes.append(
          el(
            'li',
            { class: 'interview-picker__note' },
            icon('warning'),
            el('span', { text: noteText(note) }),
          ),
        );
      }
      if (list.length > INTERVIEW_NOTES_MAX) {
        notes.append(
          el('li', {
            class: 'interview-picker__note interview-picker__note--more',
            text: `and ${list.length - INTERVIEW_NOTES_MAX} more`,
          }),
        );
      }
      notes.hidden = list.length === 0;
    }

    function renderEstimate() {
      if (!hasTranscriber) {
        estimate.hidden = true;
        return;
      }
      const durations = checkedNumbers().map((number) => {
        const shot = shots.find((item) => item.number === number);
        return shotSeconds(shot, fps);
      });
      const text = formatEstimate(estimateTranscriptionSeconds(durations));
      if (text === '') {
        estimate.hidden = true;
        estimate.textContent = '';
        return;
      }
      estimate.hidden = false;
      estimate.textContent = `${text.charAt(0).toUpperCase()}${text.slice(1)} to transcribe`;
    }

    function render() {
      const active = document.activeElement;
      const activeNumber = active?.dataset?.number;
      const activeTag = String(active?.tagName ?? active?.tag ?? '').toLowerCase();
      const list = interviews();

      renderBars();
      renderRows();
      if (activeNumber) {
        const control = rowControls.get(Number(activeNumber));
        if (control) {
          const target = activeTag === 'select' ? control.select : control.input;
          if (target && !target.disabled) target.focus();
        } else {
          handle.focus();
        }
      }
      renderNotes();
      refreshSummary();

      const canConfirm = !auto || list.length > 0;
      setDisabled(confirm, !canConfirm);
      const hasCurrentInterviews = shots.some((shot) => shot.interview);
      confirm.querySelector('.button__label').textContent =
        !auto && list.length === 0 && hasCurrentInterviews
          ? 'Clear interviews'
          : 'Mark as interviews';
    }

    function setFirst(value) {
      const next = Math.min(Math.max(1, value), maximum);
      if (next === first) return;
      first = next;
      barTabIndex = Math.min(barTabIndex, Math.max(0, barEntries.length - 1));
      render();
    }

    // --- Tarjeta flotante ------------------------------------------------

    function applyThumb(url) {
      peekThumb.classList.remove('is-loading', 'is-thumb-error');
      if (typeof url === 'string') {
        peekImage.hidden = false;
        peekImage.src = url;
        peekMissing.hidden = true;
        return;
      }
      peekImage.hidden = true;
      peekImage.removeAttribute('src');
      if (url === undefined) {
        peekThumb.classList.add('is-loading');
        peekMissing.hidden = true;
      } else {
        peekThumb.classList.add('is-thumb-error');
        peekMissing.hidden = false;
      }
    }

    function renderPeek() {
      if (peekNumber === null) return;
      const shot = shots.find((item) => item.number === peekNumber);
      if (!shot) return;
      const entry = barEntries.find((item) => item.shot.number === peekNumber);
      peekLabel.replaceChildren(
        el('span', { class: 'interview-picker__peek-shot', text: `Shot ${shot.number}` }),
        el('span', {
          class: 'interview-picker__peek-detail',
          text: ` \u00b7 ${formatShotSeconds(shot.endFrame - shot.startFrame, fps)}`,
        }),
      );
      if (hasVoices) {
        const index = shots.indexOf(shot);
        const voice = voices[index];
        if (voice !== null && voice !== undefined) {
          peekLabel.append(
            el('span', {
              class: 'interview-picker__peek-detail',
              text: ` \u00b7 ${voicePercent(voice)} speech`,
            }),
          );
        }
      }
      applyThumb(thumbnails?.get?.(peekNumber));

      const modalRect = modal.getBoundingClientRect?.();
      const barRect = entry?.bar.getBoundingClientRect?.();
      if (modalRect && barRect && modalRect.width > 0) {
        // La etiqueta puede ensanchar la tarjeta: se coloca con su ancho real.
        const width = peek.offsetWidth || PEEK_WIDTH;
        const maxLeft = Math.max(PEEK_MARGIN, modalRect.width - PEEK_MARGIN - width);
        const centered = barRect.left - modalRect.left + barRect.width / 2 - width / 2;
        peek.style.left = `${Math.min(Math.max(PEEK_MARGIN, centered), maxLeft)}px`;
        peek.style.top = `${Math.max(PEEK_MARGIN, barRect.top - modalRect.top - PEEK_HEIGHT - PEEK_MARGIN)}px`;
      }
    }

    function showPeek(shot) {
      if (dragging) return;
      peekNumber = shot.number;
      peek.classList.add('is-visible');
      renderPeek();
    }

    function refreshPeek() {
      if (dragging) {
        hidePeek();
        return;
      }
      const number = peekFocusNumber ?? peekHoverNumber;
      if (number === null) {
        hidePeek();
        return;
      }
      const shot = shots.find((item) => item.number === number);
      if (!shot) {
        hidePeek();
        return;
      }
      showPeek(shot);
    }

    function hidePeek() {
      peekNumber = null;
      peek.classList.remove('is-visible');
    }

    // --- Escucha previa --------------------------------------------------

    function setStatus(kind, text, duration) {
      status.className = 'interview-picker__status';
      status.replaceChildren();
      if (kind === 'idle') return;
      status.classList.add(kind === 'error' ? 'is-error' : 'is-playing');
      const iconEl = icon(kind === 'error' ? 'warning' : 'volume');
      status.append(iconEl, el('span', { class: 'interview-picker__status-text', text }));
      if (kind !== 'error') {
        const progress = el('span', { class: 'interview-picker__status-progress' });
        const fill = el('span', { class: 'interview-picker__status-fill' });
        fill.style.animationDuration = `${duration}s`;
        progress.append(fill);
        status.append(progress);
      }
    }

    function stopPreview() {
      if (previewTimer !== null) {
        clearTimeout(previewTimer);
        previewTimer = null;
      }
      if (playingNumber === null) return;
      playingNumber = null;
      audio.pause();
      setStatus('idle');
      renderBars();
    }

    function previewFailure(number) {
      if (settled || playingNumber !== number) return;
      stopPreview();
      setStatus('error', "Can't play this cut.");
      if (errorTimer !== null) clearTimeout(errorTimer);
      errorTimer = setTimeout(() => {
        errorTimer = null;
        setStatus('idle');
      }, STATUS_ERROR_MS);
    }

    function togglePreview(shot) {
      if (!videoUrl) return;
      if (playingNumber === shot.number) {
        stopPreview();
        return;
      }
      stopPreview();
      if (errorTimer !== null) {
        clearTimeout(errorTimer);
        errorTimer = null;
      }
      o.onPreviewStart?.();
      const number = shot.number;
      playingNumber = number;
      audio.currentTime = shot.startFrame / fps;
      const duration = Math.min(INTERVIEW_PREVIEW_SECONDS, shotSeconds(shot, fps));
      setStatus('playing', `Playing shot ${number}`, duration);
      renderBars();
      const onFailure = (error) => previewFailure(number, error);
      try {
        const playback = audio.play();
        if (playback && typeof playback.catch === 'function') {
          playback.catch(onFailure);
        }
      } catch (error) {
        onFailure(error);
      }
      previewTimer = setTimeout(stopPreview, duration * 1000 + 60);
    }

    // --- Arrastre del límite ---------------------------------------------

    function setBarTabIndex(index) {
      if (index < 0) return;
      barTabIndex = index;
      barEntries.forEach((entry, item) => {
        entry.bar.setAttribute('tabindex', String(item === index ? 0 : -1));
      });
    }

    function boundaryAt(clientX) {
      const rect = track.getBoundingClientRect?.();
      const left = rect ? rect.left : 0;
      const position = clientX - left - TRACK_PADDING;
      let best = 1;
      let bestDistance = Infinity;
      let accumulated = 0;
      for (let index = 0; index <= barEntries.length; index += 1) {
        const distance = Math.abs(position - accumulated);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index + 1;
        }
        if (index < barEntries.length) accumulated += barEntries[index].width;
      }
      return best;
    }

    function moveBoundaryTo(clientX) {
      setFirst(boundaryAt(clientX));
    }

    function onPointerMove(event) {
      moveBoundaryTo(event.clientX);
      const rect = scroller.getBoundingClientRect?.();
      if (rect) {
        if (event.clientX < rect.left + 24) scroller.scrollLeft -= 8;
        else if (event.clientX > rect.right - 24) scroller.scrollLeft += 8;
      }
    }

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      modal.classList.remove('is-dragging');
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
      dragTarget?.removeEventListener?.('lostpointercapture', endDrag);
      dragTarget = null;
      render();
    }

    function beginDrag(event, jump) {
      if (event.button !== undefined && event.button !== 0) return;
      dragging = true;
      dragTarget = event.target ?? null;
      modal.classList.add('is-dragging');
      hidePeek();
      event.target?.setPointerCapture?.(event.pointerId);
      dragTarget?.addEventListener?.('lostpointercapture', endDrag);
      if (jump) moveBoundaryTo(event.clientX);
      document.addEventListener('pointermove', onPointerMove);
      document.addEventListener('pointerup', endDrag);
      document.addEventListener('pointercancel', endDrag);
    }

    function onHandleKeydown(event) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setFirst(first - 1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setFirst(first + 1);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setFirst(1);
      } else if (event.key === 'End') {
        event.preventDefault();
        setFirst(maximum);
      }
    }

    function onBarKeydown(event, shot) {
      const index = barEntries.findIndex((entry) => entry.shot.number === shot.number);
      let target = null;
      if (event.key === 'ArrowLeft') target = Math.max(0, index - 1);
      else if (event.key === 'ArrowRight') target = Math.min(barEntries.length - 1, index + 1);
      else if (event.key === 'Home') target = 0;
      else if (event.key === 'End') target = barEntries.length - 1;
      else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        togglePreview(shot);
        return;
      }
      if (target === null) return;
      event.preventDefault();
      const entry = barEntries[target];
      setBarTabIndex(target);
      entry.bar.focus();
      entry.bar.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
      peekFocusNumber = entry.shot.number;
      refreshPeek();
    }

    // --- Foco y cierre ---------------------------------------------------

    function focusables() {
      const items = [handle];
      const tabBar = barEntries.find((entry) => entry.bar.getAttribute('tabindex') === '0');
      if (tabBar) items.push(tabBar.bar);
      if (hasTranscriber && !bulk.hidden) items.push(allButton, noneButton);
      if (!hasTranscriber && rows.getAttribute('tabindex') === '0') items.push(rows);
      for (const shot of interviews()) {
        if (!hasTranscriber || isTranscribed(shot)) continue;
        const control = rowControls.get(shot.number);
        if (control?.input && !control.input.disabled) items.push(control.input);
        if (control?.select && !control.select.disabled) items.push(control.select);
      }
      items.push(cancel, confirm);
      return items;
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusables();
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    }

    function close(value) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', endDrag);
      document.removeEventListener('pointercancel', endDrag);
      dragTarget?.removeEventListener?.('lostpointercapture', endDrag);
      dragTarget = null;
      if (previewTimer !== null) clearTimeout(previewTimer);
      if (errorTimer !== null) clearTimeout(errorTimer);
      if (typeof unsubscribeThumbnails === 'function') unsubscribeThumbnails();
      playingNumber = null;
      audio.pause();
      audio.removeAttribute('src');
      audio.load?.();
      backdrop.remove();
      restoreModalFocus(previous);
      resolve(value);
    }

    handle.addEventListener('keydown', onHandleKeydown);
    handle.addEventListener('pointerdown', (event) => beginDrag(event, false));
    rail.addEventListener('pointerdown', (event) => beginDrag(event, true));
    tooltip(handle, 'Interviews start here. Drag it or use \u2190 \u2192');
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) close(null);
    });
    document.addEventListener('keydown', onKeydown);

    // Texto inicial antes de insertar: la región aria-live no lo anuncia.
    count.textContent = countText(shots, first, last, hasTranscriber, checkedNumbers().length);

    rootEl.append(backdrop);

    // Con el modal insertado ya se mide el ancho útil del gráfico.
    const available = Math.max(
      0,
      (bars.clientWidth || 0) - INTERVIEW_CHART_BOUNDARY_PX,
    );
    const widths = barWidths(
      barEntries.map((entry) => entry.duration),
      available,
    );
    barEntries.forEach((entry, index) => {
      entry.width = widths[index] ?? 0;
      entry.bar.style.width = `${entry.width}px`;
    });

    render();
    if (!hasTranscriber) {
      rows.setAttribute('tabindex', '0');
      if (!(rows.scrollHeight > rows.clientHeight)) rows.removeAttribute('tabindex');
    }

    if (thumbnails?.subscribe) {
      unsubscribeThumbnails = thumbnails.subscribe((number, url) => {
        if (peekNumber === number) applyThumb(url);
      });
    }

    // Deja el tirador a la vista con 48 px de margen si hay desplazamiento.
    const handleLeft = boundaryPosition();
    if (handleLeft < scroller.scrollLeft + 48) {
      scroller.scrollLeft = Math.max(0, handleLeft - 48);
    } else if (handleLeft > scroller.scrollLeft + (scroller.clientWidth || 0) - 48) {
      scroller.scrollLeft = handleLeft - (scroller.clientWidth || 0) + 48;
    }

    confirm.focus();
  });
}
