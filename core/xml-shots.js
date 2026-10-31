// Lectura de un XML xmeml v4 (Final Cut 7 / Premiere) y comparación con el vídeo.
// Extrae la frecuencia, la duración y los cortes de la primera pista de vídeo con clips activos.
import { XMLParser } from 'fast-xml-parser';

import { fpsFromRate } from './timecode.js';

export class XmlShotsError extends Error {}

const TRANSITIONS_WARNING = 'Transitions found: cut positions near them are approximate.';
const OVERLAP_WARNING = 'Overlapping clips found on the video track: check the edit.';

const INVALID_XML_MESSAGE =
  'The file is not a valid XML. Export it again from the editor as "Final Cut Pro XML".';

// Convierte un valor del XML en entero; devuelve el valor de reserva si no es numérico.
function toInteger(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

// Busca la primera etiqueta 'sequence' en cualquier nivel del árbol parseado.
function findSequence(node) {
  if (!node || typeof node !== 'object') return null;

  if (Array.isArray(node)) {
    for (const item of node) {
      const found = findSequence(item);
      if (found !== null && found !== undefined) return found;
    }
    return null;
  }

  if (node.sequence !== undefined) {
    const sequences = Array.isArray(node.sequence) ? node.sequence : [node.sequence];
    return sequences[0] ?? null;
  }

  for (const value of Object.values(node)) {
    const found = findSequence(value);
    if (found !== null && found !== undefined) return found;
  }
  return null;
}

// Un clipitem está activo si su enabled no es exactamente FALSE.
function isActive(clipitem) {
  return String(clipitem.enabled ?? '').trim().toUpperCase() !== 'FALSE';
}

// Resuelve los -1 de transición: start usa el fin del corte anterior y end el inicio del siguiente.
function resolveCuts(clipitems) {
  let hasTransition = false;

  const cuts = clipitems.map((clipitem) => {
    const startFrame = toInteger(clipitem.start, 0);
    const endFrame = toInteger(clipitem.end, 0);
    if (startFrame === -1 || endFrame === -1) hasTransition = true;
    return { startFrame, endFrame };
  });

  for (let i = 0; i < cuts.length; i += 1) {
    if (cuts[i].startFrame === -1) {
      const previous = cuts[i - 1];
      cuts[i].startFrame = i === 0 ? 0 : previous.endFrame === -1 ? previous.startFrame : previous.endFrame;
    }
  }

  for (let i = cuts.length - 1; i >= 0; i -= 1) {
    if (cuts[i].endFrame === -1) {
      cuts[i].endFrame = i === cuts.length - 1 ? null : cuts[i + 1].startFrame;
    }
  }

  return { cuts, hasTransition };
}

function findVideoTrack(sequence) {
  const tracks = sequence.media?.video?.track ?? [];

  for (let index = 0; index < tracks.length; index += 1) {
    const clipitems = tracks[index].clipitem ?? [];
    if (clipitems.some(isActive)) {
      return { index, clipitems };
    }
  }
  return null;
}

/** @typedef {{ startFrame: number, endFrame: number }} Cut */
/** @typedef {{ fps: number, timebase: number, ntsc: boolean, totalFrames: number,
 *             width: number, height: number, trackIndex: number, cuts: Cut[], warnings: string[] }} ParsedXml */

export function parseXmeml(xmlText) {
  if (typeof xmlText !== 'string' || !xmlText.trimStart().startsWith('<')) {
    throw new XmlShotsError(INVALID_XML_MESSAGE);
  }

  let parsed;
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      parseTagValue: false,
      isArray: (name) => name === 'track' || name === 'clipitem',
    });
    parsed = parser.parse(xmlText);
  } catch {
    throw new XmlShotsError(INVALID_XML_MESSAGE);
  }

  if (!parsed || parsed.xmeml === undefined) {
    throw new XmlShotsError('The file is not a Final Cut / Premiere XML (xmeml).');
  }

  const sequence = findSequence(parsed.xmeml);
  if (sequence === null || sequence === undefined) {
    throw new XmlShotsError('The XML has no sequence. Export the sequence, not the project bin.');
  }

  const timebase = toInteger(sequence.rate?.timebase, NaN);
  if (!Number.isFinite(timebase) || timebase <= 0) {
    throw new XmlShotsError('The XML sequence has no frame rate.');
  }

  const ntsc = String(sequence.rate?.ntsc ?? '').trim().toUpperCase() === 'TRUE';
  const fps = fpsFromRate(timebase, ntsc);
  const totalFrames = toInteger(sequence.duration, 0);

  const characteristics = sequence.media?.video?.format?.samplecharacteristics;
  const width = toInteger(characteristics?.width, 0);
  const height = toInteger(characteristics?.height, 0);

  const videoTrack = findVideoTrack(sequence);
  if (!videoTrack) {
    throw new XmlShotsError('The XML has no video clips on any track.');
  }

  const activeClips = videoTrack.clipitems.filter(isActive);
  const { cuts: resolvedCuts, hasTransition } = resolveCuts(activeClips);

  const cuts = resolvedCuts
    .map((cut) => ({
      startFrame: cut.startFrame,
      endFrame: cut.endFrame === null ? totalFrames : cut.endFrame,
    }))
    .sort((a, b) => a.startFrame - b.startFrame)
    .filter((cut) => cut.endFrame > cut.startFrame);

  let hasOverlap = false;
  let previousEnd = -Infinity;
  for (const cut of cuts) {
    if (cut.startFrame < previousEnd) hasOverlap = true;
    previousEnd = cut.endFrame;
  }

  const warnings = [];
  if (hasTransition) warnings.push(TRANSITIONS_WARNING);
  if (hasOverlap) warnings.push(OVERLAP_WARNING);

  return {
    fps,
    timebase,
    ntsc,
    totalFrames,
    width,
    height,
    trackIndex: videoTrack.index,
    cuts,
    warnings,
  };
}

export { checkVideoMatch } from './video-match.js';
