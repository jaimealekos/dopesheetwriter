// Apertura del vídeo en un <video> oculto y extracción de la miniatura del primer fotograma de cada plano.

import { frameSeekTime } from '../core/timecode.js';
import { SEEK_TIMEOUT_MS, THUMBNAIL_WIDTH } from '../core/config.js';

// Error al abrir un vídeo, con la causa clasificada como 'decode' o 'unreadable'.
export class VideoError extends Error {
  constructor(code) {
    super(`The video could not be opened (${code}).`);
    this.name = 'VideoError';
    this.code = code;
  }
}

// Tamaño de la miniatura conservando la proporción del vídeo.
export function thumbnailSize(videoWidth, videoHeight, targetWidth) {
  if (videoWidth <= 0) {
    throw new RangeError('video width must be positive');
  }
  return { width: targetWidth, height: Math.round((targetWidth * videoHeight) / videoWidth) };
}

// Clasifica el fallo de un <video>: 'decode' si no hay imagen o el códec no se soporta.
export function classifyMediaError(mediaErrorCode, videoWidth) {
  if (videoWidth === 0 || mediaErrorCode === 3 || mediaErrorCode === 4) {
    return 'decode';
  }
  return 'unreadable';
}

// Espera a un evento del elemento; el evento de error rechaza. Con `signal`, el aborto
// rechaza; con `timeoutMs`, agotar el tiempo rechaza. Sin listeners colgando.
function waitForEvent(element, successEvent, errorEvent, o = {}) {
  const { signal, timeoutMs } = o;
  return new Promise((resolve, reject) => {
    let timer = null;
    function cleanup() {
      if (timer !== null) clearTimeout(timer);
      element.removeEventListener(successEvent, onSuccess);
      element.removeEventListener(errorEvent, onError);
      signal?.removeEventListener('abort', onAbort);
    }
    function onSuccess() {
      cleanup();
      resolve();
    }
    function onError() {
      cleanup();
      reject(new Error('media error'));
    }
    function onAbort() {
      cleanup();
      reject(new Error('aborted'));
    }
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    element.addEventListener(successEvent, onSuccess);
    element.addEventListener(errorEvent, onError);
    signal?.addEventListener('abort', onAbort, { once: true });
    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('media timeout'));
      }, timeoutMs);
    }
  });
}

// Coloca el vídeo en un instante y espera a 'seeked', con tope de tiempo y aborto.
function seekTo(video, seconds, signal) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('seek timeout'));
    }, SEEK_TIMEOUT_MS);
    function cleanup() {
      clearTimeout(timer);
      video.removeEventListener('seeked', onSeeked);
      signal?.removeEventListener('abort', onAbort);
    }
    function onSeeked() {
      cleanup();
      resolve();
    }
    function onAbort() {
      cleanup();
      reject(new Error('aborted'));
    }
    video.addEventListener('seeked', onSeeked);
    signal?.addEventListener('abort', onAbort, { once: true });
    video.currentTime = seconds;
  });
}

// Rechaza con VideoError a partir del estado del elemento de vídeo.
function videoErrorFrom(video) {
  const code = video.error ? video.error.code : null;
  return new VideoError(classifyMediaError(code, video.videoWidth));
}

// Lee las dimensiones y la duración del vídeo sin llegar a reproducirlo.
export async function probeVideo(videoUrl) {
  const video = document.createElement('video');
  video.muted = true;
  video.preload = 'metadata';
  video.src = videoUrl;
  try {
    await waitForEvent(video, 'loadedmetadata', 'error');
    if (video.videoWidth === 0) {
      throw videoErrorFrom(video);
    }
    return { duration: video.duration, width: video.videoWidth, height: video.videoHeight };
  } catch (error) {
    if (error instanceof VideoError) {
      throw error;
    }
    throw videoErrorFrom(video);
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}

// Extrae la miniatura del primer fotograma de cada corte, en orden y de uno en uno.
export async function extractFrames({ videoUrl, cuts, fps, width = THUMBNAIL_WIDTH, onFrame, signal }) {
  const video = document.createElement('video');
  video.hidden = true;
  video.muted = true;
  video.preload = 'auto';
  video.src = videoUrl;
  try {
    try {
      await waitForEvent(video, 'loadeddata', 'error', { signal, timeoutMs: SEEK_TIMEOUT_MS });
    } catch (error) {
      if (signal?.aborted) return;
      if (error instanceof VideoError) throw error;
      throw videoErrorFrom(video);
    }

    const size = thumbnailSize(video.videoWidth, video.videoHeight, width);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');

    for (let index = 0; index < cuts.length; index += 1) {
      if (signal?.aborted) {
        return;
      }
      // Solo el fallo de posicionado o de dibujo da miniatura nula; un error de
      // onFrame no se traga y sube al llamador.
      let dataUrl = null;
      try {
        await seekTo(video, frameSeekTime(cuts[index].startFrame, fps), signal);
        context.drawImage(video, 0, 0, size.width, size.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      } catch {
        if (signal?.aborted) {
          return;
        }
      }
      if (signal?.aborted) {
        return;
      }
      onFrame(index, dataUrl);
    }
  } finally {
    video.removeAttribute('src');
    video.load();
  }
}
