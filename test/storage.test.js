// Pruebas del módulo storage. Sin red, con directorio temporal propio por prueba.
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createStorage, StorageError } from '../main/storage.js';
import { DEFAULT_LOCATION } from '../core/config.js';

// Crea un directorio de datos temporal y lo borra al acabar la prueba.
async function makeDataDir(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'dopesheet-storage-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}

// Sustituye console.warn por un espía durante la prueba.
function spyConsoleWarn(t) {
  const warnings = [];
  const original = console.warn;
  console.warn = (message) => warnings.push(message);
  t.after(() => {
    console.warn = original;
  });
  return warnings;
}

test('loadSettings: sin fichero devuelve los valores por defecto', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);

  assert.deepEqual(await storage.loadSettings(), { location: DEFAULT_LOCATION, source: '' });
});

test('loadSettings: campos ausentes o no cadena se sustituyen por el defecto', async (t) => {
  const dir = await makeDataDir(t);
  await writeFile(
    path.join(dir, 'settings.json'),
    JSON.stringify({ location: 42, source: 'AFPTV', extra: true }),
  );
  const storage = createStorage(dir);

  assert.deepEqual(await storage.loadSettings(), { location: DEFAULT_LOCATION, source: 'AFPTV' });
});

test('saveSettings: fusiona parciales y conserva lo no enviado', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);

  await storage.saveSettings({ source: 'AFPTV' });
  assert.deepEqual(await storage.loadSettings(), { location: DEFAULT_LOCATION, source: 'AFPTV' });

  await storage.saveSettings({ location: 'PARIS, FRANCE' });
  assert.deepEqual(await storage.loadSettings(), { location: 'PARIS, FRANCE', source: 'AFPTV' });
});

test('loadSettings: JSON corrupto avisa y devuelve los valores por defecto', async (t) => {
  const dir = await makeDataDir(t);
  await writeFile(path.join(dir, 'settings.json'), '{ esto no es JSON');
  const warnings = spyConsoleWarn(t);
  const storage = createStorage(dir);

  assert.deepEqual(await storage.loadSettings(), { location: DEFAULT_LOCATION, source: '' });
  assert.equal(warnings.length, 1);
});

test('saveDraft y loadDraft: ida y vuelta, ruta distinta y capitalización', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);
  const video = path.join(dir, 'videos', 'Mani.mp4');
  const draft = { notes: 'hola', shots: [1, 2, 3] };

  assert.equal(await storage.loadDraft(video), null);

  await storage.saveDraft(video, draft);
  assert.deepEqual(await storage.loadDraft(video), draft);
  assert.deepEqual(await storage.loadDraft(video.toUpperCase()), draft);
  assert.equal(await storage.loadDraft(path.join(dir, 'videos', 'Otro.mp4')), null);
});

test('loadDraft: fichero corrupto avisa y devuelve null', async (t) => {
  const dir = await makeDataDir(t);
  const video = path.join(dir, 'Mani.mp4');
  const key = createHash('sha1').update(path.resolve(video).toLowerCase()).digest('hex');
  await mkdir(path.join(dir, 'drafts'), { recursive: true });
  await writeFile(path.join(dir, 'drafts', `${key}.json`), 'no-json');
  const warnings = spyConsoleWarn(t);
  const storage = createStorage(dir);

  assert.equal(await storage.loadDraft(video), null);
  assert.equal(warnings.length, 1);
});

test('outputPathFor: misma carpeta y nombre base con extensión .txt', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);

  const video = path.join(dir, 'Manifestación Sanidad.mp4');
  assert.equal(storage.outputPathFor(video), path.join(dir, 'Manifestación Sanidad.txt'));

  const nested = path.join(dir, 'sub', 'clip.mov');
  assert.equal(storage.outputPathFor(nested), path.join(dir, 'sub', 'clip.txt'));
});

test('writeShotlist: BOM UTF-8, sobrescritura y sin temporales', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);
  const video = path.join(dir, 'Manifestación Sanidad.mp4');

  assert.equal(await storage.shotlistExists(video), false);

  const written = await storage.writeShotlist(video, 'Plano ñ é');
  assert.equal(written, path.join(dir, 'Manifestación Sanidad.txt'));

  const bytes = await readFile(written);
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.equal(bytes.subarray(3).toString('utf8'), 'Plano ñ é');
  assert.equal(await storage.shotlistExists(video), true);

  await storage.writeShotlist(video, 'Otro texto');
  assert.equal((await readFile(written)).subarray(3).toString('utf8'), 'Otro texto');

  const entries = await readdir(dir);
  assert.deepEqual(entries.filter((entry) => entry.endsWith('.tmp')), []);
});

test('writeShotlist: carpeta inexistente lanza StorageError', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);
  const video = path.join(dir, 'no-existe', 'video.mp4');

  await assert.rejects(
    () => storage.writeShotlist(video, 'texto'),
    (error) => {
      assert.ok(error instanceof StorageError);
      assert.match(
        error.message,
        /^Could not save .+\. Check that the folder is writable and that the file is not open in another program\.$/,
      );
      return true;
    },
  );
});

test('writeShotlist: destino convertido en directorio lanza StorageError sin tocar el destino', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);
  const video = path.join(dir, 'video.mp4');
  const target = storage.outputPathFor(video);
  await mkdir(target, { recursive: true });

  await assert.rejects(() => storage.writeShotlist(video, 'texto'), StorageError);

  assert.ok((await stat(target)).isDirectory());
  const entries = await readdir(dir);
  assert.deepEqual(entries.filter((entry) => entry.endsWith('.tmp')), []);
});

test('errores: mensajes exactos de ajustes, borrador y carpeta de findSiblingXml', async (t) => {
  spyConsoleWarn(t);

  // saveSettings: settings.json convertido en directorio → falla el rename.
  const settingsDir = await makeDataDir(t);
  await mkdir(path.join(settingsDir, 'settings.json'), { recursive: true });
  const settingsStorage = createStorage(settingsDir);
  await assert.rejects(
    () => settingsStorage.saveSettings({ source: 'AFPTV' }),
    (error) => {
      assert.ok(error instanceof StorageError);
      assert.match(error.message, /^Could not save settings: .+\.$/);
      return true;
    },
  );

  // saveDraft: drafts convertido en fichero → falla la creación de la carpeta.
  const draftDir = await makeDataDir(t);
  await writeFile(path.join(draftDir, 'drafts'), 'no soy un directorio');
  const draftStorage = createStorage(draftDir);
  await assert.rejects(
    () => draftStorage.saveDraft(path.join(draftDir, 'v.mp4'), { a: 1 }),
    (error) => {
      assert.ok(error instanceof StorageError);
      assert.match(error.message, /^Could not save draft: .+\.$/);
      return true;
    },
  );

  // findSiblingXml: carpeta del vídeo inexistente.
  const xmlDir = await makeDataDir(t);
  const xmlStorage = createStorage(xmlDir);
  await assert.rejects(
    () => xmlStorage.findSiblingXml(path.join(xmlDir, 'missing', 'v.mp4')),
    (error) => {
      assert.ok(error instanceof StorageError);
      assert.match(error.message, /^Could not read the folder of .+: .+\.$/);
      return true;
    },
  );
});

test('findSiblingXml: encuentra el XML hermano sin importar mayúsculas', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);
  const video = path.join(dir, 'video.mp4');
  await writeFile(path.join(dir, 'Video.XML'), '<x/>');

  assert.equal(await storage.findSiblingXml(video), path.join(dir, 'Video.XML'));
  assert.equal(await storage.findSiblingXml(path.join(dir, 'otro.mp4')), null);
  await assert.rejects(
    () => storage.findSiblingXml(path.join(dir, 'missing', 'video.mp4')),
    StorageError,
  );
});

test('videoPath vacío o no cadena lanza StorageError en cualquier función', async (t) => {
  const dir = await makeDataDir(t);
  const storage = createStorage(dir);

  assert.throws(() => storage.outputPathFor(''), /A video path is required\./);
  assert.throws(() => storage.outputPathFor(null), /A video path is required\./);
  await assert.rejects(() => storage.loadDraft(''), /A video path is required\./);
  await assert.rejects(() => storage.saveDraft('', {}), /A video path is required\./);
  await assert.rejects(() => storage.shotlistExists('   '), /A video path is required\./);
  await assert.rejects(() => storage.writeShotlist('', 'texto'), /A video path is required\./);
  await assert.rejects(() => storage.findSiblingXml(''), /A video path is required\./);
});
