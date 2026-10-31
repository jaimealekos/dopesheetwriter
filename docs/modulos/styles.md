# Módulo `styles`

Nivel: normal.
Responsabilidad: `renderer/index.html` (esqueleto estático y CSP) y `renderer/styles.css` (toda la hoja de estilos) según `docs/DISENO-GRAFICO.md`.

## Ficheros
- Código: `renderer/index.html`, `renderer/styles.css` (solo `@import` de los ficheros siguientes, en este orden) y `renderer/css/tokens.css` (sección 1 del diseño + reinicio + media queries de la sección 11 y reduced-motion), `renderer/css/controls.css` (secciones 5, 6.2, 6.11, 6.12, 6.13 y 13.3: button, icon-button, field, switch, segmented, source-chip, tooltip, banner, modal, toast, progress, utilidades), `renderer/css/screens.css` (esqueleto `.app`, topbar, home, dropzone, drop-overlay, player, filmstrip, shot-card, header-fields, shot-editor, preview). Tres agentes escriben un fichero cada uno; la CSP permite `@import` local.
- Pruebas: `test/styles.test.js` (comprobaciones de texto sobre los dos ficheros, sin navegador).
- Referencia obligatoria: `docs/DISENO-GRAFICO.md` (léelo entero). Sus valores se copian tal cual; los nombres de clase son los suyos. Los demás módulos de interfaz construyen el DOM de cada componente con esos mismos nombres: no inventes clases nuevas salvo las de esqueleto listadas abajo.

## Esqueleto de `index.html`
`<!doctype html><html lang="en">`, `<meta charset="utf-8">`, `<title>Dopesheet Writer</title>`, `<link rel="stylesheet" href="styles.css">`, `<script type="module" src="app.js"></script>` al final del `body`, y esta `<meta http-equiv="Content-Security-Policy">`:
`default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' file: blob:; font-src 'self'; base-uri 'none'; form-action 'none'`.
(Por la CSP no hay `style="..."` en el HTML ni scripts en línea; los módulos usan solo la API CSSOM `el.style.propiedad = ...`.)

```html
<body>
<div class="app" id="app">
  <header class="topbar" id="topbar">
    <div class="topbar__brand">Dopesheet Writer</div>
    <div class="topbar__sources" id="topbar-sources" hidden></div>
    <div class="topbar__actions" id="topbar-actions" hidden></div>
  </header>
  <div id="banner-region"></div>
  <main class="home" id="home"> <!-- .home__inner con título, lead, .home__zones (#home-zones), .home__hint, .home__status (#home-status, hidden) --> </main>
  <div class="workspace" id="workspace" hidden>
    <main class="workspace__main">
      <section class="player" id="player-root"></section>
      <section class="filmstrip" id="filmstrip-root"></section>
    </main>
    <aside class="sidebar" aria-label="Shot details">
      <section class="header-fields" id="header-fields-root"></section>
      <div class="sidebar__editor" id="editor-root"></div>
    </aside>
    <aside class="preview-pane" id="preview-pane" aria-label="Preview" hidden></aside>
  </div>
  <div class="drop-overlay" id="drop-overlay" aria-hidden="true"> <!-- .drop-overlay__panel con icono, título y subtítulo del diseño 6.4 --> </div>
  <div class="toast-region" id="toast-region" aria-live="polite"></div>
  <div id="modal-root"></div>
  <div class="visually-hidden sr-status" id="sr-status" aria-live="polite"></div>
</div>
</body>
```
El `.home__inner` (título «Dopesheet Writer», lead «Load the edited video and its XML to start writing the shotlist.», `.home__zones` vacío con id `home-zones` donde `setup-panel` mete las dos zonas, `.home__hint`, `.home__status` oculto con id `home-status`) va escrito en el HTML con los textos de la sección 4.2 del diseño. El `.drop-overlay` lleva el icono `drop` inline (svg con las reglas de la sección 3) y los textos de 6.4. Los ids de arriba son contrato: los usa `app.js` para montar cada módulo.

## Hoja `styles.css`
- Bloque `:root` de variables y el `@media (prefers-color-scheme: light)` copiados del diseño (sección 1); media queries de la sección 11 (`(max-width: 1280px)`, `(min-width: 1680px)`, `(max-height: 760px)`) y `prefers-reduced-motion` de la sección 8.
- Reinicio mínimo: `box-sizing: border-box`, márgenes a 0, `html, body { height: 100% }`, fondo `var(--color-bg)`, color `var(--color-text)`, `font: var(--font-weight-body) var(--font-size-body)/var(--font-line-body) var(--font-ui)`, `-webkit-font-smoothing: antialiased`, `overflow: hidden` en `body`, `[hidden] { display: none !important }`, barras de desplazamiento según la sección 6.6 (8px, pulgar `--color-scrollbar`).
- Un bloque de reglas por componente del diseño (secciones 4–6), con todos sus estados y modificadores (`is-selected`, `is-complete`, `is-incomplete`, `is-interview`, `is-dragover`, `is-loading`, `is-loaded`, `is-error`, `is-disabled`, `is-open`, `is-visible`, `is-current`, `is-checked`, `is-active`, `is-playing`, `is-muted`, `is-empty`, `is-thumb-error`). Incluye `.visually-hidden`, `.sr-status`, `.spinner` (animación `rotate`), `.icon` (16px, `flex: none`), `.icon--player`, `.icon--dropzone`, `.kbd`, `.tooltip` y `.tooltip-layer` (capa `position: fixed; inset: 0; pointer-events: none; z-index: var(--z-tooltip)` para el tooltip único).
- Clases de esqueleto añadidas (no están en el diseño): `.app` (grid `rows: var(--size-topbar) auto 1fr`), `.home__inner`, `.home__title`, `.home__lead`, `.home__zones`, `.home__hint`, `.home__status`, `.workspace`, `.workspace__main`, `.sidebar`. Su geometría está en las secciones 4.1 y 4.2.
- Todo color, tamaño, radio, sombra, duración y curva sale de variables; los únicos números sueltos permitidos son los que el diseño escribe como valor literal en un componente (p. ej. 1.5px del borde discontinuo).

## Errores
No aplica (ficheros estáticos).

## Dependencias
- Internas: ninguna. Externas: ninguna.

## Revisión 2 (columnas y traducción)
Todo lo de la sección 13 de `docs/DISENO-GRAFICO.md` sustituye a lo anterior que contradiga: tokens nuevos (13.1.1), rejilla con `.app.is-preview-open` (13.1.2), `header-fields` en fila (13.1.3), `shot-editor` ancho (13.1.4), controles del reproductor por niveles de ancho (13.1.5, con media queries por contenedor o por clase según el diseño), `preview-pane` y `preview-toggle` (13.2), `translate-button`, `field__label-row` y modal de reemplazo (13.3), y las media queries de 13.7. Se eliminan `.tabs*`. `renderer/index.html` queda como en el bloque de arriba (sin `tabs-*` ni `panel-*`). La prueba añade: los ids `editor-root` y `preview-pane` existen y no existen `tabs-root` ni `panel-shot`; aparecen los selectores `.preview-pane`, `.preview-toggle`, `.translate-button`, `.is-preview-open`.

## Criterio de aceptación
1. `index.html` contiene los ids `app, topbar, topbar-sources, topbar-actions, banner-region, home, home-zones, home-status, workspace, player-root, filmstrip-root, header-fields-root, editor-root, preview-pane, drop-overlay, toast-region, modal-root, sr-status`, la CSP exacta de arriba y ningún atributo `style=` ni `<script>` en línea.
2. `styles.css` declara todas las variables de la sección 1 del diseño en el tema oscuro y las sobrescritas en el claro (la prueba extrae las claves `--...:` del bloque de `DISENO-GRAFICO.md` y comprueba que cada una aparece en `tokens.css`).
3. Por cada bloque de clases del diseño (`topbar, banner, dropzone, drop-overlay, player, filmstrip, shot-card, header-fields, shot-editor, preview, preview-pane, preview-toggle, translate-button, sidebar__editor, modal, toast, field, switch, segmented, source-chip, tooltip, button, icon-button, progress`), el selector `.<bloque>` aparece en la concatenación de `css/*.css`.
4. Los tres media queries de la sección 11 y `prefers-reduced-motion` aparecen literalmente.

## Comando de pruebas
`node --test test/styles.test.js`
