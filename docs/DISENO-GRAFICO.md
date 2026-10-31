# Diseño gráfico — Dopesheet Writer

Único documento visual del proyecto. Manda sobre cualquier valor visual del código (`renderer/styles.css`, `renderer/index.html`). Todo valor de este documento se copia tal cual; si hace falta uno que no está aquí, se añade aquí primero.

Principios: herramienta de trabajo para horas seguidas en sala de edición. Oscuro por defecto, claro automático con `prefers-color-scheme: light`. Un solo color de acento (azul) para selección, foco y acción principal; los colores de estado (verde, ámbar, rojo, violeta) solo significan estado. Nada decorativo: sin degradados, sin iconos de adorno, sin animaciones que no informen. Todo se puede hacer con teclado.

La interfaz está en inglés (`<html lang="en">`). Las etiquetas «Examinar», «Video source» y «Xml» se escriben exactamente así, por decisión del usuario.

---

## 1. Tokens (variables CSS)

`:root` lleva el tema oscuro; el bloque `@media (prefers-color-scheme: light)` solo sobrescribe colores y sombras. `color-scheme` hace que los desplegables nativos, las barras de desplazamiento y los diálogos de Chromium sigan el tema.

```css
:root {
  color-scheme: dark light;

  /* Color — tema oscuro (por defecto) */
  --color-bg: #0e0f11;               /* fondo de ventana y de la columna principal */
  --color-surface: #16171a;          /* barra superior, columna derecha, controles del reproductor */
  --color-raised: #1e2024;           /* tarjetas, tooltips, modal, toast, fondo de miniatura */
  --color-field: #1e2024;            /* fondo de campos */
  --color-hover: #26282d;            /* fondo en puntero encima (botones secundarios, fantasmas) */
  --color-active: #2e3036;           /* fondo pulsado */
  --color-sunken: #0a0b0d;           /* fondo de la vista previa */
  --color-video: #000000;            /* escenario del vídeo (igual en ambos temas) */
  --color-on-video: #f2f2f4;         /* texto e iconos sobre el escenario */
  --color-border: #2a2c31;           /* divisores y bordes no interactivos */
  --color-border-control: #6a6e77;   /* borde de campos, botones secundarios, segmentado */
  --color-border-hover: #868a93;     /* borde de control con puntero encima */
  --color-text: #ececef;             /* texto principal */
  --color-text-secondary: #a4a8b0;   /* etiquetas, metadatos */
  --color-text-tertiary: #868a93;    /* marcadores de posición, pies, ayudas */
  --color-text-disabled: #5b5f67;    /* texto desactivado (exento de contraste) */
  --color-accent: #5c9dff;           /* acción principal, selección, plano actual */
  --color-accent-hover: #7aafff;
  --color-accent-pressed: #4a8af0;
  --color-on-accent: #0b1426;        /* texto sobre acento */
  --color-accent-tint: #202a3a;      /* fondo seleccionado suave, arrastre encima */
  --color-focus: #5c9dff;            /* anillo de foco */
  --color-success: #3fcf8e;
  --color-success-bg: #152a23;
  --color-warning: #f0b44c;
  --color-warning-bg: #2e2619;
  --color-error: #ff6b6b;
  --color-error-bg: #301c1e;
  --color-interview: #b59cff;        /* solo planos de entrevista (soundbite) */
  --color-on-interview: #1a1030;
  --color-track: #34373d;            /* pista de la barra de progreso */
  --color-cut: #a4a8b0;              /* marcas de corte */
  --color-playhead: #ececef;
  --color-play-bg: #ececef;          /* botón play/pausa */
  --color-play-hover: #ffffff;
  --color-play-icon: #16171a;
  --color-preview-current: #141d2a;  /* bloque del plano actual en la vista previa */
  --color-backdrop: rgba(0, 0, 0, 0.60);
  --color-scrollbar: #3a3d43;
  --color-scrollbar-hover: #53575e;
  --color-skeleton: #1e2024;
  --color-skeleton-shine: #2a2c31;

  /* Tipografía — sin fuentes web */
  --font-ui: "Segoe UI Variable Text", "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Text", system-ui, sans-serif;
  --font-display: "Segoe UI Variable Display", "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif;
  --font-mono: "Cascadia Mono", "Cascadia Code", Consolas, "SF Mono", ui-monospace, Menlo, monospace;

  --font-size-display: 28px;   --font-weight-display: 600;   --font-line-display: 36px;   --font-tracking-display: -0.01em;
  --font-size-title: 18px;     --font-weight-title: 600;     --font-line-title: 24px;     --font-tracking-title: -0.005em;
  --font-size-subtitle: 15px;  --font-weight-subtitle: 600;  --font-line-subtitle: 20px;  --font-tracking-subtitle: 0;
  --font-size-body: 14px;      --font-weight-body: 400;      --font-line-body: 20px;      --font-tracking-body: 0;
  --font-size-control: 13px;   --font-weight-control: 500;   --font-line-control: 16px;   --font-tracking-control: 0.005em;
  --font-size-label: 12px;     --font-weight-label: 500;     --font-line-label: 16px;     --font-tracking-label: 0.01em;
  --font-size-caption: 12px;   --font-weight-caption: 400;   --font-line-caption: 16px;   --font-tracking-caption: 0;
  --font-size-overline: 11px;  --font-weight-overline: 600;  --font-line-overline: 16px;  --font-tracking-overline: 0.06em;
  --font-size-timecode: 15px;  --font-weight-timecode: 500;  --font-line-timecode: 20px;  --font-tracking-timecode: 0;
  --font-size-mono-sm: 12px;   --font-weight-mono-sm: 500;   --font-line-mono-sm: 16px;   --font-tracking-mono-sm: 0;
  --font-size-preview: 13px;   --font-weight-preview: 400;   --font-line-preview: 20px;   --font-tracking-preview: 0;

  /* Espaciado — escala de 4 px */
  --space-half: 2px;
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Radios */
  --radius-sm: 4px;     /* insignias, kbd, tooltip, opciones del segmentado */
  --radius-md: 6px;     /* botones, campos, chips, miniaturas */
  --radius-lg: 8px;     /* escenario del vídeo, bloque del reproductor, toast */
  --radius-xl: 12px;    /* zonas de soltar, modal */
  --radius-pill: 999px; /* botón play, conmutador, punto de estado */

  /* Sombras — tema oscuro */
  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.40);
  --shadow-2: 0 8px 24px rgba(0, 0, 0, 0.45), 0 2px 6px rgba(0, 0, 0, 0.30);
  --shadow-3: 0 24px 64px rgba(0, 0, 0, 0.60), 0 4px 12px rgba(0, 0, 0, 0.40);

  /* Tamaños */
  --size-window-min-w: 1100px;      /* sustituido: 1280px, ver 13.1 */
  --size-window-min-h: 700px;
  --size-topbar: 48px;
  --size-sidebar: 400px;            /* sustituido: 800px, ver 13.1 */
  --size-filmstrip: 128px;
  --size-thumb-w: 128px;
  --size-thumb-h: 72px;
  --size-player-controls: 72px;
  --size-timeline-hit: 20px;
  --size-track: 4px;
  --size-track-hover: 6px;
  --size-cut-h: 12px;
  --size-playhead: 12px;
  --size-control: 32px;       /* botones, chips, icon-buttons, segmentado: objetivo mínimo */
  --size-field: 36px;         /* input y select */
  --size-play: 40px;
  --size-tab: 40px;                 /* sustituido: sin pestañas, ver 13.2 */
  --size-icon: 16px;
  --size-icon-player: 20px;
  --size-icon-dropzone: 32px;
  --size-switch-w: 32px;
  --size-switch-h: 18px;
  --size-switch-thumb: 14px;
  --size-status-dot: 8px;
  --size-badge-h: 18px;
  --size-dropzone-h: 240px;
  --size-home-max: 880px;
  --size-modal: 440px;
  --size-toast: 360px;
  --size-tooltip-max: 280px;
  --size-volume: 88px;
  --size-progress-bar: 64px;
  --size-chip-max: 280px;
  --size-textarea-min: 96px;
  --size-textarea-quote-min: 72px;  /* sustituido: --size-textarea-fill-min, ver 13.1 */
  --size-textarea-max: 240px;
  --size-scrollbar: 8px;
  --size-focus-ring: 2px;
  --size-focus-offset: 2px;
  --size-main-padding: 16px;

  /* Movimiento */
  --motion-fast: 90ms;
  --motion-base: 150ms;
  --motion-slow: 240ms;
  --motion-exit: 160ms;
  --motion-shimmer: 1200ms;
  --motion-spinner: 800ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);

  /* Capas */
  --z-banner: 10;
  --z-drop-overlay: 30;
  --z-toast: 40;
  --z-modal: 50;
  --z-tooltip: 60;
}

@media (prefers-color-scheme: light) {
  :root {
    --color-bg: #eceef1;
    --color-surface: #ffffff;
    --color-raised: #f5f6f8;
    --color-field: #ffffff;
    --color-hover: #e8eaee;
    --color-active: #dde0e5;
    --color-sunken: #f7f8fa;
    --color-video: #000000;
    --color-on-video: #f2f2f4;
    --color-border: #dfe2e6;
    --color-border-control: #838892;
    --color-border-hover: #676c75;
    --color-text: #16181d;
    --color-text-secondary: #4f545d;
    --color-text-tertiary: #676c75;
    --color-text-disabled: #a2a6ad;
    --color-accent: #0b5fd7;
    --color-accent-hover: #0a52bb;
    --color-accent-pressed: #08469f;
    --color-on-accent: #ffffff;
    --color-accent-tint: #ebf2fc;
    --color-focus: #0b5fd7;
    --color-success: #13784a;
    --color-success-bg: #ecf4f1;
    --color-warning: #8f5b00;
    --color-warning-bg: #f4efe6;
    --color-error: #c42b31;
    --color-error-bg: #faeeef;
    --color-interview: #6b46c9;
    --color-on-interview: #ffffff;
    --color-track: #d5d8dd;
    --color-cut: #4f545d;
    --color-playhead: #16181d;
    --color-play-bg: #16181d;
    --color-play-hover: #000000;
    --color-play-icon: #ffffff;
    --color-preview-current: #e4ecf7;
    --color-backdrop: rgba(16, 24, 40, 0.32);
    --color-scrollbar: #c4c8ce;
    --color-scrollbar-hover: #a2a6ad;
    --color-skeleton: #eceef1;
    --color-skeleton-shine: #f7f8fa;

    --shadow-1: 0 1px 2px rgba(16, 24, 40, 0.08);
    --shadow-2: 0 8px 24px rgba(16, 24, 40, 0.12), 0 2px 6px rgba(16, 24, 40, 0.08);
    --shadow-3: 0 24px 64px rgba(16, 24, 40, 0.18), 0 4px 12px rgba(16, 24, 40, 0.10);
  }
}
```

Tamaños que cambian con el ancho: ver sección 11.

### 1.1 Contrastes calculados (WCAG 2.2, luminancia relativa)

Texto normal exige 4,5:1; texto grande (≥ 18,66 px en negrita o ≥ 24 px) y elementos gráficos o bordes de control exigen 3:1.

| Pareja | Oscuro | Claro | Uso |
|---|---|---|---|
| text / bg | 16,26 | 15,28 | texto sobre la columna principal |
| text / surface | 15,20 | 17,76 | texto general |
| text / raised | 13,84 | 16,42 | tarjetas, modal, toast, tooltip |
| text / hover | 12,51 | 14,74 | botones con puntero encima |
| text / active | 11,19 | 13,42 | botones pulsados |
| text / sunken | 16,70 | 16,71 | vista previa |
| text / preview-current | 14,38 | 14,92 | bloque del plano actual en la vista previa |
| text-secondary / surface | 7,52 | 7,61 | etiquetas |
| text-secondary / bg | 8,04 | 6,55 | duración en tarjetas |
| text-secondary / raised | 6,84 | 7,04 | detalle en toast y modal |
| text-tertiary / surface | 5,18 | 5,28 | ayudas, pies |
| text-tertiary / raised (= field en oscuro) | 4,72 | 4,88 | marcadores de posición |
| text-tertiary / bg | 5,54 | **4,54** | pista de la pantalla de inicio |
| accent / surface | 6,59 | 5,78 | pestaña activa, enlaces, foco |
| accent / bg | 7,05 | 4,97 | número del plano seleccionado, foco sobre fondo |
| on-accent / accent | 6,76 | 5,78 | botón principal |
| on-accent / accent-hover | 8,23 | 7,15 | botón principal, puntero encima |
| on-accent / accent-pressed | 5,41 | 8,80 | botón principal, pulsado |
| accent / accent-tint | 5,31 | 5,13 | opción marcada del segmentado |
| success / surface | 8,99 | 5,51 | contador completo |
| success / bg | 9,61 | 4,74 | punto completo en tarjeta |
| success / success-bg | 7,59 | 4,92 | toast de éxito (icono) |
| warning / surface | 9,68 | 5,73 | «Missing: …» del editor |
| warning / bg | 10,35 | 4,93 | anillo incompleto en tarjeta |
| warning / warning-bg | 8,06 | 5,00 | banner de aviso, huecos de la vista previa |
| error / surface | 6,46 | 5,62 | mensaje de error de campo |
| error / error-bg | 5,77 | 4,96 | banner de error |
| text / error-bg | 13,59 | 15,68 | título del banner de error |
| text / warning-bg | 12,65 | 13,38 | título del banner de aviso |
| text-secondary / error-bg | 6,72 | 6,72 | detalle del banner de error |
| text-secondary / warning-bg | 6,26 | 6,65 | detalle del banner de aviso |
| interview / surface | 7,82 | 6,28 | «SOUNDBITE n · 18sec» |
| on-interview / interview | 7,90 | 6,28 | insignia «SB n» |
| play-icon / play-bg | 15,20 | 17,76 | botón play/pausa |
| on-video / video | 18,78 | 18,78 | avisos sobre el escenario |
| border-control / surface | 3,51 | 3,56 | borde de campos (gráfico ≥ 3:1) |
| border-control / field | 3,19 | 3,56 | borde de campos |
| border-control / raised | 3,19 | 3,29 | borde de botón secundario en toast/modal |
| cut / surface | 7,52 | 7,61 | marcas de corte |
| accent / track | 4,39 | 4,05 | tramo del plano actual en la barra |
| focus / bg, surface, raised | 7,05 / 6,59 / 6,00 | 4,97 / 5,78 / 5,35 | anillo de foco (≥ 3:1) |

Se quedan al límite: text-tertiary sobre bg en claro (4,54), border-control sobre raised y field en oscuro (3,19). La pista `--color-track` sobre surface (1,50 / 1,43) no transmite información por sí sola: la posición la da el cabezal (`--color-playhead`, 15,20 / 17,76) y el plano actual el tramo de acento. El texto desactivado (2,55 / 2,26) está exento por norma, pero todo control desactivado explica en tooltip por qué lo está.

---

## 2. Tipografía

| Nivel | Familia | Tamaño | Grosor | Interlineado | Espaciado | Dónde |
|---|---|---|---|---|---|---|
| display | `--font-display` | 28px | 600 | 36px | -0.01em | título de la pantalla de inicio |
| title | `--font-display` | 18px | 600 | 24px | -0.005em | «Shot 12», título del modal |
| subtitle | `--font-ui` | 15px | 600 | 20px | 0 | títulos de zona de soltar, nombre de fichero cargado |
| body | `--font-ui` | 14px | 400 | 20px | 0 | contenido de campos, textos del modal, cuerpo del banner |
| control | `--font-ui` | 13px | 500 | 16px | 0.005em | botones, pestañas, chips, opciones del segmentado, etiqueta de conmutador |
| label | `--font-ui` | 12px | 500 | 16px | 0.01em | etiquetas de campo (color text-secondary) |
| caption | `--font-ui` | 12px | 400 | 16px | 0 | ayudas, errores de campo, metadatos, tooltip |
| overline | `--font-ui` | 11px | 600 | 16px | 0.06em | «HEADER», «SOUNDBITE 1 · 18sec», insignia «SB 1»; sin `text-transform`: el texto se escribe tal cual (así «18sec» sigue en minúsculas) |
| timecode | `--font-mono` | 15px | 500 | 20px | 0 | timecode del reproductor |
| mono-sm | `--font-mono` | 12px | 500 | 16px | 0 | número y duración de tarjeta, rango de tiempo del editor, nombre del .txt |
| preview | `--font-mono` | 13px | 400 | 20px | 0 | vista previa del .txt |

Reglas:
- `font-variant-numeric: tabular-nums` en todo número que cambia (timecode, contador de progreso, duraciones, edad).
- «Optional» junto a la etiqueta de un campo opcional: caption, color text-tertiary. Los obligatorios no llevan marca (son mayoría).
- Sin cursivas. Sin subrayados salvo el foco de enlaces de texto (no hay enlaces en la versión actual).
- Truncado: nombres de fichero con `text-overflow: ellipsis` y el nombre completo en `title`.
- `-webkit-font-smoothing: antialiased` solo afecta a macOS; se deja activado.

---

## 3. Iconos

SVG inline, `viewBox="0 0 24 24"`, `fill="none"`, `stroke="currentColor"`, `stroke-width="1.75"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, `aria-hidden="true"`, `focusable="false"`. Se dibujan a 16px (`--size-icon`), 20px en el reproductor (`--size-icon-player`) y 32px en zonas de soltar (`--size-icon-dropzone`). Clase común `icon`, más `icon--<nombre>`.

| Nombre | Trazado |
|---|---|
| `play` | `M8 5.5v13l10.5-6.5z` (con `fill="currentColor"`) |
| `pause` | `rect x=7 y=5 w=3.5 h=14 rx=1` y `rect x=13.5 y=5 w=3.5 h=14 rx=1` (con `fill="currentColor"`) |
| `shot-prev` | `M6 6v12` y `M18 6 9 12l9 6z` |
| `shot-next` | `M18 6v12` y `M6 6l9 6-9 6z` |
| `volume` | `M4 9.5h3.5L12 5.5v13l-4.5-4H4z`, `M15.5 9a4 4 0 0 1 0 6`, `M18 6.5a7.5 7.5 0 0 1 0 11` |
| `mute` | `M4 9.5h3.5L12 5.5v13l-4.5-4H4z`, `M16 9.5l5 5`, `M21 9.5l-5 5` |
| `film` (vídeo) | `rect x=3 y=4 w=18 h=16 rx=2`, `M7 4v16`, `M17 4v16`, `M3 9h4`, `M3 15h4`, `M17 9h4`, `M17 15h4` |
| `xml` (documento) | `M6 3h8l4 4v14H6z`, `M14 3v4h4`, `M10 12l-2 2 2 2`, `M14 12l2 2-2 2` |
| `drop` | `M12 15V4`, `M7.5 8.5 12 4l4.5 4.5`, `M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3` |
| `check` | `M5 12.5l4.5 4.5L19 7.5` |
| `error` | círculo `cx=12 cy=12 r=9`, `M12 7.5v5.5`, `M12 16.5v.01` |
| `warning` | `M12 3.5 21.5 20h-19z`, `M12 10v4`, `M12 17v.01` |
| `close` | `M6 6l12 12`, `M18 6 6 18` |
| `chevron-down` | `M6 9l6 6 6-6` |
| `copy` | `rect x=8 y=8 w=12 h=12 rx=2`, `M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2` |
| `next-pending` | `M5 12h12`, `M13 7l5 5-5 5`, `M20 6v12` |
| `folder` | `M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z` |
| `image-off` | `rect x=3 y=5 w=18 h=14 rx=2`, `M3 5l18 14` |
| `spinner` | círculo `cx=12 cy=12 r=9` con `stroke-dasharray="42 15"`, gira |

---

## 4. Layout de la ventana

Ventana Electron: `minWidth 1100` (**sustituido: 1280, ver 13.1**), `minHeight 700`, inicial `1440×900`, marco nativo, menú oculto. Todo lo de abajo está dentro de la zona de contenido.

```
.app  (grid; rows: var(--size-topbar) auto 1fr; height 100vh; background --color-bg)
├── .topbar                     48px, surface, borde inferior 1px border
├── .banner (0..1)              alto automático, empuja el contenido
└── .home  |  .workspace
```

### 4.1 Espacio de trabajo (1440×900)

> **Sustituido por 13.1 y 13.2**: columnas, pestañas, cuentas de 1440×900 y 1100×700, y la regla de desplazamiento de la columna derecha.

```
.workspace  grid-template-columns: minmax(0, 1fr) var(--size-sidebar)   (400px)
├── .workspace__main   (main)   padding 16px; grid-template-rows: minmax(0, 1fr) var(--size-filmstrip); row-gap 12px
│   ├── .player                 flex column
│   │   ├── .player__stage      flex 1; min-height 0; fondo --color-video; radius 8px 8px 0 0
│   │   └── .player__controls   72px; surface; radius 0 0 8px 8px; borde 1px border (sin borde superior)
│   └── .filmstrip              128px
└── .sidebar           (aside)  surface; borde izquierdo 1px border; flex column; min-height 0
    ├── .header-fields          alto natural (~180px); borde inferior 1px border
    ├── .tabs__list             40px
    └── .tabs__panel            flex 1; overflow-y auto (el pie de acciones del editor queda fijo)
```

Cuentas a 1440×900: columna principal 1040px de ancho, escenario 1008×620 px útiles → vídeo 16:9 a 1008×567 centrado, bandas negras arriba y abajo de 26px. A 1100×700: columna principal 740px, escenario 716×428 → vídeo 716×403.

Reglas del reproductor:
- El vídeo manda: el escenario ocupa todo el espacio vertical que dejan la barra superior, la tira y los controles. `<video>` con `width: 100%; height: 100%; object-fit: contain`. No se recorta nunca.
- La columna derecha no cambia de ancho al redimensionar (salvo en los puntos de ruptura de la sección 11). Solo la columna principal absorbe el cambio.
- La tira de planos tiene alto fijo; nunca se reduce para dar sitio al vídeo.
- En la columna derecha solo desplaza `.tabs__panel`; `.header-fields`, `.tabs__list` y `.shot-editor__actions` quedan fijos.

### 4.2 Pantalla de inicio

```
.home  (main)  overflow auto; padding 12vh 24px 48px; background --color-bg
└── .home__inner       max-width 880px; margin 0 auto
    ├── .home__title   display: «Dopesheet Writer»
    ├── .home__lead    body, text-secondary, margin-top 8px: «Load the edited video and its XML to start writing the shotlist.»
    ├── .home__zones   margin-top 32px; grid 2 columnas 1fr 1fr; gap 24px
    │   ├── .dropzone.dropzone--video
    │   └── .dropzone.dropzone--xml
    ├── .home__hint    caption, text-tertiary, margin-top 16px, centrado:
    │                  «You can drop files anywhere in the window. An XML with the same name next to the video loads by itself.»
    └── .home__status  (solo con los dos ficheros cargados) margin-top 24px, centrado: spinner 16px + control text-secondary «Detecting shots…»
```

La barra superior se muestra también en inicio, solo con `.topbar__brand`.

---

## 5. Controles comunes

Anillo de foco único para toda la app: `outline: var(--size-focus-ring) solid var(--color-focus); outline-offset: var(--size-focus-offset);` solo en `:focus-visible`. Campos de texto: foco con `:focus` (siempre visible al escribir), ver 5.3. Nunca `outline: none` sin sustituto.

Desactivado: los botones que el usuario necesita entender («Generate», «Next pending», «Copy from previous») usan `aria-disabled="true"` + clase `is-disabled` en lugar del atributo `disabled`, para seguir siendo enfocables y mostrar su tooltip. El resto usa `disabled`.

### 5.1 Botón `.button`

`<button class="button button--primary|button--secondary|button--ghost">[svg.icon] <span class="button__label">…</span> [<kbd class="kbd">…</kbd>]</button>`

Base: alto 32px, padding 0 12px, gap 6px, radius-md, tipografía control, `white-space: nowrap`, borde 1px transparente.

| Estado | `--primary` | `--secondary` | `--ghost` |
|---|---|---|---|
| reposo | fondo accent, texto on-accent | fondo transparente, borde border-control, texto text | fondo transparente, texto text-secondary |
| hover | fondo accent-hover | fondo hover, borde border-hover | fondo hover, texto text |
| foco visible | anillo de foco | anillo de foco | anillo de foco |
| activo (pulsado) | fondo accent-pressed | fondo active | fondo active, texto text |
| `is-disabled` | fondo raised, borde border, texto text-disabled, `cursor: not-allowed` | borde border, texto text-disabled | texto text-disabled |
| `is-loading` | etiqueta sustituida por spinner 16px en on-accent; ancho fijo (el del estado anterior); `aria-busy="true"`; no reacciona a clics | igual con spinner en text | — |

`.kbd` (dentro de botones y tooltips): `--font-mono` 11px/500, alto 18px, padding 0 4px, radius-sm, `border: 1px solid color-mix(in srgb, currentColor 40%, transparent)`, margen izquierdo 4px.

### 5.2 Botón de icono `.icon-button`

`<button class="icon-button" aria-label="…"><svg class="icon"/></button>`. 32×32 px, radius-md, color text-secondary. Hover: fondo hover, color text. Foco visible: anillo. Activo: fondo active. Pulsado persistente (`aria-pressed="true"`, clase `is-active`): color accent. Desactivado: color text-disabled. Todo icon-button lleva tooltip con su nombre y atajo.

### 5.3 Campo `.field`

```
div.field [is-error] [is-disabled] [field--select|field--textarea|field--switch|field--segmented]
├── div.field__label-row
│   ├── label.field__label            label, text-secondary
│   └── span.field__optional          «Optional» (solo opcionales)
├── input.field__input | div.field__select-wrap > (select.field__select + svg.icon--chevron-down.field__chevron) | textarea.field__textarea
├── p.field__help   (opcional)        caption, text-tertiary; id referenciado en aria-describedby
└── p.field__error  (solo is-error)   caption, error; icono error 14px delante, gap 4px; id en aria-describedby
```
Separaciones: etiqueta → control 6px; control → ayuda/error 6px; entre campos 16px; dos campos en fila: gap 12px.

Control (`input`, `select`, `textarea`): fondo field, borde 1px border-control, radius-md, tipografía body, color text, marcador de posición text-tertiary.
- `input`, `select`: alto 36px, padding 0 10px. `select`: `appearance: none`, padding-right 32px, chevron 16px a 10px del borde derecho, color text-secondary, `pointer-events: none`. Sin valor (opción vacía seleccionada): clase `is-empty` en el `select`, texto text-tertiary.
- `textarea`: padding 8px 10px, `resize: none`, alto mínimo `--size-textarea-min` (96px) o `--size-textarea-quote-min` (72px) para Translation y Original; crece con el contenido hasta 240px y después desplaza.

| Estado | Aspecto |
|---|---|
| reposo | borde border-control |
| hover | borde border-hover |
| foco (`:focus`) | borde accent + `box-shadow: 0 0 0 1px var(--color-accent)` (2px en total); sin outline |
| error (`is-error`, `aria-invalid="true"`) | borde error; con foco: `box-shadow: 0 0 0 1px var(--color-error)` |
| desactivado | fondo surface, borde border, texto text-disabled, `cursor: not-allowed` |

Cuándo aparece el error: (a) al salir de un campo obligatorio que el usuario había editado y ha dejado vacío; (b) en todos los campos que faltan del plano mostrado tras pulsar Generate o Ctrl+S con planos incompletos; (c) en Age al escribir algo que no son dígitos. Se quita al escribir un valor válido.

### 5.4 Conmutador `.switch`

```
label.switch [is-disabled]
├── input.switch__input  type=checkbox role=switch (visualmente oculto, sigue enfocable)
├── span.switch__track   32×18, radius-pill
│   └── span.switch__thumb   14×14, radius-pill, top/left 2px
└── span.switch__label   control, text
```
Alto de acierto: la etiqueta entera, mínimo 32px, gap 10px.

| Estado | Pista | Botón |
|---|---|---|
| apagado | fondo transparente, borde 1px border-control | text-secondary, a la izquierda |
| encendido | fondo accent, borde accent | on-accent, `translateX(14px)` |
| hover | borde border-hover (apagado) / fondo accent-hover (encendido) | — |
| foco visible | anillo de foco sobre la pista | — |
| desactivado | borde border | text-disabled; etiqueta text-disabled |

### 5.5 Control segmentado `.segmented` (Gender)

```
div.field.field--segmented [is-error]
├── span.field__label  id=gender-label  «Gender»
├── div.segmented  role=radiogroup aria-labelledby=gender-label aria-required=true
│   ├── label.segmented__option [is-checked]  > input type=radio (oculto) + span «man»
│   └── label.segmented__option [is-checked]  > input type=radio (oculto) + span «woman»
└── p.field__error  «Choose man or woman.»
```
Contenedor: alto 32px, ancho 200px (**sustituido: 160px, ver 13.1**), borde 1px border-control, radius-md, padding 2px, fondo field. Opciones: flex 1, radius-sm, control, text-secondary. Hover: fondo hover, texto text. Marcada: fondo accent-tint, texto accent, `box-shadow: inset 0 0 0 1px var(--color-accent)`. Foco visible (en el radio): anillo de foco sobre la opción, offset 0. Error: borde del contenedor error. Sin valor inicial: ninguna marcada. Flechas izquierda/derecha cambian la opción (comportamiento nativo del grupo de radios).

### 5.6 Chip de fuente `.source-chip`

`<button class="source-chip source-chip--video|source-chip--xml" title="<ruta completa>"><svg class="icon"/><span class="source-chip__name">…</span></button>`
Alto 32px, padding 0 10px, gap 6px, radius-md, borde 1px border, fondo transparente, control, texto text, icono text-secondary, `max-width: var(--size-chip-max)`, nombre con elipsis. Hover: fondo hover, borde border-control. Foco: anillo. Activo: fondo active. Tooltip: «Change video · Examinar» / «Change XML · Examinar». Pulsarlo abre el diálogo de fichero.

### 5.7 Tooltip `.tooltip`

`div.tooltip role=tooltip` referenciado por `aria-describedby` del control. Fondo raised, borde 1px border, shadow-2, radius-sm, padding 6px 8px, caption en text, `max-width: 280px`. Atajo con `.kbd` en text-secondary. Aparece a 8px del control (encima por defecto, debajo si no cabe). Retardo 500ms con puntero; inmediato con foco de teclado. Se oculta al salir, con Esc o al pulsar.

---

## 6. Componentes

### 6.1 `topbar`

```
header.topbar  (role banner implícito)   alto 48px; padding 0 16px; flex; align center; gap 12px; surface; borde inferior 1px border
├── div.topbar__brand                    subtitle a 14px/600, text; no pulsable
├── div.topbar__sources                  (solo espacio de trabajo) flex; gap 8px; margin-left 12px; separador 1px border de 20px de alto antes
│   ├── button.source-chip.source-chip--video
│   └── button.source-chip.source-chip--xml
└── div.topbar__actions                  margin-left auto; flex; gap 16px   (**ampliado en 13.2: conmutador Preview antes de Generate**)
    ├── div.progress [is-complete]       (lo monta output-panel)
    └── button.button.button--primary.generate [is-disabled] [is-loading]   (lo monta output-panel)
```

`progress`:
```
div.progress [is-complete]
├── div.progress__bar  aria-hidden   64×4 px, radius-pill, fondo track
│   └── div.progress__fill           alto 100 %, radius-pill, fondo accent; ancho = completos/total
└── span.progress__label             control, text-secondary, tabular-nums: «18/26 shots complete»
```
`is-complete`: relleno success, etiqueta en success con icono check 16px delante: «26/26 shots complete». Con entrevistas pendientes cuentan igual que los planos.

`generate`: etiqueta «Generate», min-width 96px.
- Habilitado: tooltip «Save <name>.txt next to the video» + `.kbd` «Ctrl+S».
- `is-disabled` (faltan datos): tooltip con título «Complete these to generate:» y una línea por falta, máximo 6 líneas y después «and N more»:
  - «Source» (o «Location», «Date») si falta un campo de cabecera;
  - «Shots 3, 7, 12–16» (rangos con guion corto –) para planos de imagen incompletos;
  - «Soundbites 1, 2» para entrevistas incompletas.
  Pulsarlo o Ctrl+S en ese estado no escribe: selecciona el primer plano pendiente (o enfoca el primer campo de cabecera vacío) y marca `is-error` en sus campos que faltan.
- `is-loading`: mientras se escribe el fichero.

### 6.2 `banner`

```
div.banner.banner--error|banner--warning   role=alert (error) | role=status (aviso)
├── svg.icon.icon--error|icon--warning.banner__icon     16px, color error|warning
├── div.banner__content                                  flex 1
│   ├── p.banner__title        control a 13px/600, text, inline
│   └── p.banner__detail       caption a 13px/20px, text-secondary, inline tras el título con un espacio
└── div.banner__actions        flex; gap 8px
    ├── button.button.button--secondary   acción de corrección (p. ej. «Examinar»)
    └── button.icon-button.banner__close  aria-label «Dismiss»  (solo avisos)
```
Ocupa todo el ancho bajo la barra superior, empuja el contenido (no flota). Padding 10px 16px, min-height 44px, gap 12px, align center. Fondo error-bg | warning-bg; borde inferior 1px en error | warning. Uno solo a la vez; el error manda sobre el aviso. Entrada: sin animación de altura (evita saltos animados del vídeo); opacidad 0→1 en `--motion-base`.

Textos (título + detalle):
| Caso | Tipo | Título | Detalle | Acción |
|---|---|---|---|---|
| códec no soportado | error | This video can't be played. | Its codec isn't supported (ProRes, DNxHD and similar). Export an H.264 MP4 and load it again. | Examinar |
| vídeo ilegible o movido | error | Couldn't open "<file>". | Check the file still exists and isn't open in another program. | Examinar |
| XML no válido | error | "<file>" isn't a valid Final Cut / Premiere XML. | Export the sequence as Final Cut Pro XML (xmeml v4) and load it again. | Examinar |
| XML sin clips en V1 | error | The XML has no clips on video track V1. | Check you exported the edited sequence, not a bin or a single clip. | Examinar |
| duración distinta | aviso | The XML doesn't match the video. | The sequence lasts <HH:MM:SS:FF> but the video lasts <HH:MM:SS:FF>. Make sure both come from the same export. | Examinar (XML), Dismiss |
| fichero de otro tipo soltado | aviso | "<file>" can't be loaded. | Drop a video (.mp4, .mov, .m4v) or an .xml file. | Dismiss |
| fallo al escribir | error | Couldn't save "<name>.txt". | <causa del sistema>. Check you can write to <folder>. | Dismiss |

### 6.3 `dropzone`

```
section.dropzone.dropzone--video|dropzone--xml [is-dragover|is-loading|is-loaded|is-error]  aria-labelledby=<id del título>
├── svg.icon.icon--film|icon--xml.dropzone__icon      32px, text-tertiary
├── h2.dropzone__title          subtitle, text: «Video source» | «Xml»
├── p.dropzone__hint            caption, text-tertiary (solo vacía)
├── div.dropzone__file          (solo is-loaded)
│   ├── p.dropzone__name        subtitle, text, elipsis, title = ruta completa
│   └── p.dropzone__meta        mono-sm, text-secondary
├── p.dropzone__status          (solo is-loading) control, text-secondary, spinner 16px delante
├── p.dropzone__error           (solo is-error) caption a 13px/20px, error, `role=alert`
└── button.button.button--secondary.dropzone__browse   «Examinar»
```
Caja: alto 240px, padding 24px, radius-xl, flex column centrado, gap 8px (12px antes del botón). Toda la caja es zona de soltar y un clic en ella equivale a «Examinar», pero el único elemento enfocable es el botón.

| Estado | Borde | Fondo | Contenido |
|---|---|---|---|
| vacía | 1.5px dashed border-control | transparente | icono, título, pista, Examinar |
| hover (puntero, sin arrastre) | 1.5px dashed border-hover | transparente | igual |
| `is-dragover` | 2px solid accent | accent-tint | icono `drop` en accent; pista sustituida por «Release to load» en accent |
| `is-loading` | 1.5px solid border | transparente | icono, título, estado; Examinar desactivado |
| `is-loaded` | 1px solid border | surface | icono `check` 32px en success, título, nombre, metadatos, Examinar |
| `is-error` | 1.5px solid error | error-bg | icono `error` 32px en error, título, mensaje de error, Examinar |

Textos:
- Pista vídeo: «Drag an .mp4, .mov or .m4v file here». Pista XML: «Drag the sequence .xml exported from Final Cut or Premiere».
- Cargando: «Reading video…», «Reading XML…».
- Metadatos vídeo: «00:03:12:05 · 1920×1080 · 25 fps». Metadatos XML: «26 shots · 25 fps · 00:03:12:05». XML cargado solo desde la carpeta del vídeo: se añade una línea caption text-tertiary «Found next to the video».
- Errores: los mismos títulos y detalles de la tabla del banner, en una sola frase continua.

Arrastre en inicio: puntero sobre una zona → esa zona `is-dragover`; puntero en cualquier otro punto de la ventana → `.home` recibe `is-dragover` y ambas zonas muestran borde 2px dashed accent (sin fondo). Al soltar fuera de las zonas, el fichero se clasifica por extensión.

### 6.4 `drop-overlay` (espacio de trabajo)

```
div.drop-overlay [is-visible]   aria-hidden=true; position fixed; inset 8px; z --z-drop-overlay
└── div.drop-overlay__panel     centrado; icono drop 32px en accent; subtitle «Drop to replace the video or XML»; caption text-secondary «.mp4 .mov .m4v · .xml»
```
Fondo `--color-backdrop`, borde 2px dashed accent, radius-xl. Panel: fondo raised, radius-lg, padding 24px 32px, shadow-2. Visible solo mientras dura el arrastre de ficheros sobre la ventana.

### 6.5 `player`

```
section.player  aria-label="Player"
├── div.player__stage [is-loading] [is-error]
│   ├── video.player__video  aria-label="Video: <name>"
│   └── div.player__overlay  (solo cargando o error) centrado; color on-video
│       cargando: spinner 24px; error: icono error 32px + subtitle «This video can't be played.»
└── div.player__controls     padding 0 12px 4px
    ├── div.player__timeline   role=slider tabindex=0 aria-label="Position" aria-valuemin=0 aria-valuemax=<s> aria-valuenow=<s> aria-valuetext="00:00:41:03, shot 12"
    │   ├── div.player__track          alto 4px (6px con hover), radius-pill, fondo track, centrado vertical
    │   ├── div.player__shot-range     tramo del plano actual; mismo alto y radio que la pista; fondo accent
    │   ├── div.player__cuts
    │   │   └── span.player__cut        1×12 px, fondo cut, centrado sobre la pista; left = % del corte
    │   ├── div.player__playhead       12×12 (14×14 con hover o foco), radius-pill, fondo playhead, box-shadow 0 0 0 2px var(--color-surface)
    │   └── div.player__hover-time     tooltip con el timecode bajo el puntero: mono-sm, fondo raised, borde border, shadow-2, radius-sm, padding 2px 6px, 8px por encima
    └── div.player__bar          alto 44px; flex; align center
        ├── div.player__transport       flex; gap 4px
        │   ├── button.icon-button.player__prev    icono shot-prev 20px, aria-label «Previous shot», tooltip «Previous shot · Alt+↑»
        │   ├── button.player__play [is-playing]    40×40, radius-pill, fondo play-bg, icono play/pause 20px en play-icon; aria-label «Play» / «Pause»; tooltip «Play · Space» o «Pause · Space»
        │   └── button.icon-button.player__next    icono shot-next 20px, aria-label «Next shot», tooltip «Next shot · Alt+↓»
        ├── div.player__time            margin-left 16px; tabular-nums
        │   ├── span.player__timecode   timecode, text: «00:00:41:03»
        │   └── span.player__duration   timecode a 400, text-tertiary: « / 00:03:12:05»
        ├── span.player__shot-label     margin-left 12px; caption, text-secondary: «Shot 12 of 26» (entrevista: «Soundbite 1 · shot 24 of 26»)
        └── div.player__options         margin-left auto; flex; gap 16px
            ├── label.switch.player__stop-toggle   «Stop at end of shot»
            └── div.volume [is-muted]
                ├── button.icon-button.volume__mute  icono volume|mute; aria-label «Mute» / «Unmute»; aria-pressed
                └── input.volume__slider  type=range, ancho 88px, aria-label «Volume»; pista 4px track, relleno text-secondary, botón 12px playhead
```
Qué se oculta en `.player__bar` según el ancho: **sustituido por 13.1.5** (consultas de contenedor).

Barra de progreso: altura de acierto 20px sobre toda la anchura. Clic o arrastre: salta. Teclado con foco en la barra: ←/→ un fotograma; Mayús+←/→ un segundo; RePág/AvPág corte anterior/siguiente; Inicio/Fin. Las marcas de corte no reciben foco. El tramo del plano actual se mueve al cambiar de plano sin transición (precisión antes que suavidad).

Botón play: hover fondo play-hover; activo `transform: scale(0.96)`; foco visible anillo con offset 2px. «Stop at end of shot» encendido: al llegar al final del plano se pausa en su último fotograma.

### 6.6 `filmstrip` y `shot-card`

```
section.filmstrip [is-loading]   aria-label="Shots"; alto 128px; flex column
├── div.filmstrip__progress  (solo is-loading) role=progressbar aria-label="Loading thumbnails" aria-valuemin=0 aria-valuemax=<n> aria-valuenow=<k>
│   │                        alto 2px, ancho 100 %, fondo track, radius-pill
│   └── div.filmstrip__progress-fill   fondo accent
└── ol.filmstrip__list       role=listbox aria-orientation=horizontal aria-label="Shots"; flex; gap 8px; padding 12px 4px 8px; overflow-x auto; overflow-y hidden
    ├── li.shot-card [is-selected] [is-complete|is-incomplete] [is-interview] [is-loading] [is-thumb-error]
    │       role=option aria-selected tabindex=0|-1 aria-label="Shot 12, 4.2 seconds, incomplete" (entrevista: "Shot 24, soundbite 1, 23 seconds, complete")
    │   ├── div.shot-card__thumb              --size-thumb-w × --size-thumb-h (16:9), radius-md, fondo raised, overflow hidden, position relative
    │   │   ├── img.shot-card__image alt=""   object-fit cover
    │   │   ├── svg.icon.icon--image-off      (solo is-thumb-error) 16px centrado, text-tertiary
    │   │   └── span.shot-card__badge         (solo is-interview) arriba-izquierda a 4px; alto 18px; padding 0 5px; radius-sm; fondo interview; overline en on-interview: «SB 1»
    │   └── div.shot-card__meta               margin-top 6px; flex; align center; gap 6px; alto 16px
    │       ├── span.shot-card__number        mono-sm, text: «12»
    │       ├── span.shot-card__duration      mono-sm a 400, text-secondary: «4.2s»
    │       └── span.shot-card__status        margin-left auto; 8×8 radius-pill; aria-hidden
    └── li.filmstrip__divider role=none aria-hidden=true   (antes de la primera entrevista) 1×72 px, fondo border, margin 0 8px
```
Barra de desplazamiento horizontal: 8px, pulgar scrollbar (hover scrollbar-hover), radius-pill, sin flechas.

| Estado | Aspecto |
|---|---|
| reposo | miniatura sin borde; número text |
| hover | `.shot-card__thumb` con `box-shadow: 0 0 0 1px var(--color-border-hover)`; cursor pointer |
| `is-selected` | miniatura `outline: 2px solid var(--color-accent); outline-offset: 2px`; número en accent y grosor 600 |
| foco visible | anillo de foco sobre la tarjeta entera con `outline-offset: 5px` y radius 10px (queda por fuera del contorno de selección) |
| activo | miniatura `transform: scale(0.98)` |
| `is-complete` | punto relleno success |
| `is-incomplete` | anillo de 1.5px warning, relleno transparente (la forma distingue sin color) |
| `is-interview` | insignia «SB n» |
| `is-loading` | miniatura con fondo skeleton y barrido `linear-gradient(90deg, transparent, var(--color-skeleton-shine), transparent)` animado; número y duración ya visibles |
| `is-thumb-error` | icono image-off; tooltip «Couldn't read this frame» |

Teclado: un único punto de tabulación (tabindex itinerante). ←/→ plano anterior/siguiente, Inicio/Fin primero/último; la selección sigue al foco. El plano seleccionado se desplaza a la vista con `scrollIntoView({ inline: 'nearest', block: 'nearest' })`.

Duración de tarjeta: segundos con un decimal y sufijo `s` sin espacio («4.2s»), igual en planos y entrevistas.

### 6.7 `setup-panel` en el espacio de trabajo: `header-fields`

> **Rejilla sustituida por 13.1.3**; textos, errores y ayudas siguen valiendo.

```
section.header-fields   aria-labelledby=header-fields-title; padding 16px; borde inferior 1px border
├── h2.header-fields__title   overline, text-tertiary: «HEADER»  (margin-bottom 12px)
├── div.header-fields__row    grid-template-columns: 1fr 150px; gap 12px
│   ├── div.field  Location   input; placeholder «CITY, COUNTRY»; valor inicial recordado o «MADRID, SPAIN»
│   └── div.field  Date       input; placeholder «MARCH 11, 2026»; valor inicial hoy
└── div.field  Source         margin-top 12px; input; placeholder «e.g. AFPTV»
```
Errores: «Enter the location.», «Enter the date, e.g. MARCH 11, 2026.», «Enter the source.». Ayuda de Source (caption): «Remembered for next time.». Sin transformación a mayúsculas: se escribe tal cual.

Los chips de fuente de la barra superior también son de `setup-panel` (sección 5.6).

### 6.8 `tabs`

> **Sustituido por 13.2**: las pestañas Shot/Preview se eliminan.

```
div.tabs
├── div.tabs__list    role=tablist aria-label="Details"; alto 40px; padding 0 16px; flex; gap 4px; borde inferior 1px border
│   ├── button.tabs__tab [is-selected]  role=tab aria-selected aria-controls id  «Shot»
│   └── button.tabs__tab [is-selected]  role=tab …                               «Preview»
└── div.tabs__panel   role=tabpanel aria-labelledby=<id de la pestaña> tabindex=-1
```
Pestaña: alto 40px, padding 0 12px, control, text-secondary. Hover: text. Seleccionada: text + barra inferior 2px accent del ancho de la pestaña, radius 1px (pseudoelemento `::after`, bottom -1px). Foco visible: anillo con `outline-offset: -4px`. Un solo punto de tabulación; ←/→ cambian de pestaña con activación automática.

### 6.9 `shot-editor`

> **Disposición sustituida por 13.1.4** (cabecera, conmutador, filas de campos y Translation/Original). Textos, desplegables, errores, ayudas y pie siguen valiendo.

```
form.shot-editor [is-interview] [is-incomplete]   aria-labelledby=shot-editor-title novalidate; flex column; alto 100 %
├── header.shot-editor__header        padding 16px 16px 0
│   ├── div.shot-editor__heading      flex; align baseline; gap 8px
│   │   ├── h2.shot-editor__title  id=shot-editor-title   title: «Shot 12»
│   │   └── span.shot-editor__soundbite   (solo is-interview) overline, interview: «SOUNDBITE 1 · 18sec»
│   ├── p.shot-editor__timing         mono-sm a 400, text-tertiary, margin-top 2px: «00:00:41:03 – 00:00:45:08 · 4.2s»
│   └── p.shot-editor__missing        (solo is-incomplete) caption, warning, margin-top 4px: «Missing: shot size, description»
├── div.shot-editor__body             padding 16px; flex column; gap 16px; overflow-y auto; flex 1
│   ├── div.field.field--switch.shot-editor__interview
│   │   ├── label.switch  «Interview (soundbite)»
│   │   └── p.field__help
│   ├── fieldset.shot-editor__image   (oculto con is-interview; sin borde ni leyenda visible; legend visualmente oculta «Image»)
│   │   ├── div.shot-editor__row      grid 1fr 1fr; gap 12px
│   │   │   ├── div.field.field--select  «Shot size»
│   │   │   └── div.field.field--select  «Camera movement» + «Optional»
│   │   └── div.field.field--textarea «Description»
│   └── fieldset.shot-editor__soundbite-fields   (solo is-interview; legend visualmente oculta «Soundbite»)
│       ├── div.field  «Name»
│       ├── div.field  «Profession» + «Optional»
│       ├── div.shot-editor__row      grid 88px 1fr; gap 12px
│       │   ├── div.field  «Age» + «Optional»  (inputmode=numeric, maxlength 3)
│       │   └── div.field  «Language»
│       ├── div.field.field--segmented  «Gender»  (man | woman)
│       ├── div.field.field--textarea «Translation»
│       └── div.field.field--textarea «Original»
└── footer.shot-editor__actions       padding 12px 16px; borde superior 1px border; fondo surface; flex; gap 8px
    ├── button.button.button--secondary.shot-editor__copy [is-disabled]   icono copy + «Copy from previous»
    └── button.button.button--primary.shot-editor__next [is-disabled]     margin-left auto; icono next-pending + «Next pending» + kbd «Ctrl+Enter»
```
El conmutador de entrevista va arriba para que no cambie de sitio al mostrar u ocultar los grupos de campos.

Desplegables:
- Shot size: opción vacía «Select shot size», «Wide shot», «Mid shot», «Close-up».
- Camera movement: «None» (por defecto), «Pan right», «Pan left», «Tilt up», «Tilt down».

Marcadores de posición: Description «Describe what the shot shows»; Name «Full name»; Profession «e.g. Farmer»; Age «34»; Language «e.g. Spanish»; Translation «English translation of what they say»; Original «What they say, in the original language».

Ayuda del conmutador Interview (caption, text-tertiary, cifras reales):
- apagado: «Turning this on marks shots <n>–<last> as soundbites.» (n = plano actual, last = último plano). Ejemplo: «Turning this on marks shots 12–26 as soundbites.»
- encendido: «Turning this off unmarks shots <first>–<n>.» (first = primera entrevista). Ejemplo: «Turning this off unmarks shots 24–25.» Si first = n: «Turning this off unmarks this shot.»

Errores de campo: «Choose a shot size.», «Write a description.», «Enter the speaker's name.», «Age must be digits only, e.g. 34.», «Enter the language.», «Choose man or woman.», «Enter the translation.», «Enter the original quote.».

Botones del pie:
- «Copy from previous» `is-disabled` en el plano 1 (tooltip «No previous shot»). Habilitado en plano de imagen: tooltip «Copy shot size, movement and description from shot 11»; en entrevista: «Copy speaker details from shot 23». Qué campos copia lo fija `shot-model`; el tooltip los nombra.
- «Next pending» `is-disabled` si no queda ninguno (tooltip «All shots are complete»). Habilitado: tooltip «Go to shot 15 · Ctrl+Enter». Al usarlo, el foco va al primer campo obligatorio vacío del nuevo plano.

Al cambiar de plano con Alt+↑/↓ o la tira, el foco se queda en el mismo campo si existe en el nuevo plano; si no existe (cambio entre imagen y entrevista), va al primer campo del grupo visible.

### 6.10 `preview` (pestaña Preview, la monta `output-panel`)

> **Sustituido en parte por 13.2**: deja de ser pestaña y pasa a 2ª columna; `.preview__toolbar` desaparece (su contenido va a la cabecera de columna). `pre.preview__text`, bloques y huecos siguen valiendo; «al abrir la pestaña» se lee «al abrir la columna».

```
div.preview   flex column; alto 100 %
├── div.preview__toolbar   alto 36px; padding 0 16px; flex; align center; borde inferior 1px border
│   ├── span.preview__filename   mono-sm, text-secondary, elipsis: «<name>.txt»
│   └── span.preview__note       margin-left auto; caption, text-tertiary: «Live preview»
└── pre.preview__text   tabindex=0 aria-label="Shotlist preview"; flex 1; overflow auto; margin 0; padding 16px;
                        fondo sunken; tipografía preview; color text; white-space pre-wrap; overflow-wrap anywhere; user-select text
    ├── span.preview__block [is-current]   display block; un bloque por plano; is-current: fondo preview-current,
    │                                      box-shadow inset 2px 0 0 var(--color-accent), margin 0 -16px, padding 0 16px
    └── span.preview__missing              hueco de un dato que falta: color warning, fondo warning-bg, radius-sm, padding 0 2px:
                                           «[shot size]», «[description]», «[name]», «[language]», «[gender]», «[translation]», «[original]»
```
Al abrir la pestaña, el bloque `is-current` se desplaza al centro (`block: 'center'`). La vista previa se actualiza con cada pulsación, sin animación.

### 6.11 `modal` (sobrescritura)

```
div.modal-backdrop [is-open]   position fixed; inset 0; fondo backdrop; z --z-modal; flex centrado
└── div.modal  role=alertdialog aria-modal=true aria-labelledby=modal-title aria-describedby=modal-body
    │          ancho 440px; padding 24px; radius-xl; fondo raised; borde 1px border; shadow-3
    ├── h2.modal__title  id=modal-title   title: «Replace existing shotlist?»
    ├── p.modal__body    id=modal-body    body, text-secondary, margin-top 8px:
    │                                     «<name>.txt already exists in <folder>. Replacing it overwrites its contents.»
    │                                     (<name>.txt en mono-sm con color text)
    └── div.modal__actions   margin-top 24px; flex; justify end; gap 8px
        ├── button.button.button--secondary   «Cancel»
        └── button.button.button--primary     «Replace»
```
Foco inicial en «Cancel». Tab queda atrapado en el modal. Esc = Cancel; clic en el fondo = Cancel. Al cerrar, el foco vuelve a Generate.

### 6.12 `toast`

```
div.toast-region   position fixed; left 16px; bottom 16px; z --z-toast; aria-live=polite
└── div.toast.toast--success|toast--info  role=status
    │   ancho 360px; padding 12px 12px 12px 16px; flex; align start; gap 12px; fondo raised; borde 1px border; radius-lg; shadow-2
    ├── svg.icon.icon--check.toast__icon    16px, success (info: sin icono)
    ├── div.toast__content                  flex 1; min-width 0
    │   ├── p.toast__title                  control a 13px/600, text: «Shotlist saved»
    │   └── p.toast__detail                 mono-sm a 400, text-secondary, elipsis: «<name>.txt»
    ├── button.button.button--secondary.toast__action   icono folder + «Show in folder»
    └── button.icon-button.toast__close     aria-label «Dismiss», icono close 16px
```
Posición: abajo a la izquierda, sobre el principio de la tira de planos (no tapa el editor ni sus botones). Éxito: se cierra solo a los 8000ms; info: 5000ms; la cuenta se pausa con el puntero encima o con foco dentro. Un solo toast a la vez: uno nuevo sustituye al anterior. No roba el foco.

Toast info: borrador restaurado al abrir un vídeo con notas guardadas: título «Draft restored», detalle «18 of 26 shots annotated».

### 6.13 Utilidades

- `.visually-hidden`: oculto a la vista, legible por lector de pantalla (clip rect, 1×1 px).
- `.sr-status`: región `aria-live=polite` visualmente oculta. Anuncia al cambiar de plano «Shot 12 of 26, incomplete» y al terminar las miniaturas «Thumbnails ready».
- `.spinner`: svg spinner, 16px por defecto, color actual.

---

## 7. Jerarquía visual

### Inicio
1. Manda: las dos zonas de soltar, de igual peso, lado a lado (vídeo a la izquierda, XML a la derecha: orden del flujo).
2. Secundario: título y frase de entrada, encima.
3. Terciario: la pista sobre arrastrar a cualquier parte y la carga automática del XML.
Todo cabe sin desplazar a 1100×700 (título 36 + frase 28 + 32 + zonas 200 + pista 32 ≈ 330 px con 12vh ≈ 84 px arriba).

### Espacio de trabajo

> **Sustituido por 13.5.**
1. Manda: el vídeo (mayor superficie y único bloque sobre negro).
2. Segundo: el editor del plano en la columna derecha, donde se escribe. El título «Shot 12» es el texto más grande del espacio de trabajo.
3. Tercero: la tira de planos, que orienta (qué plano, cuáles faltan).
4. Cuarto: la barra superior (fuentes, progreso, Generate). Generate es el único botón con relleno de acento visible además de «Next pending»; en `is-disabled` pierde el relleno para no competir.
Orden de lectura: barra superior → vídeo → controles → tira → cabecera → pestañas → editor. Sin desplazar a 1440×900: todo el editor de un plano de imagen. A 1100×700 el editor de entrevista desplaza desde «Translation».

---

## 8. Microinteracciones

| Qué | Propiedad | Duración | Curva |
|---|---|---|---|
| hover de botones, chips, tarjetas, pestañas | background-color, border-color, color, box-shadow | 90ms (`--motion-fast`) | `--ease-standard` |
| foco de campos | border-color, box-shadow | 90ms | `--ease-standard` |
| conmutador | transform del botón, background-color de la pista | 150ms (`--motion-base`) | `--ease-out` |
| segmentado, pestaña seleccionada | background-color, color | 150ms | `--ease-standard` |
| pista de la barra al hover | height 4→6px, playhead 12→14px | 90ms | `--ease-out` |
| botón pulsado | transform scale(0.96) play, scale(0.98) tarjeta | 90ms | `--ease-out` |
| punto de estado a completo | background-color; transform scale(0.6→1) | 150ms | `--ease-out` |
| relleno del contador | width | 150ms | `--ease-out` |
| cambio inicio → espacio de trabajo | opacity 0→1 del espacio de trabajo | 240ms (`--motion-slow`) | `--ease-out` |
| banner | opacity 0→1 | 150ms | `--ease-out` |
| toast entrada / salida | opacity 0→1 + translateY(8px→0) / opacity 1→0 | 240ms / 160ms (`--motion-exit`) | `--ease-out` / `--ease-in` |
| modal entrada | fondo opacity 150ms; caja opacity + scale(0.98→1) 180ms | 150ms / 180ms | `--ease-out` |
| modal salida | opacity 1→0 | 120ms | `--ease-in` |
| tooltip | opacity 0→1 tras 500ms de retardo | 90ms | `--ease-out` |
| arrastre sobre zona | border-color, background-color | 90ms | `--ease-standard` |
| desplazamiento de la tira al plano seleccionado | `scroll-behavior: smooth` | nativo | nativo |
| skeleton de miniatura | background-position, infinito | 1200ms (`--motion-shimmer`) | linear |
| spinner | rotate 360°, infinito | 800ms (`--motion-spinner`) | linear |

Sin animación: selección de tarjeta (contorno inmediato), tramo del plano actual, cabezal, texto de la vista previa, cambio de pestaña (**sin pestañas desde 13.2**), aparición de los grupos de campos de entrevista.

`@media (prefers-reduced-motion: reduce)`: todas las `transform` se anulan (sin escala ni desplazamiento); las transiciones de opacidad se mantienen a 90ms; `scroll-behavior: auto`; el skeleton queda estático en `--color-skeleton`; el spinner gira a 1600ms (es un indicador de estado, pequeño y sin desplazamiento de página).

---

## 9. Accesibilidad

- Contrastes: tabla 1.1. Todo texto ≥ 4,5:1 en ambos temas; bordes de control, anillo de foco, marcas y puntos de estado ≥ 3:1.
- Foco: anillo 2px `--color-focus` con separación 2px en todo control, solo con `:focus-visible`; campos con borde + sombra de acento. El foco nunca queda oculto bajo el pie fijo del editor (`scroll-padding-bottom: 64px` en `.shot-editor__body`).
- Objetivos: mínimo 32×32 px en todo control (`--size-control`); play 40px; pestañas 40px (**sin pestañas desde 13.2**); campos 36px. Separación mínima de 4px entre objetivos contiguos.
- El estado nunca depende solo del color: completo = punto relleno, incompleto = anillo; entrevista = insignia con texto; error = icono + texto; seleccionado = contorno + color + `aria-selected`.
- Landmarks (**ampliado en 13.6**): `header.topbar` (banner), `main` (`.workspace__main` o `.home`), `aside.sidebar` con `aria-label="Shot details"`.
- Roles: tira `listbox`/`option`; pestañas `tablist`/`tab`/`tabpanel`; barra de progreso `slider`; carga de miniaturas `progressbar`; género `radiogroup`; conmutadores `input type=checkbox role=switch`; modal `alertdialog`; banner de error `alert`, de aviso `status`; toast `status` en región `aria-live=polite`; tooltip `tooltip` por `aria-describedby`.
- Textos alternativos: todos los svg `aria-hidden`; todo icon-button con `aria-label`; miniaturas `alt=""` porque la tarjeta lleva `aria-label` completo; vídeo con `aria-label="Video: <name>"`.
- Campos: `label for` en todos; ayuda y error en `aria-describedby`; `aria-invalid="true"` con `is-error`; `aria-required="true"` en obligatorios.
- Orden de tabulación (espacio de trabajo) (**sustituido por 13.6**): chip vídeo → chip XML → Generate → acciones del banner (si hay) → barra de progreso → plano anterior → play → plano siguiente → Stop at end of shot → mudo → volumen → tira (un punto) → Location → Date → Source → pestañas (un punto) → Interview → Shot size → Camera movement → Description (o los campos de entrevista en su orden) → Copy from previous → Next pending → toast (si hay). Inicio: Examinar vídeo → Examinar XML.
- Esc: cierra modal o tooltip; en un campo, quita el foco (lo devuelve al cuerpo, sin perder el valor).

---

## 10. Estados de pantalla resumidos

| Estado | Dónde se ve |
|---|---|
| sin ficheros | inicio, dos zonas vacías |
| un fichero cargado | su zona `is-loaded`, la otra vacía |
| ambos cargados, calculando | ambas `is-loaded`, `.home__status` «Detecting shots…» |
| error de vídeo o XML en inicio | zona `is-error` |
| miniaturas cargando | `.filmstrip.is-loading`, tarjetas `is-loading` |
| plano normal / entrevista / incompleto | `shot-card` y `shot-editor` con sus clases |
| error de vídeo o XML en trabajo | `banner--error` y, si es el vídeo, `.player__stage.is-error` |
| XML y vídeo no casan | `banner--warning` |
| sobrescritura | `modal` |
| guardado | `toast--success` |
| borrador restaurado | `toast--info` |

---

## 11. Responsive

> **Sustituido en parte por 13.7**: ventana mínima 1280 px, `--size-sidebar` y `.header-fields__row` de las bandas, `.player__shot-label` y `--size-volume` (pasan a consultas de contenedor), y la frase «nada se reordena».

Solo escritorio; la ventana no baja de 1100×700.

| Ancho | Cambios |
|---|---|
| 1100–1280 px (compacto) | `--size-sidebar: 360px`; `--size-main-padding: 12px`; row-gap de `.workspace__main` 8px; `--size-thumb-w: 112px`, `--size-thumb-h: 63px`, `--size-filmstrip: 116px`; `.player__shot-label` oculto (el dato sigue en `aria-valuetext` y en el editor); `--size-volume: 64px`; `.header-fields__row` a `1fr 136px`; `--size-chip-max: 200px`; `.progress__bar` oculto (queda la etiqueta); `--font-size-preview: 12px`, `--font-line-preview: 18px`; inicio: `--size-dropzone-h: 200px`, `--size-home-max: 800px` |
| 1281–1679 px (estándar) | valores de `:root` |
| ≥ 1680 px (amplio) | `--size-sidebar: 440px`; `--size-main-padding: 20px`; `--size-thumb-w: 144px`, `--size-thumb-h: 81px`, `--size-filmstrip: 140px` |

| Alto | Cambios |
|---|---|
| ≤ 760 px | `.header-fields` padding 12px 16px y título «HEADER» oculto; inicio: `padding-top: 6vh` |

Media queries exactas: `(max-width: 1280px)`, `(min-width: 1680px)`, `(max-height: 760px)`.

Nada se reordena en ningún punto: la columna derecha siempre está a la derecha y la tira siempre bajo el vídeo.

---

## 13. Revisión 2: columnas y traducción

Esta sección manda sobre todo lo anterior que la contradiga (marcado «sustituido» en su sitio). Sin colores nuevos: todo usa tokens de la sección 1.

### 13.1 Columna de edición a doble ancho

#### 13.1.1 Tokens nuevos y cambiados

```css
:root {
  --size-window-min-w: 1280px;      /* antes 1100px; = 460 + 520 + 300 */
  --size-video-min: 460px;          /* mínimo de la columna de vídeo */
  --size-sidebar: 800px;            /* ancho ideal de la columna de edición (antes 400px) */
  --size-sidebar-min: 520px;        /* mínimo de la columna de edición */
  --size-preview: 440px;            /* ancho ideal de la columna Preview */
  --size-preview-min: 300px;        /* mínimo de la columna Preview */
  --size-pane-header: 40px;         /* cabecera de la columna Preview */
  --size-pane-slide: 16px;          /* desplazamiento de entrada de la columna Preview */
  --size-header-date: 176px;        /* columna Date de header-fields */
  --size-shot-select-col: 224px;    /* columna de Shot size y Camera movement */
  --size-age: 80px;                 /* campo Age */
  --size-gender: 160px;             /* segmentado Gender (antes 200px) */
  --size-textarea-fill-min: 120px;  /* mínimo de Description, Translation y Original */
}
```

Ventana Electron: `minWidth 1280`, `minHeight 700`, inicial `1440×900`.

#### 13.1.2 Rejilla del espacio de trabajo y reparto del ancho

```css
.workspace {
  grid-template-columns:
    minmax(var(--size-video-min), 1fr)
    minmax(var(--size-sidebar-min), var(--size-sidebar));
}
.app.is-preview-open .workspace {
  grid-template-columns:
    minmax(var(--size-video-min), 1fr)
    minmax(var(--size-sidebar-min), var(--size-sidebar))
    minmax(var(--size-preview-min), var(--size-preview));
}
```

Reparto (es el algoritmo de rejilla de CSS, no hace falta JavaScript):
1. Cada columna recibe su mínimo: vídeo 460, edición 520, Preview 300 (suman 1280).
2. El sobrante se reparte a partes iguales entre edición y Preview hasta que cada una llega a su ancho ideal (`--size-sidebar`, `--size-preview`); la que llega antes deja de crecer y la otra se queda con el resto.
3. Lo que sobra después va entero al vídeo. El vídeo es la única columna que cede: no pasa de 460 px hasta que las otras dos están en su ancho ideal.

| Ventana | Preview | Vídeo | Edición | Preview |
|---|---|---|---|---|
| 1280 | cerrada | 560 | 720 | — |
| 1440 | cerrada | 640 | 800 | — |
| 1680 | cerrada | 800 | 880 | — |
| 1920 | cerrada | 1040 | 880 | — |
| 1280 (maximizada) | abierta | 460 | 520 | 300 |
| 1366 (maximizada) | abierta | 460 | 563 | 343 |
| 1680 (1280 + 400) | abierta | 560 | 720 | 400 |
| 1880 (1440 + 440) | abierta | 640 | 800 | 440 |
| 1920 (1600 + 440 con tope del área de trabajo) | abierta | 680 | 800 | 440 |
| 2160 (1680 + 480) | abierta | 800 | 880 | 480 |

Cuentas a 1440×900 con Preview cerrada: escenario 608×608 px útiles → vídeo 16:9 a 608×342, bandas negras de 133 px. A 1280×700: escenario 536×432 → vídeo 536×302.

#### 13.1.3 `header-fields` en una fila

```
section.header-fields   padding 16px; borde inferior 1px border   (igual que 6.7)
├── h2.header-fields__title   «HEADER»; margin-bottom 12px
└── div.header-fields__row    grid; column-gap 12px; row-gap 12px; align-items start
    ├── div.field  Location   grid-area location
    ├── div.field  Date       grid-area date
    └── div.field  Source     grid-area source   (pasa a estar dentro de la fila; sin margin-top)
```

| Ancho de `.sidebar` (consulta de contenedor) | `grid-template-columns` | `grid-template-areas` |
|---|---|---|
| ≥ 640px | `minmax(0, 1fr) var(--size-header-date) minmax(0, 1fr)` | `"location date source"` |
| < 640px | `minmax(0, 1fr) var(--size-header-date)` | `"location date" "source source"` |

A 800 px: Location 284, Date 176, Source 284. Alto del bloque: 141 px (antes ~180). La ayuda «Remembered for next time.» queda bajo Source; las otras dos celdas no reservan su hueco (`align-items: start`).

`.sidebar { container: sidebar / inline-size; }`. Las reglas `.header-fields__row` de la sección 11 (`1fr 150px`, `1fr 136px`) quedan sustituidas por esta tabla.

#### 13.1.4 `shot-editor` a doble ancho

```
form.shot-editor
├── header.shot-editor__header        padding 16px 16px 0
│   ├── div.shot-editor__heading      flex; align baseline; gap 8px; flex-wrap wrap; row-gap 2px
│   │   ├── h2.shot-editor__title     «Shot 12»
│   │   ├── span.shot-editor__soundbite   (solo entrevista)
│   │   └── p.shot-editor__timing     margin 0 0 0 auto: a la derecha, en la línea del título
│   └── p.shot-editor__missing        (solo incompleto) margin-top 4px
├── div.shot-editor__body             padding 16px; flex column; gap 16px; overflow-y auto; flex 1
│   ├── div.field.field--switch.shot-editor__interview   flex; align center; gap 12px; flex-wrap wrap
│   │   ├── label.switch              «Interview (soundbite)»
│   │   └── p.field__help             margin 0 (a la derecha del conmutador; baja de línea si no cabe)
│   ├── fieldset.shot-editor__image   flex 1 0 auto; display grid; column-gap 12px; row-gap 16px; align-items start
│   │       grid-template-columns: var(--size-shot-select-col) minmax(0, 1fr)
│   │       grid-template-rows: auto auto minmax(0, 1fr)
│   │       grid-template-areas: "size desc" "move desc" ". desc"
│   │   ├── div.field.field--select   «Shot size»        grid-area size
│   │   ├── div.field.field--select   «Camera movement»  grid-area move
│   │   └── div.field.field--textarea «Description»      grid-area desc; align-self stretch; flex column
│   │                                  textarea: flex 1; min-height var(--size-textarea-fill-min); overflow-y auto
│   └── fieldset.shot-editor__soundbite-fields   flex 1 0 auto; flex column; gap 16px
│       ├── div.shot-editor__speaker  grid; column-gap 12px; row-gap 16px; align-items start
│       │   ├── div.field  «Name»                  grid-area name
│       │   ├── div.field  «Profession» + Optional grid-area prof
│       │   ├── div.field  «Age» + Optional        grid-area age
│       │   ├── div.field  «Language»              grid-area lang
│       │   └── div.field.field--segmented «Gender»  grid-area gender; `.segmented` ancho 100 %
│       └── div.shot-editor__quotes   flex 1 0 auto; grid; column-gap 12px; row-gap 6px
│               grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)
│               grid-template-rows: auto minmax(var(--size-textarea-fill-min), 1fr) auto
│           ├── div.field.field--textarea.shot-editor__translation   grid-row 1 / span 3; display grid; grid-template-rows subgrid
│           │   ├── div.field__label-row   min-height 32px; align center   (lleva el botón Translate, 13.3)
│           │   ├── textarea               alto 100 % de su fila
│           │   └── p.field__error         (si hay)
│           └── div.field.field--textarea.shot-editor__original      igual; label-row min-height 32px aunque no lleve botón
└── footer.shot-editor__actions       sin cambios (6.9)
```

Fila de datos del hablante (consulta de contenedor `sidebar`):

| Ancho de `.sidebar` | `grid-template-columns` | `grid-template-areas` | A 800 px / 720 px |
|---|---|---|---|
| ≥ 760px (una línea) | `minmax(0, 1.4fr) minmax(0, 1.2fr) var(--size-age) minmax(0, 1fr) var(--size-gender)` | `"name prof age lang gender"` | Name 187, Profession 160, Age 80, Language 133, Gender 160 |
| < 760px (dos líneas) | `var(--size-age) minmax(0, 1fr) minmax(0, 1fr) var(--size-gender)` | `"name name prof prof" "age lang lang gender"` | a 720: Name 298, Profession 378; Age 80, Language 424, Gender 160 |

El orden del DOM (Name, Profession, Age, Language, Gender) no cambia; el orden visual de lectura coincide con el de tabulación en las dos disposiciones.

Translation y Original:
- Lado a lado, Translation a la izquierda, en todas las anchuras (a 520 px de columna quedan dos de 238 px).
- Misma altura siempre: la fila del control es común (`subgrid`); si uno de los dos muestra error, el error ocupa la tercera fila de los dos y las cajas siguen igualadas.
- Llenan el alto que queda en la columna (mínimo 120 px). Texto largo: `overflow-y: auto` dentro de la caja, barra de 8 px como la de la tira. Sin crecimiento automático: la regla de 5.3 «crece hasta 240px» ya no se aplica a Translation, Original ni Description.
- Alto resultante a 1440×900 en entrevista: 396 px por caja; a 1280×700: 158 px.

Plano de imagen: Description llena el alto restante con el mismo mínimo de 120 px; Shot size y Camera movement quedan apilados a su izquierda.

#### 13.1.5 Controles del reproductor según el ancho del vídeo

`.player { container: player / inline-size; }`. Sustituye a `.player__shot-label` oculto y `--size-volume: 64px` de la banda compacta.

| Ancho de `.player` | Qué cambia |
|---|---|
| ≥ 880px | todo visible (6.5); `--size-volume: 88px` |
| 520–879px | `.player__shot-label` y `.player__duration` ocultos (la duración pasa al `title` de `.player__timecode`: «Duration 00:03:12:05»); `.player__time` margin-left 12px; `.player__options` gap 12px; `--size-volume: 56px` |
| < 520px | lo anterior, y además la etiqueta de «Stop at end of shot» visualmente oculta (`.visually-hidden`; el conmutador conserva su nombre accesible y gana tooltip «Stop at end of shot»); `.player__time` margin-left 8px; `.player__options` gap 8px |

Consultas exactas: `@container player (min-width: 880px)`, `@container player (min-width: 520px) and (max-width: 879px)`, `@container player (max-width: 519px)`.

### 13.2 Columna Preview

Las pestañas Shot/Preview desaparecen: `.tabs`, `.tabs__list`, `.tabs__tab` y `.tabs__panel` se eliminan. El editor ocupa todo lo que queda bajo `header-fields`.

```
.app [is-preview-open]
└── .workspace
    ├── main.workspace__main
    ├── aside.sidebar  aria-label="Shot details"   flex column; min-height 0
    │   ├── section.header-fields
    │   └── div.sidebar__editor                    flex 1; min-height 0 → form.shot-editor
    └── aside.preview-pane  id=preview-pane  aria-label="Preview"  [hidden]
        │   grid-column 3; alto completo del espacio de trabajo; flex column; min-width 0; min-height 0; overflow hidden
        │   fondo surface; borde izquierdo 1px border; sin separación extra (igual que la columna de edición)
        ├── header.preview-pane__header   alto 40px (--size-pane-header); padding 0 4px 0 16px; flex; align center; gap 8px;
        │   │                              borde inferior 1px border
        │   ├── h2.preview-pane__title    mono-sm, text, elipsis, min-width 0, title = ruta completa: «<name>.txt»
        │   ├── span.preview-pane__note   margin-left auto; caption, text-tertiary; white-space nowrap: «Live preview»
        │   └── button.icon-button.preview-pane__close   32×32; icono close 16px; aria-label «Close preview»;
        │                                                tooltip «Close preview · Alt+P»
        └── div.preview                   flex 1; min-height 0 (6.10 sin .preview__toolbar)
            └── pre.preview__text         sin cambios (fondo sunken)
```

#### 13.2.1 Conmutador `preview-toggle` en la barra superior

```
div.topbar__actions   margin-left auto; flex; align center; gap 16px
├── div.progress
└── div.topbar__buttons   flex; align center; gap 8px
    ├── button.button.button--secondary.preview-toggle [is-active]
    │       aria-pressed="false|true" aria-controls=preview-pane
    │       svg.icon.icon--panel-right + span.button__label «Preview»
    └── button.button.button--primary.generate
```
Alto 32px, padding 0 12px, gap 6px, tipografía control. La etiqueta no cambia con el estado (el estado lo dicen `aria-pressed` y el aspecto). Tooltip en los dos estados: «Preview · Alt+P». Solo existe en el espacio de trabajo.

| Estado | Fondo | Borde 1px | Texto | Icono |
|---|---|---|---|---|
| cerrada, reposo (`aria-pressed=false`) | transparente | border-control | text | text-secondary |
| cerrada, hover | hover | border-hover | text | text |
| cerrada, pulsado (`:active`) | active | border-hover | text | text |
| abierta, reposo (`aria-pressed=true`, `is-active`) | accent-tint | accent | accent | accent |
| abierta, hover | accent-tint | accent-hover | accent | accent |
| abierta, pulsado | accent-tint + `box-shadow: inset 0 0 0 1px var(--color-accent)` | accent | accent | accent |
| foco visible (ambos) | anillo de foco de la sección 5 | — | — | — |
| desactivado / cargando | no tiene: abrir y cerrar son inmediatos y no dependen de datos | — | — | — |

Atajo Alt+P en cualquier sitio, también dentro de campos de texto; no actúa con un modal abierto.

#### 13.2.2 Ventana (proceso principal)

- Al abrir: el renderer lee `--size-preview` calculado con la columna aún cerrada (400, 440 o 480) y lo pide al proceso principal. Ancho nuevo = mín(ancho actual + Preview, ancho del área de trabajo de la pantalla). Si el borde derecho saldría del área de trabajo, la ventana se desplaza a la izquierda lo justo; nunca sale por la izquierda. Se guarda lo ensanchado y lo desplazado.
- Ventana maximizada o a pantalla completa: no cambia de tamaño; las columnas se reparten según 13.1.2.
- Al cerrar: se resta lo ensanchado (sin bajar de 1280) y se deshace el desplazamiento si el usuario no ha movido la ventana entre medias.
- La ventana no se anima nunca (`setBounds(bounds, false)`). El renderer aplica `is-preview-open` y quita `hidden` cuando el proceso principal responde, para que la columna aparezca en el mismo fotograma que el ensanche.
- Estado al arrancar: cerrada.

#### 13.2.3 Animación

| Qué | Propiedad | Duración | Curva |
|---|---|---|---|
| apertura de `.preview-pane` | opacity 0→1 + `translateX(var(--size-pane-slide))`→0; el ancho de la columna se reserva al instante (no se anima `grid-template-columns`) | 240ms (`--motion-slow`) | `--ease-out` |
| cierre de `.preview-pane` | sin animación: desaparece a la vez que la ventana se estrecha | — | — |
| `preview-toggle` al cambiar `aria-pressed` | background-color, border-color, color | 150ms (`--motion-base`) | `--ease-standard` |
| hover del conmutador y del botón cerrar | como 8 | 90ms | `--ease-standard` |

`.workspace { overflow: hidden }` evita que el desplazamiento de entrada asome fuera de la ventana. Al abrir, el bloque `is-current` de la vista previa se centra sin animación (`scrollIntoView({ block: 'center', behavior: 'auto' })`).

`prefers-reduced-motion: reduce`: sin `translateX`; solo opacity 0→1 en 90ms.

Foco: abrir o cerrar con el conmutador o con Alt+P deja el foco donde estaba. Cerrar con `preview-pane__close` lleva el foco al conmutador.

### 13.3 Traducción automática (Translate)

#### 13.3.1 Botón `translate-button`

```
div.field__label-row   (de Translation) min-height 32px; flex; align center; gap 6px
├── label.field__label     «Translation»
└── button.button.button--secondary.translate-button [is-disabled] [is-loading]
        type=button; margin-left auto
        svg.icon.icon--translate (16px) + span.button__label «Translate»
```
Alto 32px, padding 0 10px, gap 6px, tipografía control; ancho natural ≈ 98px, que se fija mientras carga.

| Estado | Aspecto | Tooltip |
|---|---|---|
| normal | `button--secondary` (5.1): borde border-control, texto text, icono text-secondary | «Translate Original into English (online service)» |
| hover / pulsado / foco visible | como 5.1 | igual |
| desactivado (`aria-disabled=true`, `is-disabled`): Original vacío o solo espacios | borde border, texto text-disabled, icono text-disabled; sigue enfocable | «Write the original text first» |
| cargando (`is-loading`, `aria-busy=true`) | contenido sustituido por spinner 16px en text; ancho fijo; no reacciona a clics | «Translating…» |

Campo Translation mientras carga: `readonly`, `aria-busy="true"`, fondo surface, borde 1px border, texto text-secondary, `cursor: progress`; si estaba vacío, marcador de posición «Translating…» en text-tertiary. Original sigue editable; lo que se traduce es el texto que había al pulsar. El estado de carga pertenece al plano: al cambiar de plano el editor muestra el del plano mostrado.

Al terminar bien: el texto sustituye al contenido de Translation de una vez, sin animación; Translation vuelve a editable; `.sr-status` anuncia «Translation ready» (al empezar anuncia «Translating…»). El foco no se mueve. Si había un banner `translate-failed`, se quita.

#### 13.3.2 Modal «Replace the current translation?»

Solo si Translation tiene texto (sin contar espacios) al pulsar Translate. Misma caja, medidas y comportamiento que 6.11:

```
div.modal  role=alertdialog aria-modal=true aria-labelledby=modal-title aria-describedby=modal-body
├── h2.modal__title   «Replace the current translation?»
├── p.modal__body     «The English text of this soundbite will be replaced by a new machine translation.»
└── div.modal__actions
    ├── button.button.button--secondary   «Cancel»
    └── button.button.button--primary     «Replace»
```
Foco inicial en «Cancel». Esc o clic en el fondo = Cancel. Al cerrar, el foco vuelve a Translate. «Replace» cierra el modal y pone Translate en `is-loading` (la petición sale después de confirmar).

#### 13.3.3 Aviso de error `translate-failed`

Banner existente (6.2) de tipo aviso: `div.banner.banner--warning.translate-failed role=status`. No bloquea el trabajo, por eso no es `banner--error`; si ya hay un banner de error, ese manda y el fallo se anuncia solo en `.sr-status` («Couldn't translate the text.»).

| Causa | Título | Detalle | Acciones |
|---|---|---|---|
| sin conexión | Couldn't translate the text. | You're offline. Connect to the internet and try again. | Try again, Dismiss |
| el servicio no responde a tiempo | Couldn't translate the text. | The translation service didn't answer. Try again in a moment. | Try again, Dismiss |
| el servicio devuelve error | Couldn't translate the text. | The translation service returned an error (<código>). Try again in a moment. | Try again, Dismiss |
| respuesta vacía | Couldn't translate the text. | The service returned no text for this quote. Check Original and try again. | Try again, Dismiss |

«Try again» (`button--secondary`) repite el flujo del botón Translate, con modal incluido si Translation tiene texto. Translation conserva lo que tenía antes del intento.

#### 13.3.4 Iconos nuevos (mismas reglas que la sección 3)

| Nombre | Trazado |
|---|---|
| `panel-right` | `rect x=3 y=4 w=18 h=16 rx=2`, `M15 4v16`, `M17.5 8.5h1.5`, `M17.5 12h1.5`, `M17.5 15.5h1.5` |
| `translate` | `M4 5h9`, `M8.5 3v2`, `M11 5c-.8 4-3.2 7-6.5 8.5`, `M6.5 9c1.2 1.8 3 3.2 5 4`, `M12.5 21l4.25-9 4.25 9`, `M14.2 17.5h5.1` |

### 13.4 Contrastes de esta revisión

Sin colores nuevos; las parejas salen de 1.1.

| Pareja | Oscuro | Claro | Uso |
|---|---|---|---|
| accent / accent-tint | 5,31 | 5,13 | texto e icono del conmutador Preview abierto |
| accent / surface | 6,59 | 5,78 | borde del conmutador abierto (gráfico ≥ 3:1) |
| text / surface | 15,20 | 17,76 | título de la columna Preview, conmutador cerrado, Translate |
| text-tertiary / surface | 5,18 | 5,28 | «Live preview», «Translating…» en Translation |
| text-secondary / surface | 7,52 | 7,61 | texto de Translation en solo lectura |
| text / sunken | 16,70 | 16,71 | texto de la vista previa |
| border-control / surface | 3,51 | 3,56 | borde de Translate y del conmutador cerrado |
| text / warning-bg | 12,65 | 13,38 | título del banner `translate-failed` |
| text-secondary / warning-bg | 6,26 | 6,65 | detalle del banner `translate-failed` |

El borde de Translation en solo lectura (`--color-border`) no llega a 3:1; no hace falta porque el campo no admite escritura en ese estado y el botón muestra el spinner.

### 13.5 Jerarquía visual del espacio de trabajo

1. Manda: el vídeo, único bloque sobre negro y primer punto de lectura arriba a la izquierda. Por superficie le supera la columna de edición; el vídeo manda por contraste y posición.
2. Segundo: el editor del plano. «Shot 12» sigue siendo el texto más grande del espacio de trabajo.
3. Tercero: la tira de planos.
4. Cuarto, si está abierta: la columna Preview (fondo sunken, texto monoespaciado, sin acento salvo el bloque actual).
5. Quinto: la barra superior. Rellenos de acento: Generate y Next pending; el conmutador Preview abierto usa solo el tinte de acento para no competir.

Orden de lectura: barra superior → vídeo → controles → tira → cabecera → editor → Preview. Sin desplazar, a 1440×900 y a 1280×700, cabe el editor completo de un plano de imagen y de una entrevista, sin mensajes de error.

### 13.6 Accesibilidad

- Landmarks: `header.topbar`, `main.workspace__main`, `aside.sidebar` «Shot details», `aside.preview-pane` «Preview» (solo con la columna abierta; cerrada lleva `hidden`).
- Roles: desaparecen `tablist`, `tab` y `tabpanel`. Conmutador Preview: `button` con `aria-pressed` y `aria-controls`. Translate: `button` con `aria-disabled` o `aria-busy`; Translation con `aria-busy` y `readonly` mientras carga.
- Orden de tabulación: chip vídeo → chip XML → Preview → Generate → acciones del banner (si hay) → barra de progreso → plano anterior → play → plano siguiente → Stop at end of shot → mudo → volumen → tira (un punto) → Location → Date → Source → Interview → Shot size → Camera movement → Description (entrevista: Name → Profession → Age → Language → Gender → Translate → Translation → Original) → Copy from previous → Next pending → Close preview → texto de la vista previa → toast (si hay).
- Objetivos: Translate, conmutador Preview y cerrar Preview miden 32 px de alto, el mínimo del proyecto (`--size-control`).
- Textos alternativos: iconos `aria-hidden`; el botón cerrar lleva `aria-label`; Translate y Preview tienen etiqueta visible.

### 13.7 Responsive

Solo escritorio; la ventana no baja de 1280×700.

Bandas por ancho de ventana. Con Preview abierta, las del espacio de trabajo se desplazan el ancho de la columna, para que abrirla no cambie el tamaño del vídeo ni del editor:

| Preview | Compacta | Estándar | Amplia |
|---|---|---|---|
| cerrada | ≤ 1280 px: `--size-sidebar: 720px`, `--size-preview: 400px` y el resto de la banda compacta de 11 | 1281–1679 px: `:root` (800 / 440) | ≥ 1680 px: `--size-sidebar: 880px`, `--size-preview: 480px` y el resto de la banda amplia de 11 |
| abierta | ≤ 1680 px | 1681–2159 px | ≥ 2160 px |

```css
@media (max-width: 1280px) { :root { --size-sidebar: 720px; --size-preview: 400px; } }
@media (min-width: 1680px) { :root { --size-sidebar: 880px; --size-preview: 480px; } }

@media (max-width: 1680px) {
  .app.is-preview-open {
    --size-sidebar: 720px; --size-preview: 400px; --size-main-padding: 12px;
    --size-thumb-w: 112px; --size-thumb-h: 63px; --size-filmstrip: 116px;
    --font-size-preview: 12px; --font-line-preview: 18px;
  }
  .app.is-preview-open .workspace__main { row-gap: 8px; }
}
@media (min-width: 1681px) and (max-width: 2159px) {
  .app.is-preview-open {
    --size-sidebar: 800px; --size-preview: 440px; --size-main-padding: 16px;
    --size-thumb-w: 128px; --size-thumb-h: 72px; --size-filmstrip: 128px;
    --font-size-preview: 13px; --font-line-preview: 20px;
  }
  .app.is-preview-open .workspace__main { row-gap: 12px; }
}
/* ≥ 2160px con Preview abierta: sin regla; vale la banda amplia de :root */
```

Lo que pertenece a la barra superior (`--size-chip-max`, `.progress__bar` oculto) sigue la banda de la ventana sin desplazar, porque la barra ocupa todo el ancho.

Consultas de contenedor (no dependen de la ventana sino del ancho real de cada columna):

| Contenedor | Umbral | Cambio |
|---|---|---|
| `sidebar` | < 640px | `header-fields` en dos líneas (13.1.3) |
| `sidebar` | < 760px | datos del hablante en dos líneas (13.1.4) |
| `player` | 880 / 520 px | tres niveles de controles (13.1.5) |

Alto ≤ 760 px: sin cambios respecto a 11.

Reordenaciones: solo las dos de `sidebar` (Source baja a una segunda línea; la fila del hablante pasa a dos líneas). El orden del DOM y de tabulación no cambia. Las columnas siempre van vídeo → edición → Preview, de izquierda a derecha.

### 13.8 Botón «Translate all»
`button.button.button--secondary.translate-all` en `.topbar__buttons`, a la izquierda de `preview-toggle`; 32 px de alto, padding 0 12px, gap 6px, icono `translate` 16 px + etiqueta «Translate all». Estados, spinner y contrastes idénticos a `translate-button` (13.3.1); oculto (`hidden`) si no hay planos de entrevista. Al terminar con éxito: toast `success` «Translated N soundbite(s).» con detalle «Review the translations before generating.». Con fallos: aviso `banner--warning.translate-failed` «Couldn't translate N soundbite(s).» con detalle «Shot 26: <causa>» (primeros 2 planos fallidos, `and N more` si hay más) y acción «Try again» que reintenta solo los pendientes.

---

## 14. Revisión 4: transcripción e idioma

Esta sección manda sobre todo lo anterior que la contradiga (6.9, 13.3.1, 13.3.2 y 13.6). Sin colores nuevos: todo usa tokens de la sección 1; un token nuevo de movimiento (14.3). Canales y errores los fija `docs/modulos/transcribe.md`; aquí, aspecto, textos y comportamiento visible.

### 14.1 Botón `transcribe-button`

Gemelo de `translate-button` (13.3.1), en la fila de la etiqueta de Original:

```
div.field__label-row   (de Original) min-height 32px; flex; align center; gap 6px; flex-wrap nowrap
├── label.field__label     «Original»; min-width 0; white-space nowrap; overflow hidden; text-overflow ellipsis
└── button.button.button--secondary.transcribe-button [is-disabled] [is-loading]
        type=button; margin-left auto; flex none; aria-label «Transcribe» (fijo: al cargar, el contenido es solo el spinner)
        svg.icon.icon--transcribe (16px) + span.button__label «Transcribe»
```
Alto 32px, padding 0 10px, gap 6px, tipografía control; ancho natural ≈ 106px, que se fija mientras carga. Icono en text-secondary (text con hover o pulsado, text-disabled desactivado), igual que Translate: las reglas `.translate-button` de `renderer/css/controls.css` se amplían a `.transcribe-button`, y `.field__label-row:has(.translate-button)` pasa a `.field__label-row:has(.translate-button, .transcribe-button)`. La regla de la etiqueta (`min-width 0`, `nowrap`, elipsis) vale también para la fila de Translation.

Siempre en el DOM; el grupo de soundbite lo oculta en los planos de imagen. El contenido de Original no condiciona el botón (con texto, pide confirmación: 14.2).

| Estado (en orden de prioridad) | Clase y atributos | Aspecto | Tooltip |
|---|---|---|---|
| cargando: este plano se está transcribiendo | `is-loading`, `aria-busy=true` | spinner 16px en text; ancho fijo; no reacciona a clics | «Transcribing…» |
| desactivado: falta la herramienta (`transcriberStatus().available === false`) | `is-disabled`, `aria-disabled=true` | borde border, texto e icono text-disabled; sigue enfocable | «Transcription is not installed» |
| desactivado: no hay vídeo cargado | `is-disabled`, `aria-disabled=true` | igual | «Load the video first» |
| desactivado: se transcribe otro plano | `is-disabled`, `aria-disabled=true` | igual | «Another cut is being transcribed» |
| listo | — | `button--secondary` (5.1): borde border-control, texto text, icono text-secondary; hover, pulsado y foco visible como 5.1 | «Transcribe this cut from the video (runs on this computer)» |

Un vídeo con códec que Chromium no reproduce (`unsupported-codec`) no desactiva el botón: el audio lo extrae ffmpeg en el proceso principal.

Icono nuevo (reglas de la sección 3): tres barras de onda a la izquierda, tres líneas de texto a la derecha. Formato de `ICON_SHAPES` en `renderer/ui-kit.js`:

```js
transcribe: [
  ['path', { d: 'M4 10v4' }],
  ['path', { d: 'M7 6v12' }],
  ['path', { d: 'M10 9v6' }],
  ['path', { d: 'M14 8h6' }],
  ['path', { d: 'M14 12h6' }],
  ['path', { d: 'M14 16h4' }],
],
```

| Nombre | Trazado |
|---|---|
| `transcribe` | `M4 10v4`, `M7 6v12`, `M10 9v6`, `M14 8h6`, `M14 12h6`, `M14 16h4` |

A 16px las barras quedan a 2px entre ejes y las líneas empiezan 2,7px a la derecha de la última barra: no se tocan con el trazo de 1.75 (1,17px a esa escala).

### 14.2 Confirmación y estado mientras transcribe

Al pulsar «Transcribe» en estado listo:
1. Original con texto (sin contar espacios): modal de confirmación, misma caja, medidas y comportamiento que 6.11 y 13.3.2:
   ```
   div.modal  role=alertdialog aria-modal=true aria-labelledby=modal-title aria-describedby=modal-body
   ├── h2.modal__title   «Replace the current original text?»
   ├── p.modal__body     «The original text of this soundbite will be replaced by a new transcription.»
   └── div.modal__actions
       ├── button.button.button--secondary   «Cancel»
       └── button.button.button--primary     «Replace»
   ```
   Foco inicial en «Cancel». Esc o clic en el fondo = Cancel. Al cerrar, el foco vuelve a Transcribe. «Replace» cierra el modal y pone Transcribe en `is-loading` (la transcripción empieza después de confirmar).
2. Original vacío o solo espacios: empieza directamente.

Campo Original mientras transcribe (idéntico a Translation al traducir, 13.3.1): `readonly`, `aria-busy="true"`, fondo surface, borde 1px border, texto text-secondary, `cursor: progress`; si estaba vacío, marcador de posición «Transcribing…» en text-tertiary (al terminar vuelve a «What they say, in the original language»).

Durante la transcripción del plano mostrado:
- Translate pasa a `is-disabled` con tooltip «Wait for the transcription to finish» (traduciría un texto a punto de cambiar). Translation sigue editable.
- Language sigue editable.
- El estado pertenece al plano: al cambiar de plano, el editor muestra el del plano mostrado; en cualquier otro plano de entrevista Transcribe queda desactivado con «Another cut is being transcribed».
- `.sr-status` anuncia «Transcribing…» al empezar.

Al terminar bien: el texto sustituye al contenido de Original de una vez, sin animación; Original vuelve a editable; el foco no se mueve. Translation no se toca (no se traduce sola). Si había un banner `transcribe-failed`, se quita.

### 14.3 Language tras transcribir

- Idioma detectado (`languageName` no nulo): Language recibe ese valor tal cual («English», «Spanish»…), aunque tuviera otro escrito. `.sr-status`: «Transcription ready (English)».
- Sin idioma detectado (`languageName` nulo): Language no cambia. `.sr-status`: «Transcription ready».
- Si al terminar se muestra otro plano, el anuncio lleva el plano delante: «Shot 24: transcription ready (English)» o «Shot 24: transcription ready». Sin realce (no se ve).

Realce breve de Language: sí, solo cuando su valor cambia de verdad (comparación sin mayúsculas y sin espacios en los extremos) y el plano está a la vista. Motivo: el cambio decide el sentido de la traducción (14.4) y ocurre lejos de donde mira el usuario.

```css
:root { --motion-autofill: 1600ms; }

@keyframes field-autofilled {
  from { background-color: var(--color-accent-tint); border-color: var(--color-accent); }
  to   { background-color: var(--color-field);       border-color: var(--color-border-control); }
}
.field__input.is-autofilled:not(:focus) {
  animation: field-autofilled var(--motion-autofill) var(--ease-in) both;
}
```
La clase `is-autofilled` se pone al escribir el valor y se quita en `animationend` o al cambiar de plano. Con foco en Language no hay realce (manda el foco de 5.3). `prefers-reduced-motion: reduce`: se mantiene (solo cambia el color; no hay desplazamiento). Sin icono ni ayuda nuevos: el alto de la fila del hablante no cambia.

### 14.4 La traducción sigue al idioma

Destino = `translationTarget(Language)` de `core/languages.js`: Language en inglés → español; cualquier otro, incluido vacío → inglés. Se recalcula con cada pulsación en Language y al cambiar de plano, sin animación.

| Texto | Language en inglés | Resto |
|---|---|---|
| tooltip de Translate listo (sustituye al de 13.3.1) | «Translate Original into Spanish (online service)» | «Translate Original into English (online service)» |
| marcador de Translation (sustituye al de 6.9) | «Spanish translation of what they say» | «English translation of what they say» |
| cuerpo del modal de 13.3.2 | «The Spanish text of this soundbite will be replaced by a new machine translation.» | «The English text of this soundbite will be replaced by a new machine translation.» (el texto actual) |

No cambian: la etiqueta «Translation», el error «Enter the translation.» ni el marcador «Translating…». «Translate all» (13.8) usa el destino de cada plano.

### 14.5 Aviso de error `transcribe-failed`

Banner de 6.2, tipo aviso: `div.banner.banner--warning.transcribe-failed role=status`; no bloquea el trabajo. Si ya hay un banner de error, ese manda y el fallo solo se anuncia en `.sr-status` con el título. Un banner a la vez: sustituye a un `translate-failed` visible.

| Título | Detalle | Acciones |
|---|---|---|
| «Couldn't transcribe shot <n>.» (n = número del plano: «Couldn't transcribe shot 24.») | `message` del error tal cual, p. ej. «No speech found in this cut.», «This video has no audio track to transcribe.», «Transcription took too long and was stopped.» | Try again (`button--secondary`), Dismiss (icon-button) |

«Try again» quita el banner y repite el flujo de 14.2 sobre el plano n, con modal incluido si Original tiene texto. Tras el fallo, Original conserva lo que tenía y Language no cambia.

### 14.6 Contrastes de esta revisión

Sin colores nuevos; fórmula de 1.1.

| Pareja | Oscuro | Claro | Uso |
|---|---|---|---|
| text / surface | 15,20 | 17,76 | etiqueta de Transcribe |
| border-control / surface | 3,51 | 3,56 | borde de Transcribe (gráfico ≥ 3:1) |
| text-secondary / surface | 7,52 | 7,61 | icono de Transcribe; Original en solo lectura |
| text-tertiary / surface | 5,18 | 5,28 | «Transcribing…» en Original vacío |
| text / accent-tint | 12,25 | 15,76 | valor de Language al empezar el realce |
| accent / surface | 6,59 | 5,78 | borde de Language al empezar el realce |
| text / warning-bg | 12,65 | 13,38 | título de `transcribe-failed` |
| text-secondary / warning-bg | 6,26 | 6,65 | detalle de `transcribe-failed` |

Exentos: texto desactivado (2,55 / 2,26; el tooltip explica la causa) y borde de Original en solo lectura (`--color-border` sobre surface, 1,28 / 1,30; no admite escritura y el botón muestra el spinner, como en 13.4).

### 14.7 Accesibilidad

- Transcribe: `button` con `aria-label` fijo «Transcribe» y `aria-disabled` o `aria-busy`; tooltip por `aria-describedby` (5.7) con el texto del estado. Original con `aria-busy` y `readonly` mientras transcribe.
- Objetivo: 32px de alto, el mínimo del proyecto (`--size-control`).
- Orden de tabulación de la entrevista (sustituye a ese tramo de 13.6): Name → Profession → Age → Language → Gender → Translate → Translation → Transcribe → Original.
- El realce de Language no es la única señal: el anuncio de `.sr-status` nombra el idioma.

### 14.8 Responsive

Sin puntos de ruptura nuevos. Ancho de la caja de Original, `(ancho de .sidebar − 32 − 12) / 2`: 238px a 520 (mínimo: Preview abierta en ventana compacta), 338px a 720, 378px a 800, 418px a 880. Fila de etiqueta en el mínimo: «Original» ≈ 46px + gap 6px + Transcribe ≈ 106px = 158px de 238px; sobran 80px. La fila no se parte nunca (`flex-wrap nowrap`); si faltara sitio, la etiqueta se recorta con elipsis y el botón conserva su ancho (`flex none`). Translation (Translate ≈ 98px) cumple lo mismo.

---

## 15. Detección automática de entrevistas

Esta sección manda sobre todo lo anterior que la contradiga (13.8, 14.1, 14.2 y 14.3 en lo que toca a la cola). Sin colores ni iconos nuevos; un token nuevo de tamaño. Todo lo demás sale de la sección 1. Comportamiento y canales: `docs/modulos/auto-interviews.md`; aquí, aspecto, textos y estados.

```css
:root { --size-detect-list-max: 200px; } /* 8 filas de 24px + 8px de relleno */
```

### 15.1 Modal `interview-detect`

Cuándo: al entrar en el espacio de trabajo tras cargar vídeo + XML, cuando termina la entrada de 240ms (`--motion-slow`, 8), solo sin borrador con entrevistas y si la detección propone algún plano. F = primer plano propuesto, L = último plano, k = L − F + 1 planos. Misma caja, fondo, animación, trampa de foco y cierre que 6.11 (`openConfirm`), con dos diferencias: más de dos enfocables y resultado numérico.

```
div.modal-backdrop.is-open
└── div.modal.interview-detect  role=alertdialog aria-modal=true aria-labelledby=modal-title aria-describedby=modal-body
    │   ancho 440px (--size-modal); padding 24px; radius-xl; fondo raised; borde 1px border; shadow-3   (6.11)
    ├── h2.modal__title  id=modal-title     title: «Interview cuts detected»
    ├── p.modal__body    id=modal-body      body, text-secondary, margin-top 8px (textos abajo)
    ├── div.interview-detect__range         margin-top 16px; flex; align center; gap 12px
    │   ├── p.interview-detect__count  aria-live=polite aria-atomic=true
    │   │                                   flex 1; min-width 0; 600 13px/16px --font-ui; text; tabular-nums
    │   └── div.interview-detect__stepper   role=group aria-label="Adjust interview shots"; flex none; flex; gap 8px
    │       ├── button.button.button--secondary.interview-detect__fewer [is-disabled]   «Fewer»
    │       └── button.button.button--secondary.interview-detect__more  [is-disabled]   «More»
    ├── ul.interview-detect__list           aria-label="Shots to mark"; margin-top 8px; padding 4px 0; list-style none;
    │   │                                   max-height var(--size-detect-list-max); overflow-y auto; fondo surface;
    │   │                                   borde 1px border; radius-md; barra de desplazamiento de 8px como la tira (6.6)
    │   └── li.interview-detect__item       flex; align center; justify space-between; alto 24px; padding 0 12px;
    │       │                               mono-sm (--font-mono 12px/500/16px); tabular-nums
    │       ├── span.interview-detect__shot      text: «Shot 27»
    │       └── span.interview-detect__duration  grosor 400, text-secondary: «23.4s»
    ├── p.interview-detect__empty           (solo con k = 0; sustituye a la lista) margin-top 8px; alto 40px; flex; align center;
    │                                       justify center; fondo surface; borde 1px border; radius-md; caption, text-tertiary:
    │                                       «Press More to add shots.»
    └── div.modal__actions                  margin-top 24px; flex; justify end; gap 8px   (6.11)
        ├── button.button.button--secondary.interview-detect__cancel    «Not interviews»
        └── button.button.button--primary.interview-detect__confirm [is-disabled]   «Mark as interviews»
```

Textos:
- Cuerpo con transcripción disponible (`transcriberStatus().available`): «These shots at the end of the sequence are long enough to be interviews. Marking them as soundbites also transcribes and translates them in the background.»
- Cuerpo sin transcripción instalada: «These shots at the end of the sequence are long enough to be interviews. Mark them as soundbites?» (al confirmar no hay cola: 15.2 no se aplica).
- Recuento: k ≥ 2 → «Shots 27–30 · 4 soundbites» (guion corto –); k = 1 → «Shot 30 · 1 soundbite»; k = 0 → «No shots selected».
- Duración de fila: formato de la tarjeta (6.6), segundos con un decimal y `s` sin espacio («23.4s»; no «0:23»), para que coincida con lo que se ve en la tira.
- Una fila por plano de F a L, en orden ascendente. Sin animación al añadir o quitar filas; tras cada cambio la lista vuelve arriba (`scrollTop = 0`), donde está la fila que cambió.

Ajuste (F va de 1 a L + 1; F = L + 1 equivale a k = 0):

| Control | Acción | Desactivado cuando | Tooltip (5.7) habilitado | Tooltip desactivado |
|---|---|---|---|---|
| Fewer | F + 1: quita el primer plano de la lista | k = 0 | «Remove shot 27» | «No shots left to remove» |
| More | F − 1: añade el plano anterior | F = 1 | «Add shot 26 (3.1s)» | «All shots are included» |
| Mark as interviews | cierra y resuelve con F | k = 0 | — | «Add at least one shot» |
| Not interviews | cierra y resuelve con `null`; no marca nada | nunca | — | — |

Estados de los cuatro botones: los de 5.1 (`button--secondary`, `button--primary`) en reposo, hover, pulsado y foco visible; desactivado = `is-disabled` + `aria-disabled=true`, sigue enfocable y el clic no hace nada. Sin estado cargando: confirmar cierra al momento y la cola arranca después. Sin estado de error: el modal no valida nada.

Teclado y foco:
- Foco inicial en «Mark as interviews»: la detección suele acertar y Enter la acepta.
- Tab y Mayús+Tab, atrapados en el modal: Fewer → More → lista (solo si desborda: `tabindex=0` cuando `scrollHeight > clientHeight`, para desplazarla con flechas) → Not interviews → Mark as interviews. En `openConfirm` la lista de enfocables (hoy fija `[cancel, replace]`) se calcula en cada Tab.
- Esc o clic en el fondo = «Not interviews».
- Si un botón del ajuste se desactiva con el foco encima, el foco se queda en él.
- Al cerrar, el foco vuelve al elemento que lo tenía si sigue en el documento y no es `body`; si no, a la tarjeta seleccionada de la tira.
- Cada cambio del recuento lo anuncia `p.interview-detect__count` (polite, atómico): «Shots 26–30 · 5 soundbites». Al abrir no anuncia (el texto ya está antes de insertar el nodo); título y cuerpo los lee el `alertdialog`.

Jerarquía: 1) título; 2) recuento con el ajuste en la misma línea; 3) lista, el dato que justifica la decisión; 4) botones. Todo sin desplazar la ventana; con más de 8 planos desplaza solo la lista.

### 15.2 Cola en segundo plano

Tras «Mark as interviews» con transcripción disponible, los planos F..L se marcan (cascada de ARQUITECTURA) y se transcriben uno a uno en orden; cada uno se traduce al acabar su transcripción, mientras empieza la del siguiente. Sentido de la traducción según Language (14.4). Nada bloquea la edición.

Sin pisar lo escrito y sin modales en segundo plano: cuando le llega el turno a un plano, se transcribe solo si Original está vacío (sin contar espacios) y se traduce solo si Translation está vacío; si no, ese paso se salta y cuenta como hecho.

#### 15.2.1 Toast inicial
`toast--info` (6.12, 5000ms, sin icono): título «Transcribing 4 soundbites in the background» (k = 1: «Transcribing 1 soundbite in the background»), detalle «You can keep working.». Lo anuncia la región `aria-live` de los toasts. Mientras dura la cola se suprimen los anuncios por plano de 13.3.1 y 14.3, como en «Translate all».

#### 15.2.2 Indicador `queue-status` en la barra superior

```
div.topbar__actions
├── div.queue-status [hidden]       primer hijo, a la izquierda de .progress; flex; align center; gap 6px; white-space nowrap
│   ├── svg.spinner                 16px; color text-secondary; aria-hidden
│   ├── span.queue-status__label    control (13px/500/16px, 0.005em), text-secondary, tabular-nums: «Transcribing 2 of 4…»
│   └── span.queue-status__short    aria-hidden=true; mismo estilo; oculto salvo en la banda compacta: «2/4…»
├── div.progress
└── div.topbar__buttons
```
- Texto: «Transcribing k of N…» mientras quede alguna transcripción; después «Translating k of N…» con las traducciones pendientes. k = posición en la cola (desde 1) del plano en curso; N = total al empezar, no baja con fallos ni saltos.
- Ni enfocable ni pulsable; sin `aria-live` (principio y fin los dan toast y banner). Visible desde que arranca la cola hasta el toast o banner final; después `hidden`, sin animación.
- «Translate all» (13.8) mientras dura: `is-disabled`, tooltip «Wait for the background transcription to finish».

#### 15.2.3 Marca en la tira: `.shot-card.is-processing`
No había patrón de «en proceso»; se usa el sitio del punto de estado, que cambia justo al acabar. En el plano en curso (transcribiendo o traduciendo), `.shot-card__status` pasa a `display: none` y en su lugar va `svg.spinner.shot-card__spinner`: 16px, `margin-left: auto`, color text-secondary sobre bg; la fila de 16px no cambia de alto. El `aria-label` de la tarjeta lleva sufijo: «Shot 27, soundbite 1, 23 seconds, incomplete, transcribing» | «…, translating». Los planos en espera no llevan marca (el recuento está en `queue-status`). `prefers-reduced-motion`: spinner a 1600ms (8).

#### 15.2.4 Editor de un plano de la cola
| Plano mostrado | Editor |
|---|---|
| transcribiéndose | 14.2: Transcribe `is-loading` («Transcribing…»), Original `readonly` + `aria-busy`, Translate `is-disabled` «Wait for the transcription to finish» |
| traduciéndose | 13.3.1: Translate `is-loading` («Translating…»), Translation `readonly` + `aria-busy`; Transcribe `is-disabled` «Another cut is being transcribed» si la cola transcribe otro |
| en espera | Transcribe `is-disabled`, tooltip nuevo «Queued for transcription»; Original y Translation editables (si se escribe, se salta ese paso) |
| ya hecho o fuera de la cola | 14.1: Transcribe `is-disabled` «Another cut is being transcribed» mientras la cola transcribe; Translate normal |

Cargar otro vídeo o XML para la cola sin aviso.

#### 15.2.5 Final
- Sin fallos: `toast--success` (8000ms, icono check): título «4 soundbites transcribed and translated.» (k = 1: «1 soundbite transcribed and translated.»), detalle «Review them before generating.».
- Con algún fallo: sin toast de éxito; `div.banner.banner--warning.interview-queue-failed role=status` (6.2) con «Try again» (`button--secondary`) y Dismiss (icon-button).

| Fallos | Título | Detalle |
|---|---|---|
| solo de transcripción | «Couldn't transcribe 1 soundbite.» / «Couldn't transcribe 2 soundbites.» | «Shot 28: <message>» por plano fallido, separados por «; », los dos primeros y luego « and N more.»; p. ej. «Shot 28: No speech found in this cut.» |
| solo de traducción | «Couldn't translate 1 soundbite.» / «Couldn't translate 2 soundbites.» (13.8) | igual, con la causa de 13.3.3 |
| de los dos tipos | «Couldn't finish 3 soundbites.» | igual |

Un plano cuya transcripción falla no se traduce. «Try again» quita el banner y lanza una cola nueva solo con los fallidos, cada uno desde el paso que falló, con su toast inicial (si solo quedan traducciones: «Translating 2 soundbites in the background»), indicador y final. Original y Translation de un fallido conservan lo que tenían. Con un banner de error a la vista, manda él y el fallo solo se anuncia en `.sr-status` con el título (13.3.3).

### 15.3 Contrastes

Sin colores nuevos; parejas de 1.1.

| Pareja | Oscuro | Claro | Uso |
|---|---|---|---|
| text / raised | 13,84 | 16,42 | título y recuento del modal, título de los toasts |
| text-secondary / raised | 6,84 | 7,04 | cuerpo del modal, detalle de los toasts |
| text / surface | 15,20 | 17,76 | «Shot 27» en la lista |
| text-secondary / surface | 7,52 | 7,61 | duraciones de la lista; `queue-status` y su spinner |
| text-tertiary / surface | 5,18 | 5,28 | «Press More to add shots.» |
| on-accent / accent | 6,76 | 5,78 | «Mark as interviews» |
| border-control / raised | **3,19** | 3,29 | borde de Fewer, More y Not interviews (gráfico ≥ 3:1) |
| text-secondary / bg | 8,04 | 6,55 | spinner de la tarjeta (gráfico) |
| text / warning-bg | 12,65 | 13,38 | título de `interview-queue-failed` |
| text-secondary / warning-bg | 6,26 | 6,65 | detalle de `interview-queue-failed` |
| focus / raised | 6,00 | 5,35 | anillo de foco dentro del modal |

Al límite: borde de los secundarios del modal en oscuro (3,19), ya aceptado en 1.1. El borde de la lista (`--color-border`) no llega a 3:1 ni lo necesita: la lista no es un control. Texto desactivado exento (2,55 / 2,26); cada botón desactivado explica la causa en tooltip.

### 15.4 Accesibilidad

- Roles: modal `alertdialog` con `aria-modal`, `aria-labelledby` y `aria-describedby`; ajuste `role=group` con nombre; recuento `aria-live=polite` + `aria-atomic=true`; lista `ul` con `aria-label`; `queue-status` sin live; banner `status`; toasts `status`.
- Objetivos: botones de 32px de alto (`--size-control`), el mínimo del proyecto; Fewer ≈ 64px y More ≈ 56px de ancho, 8px entre ellos. Las filas de la lista no son interactivas.
- Foco: anillo de 5 (2px `--color-focus`, separación 2px) en todo botón; la lista enfocable lo lleva con `outline-offset: -2px` para que no lo recorte su propio desbordamiento.
- El estado no depende solo del color: recuento con número; plano en proceso = spinner + sufijo en `aria-label`; fallo = icono + texto.
- Textos alternativos: spinners `aria-hidden`; `queue-status__short` `aria-hidden`; en la banda compacta `queue-status__label` pasa a `.visually-hidden` (nunca `display: none`) para conservar el texto completo.

### 15.5 Responsive

- Modal sin puntos de ruptura. 440px fijos caben en la ventana mínima (1280×700). Alto máximo: 24 + 24 título + 8 + 80 cuerpo (4 líneas de ≈ 55 caracteres) + 16 + 32 ajuste + 8 + 200 lista + 24 + 32 botones + 24 = 472px; a 700px de alto quedan 114px arriba y abajo, así que con alto ≤ 760px no cambia. Ancho útil 392px: pie ≈ 112 + 8 + 144 = 264px.
- `queue-status` sigue la banda de la ventana, como toda la barra superior (13.7): ≤ 1280px (`@media (max-width: 1280px)`), `.queue-status__label` en `.visually-hidden` y `.queue-status__short` visible («2/4…»), junto al `.progress__bar` ya oculto; ≥ 1281px, texto largo.
- Tira: con miniatura de 112px (banda compacta) caben número (3 cifras ≈ 22px) + 6 + duración («123.4s» ≈ 44px) + 6 + spinner 16px = 94px.

### 15.6 Clases y ficheros CSS

- `renderer/css/tokens.css`: `--size-detect-list-max`.
- `renderer/css/controls.css` (tras el modal de 6.11): `.interview-detect__range`, `__count`, `__stepper`, `__list`, `__list:focus-visible`, `__item`, `__shot`, `__duration`, `__empty`.
- `renderer/css/screens.css`: topbar → `.queue-status`, `.queue-status__label`, `.queue-status__short` y su regla en `@media (max-width: 1280px)`; shot-card → `.shot-card.is-processing .shot-card__status`, `.shot-card__spinner`.

## 16. Retranscripción al cambiar el idioma

Lo que no se dice aquí se hereda de 14 y 15 (mismos componentes, colores y accesibilidad). Sin CSS nuevo.

### 16.1 Campo Language
- `input` con `list="shot-editor-language-list"`: `datalist` con English, Spanish, Catalan, Basque, Galician, French, German, Italian, Portuguese. Sigue aceptando texto libre.
- Al salir del campo (o Intro) con otro idioma reconocido en un plano de entrevista ya transcrito, se abre el modal 16.2. Mientras se escribe, nada.

### 16.2 Modal `retranscribe`
`alertdialog` del mismo patrón que «Replace the current original text?».
- Título: «Transcribe shot 7 again in French?»
- Cuerpo: «The original text will be replaced by a new transcription in French, and the translation will be updated. This runs in the background; you can keep working.»
- Botones: primario «Retranscribe», secundario «Not now». Escape y clic fuera = «Not now».
- «Not now» no deshace el cambio de Language.

### 16.3 Cola
- Toast inicial (solo al arrancar la cola, no al añadir): `toast--info`, «Retranscribing 1 soundbite in the background» / «Retranscribing 2 soundbites in the background», detalle «You can keep working.».
- Añadir con la cola en marcha: sin toast; `.sr-status` anuncia «Shot 7 added to the queue».
- `queue-status`: «Retranscribing k of N…» mientras transcribe; «Translating k of N…» después, con traducciones pendientes. N sube al añadir planos. Con la cola de 15 en marcha, manda la de 15.
- Tira y editor: como 15.2.3 y 15.2.4; un plano en espera de retranscripción lleva el tooltip «Queued for transcription».
- Final sin fallos: `toast--success`, «2 soundbites retranscribed.» (k = 1: «1 soundbite retranscribed.»), detalle «Review them before generating.». Nada hecho → sin toast.
- Con fallos: `div.banner.banner--warning.retranscribe-failed role=status`, con las mismas reglas de título y detalle que `interview-queue-failed` (15.2.5) y «Try again».
