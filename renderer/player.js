// Reproductor que preside la ventana: vídeo, barra de progreso con cortes,
// controles y reproducción de un plano de principio a fin.
// Sin referencias a `document` a nivel de módulo.

import { el, icon, tooltip, createSwitch, spinner } from './ui-kit.js';
import { probeVideo, VideoError, classifyMediaError } from './frames.js';
import { formatTimecode, frameSeekTime } from '../core/timecode.js';
import { soundbiteIndex } from '../core/shot-model.js';

/** Número del plano que contiene `frame`; 0 si no hay planos. */
export function shotAtFrame(shots, frame) {
  if (!Array.isArray(shots) || shots.length === 0) return 0;
  let found = null;
  for (const shot of shots) {
    if (shot.startFrame <= frame) found = shot;
  }
  // Anterior al primer plano: se devuelve el primero.
  return found ? found.number : shots[0].number;
}

/** Etiqueta del plano: `Shot 12 of 26` o `Soundbite 1 · shot 24 of 26`. */
export function shotLabel(shots, number) {
  const total = Array.isArray(shots) ? shots.length : 0;
  const shot = Array.isArray(shots) ? shots.find((item) => item.number === number) : null;
  if (shot && shot.interview) {
    return `Soundbite ${soundbiteIndex(shots, number)} · shot ${number} of ${total}`;
  }
  return `Shot ${number} of ${total}`;
}

/** Tanto por ciento de `frame` sobre `totalFrames`, limitado a 0..100. */
export function percentOf(frame, totalFrames) {
  if (!(totalFrames > 0)) return 0;
  const percent = (frame / totalFrames) * 100;
  return Math.min(100, Math.max(0, percent));
}

/** Suma `deltaFrames` y limita el resultado a `[0, totalFrames - 1]`. */
export function stepFrame(frame, deltaFrames, totalFrames) {
  const last = Math.max(totalFrames - 1, 0);
  return Math.min(Math.max(frame + deltaFrames, 0), last);
}

/**
 * Monta el reproductor en `root` y devuelve su API.
 * @param {HTMLElement} root
 * @param {{ onShotChange: (number: number) => void, onError: (error: Error) => void }} options
 */
export function mount(root, options) {
  const { onShotChange, onError } = options;

  const state = {
    shots: [],
    fps: 0,
    totalFrames: 0,
    currentShot: 0,
    playing: false,
    stopAtEnd: true,
    loaded: false,
    destroyed: false,
  };

  const stage = el('div', { class: 'player__stage is-loading' });
  const video = el('video', { class: 'player__video', preload: 'metadata', playsinline: true });
  const overlay = el('div', { class: 'player__overlay' });
  stage.append(video, overlay);

  const timeline = el('div', {
    class: 'player__timeline',
    role: 'slider',
    tabindex: '0',
    'aria-label': 'Position',
    'aria-valuemin': '0',
    'aria-valuemax': '0',
    'aria-valuenow': '0',
    'aria-valuetext': '00:00:00:00, shot 0',
  });
  const track = el('div', { class: 'player__track' });
  const shotRange = el('div', { class: 'player__shot-range' });
  const cuts = el('div', { class: 'player__cuts' });
  const playhead = el('div', { class: 'player__playhead' });
  const hoverTime = el('div', { class: 'player__hover-time', hidden: true });
  timeline.append(track, shotRange, cuts, playhead, hoverTime);

  const prevBtn = el('button', { type: 'button', class: 'icon-button player__prev', 'aria-label': 'Previous shot' });
  prevBtn.append(icon('shot-prev', 'player'));
  tooltip(prevBtn, 'Previous shot', { kbd: 'Alt+↑' });

  const playBtn = el('button', { type: 'button', class: 'player__play', 'aria-label': 'Play' });
  playBtn.append(icon('play', 'player'));
  tooltip(playBtn, () => (state.playing ? 'Pause' : 'Play'), { kbd: 'Space' });

  const nextBtn = el('button', { type: 'button', class: 'icon-button player__next', 'aria-label': 'Next shot' });
  nextBtn.append(icon('shot-next', 'player'));
  tooltip(nextBtn, 'Next shot', { kbd: 'Alt+↓' });

  const timecodeEl = el('span', { class: 'player__timecode', text: '00:00:00:00' });
  const durationEl = el('span', { class: 'player__duration', text: ' / 00:00:00:00' });
  const timeEl = el('div', { class: 'player__time' }, timecodeEl, durationEl);
  const shotLabelEl = el('span', { class: 'player__shot-label' });

  const stopToggle = createSwitch({
    id: 'player-stop-at-end',
    label: 'Stop at end of shot',
    checked: true,
    onChange: (checked) => {
      state.stopAtEnd = checked;
    },
  });

  const muteBtn = el('button', { type: 'button', class: 'icon-button volume__mute', 'aria-label': 'Mute', 'aria-pressed': 'false' });
  muteBtn.append(icon('volume', 'player'));
  tooltip(muteBtn, () => (video.muted ? 'Unmute' : 'Mute'));

  const volumeSlider = el('input', {
    type: 'range',
    class: 'volume__slider',
    min: '0',
    max: '1',
    step: '0.01',
    value: '1',
    'aria-label': 'Volume',
  });
  const volumeEl = el('div', { class: 'volume' }, muteBtn, volumeSlider);
  const playerOptions = el('div', { class: 'player__options' }, stopToggle.root, volumeEl);

  const transport = el('div', { class: 'player__transport' }, prevBtn, playBtn, nextBtn);
  const bar = el('div', { class: 'player__bar' }, transport, timeEl, shotLabelEl, playerOptions);
  const controls = el('div', { class: 'player__controls' }, timeline, bar);
  const player = el('section', { class: 'player', 'aria-label': 'Player' }, stage, controls);
  root.append(player);

  video.volume = 1;

  const useFrameCallback = typeof video.requestVideoFrameCallback === 'function';
  let frameLoopScheduled = false;
  // Última reproducción pedida: un rechazo viejo no debe pisar el estado actual.
  let activePlay = null;

  // --- utilidades internas -------------------------------------------------

  function findShot(number) {
    return state.shots.find((shot) => shot.number === number) || null;
  }

  function currentFrame() {
    if (!state.fps) return 0;
    return Math.round(video.currentTime * state.fps);
  }

  function seekToFrame(frame) {
    if (!state.fps) return;
    const last = Math.max(state.totalFrames - 1, 0);
    const clamped = Math.min(Math.max(frame, 0), last);
    video.currentTime = frameSeekTime(clamped, state.fps);
  }

  function reportError(error) {
    if (onError) onError(error instanceof Error ? error : new Error(String(error)));
  }

  function refreshShotUI() {
    const shot = findShot(state.currentShot);
    if (shot) {
      shotLabelEl.textContent = shotLabel(state.shots, state.currentShot);
      const start = percentOf(shot.startFrame, state.totalFrames);
      const end = percentOf(shot.endFrame, state.totalFrames);
      shotRange.style.left = `${start}%`;
      shotRange.style.width = `${Math.max(end - start, 0)}%`;
    } else {
      shotLabelEl.textContent = '';
      shotRange.style.left = '0%';
      shotRange.style.width = '0%';
    }
  }

  function updateTime() {
    const fps = state.fps || 1;
    const time = Number.isFinite(video.currentTime) ? Math.max(video.currentTime, 0) : 0;
    const text = formatTimecode(time, fps);
    timecodeEl.textContent = text;
    timeline.setAttribute('aria-valuenow', String(time));
    timeline.setAttribute('aria-valuetext', `${text}, shot ${state.currentShot}`);
    const percent = state.totalFrames > 0 ? percentOf(currentFrame(), state.totalFrames) : 0;
    playhead.style.left = `${percent}%`;
    hoverTime.hidden = true;
  }

  function updateCurrentShot(frame) {
    if (state.shots.length === 0) return;
    const next = shotAtFrame(state.shots, frame);
    if (next === state.currentShot) return;
    state.currentShot = next;
    refreshShotUI();
    if (onShotChange) onShotChange(next);
  }

  function updatePlayUI() {
    playBtn.classList.toggle('is-playing', state.playing);
    playBtn.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
    playBtn.replaceChildren(icon(state.playing ? 'pause' : 'play', 'player'));
  }

  function updateVolumeUI() {
    const muted = video.muted || video.volume === 0;
    volumeEl.classList.toggle('is-muted', muted);
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    muteBtn.replaceChildren(icon(muted ? 'mute' : 'volume', 'player'));
  }

  function pause() {
    activePlay = null;
    video.pause();
    state.playing = false;
    updatePlayUI();
  }

  function play() {
    state.playing = true;
    updatePlayUI();
    const request = video.play();
    activePlay = request;
    if (request && typeof request.catch === 'function') {
      request.catch((error) => {
        // Pausar en medio de un play() produce AbortError: no es un fallo.
        if (error && error.name === 'AbortError') return;
        if (request !== activePlay) return;
        state.playing = false;
        updatePlayUI();
        reportError(error);
      });
    }
    scheduleFrame();
  }

  // Reanuda tras un posicionado: misma condición que togglePlay y con el plano
  // actual ya actualizado, para que «Stop at end» no pare en el primer tick.
  function resumeAfterSeek() {
    if (!state.loaded || state.shots.length === 0) return;
    play();
  }

  function scheduleFrame() {
    if (state.destroyed || !useFrameCallback || frameLoopScheduled) return;
    frameLoopScheduled = true;
    video.requestVideoFrameCallback(onVideoFrame);
  }

  function onVideoFrame(now, metadata) {
    frameLoopScheduled = false;
    if (state.destroyed) return;
    handlePlaybackTick(metadata.mediaTime);
    scheduleFrame();
  }

  function handlePlaybackTick(mediaTime) {
    if (!state.fps) return;
    const time = Number.isFinite(mediaTime) ? mediaTime : video.currentTime;
    const shot = findShot(state.currentShot);
    if (state.stopAtEnd && state.playing && shot && time >= shot.endFrame / state.fps) {
      pause();
      seekToFrame(Math.max(shot.endFrame - 1, 0));
      updateTime();
      return;
    }
    updateTime();
    updateCurrentShot(Math.round(time * state.fps));
  }

  function renderCuts() {
    cuts.replaceChildren();
    for (const shot of state.shots) {
      if (shot.startFrame <= 0) continue;
      const left = percentOf(shot.startFrame, state.totalFrames);
      const cut = el('span', { class: 'player__cut' });
      cut.style.left = `${left}%`;
      cuts.append(cut);
    }
  }

  function showLoadingOverlay() {
    overlay.replaceChildren(spinner('player'));
  }

  function showErrorOverlay() {
    overlay.replaceChildren(
      icon('error', 'dropzone'),
      el('p', { class: 'player__overlay-text', text: "This video can't be played." }),
    );
  }

  // --- API pública ---------------------------------------------------------

  function setShots(shots, fps, totalFrames) {
    state.shots = Array.isArray(shots) ? shots : [];
    state.fps = fps;
    state.totalFrames = totalFrames;
    const seconds = fps > 0 ? totalFrames / fps : 0;
    timeline.setAttribute('aria-valuemax', String(seconds));
    durationEl.textContent = ` / ${formatTimecode(seconds, fps || 1)}`;
    renderCuts();
    if (state.shots.length === 0) {
      state.currentShot = 0;
    } else {
      state.currentShot = shotAtFrame(state.shots, currentFrame());
    }
    refreshShotUI();
    updateTime();
  }

  function selectShot(number, o = {}) {
    const shot = findShot(number);
    if (!shot) throw new RangeError(`Shot ${number} does not exist.`);
    pause();
    seekToFrame(shot.startFrame);
    const changed = number !== state.currentShot;
    state.currentShot = number;
    refreshShotUI();
    updateTime();
    if (changed && onShotChange) onShotChange(number);
    if (o.play) play();
  }

  function togglePlay() {
    if (!state.loaded || state.shots.length === 0) return;
    if (state.playing) {
      pause();
      return;
    }
    const shot = findShot(state.currentShot);
    if (state.stopAtEnd && shot && state.fps > 0 && currentFrame() >= shot.endFrame - 1) {
      seekToFrame(shot.startFrame);
      updateTime();
    }
    play();
  }

  function replayShot() {
    if (state.shots.length === 0) return;
    selectShot(state.currentShot, { play: true });
  }

  function stepShot(delta) {
    if (state.shots.length === 0) return;
    const wasPlaying = state.playing;
    const target = Math.min(state.shots.length, Math.max(1, state.currentShot + delta));
    selectShot(target, { play: wasPlaying });
  }

  async function load(o) {
    const { url, name } = o;
    pause();
    stage.classList.remove('is-error');
    stage.classList.add('is-loading');
    showLoadingOverlay();
    try {
      const metadata = await probeVideo(url);
      video.src = url;
      video.setAttribute('aria-label', `Video: ${name}`);
      state.loaded = true;
      stage.classList.remove('is-loading');
      overlay.replaceChildren();
      timeline.setAttribute('aria-valuemax', String(metadata.duration));
      durationEl.textContent = ` / ${formatTimecode(metadata.duration, state.fps || 1)}`;
      updateTime();
      scheduleFrame();
      return metadata;
    } catch (error) {
      state.loaded = false;
      stage.classList.remove('is-loading');
      stage.classList.add('is-error');
      showErrorOverlay();
      throw error;
    }
  }

  function destroy() {
    state.destroyed = true;
    pause();
    video.removeAttribute('src');
    video.load();
    root.replaceChildren();
  }

  // --- eventos -------------------------------------------------------------

  function handleMediaError() {
    if (!state.loaded) return;
    const code = video.error ? video.error.code : null;
    reportError(new VideoError(classifyMediaError(code, video.videoWidth)));
  }

  video.addEventListener('error', handleMediaError);
  video.addEventListener('loadedmetadata', updateTime);

  // El elemento manda: si pausa o termina por su cuenta, la pausa interna deja
  // el estado y el botón sincronizados. Un evento 'pause' encolado antes de un
  // play() de la misma tarea llega con el vídeo ya reproduciendo: se ignora.
  video.addEventListener('pause', () => {
    if (video.paused) pause();
  });
  video.addEventListener('ended', pause);

  if (!useFrameCallback) {
    video.addEventListener('timeupdate', () => handlePlaybackTick(video.currentTime));
  }

  playBtn.addEventListener('click', togglePlay);
  prevBtn.addEventListener('click', () => stepShot(-1));
  nextBtn.addEventListener('click', () => stepShot(1));

  volumeSlider.addEventListener('input', () => {
    video.volume = Number(volumeSlider.value);
    if (video.volume > 0) video.muted = false;
    updateVolumeUI();
  });
  muteBtn.addEventListener('click', () => {
    video.muted = !video.muted;
    updateVolumeUI();
  });

  function frameFromEvent(event) {
    const rect = timeline.getBoundingClientRect();
    const ratio = rect.width > 0 ? (event.clientX - rect.left) / rect.width : 0;
    const last = Math.max(state.totalFrames - 1, 0);
    return Math.min(Math.max(Math.round(ratio * last), 0), last);
  }

  function seekToPointer(event) {
    if (state.totalFrames <= 0) return;
    pause();
    seekToFrame(frameFromEvent(event));
    updateCurrentShot(currentFrame());
    updateTime();
  }

  function showHoverTime(event) {
    if (state.totalFrames <= 0 || !state.fps) return;
    const rect = timeline.getBoundingClientRect();
    const frame = frameFromEvent(event);
    hoverTime.textContent = formatTimecode(frame / state.fps, state.fps);
    hoverTime.style.left = `${event.clientX - rect.left}px`;
    hoverTime.hidden = false;
  }

  timeline.addEventListener('pointerdown', (event) => {
    if (state.totalFrames <= 0) return;
    timeline.setPointerCapture(event.pointerId);
    seekToPointer(event);
  });
  timeline.addEventListener('pointermove', (event) => {
    if (state.totalFrames <= 0) return;
    if (timeline.hasPointerCapture(event.pointerId)) {
      seekToPointer(event);
    } else {
      showHoverTime(event);
    }
  });
  function endPointerGesture(event) {
    const hadCapture = timeline.hasPointerCapture(event.pointerId);
    if (hadCapture) timeline.releasePointerCapture(event.pointerId);
    if (!hadCapture || state.totalFrames <= 0) return;
    seekToPointer(event);
    resumeAfterSeek();
  }
  timeline.addEventListener('pointerup', endPointerGesture);
  timeline.addEventListener('pointercancel', endPointerGesture);
  timeline.addEventListener('pointerleave', () => {
    hoverTime.hidden = true;
  });

  function previousCut(frame) {
    let result = 0;
    for (const shot of state.shots) {
      if (shot.startFrame < frame) result = shot.startFrame;
    }
    return result;
  }

  function nextCut(frame) {
    for (const shot of state.shots) {
      if (shot.startFrame > frame) return shot.startFrame;
    }
    return Math.max(state.totalFrames - 1, 0);
  }

  timeline.addEventListener('keydown', (event) => {
    if (state.totalFrames <= 0) return;
    const oneSecond = Math.round(state.fps);
    let frame = currentFrame();
    // Mayús+flechas y saltos grandes acaban reproduciendo; la flecha sola solo
    // mueve un fotograma y deja el vídeo en pausa.
    let reproduces = false;
    switch (event.key) {
      case 'ArrowLeft':
        frame = stepFrame(frame, event.shiftKey ? -oneSecond : -1, state.totalFrames);
        reproduces = event.shiftKey;
        break;
      case 'ArrowRight':
        frame = stepFrame(frame, event.shiftKey ? oneSecond : 1, state.totalFrames);
        reproduces = event.shiftKey;
        break;
      case 'PageUp':
        frame = previousCut(frame);
        reproduces = true;
        break;
      case 'PageDown':
        frame = nextCut(frame);
        reproduces = true;
        break;
      case 'Home':
        frame = 0;
        reproduces = true;
        break;
      case 'End':
        frame = state.totalFrames - 1;
        reproduces = true;
        break;
      default:
        return;
    }
    event.preventDefault();
    pause();
    seekToFrame(frame);
    updateCurrentShot(frame);
    updateTime();
    // Al último fotograma no se reanuda: reproducir ahí pararía de inmediato.
    if (reproduces && frame < state.totalFrames - 1) resumeAfterSeek();
  });

  updatePlayUI();
  updateVolumeUI();
  showLoadingOverlay();

  return {
    load,
    setShots,
    selectShot,
    togglePlay,
    replayShot,
    stepShot,
    getCurrentShot: () => state.currentShot,
    isPlaying: () => state.playing,
    destroy,
  };
}
