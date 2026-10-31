// Flujo del botón Transcribe: transcribe el corte de un plano de entrevista y pone el
// texto en Original y el idioma detectado en Language, sin pisar nada si el plano o
// la carga cambiaron durante la petición.

import { languageCodeFromName } from '../core/languages.js';
import { updateShot } from '../core/shot-model.js';
import { framesToSeconds } from '../core/timecode.js';
import { bannerCopy } from './feedback.js';

// Crea el flujo. `ctx` lo monta app.js:
//   state, dsw, banner, bannerRegion, editor, announce, commit (refresca y
//   autoguarda), refreshAll, confirmReplace() → Promise<boolean> (modal de reemplazo
//   del texto original).
export function createTranscribeFlow(ctx) {
  const { state, dsw, banner, editor } = ctx;
  // Plano que se está transcribiendo (o esperando la confirmación), con la carga a la que pertenece.
  let inFlight = null;
  // Esperas de la cola automática: se despiertan cuando termina una transcripción.
  const waiters = [];
  let available = false;
  // Título del último aviso de transcripción fallida: solo ese se retira.
  let lastFailureTitle = null;

  function shotOf(number) {
    return state.shots.find((shot) => shot.number === number);
  }

  // Identidad de la carga: si cambia el vídeo o el XML, la petición en curso ya no vale.
  function loadToken() {
    return `${state.video?.path ?? ''}\u0000${state.xml?.path ?? ''}`;
  }

  // ¿Sigue siendo el mismo plano de entrevista con los mismos fotogramas que se enviaron?
  function isUnchanged(current, sent) {
    return Boolean(
      current &&
        current.interview &&
        current.startFrame === sent.startFrame &&
        current.endFrame === sent.endFrame,
    );
  }

  function sameLanguage(a, b) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  function hasVideo() {
    return Boolean(state.video?.loaded && state.video.path);
  }

  // Despierta a la siguiente espera (si la hay) al terminar una transcripción.
  function wakeWaiter() {
    const waiter = waiters.shift();
    if (waiter) waiter();
  }

  // Refleja en el editor si el plano mostrado se está transcribiendo.
  function refreshTranscribing() {
    editor.setTranscribing(inFlight && inFlight.token === loadToken() ? inFlight.number : null);
  }

  function setAvailability(status) {
    available = Boolean(status.available);
    editor.setTranscriberAvailable(available);
  }

  // Quita el aviso de transcripción fallida anterior; otros avisos no se tocan.
  function clearFailureBanner() {
    if (banner.current() !== 'warning' || lastFailureTitle === null) return;
    const title = ctx.bannerRegion.querySelector('.banner__title');
    if (title && title.textContent === lastFailureTitle) banner.clear();
  }

  function readyAnnouncement(number, languageName) {
    const detail = languageName ? ` (${languageName})` : '';
    if (state.selected === number) return `Transcription ready${detail}`;
    return `Shot ${number}: transcription ready${detail}`;
  }

  function applyResult(number, shot, result, quiet, language) {
    if (language !== null) {
      // Retranscripción: solo cambia Original; Language ya lo puso el usuario.
      state.shots = updateShot(state.shots, number, { soundbite: { original: result.text } });
      ctx.commit();
      clearFailureBanner();
      if (!quiet) ctx.announce(readyAnnouncement(number, null));
      return;
    }
    const languageName = result.languageName ?? null;
    const soundbite = { original: result.text };
    if (languageName) soundbite.language = languageName;
    state.shots = updateShot(state.shots, number, { soundbite });
    ctx.commit();
    clearFailureBanner();
    if (!quiet) ctx.announce(readyAnnouncement(number, languageName));
    const changed = languageName && !sameLanguage(languageName, shot.soundbite.language);
    if (changed && state.selected === number) editor.flashLanguage();
  }

  function reportFailure(number, error) {
    const copy = bannerCopy('transcribe-failed', { number, detail: error.message });
    lastFailureTitle = copy.title;
    // Con un error visible, el aviso no se muestra (manda el existente): se anuncia a mano.
    const hidden = banner.current() === 'error';
    banner.showWarning({
      title: copy.title,
      detail: copy.detail,
      action: {
        label: 'Try again',
        onClick: () => {
          banner.clear();
          return onTranscribe(number);
        },
      },
    });
    if (hidden) ctx.announce(copy.title);
  }

  // Núcleo compartido por el botón Transcribe y las colas (15.2 y retranscripción).
  // `allowReplace` pide confirmación si Original ya tiene texto; `quiet` calla los
  // anuncios y no muestra el banner de fallo (devuelve `failed` con el error).
  // `language` no nulo fuerza el idioma y sustituye Original sin confirmación.
  // Devuelve { status: 'done' | 'skipped' | 'discarded' | 'stale' | 'failed', error }.
  async function runTranscription(number, { allowReplace, quiet, language = null }) {
    const shot = shotOf(number);
    if (!shot || !shot.interview) return { status: 'skipped' };
    if (!hasVideo() || !available) return { status: 'skipped' };
    // Dos transcripciones a la vez nunca: la cola espera fuera (transcribeShot).
    if (inFlight) return { status: 'skipped' };

    const token = loadToken();
    inFlight = { number, token };
    try {
      if (language === null && shot.soundbite.original.trim() !== '') {
        if (!allowReplace || !(await ctx.confirmReplace())) return { status: 'skipped' };
      }

      refreshTranscribing();
      if (!quiet) ctx.announce('Transcribing…');
      const fps = state.xml.parsed.fps;
      const start = framesToSeconds(shot.startFrame, fps);
      const end = framesToSeconds(shot.endFrame, fps);
      const result = language === null
        ? await dsw.transcribe(state.video.path, start, end)
        : await dsw.transcribe(state.video.path, start, end, language);

      // El vídeo o el XML cambiaron: la petición queda obsoleta y se descarta en silencio.
      if (loadToken() !== token) return { status: 'stale' };
      const current = shotOf(number);
      const stillForced =
        language === null || languageCodeFromName(current?.soundbite?.language) === language;
      if (!isUnchanged(current, shot) || !stillForced) {
        if (!quiet) ctx.announce('Transcription discarded');
        return { status: 'discarded' };
      }
      applyResult(number, shot, result, quiet, language);
      return { status: 'done' };
    } catch (error) {
      // Con otra carga en curso, el fallo pertenece a datos que ya no están: se descarta.
      if (loadToken() !== token) return { status: 'stale' };
      if (quiet) return { status: 'failed', error };
      reportFailure(number, error);
      return { status: 'failed', error };
    } finally {
      inFlight = null;
      refreshTranscribing();
      ctx.refreshAll?.();
      wakeWaiter();
    }
  }

  // El botón no espera: con otra transcripción en curso no hace nada (14.1).
  async function onTranscribe(number) {
    if (inFlight) return;
    return runTranscription(number, { allowReplace: true, quiet: false });
  }

  // Transcripción silenciosa de las colas. Espera a que la anterior termine
  // (nunca dos `dsw.transcribe` a la vez) y reintenta entonces. `language` fuerza
  // el idioma y sustituye Original sin confirmación.
  async function transcribeShot(number, { quiet = false, language = null } = {}) {
    const token = loadToken();
    while (inFlight) {
      await new Promise((resolve) => waiters.push(resolve));
    }
    try {
      // La carga cambió mientras esperaba el turno: la cola se para en silencio.
      if (loadToken() !== token) return { status: 'stale' };
      return await runTranscription(number, { allowReplace: false, quiet, language });
    } finally {
      // Si se saltó sin ocupar el turno, la siguiente espera puede pasar.
      if (!inFlight) wakeWaiter();
    }
  }

  // ¿Se está transcribiendo (o esperando confirmación) este plano de la carga actual?
  function isTranscribing(number) {
    return Boolean(inFlight && inFlight.number === number && inFlight.token === loadToken());
  }

  return { onTranscribe, transcribeShot, refreshTranscribing, setAvailability, isTranscribing };
}
