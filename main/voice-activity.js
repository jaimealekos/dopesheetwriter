// Detección de voz de un vídeo entero con ffmpeg + whisper-vad-speech-segments.
// Corre en el proceso principal. Solo usa módulos de node: no importa electron.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { VOICE_TIMEOUT_MS, VOICE_VAD } from '../core/config.js';
import { defaultRunProcess, lastLine } from './transcribe.js';

// Línea de la herramienta: «Speech segment <i>: start = <cs>, end = <cs>» en centisegundos.
const SEGMENT_LINE = /^\s*Speech segment \d+: start = (\d+(?:\.\d+)?), end = (\d+(?:\.\d+)?)\s*$/;

export function buildVoiceFfmpegArgs(videoPath, wavPath) {
  return [
    '-nostdin', '-hide_banner', '-loglevel', 'error',
    '-i', videoPath,
    '-map', '0:a:0', '-vn', '-sn', '-dn',
    '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le',
    '-y', wavPath,
  ];
}

export function buildVoiceToolArgs(paths, wavPath, threads) {
  return [
    '-np', '-t', String(threads),
    '-vm', paths.vadModel,
    '-vt', String(VOICE_VAD.threshold),
    '-vspd', String(VOICE_VAD.minSpeechMs),
    '-vsd', String(VOICE_VAD.minSilenceMs),
    '-vp', String(VOICE_VAD.speechPadMs),
    '-f', wavPath,
  ];
}

// Segmentos de voz en segundos; ignora las líneas que no son de segmento.
export function parseVoiceSegments(stdout) {
  const segments = [];
  for (const line of String(stdout ?? '').split(/\r?\n/)) {
    const match = SEGMENT_LINE.exec(line);
    if (!match) {
      continue;
    }
    const start = Number(match[1]) / 100;
    const end = Number(match[2]) / 100;
    if (end < start) {
      throw new Error('Unexpected voice detector output.');
    }
    segments.push({ start, end });
  }
  return segments;
}

export function createVoiceDetector({ paths, runProcess, tmpRoot, threads }) {
  const run = runProcess ?? defaultRunProcess;
  const threadCount = threads ?? Math.max(1, Math.floor(os.availableParallelism() / 2));

  // Lanza un proceso; un tiempo agotado se informa claro, otros fallos se relanzan.
  async function runTool(command, args) {
    try {
      return await run(command, args, { timeoutMs: VOICE_TIMEOUT_MS });
    } catch (cause) {
      if (cause?.code === 'ETIMEDOUT' || cause?.killed) {
        throw new Error('Voice detection took too long and was stopped.');
      }
      throw cause;
    }
  }

  async function detectInTempDir(videoPath) {
    const dir = await fs.mkdtemp(path.join(tmpRoot ?? os.tmpdir(), 'dsw-voice-'));
    try {
      const wavPath = path.join(dir, 'voice.wav');
      const ffmpeg = await runTool(paths.ffmpeg, buildVoiceFfmpegArgs(videoPath, wavPath));
      if (ffmpeg.code !== 0) {
        if (String(ffmpeg.stderr).includes('matches no streams')) {
          throw new Error('This video has no audio track.');
        }
        throw new Error(`Could not extract the audio (ffmpeg: ${lastLine(ffmpeg.stderr)}).`);
      }

      const tool = await runTool(paths.voiceTool, buildVoiceToolArgs(paths, wavPath, threadCount));
      if (tool.code !== 0) {
        throw new Error(`The voice detector failed (${lastLine(tool.stderr)}).`);
      }
      return parseVoiceSegments(tool.stdout);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }

  return {
    async detect(videoPath) {
      if (typeof videoPath !== 'string' || videoPath === '') {
        throw new TypeError('A video path is required.');
      }
      return detectInTempDir(videoPath);
    },
  };
}
