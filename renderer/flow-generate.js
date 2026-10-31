// Flujo de guardado: autoguardado del borrador y Generate (validar, sobrescribir
// si hace falta, escribir el .txt y avisar).

import { buildShotlist } from '../core/shotlist-format.js';
import { nextPending, validateForExport } from '../core/shot-model.js';
import { headerErrors } from './setup-panel.js';
import { bannerCopy, confirmOverwrite } from './feedback.js';
import { textName, videoBase, folderOf } from './state.js';

// Crea el flujo de guardado. `ctx` lo monta app.js.
export function createGenerateFlow(ctx) {
  const { state, dsw, banner, toasts, progressPanel } = ctx;
  let autosaveTimer = null;
  let busy = false;

  // Autoguardado del borrador con retardo tras el último cambio.
  function scheduleAutosave() {
    if (!state.video.path) return;
    if (autosaveTimer !== null) clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null;
      saveDraft();
    }, ctx.autosaveDelay);
  }

  async function saveDraft() {
    try {
      await dsw.saveDraft(state.video.path, ctx.buildDraft());
    } catch (error) {
      console.warn(`Could not save the draft: ${error.message}`);
    }
  }

  // Generate: si faltan datos, señala y enfoca; si no, escribe y ofrece la carpeta.
  async function generate() {
    if (busy || !state.video.path || !state.xml.parsed || state.shots.length === 0) return;

    const headerProblems = headerErrors(state.header);
    const validation = validateForExport(state.shots);
    if (!validation.ok || Object.keys(headerProblems).length > 0) {
      state.showErrors = true;
      ctx.refreshAll();
      focusFirstProblem();
      return;
    }

    busy = true;
    progressPanel.setBusy(true);
    try {
      if (await dsw.shotlistExists(state.video.path)) {
        const replace = await confirmOverwrite(ctx.modalRoot, {
          fileName: textName(state.video.name),
          folder: folderOf(state.video.path),
        });
        if (!replace) return;
      }

      const text = buildShotlist(
        { header: state.header, shots: state.shots, fps: ctx.fps() },
        { strict: true },
      );
      const written = await dsw.writeShotlist(state.video.path, text);
      toasts.show({
        kind: 'success',
        title: 'Shotlist saved',
        detail: textName(state.video.name),
        action: { label: 'Show in folder', icon: 'folder', onClick: () => dsw.showInFolder(written) },
      });
    } catch (error) {
      banner.showError({
        ...bannerCopy('save-failed', {
          name: videoBase(state.video.name),
          detail: error.message,
          folder: folderOf(state.video.path),
        }),
        action: { label: 'Dismiss', onClick: () => banner.clear() },
      });
    } finally {
      busy = false;
      progressPanel.setBusy(false);
    }
  }

  // Primer plano pendiente, o el primer campo de cabecera vacío si no hay planos pendientes.
  function focusFirstProblem() {
    const pending = nextPending(state.shots, state.selected);
    if (pending !== null) {
      state.selected = pending;
      ctx.player.selectShot(pending);
      ctx.refreshAll();
      ctx.editor.focusFirstMissing();
      return;
    }
    ctx.headerFields.focusFirstEmpty();
  }

  return { scheduleAutosave, generate };
}
