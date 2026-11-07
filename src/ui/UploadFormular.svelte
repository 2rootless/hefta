<script lang="ts">
  import { seitenVorauswahl, varianteErkennen, versionPruefen } from '../domain/pruefhinweise';
  import type { DateiVersion, VersionFakten } from '../domain/modell';
  import PruefKasten from './PruefKasten.svelte';
  import { untrack } from 'svelte';
  import { seitenJeMonat, seitenVorbelegen } from '../domain/aufteilen';
  import SeitenMonate from './SeitenMonate.svelte';
  // Alles nach der Dateiwahl (docs/05-dokument-pipeline.md, Entwurf 4-upload.png und R2 im Rutsch):
  // Seiten mit Kreis zum An- und Abwählen (Tipp auf die Seite macht sie groß), Datei direkt wechseln,
  // Passwort-PDFs entsperren, Variante, Monat bzw. Ausstellungsdatum (freiwillig, wird im Text gesucht
  // oder im Dokument ausgewählt), Speichern. Genutzt vom Hochladen-Blatt und vom Rutsch.
  import { onDestroy, onMount } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { monatAusDateiname, monateAusDateiname } from '../domain/dateiname';
  import { istAndroidApp } from '../app/plattform';
  import { ausstellungstag, datenFinden, monatFinden } from '../domain/datumErkennen';
  import { bewerten, monatPlus, monatsAuswahl, tagAus } from '../domain/fristen';
  import { alterGrenze } from './texte';
  import type { Person } from '../domain/modell';
  import { eintragenText, ohneTrennstellen, type Dokumenttyp } from '../domain/regelkatalog';
  import { staendeAus } from './mappeDaten';
  import { versionTitel } from './versionInfo';
  import { groesse, monatName, t, tagText } from '../i18n';
  import {
    PdfPasswortFehler,
    alsBilderPdf,
    miniatur,
    pdfOeffnen,
    pdfSchliessen,
    seitenStuecke,
    type PdfDokument,
  } from '../pdf/pdfjs';
  import { pdfEntsperren, pdfsZusammenfuegen } from '../pdf/zusammenfuegen';
  import { dokumentAendern, unterlageSpeichern } from '../storage/speicher';
  import Aktionsleiste from './Aktionsleiste.svelte';
  import Hauptbutton from './Hauptbutton.svelte';
  import Notiz from './Notiz.svelte';
  import DatumAuswahl from './DatumAuswahl.svelte';
  import SeitenAnsicht from './SeitenAnsicht.svelte';
  import Symbol from './Symbol.svelte';

  let {
    person,
    typ,
    start,
    knopfText,
    vorbelegterMonat = null,
    fixiert = false,
    onfertig,
    onleer,
    abbrechen,
  }: {
    person: Person;
    typ: Dokumenttyp;
    /** Die zuerst gewählten Dateien. */
    start: FileList | File[];
    knopfText: string;
    /** Bei Serien: Monat statt der Vorbelegung (z. B. nächster fehlender Monat im Rutsch). */
    vorbelegterMonat?: string | null;
    /** Knopf unten fest am Bildschirmrand (eigener Bildschirm statt Blatt). */
    fixiert?: boolean;
    onfertig: () => void | Promise<void>;
    /** Keine lesbare Datei dabei: zurück zur Auswahl, mit Fehlertext. */
    onleer?: (fehler: string) => void;
    /** Ausweg ohne Speichern („Abbrechen“). */
    abbrechen?: { text: string; onclick: () => void };
  } = $props();

  // Während des Speicherns nicht abbrechen: Sonst ginge das Blatt zu, bevor klar ist, ob es geklappt hat.
  // Beim Einlesen geht es: Was dafür noch läuft, hört mit dem Aufräumen von selbst auf.
  const ausweg = $derived(
    abbrechen && {
      text: abbrechen.text,
      onclick: () => {
        if (!beschaeftigt || dateienLaufen) abbrechen.onclick();
      },
    },
  );

  interface Datei {
    name: string;
    bytes: Uint8Array;
    dokument: PdfDokument | null;
    gesperrt: boolean;
    passwort: string;
    passwortFalsch: boolean;
    /** Entsperrte Fassung (oder, wenn Entsperren scheitert, in Bilder umgewandelt). */
    aufbereitet: Uint8Array | null;
    alsBilder: boolean;
    miniaturen: string[];
  }

  const heute = new Date();
  const auswahl = $derived(monatsAuswahl(heute, person.abrechnungMeist));

  let dateien = $state<Datei[]>([]);
  /** Weggelassene Seiten, als „Dateiindex:Seitenindex“. */
  const weggelassen = new SvelteSet<string>();
  let monat = $state<string | null>(null);
  let andererMonat = $state(false);
  // Serien (Gehalt): mehrere Monate in einer Datei möglich (Entwurf RS2), je Monat eine Version.
  const serie = $derived(!!typ.serie && typ.datum === 'abrechnungsmonat');
  const monate = new SvelteSet<string>();
  const serienAuswahl = $derived(
    [-2, -1, 0, 1].map((n) => monatPlus(vorbelegterMonat ?? auswahl.vorbelegt, n)),
  );
  const gewaehlteMonate = $derived([...monate].sort().reverse());
  // Mehrere Dateien einer Serie (z. B. drei Gehaltsnachweise auf einmal): je Datei ein Monat,
  // vorgeschlagen aus dem Dateinamen, sonst vom erwarteten Monat rückwärts.
  let dateiMonate = $state<string[]>([]);
  const jeDatei = $derived(serie && dateien.length > 1);
  const monatsListe = $derived(
    Array.from({ length: 12 }, (_, n) => monatPlus(serienAuswahl[3]!, -n)),
  );
  // Auch bei mehreren Dateien kann eine Datei mehrere Monate enthalten: Dann hat jede Seite ihren Monat,
  // geprüft auf der Seite selbst, nicht nur aus dem Dateinamen (Rückmeldung vom 4.11.).
  let dateiSeiten = $state<(string[] | undefined)[]>([]);
  let dateiFunde = $state<((string | null)[] | undefined)[]>([]);
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- nur Buchführung, nichts zeichnet danach.
  const inArbeit = new Set<PdfDokument>();
  $effect(() => {
    if (!jeDatei) return;
    dateien.forEach((d, i) => {
      const dokument = d.dokument;
      if (!dokument || dokument.numPages < 2 || dateiSeiten[i] || inArbeit.has(dokument)) return;
      inArbeit.add(dokument);
      void (async () => {
        const funde: (string | null)[] = [];
        for (let n = 1; n <= dokument.numPages; n++) {
          funde.push(monatFinden(await seitenStuecke(dokument, n), heute));
        }
        return funde;
      })()
        .catch(() => Array.from({ length: dokument.numPages }, () => null))
        .then((funde) => {
          const stelle = dateien.findIndex((x) => x.dokument === dokument);
          if (stelle < 0) return;
          dateiFunde[stelle] = funde;
          dateiSeiten[stelle] = seitenVorbelegen(
            funde,
            monateAusDateiname(d.name, heute),
            dateiMonate[stelle] ?? '',
          );
        });
    });
  });
  const monateJeDatei = $derived(
    dateien.map((_, i) => {
      const werte = dateiSeiten[i];
      return werte ? [...new Set(werte.filter(Boolean))] : [dateiMonate[i] ?? ''];
    }),
  );
  const doppelt = $derived.by(() => {
    const alle = monateJeDatei.flat();
    return new Set(alle).size !== alle.length;
  });

  function monatVorschlagen(name: string): string {
    const erkannt = monatAusDateiname(name, heute);
    if (erkannt && !dateiMonate.includes(erkannt)) return erkannt;
    let m = vorbelegterMonat ?? auswahl.vorbelegt;
    while (dateiMonate.includes(m)) m = monatPlus(m, -1);
    return m;
  }
  // OR3: Eine Datei mit mehreren Seiten für eine Serie: je Seite ein Monat statt einer Datei je Monat.
  const seitenWahl = $derived(
    serie && dateien.length === 1 && (dateien[0]?.dokument?.numPages ?? 0) > 1,
  );
  let seitenMonate = $state<string[]>([]);
  let seitenFunde = $state<(string | null)[]>([]);
  $effect(() => {
    const d = seitenWahl ? dateien[0] : null;
    const dokument = d?.dokument;
    if (!dokument) return;
    const vorgabe = untrack(() => monat ?? auswahl.vorbelegt);
    void (async () => {
      const funde: (string | null)[] = [];
      for (let n = 1; n <= dokument.numPages; n++) {
        funde.push(monatFinden(await seitenStuecke(dokument, n), heute));
      }
      seitenFunde = funde;
      // Ohne Fund gehören die Seiten zusammen: Eine zweiseitige Abrechnung ist der häufigere Fall.
      seitenMonate = seitenVorbelegen(funde, monateAusDateiname(d!.name, heute), vorgabe);
    })().catch(() => {
      seitenMonate = Array.from({ length: dokument.numPages }, () => vorgabe);
    });
  });
  const seitenAuswahl = $derived(
    [...new Set([...monatsListe, ...seitenMonate.filter(Boolean)])].sort().reverse(),
  );
  const seitenTeile = $derived(
    seitenWahl
      ? seitenJeMonat(seitenMonate.map((m, i) => (weggelassen.has(`0:${i}`) ? '' : m)))
      : [],
  );

  // Dieselbe Datei schon da? Gleich beim Auswählen sagen, nicht erst nach dem Speichern.
  let dateiHashes = $state<(string | null)[]>([]);
  $effect(() => {
    dateien.forEach((d, i) => {
      if (dateiHashes[i] !== undefined) return;
      dateiHashes[i] = null;
      void import('../pdf/fakten')
        .then(({ dateiPruefsumme }) => dateiPruefsumme(d.bytes))
        .then((hash) => {
          const stelle = dateien.findIndex((x) => x.bytes === d.bytes);
          if (stelle >= 0) dateiHashes[stelle] = hash;
        })
        .catch(() => {});
    });
  });
  const vorhandeneDateien = $derived.by(() => {
    // eslint-disable-next-line svelte/prefer-svelte-reactivity -- wird hier gefüllt und nie mehr geändert.
    const karte = new Map<string, string>();
    if (!daten.ansicht) return karte;
    for (const s of staendeAus(daten.ansicht))
      for (const u of s.unterlagen)
        for (const v of u.versionen) {
          const hash = v.erkannteWerte?.hash;
          if (hash && !karte.has(hash))
            karte.set(
              hash,
              `${ohneTrennstellen(eintragenText(u.typ))}, ${versionTitel(v)}, ${s.person.rufname || s.person.vorname}`,
            );
        }
    return karte;
  });
  function schonDa(i: number): string | null {
    const hash = dateiHashes[i];
    if (!hash) return null;
    const wo = vorhandeneDateien.get(hash);
    if (wo) return t('hochladen.schonDa', { wo });
    return dateiHashes.indexOf(hash) !== i ? t('hochladen.zweimalGewaehlt') : null;
  }

  // Der Monat einer Seite, auch im großen Bild wählbar: Dort erst sieht man, was draufsteht.
  const monatsWahl = $derived(
    [
      ...new Set([
        ...monatsListe,
        ...seitenMonate,
        ...dateiMonate,
        ...dateiSeiten.flatMap((w) => w ?? []),
      ]),
    ]
      .filter(Boolean)
      .sort()
      .reverse(),
  );
  function seitenMonat(i: number, s: number): string | null {
    if (seitenWahl) return seitenMonate[s] ?? null;
    if (!jeDatei) return null;
    const werte = dateiSeiten[i];
    return werte ? (werte[s] ?? null) : (dateiMonate[i] ?? null);
  }
  function seitenMonatSetzen(i: number, s: number, monat: string) {
    if (seitenWahl) seitenMonate[s] = monat;
    else if (dateiSeiten[i]) dateiSeiten[i]![s] = monat;
    else dateiMonate[i] = monat;
  }

  // PH4: gleich nach dem Hochladen fragen, die Datei ist noch in der Hand.
  let entwurfFakten = $state.raw<VersionFakten | null>(null);
  const entwurfPasstSo = new SvelteSet<string>();
  $effect(() => {
    const d = dateien.length === 1 ? dateien[0] : null;
    const dokument = d?.dokument;
    entwurfFakten = null;
    if (!d || !dokument) return;
    let vorbei = false;
    void (async () => {
      const { dateiPruefsumme, faktenAus } = await import('../pdf/fakten');
      const fakten = await faktenAus(dokument, await dateiPruefsumme(d.bytes), heute);
      if (!vorbei) entwurfFakten = fakten;
    })().catch(() => {});
    return () => {
      vorbei = true;
    };
  });
  const entwurfHinweis = $derived.by(() => {
    if (!entwurfFakten) return null;
    const andere = (daten.ansicht?.mitglieder ?? [])
      .filter((m) => m.person.id !== person.id)
      .map((m) => ({
        id: m.person.id,
        rufname: m.person.rufname || m.person.vorname,
        vorname: m.person.vorname,
        nachname: m.person.nachname,
      }));
    const eigen = [person, ...(person.nameMappe ? [person.nameMappe] : [])];
    const entwurf = {
      id: 'entwurf',
      original: 'entwurf',
      aufbereitet: null,
      seiten: null,
      abrechnungsmonat: null,
      ausstellungsdatum: null,
      erkannteWerte: entwurfFakten,
      vomNutzerBestaetigt: [...entwurfPasstSo],
    } as unknown as DateiVersion;
    return (
      versionPruefen(
        entwurf,
        { personId: person.id, typ, eigen, andere },
        [entwurf],
        heute,
        true,
      )[0] ?? null
    );
  });

  let datum = $state('');

  // Nur ein Hinweis: Auch eine ältere Fassung lässt sich speichern.
  const zuAlt = $derived.by(() => {
    if (!datum || typ.datum === 'abrechnungsmonat') return false;
    const entwurf = { ausstellungsdatum: datum, createdAt: new Date().toISOString() };
    return bewerten(typ, [entwurf as unknown as DateiVersion], {
      heute,
      abrechnungMeist: null,
      stummBis: null,
    }).veraltet;
  });

  // Was Hefta in der Datei gesehen hat, wählt nur vor. Wer selbst tippt, hat das letzte Wort.
  let vorauswahlHinweis = $state('');
  let varianteAngefasst = false;
  let varianteAusDatei = $state(false);
  let vorgewaehlt: VersionFakten | null = null;
  $effect(() => {
    const fakten = entwurfFakten;
    if (!fakten || fakten === vorgewaehlt) return;
    vorgewaehlt = fakten;
    untrack(() => {
      const seiten = seitenVorauswahl(fakten.seiten, typ.erkennen?.nurSeitenMit?.woerter);
      if (seiten && !weggelassen.size) {
        fakten.seiten.forEach((_, s) => {
          if (!seiten.includes(s)) weggelassen.add(`0:${s}`);
        });
        vorauswahlHinweis = typ.erkennen?.nurSeitenMit?.hinweis ?? '';
      }
      const erkannteVariante = varianteErkennen(fakten.seiten, typ.erkennen?.varianten);
      if (
        erkannteVariante &&
        !varianteAngefasst &&
        typ.varianten?.some((v) => v.id === erkannteVariante)
      ) {
        variante = erkannteVariante;
        varianteAusDatei = true;
      }
    });
  });

  let variante = $state<string | null>(null);
  // „Ja, zu Lea hinzufügen“: Die Datei kommt zu der Person, deren Name darauf steht.
  let zielPerson = $state<string | null>(null);
  let freierName = $state('');
  let fehler = $state('');
  let platzFehler = $state(false);
  let beschaeftigt = $state(false);
  let passwortFeld = $state<HTMLInputElement>();
  // Datum: von Hefta gefunden (Vorschlag), und ob man es schon selbst angefasst hat.
  let erkannt = $state<{ tag: string; seite: number } | null>(null);
  let datumAngefasst = false;
  let monatErkannt = $state<string | null>(null);
  // Viele Seiten (D2, ab 10): erst drei und „+9“; aufgeklappt alle, mit denselben Kreisen.
  let vieleEntschieden = $state(false);
  let aufgeklappt = $state(false);
  // Seiten groß ansehen; das Datum wählen hat einen eigenen Bildschirm (D11b).
  let ansichtOffen = $state(false);
  let ansichtIndex = $state(0);
  let datumOffen = $state(false);
  // Hat die Datei gar keinen Text, kann Hefta nicht suchen, nur zeigen (D11c).
  let textGeprueft = $state(false);
  let textGefunden = $state(false);
  const ohneText = $derived(textGeprueft && !textGefunden);

  // Seiten zählen nach der Datei, nicht nach den Vorschaubildern: Die kommen eins nach dem anderen.
  // Sonst blieben Seiten in der Mappe, deren Bild beim Tippen auf „Seiten auswählen“ noch fehlte.
  const seitenVon = (d: Datei) => d.dokument?.numPages ?? d.miniaturen.length;
  const seitenGesamt = $derived(dateien.reduce((s, d) => s + seitenVon(d), 0));
  const ausgewaehlt = $derived(seitenGesamt - weggelassen.size);
  const alleSchluessel = $derived(
    dateien.flatMap((d, i) => Array.from({ length: seitenVon(d) }, (_, s) => `${i}:${s}`)),
  );
  const vieleSeiten = $derived(seitenGesamt >= 10 && !vieleEntschieden && !aufgeklappt);
  // Viele Seiten: nur die ersten drei und „+9“, sonst wird der Schritt sehr lang (D2). Mehrere
  // Dateien einer Serie stehen je Datei mit ihren Seiten da (RS3b).
  const gekuerzt = $derived(seitenGesamt >= 10 && !aufgeklappt && !jeDatei);
  const seitenListe = $derived(
    dateien.flatMap((d, i) =>
      d.dokument
        ? d.miniaturen.map((_, s) => ({
            dokument: d.dokument!,
            nummer: s + 1,
            schluessel: `${i}:${s}`,
          }))
        : [],
    ),
  );

  function ansehen(schluessel: string) {
    ansichtIndex = Math.max(
      0,
      seitenListe.findIndex((x) => x.schluessel === schluessel),
    );
    ansichtOffen = true;
  }

  function seitenAuswaehlen() {
    // Man wählt aus, was mit soll: Erst ist keine Seite drin.
    for (const k of alleSchluessel) weggelassen.add(k);
    aufgeklappt = true;
    vieleEntschieden = true;
  }

  function datumUebernehmen(tag: string) {
    datum = tag;
    datumAngefasst = true;
    erkannt = null;
    datumOffen = false;
  }

  /** „Keins davon“: Ein Vorschlag von Hefta war also falsch. Selbst Eingetragenes bleibt. */
  function datumKeins() {
    if (erkannt) {
      datum = '';
      erkannt = null;
    }
    datumOffen = false;
  }

  /** Andere Datei: direkt ersetzen, ohne den Umweg über „Abbrechen“. */
  function dateiErsetzen(liste: FileList | null) {
    if (!liste?.length) return;
    const neu = [...liste];
    aufraeumen();
    weggelassen.clear();
    aufgeklappt = false;
    vieleEntschieden = false;
    textGeprueft = false;
    textGefunden = false;
    // Datum und erkannter Monat gehörten zur alten Datei.
    erkannt = null;
    datum = '';
    datumAngefasst = false;
    if (monatErkannt) {
      monat = vorbelegterMonat ?? auswahl.vorbelegt;
      monate.clear();
      monate.add(monat);
      andererMonat = false;
    }
    monatErkannt = null;
    void dateienLaden(neu);
  }

  /** Datum bzw. Monat im Text suchen. Nur ein Vorschlag: Scheitert es, bleibt alles, wie es ist. */
  async function vorschlagen(d: Datei, stelle: number, mehrere: boolean) {
    if (!d.dokument) return;
    const lauf = ladeLauf;
    try {
      if (typ.datum === 'abrechnungsmonat') {
        const m = monatFinden(await seitenStuecke(d.dokument, 1), heute);
        if (!m || lauf !== ladeLauf) return;
        if (mehrere) {
          // Mehrere Dateien: Der Dateiname hat Vorrang, sonst der Text.
          if (!monatAusDateiname(d.name, heute) && !dateiMonate.includes(m))
            dateiMonate[stelle] = m;
        } else if (serie) {
          monate.clear();
          monate.add(m);
          monatErkannt = m;
        } else {
          monat = m;
          andererMonat = !auswahl.monate.includes(m);
          monatErkannt = m;
        }
        return;
      }
      const funde = [];
      for (let n = 1; n <= Math.min(3, d.dokument.numPages); n++) {
        const stuecke = await seitenStuecke(d.dokument, n);
        if (lauf !== ladeLauf) return;
        if (stuecke.some((x) => x.text.trim())) textGefunden = true;
        funde.push(...datenFinden(stuecke, heute).map((f) => ({ ...f, seite: n })));
      }
      textGeprueft = true;
      const vorschlag = ausstellungstag(funde);
      if (datum || datumAngefasst) return;
      if (vorschlag && !datum && !datumAngefasst && lauf === ladeLauf) {
        datum = vorschlag.tag;
        erkannt = vorschlag;
      }
    } catch {
      // nur ein Vorschlag
    }
  }

  function alleOderKeine() {
    if (weggelassen.size) weggelassen.clear();
    else for (const k of alleSchluessel) weggelassen.add(k);
  }

  /** RS3b: eine Datei von mehreren herausnehmen. Die Schlüssel der Seiten hängen an ihrer Stelle. */
  function dateiEntfernen(i: number) {
    const d = dateien[i]!;
    d.miniaturen.forEach((url) => URL.revokeObjectURL(url));
    if (d.dokument) void pdfSchliessen(d.dokument);
    const bleibend = [...weggelassen].flatMap((k) => {
      const [stelle, seite] = k.split(':').map(Number) as [number, number];
      return stelle === i ? [] : [`${stelle > i ? stelle - 1 : stelle}:${seite}`];
    });
    weggelassen.clear();
    bleibend.forEach((k) => weggelassen.add(k));
    dateien.splice(i, 1);
    dateiMonate.splice(i, 1);
    dateiSeiten.splice(i, 1);
    dateiFunde.splice(i, 1);
    dateiHashes.splice(i, 1);
    if (serie && dateien.length === 1 && dateiMonate[0]) {
      monate.clear();
      monate.add(dateiMonate[0]);
    }
  }

  /** Tipp auf den gedämpften Knopf: zum fehlenden Feld springen. */
  function zumFehlenden() {
    if (zuEntsperren) passwortFeld?.focus();
  }

  function hauptaktion() {
    if (zuEntsperren) void entsperren(zuEntsperren);
    else void speichern();
  }
  const zuEntsperren = $derived(dateien.find((d) => d.gesperrt && !d.aufbereitet));
  const grund = $derived(
    zuEntsperren
      ? zuEntsperren.passwort
        ? undefined
        : t('hochladen.grundPasswort')
      : ausgewaehlt === 0
        ? t('hochladen.grundKeineSeite')
        : seitenWahl && !seitenTeile.length
          ? t('hochladen.grundMonat')
          : jeDatei && doppelt
            ? t('hochladen.grundDoppelt')
            : !jeDatei && typ.datum === 'abrechnungsmonat' && (serie ? monate.size === 0 : !monat)
              ? t('hochladen.grundMonat')
              : undefined,
  );

  const keinPdfText = () =>
    t(istAndroidApp() ? 'hochladen.fehler.keinPdfAndroid' : 'hochladen.fehler.keinPdf');

  // Zählt hoch, sobald die Dateien weg sind (ersetzt, gespeichert, Blatt zu): Was für sie noch lädt,
  // hört dann auf und ändert nichts mehr.
  let ladeLauf = 0;

  async function vorschau(d: Datei) {
    if (!d.dokument) return;
    const lauf = ladeLauf;
    for (let n = 1; n <= d.dokument.numPages; n++) {
      const url = await miniatur(d.dokument, n).catch((e: unknown) => {
        if (lauf === ladeLauf) throw e;
        return null;
      });
      if (lauf !== ladeLauf) {
        if (url) URL.revokeObjectURL(url);
        return;
      }
      if (url) d.miniaturen.push(url);
    }
  }

  async function dateienLaden(liste: FileList | File[] | null | undefined) {
    if (!liste?.length) return;
    fehler = '';
    beschaeftigt = true;
    dateienLaufen = true;
    const mehrere = dateien.length + liste.length > 1;
    const lauf = ladeLauf;
    for (const datei of liste) {
      // Scheitert das Lesen (Datei liegt noch in der Cloud), geht es mit den anderen weiter.
      const bytes = await datei.arrayBuffer().then(
        (puffer) => new Uint8Array(puffer),
        () => null,
      );
      if (lauf !== ladeLauf) return;
      if (!bytes) {
        fehler = t('hochladen.fehler.nichtLesbar');
        continue;
      }
      const eintrag: Datei = {
        name: datei.name,
        bytes,
        dokument: null,
        gesperrt: false,
        passwort: '',
        passwortFalsch: false,
        aufbereitet: null,
        alsBilder: false,
        miniaturen: [],
      };
      try {
        eintrag.dokument = await pdfOeffnen(bytes);
      } catch (e) {
        if (e instanceof PdfPasswortFehler) eintrag.gesperrt = true;
        else {
          if (lauf !== ladeLauf) return;
          fehler = keinPdfText();
          continue;
        }
      }
      if (lauf !== ladeLauf) {
        if (eintrag.dokument) void pdfSchliessen(eintrag.dokument);
        return;
      }
      dateien.push(eintrag);
      dateiMonate.push(monatVorschlagen(datei.name));
      const stelle = dateien.length - 1;
      try {
        await vorschau(dateien[stelle]!);
      } catch {
        // Öffnen ging, aber die Seiten lassen sich nicht darstellen: So kann niemand sie prüfen.
        if (lauf !== ladeLauf) return;
        if (eintrag.dokument) void pdfSchliessen(eintrag.dokument);
        dateien.splice(stelle, 1);
        dateiMonate.splice(stelle, 1);
        fehler = t('hochladen.fehler.keinPdf');
        continue;
      }
      if (lauf !== ladeLauf) return;
      await vorschlagen(dateien[stelle]!, stelle, mehrere);
      if (lauf !== ladeLauf) return;
    }
    beschaeftigt = false;
    dateienLaufen = false;
    if (!dateien.length) onleer?.(fehler);
    else if (nachLaden) void speichern();
    nachLaden = false;
  }

  async function entsperren(d: Datei) {
    if (beschaeftigt) return;
    beschaeftigt = true;
    d.passwortFalsch = false;
    try {
      // PDF.js prüft das Passwort und liefert die Vorschau.
      d.dokument = await pdfOeffnen(d.bytes, d.passwort);
      try {
        // Entsperren: Text und Qualität bleiben, die Datei bleibt klein (Entscheidung 31.10.2026).
        d.aufbereitet = await pdfEntsperren(d.bytes, d.passwort);
        d.alsBilder = false;
      } catch {
        // Ausweg für Verschlüsselungen, die pdf-lib nicht kennt: Seiten als Bilder übernehmen.
        d.aufbereitet = await alsBilderPdf(d.dokument);
        d.alsBilder = true;
      }
      await vorschau(d);
      await vorschlagen(d, dateien.indexOf(d), dateien.length > 1);
    } catch (e) {
      if (e instanceof PdfPasswortFehler) d.passwortFalsch = true;
      else fehler = keinPdfText();
    } finally {
      beschaeftigt = false;
    }
  }

  function umschalten(schluessel: string) {
    vorauswahlHinweis = '';
    if (weggelassen.has(schluessel)) weggelassen.delete(schluessel);
    else weggelassen.add(schluessel);
  }

  // Getippt, während die Datei noch lädt: Das darf nicht still verloren gehen. Gespeichert wird, sobald
  // sie da ist; fehlt dann noch etwas, sagt es der Grund unter dem Knopf.
  let dateienLaufen = false;
  let nachLaden = false;

  async function speichern() {
    if (grund) return;
    if (beschaeftigt) {
      if (dateienLaufen) nachLaden = true;
      return;
    }
    beschaeftigt = true;
    fehler = '';
    platzFehler = false;
    try {
      const teile = dateien.map((d) => d.aufbereitet ?? d.bytes);
      const einzeln = dateien.length === 1 ? dateien[0]! : null;
      const original = einzeln ? einzeln.bytes : await pdfsZusammenfuegen(teile);
      const aufbereitet = einzeln?.aufbereitet ?? null;
      const seiten: number[] = [];
      let index = 0;
      dateien.forEach((d, i) =>
        Array.from({ length: seitenVon(d) }).forEach((_, s) => {
          if (!weggelassen.has(`${i}:${s}`)) seiten.push(index);
          index++;
        }),
      );
      const verbindung = await db();
      if (jeDatei) {
        // Je Datei eine Version mit ihrem Monat; Dateien ohne gewählte Seite bleiben weg.
        for (const [i, d] of dateien.entries()) {
          const eigene = Array.from({ length: seitenVon(d) }, (_, s) => s).filter(
            (s) => !weggelassen.has(`${i}:${s}`),
          );
          if (!eigene.length) continue;
          const werte = dateiSeiten[i];
          const teile = werte
            ? seitenJeMonat(werte.map((m, s) => (weggelassen.has(`${i}:${s}`) ? '' : m)))
            : [];
          if (werte && !teile.length) continue;
          const ganz = (s: number[]) => (s.length === seitenVon(d) ? null : s);
          await unterlageSpeichern(verbindung, {
            dateiname: d.name,
            personId: zielPerson ?? person.id,
            typ: typ.id,
            serie: typ.serie?.anzahl ?? null,
            original: new Blob([d.bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
            aufbereitet: d.aufbereitet
              ? new Blob([d.aufbereitet as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
              : null,
            ausstellungsdatum: null,
            abrechnungsmonat: teile[0]?.monat ?? dateiMonate[i]!,
            aufteilung: teile.length > 1 ? teile : undefined,
            variante,
            seiten: teile.length === 1 ? ganz(teile[0]!.seiten) : ganz(eigene),
            gerastert: d.alsBilder,
          });
        }
        await neuLaden();
        aufraeumen();
        await onfertig();
        return;
      }
      await unterlageSpeichern(verbindung, {
        dateiname: dateien[0]?.name ?? null,
        personId: zielPerson ?? person.id,
        typ: typ.id,
        serie: typ.serie?.anzahl ?? null,
        original: new Blob([original as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
        aufbereitet: aufbereitet
          ? new Blob([aufbereitet as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
          : null,
        ausstellungsdatum: typ.datum === 'abrechnungsmonat' ? null : datum || null,
        abrechnungsmonat:
          typ.datum !== 'abrechnungsmonat'
            ? null
            : seitenTeile[0]
              ? seitenTeile[0].monat
              : serie
                ? gewaehlteMonate[0]!
                : monat,
        aufteilung: seitenTeile.length > 1 ? seitenTeile : undefined,
        fakten: dateien.length === 1 ? entwurfFakten : null,
        bestaetigt: [...entwurfPasstSo],

        variante,
        seiten:
          seitenTeile.length === 1
            ? seitenTeile[0]!.seiten.length === seitenGesamt
              ? null
              : seitenTeile[0]!.seiten
            : seiten.length === seitenGesamt
              ? null
              : seiten,
        gerastert: dateien.some((d) => d.alsBilder),
      });
      if (typ.freierName && freierName.trim()) {
        await dokumentAendern(verbindung, zielPerson ?? person.id, typ.id, null, {
          notiz: freierName.trim(),
        });
      }
      await neuLaden();
      aufraeumen();
      await onfertig();
    } catch (e) {
      platzFehler = e instanceof DOMException && e.name === 'QuotaExceededError';
      fehler = platzFehler ? t('hochladen.fehler.platz') : t('hochladen.fehler.unbekannt');
    } finally {
      beschaeftigt = false;
    }
  }

  function aufraeumen() {
    ladeLauf++;
    dateienLaufen = false;
    nachLaden = false;
    for (const d of dateien) {
      d.miniaturen.forEach((url) => URL.revokeObjectURL(url));
      if (d.dokument) void pdfSchliessen(d.dokument);
    }
    dateien = [];
    dateiMonate = [];
    dateiSeiten = [];
    dateiFunde = [];
    dateiHashes = [];
    inArbeit.clear();
    vorauswahlHinweis = '';
    varianteAusDatei = false;
  }

  onMount(() => {
    // Vorbelegung: wahrscheinlichster (oder vorgegebener) Monat, erste Variante.
    monat = vorbelegterMonat ?? auswahl.vorbelegt;
    monate.add(monat);
    variante = typ.varianten?.[0]?.id ?? null;
    void dateienLaden(start);
  });
  onDestroy(aufraeumen);
</script>

{#snippet andereDatei()}
  <label class="textlink andere">
    {t('hochladen.andereDatei')}
    <input
      class="visually-hidden"
      type="file"
      accept="application/pdf,.pdf"
      multiple
      onchange={(e) => dateiErsetzen(e.currentTarget.files)}
    />
  </label>
{/snippet}

{#snippet zelle(i: number, s: number, url: string)}
  {@const schluessel = `${i}:${s}`}
  <div class="zelle">
    <button
      type="button"
      class="seite"
      class:weg={weggelassen.has(schluessel)}
      aria-label={weggelassen.has(schluessel)
        ? t('hochladen.seiteAnsehenWeg', { nummer: s + 1 })
        : t('hochladen.seiteAnsehen', { nummer: s + 1 })}
      onclick={() => ansehen(schluessel)}
    >
      <img src={url} alt="" />
    </button>
    <button
      type="button"
      class="kreis"
      class:weg={weggelassen.has(schluessel)}
      role="checkbox"
      aria-checked={!weggelassen.has(schluessel)}
      aria-label={t('hochladen.seiteDrin', { nummer: s + 1 })}
      onclick={() => umschalten(schluessel)}
    >
      <span class="ring"
        >{#if !weggelassen.has(schluessel)}<Symbol name="haken" groesse={13} />{/if}</span
      >
      <span aria-hidden="true">{s + 1}</span>
    </button>
  </div>
{/snippet}

{#snippet dateiZeile()}
  <div class="datei-zeile">
    <p class="info">
      <!-- Keine Null als Menge (C19): Ist keine Seite gewählt, steht hier nur die Datei. -->
      {#if !ausgewaehlt}
        {dateien.length === 1 ? dateien[0]!.name : t('mappe.dateien', { anzahl: dateien.length })}
      {:else if dateien.length === 1}
        {t('hochladen.seitenInfo', { name: dateien[0]!.name, anzahl: ausgewaehlt })}
      {:else}
        {t('hochladen.mehrereInfo', { anzahl: ausgewaehlt, dateien: dateien.length })}
      {/if}
    </p>
    {#if dateien.length === 1}{@render andereDatei()}{/if}
  </div>
{/snippet}

{#snippet weiteresPdf(klasse: string)}
  <label class={klasse}>
    <span class="plus-kreis"><Symbol name="plus" groesse={14} /></span>
    {klasse === 'plus-zeile' ? t('hochladen.seiteHinzufuegen') : t('hochladen.seite')}
    {#if klasse !== 'plus-zeile'}
      <span class="visually-hidden">{t('hochladen.seiteHinzufuegen')}</span>
    {/if}
    <input
      class="visually-hidden"
      type="file"
      accept="application/pdf,.pdf"
      multiple
      onchange={(e) => dateienLaden(e.currentTarget.files)}
    />
  </label>
{/snippet}

<div class="formular">
  <!-- Gesperrte PDFs zeigen erst nach dem Entsperren Seiten (D5). -->
  {#if seitenGesamt > 0}
    {#if aufgeklappt || weggelassen.size}
      <div class="auswahl-kopf">
        <p role="status">
          {ausgewaehlt
            ? t('hochladen.vonSeiten', { anzahl: ausgewaehlt, gesamt: seitenGesamt })
            : t('hochladen.seitenLeer')}
        </p>
        <button type="button" class="textlink" onclick={alleOderKeine}
          >{weggelassen.size ? t('hochladen.alle') : t('hochladen.keine')}</button
        >
      </div>
    {/if}
    <!-- Mehrere Dateien einer Serie: Seiten je Datei, unten bei der Monatswahl (RS3b). -->
    {#if !jeDatei || zuEntsperren}
      <div
        class="seiten"
        class:kurz={gekuerzt}
        role="group"
        aria-label={t('hochladen.seitenGruppe')}
      >
        {#each dateien as d, i (i)}
          {#each d.miniaturen as url, s (url)}
            {#if !gekuerzt || alleSchluessel.indexOf(`${i}:${s}`) < 3}
              {@render zelle(i, s, url)}
            {/if}
          {/each}
        {/each}
        {#if gekuerzt}
          <button
            type="button"
            class="seite mehr-seiten"
            aria-label={t('hochladen.alleSeitenAnsehen', { anzahl: seitenGesamt })}
            aria-expanded="false"
            onclick={() => (aufgeklappt = true)}>+{seitenGesamt - 3}</button
          >
        {:else}
          {@render weiteresPdf('seite plus-seite')}
        {/if}
      </div>
      {@render dateiZeile()}
      {#if schonDa(0)}<Notiz><p role="status">{schonDa(0)}</p></Notiz>{/if}
      <p class="info">{t('hochladen.seitenHinweis')}</p>
    {/if}
    {#if aufgeklappt && seitenGesamt >= 10}
      <button
        type="button"
        class="textlink"
        onclick={() => {
          aufgeklappt = false;
          vieleEntschieden = true;
        }}>{t('hochladen.wenigerZeigen')}</button
      >
    {/if}
  {/if}
  {#if entwurfHinweis}
    <div class="pruefung">
      <PruefKasten
        hinweis={entwurfHinweis}
        rufname={person.rufname || person.vorname}
        ohneLoesung
        beimLoesen={entwurfHinweis.art === 'name' && entwurfHinweis.person
          ? {
              text: t('pruef.nameHinzufuegen', { name: entwurfHinweis.person.rufname }),
              onclick: () => {
                zielPerson = entwurfHinweis!.person!.id;
                void speichern();
              },
            }
          : undefined}
        beimPasstSo={() => entwurfPasstSo.add(entwurfHinweis!.art)}
        hochladen={() =>
          document
            .querySelector<HTMLInputElement>('dialog[open] input[multiple], main input[multiple]')
            ?.click()}
      />
    </div>
  {/if}
  {#if vorauswahlHinweis}
    <Notiz><p role="status">{vorauswahlHinweis}</p></Notiz>
  {/if}
  {#if vieleSeiten}
    <Notiz>
      <p>{t('hochladen.vieleSeiten', { anzahl: seitenGesamt })}</p>
      <div class="viele">
        <button type="button" class="knopf" onclick={seitenAuswaehlen}
          >{t('hochladen.seitenAuswaehlen')}</button
        >
        <button type="button" class="textlink" onclick={() => (vieleEntschieden = true)}
          >{t('hochladen.alleBehalten', { anzahl: seitenGesamt })}</button
        >
      </div>
    </Notiz>
  {/if}

  {#each dateien as d, i (i)}
    {#if d.gesperrt}
      {#if d.aufbereitet}
        <p class="hinweis" role="status">
          {t(d.alsBilder ? 'hochladen.passwort.gerastert' : 'hochladen.passwort.entsperrt', {
            groesse: groesse(d.aufbereitet.length),
          })}
        </p>
      {:else}
        <p class="gesperrt-text">
          <b>{t('hochladen.passwort.titel')}</b>
          {t('hochladen.passwort.text')}
        </p>
        <div>
          <label class="eingabe">
            {dateien.length === 1
              ? t('hochladen.passwort.feldEine')
              : t('hochladen.passwort.feld', { name: d.name })}
            <input
              type="password"
              autocomplete="off"
              bind:this={passwortFeld}
              bind:value={d.passwort}
              aria-invalid={d.passwortFalsch}
              onkeydown={(e) => {
                if (e.key === 'Enter' && d.passwort) void entsperren(d);
              }}
            />
          </label>
          {#if d.passwortFalsch}<p class="fehlzeile" role="alert">
              {t('hochladen.passwort.falsch')}
            </p>{/if}
          <p class="hinweis klein-abstand">{t('hochladen.passwort.nichtGespeichert')}</p>
        </div>
        {#if dateien.length === 1}{@render andereDatei()}{/if}
      {/if}
    {/if}
  {/each}

  <!-- D5: Datum und Rest erscheinen erst nach dem Entsperren. -->
  {#if !zuEntsperren}
    {#if typ.varianten}
      <fieldset class="feld">
        <legend>{t('hochladen.variante')}</legend>
        <div class="chips" role="radiogroup">
          {#each typ.varianten as v (v.id)}
            <button
              type="button"
              class="chip"
              role="radio"
              aria-checked={variante === v.id}
              onclick={() => {
                variante = v.id;
                varianteAngefasst = true;
                varianteAusDatei = false;
              }}>{v.text}</button
            >
          {/each}
        </div>
        {#if varianteAusDatei}
          <p class="hinweis" role="status">{t('hochladen.varianteErkannt')}</p>
        {:else if typ.varianten.some((v) => v.id === 'beides')}
          <p class="hinweis">{t('hochladen.varianteBeides')}</p>
        {/if}
      </fieldset>
    {/if}

    {#if typ.freierName}
      <label class="eingabe">
        {t('hochladen.freierName')}
        <input bind:value={freierName} />
      </label>
    {/if}

    {#if jeDatei}
      <fieldset class="feld">
        <legend>{t('hochladen.jeDatei')}</legend>
        <ul class="zuordnung">
          {#each dateien as d, i (i)}
            <li>
              {#if dateiSeiten[i]}
                <span class="dateiname">{d.name.replaceAll('_', '_\u200b')}</span>
                <p class="hinweis">{t('hochladen.seitenEinerDatei')}</p>
              {:else}
                <label>
                  <span class="dateiname">{d.name.replaceAll('_', '_\u200b')}</span>
                  <select bind:value={dateiMonate[i]} aria-label={d.name} aria-invalid={doppelt}>
                    {#each [...new Set([dateiMonate[i]!, ...monatsListe])]
                      .sort()
                      .reverse() as m (m)}
                      <option value={m}>{monatName(m, heute)}</option>
                    {/each}
                  </select>
                </label>
              {/if}
              {#if !beschaeftigt}
                <button type="button" class="textlink entfernen" onclick={() => dateiEntfernen(i)}
                  >{t('hochladen.entfernen')}<span class="visually-hidden"> {d.name}</span></button
                >
              {/if}
              {#if schonDa(i)}<p class="hinweis" role="status">{schonDa(i)}</p>{/if}
              {#if dateiSeiten[i]}
                <SeitenMonate
                  zeilen={(dateiFunde[i] ?? [])
                    .map((fund, seite) => ({ seite, fund, bild: d.miniaturen[seite] }))
                    .filter((z) => !weggelassen.has(`${i}:${z.seite}`))}
                  bind:werte={() => dateiSeiten[i] ?? [], (neu) => (dateiSeiten[i] = neu)}
                  monate={monatsWahl}
                  ansehen={(seite) => ansehen(`${i}:${seite}`)}
                />
              {:else if d.miniaturen.length}
                <div class="seiten je-datei" role="group" aria-label={t('hochladen.seitenGruppe')}>
                  {#each d.miniaturen as url, s (url)}
                    {@render zelle(i, s, url)}
                  {/each}
                </div>
              {/if}
            </li>
          {/each}
        </ul>
        {#if doppelt}<p class="fehlzeile" role="alert">{t('hochladen.grundDoppelt')}</p>{/if}
        <p class="hinweis">{t('hochladen.jeDateiHinweis')}</p>
        {@render weiteresPdf('plus-zeile')}
        {@render dateiZeile()}
      </fieldset>
    {:else if seitenWahl}
      <div class="feld">
        <p class="monate-titel">{t('aufteilen.titel')}</p>
        <SeitenMonate
          zeilen={seitenFunde
            .map((fund, seite) => ({ seite, fund, bild: dateien[0]?.miniaturen[seite] }))
            .filter((z) => !weggelassen.has(`0:${z.seite}`))}
          bind:werte={seitenMonate}
          monate={seitenAuswahl}
          ansehen={(seite) => ansehen(`0:${seite}`)}
        />
      </div>
    {:else if serie}
      <fieldset class="feld">
        <legend>{t('hochladen.monate')}</legend>
        <div class="chips" role="radiogroup">
          {#each [...new Set([...serienAuswahl, ...monate])].sort() as m (m)}
            <button
              type="button"
              class="chip"
              role="radio"
              aria-checked={monate.has(m)}
              onclick={() => {
                monate.clear();
                monate.add(m);
              }}
              >{#if monate.has(m)}<Symbol name="haken" groesse={13} />{/if}{monatName(
                m,
                heute,
              )}</button
            >
          {/each}
          <button
            type="button"
            class="chip"
            aria-expanded={andererMonat}
            onclick={() => (andererMonat = !andererMonat)}>{t('hochladen.andererMonat')}</button
          >
        </div>
        {#if andererMonat}
          <label class="eingabe">
            <span class="visually-hidden">{t('hochladen.monat')}</span>
            <input
              type="month"
              max={serienAuswahl[3]}
              onchange={(e) => {
                if (e.currentTarget.value) {
                  monate.clear();
                  monate.add(e.currentTarget.value);
                }
              }}
            />
          </label>
        {/if}
        <p class="hinweis">
          {monatErkannt
            ? t('hochladen.monatErkannt', { monat: monatName(monatErkannt, heute) })
            : t('hochladen.monateHinweis')}
        </p>
      </fieldset>
    {:else if typ.datum === 'abrechnungsmonat'}
      <fieldset class="feld">
        <legend>{t('hochladen.monat')}</legend>
        <div class="chips" role="radiogroup">
          {#each auswahl.monate as m (m)}
            <button
              type="button"
              class="chip"
              role="radio"
              aria-checked={!andererMonat && monat === m}
              onclick={() => {
                monat = m;
                andererMonat = false;
              }}>{monatName(m, heute)}</button
            >
          {/each}
          <button
            type="button"
            class="chip"
            role="radio"
            aria-checked={andererMonat}
            onclick={() => {
              andererMonat = true;
              monat = null;
            }}>{t('hochladen.andererMonat')}</button
          >
        </div>
        {#if andererMonat}
          <label class="eingabe">
            <span class="visually-hidden">{t('hochladen.monat')}</span>
            <input
              type="month"
              max={auswahl.monate[2]}
              onchange={(e) => (monat = e.currentTarget.value || null)}
            />
          </label>
        {/if}
      </fieldset>
    {:else}
      <div class="datum">
        <label class="eingabe">
          {t('hochladen.datum')}
          <input
            type="date"
            max={tagAus(heute)}
            bind:value={datum}
            data-feld="datum"
            oninput={() => {
              datumAngefasst = true;
              erkannt = null;
            }}
          />
        </label>
        <div class="datum-wege">
          <button
            type="button"
            class="chip"
            aria-pressed={datum === tagAus(heute)}
            onclick={() => {
              datum = tagAus(heute);
              datumAngefasst = true;
              erkannt = null;
            }}>{t('hochladen.heute')}</button
          >
          {#if seitenListe.length}
            <button type="button" class="chip" onclick={() => (datumOffen = true)}
              >{ohneText ? t('hochladen.aufSeite') : t('hochladen.imDokument')}</button
            >
          {/if}
        </div>
        {#if erkannt}
          <p class="hinweis" role="status">
            {t('hochladen.datumErkannt', { datum: tagText(erkannt.tag), seite: erkannt.seite })}
          </p>
        {:else if !datum}
          <p class="hinweis">{t('hochladen.datumHinweis')}</p>
        {/if}
        {#if zuAlt}
          <p class="hinweis" role="status">
            {t('unterlage.hinweisZuAlt', { grenze: alterGrenze({ typ }) })}
          </p>
        {/if}
      </div>
    {/if}

    <p class="sicher"><Symbol name="schloss" groesse={20} />{t('datenschutz.kurz')}</p>
  {/if}
  {#if fehler}
    <Notiz stark>
      <p role="alert">{fehler}</p>
      {#if platzFehler}<a class="textlink" href="#/einstellungen"
          >{t('hochladen.speicherAnsehen')}</a
        >{/if}
    </Notiz>
  {/if}
  {#if beschaeftigt}<p class="hinweis" role="status">{t('hochladen.laedt')}</p>{/if}
  <SeitenAnsicht
    bind:offen={ansichtOffen}
    bind:index={ansichtIndex}
    seiten={seitenListe}
    drin={(k) => !weggelassen.has(k)}
    {umschalten}
  >
    {#snippet fuss(schluessel)}
      {@const [i, s] = schluessel.split(':').map(Number) as [number, number]}
      {@const wert = seitenMonat(i, s)}
      {#if wert !== null}
        <label class="seiten-monat">
          <span>{t('hochladen.monatDerSeite')}</span>
          <select value={wert} onchange={(e) => seitenMonatSetzen(i, s, e.currentTarget.value)}>
            {#each monatsWahl as m (m)}
              <option value={m}>{monatName(m, heute)}</option>
            {/each}
            {#if seitenWahl || dateiSeiten[i]}
              <option value="">{t('aufteilen.nichtInMappe')}</option>
            {/if}
          </select>
        </label>
      {/if}
    {/snippet}
  </SeitenAnsicht>
  <DatumAuswahl
    bind:offen={datumOffen}
    seiten={seitenListe}
    vorschlag={datum}
    beimDatum={datumUebernehmen}
    beimKeinen={datumKeins}
  />
  {#if fixiert}
    <Aktionsleiste
      text={zuEntsperren ? t('hochladen.passwort.knopf') : knopfText}
      zusatz={zuEntsperren
        ? undefined
        : jeDatei
          ? t('hochladen.monateZahl', { anzahl: new Set(monateJeDatei.flat()).size })
          : serie && monate.size > 1
            ? t('hochladen.monateZahl', { anzahl: monate.size })
            : undefined}
      {grund}
      onclick={hauptaktion}
      beiGrund={zumFehlenden}
      neben={ausweg}
    />
  {:else}
    <Hauptbutton
      text={zuEntsperren ? t('hochladen.passwort.knopf') : knopfText}
      {grund}
      onclick={hauptaktion}
    />
    {#if ausweg}
      <button type="button" class="textlink ausweg" onclick={ausweg.onclick}>{ausweg.text}</button>
    {/if}
  {/if}
</div>

<style>
  .formular {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-4);
  }

  .ausweg {
    justify-self: center;
    margin-top: calc(-1 * var(--space-2));
  }

  .plus-seite:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .hinweis,
  .info {
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
  }

  .gesperrt-text {
    margin: 0;
    padding: 14px 16px;
    border-radius: 18px;
    background: var(--surface);
    font-size: calc(16 * var(--px));
    line-height: calc(22 * var(--px));
  }

  .gesperrt-text b {
    font-weight: 800;
  }

  .seite.mehr-seiten {
    align-self: start;
    background: var(--track);
    box-shadow: none;
    color: var(--ink);
    font-size: calc(17 * var(--px));
    font-weight: 800;
  }

  /* Immer dieselbe Ansicht: drei Spalten, darunter der Kreis zum An- und Abwählen. */
  .seiten {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--space-3) var(--space-2);
    padding: 4px;
  }

  /* Drei Seiten und „+9“ in einer Reihe. */
  .seiten.kurz {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .zelle {
    display: grid;
    min-width: 0;
  }

  .seite {
    position: relative;
    display: grid;
    place-items: center;
    width: 100%;
    aspect-ratio: 3 / 4;
    padding: 0;
    border: 0;
    border-radius: var(--radius-sm);
    background: #ffffff;
    box-shadow: var(--shadow-chip);
    cursor: pointer;
    overflow: hidden;
  }

  .kreis {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: var(--tap-target);
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font-size: calc(13 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  .ring {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--ink);
    color: var(--ground);
  }

  .kreis.weg .ring {
    border-style: dashed;
    border-color: var(--control-border);
    background: none;
  }

  .kreis.weg {
    color: var(--ink-muted);
  }

  .seite img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .seite.weg img {
    opacity: 0.25;
  }

  .seite.weg::after {
    content: '';
    position: absolute;
    inset: 0;
    border: 2px dashed var(--control-border);
    border-radius: var(--radius-sm);
  }

  .plus-seite {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: var(--space-2);
    align-self: start;
    border: 2px dashed var(--ink);
    background: none;
    box-shadow: none;
    font-size: calc(14 * var(--px));
    font-weight: 700;
    color: var(--ink);
  }

  .plus-kreis {
    display: grid;
    place-items: center;
    width: var(--plus-size);
    height: var(--plus-size);
    border-radius: 50%;
    background: var(--ink);
    color: var(--ground);
  }

  .feld {
    margin: 0;
    padding: 0;
    border: 0;
    display: grid;
    gap: var(--space-3);
  }

  legend {
    margin-bottom: var(--space-3);
    padding: 0;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .sicher {
    display: flex;
    align-items: center;
    gap: var(--space-3);
    margin: 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .knopf {
    justify-self: start;
    min-height: var(--tap-target);
    padding: 0 var(--space-5);
    border: 2px solid var(--ink);
    border-radius: var(--radius-full);
    background: none;
    font-size: calc(15 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  .viele {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 16px;
    margin-top: 10px;
  }

  .viele .knopf {
    padding: 0 16px;
    font-size: calc(14 * var(--px));
    white-space: nowrap;
  }

  .viele .textlink {
    margin-bottom: 0;
  }

  .auswahl-kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }

  .auswahl-kopf p {
    margin: 0;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 800;
  }

  .zuordnung {
    display: grid;
    margin: 0;
    padding: 4px 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .zuordnung li + li {
    border-top: 1px solid var(--track);
  }

  .zuordnung li {
    padding-bottom: 6px;
  }

  /* Je Datei ihre Seiten unter dem Namen (RS3b), kleiner als im Raster. */
  .seiten.je-datei {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    padding: 0 0 2px;
  }

  .entfernen {
    display: flex;
    margin-left: auto;
  }

  .plus-zeile {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap-target);
    font-size: calc(15 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  .zuordnung label {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    padding: 6px 0;
    gap: 12px;
    min-height: 56px;
  }

  /* Wird es eng, rutscht die Auswahl unter den Namen, statt das Wort zu trennen. */
  .dateiname {
    flex: 1 1 9em;
    min-width: 0;
    overflow-wrap: break-word;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .zuordnung select {
    flex-shrink: 0;
    min-height: var(--tap-target);
    padding: 0 10px;
    border: 1.5px solid var(--control-border);
    border-radius: 12px;
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    font-size: calc(16 * var(--px));
    font-weight: 700;
  }

  .datum {
    display: grid;
    gap: var(--space-2);
  }

  .datei-zeile .info {
    flex: 1 1 12em;
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .datei-zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0 12px;
    margin-bottom: calc(-1 * var(--space-3));
  }

  .andere {
    flex-shrink: 0;
    font-size: calc(14 * var(--px));
  }

  .andere:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .pruefung {
    margin: 12px 0;
  }

  .monate-titel {
    margin: 0 0 8px;
    font-weight: 800;
  }

  .datum-wege {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }

  .datum-wege .chip {
    padding: 0 16px;
    font-size: calc(14 * var(--px));
  }

  .klein-abstand {
    margin-top: 8px;
  }

  .knopf:disabled {
    border-color: var(--control-border);
    color: var(--ink-muted);
  }
</style>
