// „Ziel beim Teilen“ (Zeile 8): Das Teilen-Blatt sagt nach dem Teilen, welche App gewählt wurde, als
// Kennung des Systems (iOS: Aktivität oder Erweiterung; Android: Paket). Daraus ein Name für die Datenspur.
// Unbekanntes bleibt leer: lieber nichts als etwas Falsches.
//
// PC31: Daraus auch, ob das Teilen als Bewerbung zählt. Feste Liste der Kennungen, gemessen am Testbau
// 43651002217: Gmail meldet „fertig“ nur beim Senden; Proton Mail schon beim Öffnen.

import type { BewerbungsWeg } from './bewerben';

/** Was für eine App das ist: Mail, Portal, etwas anderes (Nachricht, Ablage, Drucken) oder unbekannt. */
export type TeilenArt = 'mail' | 'portal' | 'anderes' | 'unbekannt';

const BEKANNT: [RegExp, string, TeilenArt][] = [
  [/^com\.apple\.UIKit\.activity\.Mail$/, 'Mail', 'mail'],
  [/^com\.apple\.UIKit\.activity\.Message$/, 'Nachrichten', 'anderes'],
  [/^com\.apple\.UIKit\.activity\.AirDrop$/, 'AirDrop', 'anderes'],
  [
    /^com\.apple\.(DocumentManagerUICore\.SaveToFiles|UIKit\.activity\.SaveToFiles)/,
    'Dateien',
    'anderes',
  ],
  [/^com\.apple\.UIKit\.activity\.Print$/, 'Drucken', 'anderes'],
  [/whatsapp/i, 'WhatsApp', 'anderes'],
  [/telegra(m|ph)/i, 'Telegram', 'anderes'],
  [/signal/i, 'Signal', 'anderes'],
  [/threema/i, 'Threema', 'anderes'],
  [/(google\.Gmail|android\.gm\b)/i, 'Gmail', 'mail'],
  // Proton Drive vor Proton Mail. Die genaue Kennung ist nicht gemessen; vermutet: sie enthält „drive“.
  [/proton.*drive|drive.*proton/i, 'Proton Drive', 'anderes'],
  [/protonmail|proton\.android\.mail|proton\.mail/i, 'Proton Mail', 'mail'],
  [/microsoft\.(Office\.Outlook|outlook)/i, 'Outlook', 'mail'],
  [/(web\.de|de\.web\.mobile)/i, 'WEB.DE', 'mail'],
  [/gmx/i, 'GMX', 'mail'],
  [/(dropbox)/i, 'Dropbox', 'anderes'],
  [/(google\.Drive|android\.apps\.docs)/i, 'Google Drive', 'anderes'],
  [/immobilienscout24|is24/i, 'ImmoScout24', 'portal'],
  [/kleinanzeigen|ebay\.kleinanzeigen/i, 'Kleinanzeigen', 'portal'],
  [/immowelt/i, 'Immowelt', 'portal'],
  [/(android\.email|samsung\.android\.email)/i, 'E-Mail', 'mail'],
];

const finden = (kennung: string | null | undefined) => {
  const k = (kennung ?? '').trim();
  return k ? BEKANNT.find(([muster]) => muster.test(k)) : undefined;
};

export function teilenZiel(kennung: string | null | undefined): string {
  return finden(kennung)?.[1] ?? '';
}

export function teilenArt(kennung: string | null | undefined): TeilenArt {
  return finden(kennung)?.[2] ?? 'unbekannt';
}

/** Gmail unter iOS meldet „fertig“ nur, wenn wirklich gesendet wurde (PC31, gemessen). */
const SENDET_SICHER = new Set(['com.google.Gmail.ShareExtension']);

/**
 * Zählt das Teilen als Bewerbung (PC31)?
 * - `gesendet`: sicher hinaus, wie beim Mailfenster von Apple; „Beworben“ ohne Rückfrage.
 * - `unsicher`: vielleicht hinaus; „Beworben“ mit der Rückfrage „Habt ihr euch beworben?“.
 * - `nichts`: abgebrochen oder keine Bewerbung (Nachricht, Ablage, Drucken); keine Rückfrage, kein Vorschlag.
 *
 * Nur beim Weg „Mail“ oder „Portal“ fragt Hefta überhaupt; Unbekanntes nur beim Weg „Mail“.
 */
export function teilenWerten(
  kennung: string | null | undefined,
  geteilt: boolean,
  weg: BewerbungsWeg,
): 'gesendet' | 'unsicher' | 'nichts' {
  if (!geteilt) return 'nichts';
  if (SENDET_SICHER.has((kennung ?? '').trim())) return 'gesendet';
  const art = teilenArt(kennung);
  if (art === 'anderes') return 'nichts';
  if (art === 'unbekannt') return weg === 'mail' ? 'unsicher' : 'nichts';
  return weg === 'mail' || weg === 'portal' ? 'unsicher' : 'nichts';
}
