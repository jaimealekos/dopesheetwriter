// Detección automática de entrevistas por duración y voz (15.1): funciones puras, sin DOM.
// Los cortes de entrevista son los del final de la secuencia; se busca el punto de
// corte que mejor separa planos cortos (imagen) de planos largos (entrevista).

import {
  INTERVIEW_MIN_SECONDS,
  INTERVIEW_MIN_VOICE,
  TRANSCRIBE_ESTIMATE_FIXED_SECONDS,
  TRANSCRIBE_ESTIMATE_SECONDS_PER_SECOND,
} from './config.js';

// Une segmentos solapados o desordenados en una lista ordenada y disjunta.
function mergeSegments(segments) {
  const sorted = segments
    .filter((segment) => segment.end > segment.start)
    .map((segment) => ({ start: segment.start, end: segment.end }))
    .sort((a, b) => a.start - b.start);

  const merged = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && segment.start <= last.end) {
      last.end = Math.max(last.end, segment.end);
    } else {
      merged.push(segment);
    }
  }
  return merged;
}

/**
 * Fracción [0,1] de cada corte cubierta por voz. `segments` en segundos del vídeo;
 * pueden solaparse y venir en cualquier orden. Duración 0 → 0.
 */
export function voiceFractions(shots, fps, segments) {
  if (!(fps > 0)) throw new RangeError('fps must be positive');

  const merged = mergeSegments(segments);
  return shots.map((shot) => {
    const start = shot.startFrame / fps;
    const end = shot.endFrame / fps;
    const duration = end - start;
    if (!(duration > 0)) return 0;

    let covered = 0;
    for (const segment of merged) {
      if (segment.end <= start) continue;
      if (segment.start >= end) break;
      covered += Math.min(end, segment.end) - Math.max(start, segment.start);
    }
    return covered / duration;
  });
}

/** ¿Parece entrevista? Duración suficiente y sin voz conocida o con voz suficiente. */
export function looksLikeInterview(
  durationSeconds,
  voice,
  minSeconds = INTERVIEW_MIN_SECONDS,
  minVoice = INTERVIEW_MIN_VOICE,
) {
  if (!(durationSeconds >= minSeconds)) return false;
  return voice === null || voice >= minVoice;
}

// Comprueba fps y que voices (si lo hay) va en paralelo a shots.
function assertInputs(shots, fps, voices) {
  if (!(fps > 0)) throw new RangeError('fps must be positive');
  if (voices !== null && voices.length !== shots.length) {
    throw new RangeError('voices must match shots');
  }
}

/**
 * Número del primer plano de entrevista detectado, o null si no hay.
 * Puntúa cada corte k: planos anteriores cortos + planos desde k largos.
 * En empate gana el k mayor (menos entrevistas). `shots` va en orden.
 * `voices` es un array paralelo a shots (o null): fracción de voz de cada corte.
 */
export function detectInterviewStart(
  shots,
  fps,
  minSeconds = INTERVIEW_MIN_SECONDS,
  voices = null,
  minVoice = INTERVIEW_MIN_VOICE,
) {
  assertInputs(shots, fps, voices);

  const total = shots.length;
  if (total === 0) return null;

  const long = shots.map((shot, index) =>
    looksLikeInterview(
      (shot.endFrame - shot.startFrame) / fps,
      voices?.[index] ?? null,
      minSeconds,
      minVoice,
    ),
  );

  let bestK = total;
  let bestScore = -1;
  for (let k = 0; k <= total; k += 1) {
    let score = 0;
    for (let index = 0; index < total; index += 1) {
      const isLong = long[index];
      if ((index < k && !isLong) || (index >= k && isLong)) score += 1;
    }
    // `>=` para que un empate se quede con el k mayor (menos entrevistas).
    if (score >= bestScore) {
      bestScore = score;
      bestK = k;
    }
  }

  return bestK === total ? null : shots[bestK].number;
}

/**
 * Avisos para un límite `first` (último + 1 si no hay entrevistas), en orden de plano:
 * un largo anterior al límite o una entrevista con voz conocida escasa.
 */
export function interviewNotes(
  shots,
  fps,
  first,
  voices = null,
  minSeconds = INTERVIEW_MIN_SECONDS,
  minVoice = INTERVIEW_MIN_VOICE,
) {
  assertInputs(shots, fps, voices);

  const notes = [];
  shots.forEach((shot, index) => {
    const seconds = (shot.endFrame - shot.startFrame) / fps;
    const voice = voices?.[index] ?? null;

    if (shot.number < first) {
      if (looksLikeInterview(seconds, voice, minSeconds, minVoice)) {
        notes.push({ kind: 'long-image', number: shot.number, seconds, voice });
      }
    } else if (voice !== null && voice < minVoice) {
      notes.push({ kind: 'low-voice', number: shot.number, seconds, voice });
    }
  });

  return notes.sort((a, b) => a.number - b.number);
}

/** Segundos estimados para transcribir cortes de esas duraciones. [] → 0. */
export function estimateTranscriptionSeconds(durationsSeconds) {
  return durationsSeconds.reduce(
    (total, duration) =>
      total + TRANSCRIBE_ESTIMATE_FIXED_SECONDS + TRANSCRIBE_ESTIMATE_SECONDS_PER_SECOND * duration,
    0,
  );
}

/** Texto de la estimación: 0 → ''; menos de un minuto → 'under 1 min'; si no, '≈ N min'. */
export function formatEstimate(seconds) {
  if (seconds <= 0) return '';
  if (seconds < 60) return 'under 1 min';
  return `≈ ${Math.round(seconds / 60)} min`;
}
