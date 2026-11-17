// hefta-json: Lesehilfe `hefta.json` aus PDF-Mappen von Hefta lesen und prüfen. Apache-2.0.
// Beschreibung des Formats: README.md. Das JSON Schema liegt unter `hefta-json/schema.json`.
export { lesen } from './lesen.js';
export { passt, vergleichbar, type Mappe } from './passt.js';
export { telefonE164 } from './telefon.js';
export {
  ANHANG_NAME,
  FASSUNG,
  MITZIEHENDE,
  MODI,
  PRUEFWEGE,
  ROLLEN,
  SCHRITTE,
  TYPEN,
  UNBEKANNT,
  VERMERKE,
  VERZEICHNIS,
  typText,
} from './listen.js';
export type {
  Lesehilfe,
  Mitziehend,
  MitziehendArt,
  Modus,
  Person,
  Rolle,
  Schritt,
  Unterlage,
  Vermerk,
  Wohnung,
  WohnungTeile,
} from './typen.js';
