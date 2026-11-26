<script lang="ts">
  import type { Snippet } from 'svelte';
  import TelefonFeld from './TelefonFeld.svelte';
  import { daten } from '../app/daten.svelte';
  import { telefonPruefen, type Land } from '../domain/telefon';
  // Selbstauskunft als Akkordeon aus vier Teilen (Entwürfe A1 bis A4): Kontakt, Einkommen, Fragen,
  // Für euren ganzen Haushalt. Fertige Teile zeigen eine Zusammenfassung mit „Ändern“, offene ihren
  // Stand. Bürgen haben keinen Haushaltsteil. Ja/Nein ohne Vorauswahl.
  import { tick } from 'svelte';
  import type { Person, Rolle } from '../domain/modell';
  import {
    ERKLAERUNG,
    ERLAEUTERUNG_MAX,
    ERLAEUTERUNG_ZAEHLER_AB,
    berufBezeichnungen,
    betragText,
    emailSiehtGutAus,
    felderFuer,
    teile,
    ZUSAGE_FRAGEN,
    zusageNeuFragen,
    type JaNein,
    type TeilId,
    type ZusageFrage,
  } from '../domain/selbstauskunft';
  import { personenZiehenEin } from '../domain/mappeWoerter';
  import { t } from '../i18n';
  import {
    angabenAus,
    type SelbstauskunftEingabe,
    telefonEingabeFehler,
  } from './selbstauskunftEingabe';
  import Nachfrage from './Nachfrage.svelte';
  import NachfrageZeichen from './NachfrageZeichen.svelte';
  import EinkommenQuellen from './EinkommenQuellen.svelte';
  import AnschriftFelder from '../formblatt/AnschriftFelder.svelte';
  import FormTeil from '../formblatt/FormTeil.svelte';
  import { lagenVon, wirksameLagen } from '../domain/lagen';
  import { situationText } from '../domain/regelkatalog';

  let {
    eingabe = $bindable(),
    person,
    rolle,
    du = false,
    allein = false,
    einziehendText,
    gruppen,
    vonName = '',
    start = 'erster-offener',
    feld,
    offen = $bindable(null),
    teilKnopf = true,
    einziehen,
  }: {
    eingabe: SelbstauskunftEingabe;
    person: Person;
    rolle: Rolle;
    du?: boolean;
    /** Nur eine Person im Haushalt: „Hast du Haustiere?“ statt „Habt ihr …“. */
    allein?: boolean;
    /** z. B. „3 Personen (2 Erwachsene, 1 Kind)“. */
    einziehendText: string;
    /** Wer einzieht, nach Gruppen (E26); Bürgen zählen nicht mit. */
    gruppen: { vertrag: number; kinder: number; weitere: number };
    /** Wer die Haushaltsangaben eingetragen hat, wenn es jemand anderes war („Von Max: …“). */
    vonName?: string;
    /** Kommt man über ein bestimmtes Feld, öffnet sich sein Teil und der Fokus steht darin. */
    feld?: string;
    /** Beim Öffnen: erster offener Teil (Rutsch) oder alle zu (eigene Seite). */

    start?: 'erster-offener' | 'zu';
    /** Der geöffnete Teil; die Seite der Selbstauskunft liest ihn für ihren Hauptknopf (K9). */
    offen?: TeilId | null;
    /** Knopf „Weiter: …“ im Teil. Auf der eigenen Seite entfällt er, dort führt der Hauptknopf (K9, DP96). */
    teilKnopf?: boolean;
    /** PC213 (E-B1): ohne Haushalt die Zähler statt des Satzes, wer aus dem Haushalt einzieht. */
    einziehen?: Snippet;
  } = $props();

  const id = $props.id();
  const felder = $derived(new Set(felderFuer(rolle, person.lebenssituation).map((f) => f.id)));
  // PC126 K1: Solange im Telefon ein Fehler steht, ist „Kontakt“ nicht fertig (kein Haken, kein „Weiter“).
  const telefonFehler = $derived(telefonEingabeFehler(eingabe));
  const standRoh = $derived(teile({ ...person, ...angabenAus(eingabe) }, rolle, eingabe.hh));
  const stand = $derived(
    standRoh.map((s) => (s.id === 'kontakt' && telefonFehler ? { ...s, fertig: false } : s)),
  );
  // Der Knopf „Fertig“ bzw. „Weiter: …“ bleibt da, wenn nur der Fehler im Telefon fehlt; er schließt dann nicht,
  // sondern führt ins Feld (DP77, DP82 T1).
  const knopfDa = (id: TeilId) => standRoh.find((s) => s.id === id)?.fertig ?? false;
  const name = $derived(person.rufname || person.vorname);

  const FELD_IN_TEIL: Record<string, TeilId> = {
    telefon: 'kontakt',
    email: 'kontakt',
    anschrift: 'kontakt',
    beruf: 'einkommen',
    arbeitgeber: 'einkommen',
    erklaerung: 'fragen',
    haustiere: 'haushalt',
    ort: 'haushalt',
  };

  // DP77, Abschnitt 2: Unter „Oft gewählt“ stehen auch die Länder, die im Haushalt schon gewählt sind.
  const haushaltLaender = $derived(
    (daten.ansicht?.mitglieder ?? [])
      .map((m) => m.person.kontakt.telefonLand)
      .filter((l): l is string => !!l),
  );
  // E222 (DP77, TL26): Nachfrage nach W33 nur noch für gültige Sonderrufnummern; alles andere ist ein Fehler im Feld.
  const sonderNummer = $derived.by(() => {
    const r = telefonPruefen(eingabe.telefon, eingabe.telefonLand as Land);
    return r.art === 'gut' && r.ungewoehnlich;
  });

  let gesetzt = false;
  $effect(() => {
    if (gesetzt) return;
    gesetzt = true;
    offen = start === 'zu' ? null : (stand.find((s) => !s.fertig)?.id ?? null);
    const teil = feld ? FELD_IN_TEIL[feld] : undefined;
    if (teil && stand.some((s) => s.id === teil)) {
      offen = teil;
      void tick().then(() => {
        const eingabeFeld = wurzel?.querySelector<HTMLElement>(`[data-feld="${feld}"]`);
        eingabeFeld?.scrollIntoView({ block: 'center' });
        eingabeFeld?.focus();
      });
    }
  });
  const berufNamen = $derived(berufBezeichnungen(person));
  // DP47 G5: mehr als eine Lebenslage. Die erste Quelle steht in den Feldern wie bisher, solange sie wirkt
  // und nicht „Leistungen vom Amt“ ist; den Rest zeigt EinkommenQuellen.
  const quellenPerson = $derived({ ...person, ...angabenAus(eingabe) } as Person);
  const mehrere = $derived(lagenVon(quellenPerson).length > 1);
  const amtDa = $derived(lagenVon(quellenPerson).some((l) => l.situation === 'leistungsbezug'));
  const zeigeErste = $derived(
    !mehrere ||
      (person.lebenssituation !== 'leistungsbezug' &&
        wirksameLagen(quellenPerson).some((l) => l.lageId === null)),
  );
  let wurzel = $state<HTMLDivElement>();

  async function oeffnen(teil: TeilId | null) {
    offen = teil;
    await tick();
    const neu = wurzel?.querySelector<HTMLElement>('section.offen');
    neu?.scrollIntoView({ block: 'nearest' });
    return neu;
  }

  /** Der nächste Teil, der noch nicht fertig ist; null, wenn alles fertig ist. */
  function naechsterOffen(teil: TeilId): TeilId | null {
    const i = stand.findIndex((s) => s.id === teil);
    // Ohne den Teil selbst: Er ist fertig, wenn es weitergeht, und mit Fehler im Telefon hieße der Knopf sonst
    // „Weiter: Kontakt“ (PC126 K1).
    return [...stand.slice(i + 1), ...stand.slice(0, i)].find((s) => !s.fertig)?.id ?? null;
  }

  // Zweifel am Format im Kontakt (Rückmeldung 12.11.: „E-Mail warnt nicht“): Der Knopf „Weiter“ und die
  // Taste im letzten Feld schlossen den Teil, bevor der Hinweis erscheinen konnte. Jetzt zeigt der erste
  // Schritt weiter den Hinweis, der zweite geht weiter („Du kannst es trotzdem so lassen“).
  const zweifelTelefon = $derived(sonderNummer);
  const zweifelEmail = $derived(!!eingabe.email.trim() && !emailSiehtGutAus(eingabe.email));
  const zweifelKontakt = $derived(zweifelTelefon || zweifelEmail);
  let gewarntBei = $state<string | null>(null);
  // DP49 Punkt 4, DP50 (gebaute Selbstauskunft): Die Nachfrage erscheint erst nach „Weiter“ und bleibt, bis
  // man bestätigt („Stimmt“) oder das Feld ändert. Ihre Zeile ist immer frei gehalten (W8).
  const kontaktWerte = $derived(`${eingabe.telefon}|${eingabe.email}`);
  // DP49b: Nach „Stimmt“ blendet der Prüfzustand in 300 ms zurück, dann geht es weiter.
  let bestaetigtBei = $state<string | null>(null);
  const nachgefragt = $derived(
    zweifelKontakt && gewarntBei === kontaktWerte && bestaetigtBei !== kontaktWerte,
  );
  /** Tippt man ins Feld, blendet der Prüfzustand zurück, und der Knopf heißt wieder „Weiter“ (DP49b, NF3).
   *  Auch wenn der Cursor schon darin steht: Dann kommt kein neuer Fokus, nur der Tipp. */
  function insFeld() {
    if (nachgefragt) gewarntBei = null;
  }
  const telefonHinweis = $derived(nachgefragt && zweifelTelefon);
  const emailHinweis = $derived(nachgefragt && zweifelEmail);

  function weiterNach(
    teil: TeilId,
    ziel: TeilId | null = naechsterOffen(teil),
  ): Promise<HTMLElement | null | undefined> {
    // PC126 K1: Mit Fehler im Telefon schließt nichts den Teil; der Fokus geht ins Feld.
    if (teil === 'kontakt' && telefonFehler) {
      const f = document.querySelector<HTMLInputElement>('[data-feld="telefon"]');
      // Stand der Fokus noch im Feld (der Knopf nimmt ihn nicht), zeigt erst das Verlassen den Fehler.
      f?.blur();
      f?.focus();
      return Promise.resolve(f);
    }
    if (teil === 'kontakt' && zweifelKontakt && gewarntBei !== kontaktWerte) {
      gewarntBei = kontaktWerte;
      bestaetigtBei = null;
      return Promise.resolve(null);
    }
    if (teil === 'kontakt' && nachgefragt) {
      bestaetigtBei = kontaktWerte;
      return new Promise((fertig) => setTimeout(fertig, 300)).then(() => oeffnen(ziel));
    }
    return oeffnen(ziel);
  }

  /** Kontakt fragt nach (DP49b): Der Hauptknopf heißt dann „Stimmt“, wie bisher der Knopf im Teil (K9). */
  export function kontaktFragt(): boolean {
    return nachgefragt && offen === 'kontakt';
  }

  /** Fokus ins erste leere Feld des Teils, sonst ins erste Feld oder den ersten Knopf (K9, DP96). */
  function erstesLeeres(teil: HTMLElement | null | undefined) {
    if (!teil?.matches('section.offen')) return;
    const felder = [
      ...teil.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type=radio]):not([type=checkbox]):not(dialog input), textarea',
      ),
    ];
    (
      felder.find((f) => !f.value.trim()) ??
      felder[0] ??
      teil.querySelector<HTMLElement>('button')
    )?.focus();
  }

  /**
   * K9 (DP96, Weg B): Hauptknopf „Weiter“. Schließt den geöffneten Teil (mit der Nachfrage im Kontakt wie bisher),
   * öffnet `ziel` und setzt den Fokus ins erste leere Feld.
   */
  export function weiterZu(ziel: TeilId) {
    void (offen ? weiterNach(offen, ziel) : oeffnen(ziel)).then(erstesLeeres);
  }

  /** Tipp auf den gedämpften Hauptknopf: Der erste fehlende Teil geht auf. */
  export function fehlendenOeffnen() {
    const ziel = stand.find((s) => !s.fertig)?.id ?? null;
    // PC126 K1: Fehlt nur, weil im Telefon ein Fehler steht, geht der Fokus ins Telefon, nicht ins erste leere Feld.
    if (ziel === 'kontakt' && telefonFehler) {
      void oeffnen('kontakt').then(() => weiterNach('kontakt'));
      return;
    }
    void oeffnen(ziel).then(erstesLeeres);
  }

  // Taste „Weiter“ der Tastatur: nächstes Feld, im letzten Feld der nächste offene Teil.
  const weiterTaste = (teil: TeilId) => ({
    enterkeyhint: 'next' as const,
    onkeydown: (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const feld = e.currentTarget as HTMLInputElement;
      // Die Suche im Blatt „Land der Nummer“ liegt im Teil, gehört aber nicht zur Reihe der Felder.
      const felder = [
        ...(feld
          .closest('section')
          ?.querySelectorAll<HTMLInputElement>('input:not(dialog input)') ?? []),
      ];
      const danach = felder[felder.indexOf(feld) + 1];
      if (danach) danach.focus();
      else
        void weiterNach(teil).then((neu) =>
          neu?.querySelector<HTMLElement>('input, button')?.focus(),
        );
    },
  });

  // Die letzte Ja/Nein-Antwort schließt den Teil. Wer eine Antwort nur ändert, bleibt im Teil, und nach
  // einem Ja wartet die Erklärung darunter auf ihre Eingabe.
  // Bei den Fragen erst, wenn alle drei beantwortet sind: Die dritte (nach der Zusage) ist nicht Pflicht,
  // aber wer nach zwei Antworten weiterspringt, sieht sie nicht mehr. Ohne sie geht es über „Weiter“.
  function antworten(teil: TeilId, setzen: () => void, erklaeren: () => boolean) {
    const fertig = () =>
      teil === 'fragen'
        ? FRAGEN.every((f) => eingabe.sa[f] !== null)
        : stand.find((s) => s.id === teil)?.fertig;
    const vorher = fertig();
    setzen();
    if (!vorher && fertig() && !erklaeren()) void weiterNach(teil);
  }

  // Teil B des Musterbogens (B.7, B.8). Teil C (C.4 bis C.6) gehört zum Schritt nach der Zusage: sichtbar, aber nicht
  // Pflicht (mappe-feinschliff.md, § 1; PC207, 2).
  const FRAGEN_JETZT = ['insolvenz', 'raeumungstitel'] as const;
  const FRAGEN = [...FRAGEN_JETZT, ...ZUSAGE_FRAGEN] as const;
  const zusageJa = $derived(ZUSAGE_FRAGEN.some((f) => eingabe.sa[f] === 'ja'));
  const zusageBeantwortet = $derived(ZUSAGE_FRAGEN.some((f) => eingabe.sa[f] !== null));
  // Daten bis 2.2 mit einem Ja in der früheren einen Frage: einmal sagen, dass es jetzt drei sind.
  const neuFragen = $derived(
    !zusageBeantwortet &&
      zusageNeuFragen({ selbstauskunft: { ...eingabe.sa, rueckstandMonate: undefined } }),
  );

  function zusageAntwortEntfernen() {
    for (const f of ZUSAGE_FRAGEN) eingabe.sa[f] = null;
    eingabe.sa.mietrueckstaende = null;
    eingabe.sa.mietrueckstaendeSpaeter = false;
    eingabe.sa.kuendigungWelche = '';
    eingabe.sa.stellungnahme = '';
  }

  // „Angaben löschen“: statt dass etwas Falsches stehen bleibt. Ja und Nein lassen sich sonst nicht
  // mehr abwählen. Eine Rückfrage, weil die Änderung auf der eigenen Seite sofort gespeichert wird.
  let loeschenFrage = $state<TeilId | null>(null);

  function hatAngaben(teil: TeilId): boolean {
    if (teil === 'kontakt') return !!(eingabe.telefon.trim() || eingabe.email.trim());
    if (teil === 'einkommen')
      return !!(eingabe.netto.trim() || eingabe.beruf.trim() || eingabe.arbeitgeber.trim());
    if (teil === 'fragen') return FRAGEN.some((f) => eingabe.sa[f] !== null);
    return eingabe.hh.haustiere !== null || !!eingabe.hh.ort.trim() || !!eingabe.hh.wbs;
  }

  function leeren(teil: TeilId) {
    if (teil === 'kontakt') {
      eingabe.telefon = '';
      eingabe.email = '';
    } else if (teil === 'einkommen') {
      eingabe.netto = '';
      eingabe.sa.einkommenArt = 'betrag';
      eingabe.beruf = '';
      eingabe.arbeitgeber = '';
    } else if (teil === 'fragen') {
      for (const f of FRAGEN_JETZT) {
        eingabe.sa[f] = null;
        eingabe.sa[ERKLAERUNG[f]] = '';
      }
      zusageAntwortEntfernen();
    } else {
      eingabe.hh.haustiere = null;
      eingabe.hh.haustiereText = '';
      eingabe.hh.wbs = null;
      eingabe.hh.ort = '';
    }
    loeschenFrage = null;
  }

  const frage = (f: (typeof FRAGEN)[number]) =>
    du ? t(`selbstauskunft.${f}Du`) : t(`selbstauskunft.${f}`, { name });

  function zusammenfassung(teil: TeilId): string {
    if (teil === 'kontakt')
      return [eingabe.telefon.trim(), eingabe.email.trim()].filter(Boolean).join(', ');
    if (teil === 'einkommen') {
      if (!felder.has('nettoeinkommen')) return t('selbstauskunft.amt');
      const p = { ...person, ...angabenAus(eingabe) };
      const summe =
        person.lebenssituation === 'rente'
          ? 'selbstauskunft.einkommenSummeRente'
          : 'selbstauskunft.einkommenSumme';
      const teile = [t(summe, { betrag: betragText(p) })];
      if (eingabe.beruf.trim() && eingabe.arbeitgeber.trim())
        teile.push(
          t('selbstauskunft.einkommenBei', {
            beruf: eingabe.beruf.trim(),
            arbeitgeber: eingabe.arbeitgeber.trim(),
          }),
        );
      else if (eingabe.beruf.trim()) teile.push(eingabe.beruf.trim());
      return teile.join(', ');
    }
    if (teil === 'fragen') {
      const werte = FRAGEN.map((f) => eingabe.sa[f]).filter((w) => w !== null);
      const ja = werte.filter((w) => w === 'ja').length;
      const satz = ja
        ? t('selbstauskunft.fragenMal', { ja, nein: werte.length - ja })
        : werte.length === FRAGEN.length
          ? t('selbstauskunft.fragenNein')
          : werte.length === 2
            ? t('selbstauskunft.fragenNeinZwei')
            : t('selbstauskunft.fragenNeinZahl', { anzahl: werte.length });
      const offen = ZUSAGE_FRAGEN.filter((f) => eingabe.sa[f] === null).length;
      // DP142: in Worten, wie „Dreimal Nein“.
      const wort = (['eins', 'zwei', 'drei'] as const)[offen - 1] ?? 'drei';
      return offen ? `${satz} · ${t(`selbstauskunft.zusageOffen.${wort}`)}` : satz;
    }
    const tiere =
      eingabe.hh.haustiere === 'ja'
        ? eingabe.hh.haustiereText.trim() || t('selbstauskunft.mitTieren')
        : t('selbstauskunft.keineTiere');
    const text = [personenZiehenEin(gruppen), tiere, eingabe.hh.ort.trim()]
      .filter(Boolean)
      .join(', ');
    return vonName ? t('selbstauskunft.von', { name: vonName, text }) : text;
  }

  // DP150: Ohne Haushalt „Ziehen Haustiere mit ein?“, bei jeder Zahl von Personen; so steht kein „ihr“ neben „du“.
  const haustiereFrage = $derived(
    einziehen
      ? t('ohneHaushalt.haustiereFrage')
      : allein
        ? t('selbstauskunft.haustiereDu')
        : t('selbstauskunft.haustiereIhr'),
  );

  /** PC213: Ohne Haushalt heißt der vierte Teil „Für alle hier“, wie in der Liste; es gibt keinen Haushalt. */
  function teilTitel(id: TeilId): string {
    return einziehen && id === 'haushalt'
      ? t('ohneHaushalt.fuerAlle')
      : t(`selbstauskunft.teil.${id}`);
  }

  function offenText(teil: { id: TeilId; offen: number }): string {
    if (teil.id === 'fragen' && teil.offen < FRAGEN_JETZT.length)
      return t('selbstauskunft.offen', { anzahl: teil.offen });
    // PC126 K1: Offen ist „Kontakt“ dann wegen des Fehlers, nicht weil eine Angabe fehlt.
    if (teil.id === 'kontakt' && telefonFehler) return t('selbstauskunft.pruefenTelefon');
    return t(`selbstauskunft.teil.${teil.id}Offen`);
  }

  // Netto im Jahr (B28b, DP21): Hefta rechnet durch zwölf; gespeichert und in der Mappe steht der Monat.
  let imJahr = $state(false);
  let jahrEingabe = $state('');
  const zahlAus = (s: string) => {
    const n = Number(s.replace(/[\s.€]/g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  function jahrUmschalten(jahr: boolean) {
    if (jahr && !imJahr) {
      const monat = zahlAus(String(eingabe.netto ?? ''));
      jahrEingabe = monat ? new Intl.NumberFormat('de-DE').format(Math.round(monat * 12)) : '';
    }
    imJahr = jahr;
  }
  function jahrGesetzt(v: string) {
    jahrEingabe = v;
    const n = zahlAus(v);
    eingabe.netto = n ? String(Math.round(n / 12)) : '';
  }
</script>

{#snippet jaNein(
  wert: JaNein,
  setzen: (w: JaNein) => void,
  beschriftung: string,
  spaeterFuer?: ZusageFrage,
)}
  <div class="jn" role="radiogroup" aria-label={beschriftung}>
    {#each ['ja', 'nein'] as const as w (w)}
      <button
        type="button"
        class="chip"
        role="radio"
        aria-checked={wert === w}
        onclick={() => setzen(w)}>{t(`selbstauskunft.${w}`)}</button
      >
    {/each}
    {#if spaeterFuer}
      <!-- PC65: gleichrangig mit Ja und Nein, nichts vorgewählt. PC207, 2: je Frage aus Teil C; die Wahl gilt für die
           Frage, an der sie steht, und merkt sich „später“ für alle noch offenen. -->
      <button
        type="button"
        class="chip"
        role="radio"
        aria-checked={wert === null && !!eingabe.sa.mietrueckstaendeSpaeter}
        onclick={() => {
          eingabe.sa[spaeterFuer] = null;
          if (spaeterFuer === 'kuendigung') eingabe.sa.kuendigungWelche = '';
          eingabe.sa.mietrueckstaendeSpaeter = true;
        }}>{t('selbstauskunft.nachZusage')}</button
      >
    {/if}
  </div>
{/snippet}

{#snippet einzelFrage(teilId: TeilId, f: (typeof FRAGEN_JETZT)[number])}
  <div class="frage">
    <b>{frage(f)}</b>
    <!-- DP49 Punkt 8 (W30): Satz je Angabe. -->
    <small class="w30" data-w30="frage">{t(`angabeSatz.${f}`)}</small>
    {@render jaNein(
      eingabe.sa[f],
      (w) =>
        antworten(
          teilId,
          () => (eingabe.sa[f] = w),
          () => w === 'ja' && !eingabe.sa[ERKLAERUNG[f]]?.trim(),
        ),
      frage(f),
    )}
    {#if eingabe.sa[f] === 'ja'}
      {@render erklaerFeld(
        ERKLAERUNG[f],
        t('selbstauskunft.erklaeren'),
        t('selbstauskunft.erklaerenBeispiel'),
      )}
    {/if}
  </div>
{/snippet}

{#snippet erklaerFeld(
  feld: 'erklaerungInsolvenz' | 'erklaerungRaeumungstitel' | 'stellungnahme',
  etikett: string,
  beispiel: string,
  satz?: string,
)}
  <label class="eingabe">
    {etikett}
    <textarea
      data-feld="erklaerung"
      bind:value={eingabe.sa[feld]}
      rows="3"
      maxlength={ERLAEUTERUNG_MAX}
      placeholder={beispiel || undefined}
      aria-describedby={satz ? `${id}-${feld}-satz` : undefined}></textarea>
  </label>
  {#if satz}<small class="hinweis w30" id="{id}-{feld}-satz" data-w30="feld">{satz}</small>{/if}
  {@const laenge = (eingabe.sa[feld] ?? '').length}
  <!-- Nachricht 10.11. k: ruhiger Zähler ab 500, kein Hinweis im Akzent, das ist kein Fehler. -->
  <small class="zaehler" aria-live="polite"
    >{laenge >= ERLAEUTERUNG_ZAEHLER_AB
      ? t('selbstauskunft.zeichen', { n: laenge, max: ERLAEUTERUNG_MAX })
      : ''}</small
  >
{/snippet}

<!-- PC207, 2: Teil C des Musterbogens, C.4 bis C.6 je mit Ja oder Nein, zu C.6 die Pflichtverletzung, C.7 die Gründe
     nach einem Ja. Der Satz darüber sagt, wann ein Vermieter fragen darf (PC65, W32, W25). -->
{#snippet zusageFragen(teilId: TeilId)}
  <!-- DP145, F1: Wann ein Vermieter fragen darf, sagt nur noch der Satz zur Gruppe. -->
  {#if zusageBeantwortet || neuFragen}
    <div class="frage">
      {#if zusageBeantwortet}<small>{t('selbstauskunft.zusageBeantwortet')}</small>{/if}
      {#if neuFragen}<small>{t('selbstauskunft.zusageNeu')}</small>{/if}
    </div>
  {/if}
  <!-- W30 (Art „gruppe“): Der Satz gilt für alle drei Fragen und steht oben in der Gruppe, 12 px vor der ersten. -->
  <div class="c-gruppe">
    <small class="w30" data-w30="gruppe">{t('angabeSatz.mietrueckstaende')}</small>
    {#each ZUSAGE_FRAGEN as f (f)}
      <div class="frage">
        <b>{frage(f)}</b>
        <!-- PC211: Unter C.6 sagt ein Satz, welche Kündigung zählt (W30, Art „frage“). -->
        {#if f === 'kuendigung'}<small class="w30" data-w30="frage"
            >{t('selbstauskunft.kuendigungSatz')}</small
          >{/if}
        {@render jaNein(
          eingabe.sa[f],
          (w) =>
            antworten(
              teilId,
              () => (eingabe.sa[f] = w),
              () => w === 'ja',
            ),
          frage(f),
          f,
        )}
        {#if f === 'kuendigung' && eingabe.sa.kuendigung === 'ja'}
          <label class="eingabe">
            {t('selbstauskunft.kuendigungWelche')}
            <input
              data-feld="kuendigung"
              bind:value={eingabe.sa.kuendigungWelche}
              maxlength={ERLAEUTERUNG_MAX}
            />
          </label>
        {/if}
      </div>
    {/each}
  </div>
  {#if zusageJa}
    <!-- DP143: C.7 nach dem Musterbogen; der Satz steht unter dem Feld (W30). -->
    {@render erklaerFeld(
      'stellungnahme',
      t('selbstauskunft.gruende'),
      '',
      t('selbstauskunft.gruendeBeispiel'),
    )}
  {/if}
  {#if zusageBeantwortet}
    <button type="button" class="textlink" onclick={zusageAntwortEntfernen}
      >{t('selbstauskunft.antwortenEntfernen')}</button
    >
  {/if}
{/snippet}

<!-- Ende eines offenen Teils: Angaben löschen und, sobald er fertig ist, der Knopf zum nächsten. -->
{#snippet teilFuss(teil: { id: TeilId; fertig: boolean })}
  {#if loeschenFrage === teil.id}
    <div class="loeschen-frage" role="status">
      <p>
        {teil.id === 'haushalt'
          ? t('selbstauskunft.angabenFrageHaushalt')
          : t('selbstauskunft.angabenFrage')}
      </p>
      <span class="teil-fuss">
        <button type="button" class="textlink" onclick={() => leeren(teil.id)}
          >{t('selbstauskunft.loeschen')}</button
        >
        <button type="button" class="textlink" onclick={() => (loeschenFrage = null)}
          >{t('allgemein.abbrechen')}</button
        >
      </span>
    </div>
  {:else if hatAngaben(teil.id) || (teilKnopf && knopfDa(teil.id))}
    <div class="teil-fuss">
      {#if hatAngaben(teil.id)}
        <button type="button" class="textlink leise" onclick={() => (loeschenFrage = teil.id)}
          >{t('selbstauskunft.angabenLoeschen')}</button
        >
      {/if}
      {#if teilKnopf && knopfDa(teil.id)}
        {@const naechster = naechsterOffen(teil.id)}
        <!-- Der Fokus bleibt beim Tippen im Feld: Ginge die Tastatur erst zu, verschöbe sich die
             Leiste unten, und das iPhone verwirft den Tipp. Danach steht er im ersten Feld des
             nächsten Teils, etwa „Netto im Monat“. -->
        <button
          type="button"
          class="teil-weiter"
          onmousedown={(e) => e.preventDefault()}
          onclick={() =>
            void weiterNach(teil.id).then((neu) =>
              neu?.querySelector<HTMLElement>('input')?.focus(),
            )}
          >{#key nachgefragt && teil.id === 'kontakt'}<span class="beschriftung"
              >{nachgefragt && teil.id === 'kontakt'
                ? t('selbstauskunft.stimmt')
                : naechster
                  ? t('selbstauskunft.weiterZu', { teil: teilTitel(naechster) })
                  : t('selbstauskunft.teilZu')}</span
            >{/key}</button
        >
      {/if}
    </div>
  {/if}
{/snippet}

<!-- PC208, Schritt 1: Die Selbstauskunft steht auf dem Formblatt; daraus kommt die Feldlinie (H3, global.css). -->
<div class="akkordeon formblatt" bind:this={wurzel}>
  {#each stand as teil, i (teil.id)}
    {@const titel = teilTitel(teil.id)}
    <!-- W63: derselbe Teil wie in der Bürgschaft (formblatt/FormTeil.svelte). PC130 K7: Offen steht unter den Feldern
         schon „Eine Angabe reicht, die zweite ist freiwillig.“; im Kopf nicht noch einmal „Eine Angabe genügt“.
         Zugeklappt bleibt der kurze Satz, dort fehlt der lange. -->
    <FormTeil
      nummer={i + 1}
      {titel}
      offen={offen === teil.id}
      fertig={teil.fertig}
      kopfId="{id}-{teil.id}"
      stand={teil.id !== 'kontakt' || telefonFehler ? offenText(teil) : ''}
      zusammenfassung={teil.fertig ? zusammenfassung(teil.id) : offenText(teil)}
      oeffnen={() => (offen = teil.id)}
    >
      {#snippet zusatz()}
        {#if teil.id === 'kontakt' && zweifelKontakt}
          <small class="zweifel"
            ><NachfrageZeichen />{t(
              zweifelTelefon && zweifelEmail
                ? 'selbstauskunft.pruefenBeide'
                : zweifelEmail
                  ? 'selbstauskunft.pruefenEmail'
                  : 'selbstauskunft.pruefenTelefon',
            )}</small
          >
        {/if}
      {/snippet}

      {#if teil.id === 'kontakt'}
        <!-- PC64, Punkt 7, und DP50: Für „fertig“ reicht eine der beiden Angaben (selbstauskunft.ts, Teil
               Kontakt). Der Satz steht oben im Teil, das leere zweite Feld sagt „freiwillig“. -->
        <p class="hinweis satz">{t('selbstauskunft.kontaktSatz')}</p>
        <!-- E222, DP77: Telefon mit Land; Fehler erst beim Verlassen. Eine Nachfrage (W33) gibt es nur noch für
               gültige Sonderrufnummern (TL26), im Tintenrand nach DP49b. -->
        <TelefonFeld
          bind:wert={eingabe.telefon}
          bind:land={eingabe.telefonLand}
          {allein}
          gewaehlte={haushaltLaender}
          pruefen={telefonHinweis}
          nachfrageId="{id}-nachfrage-telefon"
          feld={{
            'data-feld': 'telefon',
            onpointerdown: insFeld,
            // DP50: Ist nur die Mail da, sagt das leere Telefonfeld „freiwillig“.
            placeholder:
              eingabe.email.trim() && !eingabe.telefon.trim()
                ? t('selbstauskunft.freiwilligPlatzhalter')
                : undefined,
            ...weiterTaste(teil.id),
          }}
          onfocus={insFeld}
        />
        <Nachfrage aktiv={telefonHinweis} id="{id}-nachfrage-telefon" />
        <label class="eingabe">
          {t('selbstauskunft.email')}
          <input
            data-feld="email"
            class:pruefzustand={emailHinweis}
            aria-describedby={emailHinweis ? `${id}-nachfrage-email` : undefined}
            onfocus={insFeld}
            onpointerdown={insFeld}
            bind:value={eingabe.email}
            type="email"
            autocomplete="email"
            inputmode="email"
            placeholder={eingabe.telefon.trim() && !eingabe.email.trim()
              ? t('selbstauskunft.freiwilligPlatzhalter')
              : undefined}
            {...weiterTaste(teil.id)}
          />
        </label>
        <Nachfrage aktiv={emailHinweis} id="{id}-nachfrage-email" />
        <!-- W60 (DP135 U6): Anschrift freiwillig, in drei Feldern wie im Musterbogen und in E111. -->
        <AnschriftFelder
          bind:anschrift={eingabe.anschrift}
          titel={t('selbstauskunft.freiwillig', { feld: t('selbstauskunft.anschrift') })}
          satz={t('angabeSatz.anschrift')}
          tasten={weiterTaste(teil.id)}
        />
      {:else if teil.id === 'einkommen'}
        <!-- DP49 Punkt 8 (W30): Satz je Angabe; mit mehreren Quellen (DP47 G5) steht stattdessen deren Satz.
               W30-Regel: Mit einer Quelle ist das Netto ein einzelnes Feld, der Satz steht darunter. -->
        {#if mehrere}
          <p class="hinweis">
            {amtDa ? t('einkommenQuellen.leadAmt') : t('einkommenQuellen.lead')}
          </p>
          {#if zeigeErste && person.lebenssituation}
            <p class="quelle-kopf">
              <b>{situationText(person.lebenssituation, person.ausbildungArt)}</b>
              <span>{t('einkommenQuellen.zuerst')}</span>
            </p>
          {/if}
        {/if}
        {#if zeigeErste}
          {#if felder.has('nettoeinkommen')}
            {#if imJahr}
              <label class="eingabe">
                {person.lebenssituation === 'rente'
                  ? t('selbstauskunft.nettoRente')
                  : t('selbstauskunft.nettoKurz')}
                <span class="euro">
                  <input
                    value={jahrEingabe}
                    oninput={(e) => jahrGesetzt(e.currentTarget.value)}
                    inputmode="numeric"
                    autocomplete="off"
                    {...weiterTaste(teil.id)}
                  />
                  <span aria-hidden="true">€</span>
                </span>
              </label>
              {#if eingabe.netto}<p class="hinweis">
                  {t('selbstauskunft.nettoJahrSatz', {
                    betrag: `${new Intl.NumberFormat('de-DE').format(Number(eingabe.netto))} €`,
                  })}
                </p>{/if}
            {:else}
              <label class="eingabe">
                {person.lebenssituation === 'rente'
                  ? t('selbstauskunft.nettoRente')
                  : t('selbstauskunft.nettoKurz')}
                <span class="euro">
                  <input
                    bind:value={eingabe.netto}
                    inputmode="numeric"
                    autocomplete="off"
                    {...weiterTaste(teil.id)}
                  />
                  <span aria-hidden="true">€</span>
                </span>
              </label>
            {/if}
            {#if !mehrere}<p class="hinweis satz w30" data-w30="feld">
                {t('angabeSatz.einkommen')}
              </p>{/if}
            <!-- B28b (DP21): Netto im Monat oder im Jahr; in der Mappe steht immer der Monat. -->
            <div class="jn" role="radiogroup" aria-label={t('selbstauskunft.nettoKurz')}>
              {#each [false, true] as jahr (jahr)}
                <button
                  type="button"
                  class="chip"
                  role="radio"
                  aria-checked={imJahr === jahr}
                  onclick={() => jahrUmschalten(jahr)}
                  >{jahr ? t('selbstauskunft.nettoJahr') : t('selbstauskunft.nettoMonat')}</button
                >
              {/each}
            </div>
            <div class="jn" role="radiogroup" aria-label={t('selbstauskunft.nettoArt')}>
              {#each ['betrag', 'mindestens'] as const as art (art)}
                <button
                  type="button"
                  class="chip"
                  role="radio"
                  aria-checked={eingabe.sa.einkommenArt === art}
                  onclick={() => (eingabe.sa.einkommenArt = art)}
                  >{art === 'betrag'
                    ? t('selbstauskunft.nettoBetrag')
                    : t('selbstauskunft.nettoMindestens')}</button
                >
              {/each}
            </div>
            <p class="hinweis">{t('selbstauskunft.nettoHinweis')}</p>
          {:else}
            <p class="hinweis">{t('selbstauskunft.amtSatz')}</p>
            {#if !mehrere}<p class="hinweis satz w30">{t('angabeSatz.einkommen')}</p>{/if}
          {/if}
          <label class="eingabe">
            {t('selbstauskunft.freiwillig', { feld: berufNamen.beruf })}
            <input
              data-feld="beruf"
              bind:value={eingabe.beruf}
              autocomplete="organization-title"
              {...weiterTaste(teil.id)}
            />
          </label>
          <label class="eingabe">
            {t('selbstauskunft.freiwillig', { feld: berufNamen.arbeitgeber })}
            <input
              data-feld="arbeitgeber"
              bind:value={eingabe.arbeitgeber}
              autocomplete="organization"
              {...weiterTaste(teil.id)}
            />
          </label>
          <p class="hinweis w30" data-w30="feld">{t('angabeSatz.beruf')}</p>
        {/if}
        {#if mehrere}<EinkommenQuellen bind:eingabe {person} />{/if}
      {:else if teil.id === 'fragen'}
        {#each FRAGEN_JETZT as f (f)}
          {@render einzelFrage(teil.id, f)}
        {/each}
        <h4 class="zwischen">{t('mappe.schritt.zusage')}</h4>
        {@render zusageFragen(teil.id)}
      {:else}
        <p class="hinweis">{t('selbstauskunft.haushaltHinweis')}</p>
        {#if vonName}
          <p class="von-wem">{t('selbstauskunft.vonWem', { name: vonName })}</p>
        {/if}
        <!-- PC213 (E-B1): Ohne Haushalt fragt der Teil selbst, wer einzieht (Musterbogen B.1). -->
        {#if einziehen}
          {@render einziehen()}
        {:else}
          <p class="einzug">{t('selbstauskunft.ziehenEin', { text: einziehendText })}</p>
        {/if}
        <p class="hinweis w30" data-w30="feld">{t('angabeSatz.einziehen')}</p>
        <div class="frage">
          <b>{haustiereFrage}</b>
          <small class="w30" data-w30="frage">{t('angabeSatz.haustiere')}</small>
          {@render jaNein(
            eingabe.hh.haustiere,
            (w) =>
              antworten(
                teil.id,
                () => (eingabe.hh.haustiere = w),
                () => w === 'ja' && !eingabe.hh.haustiereText.trim(),
              ),
            haustiereFrage,
          )}
          {#if eingabe.hh.haustiere === 'ja'}
            <label class="eingabe">
              {t('selbstauskunft.haustiereWelche')}
              <input
                data-feld="haustiere"
                bind:value={eingabe.hh.haustiereText}
                {...weiterTaste(teil.id)}
              />
            </label>
          {/if}
        </div>
        <!-- W28, E376 (PC208, Schritt 5): freiwillig, für den Haushalt; ein Ja zeigt sich unter „Für den ganzen
             Haushalt“, solange der Schein fehlt. Schließt den Teil nicht. -->
        <div class="frage">
          <b>{t('selbstauskunft.wbs')}</b>
          <small class="w30" data-w30="frage">{t('angabeSatz.wbs')}</small>
          {@render jaNein(
            eingabe.hh.wbs ?? null,
            (w) => (eingabe.hh.wbs = w),
            t('selbstauskunft.wbsGruppe'),
          )}
        </div>
        <label class="eingabe">
          {t('selbstauskunft.ortUnterschrift')}
          <input
            data-feld="ort"
            bind:value={eingabe.hh.ort}
            placeholder={t('selbstauskunft.ortBeispiel')}
            autocomplete="address-level2"
            {...weiterTaste(teil.id)}
          />
        </label>
      {/if}
      {@render teilFuss(teil)}
    </FormTeil>
  {/each}
</div>

<style>
  .akkordeon {
    display: grid;
    gap: 12px;
  }

  .teil-fuss {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0 16px;
  }

  .leise {
    color: var(--ink-muted);
    font-weight: 600;
  }

  /* Klein, aber ein Knopf: Hier geht es weiter (Rückmeldung vom 4.11., ein Textlink war zu leise). */
  .teil-weiter {
    min-height: var(--tap-target);
    margin-left: auto;
    padding: 0 18px;
    border: 0;
    border-radius: 999px;
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  /* PC73 (W33): wie der Satz der Nachfrage, Tinte mit dem „?“ im feinen Kreis davor; nicht mehr im Ton „knapp“
     (im Dunkeln war das ein helles Gelb als Schriftfarbe). */
  .zweifel {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink);
    font-weight: 600;
  }

  /* W9: Der Knopf blendet in 150 ms zu „Stimmt“ über, ohne Bewegung. */
  .teil-weiter .beschriftung {
    animation: ueberblenden var(--bw-knopf-blende) var(--bw-weich);
  }

  @keyframes ueberblenden {
    from {
      opacity: 0;
    }
  }

  .von-wem {
    margin: 10px 0;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--track);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .loeschen-frage p {
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .loeschen-frage .teil-fuss {
    justify-content: flex-start;
  }

  /* DP50, 320 px mit 130 %: der Knopf über „Angaben löschen“, in voller Breite. */
  @container (max-width: 280px) {
    .teil-fuss {
      flex-direction: column-reverse;
      align-items: stretch;
    }

    .teil-fuss .teil-weiter {
      width: 100%;
      margin-left: 0;
    }
  }

  .eingabe input,
  .eingabe textarea {
    min-height: 48px;
    border-radius: 14px;
  }

  .zaehler {
    display: block;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    text-align: right;
  }

  .zaehler:empty {
    display: none;
  }

  textarea {
    padding: 12px 14px;
    /* DP33 A4: weiche Fläche ohne Linie. */
    border: 0;
    border-radius: var(--radius-slot);
    background: var(--weich);
    color: var(--ink);
    font: inherit;
    font-size: calc(16 * var(--px));
    resize: vertical;
  }

  /* DP33 A4: Fokus 2 px Tinte innen. */
  textarea:focus-visible {
    outline: 0;
    /* DP49b, W33: kein Tintenrand beim Fokus; den Fokus zeigt der Cursor. */
    box-shadow: none;
  }

  .euro {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .euro input {
    flex: 1;
    min-width: 0;
  }

  .euro span {
    font-size: calc(17 * var(--px));
    font-weight: 700;
  }

  .jn {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .jn .chip {
    min-width: 76px;
    padding: 0 14px;
    font-size: calc(15 * var(--px));
  }

  .frage {
    display: grid;
    gap: 6px;
    padding-top: 12px;
    border-top: 1px solid var(--track);
  }

  /* W30-Regel: Bei einer Frage steht der Satz 4 px unter ihr (Abstand im Raster 6 px), der letzte Satz vor den
     Knöpfen 12 px über ihnen. Ein Satz zu einem einzelnen Feld steht 8 px unter dem Feld (Abstand im Teil 12 px). */
  .frage [data-w30='frage'] {
    margin-top: -2px;
  }

  .frage > small:has(+ .jn) {
    margin-bottom: 6px;
  }

  .hinweis[data-w30='feld'] {
    margin-top: -4px;
  }

  .c-gruppe {
    display: grid;
    gap: 12px;
  }

  .c-gruppe > small {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .zwischen {
    margin: 8px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 800;
  }

  .frage .textlink {
    width: fit-content;
  }

  .frage b {
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .frage small,
  .hinweis {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .einzug {
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }
  .quelle-kopf {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    margin: 0;
  }

  .quelle-kopf span {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }
</style>
