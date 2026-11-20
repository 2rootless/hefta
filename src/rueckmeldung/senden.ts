// Abschicken einer Rückmeldung (E54, E57): die einzige Verbindung, die Hefta von sich aus aufbaut,
// und nur nach dem Tipp auf „Abschicken“ in der Rückfrage. Es geht genau {f, a} hinaus: kein Cookie,
// keine Kennung, kein Referrer, keine Daten aus Hefta. Ohne Netz meldet Hefta es und schickt nichts nach.

import { istApp } from '../app/plattform';
import type { Antwort, Frage } from './fragen';

/** Die eine erlaubte Adresse (CSP, check-dist). Hefta im Web ruft denselben Empfang vom eigenen Ursprung. */
export const EMPFANG = 'https://hefta.de/api/rueckmeldung';

/**
 * PC23 A3: Bis der Empfang auf hefta.de live war, zeigte Hefta die Fragen zum Abschicken nicht an.
 * PC92 (E194, K1): Die Rückmeldung kommt mit 2.0. Der Empfang geht mit dem Deploy der Website live, und der kommt
 * vor dem Einreichen (Release-Mappe, Ablauf am Tag). Bis dahin meldet die App beim Abschicken „Gerade keine
 * Verbindung“, und nichts wird nachgeschickt. Unter Android bleibt die Mail (RueckmeldungMail).
 */
const EMPFANG_DEPLOYT = true;

/**
 * Ist der Empfang da? Browsertests schalten ihn mit `__heftaEmpfangTest` an (`true`) oder aus (`false`), um beide
 * Wege zu prüfen; ohne den Schalter gilt `EMPFANG_DEPLOYT`.
 */
export const empfangLive = (): boolean => {
  const test = (globalThis as { __heftaEmpfangTest?: boolean }).__heftaEmpfangTest;
  return test === undefined ? EMPFANG_DEPLOYT : test;
};

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
