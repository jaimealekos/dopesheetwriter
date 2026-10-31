// Ranuras de las dos colas en segundo plano (entrevistas y retranscripción).
// Módulo puro: mezcla lo que se pinta en la barra, la tira y el editor.

// Cada cola escribe en su ranura; la interfaz muestra la de entrevistas y, si no
// hay, la de retranscripción. «En espera» es la unión de las dos listas.
export function createQueueSlots({ setStatus, setProcessing, setQueued }) {
  const slots = {
    interviews: { progress: null, processing: null, queued: [] },
    retranscribe: { progress: null, processing: null, queued: [] },
  };

  function apply() {
    const interviews = slots.interviews;
    const retranscribe = slots.retranscribe;
    setStatus(interviews.progress ?? retranscribe.progress);

    const processing = interviews.processing ?? retranscribe.processing;
    setProcessing(processing?.number ?? null, processing?.kind ?? null);

    setQueued([...new Set([...interviews.queued, ...retranscribe.queued])]);
  }

  return {
    setProgress(name, text) {
      slots[name].progress = text;
      apply();
    },
    setProcessing(name, number, kind) {
      slots[name].processing = number === null ? null : { number, kind };
      apply();
    },
    setQueued(name, numbers) {
      slots[name].queued = [...numbers];
      apply();
    },
  };
}
