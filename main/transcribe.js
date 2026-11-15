// Transcripción local de un tramo de vídeo con ffmpeg + whisper.cpp (como Hispatrans).
// Corre en el proceso principal. Solo usa módulos de node: no importa electron.
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  TRANSCRIBER_FILES,
  TRANSCRIBE_BEAM_SIZE,
  TRANSCRIBE_MAX_SECONDS,
  TRANSCRIBE_TIMEOUT_MS,
  TRANSCRIBE_VAD,
} from '../core/config.js';
import { LANGUAGE_NAMES, languageNameFromCode } from '../core/languages.js';

// Tope del buffer de salida de cada proceso hijo (16 MiB).
const MAX_BUFFER_BYTES = 16 * 1024 * 1024;

// Rutas absolutas de las herramientas a partir de la carpeta base.
export function resolveTranscriberPaths(baseDir) {
  return Object.fromEntries(
    Object.entries(TRANSCRIBER_FILES).map(([key, relative]) => [key, path.join(baseDir, relative)]),
  );
}

// Comprueba que existen todas las herramientas; missing lleva las rutas que faltan.
// La herramienta de voz es opcional: available no depende de ella.
export async function transcriberStatus(paths, options = {}) {
  const access = options.access ?? fs.access;
  const missing = [];
  for (const key of Object.keys(TRANSCRIBER_FILES)) {
    try {
      await access(paths[key]);
    } catch {
      missing.push(paths[key]);
    }
  }
  const available = missing.length === 0;
  let voiceAvailable = false;
  if (available && typeof paths.voiceTool === 'string' && paths.voiceTool !== '') {
    try {
      await access(paths.voiceTool);
      voiceAvailable = true;
    } catch {
      voiceAvailable = false;
    }
  }
  return { available, missing, voiceAvailable };
}

// Segundos con tres decimales, como los espera ffmpeg.
function seconds(value) {
  return value.toFixed(3);
}

export function buildFfmpegArgs(videoPath, startSeconds, endSeconds, wavPath) {
  return [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-ss', seconds(startSeconds),
    '-t', seconds(endSeconds - startSeconds),
    '-i', videoPath,
    '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
    '-y', wavPath,
  ];
}

export function buildWhisperArgs(paths, wavPath, outBase, threads, language = null) {
  return [
    '-m', paths.model,
    '-f', wavPath,
    '-l', language ?? 'auto',
    '-t', String(threads),
    '-bs', String(TRANSCRIBE_BEAM_SIZE),
    '--vad', '-vm', paths.vadModel,
    '-vt', String(TRANSCRIBE_VAD.threshold),
    '-vspd', String(TRANSCRIBE_VAD.minSpeechMs),
    '-vsd', String(TRANSCRIBE_VAD.minSilenceMs),
    '-vp', String(TRANSCRIBE_VAD.speechPadMs),
    '-oj', '-of', outBase,
    '-np',
  ];
}

// Texto y idioma detectado a partir del JSON que escribe whisper-cli.
export function parseWhisperJson(json) {
  if (!Array.isArray(json?.transcription)) {
    throw new Error('Unexpected transcriber output.');
  }
  const text = json.transcription
    .map((segment) => String(segment?.text ?? '').trim())
    .filter((piece) => piece !== '')
    .join(' ')
    .replace(/\s+/g, ' ');
  const language = json.result?.language;
  const detected = typeof language === 'string' && language !== '' && language !== 'auto';
  return { text, language: detected ? language : null };
}

// Ejecuta un proceso: el código de salida distinto de 0 resuelve; solo rechaza por
// tiempo agotado o si el ejecutable no arranca.
export function defaultRunProcess(command, args, { timeoutMs }) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { windowsHide: true, timeout: timeoutMs, maxBuffer: MAX_BUFFER_BYTES },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ code: 0, stdout, stderr });
        } else if (typeof error.code === 'number' && !error.killed) {
          resolve({ code: error.code, stdout, stderr });
        } else {
          reject(error);
        }
      },
    );
  });
}

// Última línea no vacía de una salida de error.
export function lastLine(stderr) {
  const lines = String(stderr ?? '').split(/\r?\n/).filter((line) => line.trim() !== '');
  return lines.length > 0 ? lines[lines.length - 1].trim() : 'no output';
}

function validateRange(videoPath, startSeconds, endSeconds) {
  const valid =
    typeof videoPath === 'string' &&
    videoPath !== '' &&
    Number.isFinite(startSeconds) &&
    Number.isFinite(endSeconds) &&
    startSeconds >= 0 &&
    startSeconds < endSeconds;
  if (!valid) {
    throw new RangeError('Invalid cut range.');
  }
  if (endSeconds - startSeconds > TRANSCRIBE_MAX_SECONDS) {
    throw new Error('The cut is too long to transcribe (max 10 minutes).');
  }
}

// `language` es null (autodetección) o una clave de LANGUAGE_NAMES; lo demás es RangeError.
function validateLanguage(language) {
  if (language === null) {
    return null;
  }
  if (typeof language === 'string' && Object.hasOwn(LANGUAGE_NAMES, language)) {
    return language;
  }
  throw new RangeError(`Unsupported transcription language: ${language}.`);
}

export function createTranscriber({ paths, runProcess, tmpRoot, threads, readFile }) {
  const run = runProcess ?? defaultRunProcess;
  const read = readFile ?? ((file) => fs.readFile(file, 'utf8'));
  const threadCount = threads ?? Math.max(1, Math.floor(os.availableParallelism() / 2));
  let busy = false;

  // Lanza un proceso; un tiempo agotado se informa claro, otros fallos se relanzan.
  async function runTool(command, args) {
    try {
      return await run(command, args, { timeoutMs: TRANSCRIBE_TIMEOUT_MS });
    } catch (cause) {
      if (cause?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
        throw new Error('A transcription process produced too much output and was stopped.');
      }
      if (cause?.code === 'ETIMEDOUT' || cause?.killed) {
        throw new Error('Transcription took too long and was stopped.');
      }
      throw cause;
    }
  }

  async function extractAudio(videoPath, startSeconds, endSeconds, wavPath) {
    const result = await runTool(paths.ffmpeg, buildFfmpegArgs(videoPath, startSeconds, endSeconds, wavPath));
    if (result.code === 0) {
      return;
    }
    if (String(result.stderr).includes('matches no streams')) {
      throw new Error('This video has no audio track to transcribe.');
    }
    throw new Error(`Could not extract the audio of this cut (ffmpeg: ${lastLine(result.stderr)}).`);
  }

  async function runWhisper(wavPath, outBase, language) {
    const result = await runTool(
      paths.whisper,
      buildWhisperArgs(paths, wavPath, outBase, threadCount, language),
    );
    if (result.code !== 0) {
      throw new Error(`The transcriber failed (${lastLine(result.stderr)}).`);
    }
    let json;
    try {
      json = JSON.parse(await read(`${outBase}.json`));
    } catch {
      throw new Error('Unexpected transcriber output.');
    }
    return parseWhisperJson(json);
  }

  async function transcribeInTempDir(videoPath, startSeconds, endSeconds, language) {
    const status = await transcriberStatus(paths);
    if (!status.available) {
      throw new Error(
        `Transcription is not installed: missing ${status.missing.join(', ')}. Reinstall Dopesheet Writer.`,
      );
    }

    const dir = await fs.mkdtemp(path.join(tmpRoot ?? os.tmpdir(), 'dsw-transcribe-'));
    try {
      const wavPath = path.join(dir, 'cut.wav');
      await extractAudio(videoPath, startSeconds, endSeconds, wavPath);
      const detected = await runWhisper(wavPath, path.join(dir, 'cut'), language);
      if (detected.text === '') {
        throw new Error('No speech found in this cut.');
      }
      // Con idioma forzado manda el pedido, no el que diga el JSON.
      const used = language ?? detected.language;
      return { text: detected.text, language: used, languageName: languageNameFromCode(used) };
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  return {
    async transcribe(videoPath, startSeconds, endSeconds, language = null) {
      validateRange(videoPath, startSeconds, endSeconds);
      const forced = validateLanguage(language);
      if (busy) {
        throw new Error('Another cut is being transcribed. Wait for it to finish.');
      }
      busy = true;
      try {
        return await transcribeInTempDir(videoPath, startSeconds, endSeconds, forced);
      } finally {
        busy = false;
      }
    },
  };
}
