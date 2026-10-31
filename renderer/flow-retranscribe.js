// Retranscripción al cambiar el idioma de un plano de entrevista ya transcrito (16):
// pregunta una vez, retranscribe en el idioma nuevo y retraduce en segundo plano.

import { languageCodeFromName, languageNameFromCode } from '../core/languages.js';
import { bannerCopy, soundbiteCount } from './feedback.js';

// Crea el flujo. `ctx` lo monta app.js con los módulos ya enlazados:
//   state, banner, bannerRegion, toasts, announce, refreshAll,
//   confirmRetranscribe, transcribeShot, translateShot, transcriberAvailable,
//   setProgress, setProcessing, setQueued.
export function createRetranscribeFlow(ctx) {
  const { state } = ctx;
  // Cola en marcha (con sus entradas, traducciones y fallos).
  let currentRun = null;
  // Una cola vieja que termina tarde no toca la interfaz de la nueva.
  let generation = 0;
  let running = false;

  function shotOf(number) {
    return state.shots.find((shot) => shot.number === number);
  }

  // Identidad de la carga: si cambia el vídeo o el XML, la cola se para en silencio.
  function loadToken() {
    return `${state.video?.path ?? ''}\u0000${state.xml?.path ?? ''}`;
  }

  function hasVideo() {
    return Boolean(state.video?.loaded && state.video.path);
  }

  function isLatest(run) {
    return run.generation === generation;
  }

  function createRun(token, entries) {
    const normalized = entries.map((entry) => ({
      number: entry.number,
      step: entry.step ?? 'transcribe',
      code: entry.code ?? null,
    }));
    return {
      token,
      entries: normalized,
      transcribeTotal: normalized.filter((entry) => entry.step === 'transcribe').length,
      transcribeIndex: 0,
      current: null,
      translationsPending: 0,
      translationsLaunched: 0,
      translationsDone: 0,
      translatingNumbers: [],
      failures: [],
      completed: 0,
      stale: false,
      active: true,
      wake: null,
    };
  }

  // Despierta al trabajador cuando añade una entrada o termina una traducción.
  function wake(run) {
    const waiter = run.wake;
    run.wake = null;
    if (waiter) waiter();
  }

  function waitChange(run) {
    return new Promise((resolve) => {
      run.wake = resolve;
    });
  }

  function paintProgress(run, text) {
    if (isLatest(run) && !run.stale) ctx.setProgress(text);
  }

  function paintQueued(run) {
    if (!isLatest(run) || run.stale) return;
    ctx.setQueued(
      run.entries.filter((entry) => entry.step === 'transcribe').map((entry) => entry.number),
    );
  }

  function paintProcessing(run) {
    if (!isLatest(run) || run.stale) return;
    if (run.current !== null) {
      ctx.setProcessing(run.current, 'transcribing');
    } else if (run.translatingNumbers.length > 0) {
      ctx.setProcessing(run.translatingNumbers[run.translatingNumbers.length - 1], 'translating');
    } else {
      ctx.setProcessing(null, null);
    }
  }

  function updateTranscribeProgress(run) {
    if (run.current === null) return;
    paintProgress(run, `Retranscribing ${run.transcribeIndex} of ${run.transcribeTotal}\u2026`);
  }

  function updateTranslationProgress(run) {
    if (run.current !== null || run.translationsPending <= 0) return;
    paintProgress(
      run,
      `Translating ${run.translationsDone + 1} of ${run.translationsLaunched}\u2026`,
    );
  }

  // Lanza la traducción sin esperarla: el trabajador sigue con la siguiente entrada.
  // `countOnDone` cuenta la entrada como hecha (reintento que solo traduce).
  function launchTranslation(run, number, countOnDone = false) {
    run.translationsPending += 1;
    run.translationsLaunched += 1;
    run.translatingNumbers.push(number);
    paintProcessing(run);

    (async () => {
      let result;
      try {
        result = await ctx.translateShot(number, { quiet: true, replace: true });
      } catch (error) {
        result = { status: 'failed', error };
      }
      run.translatingNumbers = run.translatingNumbers.filter((item) => item !== number);
      run.translationsPending -= 1;
      run.translationsDone += 1;
      if (result.status === 'done' && countOnDone) run.completed += 1;
      else if (result.status === 'stale') run.stale = true;
      else if (result.status === 'failed') {
        run.failures.push({ number, step: 'translate', error: result.error });
      }
      paintProcessing(run);
      updateTranslationProgress(run);
      wake(run);
    })();
  }

  function reportFailures(failures) {
    const copy = bannerCopy('retranscribe-failed', { failures });
    // Con un error visible, el aviso no se muestra (manda el existente): se anuncia a mano.
    const hidden = ctx.banner.current() === 'error';
    ctx.banner.showWarning({
      title: copy.title,
      detail: copy.detail,
      action: {
        label: 'Try again',
        onClick: () => {
          ctx.banner.clear();
          return retryQueue(failures);
        },
      },
    });
    if (hidden) ctx.announce(copy.title);
  }

  function finish(run) {
    run.active = false;
    if (!isLatest(run)) return;

    running = false;
    ctx.setProgress(null);
    ctx.setProcessing(null, null);
    ctx.setQueued([]);
    ctx.refreshAll?.();
    if (run.stale) return;

    if (run.failures.length > 0) {
      reportFailures(run.failures);
      return;
    }
    // Todo descartado o saltado no es «algo hecho»: sin toast de éxito.
    if (run.completed === 0) return;
    ctx.toasts?.show({
      kind: 'success',
      title: `${soundbiteCount(run.completed)} retranscribed.`,
      detail: 'Review them before generating.',
    });
  }

  // Transcribe una entrada y lanza su traducción si sale bien. Devuelve false si la
  // carga cambió y la cola debe pararse.
  async function transcribeEntry(run, entry) {
    run.current = entry.number;
    run.transcribeIndex += 1;
    paintQueued(run);
    updateTranscribeProgress(run);
    paintProcessing(run);

    const result = await ctx.transcribeShot(entry.number, {
      quiet: true,
      language: entry.code,
    });
    run.current = null;

    if (loadToken() !== run.token || result.status === 'stale') {
      run.stale = true;
      run.entries.length = 0;
      return false;
    }
    if (result.status === 'done') {
      run.completed += 1;
      launchTranslation(run, entry.number);
    } else if (result.status === 'failed') {
      run.failures.push({
        number: entry.number,
        step: 'transcribe',
        error: result.error,
        code: entry.code,
      });
    }
    paintQueued(run);
    updateTranslationProgress(run);
    paintProcessing(run);
    return true;
  }

  // Recorre la cola: una transcripción cada vez y, tras cada una, su traducción sin
  // esperarla. Las entradas que llegan durante la marcha se suman a la misma cola.
  async function runWorker(run) {
    try {
      while (true) {
        if (loadToken() !== run.token) {
          run.stale = true;
          run.entries.length = 0;
          break;
        }
        if (run.entries.length === 0) {
          if (run.translationsPending === 0) break;
          await waitChange(run);
          continue;
        }

        const entry = run.entries.shift();
        if (entry.step === 'translate') {
          launchTranslation(run, entry.number, true);
          paintQueued(run);
          updateTranslationProgress(run);
          paintProcessing(run);
          continue;
        }

        if (!(await transcribeEntry(run, entry))) break;
      }
    } finally {
      finish(run);
    }
  }

  function startRun(entries, token) {
    generation += 1;
    const run = createRun(token, entries);
    run.generation = generation;
    currentRun = run;
    running = true;
    ctx.refreshAll?.();

    const verb = entries.every((entry) => entry.step === 'translate')
      ? 'Translating'
      : 'Retranscribing';
    ctx.toasts?.show({
      kind: 'info',
      title: `${verb} ${soundbiteCount(entries.length)} in the background`,
      detail: 'You can keep working.',
    });
    paintQueued(run);
    runWorker(run);
    return run;
  }

  function retryQueue(failures) {
    const entries = failures.map((failure) =>
      failure.step === 'translate'
        ? { number: failure.number, step: 'translate' }
        : { number: failure.number, step: 'transcribe', code: failure.code },
    );
    return startRun(entries, loadToken());
  }

  // Añade un plano a la cola: cambia el código si ya espera y lo repite al final si
  // está en curso (su pasada actual se descartará al no coincidir Language).
  function enqueue(number, code) {
    const token = loadToken();
    const run = currentRun && currentRun.active && currentRun.token === token ? currentRun : null;
    if (!run) {
      startRun([{ number, step: 'transcribe', code }], token);
      return;
    }

    const waiting = run.entries.find(
      (entry) => entry.number === number && entry.step === 'transcribe',
    );
    if (waiting) {
      waiting.code = code;
      updateTranscribeProgress(run);
      return;
    }

    run.entries.push({ number, step: 'transcribe', code });
    run.transcribeTotal += 1;
    updateTranscribeProgress(run);
    paintQueued(run);
    ctx.announce(`Shot ${number} added to the queue`);
    wake(run);
  }

  async function onLanguageCommit(number, previous, value) {
    const shot = shotOf(number);
    if (!shot || !shot.interview) return;
    if (!ctx.transcriberAvailable()) return;
    if (!hasVideo()) return;
    if (shot.soundbite.original.trim() === '') return;

    const code = languageCodeFromName(value);
    const previousCode = languageCodeFromName(previous);
    if (code === null || code === previousCode) return;

    const token = loadToken();
    const languageName = languageNameFromCode(code) ?? value;
    const accepted = await ctx.confirmRetranscribe({ number, languageName });
    if (!accepted || loadToken() !== token) return;
    enqueue(number, code);
  }

  return {
    onLanguageCommit,
    isRunning() {
      return running;
    },
  };
}
