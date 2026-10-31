// Flujo del botón Translate: traduce el campo Original de un soundbite y pone el
// resultado en Translation, sin pisar nada si el plano o la carga cambiaron.
// Añade la traducción masiva «Translate all» (13.8), que recorre los pendientes
// en secuencia sin pedir confirmación.

import { updateShot, pendingTranslations } from '../core/shot-model.js';
import { translationTarget } from '../core/languages.js';
import { bannerCopy, soundbiteCount } from './feedback.js';

// Crea el flujo. `ctx` lo monta app.js:
//   state, dsw, banner, bannerRegion, editor, announce, commit (refresca y
//   autoguarda), toasts, refreshAll, confirmReplace(target) → Promise<boolean>
//   (modal de reemplazo de la traducción; recibe el idioma destino),
//   isTranscribing(number) → boolean (opcional; el plano se está transcribiendo).
export function createTranslateFlow(ctx) {
  const { state, dsw, banner, editor } = ctx;
  // Planos con una traducción en marcha (o esperando la confirmación), con la
  // promesa que se resuelve al terminar.
  const inFlight = new Map();
  // Hay una traducción masiva en curso (botón busy, sin segundo lanzamiento).
  let translatingAll = false;
  // Título del último aviso de traducción fallida (individual o masiva): solo ese se retira.
  let lastFailureTitle = null;

  function shotOf(number) {
    return state.shots.find((shot) => shot.number === number);
  }

  // ¿Sigue siendo el mismo plano de entrevista con el mismo Original y Translation que se enviaron?
  // La Translation cuenta para no pisar una edición del usuario durante la petición.
  function isUnchanged(current, sent) {
    return Boolean(
      current &&
        current.interview &&
        current.startFrame === sent.startFrame &&
        current.endFrame === sent.endFrame &&
        current.soundbite.original === sent.soundbite.original &&
        current.soundbite.language === sent.soundbite.language &&
        current.soundbite.translation === sent.soundbite.translation,
    );
  }

  // Identidad de la carga: si cambia el vídeo o el XML, la petición en curso ya no vale.
  function loadToken() {
    return `${state.video?.path ?? ''}\u0000${state.xml?.path ?? ''}`;
  }

  // Refleja en el editor si el plano mostrado tiene una traducción en curso.
  function refreshTranslating() {
    const shown = state.selected;
    editor.setTranslating(inFlight.has(`${loadToken()}:${shown}`) ? shown : null);
  }

  // Quita el aviso de traducción fallida anterior (individual o masivo); otros avisos no se tocan.
  function clearFailureBanner() {
    if (banner.current() !== 'warning' || lastFailureTitle === null) return;
    const title = ctx.bannerRegion.querySelector('.banner__title');
    if (title && title.textContent === lastFailureTitle) banner.clear();
  }

  // Traduce un plano. `allowReplace` pide confirmación si Translation ya tiene texto;
  // en la traducción masiva va en false y los planos ya traducidos se saltan.
  // `replace` sustituye la traducción existente sin modal (retranscripción).
  // `quiet` suprime los anuncios (colas de 15.2 y retranscripción).
  // Devuelve { status: 'done' | 'discarded' | 'skipped' | 'stale' | 'failed', error }.
  async function runTranslation(
    number,
    { allowReplace, startMessage = 'Translating…', quiet = false, replace = false },
  ) {
    const token = loadToken();
    const key = `${token}:${number}`;
    // Con `replace`, espera a la traducción anterior del mismo plano para traducir
    // el Original actual, no el que había cuando se lanzó aquella.
    while (replace && inFlight.has(key)) {
      await inFlight.get(key);
      if (loadToken() !== token) return { status: 'stale' };
    }

    const shot = shotOf(number);
    if (!shot || !shot.interview) return { status: 'skipped' };
    // Su Original está a punto de cambiar: traducirlo ahora sería traducir el texto viejo.
    if (ctx.isTranscribing?.(number)) return { status: 'skipped' };
    if (shot.soundbite.original.trim() === '') return { status: 'skipped' };
    if (!replace && !allowReplace && shot.soundbite.translation.trim() !== '') {
      return { status: 'skipped' };
    }
    if (inFlight.has(key)) return { status: 'skipped' };
    const target = translationTarget(shot.soundbite.language);

    let release;
    const running = new Promise((resolve) => {
      release = resolve;
    });
    inFlight.set(key, running);
    try {
      if (
        !replace &&
        allowReplace &&
        shot.soundbite.translation.trim() !== '' &&
        !(await ctx.confirmReplace(target))
      ) {
        return { status: 'skipped' };
      }

      refreshTranslating();
      if (!quiet) ctx.announce(startMessage);
      const result = await dsw.translate(shot.soundbite.original, target);

      // El vídeo o el XML cambiaron: la petición queda obsoleta y se descarta en silencio.
      if (loadToken() !== token) return { status: 'stale' };
      if (!isUnchanged(shotOf(number), shot)) {
        if (!quiet) ctx.announce('Translation discarded');
        return { status: 'discarded' };
      }
      state.shots = updateShot(state.shots, number, { soundbite: { translation: result.text } });
      ctx.commit();
      clearFailureBanner();
      // En la masiva y en la cola automática el anuncio de progreso lo lleva quien llama.
      if (!translatingAll && !quiet) ctx.announce('Translation ready');
      return { status: 'done' };
    } catch (error) {
      // Con otra carga en curso, el fallo pertenece a datos que ya no están: se descarta.
      if (loadToken() !== token) return { status: 'stale' };
      return { status: 'failed', error };
    } finally {
      inFlight.delete(key);
      release();
      refreshTranslating();
    }
  }

  function reportFailure(number, error) {
    const copy = bannerCopy('translate-failed', { detail: error.message });
    lastFailureTitle = copy.title;
    // Con un error visible, el aviso no se muestra (manda el existente): se anuncia a mano.
    const hidden = banner.current() === 'error';
    banner.showWarning({
      title: copy.title,
      detail: copy.detail,
      action: { label: 'Try again', onClick: () => onTranslate(number) },
    });
    if (hidden) ctx.announce(copy.title);
  }

  async function onTranslate(number) {
    const result = await runTranslation(number, { allowReplace: true });
    if (result.status === 'failed') reportFailure(number, result.error);
  }

  // Traducción silenciosa de las colas (15.2 y retranscripción): sin confirmación,
  // sin banner y sin anuncios. `replace` sustituye la traducción existente.
  async function translateShot(number, { quiet = false, replace = false } = {}) {
    return runTranslation(number, { allowReplace: false, quiet, replace });
  }

  // Detalle del aviso: los dos primeros fallos y, si hay más, su cuenta.
  function failureDetail(failures) {
    const shown = failures
      .slice(0, 2)
      .map((failure) => `Shot ${failure.number}: ${failure.error.message}`);
    if (failures.length > 2) shown.push(`and ${failures.length - 2} more`);
    return shown.join(' ');
  }

  function reportMassFailure(failures) {
    const title = `Couldn't translate ${soundbiteCount(failures.length)}.`;
    lastFailureTitle = title;
    // Con un error visible, el aviso no se muestra (manda el existente): se anuncia a mano.
    const hidden = banner.current() === 'error';
    banner.showWarning({
      title,
      detail: failureDetail(failures),
      action: { label: 'Try again', onClick: () => translateAll() },
    });
    if (hidden) ctx.announce(title);
  }

  function reportMassSuccess(count) {
    ctx.toasts?.show({
      kind: 'success',
      title: `Translated ${soundbiteCount(count)}.`,
      detail: 'Review the translations before generating.',
    });
  }

  // Traduce en secuencia todos los soundbites pendientes. Un fallo no detiene el resto;
  // si cambia el vídeo o el XML, se para sin avisar.
  async function translateAll() {
    if (translatingAll) return;
    const pending = pendingTranslations(state.shots);
    if (pending.length === 0) return;

    translatingAll = true;
    clearFailureBanner();
    ctx.refreshAll?.();
    const token = loadToken();
    const failures = [];
    let done = 0;
    let stopped = false;

    try {
      let index = 0;
      for (const number of pending) {
        if (loadToken() !== token) {
          stopped = true;
          break;
        }
        index += 1;
        const result = await runTranslation(number, {
          allowReplace: false,
          startMessage: `Translating ${index} of ${pending.length}…`,
        });
        if (result.status === 'stale') {
          stopped = true;
          break;
        }
        if (result.status === 'done') done += 1;
        else if (result.status === 'failed') failures.push({ number, error: result.error });
      }
    } finally {
      translatingAll = false;
      ctx.refreshAll?.();
    }

    if (stopped) return;
    if (failures.length > 0) reportMassFailure(failures);
    else if (done > 0) reportMassSuccess(done);
  }

  return {
    onTranslate,
    translateShot,
    refreshTranslating,
    translateAll,
    isTranslatingAll() {
      return translatingAll;
    },
  };
}
