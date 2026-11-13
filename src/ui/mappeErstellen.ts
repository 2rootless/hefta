import { hatPruefcode } from '../domain/pruefhinweise';
import { AUSSEHEN_STANDARD, type MappenAussehen } from '../domain/modell';
import { bauSchluessel, gebauteMappen, kleineDateien, type MappenAnlass } from './mappeSpeicher';
import { serienQuellen } from '../domain/aufteilen';
import { appSichern, appTeilen, istApp } from '../app/plattform';
import {
  auskunftAntwortenImmer,
  auskunftsSchritt,
  bloecke,
  einzelDateiname,
  type ExportEinstellungen,
  bitteSatzAus,
} from '../domain/export';
import { aktuelleVersionen } from '../domain/fristen';
import {
  eintragenText,
  listenText,
  ohneTrennstellen,
  rollenText,
  situationText,
  type PersonStand,
} from '../domain/regelkatalog';
import { nameImPdf, nameText } from '../domain/namen';
import { mitziehendeTexte, monatsSpanne, vomText } from '../domain/mappeWoerter';
import {
  einziehend,
  nachZusageSatz,
  ortUndDatum,
  selbstauskunftBloecke,
} from '../domain/selbstauskunft';
import { datum as datumText, t } from '../i18n';
import {
  bewerbungBauen,
  type MappenBlock,
  type MappenPerson,
  type MappenQuelle,
  type BewerbungErgebnis,
  type MappenTeil,
  type UnlesbareDatei,
} from '../pdf/bewerbung';
import { PERSONENFARBEN } from '../pdf/mappe';
import { pdfSchriftenLaden } from '../pdf/schriften';
import { bewerbungsKennung, dateiLesen, type HaushaltAnsicht } from '../storage/speicher';
import type { HeftaDb } from '../storage/db';
import { haushaltsAngabenAus } from './selbstauskunftEingabe';
import { fussName, staendeAus, standardDateiname } from './mappeDaten';

export { fussName, staendeAus, standardDateiname };

// Baut die Mappe aus dem gespeicherten Stand (design/mappe-erstellen-einstellungen.md, X1–X9):
// eine PDF oder Einzeldateien. Alles auf dem Gerät; Dateien werden nur gelesen.

export interface MappenErgebnis {
  dateien: File[];
  seiten: number;
  groesse: number;
  /** Gespeicherte Dateien, die eingeflossen sind (ohne die erzeugten Selbstauskünfte). */
  quellen: string[];
  /** Angaben mit Zeichen, die das PDF nicht schreiben kann. */
  ersetzt: string[];
  /** Wer auf welcher Seite anfängt; bei Einzeldateien leer. */
  inhalt: BewerbungErgebnis['inhalt'];
  /** Unterlagen, die fehlen, weil sich ihre Datei nicht lesen lässt. */
  unlesbar: UnlesbareDatei[];
  /** Fürs Schalterchen „Kompakt“; bei Einzeldateien leer. */
  deckSeiten?: number;
  kompaktHilft?: boolean;
  deckMassstab?: number;
}

function farbe(n: number): string {
  return PERSONENFARBEN[(n - 1) % PERSONENFARBEN.length]!;
}

function mappenPerson(s: PersonStand): MappenPerson {
  const taetigkeit =
    s.person.beruf.trim() ||
    (s.person.lebenssituation === 'studierend_azubi' && s.person.ausbildungArt
      ? situationText(s.person.lebenssituation, s.person.ausbildungArt)
      : '');
  return {
    name: nameText(nameImPdf(s.person)),
    rolle: rollenText(s.rolle, s.bezeichnung),
    beruf: taetigkeit,
    farbe: farbe(s.farbe),
    buerge: s.rolle === 'buerge',
    rolleId: s.rolle,
  };
}

/** „Hauptstraße 12“ aus „Hauptstraße 12, 3. OG links“, für Fußzeile und Titel. */
export function wohnungKurz(adresse: string): string {
  return (adresse.split(/\n/)[0] ?? '').split(',')[0]!.trim();
}

/** Letzter Ausweg, wenn sich eine Datei nicht übernehmen lässt: dieselben Seiten als Bilder. */
async function alsBilder(daten: Uint8Array): Promise<Uint8Array> {
  const { alsBilderPdf, pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
  const dokument = await pdfOeffnen(daten);
  try {
    return await alsBilderPdf(dokument);
  } finally {
    await pdfSchliessen(dokument);
  }
}

export async function mappeErstellen(
  db: HeftaDb,
  ansicht: HaushaltAnsicht,
  bewerbung: MappenAnlass | null,
  e: ExportEinstellungen,
  heute = new Date(),
  /** Für die Vorschau in „Mappe anpassen“: dieser Bau, aber mit der gerade gewählten Art. */
  aussehen: MappenAussehen = ansicht.haushalt.mappeAussehen ?? AUSSEHEN_STANDARD,
  /** Für dieselbe Vorschau: Dieses leere Blatt steht für jede Datei, gelesen wird keine. */
  platzhalter?: Uint8Array,
  /** B21: echter Fortschritt beim Zusammenlegen, für den Zwischenstand in „Mappe teilen“. */
  fortschritt?: (fertig: number, gesamt: number) => void,
): Promise<MappenErgebnis> {
  const staende = staendeAus(ansicht, heute);
  const hh = haushaltsAngabenAus(ansicht);
  const schriften = await pdfSchriftenLaden(aussehen.schrift);
  const vertrag = staende.filter((s) => s.rolle !== 'buerge');
  const wer = einziehend(vertrag.length, ansicht.haushalt);
  const adresse = (bewerbung?.adresse ?? '').trim();

  // Teile mit ihren Quellen: Selbstauskunft direkt gezeichnet, sonst die aktuellen Versionen.
  const mappenBloecke: (MappenBlock & { stand: PersonStand })[] = [];
  const quellenIds: string[] = [];
  const unlesbar = new Map<string, UnlesbareDatei>();
  async function lesen(id: string, meldung: UnlesbareDatei): Promise<Uint8Array | null> {
    if (platzhalter) return platzhalter;
    // Verkleinern dauert: Jede Datei nur einmal, danach kommt sie aus dem Zwischenspeicher.
    const schonKlein = e.kleiner ? kleineDateien.holen(id) : undefined;
    if (schonKlein) {
      quellenIds.push(id);
      return new Uint8Array(await schonKlein.arrayBuffer());
    }
    const blob = await dateiLesen(db, id);
    if (!blob) {
      unlesbar.set(meldung.name, meldung);
      return null;
    }
    quellenIds.push(id);
    const daten = new Uint8Array(await blob.arrayBuffer());
    if (!e.kleiner) return daten;
    const { gescannteVerkleinern } = await import('../pdf/pdfjs');
    const klein = await gescannteVerkleinern(daten);
    kleineDateien.merken(id, new Blob([klein as Uint8Array<ArrayBuffer>]), klein.length);
    return klein;
  }

  for (const block of bloecke(staende, e)) {
    const teile: MappenTeil[] = [];
    for (const teil of block.teile) {
      const u = teil.stand;
      const titel = ohneTrennstellen(listenText(u.typ));
      const einzeln = ohneTrennstellen(eintragenText(u.typ));
      const meldung: UnlesbareDatei = {
        name: t('mappe.unlesbarName', {
          unterlage: einzeln,
          name: block.person.person.rufname || block.person.person.vorname,
        }),
        href: `#/unterlage/${block.person.person.id}/${u.typ.id}`,
      };
      if (u.typ.inAppErstellt) {
        teile.push({
          abschnitt: titel,
          typ: u.typ.id,
          quellen: [],
          auskunft: {
            name: nameText(nameImPdf(block.person.person)),
            rolle: rollenText(block.person.rolle, block.person.bezeichnung),
            farbe: farbe(block.person.farbe),
            bloecke: selbstauskunftBloecke(
              block.person.person,
              block.person.rolle,
              wer,
              hh,
              auskunftsSchritt(e),
              {
                rolleText: rollenText(block.person.rolle, block.person.bezeichnung),
                antwortenImmer: auskunftAntwortenImmer(e),
                zusageText: e.mietrueckstaendeNachZusage
                  ? nachZusageSatz(
                      ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge')
                        .length <= 1,
                    )
                  : undefined,
                buergschaftDabei: block.teile.some(
                  (x) => x.stand.typ.id === 'buergschaftserklaerung',
                ),
              },
            ),
            ...ortUndDatum(block.person.rolle, hh.ort, datumText(heute)),
            unterschrift: e.unterschrift,
          },
        });
        continue;
      }
      const versionen = aktuelleVersionen(u.versionen, u.typ.serie, u.typ.jeVariante);
      if (u.typ.serie) {
        // Serie: eine Zeile im Inhalt, neuester Monat zuerst, jeder Monat mit eigenem Kopfband.
        // Gleiche Seiten einer Datei kommen einmal, mit allen Monaten im Kopfband.
        const quellen: MappenQuelle[] = [];
        const alle: string[] = [];
        for (const { id, monate, seiten } of serienQuellen([...versionen].reverse())) {
          const daten = await lesen(id, meldung);
          if (!daten) continue;
          alle.push(...monate);
          quellen.push({
            daten,
            seiten: platzhalter ? undefined : seiten,
            kopf: monate.length ? `${einzeln} ${monatsSpanne(monate, true)}` : einzeln,
          });
        }
        if (quellen.length)
          teile.push({
            abschnitt: titel,
            meldung,
            detail: alle.length ? monatsSpanne(alle, false) : undefined,
            typ: u.typ.id,
            monate: [...alle].sort(),
            quellen,
          });
        continue;
      }
      // Je Variante ein eigener Eintrag im Inhalt: „BAföG-Bescheid“, „Unterhaltsnachweis“.
      for (const v of versionen) {
        const daten = await lesen(v.aufbereitet ?? v.original, meldung);
        if (!daten) continue;
        const name =
          (u.typ.jeVariante && u.typ.varianten?.find((x) => x.id === v.variante)?.text) || titel;
        const vom = v.ausstellungsdatum ? vomText(v.ausstellungsdatum) : '';
        teile.push({
          abschnitt: name,
          meldung,
          detail: vom || undefined,
          typ: u.typ.id,
          vom: v.ausstellungsdatum ?? undefined,
          pruefweg:
            u.typ.fristen?.pruefcodeTage && hatPruefcode(u.typ, v) ? 'pruefcode' : undefined,
          kopf: vom ? `${name === titel ? einzeln : name} ${vom}` : name === titel ? einzeln : name,
          quellen: [{ daten, seiten: platzhalter ? undefined : v.seiten }],
        });
      }
    }
    mappenBloecke.push({ stand: block.person, person: mappenPerson(block.person), teile });
  }

  const kinder = ansicht.haushalt.kinder;
  const weitere = ansicht.haushalt.weitereErwachsene;
  // Kinder und weitere Personen stehen auf dem Deckblatt als eigene Einträge.
  const mitziehende = mitziehendeTexte(kinder, weitere);
  const haupt = vertrag[0]?.person;
  const name = fussName(staende);
  const kurz = wohnungKurz(adresse) || undefined;
  const hauptName = haupt ? nameText(nameImPdf(haupt)) : undefined;
  const dateiname = e.dateiname.trim()
    ? `${e.dateiname.trim().replace(/\.pdf$/i, '')}.pdf`
    : standardDateiname(staende, adresse);

  if (e.ausgabe === 'einzeln') {
    const dateien: File[] = [];
    const ersetzt = new Set<string>();
    let seiten = 0;
    let nummer = 0;
    for (const b of mappenBloecke)
      for (const teil of b.teile) {
        const { vorname, nachname } = nameImPdf(b.stand.person);
        const datei = einzelDateiname(++nummer, teil.abschnitt, vorname, nachname);
        const erg = await bewerbungBauen({
          titel: [teil.abschnitt, b.person.name, kurz ? `Bewerbung ${kurz}` : '']
            .filter(Boolean)
            .join(' – '),
          autor: b.person.name,
          fussName: name,
          kurz,
          adresse: [],
          satz: '',
          mitziehende: [],
          kontakt: [],
          bloecke: [{ person: b.person, teile: [teil] }],
          deckblatt: false,
          inhaltsverzeichnis: false,
          fusszeile: e.fusszeile,
          aussehen,
          schriften,
          datum: heute,
          alsBilder,
        });
        erg.ersetzt.forEach((text) => ersetzt.add(text));
        erg.unlesbar.forEach((u) => unlesbar.set(u.name, u));
        // Ließ sich gar nichts übernehmen, gibt es für diese Unterlage keine leere Datei.
        if (erg.unlesbar.length && !erg.inhalt.length) continue;
        seiten += erg.seiten;
        fortschritt?.(
          nummer,
          mappenBloecke.reduce((n, x) => n + x.teile.length, 0),
        );
        dateien.push(new File([erg.bytes.slice()], datei, { type: 'application/pdf' }));
      }
    return {
      dateien,
      seiten,
      groesse: dateien.reduce((s, d) => s + d.size, 0),
      quellen: quellenIds,
      inhalt: [],
      ersetzt: [...ersetzt],
      unlesbar: [...unlesbar.values()],
    };
  }

  const erg = await bewerbungBauen({
    titel: kurz ? `Bewerbung ${kurz} – ${name}` : `Bewerbung – ${name}`,
    autor: hauptName,
    fussName: name,
    kurz,
    adresse: adresse
      ? adresse
          .split(/\n/)
          .map((z) => z.trim())
          .filter(Boolean)
      : [],
    satz: bewerbung?.satz ?? '',
    inserat: bewerbung?.deckInserat,
    einzug: bewerbung?.deckEinzug,
    fassung: bewerbung?.deckFassung,
    mitziehende,
    // Nur für die Lesehilfe; die Vorschau mit Platzhaltern braucht keine.
    kennung:
      e.deckblatt && e.hinweis !== false && !platzhalter
        ? await bewerbungsKennung(db, ansicht.haushalt.id, adresse)
        : undefined,
    hinweis: e.hinweis !== false,
    modus: e.modus,
    schritt: e.schritt,
    bitte: e.bitte && e.deckblatt ? bitteSatzAus(bewerbung) : undefined,
    kontakt: haupt
      ? [hauptName ?? '', haupt.kontakt.telefon, haupt.kontakt.email].filter(Boolean)
      : [],
    kontaktwege: haupt
      ? { telefon: haupt.kontakt.telefon || undefined, email: haupt.kontakt.email || undefined }
      : undefined,
    bloecke: mappenBloecke,
    deckblatt: e.deckblatt,
    inhaltsverzeichnis: e.inhaltsverzeichnis,
    fusszeile: e.fusszeile,
    aussehen,
    schriften,
    datum: heute,
    alsBilder,
    fortschritt,
  });
  erg.unlesbar.forEach((u) => unlesbar.set(u.name, u));
  const datei = new File([erg.bytes.slice()], dateiname, { type: 'application/pdf' });
  return {
    dateien: [datei],
    seiten: erg.seiten,
    deckSeiten: erg.deckSeiten,
    kompaktHilft: erg.kompaktHilft,
    deckMassstab: erg.deckMassstab,
    groesse: datei.size,
    quellen: quellenIds,
    inhalt: erg.inhalt,
    ersetzt: erg.ersetzt,
    unlesbar: [...unlesbar.values()],
  };
}

/** Wie `mappeErstellen`, aber eine schon gebaute Mappe kommt aus dem Zwischenspeicher. */
export async function mappeGebaut(
  db: HeftaDb,
  ansicht: HaushaltAnsicht,
  bewerbung: MappenAnlass | null,
  e: ExportEinstellungen,
  aussehen?: MappenAussehen,
  fortschritt?: (fertig: number, gesamt: number) => void,
): Promise<MappenErgebnis> {
  const schluessel = bauSchluessel(ansicht, bewerbung, e, aussehen);
  const schon = gebauteMappen.holen(schluessel);
  if (schon) return schon;
  const neu = await mappeErstellen(
    db,
    ansicht,
    bewerbung,
    e,
    new Date(),
    aussehen,
    undefined,
    fortschritt,
  );
  gebauteMappen.merken(schluessel, neu, neu.groesse);
  return neu;
}

/**
 * Lässt sich eine zu große Mappe verkleinern (X6b, X6c)? Statt mit einem festen Wert zu schätzen, werden
 * Bilder wirklich verkleinert und gemessen, und zwar in der fertigen Mappe: So zählt nur, was drin ist,
 * abgewählte Seiten nicht.
 *
 * Scans, deren Bild sich nicht tauschen lässt (Fax, JPEG 2000), zeigt nur die gespeicherte Datei: In der
 * Mappe hat jede Seite eine Fußzeile und gälte als Textseite. Dort wird je Datei eine Seite gemessen; das
 * kann zu viel sein, wenn nicht alle Seiten drin sind, darum nie mehr als neun Zehntel der Mappe.
 */
export async function verkleinernMoeglich(
  db: HeftaDb,
  ergebnis: Pick<MappenErgebnis, 'groesse' | 'quellen' | 'dateien'>,
): Promise<{ geschaetzt: number } | null> {
  const { bilderProbe, scanProbe } = await import('../pdf/pdfjs');
  let ersparnis = 0;
  for (const datei of ergebnis.dateien) {
    const daten = new Uint8Array(await datei.arrayBuffer());
    const probe = await bilderProbe(daten).catch(() => ({ vorher: 0, nachher: 0 }));
    ersparnis += probe.vorher - probe.nachher;
  }
  if (!ersparnis) {
    for (const id of new Set(ergebnis.quellen)) {
      const blob = await dateiLesen(db, id);
      if (!blob) continue;
      const probe = await scanProbe(new Uint8Array(await blob.arrayBuffer()));
      const vorher = blob.size * (probe.bild / probe.gesamt);
      ersparnis += Math.max(0, vorher - probe.kleinJeSeite * probe.bild);
    }
    ersparnis = Math.min(ersparnis, ergebnis.groesse * 0.9);
  }
  const geschaetzt = ergebnis.groesse - ersparnis;
  return geschaetzt < ergebnis.groesse * 0.9 ? { geschaetzt } : null;
}

/** Teilen über das System, sonst Download. Gibt false zurück, wenn abgebrochen. */
export async function teilen(dateien: File[]): Promise<boolean> {
  if (istApp()) return appTeilen(dateien);
  if (navigator.canShare?.({ files: dateien })) {
    try {
      await navigator.share({ files: dateien });
      return true;
    } catch {
      return false;
    }
  }
  sichern(dateien);
  return true;
}

/** Als Datei sichern (Download), je Datei ein Link. */
export function sichern(dateien: File[]): void {
  if (istApp()) {
    void appSichern(dateien);
    return;
  }
  for (const datei of dateien) {
    const url = URL.createObjectURL(datei);
    const a = document.createElement('a');
    a.href = url;
    a.download = datei.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}
