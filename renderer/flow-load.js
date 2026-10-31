// Flujo de carga: elección/soltado de vídeo y XML, transición al espacio de
// trabajo, restauración del borrador y extracción de miniaturas.

import { createShots } from '../core/shot-model.js';
import { checkVideoMatch } from '../core/video-match.js';
import { formatTimecode } from '../core/timecode.js';
import { baseName, videoMeta, xmlMeta, classifyDrop } from './setup-panel.js';
import { bannerCopy } from './feedback.js';
import { extractFrames } from './frames.js';
import { applyDraftToShots, draftHeader, hasAnnotations, countAnnotated } from './state.js';

// Crea el flujo de carga. `ctx` lo monta app.js con los módulos ya enlazados.
export function createLoadFlow(ctx) {
  const { state, dsw, banner, home, player, filmstrip, toasts, headerFields } = ctx;

  let frameAbort = null;
  let frameTotal = 0;
  let frameLoaded = 0;
  // Contador de generación de carga: cualquier carga nueva lo incrementa y las
  // anteriores abandonan en cuanto retoman de un await.
  let generation = 0;

  function cancelFrames() {
    if (frameAbort) {
      frameAbort.abort();
      frameAbort = null;
    }
    if (frameTotal > 0) filmstrip.setLoadingProgress(0, 0);
    frameTotal = 0;
    frameLoaded = 0;
  }

  // Deja el espacio de trabajo vacío y en la pantalla de inicio. Si aún no se
  // había entrado al espacio de trabajo, conserva el XML ya cargado (el usuario
  // lo eligió aparte) y no toca su zona; si se borra, la zona vuelve a vacío.
  function resetForVideo() {
    cancelFrames();
    if (ctx.isWorkspaceVisible()) {
      state.xml = { path: '', name: '', parsed: null, foundNextToVideo: false };
      home.setState('xml', { status: 'empty' });
    }
    state.shots = [];
    state.selected = 0;
    state.showErrors = false;
    filmstrip.setShots([], 25);
    player.setShots([], 0, 0);
    ctx.leaveWorkspace();
  }

  // Carga un vídeo por ruta y, si procede, su XML hermano.
  async function loadVideo(path, o = {}) {
    const token = ++generation;
    resetForVideo();
    banner.clear();
    state.video = { path, name: baseName(path), url: '', duration: 0, width: 0, height: 0, loaded: false };
    home.setState('video', { status: 'loading' });

    try {
      state.video.url = await dsw.videoUrl(path);
    } catch (error) {
      if (token !== generation) return;
      showVideoError(error);
      return;
    }
    if (token !== generation) return;

    home.setState('video', { status: 'loaded', name: state.video.name, path });

    if (o.autoSibling !== false) {
      let sibling = null;
      try {
        sibling = await dsw.findSiblingXml(path);
      } catch (error) {
        console.warn(`Could not look for the sibling XML: ${error.message}`);
      }
      if (token !== generation) return;
      if (sibling) {
        await loadXml(sibling, { foundNextToVideo: true });
        return;
      }
    }

    await tryEnterWorkspace(token);
  }

  // Carga un XML por ruta y, si ya hay vídeo, prepara el espacio de trabajo.
  async function loadXml(path, o = {}) {
    const token = ++generation;
    cancelFrames();
    banner.clear();
    state.xml = { path, name: baseName(path), parsed: null, foundNextToVideo: Boolean(o.foundNextToVideo) };
    state.shots = [];
    state.selected = 0;
    state.showErrors = false;
    filmstrip.setShots([], 25);
    ctx.leaveWorkspace();
    home.setState('xml', { status: 'loading' });

    let parsed;
    try {
      parsed = await dsw.loadXml(path);
    } catch (error) {
      if (token !== generation) return;
      showXmlError(error, state.xml.name);
      return;
    }
    if (token !== generation) return;

    if (!parsed || !Array.isArray(parsed.cuts) || parsed.cuts.length === 0) {
      showNoClips();
      return;
    }

    state.xml.parsed = parsed;
    updateXmlHomeState();
    await tryEnterWorkspace(token);
  }

  // Con vídeo y XML listos, valida el desajuste, crea planos y entra al espacio de trabajo.
  async function tryEnterWorkspace(token) {
    if (!state.video.path || !state.xml.parsed) {
      ctx.leaveWorkspace();
      return;
    }

    try {
      const parsed = state.xml.parsed;

      if (!state.video.loaded) {
        home.setState('video', { status: 'loading' });
        ctx.homeStatus.hidden = false;
        let meta;
        try {
          meta = await player.load({ url: state.video.url, name: state.video.name });
        } catch (error) {
          if (token !== generation) return;
          ctx.homeStatus.hidden = true;
          showVideoError(error);
          return;
        }
        if (token !== generation) return;
        state.video.duration = meta.duration;
        state.video.width = meta.width;
        state.video.height = meta.height;
        state.video.loaded = true;
        ctx.homeStatus.hidden = true;
      }

      if (checkVideoMatch(parsed, state.video.duration)) {
        banner.showWarning({
          ...bannerCopy('mismatch', {
            xmlTime: formatTimecode(parsed.totalFrames / parsed.fps, parsed.fps),
            videoTime: formatTimecode(state.video.duration, parsed.fps),
          }),
          action: { label: 'Examinar XML', onClick: () => pick('xml') },
        });
      } else if (banner.current() === 'warning') {
        banner.clear();
      }

      home.setState('video', {
        status: 'loaded',
        name: state.video.name,
        path: state.video.path,
        meta: videoMeta({
          duration: state.video.duration,
          width: state.video.width,
          height: state.video.height,
          fps: parsed.fps,
        }),
      });
      updateXmlHomeState();

      state.shots = createShots(parsed.cuts);
      state.selected = state.shots.length > 0 ? state.shots[0].number : 0;

      const draftRestored = await restoreDraft(token);
      if (token !== generation) return;

      player.setShots(state.shots, parsed.fps, parsed.totalFrames);
      if (state.shots.length > 0) player.selectShot(state.selected);
      filmstrip.setShots(state.shots, parsed.fps);
      ctx.enterWorkspace();
      ctx.refreshAll();
      ctx.announceShot(state.selected);
      startFrames(parsed);
      // Con el espacio de trabajo listo, los flujos automáticos (detección de
      // entrevistas) deciden si hay algo que proponer. No bloquean la carga.
      ctx.onWorkspaceReady?.({ draftRestored })?.catch?.((error) => {
        console.warn(`Could not start the automatic detection: ${error.message}`);
      });
    } catch (error) {
      if (token !== generation) return;
      banner.showError({ title: "Couldn't open the workspace.", detail: error.message });
    }
  }

  // Recupera las anotaciones (y la cabecera) guardadas para este vídeo.
  // Devuelve si había borrador: la detección automática de entrevistas no actúa entonces.
  async function restoreDraft(token) {
    let draft = null;
    try {
      draft = await dsw.loadDraft(state.video.path);
    } catch (error) {
      console.warn(`Could not load the draft: ${error.message}`);
      return false;
    }
    if (token !== generation) return false;
    if (!draft) return false;

    state.shots = applyDraftToShots(state.shots, draft);
    const header = draftHeader(draft);
    if (header && (header.location !== '' || header.date !== '' || header.source !== '')) {
      state.header = header;
      headerFields.setHeader(state.header);
    }
    if (hasAnnotations(draft)) {
      const annotated = countAnnotated(state.shots);
      if (annotated > 0) {
        toasts.show({
          kind: 'info',
          title: 'Draft restored',
          detail: `${annotated} of ${state.shots.length} shots annotated`,
        });
      }
    }
    return true;
  }

  // Extrae las miniaturas de los planos en orden, en un vídeo oculto aparte.
  function startFrames(parsed) {
    cancelFrames();
    const controller = new AbortController();
    frameAbort = controller;
    const cuts = state.shots.map((shot) => ({ startFrame: shot.startFrame }));
    frameTotal = cuts.length;
    frameLoaded = 0;
    filmstrip.setLoadingProgress(0, frameTotal);

    extractFrames({
      videoUrl: state.video.url,
      cuts,
      fps: parsed.fps,
      signal: controller.signal,
      onFrame: (index, dataUrl) => {
        if (controller.signal.aborted) return;
        filmstrip.setThumbnail(index + 1, dataUrl);
        frameLoaded = index + 1;
        filmstrip.setLoadingProgress(frameLoaded, frameTotal);
        if (frameLoaded >= frameTotal) ctx.announce('Thumbnails ready');
      },
    }).catch((error) => {
      if (controller.signal.aborted) return;
      console.warn(`Could not extract the thumbnails: ${error.message}`);
      filmstrip.setLoadingProgress(0, 0);
      for (let index = frameLoaded; index < frameTotal; index += 1) {
        filmstrip.setThumbnail(index + 1, null);
      }
    });
  }

  // --- Soltado y elección de ficheros --------------------------------------

  async function pick(kind) {
    try {
      const path = await dsw.pickFile(kind);
      if (!path) return;
      if (kind === 'video') await loadVideo(path, { autoSibling: true });
      else await loadXml(path);
    } catch (error) {
      banner.showError({ title: "Couldn't load the file.", detail: error.message });
    }
  }

  async function onDropFiles(_kind, file) {
    try {
      await handleDroppedFiles([file]);
    } catch (error) {
      console.warn(`Could not load the dropped file: ${error.message}`);
    }
  }

  async function handleDroppedFiles(files) {
    const { video, xml, rejected } = classifyDrop(files);
    // Si vienen juntos, el XML soltado manda: no se busca el hermano del vídeo.
    if (video) await loadVideo(dsw.pathForFile(video), { autoSibling: !xml });
    if (xml) await loadXml(dsw.pathForFile(xml));
    if (rejected.length > 0) {
      banner.showWarning(bannerCopy('bad-drop', { file: rejected[0] }));
    }
  }

  // Arrastre global: borde discontinuo en inicio, superposición en el espacio de trabajo.
  function attachDropTargets() {
    let depth = 0;

    document.addEventListener('dragover', (event) => event.preventDefault());
    document.addEventListener('dragenter', (event) => {
      event.preventDefault();
      depth += 1;
      setDragActive(true);
    });
    document.addEventListener('dragleave', () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragActive(false);
    });
    document.addEventListener('drop', (event) => {
      event.preventDefault();
      depth = 0;
      setDragActive(false);
      // Las zonas de inicio ya reparten el fichero por su cuenta.
      if (event.target.closest && event.target.closest('.dropzone')) return;
      handleDroppedFiles([...event.dataTransfer.files]).catch((error) => {
        console.warn(`Could not load the dropped files: ${error.message}`);
      });
    });
  }

  function setDragActive(active) {
    if (ctx.isWorkspaceVisible()) ctx.dropOverlay.classList.toggle('is-visible', active);
    else home.setGlobalDragover(active);
  }

  // --- Avisos de error ------------------------------------------------------

  function showVideoError(error) {
    const kind = error && error.code === 'unreadable' ? 'unreadable-video' : 'unsupported-codec';
    const copy = bannerCopy(kind, { file: state.video.name });
    banner.showError({ ...copy, action: { label: 'Examinar', onClick: () => pick('video') } });
    home.setState('video', {
      status: 'error',
      name: state.video.name,
      path: state.video.path,
      error: `${copy.title} ${copy.detail}`,
    });
  }

  function showXmlError(error, name) {
    const noClips = /no video clips/i.test(error?.message ?? '');
    const copy = bannerCopy(noClips ? 'no-clips' : 'invalid-xml', { file: name });
    banner.showError({ ...copy, action: { label: 'Examinar', onClick: () => pick('xml') } });
    home.setState('xml', { status: 'error', name, path: state.xml.path, error: `${copy.title} ${copy.detail}` });
  }

  function showNoClips() {
    const copy = bannerCopy('no-clips');
    banner.showError({ ...copy, action: { label: 'Examinar', onClick: () => pick('xml') } });
    home.setState('xml', {
      status: 'error',
      name: state.xml.name,
      path: state.xml.path,
      error: `${copy.title} ${copy.detail}`,
    });
  }

  function updateXmlHomeState() {
    const parsed = state.xml.parsed;
    if (!parsed) return;
    home.setState('xml', {
      status: 'loaded',
      name: state.xml.name,
      path: state.xml.path,
      meta: xmlMeta({ shots: parsed.cuts.length, fps: parsed.fps, totalFrames: parsed.totalFrames }),
      note: state.xml.foundNextToVideo ? 'Found next to the video' : '',
    });
  }

  return { pick, onDropFiles, attachDropTargets, loadVideo, loadXml, showVideoError };
}
