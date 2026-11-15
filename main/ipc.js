// Manejadores IPC del proceso principal. No importa electron: recibe las
// dependencias, de modo que se puede probar sin levantar la aplicación.
import fs from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

import { VIDEO_EXTENSIONS, XML_EXTENSIONS } from '../core/config.js';

// Extensiones sin el punto, como las espera el diálogo de apertura.
function withoutDot(extensions) {
  return extensions.map((extension) => extension.slice(1));
}

// Registra los canales en ipcMain. Envuelve cada resultado en { ok } y nunca
// deja escapar la excepción: el renderer recibe { ok: false, error }.
export function registerIpc(deps) {
  const {
    ipcMain,
    dialog,
    shell,
    storage,
    parseXmeml,
    readFile,
    getWindow,
    translateText,
    transcriber,
    transcriberStatus,
    voiceDetector,
    adjustWindowWidth,
  } = deps;

  function handle(channel, run) {
    ipcMain.handle(channel, async (_event, ...args) => {
      try {
        return { ok: true, value: await run(...args) };
      } catch (error) {
        return { ok: false, error: error?.message ?? String(error) };
      }
    });
  }

  // Abre el diálogo con la ventana como padre cuando existe.
  async function pickFile(kind) {
    let filters;
    if (kind === 'video') {
      filters = [{ name: 'Video', extensions: withoutDot(VIDEO_EXTENSIONS) }];
    } else if (kind === 'xml') {
      filters = [{ name: 'Xml', extensions: withoutDot(XML_EXTENSIONS) }];
    } else {
      throw new Error(`Unknown file kind: ${kind}.`);
    }

    const window = getWindow();
    const result = window
      ? await dialog.showOpenDialog(window, { filters })
      : await dialog.showOpenDialog({ filters });
    return result.canceled ? null : (result.filePaths[0] ?? null);
  }

  handle('dsw:pickFile', pickFile);
  handle('dsw:loadXml', async (xmlPath) => parseXmeml(await readFile(xmlPath, 'utf8')));
  handle('dsw:videoUrl', (videoPath) => pathToFileURL(videoPath).href);
  handle('dsw:findSiblingXml', (videoPath) => storage.findSiblingXml(videoPath));
  handle('dsw:loadSettings', () => storage.loadSettings());
  handle('dsw:saveSettings', async (partial) => {
    await storage.saveSettings(partial);
  });
  handle('dsw:loadDraft', (videoPath) => storage.loadDraft(videoPath));
  handle('dsw:saveDraft', async (videoPath, draft) => {
    await storage.saveDraft(videoPath, draft);
  });
  handle('dsw:shotlistExists', (videoPath) => storage.shotlistExists(videoPath));
  handle('dsw:outputPathFor', (videoPath) => storage.outputPathFor(videoPath));
  handle('dsw:writeShotlist', (videoPath, text) => storage.writeShotlist(videoPath, text));
  handle('dsw:showInFolder', (target) => {
    shell.showItemInFolder(target);
  });
  handle('dsw:fileExists', async (target) => {
    try {
      await fs.access(target);
      return true;
    } catch {
      return false;
    }
  });
  handle('dsw:translate', (text, targetLang) => translateText(text, { targetLang }));
  handle('dsw:transcriberStatus', () => transcriberStatus());
  handle('dsw:transcribe', (videoPath, startSeconds, endSeconds, language) =>
    transcriber.transcribe(videoPath, startSeconds, endSeconds, language),
  );
  handle('dsw:voiceActivity', (videoPath) => voiceDetector.detect(videoPath));
  handle('dsw:adjustWindowWidth', (delta) => {
    if (!Number.isInteger(delta)) {
      throw new Error('delta must be a finite integer.');
    }
    return adjustWindowWidth(delta);
  });
}
