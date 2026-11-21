import type { Heft } from '../domain/modell';

// Heft löschen (DP49 Punkt 12, W31, H1): das zuletzt gelöschte Heft und seine Stelle in der Liste. Die
// Liste „Wohnungen“ zeigt dort „… gelöscht“ mit „Rückgängig“, bis man die Liste verlässt. Solange es hier
// steht, räumt Hefta seine Fotos nicht weg (App.svelte, `verwaisteDateienLoeschen`).

export const geloescht = $state<{ heft: Heft | null; stelle: number; mehrere: Heft[] }>({
  heft: null,
  stelle: 0,
  // DP50 Punkt 1: „Hefte auch löschen“ nach „Haushalt löschen“; „Rückgängig“, bis man den Reiter verlässt.
  mehrere: [],
});
