// Elección pura de los idiomas del corrector ortográfico de Electron. Sin Electron,
// para poder probarla. La usa main/main.js al arrancar.

// Devuelve, en el orden pedido, los idiomas de `wanted` que estén en `available`.
// Si no hay ninguno, devuelve []; quien llama decide cómo avisar.
export function chooseSpellcheckLanguages(wanted, available) {
  if (!Array.isArray(wanted) || !Array.isArray(available)) return [];
  return wanted.filter((language) => available.includes(language));
}
