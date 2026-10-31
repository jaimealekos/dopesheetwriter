// Cálculo puro del ensanche/estrechez de la ventana. Sin Electron, para poder probarlo.

// Calcula los bounds de la ventana tras aplicar delta, sin mutar la entrada.
// delta > 0: crece hasta el borde derecho del área de trabajo, desplazándose a la
// izquierda si desborda. delta < 0: encoge sin bajar de minWidth. y y height no cambian.
export function computeWidthChange({ bounds, workArea, delta, minWidth }) {
  const next = { ...bounds };

  if (delta > 0) {
    const width = Math.min(bounds.width + delta, workArea.width);
    next.width = width;
    next.x = Math.max(workArea.x, Math.min(bounds.x, workArea.x + workArea.width - width));
    return { applied: width - bounds.width, bounds: next };
  }

  if (delta < 0) {
    const width = Math.max(minWidth, bounds.width + delta);
    next.width = width;
    return { applied: width - bounds.width, bounds: next };
  }

  return { applied: 0, bounds: next };
}
