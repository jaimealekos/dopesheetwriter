// Flujo de entrevistas (15 y 17): al entrar al espacio de trabajo con un vídeo y
// un XML nuevos, detecta por duración y voz qué cortes finales son entrevistas y
// abre el selector gráfico; también lo abre a mano desde la barra superior. Con lo
// elegido marca los planos y encola la transcripción y la traducción en segundo
// plano, de uno en uno.

import { INTERVIEW_MIN_SECONDS } from '../core/config.js';
import { detectInterviewStart, voiceFractions } from '../core/interview-detect.js';
import { languageNameFromCode } from '../core/languages.js';
import { setInterview, updateShot } from '../core/shot-model.js';
import { bannerCopy, soundbiteCount } from './feedback.js';

// Crea el flujo. `ctx` lo monta app.js con los módulos ya enlazados:
//   state, banner, bannerRegion, toasts, announce, commit, refreshAll,
//   openPicker, voiceActivity, voiceAvailable, transcribeShot, translateShot,
//   transcriberAvailable, setProgress, setProcessing, setQueued.
export function createAutoInterviewsFlow(ctx) {
  const { state } = ctx;
  // La cola confirmada y en marcha (de la confirmación al final).
  let running = false;
  // El selector está en marcha: de la detección de voz hasta que se cierra.
  let picking = false;
  // Número de la última cola: una cola vieja que termina tarde no toca la interfaz
  // de la nueva ni baja su `running`.
  let generation = 0;
  // Fracciones de voz ya calculadas para una carga (se reutilizan en el modo manual).
  let voicesCache = null;
  // Detección de voz en curso, para no lanzar dos por la misma carga.
  let voicesPending = null;

  // Identidad de la carga: si cambia el vídeo o el XML, la cola se para en silencio.
  function loadToken() {
    return `${state.video?.path ?? ''}\u0000${state.xml?.path ?? ''}`;
  }

  function lastNumber() {
    return state.shots.length > 0 ? state.shots[state.shots.length - 1].number : 0;
  }

  function beginPicking() {
    picking = true;
    ctx.refreshAll?.();
  }

  function endPicking() {
    if (!picking) return;
    picking = false;
    ctx.refreshAll?.();
  }

  // Fracciones de voz de la carga actual. Sin herramienta o con error de la
  // herramienta, `null`: la detección sigue por duración y no se avisa al usuario.
  async function voicesFor(token) {
    if (voicesCache && voicesCache.token === token) return voicesCache.voices;
    if (voicesPending && voicesPending.token === token) return voicesPending.promise;
    if (!ctx.voiceAvailable()) return null;

    const promise = (async () => {
      let segments;
      try {
        segments = await ctx.voiceActivity(state.video.path);
      } catch (error) {
        console.warn(`Could not detect the speech in the video: ${error.message}`);
        return null;
      }
      return voiceFractions(state.shots, state.xml.parsed.fps, segments);
    })();

    voicesPending = { token, promise };
    try {
      const voices = await promise;
      voicesCache = { token, voices };
      return voices;
    } finally {
      if (voicesPending && voicesPending.promise === promise) voicesPending = null;
    }
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

      const transcribeOptions = entry.code
        ? { quiet: true, language: entry.code }
        : { quiet: true };
      const result = await ctx.transcribeShot(entry.number, transcribeOptions);
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

  // Aplica el límite y las marcas del selector y, con lo elegido, arranca la cola.
  async function applyResult(result, token) {
    if (result === null || loadToken() !== token) return;

    const languageNames = new Map();
    for (const number of result.transcribe) {
      const code = result.languages?.[number] ?? null;
      if (code === null) continue;
      const name = languageNameFromCode(code);
      if (name === null) throw new Error(`Unknown language code "${code}".`);
      languageNames.set(number, name);
    }

    const last = lastNumber();
    if (result.first > 1) state.shots = setInterview(state.shots, result.first - 1, false);
    if (result.first <= last) state.shots = setInterview(state.shots, result.first, true);
    for (const [number, name] of languageNames) {
      state.shots = updateShot(state.shots, number, { soundbite: { language: name } });
    }

    ctx.commit();
    ctx.refreshAll();
    if (result.transcribe.length === 0) return;
    if (!ctx.transcriberAvailable()) return;

    const entries = result.transcribe.map((number) => ({
      number,
      step: 'transcribe',
      code: result.languages?.[number] ?? null,
    }));
    await startQueue(entries, token);
  }

  // Abre el selector y aplica lo elegido. Al cerrarse el selector termina la espera.
  async function openPickerFor(first, voices, available, token, mode) {
    const result = await ctx.openPicker({
      shots: state.shots,
      fps: state.xml.parsed.fps,
      first,
      voices,
      transcriberAvailable: available,
      mode,
    });
    endPicking();
    await applyResult(result, token);
  }

  // Al entrar al espacio de trabajo: propone y, si se confirma, marca y encola.
  async function onWorkspaceReady({ draftRestored } = {}) {
    if (picking) return;
    if (draftRestored) return;
    if (state.shots.length === 0) return;
    if (state.shots.some((shot) => shot.interview)) return;
    if (!state.xml?.parsed) return;

    const token = loadToken();
    const available = ctx.transcriberAvailable();
    beginPicking();
    try {
      const voices = await voicesFor(token);
      if (loadToken() !== token) return;

      const first = detectInterviewStart(
        state.shots,
        state.xml.parsed.fps,
        INTERVIEW_MIN_SECONDS,
        voices,
      );
      if (first === null) return;

      await openPickerFor(first, voices, available, token, 'auto');
    } finally {
      endPicking();
    }
  }

  // Botón «Interviews…» y Alt+I: abre el selector sobre la secuencia actual.
  async function openManual() {
    if (running || picking) return;
    if (state.shots.length === 0 || !state.xml?.parsed) return;

    const token = loadToken();
    const available = ctx.transcriberAvailable();
    beginPicking();
    try {
      const voices = await voicesFor(token);
      if (loadToken() !== token) return;

      const current = state.shots.find((shot) => shot.interview);
      const detected = current
        ? current.number
        : detectInterviewStart(
            state.shots,
            state.xml.parsed.fps,
            INTERVIEW_MIN_SECONDS,
            voices,
          );
      const first = detected ?? lastNumber() + 1;

      await openPickerFor(first, voices, available, token, 'manual');
    } finally {
      endPicking();
    }
  }

  return {
    onWorkspaceReady,
    openManual,
    isRunning() {
      return running;
    },
    isPicking() {
      return picking;
    },
  };
}
