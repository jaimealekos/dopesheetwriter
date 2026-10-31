// Módulo storage: todo el acceso a disco de la app (ajustes, borradores, shotlist y XML hermano).
// Corre en el proceso principal, pero no importa electron: recibe el directorio de datos.
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { DEFAULT_LOCATION } from '../core/config.js';

const SETTINGS_FILE = 'settings.json';
const DRAFTS_DIR = 'drafts';

export class StorageError extends Error {}

// Valida que la ruta de vídeo sea una cadena con contenido.
function assertVideoPath(videoPath) {
  if (typeof videoPath !== 'string' || videoPath.trim() === '') {
    throw new StorageError('A video path is required.');
  }
}

// Clave SHA-1 estable: la misma ruta con otra capitalización produce el mismo borrador.
function draftKey(videoPath) {
  return createHash('sha1').update(path.resolve(videoPath).toLowerCase()).digest('hex');
}

// Escribe en <destino>.tmp y lo renombra encima; ante fallo borra el temporal y propaga el motivo.
async function writeFileAtomic(target, data) {
  const tmpPath = `${target}.tmp`;
  try {
    await fs.writeFile(tmpPath, data);
    await fs.rename(tmpPath, target);
  } catch (cause) {
    try {
      await fs.rm(tmpPath, { force: true });
    } catch (cleanupCause) {
      console.warn(`Could not remove the temporary file ${tmpPath}: ${cleanupCause.message}.`);
    }
    throw cause;
  }
}

export function createStorage(dataDir) {
  const settingsPath = path.join(dataDir, SETTINGS_FILE);

  function draftPath(videoPath) {
    return path.join(dataDir, DRAFTS_DIR, `${draftKey(videoPath)}.json`);
  }

  async function loadSettings() {
    let raw;
    try {
      raw = await fs.readFile(settingsPath, 'utf8');
    } catch (cause) {
      if (cause.code !== 'ENOENT') {
        console.warn(`Could not read settings: ${cause.message}.`);
      }
      return { location: DEFAULT_LOCATION, source: '' };
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      console.warn(`Could not parse settings: ${cause.message}.`);
      return { location: DEFAULT_LOCATION, source: '' };
    }
    if (parsed === null || typeof parsed !== 'object') {
      console.warn('Could not parse settings: the file does not contain an object.');
      return { location: DEFAULT_LOCATION, source: '' };
    }
    return {
      location: typeof parsed.location === 'string' ? parsed.location : DEFAULT_LOCATION,
      source: typeof parsed.source === 'string' ? parsed.source : '',
    };
  }

  async function saveSettings(partial) {
    const current = await loadSettings();
    const next = {
      location: typeof partial?.location === 'string' ? partial.location : current.location,
      source: typeof partial?.source === 'string' ? partial.source : current.source,
    };
    try {
      await writeFileAtomic(settingsPath, JSON.stringify(next));
    } catch (cause) {
      throw new StorageError(`Could not save settings: ${cause.message}.`);
    }
  }

  async function loadDraft(videoPath) {
    assertVideoPath(videoPath);
    let raw;
    try {
      raw = await fs.readFile(draftPath(videoPath), 'utf8');
    } catch (cause) {
      if (cause.code !== 'ENOENT') {
        console.warn(`Could not read the draft: ${cause.message}.`);
      }
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch (cause) {
      console.warn(`Could not parse the draft: ${cause.message}.`);
      return null;
    }
  }

  async function saveDraft(videoPath, draft) {
    assertVideoPath(videoPath);
    try {
      await fs.mkdir(path.join(dataDir, DRAFTS_DIR), { recursive: true });
      await writeFileAtomic(draftPath(videoPath), JSON.stringify(draft));
    } catch (cause) {
      throw new StorageError(`Could not save draft: ${cause.message}.`);
    }
  }

  function outputPathFor(videoPath) {
    assertVideoPath(videoPath);
    const base = path.basename(videoPath, path.extname(videoPath));
    return path.join(path.dirname(videoPath), `${base}.txt`);
  }

  async function shotlistExists(videoPath) {
    assertVideoPath(videoPath);
    try {
      await fs.access(outputPathFor(videoPath));
      return true;
    } catch {
      return false;
    }
  }

  async function writeShotlist(videoPath, text) {
    assertVideoPath(videoPath);
    const target = outputPathFor(videoPath);
    try {
      await writeFileAtomic(target, Buffer.from(`\uFEFF${text}`, 'utf8'));
    } catch (cause) {
      throw new StorageError(
        `Could not save ${target}: ${cause.message}. Check that the folder is writable and that the file is not open in another program.`,
      );
    }
    return target;
  }

  async function findSiblingXml(videoPath) {
    assertVideoPath(videoPath);
    const dir = path.dirname(videoPath);
    const base = path.basename(videoPath, path.extname(videoPath)).toLowerCase();

    let entries;
    try {
      entries = await fs.readdir(dir);
    } catch (cause) {
      throw new StorageError(`Could not read the folder of ${videoPath}: ${cause.message}.`);
    }

    const match = entries.find((entry) => entry.toLowerCase() === `${base}.xml`);
    return match ? path.join(dir, match) : null;
  }

  return {
    loadSettings,
    saveSettings,
    loadDraft,
    saveDraft,
    outputPathFor,
    shotlistExists,
    writeShotlist,
    findSiblingXml,
  };
}
