// Editor del plano seleccionado: tipo, movimiento, descripción, entrevista y sus datos.
// Módulo de interfaz: crea DOM solo dentro de mount(); al importarlo no toca document.

import { SHOT_SIZES, MOVEMENTS } from '../core/config.js';
import { LANGUAGE_NAMES, translationTarget, targetLanguageLabel } from '../core/languages.js';
import { shotMissing, soundbiteIndex } from '../core/shot-model.js';
import {
  framesToSeconds,
  formatTimecode,
  formatShotSeconds,
  formatSoundbiteSeconds,
} from '../core/timecode.js';
import {
  el,
  button,
  createField,
  createSwitch,
  createSegmented,
  setDisabled,
  setLoading,
  tooltip,
  normalizeAge,
} from './ui-kit.js';

const ORIGINAL_PLACEHOLDER = 'What they say, in the original language';
const TRANSCRIBE_READY_TEXT = 'Transcribe this cut from the video (runs on this computer)';

// Etiquetas legibles de cada campo que puede faltar en un plano.
const MISSING_LABELS = {
  size: 'shot size',
  description: 'description',
  name: 'name',
  gender: 'gender',
  language: 'language',
};

// Mensaje de error de cada campo obligatorio.
const FIELD_ERRORS = {
  size: 'Choose a shot size.',
  description: 'Write a description.',
  name: "Enter the speaker's name.",
  gender: 'Choose man or woman.',
  language: 'Enter the language.',
};

const INVALID_AGE_MESSAGE = 'Age must be digits only, e.g. 34.';

// Orden del datalist de Language (16.1): inglés primero y el resto como LANGUAGE_NAMES.
const LANGUAGE_ORDER = ['en', ...Object.keys(LANGUAGE_NAMES).filter((code) => code !== 'en')];

// Primer campo del grupo que recibe el foco: el de arriba del grupo visible.
const GROUP_FIRST_KEY = { image: 'size', soundbite: 'name' };

function findShot(shots, number) {
  const shot = shots.find((item) => item.number === number);
  if (!shot) throw new RangeError(`Shot ${number} does not exist.`);
  return shot;
}

function firstInterviewNumber(shots) {
  let first = null;
  for (const shot of shots) {
    if (shot.interview && (first === null || shot.number < first)) first = shot.number;
  }
  return first;
}

/**
 * Ayuda del conmutador de entrevista con las cifras reales del plano actual.
 * Apagado: marca number..último; encendido: desmarca primera entrevista..number.
 */
export function interviewHelp(shots, number) {
  const shot = findShot(shots, number);
  if (shot.interview) {
    const first = firstInterviewNumber(shots);
    if (first === number) return 'Turning this off unmarks this shot.';
    return `Turning this off unmarks shots ${first}–${number}.`;
  }
  const last = shots.length > 0 ? shots[shots.length - 1].number : number;
  return `Turning this on marks shots ${number}–${last} as soundbites.`;
}

/** Tooltip del botón «Copy from previous» según el plano actual. */
export function copyTooltip(shots, number) {
  const shot = findShot(shots, number);
  if (shot.number === 1) return 'No previous shot';
  if (!canCopyFromPrevious(shots, number)) {
    return shot.interview
      ? 'The previous shot is not an interview'
      : 'The previous shot is an interview';
  }
  if (shot.interview) return `Copy speaker details from shot ${number - 1}`;
  return `Copy shot size, movement and description from shot ${number - 1}`;
}

/** El botón «Copy from previous» solo actúa si el anterior es del mismo tipo. */
function canCopyFromPrevious(shots, number) {
  const index = shots.findIndex((shot) => shot.number === number);
  if (index <= 0) return false;
  return shots[index].interview === shots[index - 1].interview;
}

/** «Missing: …» con las etiquetas legibles, o '' si el plano está completo. */
export function missingText(shot) {
  const missing = shotMissing(shot);
  if (missing.length === 0) return '';
  return `Missing: ${missing.map((key) => MISSING_LABELS[key]).join(', ')}`;
}

/**
 * Mensajes de error por campo: los obligatorios vacíos y, siempre, la edad inválida
 * (el modelo no guarda edades inválidas; el texto se queda en el campo sin emitir patch).
 */
export function fieldErrors(shot) {
  const errors = {};
  for (const key of shotMissing(shot)) errors[key] = FIELD_ERRORS[key];
  if (!normalizeAge(shot.soundbite.age).valid) errors.age = INVALID_AGE_MESSAGE;
  return errors;
}

/**
 * Tooltip del botón Translate (13.3.1). `busy` tiene prioridad: si el plano se está
 * traduciendo, el botón anuncia la carga aunque el original esté vacío.
 */
export function translateTooltip(shot, busy, transcribing = false) {
  if (busy) return 'Translating…';
  if (transcribing) return 'Wait for the transcription to finish';
  const original = shot.soundbite?.original;
  if (String(original ?? '').trim() === '') return 'Write the original text first';
  return `Translate Original into ${targetLanguageLabel(translationTarget(shot.soundbite.language))} (online service)`;
}

/** Marcador de Translation según el destino de la traducción (14.4). */
function translationPlaceholder(language) {
  return `${targetLanguageLabel(translationTarget(language))} translation of what they say`;
}

/**
 * Tooltip del botón Transcribe (14.1 y 15.2.4), en orden de prioridad: cargando,
 * herramienta no instalada, sin vídeo, en espera de la cola, otro plano en curso y listo.
 */
export function transcribeTooltip(shot, { busy, available, hasVideo, otherBusy, queued }) {
  if (busy) return 'Transcribing…';
  if (!available) return 'Transcription is not installed';
  if (!hasVideo) return 'Load the video first';
  if (queued) return 'Queued for transcription';
  if (otherBusy) return 'Another cut is being transcribed';
  return TRANSCRIBE_READY_TEXT;
}

/**
 * Monta el editor en root y devuelve su API de render/foco/destrucción.
 * @param {HTMLElement} root
 * @param {{ onPatch:Function, onInterview:Function, onCopyPrevious:Function,
 *           onNextPending:Function, onTranslate:Function,
 *           onTranscribe:Function, onLanguageCommit:Function }} o
 */
export function mount(root, o) {
  // Estado actual, compartido por los manejadores de eventos.
  const state = {
    shots: [],
    number: 0,
    fps: 25,
    nextPending: null,
    shot: null,
    translating: null,
    transcribing: null,
    queued: new Set(),
    transcriberAvailable: false,
    videoLoaded: true,
    copyDisabled: true,
    nextDisabled: true,
    syncedAge: null,
  };

  // Cabecera.
  const title = el('h2', { class: 'shot-editor__title', id: 'shot-editor-title' });
  const soundbiteLabel = el('span', { class: 'shot-editor__soundbite' });
  const heading = el('div', { class: 'shot-editor__heading' }, title, soundbiteLabel);
  const timing = el('p', { class: 'shot-editor__timing' });
  const missingLine = el('p', { class: 'shot-editor__missing' });
  const header = el('header', { class: 'shot-editor__header' }, heading, timing, missingLine);

  // Conmutador de entrevista.
  const interviewSwitch = createSwitch({
    id: 'shot-editor-interview',
    label: 'Interview (soundbite)',
    onChange: (checked) => o.onInterview(state.number, checked),
  });
  const interviewHelpText = el('p', { class: 'field__help' });
  const interviewField = el(
    'div',
    { class: 'field field--switch shot-editor__interview' },
    interviewSwitch.root,
    interviewHelpText,
  );

  // Grupo de imagen.
  const sizeField = createField({
    kind: 'select',
    id: 'shot-editor-size',
    label: 'Shot size',
    required: true,
    options: [
      { value: '', label: 'Select shot size' },
      ...SHOT_SIZES.map((value) => ({ value, label: value })),
    ],
    onInput: (value) => o.onPatch(state.number, { size: value }),
  });
  const movementField = createField({
    kind: 'select',
    id: 'shot-editor-movement',
    label: 'Camera movement',
    optional: true,
    options: [
      { value: '', label: 'None' },
      ...MOVEMENTS.map((value) => ({ value, label: value })),
    ],
    onInput: (value) => o.onPatch(state.number, { movement: value }),
  });
  const descriptionField = createField({
    kind: 'textarea',
    id: 'shot-editor-description',
    label: 'Description',
    required: true,
    placeholder: 'Describe what the shot shows',
    onInput: (value) => o.onPatch(state.number, { description: value }),
  });
  const imageGroup = el(
    'fieldset',
    { class: 'shot-editor__image' },
    el('legend', { class: 'visually-hidden', text: 'Image' }),
    sizeField.root,
    movementField.root,
    descriptionField.root,
  );

  // Grupo de entrevista.
  const nameField = createField({
    kind: 'input',
    id: 'shot-editor-name',
    label: 'Name',
    required: true,
    placeholder: 'Full name',
    onInput: (value) => o.onPatch(state.number, { soundbite: { name: value } }),
  });
  const professionField = createField({
    kind: 'input',
    id: 'shot-editor-profession',
    label: 'Profession',
    optional: true,
    placeholder: 'e.g. Farmer',
    onInput: (value) => o.onPatch(state.number, { soundbite: { profession: value } }),
  });
  const ageField = createField({
    kind: 'input',
    id: 'shot-editor-age',
    label: 'Age',
    optional: true,
    placeholder: '34',
    inputMode: 'numeric',
    maxLength: 3,
    onInput: (value) => {
      if (!normalizeAge(value).valid) {
        ageField.setError(INVALID_AGE_MESSAGE);
        return;
      }
      ageField.setError(null);
      o.onPatch(state.number, { soundbite: { age: value } });
    },
  });
  // Valor de Language al enfocar: el `change` compara contra él.
  let languageAtFocus = null;
  const languageField = createField({
    kind: 'input',
    id: 'shot-editor-language',
    label: 'Language',
    required: true,
    placeholder: 'e.g. Spanish',
    onInput: (value) => o.onPatch(state.number, { soundbite: { language: value } }),
  });
  languageField.control.setAttribute('list', 'shot-editor-language-list');
  languageField.root.appendChild(
    el(
      'datalist',
      { id: 'shot-editor-language-list' },
      ...LANGUAGE_ORDER.map((code) => el('option', { value: LANGUAGE_NAMES[code] })),
    ),
  );
  languageField.control.addEventListener('focus', () => {
    languageAtFocus = languageField.control.value;
  });
  languageField.control.addEventListener('change', () => {
    if (languageAtFocus === null) return;
    const value = languageField.control.value;
    if (value !== languageAtFocus) o.onLanguageCommit?.(state.number, languageAtFocus, value);
  });
  const genderField = createSegmented({
    id: 'shot-editor-gender',
    label: 'Gender',
    options: ['man', 'woman'],
    onChange: (value) => o.onPatch(state.number, { soundbite: { gender: value } }),
  });
  const speakerRow = el(
    'div',
    { class: 'shot-editor__speaker' },
    nameField.root,
    professionField.root,
    ageField.root,
    languageField.root,
    genderField.root,
  );
  const translationField = createField({
    kind: 'textarea',
    id: 'shot-editor-translation',
    label: 'Translation',
    minHeight: 'quote',
    placeholder: translationPlaceholder(''),
    onInput: (value) => o.onPatch(state.number, { soundbite: { translation: value } }),
  });
  const originalField = createField({
    kind: 'textarea',
    id: 'shot-editor-original',
    label: 'Original',
    minHeight: 'quote',
    spellcheck: false,
    placeholder: ORIGINAL_PLACEHOLDER,
    onInput: (value) => o.onPatch(state.number, { soundbite: { original: value } }),
  });
  translationField.root.classList.add('shot-editor__translation');
  originalField.root.classList.add('shot-editor__original');

  // Botón «Translate» en la fila de la etiqueta de Translation (13.3.1). Siempre en el
  // DOM; el grupo de soundbite lo oculta en los planos de imagen.
  const translateButton = button({
    variant: 'secondary',
    label: 'Translate',
    icon: 'translate',
    className: 'translate-button',
    onClick: () => {
      if (!translateReady()) return;
      o.onTranslate(state.number);
    },
  });
  // Nombre accesible fijo: al cargar, el contenido del botón es solo el spinner.
  translateButton.setAttribute('aria-label', 'Translate');
  translationField.root.querySelector('.field__label-row').appendChild(translateButton);

  // Botón «Transcribe» en la fila de la etiqueta de Original (14.1).
  const transcribeButton = button({
    variant: 'secondary',
    label: 'Transcribe',
    icon: 'transcribe',
    className: 'transcribe-button',
    onClick: () => {
      if (!transcribeReady()) return;
      o.onTranscribe(state.number);
    },
  });
  transcribeButton.setAttribute('aria-label', 'Transcribe');
  originalField.root.querySelector('.field__label-row').appendChild(transcribeButton);

  const quotesRow = el(
    'div',
    { class: 'shot-editor__quotes' },
    translationField.root,
    originalField.root,
  );
  const soundbiteGroup = el(
    'fieldset',
    { class: 'shot-editor__soundbite-fields' },
    el('legend', { class: 'visually-hidden', text: 'Soundbite' }),
    speakerRow,
    quotesRow,
  );

  const body = el('div', { class: 'shot-editor__body' }, interviewField, imageGroup, soundbiteGroup);

  // Pie de acciones.
  const copyButton = button({
    variant: 'secondary',
    label: 'Copy from previous',
    icon: 'copy',
    className: 'shot-editor__copy',
    onClick: () => {
      if (state.copyDisabled) return;
      o.onCopyPrevious(state.number);
    },
  });
  const nextButton = button({
    variant: 'primary',
    label: 'Next pending',
    icon: 'next-pending',
    kbd: 'Ctrl+Enter',
    className: 'shot-editor__next',
    onClick: () => {
      if (state.nextDisabled) return;
      o.onNextPending();
    },
  });
  const actions = el(
    'footer',
    { class: 'shot-editor__actions' },
    copyButton,
    nextButton,
  );

  const form = el(
    'form',
    {
      class: 'shot-editor',
      novalidate: true,
      'aria-labelledby': 'shot-editor-title',
    },
    header,
    body,
    actions,
  );

  tooltip(copyButton, () => {
    if (!state.shot) return '';
    return copyTooltip(state.shots, state.number);
  });
  tooltip(nextButton, () => {
    if (state.nextPending === null) return 'All shots are complete';
    return `Go to shot ${state.nextPending} · Ctrl+Enter`;
  });
  tooltip(translateButton, () => {
    if (!state.shot) return '';
    return translateTooltip(state.shot, isTranslating(), isTranscribing());
  });

  tooltip(transcribeButton, () => {
    if (!state.shot) return '';
    return transcribeTooltip(state.shot, transcribeStatus());
  });

  // Controladores por clave de campo, para sincronizar valores, errores y foco.
  const fields = {
    size: { controller: sizeField, group: 'image' },
    movement: { controller: movementField, group: 'image' },
    description: { controller: descriptionField, group: 'image' },
    name: { controller: nameField, group: 'soundbite' },
    profession: { controller: professionField, group: 'soundbite' },
    age: { controller: ageField, group: 'soundbite' },
    language: { controller: languageField, group: 'soundbite' },
    gender: { controller: genderField, group: 'soundbite' },
    translation: { controller: translationField, group: 'soundbite' },
    original: { controller: originalField, group: 'soundbite' },
  };

  function controlElement(controller) {
    if (controller.control) return controller.control;
    return controller.root ? controller.root.querySelector('input') : null;
  }

  function syncValue(controller, value) {
    if (controller.getValue() !== value) controller.setValue(value);
  }

  // El plano mostrado es el que se está traduciendo.
  function isTranslating() {
    return state.translating !== null && state.translating === state.number;
  }

  // El botón solo actúa con el original con texto y sin traducción ni transcripción en curso.
  function translateReady() {
    if (!state.shot || isTranslating() || isTranscribing()) return false;
    return String(state.shot.soundbite.original ?? '').trim() !== '';
  }

  // El plano mostrado es el que se está transcribiendo.
  function isTranscribing() {
    return state.transcribing !== null && state.transcribing === state.number;
  }

  function transcribeStatus() {
    return {
      busy: isTranscribing(),
      available: state.transcriberAvailable,
      hasVideo: state.videoLoaded,
      otherBusy: state.transcribing !== null && state.transcribing !== state.number,
      queued: state.queued.has(state.number),
    };
  }

  function transcribeReady() {
    const status = transcribeStatus();
    return status.available && status.hasVideo && !status.busy && !status.otherBusy && !status.queued;
  }

  // Refleja el estado de traducción del plano mostrado en el botón y en el textarea.
  function applyTranslating() {
    const busy = isTranslating();
    setLoading(translateButton, busy);
    setDisabled(translateButton, !translateReady());
    translationField.control.readOnly = busy;
    if (busy) {
      translationField.control.setAttribute('aria-busy', 'true');
      if (translationField.control.value === '') {
        translationField.control.placeholder = 'Translating…';
      }
    } else {
      translationField.control.removeAttribute('aria-busy');
      translationField.control.placeholder = translationPlaceholder(state.shot?.soundbite.language ?? '');
    }
  }

  // Refleja el estado de transcripción del plano mostrado en el botón y en Original.
  function applyTranscribing() {
    const busy = isTranscribing();
    setLoading(transcribeButton, busy);
    setDisabled(transcribeButton, !busy && !transcribeReady());
    originalField.control.readOnly = busy;
    if (busy) {
      originalField.control.setAttribute('aria-busy', 'true');
      if (originalField.control.value === '') originalField.control.placeholder = 'Transcribing…';
    } else {
      originalField.control.removeAttribute('aria-busy');
      originalField.control.placeholder = ORIGINAL_PLACEHOLDER;
    }
    applyTranslating();
  }

  function setTranscribing(number) {
    state.transcribing = number;
    applyTranscribing();
  }

  // Planos en espera de la cola automática (15.2.4): Transcribe desactivado con su tooltip.
  function setQueued(numbers) {
    state.queued = new Set(numbers);
    applyTranscribing();
  }

  function setVideoLoaded(loaded) {
    state.videoLoaded = Boolean(loaded);
    applyTranscribing();
  }

  function setTranscriberAvailable(available) {
    state.transcriberAvailable = Boolean(available);
    applyTranscribing();
  }

  // Realce breve de Language tras cambiarlo la transcripción (14.3).
  function flashLanguage() {
    const control = languageField.control;
    control.classList.add('is-autofilled');
    control.addEventListener('animationend', clearLanguageFlash, { once: true });
  }

  function clearLanguageFlash() {
    languageField.control.classList.remove('is-autofilled');
  }

  function setTranslating(number) {
    state.translating = number;
    applyTranslating();
  }

  function focusedKey() {
    if (!document.activeElement) return null;
    if (document.activeElement === interviewSwitch.input) return 'interview';
    for (const [key, entry] of Object.entries(fields)) {
      const control = controlElement(entry.controller);
      if (control && (control === document.activeElement || control.contains(document.activeElement))) {
        return key;
      }
    }
    return null;
  }

  function focusGroupStart(group) {
    const key = GROUP_FIRST_KEY[group];
    if (!key) return;
    const control = controlElement(fields[key].controller);
    if (control) control.focus();
  }

  function render(next) {
    const shot = findShot(next.shots, next.number);
    const sameShot = state.shot !== null && state.number === next.number;
    if (!sameShot) clearLanguageFlash();
    const previouslyFocused = focusedKey();

    state.shots = next.shots;
    state.number = next.number;
    state.fps = next.fps;
    state.nextPending = next.nextPending;
    state.shot = shot;

    // Grupos visibles y clases de estado.
    form.classList.toggle('is-interview', shot.interview);
    form.classList.toggle('is-incomplete', shotMissing(shot).length > 0);
    imageGroup.hidden = shot.interview;
    soundbiteGroup.hidden = !shot.interview;

    // Cabecera.
    title.textContent = `Shot ${shot.number}`;
    soundbiteLabel.hidden = !shot.interview;
    if (shot.interview) {
      const frames = shot.endFrame - shot.startFrame;
      soundbiteLabel.textContent =
        `SOUNDBITE ${soundbiteIndex(state.shots, shot.number)} · ${formatSoundbiteSeconds(frames, state.fps)}`;
    }
    const startSeconds = framesToSeconds(shot.startFrame, state.fps);
    const endSeconds = framesToSeconds(shot.endFrame, state.fps);
    timing.textContent =
      `${formatTimecode(startSeconds, state.fps)} – ${formatTimecode(endSeconds, state.fps)} · ${formatShotSeconds(shot.endFrame - shot.startFrame, state.fps)}`;
    const missing = missingText(shot);
    missingLine.hidden = missing === '';
    missingLine.textContent = missing;

    // Conmutador y su ayuda.
    interviewSwitch.setChecked(shot.interview);
    interviewHelpText.textContent = interviewHelp(state.shots, shot.number);

    // Valores (solo cuando difieren, para no perder el cursor).
    syncValue(sizeField, shot.size);
    syncValue(movementField, shot.movement);
    syncValue(descriptionField, shot.description);
    syncValue(nameField, shot.soundbite.name);
    syncValue(professionField, shot.soundbite.profession);
    syncValue(languageField, shot.soundbite.language);
    syncValue(translationField, shot.soundbite.translation);
    syncValue(originalField, shot.soundbite.original);

    // La edad inválida se conserva en el campo mientras siga siendo el mismo plano;
    // si el modelo cambió la edad (p. ej. tras copiar), el campo se sobrescribe.
    const currentAge = ageField.getValue();
    const ageChanged = state.syncedAge !== null && shot.soundbite.age !== state.syncedAge;
    if (!sameShot || ageChanged || normalizeAge(currentAge).valid) {
      syncValue(ageField, shot.soundbite.age);
    }
    state.syncedAge = shot.soundbite.age;

    if (genderField.getValue() !== shot.soundbite.gender) {
      genderField.setValue(shot.soundbite.gender);
    }

    // Errores: los obligatorios solo con showErrors; la edad inválida siempre.
    const errors = fieldErrors(shot);
    for (const [key, entry] of Object.entries(fields)) {
      const message = errors[key] && (key === 'age' || next.showErrors) ? errors[key] : null;
      entry.controller.setError(message);
    }

    // Botones del pie (deshabilitados pero enfocables).
    state.copyDisabled = !canCopyFromPrevious(state.shots, shot.number);
    setDisabled(copyButton, state.copyDisabled);
    state.nextDisabled = state.nextPending === null;
    setDisabled(nextButton, state.nextDisabled);

    // El estado de traducción y de transcripción pertenece al plano: al cambiar de plano se restablece.
    applyTranscribing();

    // Foco: si el campo enfocado ya no pertenece al grupo visible, va al primero de ese grupo.
    const visibleGroup = shot.interview ? 'soundbite' : 'image';
    const stillVisible =
      previouslyFocused === null ||
      previouslyFocused === 'interview' ||
      fields[previouslyFocused].group === visibleGroup;
    if (previouslyFocused !== null && !stillVisible) focusGroupStart(visibleGroup);
  }

  function focusFirstMissing() {
    if (!state.shot) return;
    for (const key of shotMissing(state.shot)) {
      const control = controlElement(fields[key].controller);
      if (control) {
        control.focus();
        return;
      }
    }
  }

  function destroy() {
    form.remove();
  }

  root.appendChild(form);
  applyTranscribing();
  return {
    render,
    focusFirstMissing,
    setTranslating,
    setTranscribing,
    setQueued,
    setTranscriberAvailable,
    setVideoLoaded,
    flashLanguage,
    destroy,
  };
}
