<script lang="ts">
  import { pruefhinweise } from '../domain/pruefhinweise';
  import { pruefAnzeige } from '../ui/pruefTexte';

  // Mappe erstellen, neu geordnet (design/mappe-erstellen-neu.md, ME1 bis ME10): zuerst die Mappe selbst
  // mit Deckblatt, Wohnung und Satz, dann alles zum Ansehen in einer Liste, wer dabei ist, was rein soll,
  // „Mappe anpassen“; unten „Teilen“ mit der Größe. Die Einstellungen werden gleich gespeichert.
  import { onDestroy, onMount, untrack } from 'svelte';
  import { daten, db, gehe } from '../app/daten.svelte';
  import {
    bloecke,
    mappeInhalt,
    fehlendeUnterlagen,
    zuAlteUnterlagen,
    hinweise,
    schluessel,
    einstellungenNachLaden,
    datensparsamUmstellen,
    standardEinstellungen,
    vorhanden,
    type ExportEinstellungen,
    type ExportModus,
  } from '../domain/export';
  import { adresseTeile, adresseZeilen } from '../domain/adresse';
  import type { Bewerbung } from '../domain/modell';
  import { lateinFehlt } from '../domain/namen';
  import {
    dokumenttyp,
    listenText,
    rollenText,
    warumInhalt,
    type Dokumenttyp,
    type PersonStand,
    type UnterlagenStand,
    ohneTrennstellen,
    DOKUMENTTYPEN,
  } from '../domain/regelkatalog';
  import { groesse, t, zahlwort } from '../i18n';
  import { namenListe } from '../domain/datenspur';
  import { bewerbungLaden, bewerbungSpeichern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Eingeklappt from '../ui/Eingeklappt.svelte';
  import Schalter from '../ui/Schalter.svelte';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import WerIstDabeiAuswahl from '../ui/WerIstDabeiAuswahl.svelte';
  import SchalterZeile from '../ui/SchalterZeile.svelte';
  import WarumBlatt from '../ui/WarumBlatt.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { staendeAus, zeichenFunde } from '../ui/mappeDaten';
  import { werIstDabeiKurz } from '../domain/mappeWoerter';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import { passend, TITEL } from '../ui/passend';
  import type { MappenErgebnis } from '../ui/mappeErstellen';
  import { bauSchluessel, gebauteMappen, schaetzungen, vorschauen } from '../ui/mappeSpeicher';
  import type { PdfDokument } from '../pdf/pdfjs';
  import { standText } from '../ui/texte';

  const GRENZE = 5 * 1024 * 1024;
  let warumTyp = $state<Dokumenttyp | null>(null);
  let warumOffen = $state(false);
  let warumKnopf = $state<HTMLElement | null>(null);
  function warum(e: MouseEvent, typ: Dokumenttyp | undefined) {
    if (!typ) return;
    warumKnopf = e.currentTarget as HTMLElement;
    warumTyp = typ;
    warumOffen = true;
  }
  // Zu große Mappe: lässt sie sich verkleinern (X6c) oder nicht (X6b)? Erst geprüft, wenn es nötig ist.
  let kleiner = $state<{ geschaetzt: number } | null>(null);
  let kleinerGeprueft = $state(false);

  async function kleinerPruefen(erg: MappenErgebnis, nummer: number) {
    kleiner = null;
    kleinerGeprueft = false;
    if (erg.groesse <= GRENZE) return;
    if (!e.kleiner) {
      let moeglich = schaetzungen.get(erg);
      if (moeglich === undefined) {
        const { verkleinernMoeglich } = await import('../ui/mappeErstellen');
        moeglich = await verkleinernMoeglich(await db(), erg);
        schaetzungen.set(erg, moeglich);
      }
      if (nummer !== lauf) return; // inzwischen neu gebaut
      kleiner = moeglich;
    }
    kleinerGeprueft = true;
  }

  let bewerbung = $state<Bewerbung | null>(null);
  // Nur Adresse und Satz lösen ein neues Bauen aus, nicht jedes Speichern der Bewerbung (sonst Schleife).
  const adresseText = $derived(bewerbung?.adresse ?? '');
  const satzText = $derived(bewerbung?.satz ?? '');
  let e = $state<ExportEinstellungen>(standardEinstellungen());
  let geladen = $state(false);

  const ansicht = $derived(daten.ansicht);
  const staende = $derived(ansicht ? staendeAus(ansicht) : []);
  // Abwählen lassen sich nur Bürgen; wer inzwischen im Vertrag steht, ist immer dabei.
  const dabei = $derived(
    staende.filter((s) => s.rolle !== 'buerge' || !e.ohne.includes(s.person.id)),
  );
  // Eigene Auswahl (X9): „meist unnötig“ steht gesammelt am Ende, nicht bei jeder Person.
  const unnoetige = $derived(
    dabei.flatMap((s) =>
      s.unterlagen
        .filter((u) => u.typ.etikett === 'meist_unnoetig')
        .map((u) => [s, u] as [PersonStand, UnterlagenStand]),
    ),
  );
  const vertrag = $derived(staende.filter((s) => s.rolle !== 'buerge'));
  // „Was in der Mappe liegt“ (B23): je Unterlagenart einmal, mit den Personen, für die sie drinliegt.
  const inhaltBloecke = $derived(bloecke(staende, e));
  const inhalt = $derived(mappeInhalt(inhaltBloecke));
  function fuerText(fuer: PersonStand[]): string {
    const alle = inhaltBloecke.length;
    if (fuer.length > 1 && fuer.length === alle)
      return alle === 2 ? t('mappe.fuerBeide') : t('mappe.fuerAlle', { zahl: zahlwort(alle) });
    return namenListe(fuer.map((x) => x.person.rufname || x.person.vorname));
  }
  const buergen = $derived(staende.filter((s) => s.rolle === 'buerge'));
  const liste = $derived(hinweise(staende, e));
  // Ältere Daten oder ein Backup: Der Name steht noch nicht in lateinischen Buchstaben (K8). Mappe
  // ersetzt ihn nicht still, also geht die Mappe erst danach raus.
  const ohneLatein = $derived(dabei.filter((s) => lateinFehlt(s.person)));

  onMount(async () => {
    if (!daten.ansicht) return;
    bewerbung = await bewerbungLaden(await db(), daten.ansicht.haushalt.id);
    e = einstellungenNachLaden(bewerbung?.export, $state.snapshot(e));
    // E49: „Datensparsam“ gibt es nicht mehr; dieselbe Mappe als „Eigene Auswahl“, mit dem Schalter.
    if (e.modus === 'datensparsam')
      e = datensparsamUmstellen(
        e,
        daten.ansicht.mitglieder.map((m) => m.person.id),
        DOKUMENTTYPEN,
      );
    geladen = true;
  });

  // Speichern und Vorschau neu bauen, kurz nach jeder Änderung.
  // ME11: dieselbe Seite als „Deckblatt groß“; die Blätter für Wohnung und Satz bleiben so erreichbar.
  let { gross = false }: { gross?: boolean } = $props();
  let ergebnis = $state.raw<MappenErgebnis | null>(null);
  // Bleibt stehen, bis das neue Bild da ist: kein Spinner, wenn sich etwas ändert.
  let deckbild = $state<string | null>(null);
  let baut = $state(false);
  let fehler = $state(false);
  // B21, Mappe entsteht: Braucht der Bau länger als 400 ms, weicht der Knopf einem ruhigen Kasten mit
  // echtem Fortschritt. Darunter erscheint nichts, damit es bei schnellen Bauten nicht flackert.
  let bau = $state<{ fertig: number; gesamt: number } | null>(null);
  let bauSichtbar = $state(false);
  // Seitenzahl ändert sich: die neue Zahl steigt ein, nicht beim ersten Zeigen.
  let seitenZuletzt: number | undefined;
  const seitenNeu = $derived(
    ergebnis !== null && seitenZuletzt !== undefined && ergebnis.seiten !== seitenZuletzt,
  );
  $effect(() => {
    seitenZuletzt = ergebnis?.seiten;
  });
  let zeitgeber: ReturnType<typeof setTimeout> | undefined;
  let lauf = 0;
  // Unterlagen, die fehlen, weil sich ihre Datei nicht lesen lässt: Das darf nicht still passieren.
  const unlesbar = $derived(baut ? [] : (ergebnis?.unlesbar ?? []));
  // Freitext mit Zeichen, die das PDF nicht schreiben kann: Welches Feld, und dorthin führen. Der Name
  // hat seinen eigenen Hinweis. Bleibt etwas übrig, das kein Feld erklärt, wenigstens der Text selbst.
  const zeichen = $derived(
    ohneLatein.length || !ansicht
      ? []
      : zeichenFunde(dabei, haushaltsAngabenAus(ansicht), bewerbung),
  );
  // PH5: nicht lesbar, fehlt, zu alt, fremde Zeichen, Prüfhinweise. Ein Ort für alles vor dem Senden. P20 steckt in den Prüfhinweisen.
  const vorherAnsehen = $derived.by(() => {
    const zeilen: {
      id: string;
      titel: string;
      sub: string;
      href?: string;
      aktion?: () => void;
    }[] = [
      ...unlesbar.map((u) => ({
        id: `datei-${u.name}`,
        titel: u.name,
        sub: t('mappe.vorherUnlesbar'),
        href: u.href,
      })),
      ...ohneLatein.map((s) => ({
        id: `latein-${s.person.id}`,
        titel: t('mappe.lateinFehlt', { name: s.person.rufname || s.person.vorname }),
        sub: t('mappe.lateinEintragen'),
        href: `#/person-aendern/${s.person.id}`,
      })),
      // E96, 3: Ohne Nachname geht es trotzdem; Hefta sagt es hier noch einmal, sperrt aber nicht.
      ...dabei
        .filter((s) => !s.person.nachname.trim() && !ohneLatein.includes(s))
        .map((s) => ({
          id: `nachname-${s.person.id}`,
          titel: t('uebersicht.nachnameFehlt', { name: s.person.rufname || s.person.vorname }),
          sub: t('uebersicht.nachnameWozu'),
          href: `#/person-aendern/${s.person.id}`,
        })),
      ...fehlendeUnterlagen(dabei, e).map(({ person, unterlage }) => ({
        id: `fehlt-${person.person.id}-${unterlage.typ.id}`,
        titel: t('mappe.unlesbarName', {
          unterlage: ohneTrennstellen(listenText(unterlage.typ)),
          name: person.person.rufname || person.person.vorname,
        }),
        sub: t('person.standFehlt'),
        href: `#/unterlage/${person.person.id}/${unterlage.typ.id}`,
      })),
      ...zuAlteUnterlagen(dabei, e).map(({ person, unterlage }) => ({
        id: `alt-${person.person.id}-${unterlage.typ.id}`,
        titel: t('mappe.unlesbarName', {
          unterlage: ohneTrennstellen(listenText(unterlage.typ)),
          name: person.person.rufname || person.person.vorname,
        }),
        sub: unterlage.grund,
        href: `#/unterlage/${person.person.id}/${unterlage.typ.id}`,
      })),
    ];
    for (const h of pruefhinweise(staende).values()) {
      const person = dabei.find((s) => s.person.id === h.personId);
      if (!person) continue;
      const rufname = person.person.rufname || person.person.vorname;
      zeilen.push({
        id: `pruef-${h.personId}-${h.typ.id}`,
        titel: t('mappe.unlesbarName', {
          unterlage: ohneTrennstellen(listenText(h.typ)),
          name: rufname,
        }),
        sub: pruefAnzeige(h, rufname).kurz,
        href: `#/unterlage/${h.personId}/${h.typ.id}`,
      });
    }
    for (const z of zeichen) {
      zeilen.push({
        id: `feld-${z.feld}`,
        titel: z.feld,
        sub: t('mappe.vorherZeichen'),
        href: z.ziel === 'adresse' || z.ziel === 'satz' ? undefined : z.ziel,
        aktion: z.ziel === 'adresse' ? adresseOeffnen : z.ziel === 'satz' ? satzOeffnen : undefined,
      });
    }
    return zeilen;
  });
  const zuGross = $derived(!!ergebnis && !baut && ergebnis.groesse > GRENZE);
  const zeichenFehlen = $derived(
    ohneLatein.length || baut || zeichen.length
      ? []
      : (ergebnis?.ersetzt ?? []).slice(0, 3).map((text) => `„${text}“`),
  );
  // Die Größe zählt mit: „Vier Dinge …“, wenn sie eins davon ist. Zeichen ohne Feld sind nur eine Zeile.
  const vorherAnzahl = $derived(
    vorherAnsehen.length + (zeichenFehlen.length ? 1 : 0) + (zuGross ? 1 : 0),
  );
  const allesDa = $derived(!!ergebnis && !baut && !vorherAnzahl);
  // Zählt Änderungen; ein Bauen gilt nur als fertig, wenn seitdem nichts mehr geändert wurde.
  let aenderung = 0;

  // Immer nur ein Bau: Zwei Mappen zugleich im Speicher sind auf dem iPhone zu viel. Kommt währenddessen
  // eine Änderung, folgt danach genau ein weiterer.
  let baustelle = false;
  let nochEinmal = false;

  async function bauen() {
    if (!daten.ansicht) return;
    if (baustelle) {
      nochEinmal = true;
      return;
    }
    baustelle = true;
    nochEinmal = false;
    const nummer = ++lauf;
    const beiStart = aenderung;
    fehler = false;
    bau = { fertig: 0, gesamt: 1 };
    const uhr = setTimeout(() => {
      if (nummer === lauf && bau) bauSichtbar = true;
    }, 400);
    try {
      const verbindung = await db();
      const plain = $state.snapshot(e);
      // Gespeicherten Stand nur zum Bauen nutzen, nicht in den Zustand schreiben (sonst Schleife).
      const gespeichert = await bewerbungSpeichern(verbindung, daten.ansicht.haushalt.id, {
        export: plain,
      });
      const { mappeGebaut } = await import('../ui/mappeErstellen');
      const neu = await mappeGebaut(
        verbindung,
        daten.ansicht,
        gespeichert,
        plain,
        undefined,
        (fertig, gesamt) => {
          if (nummer === lauf) bau = { fertig, gesamt };
        },
      );
      if (nummer !== lauf) return;
      if (neu !== ergebnis) {
        ergebnis = neu;
        await vorschau(neu);
        void kleinerPruefen(neu, nummer);
      }
    } catch {
      if (nummer === lauf) fehler = true;
    } finally {
      clearTimeout(uhr);
      baustelle = false;
      if (!nochEinmal) {
        bau = null;
        bauSichtbar = false;
      }
      if (nochEinmal) void bauen();
      else if (nummer === lauf && beiStart === aenderung) baut = false;
    }
  }

  /** Die echte erste Seite der Mappe; bei Einzeldateien gibt es keine, dort liegen drei Blätter. */
  async function vorschau(erg: MappenErgebnis) {
    const schon = vorschauen.get(erg);
    if (schon) {
      deckbild = schon[0] ?? null;
      return;
    }
    const erste = erg.dateien[0];
    if (!erste || e.ausgabe === 'einzeln') return;
    const { miniatur, pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
    const dok = await pdfOeffnen(new Uint8Array(await erste.arrayBuffer()));
    const bild = await miniatur(dok, 1, 300);
    await pdfSchliessen(dok);
    vorschauen.set(erg, [bild]);
    // Inzwischen eine andere Wahl: Das Bild bleibt für später, gezeigt wird das neue.
    if (erg === ergebnis) deckbild = bild;
  }

  // Die erste Seite in voller Breite. Bleibt stehen, bis das neue Bild da ist.
  let deckGross = $state<string | null>(null);
  $effect(() => {
    const erg = ergebnis;
    const erste = erg?.dateien[0];
    if (!gross || !erste || baut) return;
    let abgebrochen = false;
    void (async () => {
      const { miniatur, pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
      const dok = await pdfOeffnen(new Uint8Array(await erste.arrayBuffer()));
      const bild = await miniatur(dok, 1, 1100);
      await pdfSchliessen(dok);
      if (abgebrochen) return URL.revokeObjectURL(bild);
      if (deckGross) URL.revokeObjectURL(deckGross);
      deckGross = bild;
    })();
    return () => {
      abgebrochen = true;
    };
  });
  onDestroy(() => {
    if (deckGross) URL.revokeObjectURL(deckGross);
  });
  // Vorschau groß: die ganze Mappe, bei Einzeldateien die angetippte Datei. PDF.js kommt erst beim
  // Antippen dazu.
  let Ansicht = $state<typeof import('../ui/SeitenAnsicht.svelte').default | null>(null);
  let ansichtOffen = $state(false);
  let ansichtIndex = $state(0);
  let ansichtSeiten = $state.raw<{ dokument: PdfDokument; nummer: number; schluessel: string }[]>(
    [],
  );
  let offenesPdf: PdfDokument | null = null;

  async function pdfZu() {
    if (!offenesPdf) return;
    const { pdfSchliessen } = await import('../pdf/pdfjs');
    void pdfSchliessen(offenesPdf);
    offenesPdf = null;
  }

  async function ansehen(datei: File | undefined, index = 0) {
    if (!datei) return;
    const { pdfOeffnen } = await import('../pdf/pdfjs');
    const modul = await import('../ui/SeitenAnsicht.svelte');
    await pdfZu();
    const dokument = await pdfOeffnen(new Uint8Array(await datei.arrayBuffer()));
    offenesPdf = dokument;
    ansichtSeiten = Array.from({ length: dokument.numPages }, (_, n) => ({
      dokument,
      nummer: n + 1,
      schluessel: String(n),
    }));
    ansichtIndex = index;
    Ansicht = modul.default;
    ansichtOffen = true;
  }

  $effect(() => {
    if (!geladen) return;
    void JSON.stringify(e);
    void adresseText;
    void satzText;
    untrack(() => {
      aenderung++;
      clearTimeout(zeitgeber);
      // Schon einmal gebaut: sofort da. Gespeichert wird die Wahl trotzdem.
      const schon = daten.ansicht
        ? gebauteMappen.holen(bauSchluessel(daten.ansicht, bewerbung, $state.snapshot(e)))
        : undefined;
      if (schon) {
        const nummer = ++lauf;
        fehler = false;
        baut = false;
        ergebnis = schon;
        void vorschau(schon);
        void kleinerPruefen(schon, nummer);
      } else {
        // Ab jetzt ist die gebaute Mappe veraltet: Teilen erst wieder, wenn die neue fertig ist.
        baut = true;
      }
      zeitgeber = setTimeout(() => void bauen(), 350);
    });
  });
  onDestroy(() => {
    clearTimeout(zeitgeber);
    void pdfZu();
  });

  function buergeUmschalten(id: string) {
    e.ohne = e.ohne.includes(id) ? e.ohne.filter((x) => x !== id) : [...e.ohne, id];
  }

  function modusSetzen(m: ExportModus) {
    e.modus = m;
  }

  /** „Hinzufügen“ beim Hinweis ohne Bonität: eigene Auswahl wie bisher, plus Bonität (X2). */
  function bonitaetDazu() {
    const auswahl: Record<string, boolean> = {};
    for (const s of staende)
      for (const u of s.unterlagen)
        auswahl[schluessel(s.person.id, u.typ.id)] =
          u.typ.id === 'bonitaet' ||
          (u.typ.schritt === 'will_wohnung' && u.typ.etikett !== 'meist_unnoetig') ||
          (e.schritt === 'zusage' && u.typ.schritt === 'zusage');
    e.auswahl = auswahl;
    e.modus = 'eigene_auswahl';
  }

  // Wohnung: im Blatt eintragen (optional).
  let adresseOffen = $state(false);
  let adresse = $state('');
  function adresseOeffnen() {
    adresse = adresseText;
    adresseOffen = true;
  }
  async function adresseUebernehmen() {
    if (!daten.ansicht) return;
    adresseOffen = false;
    // Nichts geändert: Es käme kein neuer Bau, und die Mappe bliebe auf „wird berechnet“ stehen.
    if (adresse.trim() === adresseText) return;
    baut = true;
    aenderung++;
    bewerbung = await bewerbungSpeichern(await db(), daten.ansicht.haushalt.id, {
      adresse: adresse.trim(),
    });
  }

  // Der freiwillige Satz gehört zum Erstellen: Er steht auf dem Deckblatt, das man hier gleich sieht.
  let satzOffen = $state(false);
  let satz = $state('');
  async function satzUebernehmen() {
    if (!daten.ansicht) return;
    satzOffen = false;
    if (satz.trim() === satzText) return;
    baut = true;
    aenderung++;
    bewerbung = await bewerbungSpeichern(await db(), daten.ansicht.haushalt.id, {
      satz: satz.trim(),
    });
  }
  function satzOeffnen() {
    satz = satzText;
    satzOffen = true;
  }
  const wohnung = $derived(adresseTeile(adresseZeilen(adresseText)));
  const einzeln = $derived(e.ausgabe === 'einzeln');
  const allein = $derived(vertrag.length === 1);
  let listeOffen = $state(false);

  // Eigene Auswahl: je Person aufklappbar. Offen ist zuerst, wo etwas fehlt, immer nur eine.
  const auswahlListe = (s: PersonStand) =>
    s.unterlagen.filter(
      (u) =>
        u.typ.id !== 'anschreiben' &&
        u.typ.etikett !== 'meist_unnoetig' &&
        (vorhanden(u) || u.typ.etikett === 'ueblich'),
    );
  function istAn(s: PersonStand, u: UnterlagenStand): boolean {
    return (
      vorhanden(u) &&
      (e.auswahl[schluessel(s.person.id, u.typ.id)] ??
        (u.typ.etikett === 'ueblich' ||
          (u.typ.etikett === 'kann_helfen' && u.versionen.length > 0)))
    );
  }
  let offenGewaehlt = $state<string | null | undefined>(undefined);
  const offenePerson = $derived(
    offenGewaehlt !== undefined
      ? offenGewaehlt
      : (dabei.find((s) => auswahlListe(s).some((u) => !vorhanden(u))) ?? dabei[0])?.person.id,
  );

  async function teilenKlick() {
    if (!ergebnis) return;
    const { teilen } = await import('../ui/mappeErstellen');
    await teilen(ergebnis.dateien);
  }
  async function sichernKlick() {
    if (!ergebnis) return;
    // In der App zeigt „PDF ansehen“ die Mappe in der Seitenansicht, ohne sie zu speichern. Sichern geht
    // dort über „Teilen“ › „In Dateien sichern“. Im Browser bleibt es der Download, den Safari öffnet.
    const { istApp } = await import('../app/plattform');
    if (istApp()) return ansehen(ergebnis.dateien[0]);
    const { sichern } = await import('../ui/mappeErstellen');
    sichern(ergebnis.dateien);
  }

  const leer = $derived(!!ergebnis && ergebnis.seiten <= 1 && e.ausgabe === 'eine');

  const deckAlt = $derived(
    t('mappe.deckGross.alt', {
      wohnung:
        [wohnung.strasse, wohnung.rest].filter(Boolean).join(', ') || t('mappe.deckGross.altOhne'),
      wer: werIstDabeiKurz({
        vertrag: vertrag.length,
        kinder: ansicht?.haushalt.kinder ?? 0,
        weitere: ansicht?.haushalt.weitereErwachsene ?? 0,
        buergen: dabei.filter((x) => x.rolle === 'buerge').length,
      }),
    }),
  );
</script>

{#snippet auswahlZeile(s: PersonStand, u: UnterlagenStand, mitName: boolean)}
  {@const k = schluessel(s.person.id, u.typ.id)}
  {@const da = vorhanden(u)}
  {@const an = istAn(s, u)}
  <li>
    <span class="tx">
      <b>{listenText(u.typ)}</b>
      <small
        >{mitName ? `${s.person.rufname || s.person.vorname} · ` : ''}{da
          ? standText(u)
          : u.typ.etikett === 'ueblich'
            ? t('mappe.fehltNoch')
            : t('mappe.nichtHinzugefuegt')}</small
      >
      {#if u.typ.etikett === 'meist_unnoetig' && warumInhalt(u.typ)}
        <button type="button" class="textlink warum" onclick={(ereignis) => warum(ereignis, u.typ)}
          >{t('unterlage.warum')}<span class="visually-hidden"> {listenText(u.typ)}</span></button
        >
      {/if}
    </span>
    <Schalter
      {an}
      gesperrt={!da}
      label="{listenText(u.typ)}, {s.person.rufname || s.person.vorname}"
      onclick={() => (e.auswahl = { ...e.auswahl, [k]: !an })}
    />
  </li>
{/snippet}

{#snippet bauKasten()}
  <!-- B21, Stelle 6: Statusmeldung mit Fortschritt, ohne Schleife. Bei „Bewegung reduzieren“ springt die
       Linie, und der Kasten ist sofort da. -->
  <div class="bau" role="status">
    <b>{t('mappe.legtZusammen')}</b>
    <span
      class="bau-linie"
      role="progressbar"
      aria-label={t('mappe.legtZusammen')}
      aria-valuemin={0}
      aria-valuemax={bau?.gesamt ?? 1}
      aria-valuenow={bau?.fertig ?? 0}
      ><i style:transform="scaleX({bau ? bau.fertig / Math.max(1, bau.gesamt) : 0})"></i></span
    >
  </div>
{/snippet}

{#snippet zeileInhalt(titel: string, sub: string)}
  <span class="tx"
    >{#if titel}<b>{titel}</b>{/if}<small>{sub}</small></span
  >
{/snippet}

<main class="seite">
  {#if gross && ansicht}
    <!-- ME11: die echte erste Seite in voller Breite. Nach jeder Änderung steht sie sofort hier. -->
    <div class="kopf"><Zurueck href="#/mappe" text={t('mappe.titel')} /></div>
    <div class="titelblock">
      <h1 class="display frage" use:passend={TITEL}>{t('mappe.deckGross.titel')}</h1>
      <p class="lead">{t('mappe.deckGross.lead')}</p>
    </div>
    <div class="deck-gross">
      {#if deckGross}
        <img src={deckGross} alt={deckAlt} />
      {:else}
        <p class="stand-text" role="status">{t('mappe.wirdErstellt')}</p>
      {/if}
      <div class="deck-links">
        <button type="button" class="textlink" onclick={adresseOeffnen}
          >{t('mappe.wohnungAendern')}</button
        >
        <button type="button" class="textlink" onclick={satzOeffnen}
          >{t('mappe.deckGross.satzAendern')}</button
        >
        <a class="textlink" href="#/mappe/anpassen">{t('mappe.deckGross.aussehen')}</a>
      </div>
      <p class="hinweis">{t('mappe.deckGross.hinweis')}</p>
      {#if ergebnis}
        <p class="deck-seite">{t('mappe.deckGross.seite', { gesamt: ergebnis.seiten })}</p>
      {/if}
    </div>
  {:else}
    <div class="kopf"><Zurueck href="#/" text={t('tabs.mappe')} /></div>
    {#if ansicht}
      <div class="titelblock">
        <h1 class="display frage" use:passend={TITEL}>{t('mappe.titel')}</h1>
        <p class="lead">{t(allein ? 'mappe.leadDu' : 'mappe.leadIhr')}</p>
      </div>

      {#if vorherAnzahl}
        <!-- Alles, was man vor dem Senden wissen sollte, an einer Stelle. Die Größe ist die letzte Zeile. -->
        <section class="karte vorher" aria-label={t('mappe.vorherLabel')}>
          <div class="vorher-kopf">
            <span class="ic" aria-hidden="true">{unlesbar.length ? '!' : '?'}</span>
            <p role="status">
              <b
                >{unlesbar.length
                  ? t('mappe.dateiFehlt', { anzahl: unlesbar.length })
                  : t('mappe.vorher', { anzahl: vorherAnzahl })}</b
              >
              <small
                >{unlesbar.length
                  ? t('mappe.dateiFehltUnter')
                  : ohneLatein.length
                    ? t('mappe.vorherLatein')
                    : t('mappe.vorherGeht')}</small
              >
            </p>
          </div>
          <ul>
            {#each vorherAnsehen as z (z.id)}
              <li>
                {#if z.href}
                  <a class="punkt" href={z.href}>
                    {@render zeileInhalt(z.titel, z.sub)}
                    <Symbol name="weiter" groesse={20} />
                  </a>
                {:else}
                  <button type="button" class="punkt" onclick={z.aktion}>
                    {@render zeileInhalt(z.titel, z.sub)}
                    <Symbol name="weiter" groesse={20} />
                  </button>
                {/if}
              </li>
            {/each}
            {#if zeichenFehlen.length}
              <li class="punkt still-zeile">
                {@render zeileInhalt(
                  '',
                  t('mappe.zeichenFehlen', { texte: zeichenFehlen.join(', ') }),
                )}
              </li>
            {/if}
            {#if zuGross && ergebnis}
              <li class="groesse">
                <b>{t('mappe.zuGross', { groesse: groesse(ergebnis.groesse) })}</b>
                <small
                  >{t('mappe.zuGrossWarum')}
                  {#if kleiner && !e.kleiner}{t('mappe.kleinerMoeglich', {
                      groesse: groesse(kleiner.geschaetzt),
                    })}{:else if kleinerGeprueft}{t('mappe.schonKlein')}{/if}</small
                >
                {#if kleiner && !e.kleiner}
                  <button type="button" class="textlink" onclick={() => (e.kleiner = true)}
                    >{t('mappe.kleinerKnopf')}</button
                  >
                {:else if kleinerGeprueft && !einzeln}
                  <button type="button" class="textlink" onclick={() => (e.ausgabe = 'einzeln')}
                    >{t('mappe.alsEinzeldateien')}</button
                  >
                {/if}
              </li>
            {/if}
          </ul>
        </section>
      {/if}

      <section class="abschnitt-oben">
        <h2>{t('mappe.werDabei')}</h2>
        <WerIstDabeiAuswahl
          {vertrag}
          {buergen}
          kinder={ansicht?.haushalt.kinder ?? 0}
          weitere={ansicht?.haushalt.weitereErwachsene ?? 0}
          ohne={e.ohne}
          umschalten={buergeUmschalten}
          {allein}
        />
      </section>

      <section class="abschnitt-oben">
        <h2>{t('mappe.wasRein')}</h2>
        <div class="wahl">
          {#if einzeln}
            <button
              type="button"
              class="stapel"
              aria-label={t('mappe.alsDateien')}
              onclick={() => (listeOffen = true)}><i></i><i></i><i></i></button
            >
          {:else}
            <!-- Ein Tipp zeigt das Deckblatt groß; dort lassen sich Wohnung, Satz und Aussehen ändern. -->
            <div class="mini-spalte">
              <button
                type="button"
                class="deck-mini"
                aria-label={e.deckblatt
                  ? t('mappe.deckGross.groesser')
                  : t('mappe.mappeAnsehen', { anzahl: ergebnis?.seiten ?? 0 })}
                aria-disabled={!ergebnis}
                onclick={() =>
                  e.deckblatt ? gehe('/mappe/deckblatt') : ansehen(ergebnis?.dateien[0], 0)}
              >
                {#if deckbild}<img src={deckbild} alt="" />{/if}
              </button>
              <!-- E100: leiser Link zur großen Ansicht des Deckblatts. -->
              <a class="deck-link" href="#/mappe/deckblatt">{t('mappe.deckblattAendern')}</a>
            </div>
          {/if}
          <div class="wahl-rechts">
            <div class="reihe" role="radiogroup" aria-label={t('mappe.wasRein')}>
              {#each ['marktueblich', 'alles'] as const as m (m)}
                <button
                  type="button"
                  class="chip"
                  role="radio"
                  aria-checked={e.modus === m}
                  onclick={() => modusSetzen(m)}>{t(`mappe.modus.${m}.titel`)}</button
                >
              {/each}
            </div>
            <p class="hinweis">
              {e.modus === 'alles'
                ? t(allein ? 'mappe.allesDu' : 'mappe.allesIhr')
                : t(`mappe.modus.${e.modus}.text`)}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="linie eigene"
          aria-current={e.modus === 'eigene_auswahl' ? 'true' : undefined}
          onclick={() => modusSetzen('eigene_auswahl')}
        >
          {@render zeileInhalt(
            e.modus === 'eigene_auswahl' ? t('mappe.eigeneGewaehlt') : t('mappe.eigeneZeile'),
            e.modus === 'eigene_auswahl'
              ? t('mappe.eigeneGewaehltUnter')
              : t('mappe.eigeneZeileUnter'),
          )}
          <Symbol name="weiter" groesse={20} />
        </button>
        {#if e.modus !== 'eigene_auswahl' && inhalt.length}
          <ul class="inhalt">
            {#each inhalt as z (z.typ.id)}
              <li>
                <span class="sym" aria-hidden="true"
                  ><Symbol name={z.typ.symbol} groesse={20} /></span
                >
                <span class="tx"><b>{listenText(z.typ)}</b><small>{fuerText(z.fuer)}</small></span>
              </li>
            {/each}
          </ul>
        {/if}
        {#if e.modus === 'eigene_auswahl'}
          <!-- E49 (B17a): gilt für alle Selbstauskünfte der Mappe; die ganze Zeile schaltet. -->
          <div class="miet">
            <SchalterZeile
              an={!!e.mietrueckstaendeNachZusage}
              titel={t('mappe.mietSchalter')}
              text="{t(allein ? 'mappe.mietSatzDu' : 'mappe.mietSatzIhr')} {t(
                allein ? 'mappe.mietSatz2Du' : 'mappe.mietSatz2Ihr',
              )}"
              onclick={() => (e.mietrueckstaendeNachZusage = !e.mietrueckstaendeNachZusage)}
            />
          </div>
          <!-- Je Person aufklappbar, immer nur eine offen; „meist unnötig“ gesammelt am Ende. -->
          {#each dabei as s (s.person.id)}
            {@const zeilen = auswahlListe(s)}
            {@const auf = offenePerson === s.person.id}
            <div class="akk">
              <button
                type="button"
                class="akk-kopf"
                aria-expanded={auf}
                onclick={() => (offenGewaehlt = auf ? null : s.person.id)}
              >
                <span class="fleck farbe-{s.farbe}" aria-hidden="true"></span>
                {@render zeileInhalt(
                  s.person.rufname || s.person.vorname,
                  t('mappe.auswahlStand', {
                    rolle: rollenText(s.rolle, s.bezeichnung),
                    dabei: zeilen.filter((u) => istAn(s, u)).length,
                    von: zeilen.length,
                  }),
                )}
                <span class="pfeil" class:auf aria-hidden="true"
                  ><Symbol name="weiter" groesse={16} /></span
                >
              </button>
              {#if auf}
                <ul class="auswahl">
                  {#each zeilen as u (u.typ.id)}
                    {@render auswahlZeile(s, u, false)}
                  {/each}
                </ul>
              {/if}
            </div>
          {/each}
          {#if unnoetige.length}
            <div class="weitere">
              <Eingeklappt
                titel={t('mappe.weitereTitel')}
                unter={t('mappe.weitereUnter', {
                  beispiel: ohneTrennstellen(listenText(unnoetige[0]![1].typ)),
                })}
              >
                <ul class="auswahl kasten">
                  {#each unnoetige as [s, u] (`${s.person.id}.${u.typ.id}`)}
                    {@render auswahlZeile(s, u, true)}
                  {/each}
                </ul>
              </Eingeklappt>
            </div>
          {/if}
        {/if}
        {#each liste as h, i (i)}
          {#if h.art === 'ohneBonitaet'}
            <div class="notiz">
              <span class="ic" aria-hidden="true">!</span>
              <div>
                <p>{t('mappe.ohneBonitaet')}</p>
                <button type="button" class="textlink" onclick={bonitaetDazu}
                  >{t('mappe.hinzufuegen')}</button
                >
                <button
                  type="button"
                  class="textlink"
                  onclick={(ereignis) => warum(ereignis, dokumenttyp('bonitaet'))}
                  >{t('unterlage.warum')}</button
                >
              </div>
            </div>
          {:else if h.art === 'zusageOffen'}
            <div class="notiz">
              <span class="ic" aria-hidden="true">!</span>
              <div>
                <p>{t('mappe.zusageOffen', { namen: h.namen.join(', ') })}</p>
              </div>
            </div>
          {/if}
        {/each}
      </section>

      <!-- Seiten, Größe und Zustand der Mappe, am Ende der Liste (B23: „11 Seiten“). -->
      <section class="stand-unten" aria-live="polite">
        {#if fehler}
          <p class="stand-text" role="alert">{t('mappe.fehler')}</p>
        {:else if !ergebnis}
          <p class="stand-text" role="status">{t('mappe.wirdErstellt')}</p>
        {:else}
          <p class="stand">
            <span class="zahlen">
              {#key ergebnis.seiten}
                <span class:zahl-neu={seitenNeu}
                  >{einzeln
                    ? t('mappe.dateien', { anzahl: ergebnis.dateien.length })
                    : t('mappe.seiten', { anzahl: ergebnis.seiten })}</span
                >
              {/key}
              <span aria-hidden="true">·</span>
              <span>{baut ? t('mappe.groesseWird') : groesse(ergebnis.groesse)}</span>
            </span>
            {#if e.kleiner && !baut}<span class="still">{t('mappe.verkleinert')}</span>{/if}
            {#if allesDa}<span class="da"
                ><Symbol name="haken" groesse={20} />{t('allgemein.allesDa')}</span
              >{/if}
          </p>
          {#if leer}<p class="stand-text">{t('mappe.nichtsDrin')}</p>{/if}
        {/if}
        {#if e.kleiner}
          <!-- Verkleinert wird nur beim Bauen; die gespeicherten Originale bleiben unberührt. -->
          {#if baut}<p class="stand-text" role="status">{t('mappe.kleinerLaeuft')}</p>{/if}
          <button type="button" class="textlink" onclick={() => (e.kleiner = false)}
            >{t('mappe.kleinerZurueck')}</button
          >
        {/if}
        {#if einzeln}
          <button type="button" class="linie" onclick={() => (listeOffen = true)}>
            {@render zeileInhalt(t('mappe.alsDateien'), t('mappe.dateienZeile'))}
            <Symbol name="weiter" groesse={20} />
          </button>
        {/if}
      </section>
    {/if}
  {/if}
</main>
{#if gross}
  <Aktionsleiste
    text={t('mappe.deckGross.ganze')}
    grund={!ergebnis || baut ? t('mappe.wirdErstellt') : undefined}
    onclick={() => ansehen(ergebnis?.dateien[0], 0)}
  />
{:else}
  <Aktionsleiste
    text={einzeln ? t('mappe.alleTeilen') : t('mappe.alsPdfTeilen')}
    grund={ohneLatein.length
      ? t('personSeite.grundLatein')
      : !ergebnis || baut
        ? t('mappe.wirdErstellt')
        : undefined}
    onclick={teilenKlick}
    statt={bauSichtbar && !ohneLatein.length ? bauKasten : undefined}
    neben={ergebnis && !baut && !ohneLatein.length
      ? einzeln
        ? { text: t('mappe.alsDateien'), onclick: () => (listeOffen = true) }
        : { text: t('mappe.alsDatei'), onclick: sichernKlick }
      : undefined}
  />
{/if}

{#if warumTyp}
  <WarumBlatt bind:offen={warumOffen} typ={warumTyp} zurueck={warumKnopf} />
{/if}

{#if Ansicht}
  <Ansicht bind:offen={ansichtOffen} bind:index={ansichtIndex} seiten={ansichtSeiten} />
{/if}

<Sheet bind:offen={adresseOffen} titel={t('mappe.adresseTitel')}>
  <label class="eingabe">
    {t('mappe.adresseLabel')}
    <textarea
      bind:value={adresse}
      rows="2"
      autocomplete="street-address"
      placeholder={t('mappe.adresseBeispiel')}></textarea>
  </label>
  <p class="hinweis">{t('mappe.adresseHinweis')}</p>
  <button type="button" class="knopf" onclick={adresseUebernehmen}>{t('mappe.uebernehmen')}</button>
</Sheet>

<Sheet bind:offen={satzOffen} titel={allein ? t('mappe.satzTitelDu') : t('mappe.satzTitel')}>
  <label class="eingabe">
    {allein ? t('mappe.satzLabelDu') : t('mappe.satzLabel')}
    <textarea bind:value={satz} rows="3"></textarea>
  </label>
  <p class="hinweis">{allein ? t('mappe.satzHinweisDu') : t('mappe.satzHinweis')}</p>
  <button type="button" class="knopf" onclick={satzUebernehmen}>{t('mappe.uebernehmen')}</button>
</Sheet>

<Sheet bind:offen={listeOffen} titel={t('mappe.alsDateien')}>
  <ul class="dateien">
    {#each ergebnis?.dateien ?? [] as d (d.name)}
      <li>
        <button
          type="button"
          class="datei"
          aria-label={t('mappe.dateiAnsehen', { name: d.name })}
          onclick={() => {
            listeOffen = false;
            void ansehen(d);
          }}
        >
          <span>{d.name.replaceAll('_', '_​')}</span>
          <Symbol name="weiter" groesse={16} />
        </button>
      </li>
    {/each}
  </ul>
</Sheet>

<style>
  .lead {
    margin: 6px 0 0;
    color: var(--ink-muted);
  }

  /* B23: kleines Bild der Mappe links, die Stufen rechts. */
  .wahl {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: flex-start;
  }

  /* Ist rechts zu wenig Platz (320 px mit großer Schrift), rutschen die Stufen unter das Bild (C18). */
  .wahl-rechts {
    flex: 1 1 11em;
    min-width: 0;
  }

  .deck-mini {
    display: block;
    width: 76px;
    aspect-ratio: 210 / 297;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    cursor: pointer;
  }

  .mini-spalte {
    display: grid;
    justify-items: center;
    gap: 2px;
  }

  .deck-link {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    color: var(--accent-text);
    font-size: calc(13 * var(--px));
    font-weight: 600;
    text-align: center;
  }

  .deck-mini img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .wahl-rechts .hinweis {
    margin-top: 8px;
  }

  .inhalt {
    margin: 12px 0 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    list-style: none;
  }

  .inhalt li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 14px;
  }

  .inhalt li + li {
    border-top: 1px solid var(--line);
  }

  .inhalt .sym {
    display: grid;
    flex: none;
    place-items: center;
    color: var(--ink-muted);
  }

  .inhalt .tx {
    display: grid;
    min-width: 0;
  }

  .inhalt b {
    overflow-wrap: break-word;
    font-size: calc(15 * var(--px));
  }

  .inhalt small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .stand-unten {
    margin-top: 16px;
    padding: 0 2px;
  }

  /* B21, Mappe entsteht: ruhiger Kasten an der Stelle des Knopfs, die Linie füllt sich mit dem Bau. */
  .bau {
    display: flex;
    flex-direction: column;
    gap: 9px;
    min-height: 54px;
    padding: 11px 16px 12px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
    animation: bw-blende var(--bw-kurz) var(--bw-weich) backwards;
  }

  .bau b {
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .bau-linie {
    display: block;
    height: 3px;
    border-radius: 2px;
    background: var(--line);
    overflow: hidden;
  }

  .bau-linie i {
    display: block;
    height: 100%;
    background: var(--ink);
    transform-origin: left center;
    transition: transform var(--bw-kurz) var(--bw-weich);
  }

  /* B21, Seitenzahl ändert sich: Die neue Zahl steigt 5 px ein. */
  .zahl-neu {
    display: inline-block;
    animation: bw-zahl var(--bw-kurz) var(--bw-weich) backwards;
  }

  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(160px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .frage {
    margin-top: 10px;
  }

  section {
    margin: 14px var(--space-4) 0;
  }

  .abschnitt-oben {
    margin-top: 24px;
  }

  /* B23: Abschnitte klein in Großbuchstaben, wie im Heft. */
  h2 {
    margin: 0 var(--space-1) 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: 1.2;
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .hinweis {
    margin: 8px var(--space-1) 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
  }

  .unter {
    margin: 14px var(--space-1) 6px;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 700;
  }

  .karte {
    padding: 14px;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: 0 8px 18px rgb(25 26 44 / 0.1);
  }

  /* Bild und Adresse nebeneinander; wird die Spalte zu schmal, rutscht die Adresse unter das Bild. */
  .held {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    gap: 12px 14px;
  }

  .lead {
    margin: 6px 0 0;
    color: var(--ink-muted);
  }
  .deck-gross {
    margin: 12px var(--space-4) 0;
  }
  .deck-gross img {
    display: block;
    width: 100%;
    height: auto;
    border-radius: 4px;
    background: #fff;
    box-shadow: var(--shadow-chip);
  }
  .deck-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0 18px;
    margin-top: 10px;
  }
  .deck-seite {
    margin: 10px 0 0;
    text-align: center;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }
  /* B23: „Eigene Auswahl“ als umrandete Zeile; gewählt mit kräftigerem Rand. */
  .eigene {
    padding: 8px 14px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
  }

  .eigene[aria-current='true'] {
    border-color: var(--ink);
  }
  .deck {
    display: block;
    flex-shrink: 0;
    width: 92px;
    aspect-ratio: 210 / 297;
    padding: 0;
    border: 0;
    border-radius: 3px;
    background: #fff;
    box-shadow:
      0 1px 3px rgb(25 26 44 / 0.22),
      0 6px 14px rgb(25 26 44 / 0.12);
    overflow: hidden;
    cursor: pointer;
  }

  .stapel {
    position: relative;
    flex-shrink: 0;
    width: 92px;
    height: 122px;
    padding: 0;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .stapel i {
    position: absolute;
    width: 76px;
    height: 104px;
    border-radius: 3px;
    background: #fff;
    box-shadow: 0 1px 3px rgb(25 26 44 / 0.22);
  }

  .stapel i:nth-child(1) {
    left: 4px;
    top: 12px;
  }

  .stapel i:nth-child(2) {
    left: 10px;
    top: 6px;
  }

  .stapel i:nth-child(3) {
    left: 16px;
    top: 0;
  }

  @media (max-width: 359px) {
    .deck {
      width: 76px;
    }
  }

  .wohnung {
    flex: 1 1 calc(170 * var(--px));
    min-width: 0;
  }

  .klein {
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 700;
    color: var(--ink-muted);
  }

  .neu {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    margin-top: 6px;
    padding: 10px 12px;
    border: 2px dashed var(--ink);
    border-radius: 14px;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .plus {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--action);
    color: var(--on-action);
  }

  .miet {
    margin-top: 12px;
    border-top: 1px solid var(--line);
  }

  .linie {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 52px;
    margin-top: 12px;
    padding: 8px 0 0;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: calc(15 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 800;
  }

  .tx small {
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .stand {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 14px;
    margin: 10px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
  }

  .zahlen {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0 5px;
  }

  .still {
    font-weight: 500;
    color: var(--ink-muted);
  }

  .da {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  .stand-text {
    margin: 10px 0 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
  }

  .vorher {
    border: 2px solid var(--ink);
    box-shadow: none;
  }

  .vorher-kopf {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .vorher-kopf p {
    flex: 1 1 0;
    min-width: 0;
    margin: 0;
  }

  .vorher-kopf b {
    display: block;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 800;
  }

  .vorher-kopf small {
    display: block;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
  }

  .ic {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    font-size: calc(13 * var(--px));
    font-weight: 800;
  }

  .vorher ul {
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }

  .vorher li {
    border-top: 1px solid var(--line);
  }

  .punkt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    text-decoration: none;
    cursor: pointer;
  }

  .still-zeile {
    cursor: default;
  }

  .groesse {
    padding-top: 8px;
  }

  .groesse b {
    display: block;
    font-size: calc(15 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 800;
  }

  .groesse small {
    display: block;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    color: var(--ink-muted);
  }

  .farbe-1 {
    --farbe: var(--person-1);
  }
  .farbe-2 {
    --farbe: var(--person-2);
  }
  .farbe-3 {
    --farbe: var(--person-3);
  }
  .farbe-4 {
    --farbe: var(--person-4);
  }

  .farbe-5 {
    --farbe: var(--person-5);
  }

  .farbe-6 {
    --farbe: var(--person-6);
  }

  .reihe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .reihe .chip {
    white-space: nowrap;
    padding: 0 14px;
    font-size: calc(15 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .akk {
    margin-top: 8px;
    padding: 0 14px;
    border-radius: 18px;
    background: var(--surface);
  }

  .akk-kopf {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    min-height: 56px;
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .fleck {
    flex-shrink: 0;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--farbe);
  }

  .pfeil {
    display: inline-flex;
    flex-shrink: 0;
    transform: rotate(90deg);
    transition: transform var(--bw-kurz) var(--bw-weich);
  }

  .pfeil.auf {
    transform: rotate(-90deg);
  }

  .weitere {
    margin-top: 10px;
  }

  .auswahl {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .auswahl.kasten {
    margin-top: 8px;
    padding: 0 14px;
    border-radius: 18px;
    background: var(--surface);
  }

  .auswahl li {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 0;
    border-top: 1px solid var(--line);
  }

  .auswahl.kasten li:first-child {
    border-top: 0;
  }

  .notiz {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-top: 12px;
    padding: 12px 14px 4px;
    border-radius: 16px;
    background: var(--surface);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .notiz p {
    margin: 0;
  }

  .notiz :global(.textlink + .textlink) {
    margin-left: 16px;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    color: var(--ink);
    text-decoration: none;
  }

  .dateien {
    margin: 0 0 8px;
    padding: 0;
    list-style: none;
  }

  .dateien li + li {
    border-top: 1px solid var(--line);
  }

  .datei {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 12px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  textarea {
    padding: 10px 14px;
    border: 1.5px solid var(--control-border);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: calc(16 * var(--px));
  }

  .knopf {
    min-height: 54px;
    border: 0;
    border-radius: 27px;
    background: var(--action);
    color: var(--on-action);
    font-size: calc(17 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }
</style>
