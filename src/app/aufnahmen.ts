// PC188 (E349): Aufnahmeplan für die Store-Bilder 01 bis 09 im Simulator. Nur im eigenen Bau für die Aufnahmen
// (VITE_AUFNAHMEN=1, Lauf „store-bilder“); in jedem anderen Bau ist diese Datei nicht enthalten. Im Simulator kann
// niemand tippen: Der Plan spielt das Musterbackup mit Haushalt A ein und geht die Bildschirme der Reihe nach
// durch. Steht ein Bildschirm, schreibt er „AUFNAHME BEREIT nn“ auf die Konsole; der Lauf liest das mit und nimmt
// dann das Bild auf. Daten kommen nur aus dem Bau selbst (public/aufnahme), nichts vom Auftraggeber.
import { db, gehe, neuLaden } from './daten.svelte';
import { eingang } from './eingang.svelte';
import { sicherungEinspielen } from '../storage/sicherung';
import { einstellungenAendern } from '../storage/speicher';
import { geteiltOeffnen } from '../ui/neuesHeft.svelte';

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));
const melde = (text: string) => console.log(`AUFNAHME ${text}`);

/** Wartet, bis ein Element mit diesem Text (oder Selektor) sichtbar ist; höchstens 20 Sekunden. */
async function warteAuf(pruefen: () => Element | null | undefined, was: string): Promise<Element> {
  for (let i = 0; i < 100; i++) {
    const e = pruefen();
    if (e && (e as HTMLElement).getClientRects().length) return e;
    await warte(200);
  }
  throw new Error(`nicht gefunden: ${was}`);
}

const mitText = (selektor: string, text: RegExp) => () =>
  [...document.querySelectorAll(selektor)].find((e) => text.test(e.textContent?.trim() ?? ''));

/** Hält den Bildschirm ruhig: Animationen fertig, oben angefangen, wenn nichts anderes gesagt ist. */
async function bereit(nr: string) {
  await warte(1200);
  await Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined)));
  melde(`BEREIT ${nr}`);
  // Zeit für die Aufnahme; der Lauf antwortet nicht, er nimmt nur auf.
  // 15 Sekunden: Die Konsole kommt im Simulator manchmal einige Sekunden später beim Lauf an (CP115).
  await warte(15000);
}

async function dateiAus(pfad: string, name: string, typ: string): Promise<File> {
  const antwort = await fetch(pfad);
  if (!antwort.ok) throw new Error(`${pfad}: ${antwort.status}`);
  return new File([await antwort.blob()], name, { type: typ });
}

export async function aufnahmenStarten(): Promise<void> {
  try {
    await warte(1500);
    // SB14: der obere sichere Bereich in pt, so wie die App ihn bekommt.
    const probe = document.createElement('div');
    probe.style.paddingTop = 'env(safe-area-inset-top)';
    document.body.append(probe);
    melde(`SAFE-AREA-TOP ${getComputedStyle(probe).paddingTop}`);
    probe.remove();

    // Haushalt A aus dem Musterbackup (W40, DP110). Es ersetzt alles; im Simulator ist sonst nichts.
    const backup = await dateiAus(
      'aufnahme/hefta-muster.hefta',
      'hefta-muster.hefta',
      'application/octet-stream',
    );
    const inhalt = await sicherungEinspielen(await db(), backup, undefined);
    await einstellungenAendern(await db(), { letztesBackup: inhalt.erstellt });
    await neuLaden();
    melde('MUSTER EINGESPIELT');

    // 01 Wohnungen
    gehe('/wohnungen');
    await warteAuf(mitText('main h1, main h2', /.+/), 'Wohnungen');
    await bereit('01');

    // 02 Heft „Altbau mit Garten“ mit Termin
    gehe('/heft/muster-1');
    await warteAuf(mitText('main h1', /Altbau mit Garten|Kranichstieg/), 'Heft');
    await bereit('02');

    // 03 Ein erfundenes Inserat, so wie die Erweiterung „Hefta teilen“ es an Hefta gibt (Link und Text).
    const seite = await (await fetch('aufnahme/inserat-rotdornbogen.html')).text();
    const text = new DOMParser().parseFromString(seite, 'text/html').body.innerText;
    geteiltOeffnen('https://example.com/inserat/rotdornbogen-21', text);
    // In der App (iPhone) kommt erst die Vorschau; im Browser gibt es sie nicht, dort gleich die Kontrolle.
    await warteAuf(
      mitText('main h1', /Ist das die Wohnung|Letzte Kontrolle/),
      'Vorschau des Inserats',
    );
    await bereit('03');

    // 04 Heft mit „Zu euren Wünschen“ oben
    gehe('/heft/muster-1');
    const wuensche = await warteAuf(
      mitText('main h2, main h3', /^Zu (euren|deinen) Wünschen$/),
      'Wünsche',
    );
    window.scrollTo({
      top: wuensche.getBoundingClientRect().top + window.scrollY - 24,
      behavior: 'instant',
    });
    await bereit('04');

    // 05 Bewerben (das Heft „Neubau am Park“ ist noch nicht beworben)
    gehe('/heft/muster-3/bewerben');
    await warteAuf(mitText('main h1', /^Bewerben mit wenigen Tipps/), 'Bewerben');
    await bereit('05');

    // 06 Mappe, „Eure Mappe“ oben
    gehe('/');
    await warteAuf(mitText('main h1', /Mappe/), 'Mappe');
    await bereit('06');

    // 07 Deckblatt für „Altbau mit Garten“
    gehe('/mappe/deckblatt');
    await warteAuf(mitText('main h1', /^Deckblatt$/), 'Deckblatt');
    await warteAuf(() => document.querySelector('.deck-gross img'), 'Bild des Deckblatts');
    await bereit('07');

    // 08 Die Mappe als Grund für die Mitteilung (W48); die Mitteilung selbst setzt Design dazu (siehe CP).
    gehe('/');
    await warteAuf(mitText('main h1', /Mappe/), 'Mappe');
    await bereit('08');

    // 09 Monate zuordnen: drei erfundene Abrechnungen von Selin, jede mit Blick ins Dokument (W16).
    eingang.dateien = await Promise.all(
      ['august', 'september', 'oktober'].map((m) =>
        dateiAus(`aufnahme/gehalt-selin-${m}.pdf`, `gehalt-selin-${m}.pdf`, 'application/pdf'),
      ),
    );
    gehe('/eingang');
    await warteAuf(mitText('main h1', /^Wofür ist diese Datei/), 'Eingang');
    const selin = await warteAuf(mitText('main section h2', /^Selin/), 'Selin im Eingang');
    // Der erste Knopf „Gehaltsnachweise“ nach der Überschrift „Selin“, in der Reihenfolge der Seite.
    const knopf = [...document.querySelectorAll<HTMLButtonElement>('main button')].find(
      (b) =>
        /^Gehalt/.test(b.textContent?.trim() ?? '') &&
        !!(selin.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING),
    );
    if (!knopf) throw new Error('Gehaltsnachweis bei Selin fehlt');
    knopf.click();
    await warteAuf(mitText('main h1', /Gehalt/), 'Gehaltsnachweis von Selin');
    await bereit('09');

    melde('FERTIG');
  } catch (e) {
    melde(`FEHLER ${String(e)}`);
  }
}
