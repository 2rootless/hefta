// Die Tabelle der Postleitzahlen (data/plz.de.json, GeoNames, CC BY 4.0) lädt die App erst, wenn eine
// Seite die Lage braucht: Sie ist rund 80 KB groß (gepackt) und liegt mit der App auf dem Gerät.
import type { PlzTabelle } from '../domain/lage';

const stand = $state<{ tabelle: PlzTabelle | null }>({ tabelle: null });
let laedt = false;

/** Die Tabelle, sobald sie geladen ist; vorher null. Lesen in `$derived` lädt sie und rechnet danach neu. */
export function plzTabelle(): PlzTabelle | null {
  if (!stand.tabelle && !laedt) {
    laedt = true;
    void import('../../data/plz.de.json')
      .then((m) => (stand.tabelle = m.default.plz as unknown as PlzTabelle))
      .catch(() => (laedt = false));
  }
  return stand.tabelle;
}
