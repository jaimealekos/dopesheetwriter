// Flujo de detección automática de entrevistas (15): al entrar al espacio de trabajo
// con un vídeo y un XML nuevos, propone marcar los cortes finales largos como
// entrevistas y, si se confirma, los transcribe y traduce en segundo plano de uno en uno.

import { detectInterviewStart } from '../core/interview-detect.js';
import { setInterview } from '../core/shot-model.js';
import { bannerCopy, soundbiteCount } from './feedback.js';

// Crea el flujo. `ctx` lo monta app.js con los módulos ya enlazados:
//   state, banner, bannerRegion, toasts, announce, commit, refreshAll,
//   confirmInterviews, transcribeShot, translateShot, transcriberAvailable,
//   setProgress, setProcessing, setQueued.
export function createAutoInterviewsFlow(ctx) {
  const { state } = ctx;
  // La cola confirmada y en marcha (de la confirmación al final).
  let running = false;
  // Número de la última cola: una cola vieja que termina tarde no toca la interfaz
  // de la nueva ni baja su `running`.
  let generation = 0;

  // Identidad de la carga: si cambia el vídeo o el XML, la cola se para en silencio.
  function loadToken() {
    return `${state.video?.path ?? ''}\u0000${state.xml?.path ?? ''}`;
  }

  function reportFailures(failures) {
    const copy = bannerCopy('interview-queue-failed', { failures });
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

  // Recorre la cola: primero las transcripciones, en orden, cada una seguida de su
  // traducción (sin esperarla); después las traducciones que falten. Un fallo no
  // detiene el resto; un cambio de carga la para en silencio.
  async function runQueue(entries, token, queueGeneration) {
    const transcribeEntries = entries.filter((entry) => entry.step === 'transcribe');
    const failures = [];
    const translations = [];
    let translatingNumbers = [];
    let transcribingNumber = null;
    let translationsLaunched = 0;
    let translationsDone = 0;
    let doneSteps = 0;
    let stale = false;

    // Solo la cola más reciente pinta en la interfaz.
    function isLatest() {
      return queueGeneration === generation;
    }

    function setProgress(text) {
      if (isLatest()) ctx.setProgress(text);
    }

    function setQueued(numbers) {
      if (isLatest()) ctx.setQueued(numbers);
    }

    function paintProcessing() {
      if (!isLatest()) return;
      if (transcribingNumber !== null) {
        ctx.setProcessing(transcribingNumber, 'transcribing');
      } else if (translatingNumbers.length > 0) {
        ctx.setProcessing(translatingNumbers[translatingNumbers.length - 1], 'translating');
      } else {
        ctx.setProcessing(null, null);
      }
    }

    // Solo hay fase de traducción con algo pendiente; N es lo realmente lanzado.
    function updateTranslationProgress() {
      if (transcribingNumber !== null) return;
      const pending = translationsLaunched - translationsDone;
      if (pending <= 0) return;
      setProgress(`Translating ${translationsDone + 1} of ${translationsLaunched}\u2026`);
    }

    function launchTranslation(number) {
      translationsLaunched += 1;
      const task = (async () => {
        translatingNumbers = [...translatingNumbers, number];
        paintProcessing();
        const result = await ctx.translateShot(number, { quiet: true });
        translatingNumbers = translatingNumbers.filter((item) => item !== number);
        translationsDone += 1;
        if (result.status === 'done') doneSteps += 1;
        else if (result.status === 'stale') stale = true;
        else if (result.status === 'failed') {
          failures.push({ number, step: 'translate', error: result.error });
        }
        paintProcessing();
        updateTranslationProgress();
      })();
      translations.push(task);
    }

    // Toast inicial de 15.2.1 (y de 15.2.5 en un reintento solo de traducciones).
    const initialVerb = transcribeEntries.length === 0 ? 'Translating' : 'Transcribing';
    ctx.toasts?.show({
      kind: 'info',
      title: `${initialVerb} ${soundbiteCount(entries.length)} in the background`,
      detail: 'You can keep working.',
    });
    setQueued(transcribeEntries.map((entry) => entry.number));

    for (let index = 0; index < transcribeEntries.length; index += 1) {
      if (loadToken() !== token) {
        stale = true;
        break;
      }
      const entry = transcribeEntries[index];
      transcribingNumber = entry.number;
      setProgress(`Transcribing ${index + 1} of ${transcribeEntries.length}\u2026`);
      paintProcessing();

      const result = await ctx.transcribeShot(entry.number, { quiet: true });
      transcribingNumber = null;
      if (result.status === 'stale' || loadToken() !== token) {
        stale = true;
        break;
      }
      if (result.status === 'done') doneSteps += 1;
      if (result.status === 'failed') {
        failures.push({ number: entry.number, step: 'transcribe', error: result.error });
      } else if (result.status === 'done' || result.status === 'skipped') {
        launchTranslation(entry.number);
      }
      setQueued(transcribeEntries.slice(index + 1).map((item) => item.number));
      paintProcessing();
    }

    // Reintento: los planos que fallaron al traducir no vuelven a transcribirse.
    if (!stale) {
      for (const entry of entries) {
        if (entry.step === 'translate') launchTranslation(entry.number);
      }
      updateTranslationProgress();
    }
    await Promise.all(translations);

    // La limpieza es solo de la última cola: una vieja que termina tarde no la pisa.
    if (!isLatest()) return;
    ctx.setProgress(null);
    ctx.setProcessing(null, null);
    ctx.setQueued([]);
    if (stale) return;

    if (failures.length > 0) {
      reportFailures(failures);
      return;
    }
    // Todo saltado o descartado no es «algo hecho»: sin toast de éxito.
    if (doneSteps === 0) return;
    ctx.toasts?.show({
      kind: 'success',
      title: `${soundbiteCount(entries.length)} transcribed and translated.`,
      detail: 'Review them before generating.',
    });
  }

  // Arranca una cola y mantiene `isRunning` mientras la última siga en marcha.
  async function startQueue(entries, token) {
    generation += 1;
    const queueGeneration = generation;
    running = true;
    ctx.refreshAll?.();
    try {
      await runQueue(entries, token, queueGeneration);
    } finally {
      if (queueGeneration === generation) {
        running = false;
        ctx.refreshAll?.();
      }
    }
  }

  async function retryQueue(failures) {
    const entries = failures.map((failure) => ({ number: failure.number, step: failure.step }));
    return startQueue(entries, loadToken());
  }

  // Al entrar al espacio de trabajo: propone y, si se confirma, marca y encola.
  async function onWorkspaceReady({ draftRestored } = {}) {
    if (draftRestored) return;
    if (state.shots.length === 0) return;
    if (state.shots.some((shot) => shot.interview)) return;
    if (!state.xml?.parsed) return;

    const fps = state.xml.parsed.fps;
    const first = detectInterviewStart(state.shots, fps);
    if (first === null) return;

    const token = loadToken();
    const available = ctx.transcriberAvailable();
    const chosen = await ctx.confirmInterviews({
      shots: state.shots,
      fps,
      first,
      transcriberAvailable: available,
    });
    // Clic en «Not interviews» o carga cambiada con el modal abierto: sin cambios.
    if (chosen === null || loadToken() !== token) return;

    state.shots = setInterview(state.shots, chosen, true);
    ctx.commit();
    ctx.refreshAll();
    if (!available) return;

    const numbers = state.shots.filter((shot) => shot.number >= chosen).map((shot) => shot.number);
    await startQueue(
      numbers.map((number) => ({ number, step: 'transcribe' })),
      token,
    );
  }

  return {
    onWorkspaceReady,
    isRunning() {
      return running;
    },
  };
}
