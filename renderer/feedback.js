// Avisos de la aplicación: banner (6.2), toast (6.12) y modal de sobrescritura (6.11).
// Ver docs/DISENO-GRAFICO.md.

import { targetLanguageLabel } from '../core/languages.js';
import { formatShotSeconds } from '../core/timecode.js';
import { el, icon, button, iconButton, setDisabled, tooltip } from './ui-kit.js';

// Duraciones de autocierre del toast y retirada tras la transición de salida.
const TOAST_TIMEOUT_MS = { success: 8000, info: 5000 };
const TOAST_EXIT_MS = 160;

/** «1 soundbite» / «4 soundbites». */
export function soundbiteCount(count) {
  return `${count} soundbite${count === 1 ? '' : 's'}`;
}

// Detalle de los fallos de la cola: los dos primeros, separados por «; », y el resto contado.
function queueFailureDetail(failures) {
  const shown = failures
    .slice(0, 2)
    .map((failure) => `Shot ${failure.number}: ${failure.error?.message ?? ''}`);
  const text = shown.join('; ');
  const more = failures.length - shown.length;
  if (more > 0) return `${text} and ${more} more.`;
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

// --- Textos del banner (6.2) ----------------------------------------------

// Tipo y textos exactos de cada caso. La tabla de 6.2 manda.
export function bannerCopy(kind, args = {}) {
  switch (kind) {
    case 'unsupported-codec':
      return {
        type: 'error',
        title: "This video can't be played.",
        detail:
          "Its codec isn't supported (ProRes, DNxHD and similar). Export an H.264 MP4 and load it again.",
      };
    case 'unreadable-video':
      return {
        type: 'error',
        title: `Couldn't open "${args.file}".`,
        detail: "Check the file still exists and isn't open in another program.",
      };
    case 'invalid-xml':
      return {
        type: 'error',
        title: `"${args.file}" isn't a valid Final Cut / Premiere XML.`,
        detail: 'Export the sequence as Final Cut Pro XML (xmeml v4) and load it again.',
      };
    case 'no-clips':
      return {
        type: 'error',
        title: 'The XML has no clips on video track V1.',
        detail: 'Check you exported the edited sequence, not a bin or a single clip.',
      };
    case 'mismatch':
      return {
        type: 'warning',
        title: "The XML doesn't match the video.",
        detail: `The sequence lasts ${args.xmlTime} but the video lasts ${args.videoTime}. Make sure both come from the same export.`,
      };
    case 'bad-drop':
      return {
        type: 'warning',
        title: `"${args.file}" can't be loaded.`,
        detail: 'Drop a video (.mp4, .mov, .m4v) or an .xml file.',
      };
    case 'save-failed':
      return {
        type: 'error',
        title: `Couldn't save "${args.name}.txt".`,
        detail: `${args.detail} Check you can write to ${args.folder}.`,
      };
    case 'translate-failed':
      return {
        type: 'warning',
        title: "Couldn't translate the text.",
        detail: args.detail || 'Try again in a moment.',
      };
    case 'transcribe-failed':
      return {
        type: 'warning',
        title: `Couldn't transcribe shot ${args.number}.`,
        detail: args.detail || 'Try again in a moment.',
      };
    case 'interview-queue-failed':
    case 'retranscribe-failed': {
      const failures = args.failures ?? [];
      const transcribeFailures = failures.filter((failure) => failure.step === 'transcribe').length;
      const translateFailures = failures.length - transcribeFailures;
      let title;
      if (transcribeFailures > 0 && translateFailures > 0) {
        title = `Couldn't finish ${soundbiteCount(failures.length)}.`;
      } else if (transcribeFailures > 0) {
        title = `Couldn't transcribe ${soundbiteCount(transcribeFailures)}.`;
      } else {
        title = `Couldn't translate ${soundbiteCount(translateFailures)}.`;
      }
      return { type: 'warning', title, detail: queueFailureDetail(failures) };
    }
    default:
      throw new Error(`Unknown banner kind: ${kind}.`);
  }
}

// --- Banner (6.2) ---------------------------------------------------------

// `regionEl` es el contenedor del banner: se vacía y se rellena con uno solo a la vez.
export function createBanner(regionEl) {
  let current = null;

  function clear() {
    regionEl.replaceChildren();
    current = null;
  }

  function build(type, o) {
    const root = el('div', {
      class: `banner banner--${type}`,
      role: type === 'error' ? 'alert' : 'status',
    });

    const iconEl = icon(type === 'error' ? 'error' : 'warning');
    iconEl.classList.add('banner__icon');

    const content = el('div', { class: 'banner__content' });
    content.append(el('p', { class: 'banner__title', text: o.title }));
    if (o.detail) {
      content.append(el('p', { class: 'banner__detail', text: o.detail }));
    }

    const actions = el('div', { class: 'banner__actions' });
    if (o.action) {
      actions.append(button({ variant: 'secondary', label: o.action.label, onClick: o.action.onClick }));
    }
    if (type === 'warning') {
      actions.append(
        iconButton({ icon: 'close', label: 'Dismiss', className: 'banner__close', onClick: clear }),
      );
    }

    root.append(iconEl, content, actions);
    return root;
  }

  return {
    showError(o) {
      clear();
      regionEl.append(build('error', o));
      current = 'error';
    },
    showWarning(o) {
      if (current === 'error') {
        return;
      }
      clear();
      regionEl.append(build('warning', o));
      current = 'warning';
    },
    clear,
    current() {
      return current;
    },
  };
}

// --- Toast (6.12) ---------------------------------------------------------

// `regionEl` es la región `aria-live` donde vive el único toast.
export function createToasts(regionEl) {
  regionEl.setAttribute('aria-live', 'polite');

  let toast = null;
  let timer = null;
  let remaining = 0;
  let startedAt = 0;

  function stopTimer() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function pauseTimer() {
    if (timer === null) return;
    remaining -= Date.now() - startedAt;
    if (remaining < 0) remaining = 0;
    stopTimer();
  }

  function resumeTimer() {
    if (timer !== null || remaining <= 0) return;
    startedAt = Date.now();
    timer = setTimeout(beginExit, remaining);
  }

  function startTimer(ms) {
    remaining = ms;
    startedAt = Date.now();
    timer = setTimeout(beginExit, remaining);
  }

  function removeNow() {
    stopTimer();
    if (toast) {
      toast.remove();
      toast = null;
    }
  }

  function beginExit() {
    const node = toast;
    if (!node) return;
    stopTimer();
    const done = () => {
      node.remove();
      if (toast === node) toast = null;
    };
    node.addEventListener('transitionend', done, { once: true });
    setTimeout(done, TOAST_EXIT_MS);
    node.classList.remove('is-visible');
  }

  function build(o) {
    const root = el('div', { class: `toast toast--${o.kind}`, role: 'status' });

    if (o.kind === 'success') {
      const iconEl = icon('check');
      iconEl.classList.add('toast__icon');
      root.append(iconEl);
    }

    const content = el('div', { class: 'toast__content' });
    content.append(el('p', { class: 'toast__title', text: o.title }));
    if (o.detail) {
      content.append(el('p', { class: 'toast__detail', text: o.detail }));
    }
    root.append(content);

    if (o.action) {
      root.append(
        button({
          variant: 'secondary',
          label: o.action.label,
          icon: o.action.icon,
          className: 'toast__action',
          onClick: o.action.onClick,
        }),
      );
    }

    root.append(
      iconButton({ icon: 'close', label: 'Dismiss', className: 'toast__close', onClick: beginExit }),
    );

    root.addEventListener('pointerenter', pauseTimer);
    root.addEventListener('pointerleave', resumeTimer);
    root.addEventListener('focusin', pauseTimer);
    root.addEventListener('focusout', resumeTimer);

    return root;
  }

  return {
    show(o) {
      removeNow();
      toast = build(o);
      regionEl.append(toast);
      requestAnimationFrame(() => {
        if (toast) toast.classList.add('is-visible');
      });
      startTimer(TOAST_TIMEOUT_MS[o.kind]);
    },
    hide: beginExit,
  };
}

// --- Modales de confirmación (6.11) ---------------------------------------

// Estructura, teclado y foco comunes al modal de sobrescritura y al de traducción.
// `rootEl` recibe el fondo y el diálogo. Resuelve `true` con «Replace» y `false` con
// «Cancel», Esc o clic en el fondo. Al cerrar devuelve el foco y retira el modal.
function openConfirm(rootEl, o) {
  return new Promise((resolve) => {
    const previous = document.activeElement;
    let settled = false;

    const backdrop = el('div', { class: 'modal-backdrop is-open' });
    const modal = el('div', {
      class: 'modal',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-body',
    });

    const title = el('h2', { class: 'modal__title', id: 'modal-title', text: o.title });

    const body = el('p', { class: 'modal__body', id: 'modal-body' }, ...o.body);

    const actions = el('div', { class: 'modal__actions' });

    function close(result) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
      resolve(result);
    }

    function onKeydown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        close(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const focusables = [cancel, replace];
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const cancel = button({
      variant: 'secondary',
      label: o.cancelLabel ?? 'Cancel',
      onClick: () => close(false),
    });
    const replace = button({
      variant: 'primary',
      label: o.confirmLabel ?? 'Replace',
      onClick: () => close(true),
    });

    actions.append(cancel, replace);
    modal.append(title, body, actions);
    backdrop.append(modal);
    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) close(false);
    });
    document.addEventListener('keydown', onKeydown);

    rootEl.append(backdrop);
    cancel.focus();
  });
}

export function confirmOverwrite(rootEl, o) {
  return openConfirm(rootEl, {
    title: 'Replace existing shotlist?',
    body: [
      el('span', { class: 'modal__filename', text: o.fileName }),
      ` already exists in ${o.folder}. Replacing it overwrites its contents.`,
    ],
  });
}

export function confirmReplaceTranslation(rootEl, target = 'en') {
  const language = targetLanguageLabel(target);
  return openConfirm(rootEl, {
    title: 'Replace the current translation?',
    body: [`The ${language} text of this soundbite will be replaced by a new machine translation.`],
  });
}

export function confirmReplaceOriginal(rootEl) {
  return openConfirm(rootEl, {
    title: 'Replace the current original text?',
    body: ['The original text of this soundbite will be replaced by a new transcription.'],
  });
}

// Modal de 16.2: retranscribir en el idioma nuevo. «Not now» no deshace el cambio.
export function confirmRetranscribe(rootEl, { number, languageName }) {
  return openConfirm(rootEl, {
    title: `Transcribe shot ${number} again in ${languageName}?`,
    body: [
      `The original text will be replaced by a new transcription in ${languageName}, and the translation will be updated. This runs in the background; you can keep working.`,
    ],
    cancelLabel: 'Not now',
    confirmLabel: 'Retranscribe',
  });
}

// --- Modal de detección de entrevistas (15.1) -----------------------------

const INTERVIEW_BODY_TRANSCRIBER =
  'These shots at the end of the sequence are long enough to be interviews. Marking them as soundbites also transcribes and translates them in the background.';
const INTERVIEW_BODY_PLAIN =
  'These shots at the end of the sequence are long enough to be interviews. Mark them as soundbites?';

// Recuento del modal: «Shots 27–30 · 4 soundbites», «Shot 30 · 1 soundbite», sin planos.
function interviewCountText(first, last) {
  const count = last - first + 1;
  if (count <= 0) return 'No shots selected';
  if (count === 1) return `Shot ${first} \u00b7 1 soundbite`;
  return `Shots ${first}\u2013${last} \u00b7 ${count} soundbites`;
}

// Devuelve el foco al elemento que lo tenía si sigue en el documento; si no, a la
// tarjeta seleccionada de la tira.
function restoreModalFocus(previous) {
  const body = document.body;
  const stillInDocument =
    previous &&
    previous !== body &&
    (!body || typeof body.contains !== 'function' || body.contains(previous));
  const target = stillInDocument
    ? previous
    : document.querySelector?.('.shot-card[aria-selected="true"]');
  if (target && typeof target.focus === 'function') target.focus();
}

/**
 * Modal de 15.1: propone marcar como entrevistas los planos `first`..último, deja
 * ajustar el primero y resuelve con el número elegido. «Not interviews», Esc o el
 * fondo resuelven null.
 */
export function confirmInterviews(rootEl, o) {
  return new Promise((resolve) => {
    const last = o.shots[o.shots.length - 1].number;
    const previous = document.activeElement;
    let first = o.first;
    let settled = false;

    const backdrop = el('div', { class: 'modal-backdrop is-open' });
    const modal = el('div', {
      class: 'modal interview-detect',
      role: 'alertdialog',
      'aria-modal': 'true',
      'aria-labelledby': 'modal-title',
      'aria-describedby': 'modal-body',
    });

    const title = el('h2', {
      class: 'modal__title',
      id: 'modal-title',
      text: 'Interview cuts detected',
    });
    const body = el('p', {
      class: 'modal__body',
      id: 'modal-body',
      text: o.transcriberAvailable ? INTERVIEW_BODY_TRANSCRIBER : INTERVIEW_BODY_PLAIN,
    });

    const count = el('p', {
      class: 'interview-detect__count',
      'aria-live': 'polite',
      'aria-atomic': 'true',
    });
    const stepper = el('div', {
      class: 'interview-detect__stepper',
      role: 'group',
      'aria-label': 'Adjust interview shots',
    });
    const fewer = button({
      variant: 'secondary',
      label: 'Fewer',
      className: 'interview-detect__fewer',
      onClick: () => adjust(1),
    });
    const more = button({
      variant: 'secondary',
      label: 'More',
      className: 'interview-detect__more',
      onClick: () => adjust(-1),
    });
    stepper.append(fewer, more);

    const range = el('div', { class: 'interview-detect__range' }, count, stepper);
    const list = el('ul', { class: 'interview-detect__list', 'aria-label': 'Shots to mark' });
    const empty = el('p', {
      class: 'interview-detect__empty',
      text: 'Press More to add shots.',
    });

    const actions = el('div', { class: 'modal__actions' });
    const cancel = button({
      variant: 'secondary',
      label: 'Not interviews',
      className: 'interview-detect__cancel',
      onClick: () => close(null),
    });
    const confirm = button({
      variant: 'primary',
      label: 'Mark as interviews',
      className: 'interview-detect__confirm',
      onClick: () => {
        if (first > last) return;
        close(first);
      },
    });
    actions.append(cancel, confirm);

    modal.append(title, body, range, list, empty, actions);
    backdrop.append(modal);

    tooltip(fewer, () => (first > last ? 'No shots left to remove' : `Remove shot ${first}`));
    tooltip(more, () => {
      if (first <= 1) return 'All shots are included';
      const previousShot = o.shots.find((shot) => shot.number === first - 1);
      const duration = previousShot
        ? formatShotSeconds(previousShot.endFrame - previousShot.startFrame, o.fps)
        : '';
      return `Add shot ${first - 1} (${duration})`;
    });
    tooltip(confirm, () => (first > last ? 'Add at least one shot' : ''));

    function shotDuration(number) {
      const shot = o.shots.find((item) => item.number === number);
      if (!shot) return '';
      return formatShotSeconds(shot.endFrame - shot.startFrame, o.fps);
    }

    function render(moved) {
      const visible = last - first + 1;
      count.textContent = interviewCountText(first, last);

      list.textContent = '';
      for (let number = first; number <= last; number += 1) {
        list.append(
          el(
            'li',
            { class: 'interview-detect__item' },
            el('span', { class: 'interview-detect__shot', text: `Shot ${number}` }),
            el('span', {
              class: 'interview-detect__duration',
              text: shotDuration(number),
            }),
          ),
        );
      }
      list.hidden = visible <= 0;
      empty.hidden = visible > 0;

      setDisabled(fewer, visible <= 0);
      setDisabled(more, first <= 1);
      setDisabled(confirm, visible <= 0);

      updateListTabindex();
      if (moved) list.scrollTop = 0;
    }

    // Solo se puede tabular a la lista cuando desborda (para recorrerla con flechas).
    // El desbordamiento real solo se conoce con el modal ya insertado.
    function updateListTabindex() {
      const overflows = list.scrollHeight > list.clientHeight;
      if (overflows) list.setAttribute('tabindex', '0');
      else list.removeAttribute('tabindex');
    }

    function adjust(delta) {
      if (delta > 0 && first > last) return;
      if (delta < 0 && first <= 1) return;
      first += delta;
      render(true);
    }

    // Enfocables en orden de tabulación, calculados en cada Tab (la lista puede entrar o salir).
    function focusables() {
      const items = [fewer, more];
      if (list.getAttribute('tabindex') === '0') items.push(list);
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

    function close(result) {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKeydown);
      backdrop.remove();
      restoreModalFocus(previous);
      resolve(result);
    }

    backdrop.addEventListener('pointerdown', (event) => {
      if (event.target === backdrop) close(null);
    });
    document.addEventListener('keydown', onKeydown);

    // Se pinta antes de insertar: la región aria-live no anuncia el recuento inicial.
    render(false);
    rootEl.append(backdrop);
    // Ya insertado se puede medir de verdad si la lista desborda.
    updateListTabindex();
    confirm.focus();
  });
}
