// Arranque del proceso principal de Electron: ventana, seguridad, menú y registros IPC.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { app, BrowserWindow, Menu, dialog, ipcMain, screen, session, shell } from 'electron';

import { SPELLCHECK_LANGUAGES, TRANSCRIBER_DIR_NAME } from '../core/config.js';
import { parseXmeml } from '../core/xml-shots.js';
import { registerIpc } from './ipc.js';
import { chooseSpellcheckLanguages } from './spellcheck.js';
import { createStorage } from './storage.js';
import { createTranscriber, resolveTranscriberPaths, transcriberStatus } from './transcribe.js';
import { translateText } from './translate.js';
import { computeWidthChange } from './window-width.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));

// Color de fondo: --color-bg del tema oscuro de docs/DISENO-GRAFICO.md.
const BACKGROUND_COLOR = '#0e0f11';

// Tamaño inicial y mínimo de la ventana principal.
const WINDOW_WIDTH = 1760;
const WINDOW_HEIGHT = 900;
const MIN_WIDTH = 1280;
const MIN_HEIGHT = 700;

let mainWindow;

// Carpeta de herramientas de transcripción: en recursos si está empaquetada; si no, vendor/ del repo.
function transcriberBaseDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, TRANSCRIBER_DIR_NAME)
    : path.join(dirname, '..', 'vendor', TRANSCRIBER_DIR_NAME);
}

// Ensancha/estrecha la ventana según delta; devuelve el delta realmente aplicado.
function adjustWindowWidth(delta) {
  const win = mainWindow;
  if (!win || win.isMaximized() || win.isFullScreen() || win.isMinimized()) {
    return 0;
  }

  const { workArea } = screen.getDisplayMatching(win.getBounds());
  const { applied, bounds } = computeWidthChange({
    bounds: win.getBounds(),
    workArea,
    delta,
    minWidth: MIN_WIDTH,
  });
  win.setBounds(bounds, false);
  return applied;
}

// Crea la ventana principal, endurece la navegación y carga el renderer.
function createWindow() {
  const { workAreaSize } = screen.getPrimaryDisplay();

  mainWindow = new BrowserWindow({
    width: Math.min(WINDOW_WIDTH, workAreaSize.width),
    height: Math.min(WINDOW_HEIGHT, workAreaSize.height),
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    show: false,
    backgroundColor: BACKGROUND_COLOR,
    title: 'Dopesheet Writer',
    webPreferences: {
      preload: path.join(dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());
  mainWindow.loadFile(path.join(dirname, '..', 'renderer', 'index.html'));

  return mainWindow;
}

// Menú mínimo en macOS para copiar/pegar; en el resto, sin menú.
function applyMenu() {
  if (process.platform === 'darwin') {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ role: 'appMenu' }, { role: 'editMenu' }]));
  } else {
    Menu.setApplicationMenu(null);
  }
}

// Fija el corrector ortográfico en los idiomas de SPELLCHECK_LANGUAGES que Electron
// tenga instalados. Si no hay ninguno, avisa y deja el corrector por defecto.
function applySpellcheck() {
  const available = session.defaultSession.availableSpellCheckerLanguages;
  const languages = chooseSpellcheckLanguages(SPELLCHECK_LANGUAGES, available);
  if (languages.length === 0) {
    console.warn(
      `Spellcheck: none of the configured languages (${SPELLCHECK_LANGUAGES.join(', ')}) ` +
        `is available; available: ${available.join(', ') || 'none'}.`,
    );
    return;
  }
  session.defaultSession.setSpellCheckerLanguages(languages);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) {
        mainWindow.restore();
      }
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    const transcriberPaths = resolveTranscriberPaths(transcriberBaseDir());
    registerIpc({
      ipcMain,
      dialog,
      shell,
      storage: createStorage(app.getPath('userData')),
      parseXmeml,
      readFile,
      getWindow: () => mainWindow,
      translateText,
      transcriber: createTranscriber({ paths: transcriberPaths }),
      transcriberStatus: () => transcriberStatus(transcriberPaths),
      adjustWindowWidth,
    });

    session.defaultSession.setPermissionRequestHandler((_window, _permission, callback) => callback(false));
    applySpellcheck();
    applyMenu();
    createWindow();

    if (process.env.DSW_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools();
    }
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
