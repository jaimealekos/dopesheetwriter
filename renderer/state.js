// Estado global de la aplicación y utilidades puras del borrador.
// Sin DOM: app.js y los flujos lo comparten.

import { applyAnnotations, exportAnnotations } from '../core/shot-model.js';

// Estado inicial. El flujo de carga va rellenando cada parte.
export function createState() {
  return {
    video: { path: '', name: '', url: '', duration: 0, width: 0, height: 0, loaded: false },
    xml: { path: '', name: '', parsed: null, foundNextToVideo: false },
    header: { location: '', date: '', source: '' },
    shots: [],
    selected: 0,
    showErrors: false,
  };
}

// Borrador que se guarda en userData: anotaciones por inicio-fin y cabecera.
export function buildDraft(state) {
  return { annotations: exportAnnotations(state.shots), header: { ...state.header } };
}

// Aplica las anotaciones del borrador sobre los planos recién creados.
export function applyDraftToShots(shots, draft) {
  if (!draft || typeof draft !== 'object') return shots;
  const annotations = draft.annotations;
  if (!annotations || typeof annotations !== 'object' || Array.isArray(annotations)) return shots;
  return applyAnnotations(shots, annotations);
}

// Cabecera guardada en el borrador, o null si no hay ninguna.
export function draftHeader(draft) {
  if (!draft || typeof draft !== 'object') return null;
  const header = draft.header;
  if (!header || typeof header !== 'object') return null;
  return {
    location: typeof header.location === 'string' ? header.location : '',
    date: typeof header.date === 'string' ? header.date : '',
    source: typeof header.source === 'string' ? header.source : '',
  };
}

// ¿El borrador trae alguna anotación que merezca avisar? 
export function hasAnnotations(draft) {
  return Boolean(
    draft &&
      draft.annotations &&
      typeof draft.annotations === 'object' &&
      Object.keys(draft.annotations).length > 0,
  );
}

// Planos con algún dato anotado (para el detalle del aviso de borrador).
export function countAnnotated(shots) {
  return shots.filter(
    (shot) =>
      shot.size !== '' ||
      shot.movement !== '' ||
      shot.description.trim() !== '' ||
      shot.interview ||
      hasSoundbiteData(shot.soundbite),
  ).length;
}

function hasSoundbiteData(soundbite) {
  if (!soundbite || typeof soundbite !== 'object') return false;
  return (
    soundbite.name !== '' ||
    soundbite.profession !== '' ||
    soundbite.age !== '' ||
    soundbite.gender !== '' ||
    soundbite.translation !== '' ||
    soundbite.original !== ''
  );
}

// Nombre del vídeo sin su última extensión (`Mani tractores.mp4` → `Mani tractores`).
export function videoBase(videoName) {
  const text = String(videoName ?? '');
  const dot = text.lastIndexOf('.');
  return dot > 0 ? text.slice(0, dot) : text;
}

// Nombre del fichero de salida (`Mani tractores.mp4` → `Mani tractores.txt`).
export function textName(videoName) {
  return `${videoBase(videoName)}.txt`;
}

// Carpeta de una ruta, con / o \.
export function folderOf(filePath) {
  const text = String(filePath ?? '');
  const index = Math.max(text.lastIndexOf('/'), text.lastIndexOf('\\'));
  return index === -1 ? '' : text.slice(0, index);
}
