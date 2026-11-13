// „Ziel beim Teilen“ (Zeile 8): Das Teilen-Blatt sagt nach dem Teilen, welche App gewählt wurde, als
// Kennung des Systems (iOS: Aktivität oder Erweiterung; Android: Paket). Daraus ein Name für die Datenspur.
// Unbekanntes bleibt leer: lieber nichts als etwas Falsches.

const BEKANNT: [RegExp, string][] = [
  [/^com\.apple\.UIKit\.activity\.Mail$/, 'Mail'],
  [/^com\.apple\.UIKit\.activity\.Message$/, 'Nachrichten'],
  [/^com\.apple\.UIKit\.activity\.AirDrop$/, 'AirDrop'],
  [/^com\.apple\.(DocumentManagerUICore\.SaveToFiles|UIKit\.activity\.SaveToFiles)/, 'Dateien'],
  [/^com\.apple\.UIKit\.activity\.Print$/, 'Drucken'],
  [/whatsapp/i, 'WhatsApp'],
  [/telegra(m|ph)/i, 'Telegram'],
  [/signal/i, 'Signal'],
  [/threema/i, 'Threema'],
  [/(google\.Gmail|android\.gm\b)/i, 'Gmail'],
  [/protonmail|proton\.android\.mail|proton\.mail/i, 'Proton Mail'],
  [/microsoft\.(Office\.Outlook|outlook)/i, 'Outlook'],
  [/(web\.de|de\.web\.mobile)/i, 'WEB.DE'],
  [/gmx/i, 'GMX'],
  [/(dropbox)/i, 'Dropbox'],
  [/(google\.Drive|android\.apps\.docs)/i, 'Google Drive'],
  [/immobilienscout24|is24/i, 'ImmoScout24'],
  [/(android\.email|samsung\.android\.email)/i, 'E-Mail'],
];

export function teilenZiel(kennung: string | null | undefined): string {
  const k = (kennung ?? '').trim();
  if (!k) return '';
  return BEKANNT.find(([muster]) => muster.test(k))?.[1] ?? '';
}
