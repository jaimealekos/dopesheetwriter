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

// Detector de voz (Silero, whisper-vad-speech-segments de whisper.cpp) para la detección de
// entrevistas. Opcional: sin él la detección usa solo la duración. Ruta relativa a la carpeta
// de herramientas; ajustes = los valores por defecto de la herramienta.
export const VOICE_TOOL_FILE = 'whisper/whisper-vad-speech-segments.exe';
export const VOICE_VAD = { threshold: 0.5, minSpeechMs: 250, minSilenceMs: 100, speechPadMs: 30 };
export const VOICE_TIMEOUT_MS = 60000; // por proceso (ffmpeg o detector), vídeo entero

// Fracción mínima del plano con voz para que un corte largo cuente como entrevista.
// Medido en BESTIA (2026-11-15): entrevista 0,85; vídeo con música 0,02; producto sin voz 0,00.
export const INTERVIEW_MIN_VOICE = 0.3;

// Estimación del tiempo de transcripción de un corte: fijo + proporcional a su duración.
// Medido en BESTIA (32 hilos lógicos, whisper con 16): 20 s de audio → 12,1 s; 60 s → 23,8 s.
export const TRANSCRIBE_ESTIMATE_FIXED_SECONDS = 6.3;
export const TRANSCRIBE_ESTIMATE_SECONDS_PER_SECOND = 0.29;

// Escucha previa de un corte en el selector de entrevistas: segundos máximos desde su inicio.
export const INTERVIEW_PREVIEW_SECONDS = 6;

// Máximo de avisos visibles en el selector de entrevistas (el resto, «and N more»).
export const INTERVIEW_NOTES_MAX = 3;

// Gráfico del selector de entrevistas (DISENO-GRAFICO §17.1).
export const INTERVIEW_CHART_SCALE_SECONDS = 30; // una barra de 30 s o más llena el alto
export const INTERVIEW_CHART_SLOT_MIN_PX = 8; // ancho mínimo de barra con su separación
export const INTERVIEW_CHART_BOUNDARY_PX = 6; // hueco del límite entre imagen y entrevista

// Idiomas del corrector ortográfico de Electron (los textos de la app van en inglés).
export const SPELLCHECK_LANGUAGES = ['en-US'];
