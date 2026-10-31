// Detección automática de entrevistas por duración (15.1): función pura, sin DOM.
// Los cortes de entrevista son los del final de la secuencia; se busca el punto de
// corte que mejor separa planos cortos (imagen) de planos largos (entrevista).

import { INTERVIEW_MIN_SECONDS } from './config.js';

/**
 * Número del primer plano de entrevista detectado, o null si no hay.
 * Puntúa cada corte k: planos anteriores cortos + planos desde k largos.
 * En empate gana el k mayor (menos entrevistas). `shots` va en orden.
 */
export function detectInterviewStart(shots, fps, minSeconds = INTERVIEW_MIN_SECONDS) {
  if (!(fps > 0)) throw new RangeError('fps must be positive');

  const total = shots.length;
  if (total === 0) return null;

  const long = shots.map((shot) => (shot.endFrame - shot.startFrame) / fps >= minSeconds);

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
