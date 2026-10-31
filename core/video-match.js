// Comparación de la duración de la secuencia XML con la del vídeo. Módulo aparte de xml-shots
// para que el renderer lo importe sin arrastrar fast-xml-parser.
import { formatDuration } from './timecode.js';
import { MISMATCH_TOLERANCE_SECONDS } from './config.js';

// Devuelve un aviso en inglés si las duraciones difieren más de la tolerancia; null si casan.
export function checkVideoMatch(parsed, videoDurationSeconds) {
  const xmlSeconds = parsed.totalFrames / parsed.fps;
  if (Math.abs(xmlSeconds - videoDurationSeconds) <= MISMATCH_TOLERANCE_SECONDS) {
    return null;
  }
  return (
    `The XML sequence lasts ${formatDuration(xmlSeconds)} but the video lasts ` +
    `${formatDuration(videoDurationSeconds)}. Check that both files belong to the same edit.`
  );
}
