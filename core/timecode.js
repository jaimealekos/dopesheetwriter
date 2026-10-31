// Conversiones entre fotogramas, segundos y timecode, y formateo de duraciones.

// fps (fotogramas por segundo) debe ser un número finito mayor que cero.
function assertValidFps(fps) {
  if (typeof fps !== 'number' || !Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('fps must be a positive number');
  }
}

// Valor (segundos o fotogramas) debe ser un número finito no negativo.
function assertValidAmount(value, name) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite number >= 0`);
  }
}

// Calcula los fps reales a partir de la base de tiempo del XML y si el material es NTSC.
export function fpsFromRate(timebase, ntsc) {
  return ntsc ? (timebase * 1000) / 1001 : timebase;
}

export function framesToSeconds(frames, fps) {
  assertValidAmount(frames, 'frames');
  assertValidFps(fps);
  return frames / fps;
}

// Duración de un plano en segundos con un decimal: (105, 25) -> '4.2s'.
export function formatShotSeconds(frames, fps) {
  assertValidAmount(frames, 'frames');
  assertValidFps(fps);
  return `${(frames / fps).toFixed(1)}s`;
}

export function secondsToFrames(seconds, fps) {
  assertValidAmount(seconds, 'seconds');
  assertValidFps(fps);
  return Math.round(seconds * fps);
}

// Instante a mitad del fotograma, para que un currentTime caiga dentro del fotograma y no en su frontera.
export function frameSeekTime(frame, fps) {
  assertValidAmount(frame, 'frames');
  assertValidFps(fps);
  return (frame + 0.5) / fps;
}

// Duración en formato 'MM:SS', con minutos sin límite de 59 y dos dígitos como mínimo.
export function formatDuration(seconds) {
  assertValidAmount(seconds, 'seconds');
  const totalSeconds = Math.round(seconds);
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// Duración redondeada en segundos con el sufijo 'sec', como en un soundbite.
export function formatSoundbiteSeconds(frames, fps) {
  assertValidAmount(frames, 'frames');
  assertValidFps(fps);
  return `${Math.round(frames / fps)}sec`;
}

// Timecode 'HH:MM:SS:FF' sin pérdida de fotogramas (nominal = round(fps)).
export function formatTimecode(seconds, fps) {
  assertValidAmount(seconds, 'seconds');
  assertValidFps(fps);

  const totalFrames = Math.round(seconds * fps);
  const nominal = Math.round(fps);
  const ff = totalFrames % nominal;
  const totalSeconds = Math.floor(totalFrames / nominal);

  const ss = totalSeconds % 60;
  const mm = Math.floor(totalSeconds / 60) % 60;
  const hh = Math.floor(totalSeconds / 3600);

  const pad = (value) => String(value).padStart(2, '0');
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}
