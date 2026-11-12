// Abschicken einer Rückmeldung (E54, E57): die einzige Verbindung, die Hefta von sich aus aufbaut,
// und nur nach dem Tipp auf „Abschicken“ in der Rückfrage. Es geht genau {f, a} hinaus: kein Cookie,
// keine Kennung, kein Referrer, keine Daten aus Hefta. Ohne Netz meldet Hefta es und schickt nichts nach.

import { istApp } from '../app/plattform';
import type { Antwort, Frage } from './fragen';

/** Die eine erlaubte Adresse (CSP, check-dist). Hefta im Web ruft denselben Empfang vom eigenen Ursprung. */
export const EMPFANG = 'https://hefta.de/api/rueckmeldung';

export async function abschicken(
  f: Frage,
  a: Antwort,
  holen: typeof fetch = fetch,
): Promise<'ok' | 'aus'> {
  try {
    const antwort = await holen(istApp() ? EMPFANG : '/api/rueckmeldung', {
      method: 'POST',
      // text/plain: eine einfache Anfrage ohne Vorabfrage; der Empfang liest den Text als JSON.
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ f, a }),
      credentials: 'omit',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
    });
    return antwort.ok ? 'ok' : 'aus';
  } catch {
    return 'aus';
  }
}
