// Abschicken einer Rückmeldung (E54, E57): die einzige Verbindung, die Hefta von sich aus aufbaut,
// und nur nach dem Tipp auf „Abschicken“ in der Rückfrage. Es geht genau {f, a} hinaus: kein Cookie,
// keine Kennung, kein Referrer, keine Daten aus Hefta. Ohne Netz meldet Hefta es und schickt nichts nach.

import { istApp } from '../app/plattform';
import type { Antwort, Frage } from './fragen';

/** Die eine erlaubte Adresse (CSP, check-dist). Hefta im Web ruft denselben Empfang vom eigenen Ursprung. */
export const EMPFANG = 'https://hefta.de/api/rueckmeldung';

/**
 * PC23 A3: Der Empfang auf hefta.de ist noch nicht deployt (ein POST bekommt 405). Bis er live ist, zeigt
 * Hefta die Fragen zum Abschicken nicht an, statt einen Fehler zu melden. Mit dem Deploy des Empfangs
 * (nur mit „Ja, deployen“) `EMPFANG_DEPLOYT` auf `true` setzen. Unter Android bleibt die Mail (RueckmeldungMail).
 */
const EMPFANG_DEPLOYT = false;

/** Ist der Empfang da? Browsertests schalten ihn mit `__heftaEmpfangTest` an, um das Verhalten zu prüfen. */
export const empfangLive = (): boolean =>
  EMPFANG_DEPLOYT || (globalThis as { __heftaEmpfangTest?: boolean }).__heftaEmpfangTest === true;

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
