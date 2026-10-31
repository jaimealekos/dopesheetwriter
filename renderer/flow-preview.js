// Flujo de la columna Preview: abrirla ensancha la ventana (proceso principal) y
// cerrarla la devuelve a su ancho. Las aperturas y cierres se encadenan en orden.

const OPEN_CLASS = 'is-preview-open';
const WIDTH_VARIABLE = '--size-preview';

// Ancho ideal de la columna según el tema de ancho activo (400, 440 o 480 px).
function readWidthVariable(appEl) {
  return parseFloat(getComputedStyle(appEl).getPropertyValue(WIDTH_VARIABLE));
}

// Crea el flujo. `ctx` lo monta app.js:
//   dsw, appEl (#app), previewPanel, toggle (mountPreviewToggle), refreshPreview,
//   isAvailable() (¿hay espacio de trabajo?), hasFocusInside() (¿el foco está en la columna?),
//   focusToggle(); readPreviewWidth() opcional (por defecto lee --size-preview de #app).
export function createPreviewFlow(ctx) {
  const { dsw, appEl, previewPanel, toggle } = ctx;
  let open = false;
  let applied = 0;
  let queue = Promise.resolve();

  async function widenWindow() {
    // Si ya hay un ensanche aplicado, no se repite ni se pierde su medida.
    if (applied > 0) return;
    const wanted = ctx.readPreviewWidth ? ctx.readPreviewWidth() : readWidthVariable(appEl);
    if (!(wanted > 0)) return;
    try {
      const delta = await dsw.adjustWindowWidth(wanted);
      applied = Number.isFinite(delta) && delta > 0 ? delta : 0;
    } catch (error) {
      // Que la ventana no se ensanche no impide usar la columna: se abre igualmente
      // y el reparto de ancho de la rejilla (diseño 13.1.2) hace el resto.
      console.warn(`Could not widen the window: ${error.message}`);
      // El ensanche pudo aplicarse antes de fallar: se intenta deshacer.
      try {
        await dsw.adjustWindowWidth(-wanted);
      } catch (revertError) {
        console.warn(`Could not revert the window width: ${revertError.message}`);
      }
    }
  }

  async function narrowWindow() {
    if (applied <= 0) return;
    const undo = applied;
    applied = 0;
    try {
      await dsw.adjustWindowWidth(-undo);
    } catch (error) {
      // Si no se puede estrechar, la ventana se queda ancha; la columna se cierra igual.
      console.warn(`Could not narrow the window: ${error.message}`);
    }
  }

  async function openPreview() {
    await widenWindow();
    appEl.classList.add(OPEN_CLASS);
    previewPanel.setOpen(true);
    toggle.setOpen(true);
    ctx.refreshPreview();
    previewPanel.scrollToCurrent();
    open = true;
  }

  async function closePreview() {
    const hadFocus = ctx.hasFocusInside();
    // La columna se oculta antes de estrechar: el cierre no espera a la ventana.
    appEl.classList.remove(OPEN_CLASS);
    previewPanel.setOpen(false);
    toggle.setOpen(false);
    open = false;
    await narrowWindow();
    // Al ocultarse la columna, el foco que tuviera dentro se perdería.
    if (hadFocus) ctx.focusToggle();
  }

  async function transition(next) {
    if (next === open) {
      toggle.setOpen(open);
      return;
    }
    if (next) await openPreview();
    else await closePreview();
  }

  // Encadena una transición; `decide` se evalúa al llegar su turno, así que varias
  // órdenes seguidas acaban en el estado de la última.
  function enqueue(decide) {
    const run = queue.then(() => transition(decide()));
    queue = run.catch((error) => {
      console.error(`Could not change the preview column: ${error.message}`);
    });
    return queue;
  }

  function setPreviewOpen(next) {
    return enqueue(() => Boolean(next));
  }

  // Alt+P: alterna, salvo que no haya espacio de trabajo.
  function toggleOpen() {
    if (!ctx.isAvailable()) return Promise.resolve();
    return enqueue(() => !open);
  }

  return { setPreviewOpen, toggleOpen, isOpen: () => open };
}
