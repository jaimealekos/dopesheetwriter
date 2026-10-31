// Constantes de la aplicación. Única fuente de valores por defecto y listas cerradas.

export const APP_NAME = 'Dopesheet Writer';

export const SHOT_SIZES = ['Wide shot', 'Mid shot', 'Close-up'];
export const MOVEMENTS = ['Pan right', 'Pan left', 'Tilt up', 'Tilt down'];
export const GENDERS = ['man', 'woman'];

export const DEFAULT_LOCATION = 'MADRID, SPAIN';
export const DEFAULT_LANGUAGE = 'Spanish';

// Meses en inglés y mayúsculas para la fecha de cabecera (independiente del idioma del sistema).
export const MONTHS = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.m4v'];
export const XML_EXTENSIONS = ['.xml'];

// Diferencia máxima (segundos) entre la duración de la secuencia XML y la del vídeo antes de avisar.
export const MISMATCH_TOLERANCE_SECONDS = 1;

// Duración mínima (segundos) que separa un corte de entrevista de un plano de imagen en
// la detección automática. Calibrada con 8 reportajes reales: los 8 aciertan entre 10 y 11 s.
export const INTERVIEW_MIN_SECONDS = 10.5;

// Ancho en píxeles de las miniaturas del primer fotograma.
export const THUMBNAIL_WIDTH = 320;

// Tiempo máximo (ms) que se espera a que el vídeo se sitúe en un fotograma antes de darlo por fallido.
export const SEEK_TIMEOUT_MS = 15000;

// Retardo (ms) del autoguardado del borrador tras el último cambio.
export const AUTOSAVE_DELAY_MS = 600;

// Traducción: tamaño de fragmento, longitud máxima y espera por petición.
export const TRANSLATE_CHUNK_CHARS = 450;
export const TRANSLATE_MAX_CHARS = 5000;
export const TRANSLATE_TIMEOUT_MS = 10000;

// Transcripción local (mismo sistema que Hispatrans). Rutas relativas a la carpeta de herramientas.
export const TRANSCRIBER_DIR_NAME = 'transcriber'; // vendor/transcriber en desarrollo; resources/transcriber empaquetado
export const TRANSCRIBER_FILES = {
  ffmpeg: 'ffmpeg.exe',
  whisper: 'whisper/whisper-cli.exe',
  model: 'models/ggml-large-v3-q8_0.bin',
  vadModel: 'models/ggml-silero-v6.2.0.bin',
};
export const TRANSCRIBE_BEAM_SIZE = 5;
export const TRANSCRIBE_VAD = { threshold: 0.5, minSpeechMs: 250, minSilenceMs: 2000, speechPadMs: 400 };
export const TRANSCRIBE_TIMEOUT_MS = 600000; // por proceso (ffmpeg o whisper)
export const TRANSCRIBE_MAX_SECONDS = 600; // tramo máximo

// Idiomas del corrector ortográfico de Electron (los textos de la app van en inglés).
export const SPELLCHECK_LANGUAGES = ['en-US'];
