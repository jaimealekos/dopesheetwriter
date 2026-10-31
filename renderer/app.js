// Punto de entrada del renderer: monta todos los módulos en index.html, guarda el
// estado, cablea los flujos y resuelve los atajos de teclado.

import { formatDate, buildShotlist } from '../core/shotlist-format.js';
import {
  updateShot,
  setInterview,
  copyFromPrevious,
  nextPending,
  progress,
  isShotComplete,
  pendingTranslations,
} from '../core/shot-model.js';
import { AUTOSAVE_DELAY_MS, DEFAULT_LOCATION } from '../core/config.js';
import {
  createBanner,
  createToasts,
  confirmReplaceTranslation,
  confirmReplaceOriginal,
  confirmInterviews,
  confirmRetranscribe,
} from './feedback.js';
import { mount as mountPlayer, shotLabel } from './player.js';
import { mount as mountFilmstrip } from './filmstrip.js';
import { mount as mountEditor } from './shot-editor.js';
import { headerErrors, mountHome, mountChips, mountHeaderFields } from './setup-panel.js';
import {
  mountProgress,
  mountPreviewToggle,
  mountTranslateAll,
  mountPreview,
  missingSummary,
} from './output-panel.js';
import { createState, buildDraft, textName } from './state.js';
import { createLoadFlow } from './flow-load.js';
import { createGenerateFlow } from './flow-generate.js';
import { createPreviewFlow } from './flow-preview.js';
import { createTranslateFlow } from './flow-translate.js';
import { createTranscribeFlow } from './flow-transcribe.js';
import { createAutoInterviewsFlow } from './flow-auto-interviews.js';
import { createRetranscribeFlow } from './flow-retranscribe.js';
import { createQueueSlots } from './queue-slots.js';

const dsw = window.dsw;

const dom = {
  app: document.getElementById('app'),
  home: document.getElementById('home'),
  workspace: document.getElementById('workspace'),
  homeZones: document.getElementById('home-zones'),
  homeStatus: document.getElementById('home-status'),
  topbarSources: document.getElementById('topbar-sources'),
  topbarActions: document.getElementById('topbar-actions'),
  queueStatus: document.getElementById('queue-status'),
  queueStatusLabel: document.getElementById('queue-status-label'),
  queueStatusShort: document.getElementById('queue-status-short'),
  bannerRegion: document.getElementById('banner-region'),
  playerRoot: document.getElementById('player-root'),
  filmstripRoot: document.getElementById('filmstrip-root'),
  headerFieldsRoot: document.getElementById('header-fields-root'),
  editorRoot: document.getElementById('editor-root'),
  previewPane: document.getElementById('preview-pane'),
  dropOverlay: document.getElementById('drop-overlay'),
  toastRegion: document.getElementById('toast-region'),
  modalRoot: document.getElementById('modal-root'),
  srStatus: document.getElementById('sr-status'),
};

const state = createState();
const banner = createBanner(dom.bannerRegion);
const toasts = createToasts(dom.toastRegion);

let settings;
try {
  settings = await dsw.loadSettings();
} catch (error) {
  console.warn(`Could not load the settings: ${error.message}`);
  settings = { location: DEFAULT_LOCATION, source: '' };
}
state.header = {
  location: settings.location,
  date: formatDate(new Date()),
  source: settings.source,
};

// --- Montaje de los módulos -----------------------------------------------

const homePanel = mountHome(dom.homeZones, {
  onBrowse: (kind) => loader.pick(kind),
  onDropFiles: (kind, file) => loader.onDropFiles(kind, file),
});

const headerFields = mountHeaderFields(dom.headerFieldsRoot, { onChange: onHeaderChange });
headerFields.setHeader(state.header);

const player = mountPlayer(dom.playerRoot, {
  onShotChange: onPlayerShotChange,
  onError: onPlayerError,
});

const filmstrip = mountFilmstrip(dom.filmstripRoot, { onSelect: onFilmstripSelect });

const editor = mountEditor(dom.editorRoot, {
  onPatch: (number, patch) => {
    state.shots = updateShot(state.shots, number, patch);
    commit();
  },
  onInterview: (number, value) => {
    state.shots = setInterview(state.shots, number, value);
    syncPlayerShots();
    commit();
  },
  onCopyPrevious: (number) => {
    state.shots = copyFromPrevious(state.shots, number);
    commit();
  },
  onNextPending: () => goNextPending(),
  onTranslate: (number) => translateFlow.onTranslate(number),
  onTranscribe: (number) => transcribeFlow.onTranscribe(number),
  onLanguageCommit: (number, previous, value) =>
    retranscribeFlow.onLanguageCommit(number, previous, value),
});

const queueSlots = createQueueSlots({
  setStatus: setQueueStatus,
  setProcessing: (number, kind) => filmstrip.setProcessing(number, kind),
  setQueued: (numbers) => editor.setQueued(numbers),
});

const chips = mountChips(dom.topbarSources, { onChange: (kind) => loader.pick(kind) });

const progressPanel = mountProgress(dom.topbarActions, { onGenerate: () => generateFlow.generate() });
dom.topbarActions.hidden = true;

const previewToggle = mountPreviewToggle(progressPanel.buttonsEl, {
  onToggle: (open) => previewFlow.setPreviewOpen(open),
});

const translateAllButton = mountTranslateAll(progressPanel.buttonsEl, {
  onClick: () => translateFlow.translateAll(),
});

const previewPanel = mountPreview(dom.previewPane, {
  onClose: () => previewFlow.setPreviewOpen(false),
  onSelect: (number) => onFilmstripSelect(number),
});

// --- Flujos ---------------------------------------------------------------

const previewFlow = createPreviewFlow({
  dsw,
  appEl: dom.app,
  previewPanel,
  toggle: previewToggle,
  refreshPreview,
  isAvailable: () => !dom.workspace.hidden,
  hasFocusInside: () => dom.previewPane.contains(document.activeElement),
  focusToggle: () => dom.topbarActions.querySelector('.preview-toggle')?.focus(),
});

const translateFlow = createTranslateFlow({
  state,
  dsw,
  banner,
  bannerRegion: dom.bannerRegion,
  editor,
  announce,
  commit,
  toasts,
  refreshAll,
  isTranscribing: (number) => transcribeFlow.isTranscribing(number),
  confirmReplace: (target) => confirmReplaceTranslation(dom.modalRoot, target),
});

const transcribeFlow = createTranscribeFlow({
  state,
  dsw,
  banner,
  bannerRegion: dom.bannerRegion,
  editor,
  announce,
  commit,
  refreshAll,
  confirmReplace: () => confirmReplaceOriginal(dom.modalRoot),
});

// La herramienta de transcripción se consulta una sola vez, al arrancar.
let transcriberReady = false;
dsw
  .transcriberStatus()
  .then((status) => {
    transcriberReady = Boolean(status.available);
    transcribeFlow.setAvailability(status);
  })
  .catch((error) => {
    console.warn(`Could not check the transcriber: ${error.message}`);
    transcribeFlow.setAvailability({ available: false, missing: [] });
  });

const autoInterviewsFlow = createAutoInterviewsFlow({
  state,
  banner,
  bannerRegion: dom.bannerRegion,
  toasts,
  announce,
  commit,
  refreshAll,
  confirmInterviews: (options) => confirmInterviews(dom.modalRoot, options),
  transcribeShot: (number, options) => transcribeFlow.transcribeShot(number, options),
  translateShot: (number, options) => translateFlow.translateShot(number, options),
  transcriberAvailable: () => transcriberReady,
  setProgress: (text) => queueSlots.setProgress('interviews', text),
  setProcessing: (number, kind) => queueSlots.setProcessing('interviews', number, kind),
  setQueued: (numbers) => queueSlots.setQueued('interviews', numbers),
});

const retranscribeFlow = createRetranscribeFlow({
  state,
  banner,
  bannerRegion: dom.bannerRegion,
  toasts,
  announce,
  refreshAll,
  confirmRetranscribe: (options) => confirmRetranscribe(dom.modalRoot, options),
  transcribeShot: (number, options) => transcribeFlow.transcribeShot(number, options),
  translateShot: (number, options) => translateFlow.translateShot(number, options),
  transcriberAvailable: () => transcriberReady,
  setProgress: (text) => queueSlots.setProgress('retranscribe', text),
  setProcessing: (number, kind) => queueSlots.setProcessing('retranscribe', number, kind),
  setQueued: (numbers) => queueSlots.setQueued('retranscribe', numbers),
});

const loader = createLoadFlow({
  state,
  dsw,
  banner,
  home: homePanel,
  player,
  filmstrip,
  toasts,
  headerFields,
  enterWorkspace,
  leaveWorkspace,
  refreshAll,
  announce,
  announceShot,
  isWorkspaceVisible: () => !dom.workspace.hidden,
  dropOverlay: dom.dropOverlay,
  homeStatus: dom.homeStatus,
  onWorkspaceReady: (options) => autoInterviewsFlow.onWorkspaceReady(options),
});

const generateFlow = createGenerateFlow({
  state,
  dsw,
  banner,
  toasts,
  progressPanel,
  modalRoot: dom.modalRoot,
  editor,
  player,
  headerFields,
  refreshAll,
  fps: fpsOf,
  buildDraft: () => buildDraft(state),
  autosaveDelay: AUTOSAVE_DELAY_MS,
});

loader.attachDropTargets();
document.addEventListener('keydown', onGlobalKeydown);

// --- Estado derivado ------------------------------------------------------

function fpsOf() {
  return state.xml.parsed ? state.xml.parsed.fps : 0;
}

function totalFramesOf() {
  return state.xml.parsed ? state.xml.parsed.totalFrames : 0;
}

// Refresca todos los paneles con el estado actual (sin tocar el borrador).
function refreshAll() {
  if (!state.xml.parsed || state.shots.length === 0) return;
  const fps = fpsOf();
  const done = progress(state.shots);

  // El editor refleja si el plano mostrado tiene una traducción en curso.
  translateFlow.refreshTranslating();
  transcribeFlow.refreshTranscribing();
  editor.setVideoLoaded(state.video.loaded);

  filmstrip.refreshStatus(state.shots);
  filmstrip.setSelected(state.selected);

  editor.render({
    shots: state.shots,
    number: state.selected,
    fps,
    nextPending: nextPending(state.shots, state.selected),
    showErrors: state.showErrors,
  });

  headerFields.showErrors(state.showErrors ? headerErrors(state.header) : {});

  progressPanel.update({
    done: done.done,
    total: done.total,
    missingLines: missingSummary({ headerErrors: headerErrors(state.header), shots: state.shots }),
    fileName: textName(state.video.name),
  });

  translateAllButton.update({
    pending: pendingTranslations(state.shots).length,
    busy: translateFlow.isTranslatingAll(),
    waiting: autoInterviewsFlow.isRunning() || retranscribeFlow.isRunning(),
  });
  translateAllButton.setVisible(state.shots.some((shot) => shot.interview));

  if (previewFlow.isOpen()) refreshPreview();
}

// La vista previa solo se recalcula con la columna abierta (y al abrirla).
function refreshPreview() {
  if (!state.xml.parsed || state.shots.length === 0) return;
  previewPanel.update({
    text: buildShotlist({ header: state.header, shots: state.shots, fps: fpsOf() }, { strict: false }),
    shots: state.shots,
    currentNumber: state.selected,
    fileName: textName(state.video.name),
  });
}

// Refresca y programa el autoguardado: solo tras un cambio de datos.
function commit() {
  refreshAll();
  generateFlow.scheduleAutosave();
}

function syncPlayerShots() {
  player.setShots(state.shots, fpsOf(), totalFramesOf());
}

// --- Selección de plano ---------------------------------------------------

let suppressPlayerChange = false;

function onPlayerShotChange(number) {
  if (suppressPlayerChange) return;
  state.selected = number;
  announceShot(number);
  refreshAll();
}

function onFilmstripSelect(number) {
  suppressPlayerChange = true;
  state.selected = number;
  player.selectShot(number);
  suppressPlayerChange = false;
  announceShot(number);
  refreshAll();
}

function goNextPending() {
  const number = nextPending(state.shots, state.selected);
  if (number === null) return;
  suppressPlayerChange = true;
  state.selected = number;
  player.selectShot(number);
  suppressPlayerChange = false;
  announceShot(number);
  refreshAll();
  editor.focusFirstMissing();
}

function onPlayerError(error) {
  loader.showVideoError(error);
}

// --- Cabecera -------------------------------------------------------------

function onHeaderChange(header) {
  const remembered = header.location !== state.header.location || header.source !== state.header.source;
  state.header = { ...header };
  if (remembered) {
    dsw.saveSettings({ location: header.location, source: header.source }).catch((error) => {
      console.warn(`Could not save the settings: ${error.message}`);
    });
  }
  if (state.xml.parsed) commit();
}

// --- Espacio de trabajo y anuncios ----------------------------------------

function enterWorkspace() {
  const wasHidden = dom.workspace.hidden;
  dom.home.hidden = true;
  dom.workspace.hidden = false;
  dom.topbarSources.hidden = false;
  dom.topbarActions.hidden = false;
  chips.set({ videoName: state.video.name, xmlName: state.xml.name });
  if (wasHidden) {
    // Al desaparecer la pantalla de inicio, el foco no debe perderse.
    const target =
      dom.playerRoot.querySelector('.player__timeline') ||
      dom.editorRoot.querySelector('input, select, textarea, button');
    if (target && typeof target.focus === 'function') target.focus();
  }
}

function leaveWorkspace() {
  dom.home.hidden = false;
  dom.workspace.hidden = true;
  dom.topbarSources.hidden = true;
  dom.topbarActions.hidden = true;
  dom.homeStatus.hidden = true;
  // La columna Preview se cierra al salir; un fallo al cerrarla no bloquea la salida.
  previewFlow.setPreviewOpen(false).catch((error) => {
    console.warn(`Could not close the preview column: ${error.message}`);
  });
}

function announce(text) {
  dom.srStatus.textContent = text;
}

// Pinta el indicador de la cola en la barra superior (15.2.2). `null` lo oculta.
function setQueueStatus(text) {
  if (text === null) {
    dom.queueStatus.hidden = true;
    return;
  }
  dom.queueStatus.hidden = false;
  dom.queueStatusLabel.textContent = text;
  // Banda compacta: «2/4…» en vez del texto largo.
  const match = /(\d+) of (\d+)/.exec(text);
  dom.queueStatusShort.textContent = match ? `${match[1]}/${match[2]}\u2026` : '';
}

function announceShot(number) {
  const shot = state.shots.find((item) => item.number === number);
  if (!shot) return;
  announce(`${shotLabel(state.shots, number)}, ${isShotComplete(shot) ? 'complete' : 'incomplete'}`);
}

// --- Atajos de teclado ----------------------------------------------------

function onGlobalKeydown(event) {
  if (event.defaultPrevented) return;
  const mod = event.ctrlKey || event.metaKey;
  // Con un modal abierto, Generate y la navegación de planos no deben dispararse.
  const modalOpen = dom.modalRoot.children.length > 0;

  if (mod && event.code === 'Space') {
    event.preventDefault();
    player.togglePlay();
    return;
  }
  if (mod && event.key.toLowerCase() === 's') {
    if (modalOpen) return;
    event.preventDefault();
    generateFlow.generate();
    return;
  }
  if (mod && event.key === 'Enter') {
    if (modalOpen) return;
    event.preventDefault();
    goNextPending();
    return;
  }
  if (event.altKey && event.key === 'ArrowDown') {
    if (modalOpen) return;
    event.preventDefault();
    player.stepShot(1);
    return;
  }
  if (event.altKey && event.key === 'ArrowUp') {
    if (modalOpen) return;
    event.preventDefault();
    player.stepShot(-1);
    return;
  }
  if (event.altKey && event.code === 'KeyP') {
    if (modalOpen) return;
    event.preventDefault();
    previewFlow.toggleOpen();
    return;
  }
  if (event.altKey && event.code === 'KeyR') {
    event.preventDefault();
    player.replayShot();
    return;
  }
  // Espacio fuera de campos y controles (en un botón lo usa su activación nativa).
  if (event.key === ' ' && !isTextEntry(event.target) && !isInteractive(event.target)) {
    event.preventDefault();
    player.togglePlay();
    return;
  }
  if (event.key === 'Escape' && isTextEntry(event.target) && typeof event.target.blur === 'function') {
    event.target.blur();
  }
}

function isTextEntry(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable === true;
}

function isInteractive(target) {
  if (!target || !target.closest) return false;
  return Boolean(
    target.closest('button, a, [role="button"], [role="switch"], [role="tab"], [role="slider"], [role="option"]'),
  );
}
