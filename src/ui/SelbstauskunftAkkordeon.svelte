<script lang="ts">
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
    telefonSiehtGutAus,
    teile,
    type JaNein,
    type TeilId,
  } from '../domain/selbstauskunft';
  import { personenZiehenEin } from '../domain/mappeWoerter';
  import { t } from '../i18n';
  import { angabenAus, type SelbstauskunftEingabe } from './selbstauskunftEingabe';
  import Symbol from './Symbol.svelte';

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
  } = $props();

  const id = $props.id();
  const felder = $derived(new Set(felderFuer(rolle, person.lebenssituation).map((f) => f.id)));
  const stand = $derived(teile({ ...person, ...angabenAus(eingabe) }, rolle, eingabe.hh));
  const name = $derived(person.rufname || person.vorname);

  const FELD_IN_TEIL: Record<string, TeilId> = {
    telefon: 'kontakt',
    email: 'kontakt',
    beruf: 'einkommen',
    arbeitgeber: 'einkommen',
    erklaerung: 'fragen',
    haustiere: 'haushalt',
    ort: 'haushalt',
  };

  let offen = $state<TeilId | null>(null);
  // Der Hinweis zum Format wartet, bis man das Feld verlassen hat: Beim Tippen stimmt es noch nicht.
  let imFeld = $state<'telefon' | 'email' | null>(null);
  const telefonHinweis = $derived(
    imFeld !== 'telefon' && !!eingabe.telefon.trim() && !telefonSiehtGutAus(eingabe.telefon),
  );
  const emailHinweis = $derived(
    imFeld !== 'email' && !!eingabe.email.trim() && !emailSiehtGutAus(eingabe.email),
  );

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
    return [...stand.slice(i + 1), ...stand.slice(0, i + 1)].find((s) => !s.fertig)?.id ?? null;
  }

  // Zweifel am Format im Kontakt (Rückmeldung 12.11.: „E-Mail warnt nicht“): Der Knopf „Weiter“ und die
  // Taste im letzten Feld schlossen den Teil, bevor der Hinweis erscheinen konnte. Jetzt zeigt der erste
  // Schritt weiter den Hinweis, der zweite geht weiter („Du kannst es trotzdem so lassen“).
  const zweifelTelefon = $derived(!!eingabe.telefon.trim() && !telefonSiehtGutAus(eingabe.telefon));
  const zweifelEmail = $derived(!!eingabe.email.trim() && !emailSiehtGutAus(eingabe.email));
  const zweifelKontakt = $derived(zweifelTelefon || zweifelEmail);
  let gewarntBei = $state<string | null>(null);

  function weiterNach(teil: TeilId): Promise<HTMLElement | null | undefined> {
    const werte = `${eingabe.telefon}|${eingabe.email}`;
    if (teil === 'kontakt' && zweifelKontakt && gewarntBei !== werte) {
      gewarntBei = werte;
      imFeld = null;
      return Promise.resolve(null);
    }
    return oeffnen(naechsterOffen(teil));
  }

  /** Tipp auf den gedämpften Hauptknopf: Der erste fehlende Teil geht auf. */
  export function fehlendenOeffnen() {
    void oeffnen(stand.find((s) => !s.fertig)?.id ?? null);
  }

  // Taste „Weiter“ der Tastatur: nächstes Feld, im letzten Feld der nächste offene Teil.
  const weiterTaste = (teil: TeilId) => ({
    enterkeyhint: 'next' as const,
    onkeydown: (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const feld = e.currentTarget as HTMLInputElement;
      const felder = [...(feld.closest('section')?.querySelectorAll('input') ?? [])];
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

  const FRAGEN = ['insolvenz', 'raeumungstitel', 'mietrueckstaende'] as const;
  // Mietrückstände gehören zum Schritt nach der Zusage: sichtbar, aber nicht Pflicht (mappe-feinschliff.md, § 1).
  const FRAGEN_JETZT = ['insolvenz', 'raeumungstitel'] as const;

  function zusageAntwortEntfernen() {
    eingabe.sa.mietrueckstaende = null;
    eingabe.sa[ERKLAERUNG.mietrueckstaende] = '';
  }

  // „Angaben löschen“: statt dass etwas Falsches stehen bleibt. Ja und Nein lassen sich sonst nicht
  // mehr abwählen. Eine Rückfrage, weil die Änderung auf der eigenen Seite sofort gespeichert wird.
  let loeschenFrage = $state<TeilId | null>(null);

  function hatAngaben(teil: TeilId): boolean {
    if (teil === 'kontakt') return !!(eingabe.telefon.trim() || eingabe.email.trim());
    if (teil === 'einkommen')
      return !!(eingabe.netto.trim() || eingabe.beruf.trim() || eingabe.arbeitgeber.trim());
    if (teil === 'fragen') return FRAGEN.some((f) => eingabe.sa[f] !== null);
    return eingabe.hh.haustiere !== null || !!eingabe.hh.ort.trim();
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
      for (const f of FRAGEN) {
        eingabe.sa[f] = null;
        eingabe.sa[ERKLAERUNG[f]] = '';
      }
    } else {
      eingabe.hh.haustiere = null;
      eingabe.hh.haustiereText = '';
      eingabe.hh.ort = '';
    }
    loeschenFrage = null;
  }

  const frage = (f: 'insolvenz' | 'raeumungstitel' | 'mietrueckstaende') =>
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
          : t('selbstauskunft.fragenNeinZwei');
      return eingabe.sa.mietrueckstaende === null
        ? `${satz} · ${t('selbstauskunft.zusageOffen')}`
        : satz;
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

  function offenText(teil: { id: TeilId; offen: number }): string {
    if (teil.id === 'fragen' && teil.offen < FRAGEN_JETZT.length)
      return t('selbstauskunft.offen', { anzahl: teil.offen });
    return t(`selbstauskunft.teil.${teil.id}Offen`);
  }
</script>

{#snippet jaNein(wert: JaNein, setzen: (w: JaNein) => void, beschriftung: string)}
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
  </div>
{/snippet}

{#snippet einzelFrage(teilId: TeilId, f: (typeof FRAGEN)[number])}
  <div class="frage">
    <b>{frage(f)}</b>
    {#if f === 'mietrueckstaende'}
      <small>
        {#if eingabe.sa.mietrueckstaende !== null}
          {t('selbstauskunft.zusageBeantwortet')}
        {:else if du}
          {t('selbstauskunft.zusageHinweisDu')}
        {:else}
          {t('selbstauskunft.zusageHinweisIhr')}
        {/if}
      </small>
    {/if}
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
      <label class="eingabe">
        {t('selbstauskunft.erklaeren')}
        <textarea
          data-feld="erklaerung"
          bind:value={eingabe.sa[ERKLAERUNG[f]]}
          rows="3"
          maxlength={ERLAEUTERUNG_MAX}
          placeholder={t('selbstauskunft.erklaerenBeispiel')}></textarea>
      </label>
      {@const laenge = (eingabe.sa[ERKLAERUNG[f]] ?? '').length}
      <!-- Nachricht 10.11. k: ruhiger Zähler ab 500, kein Hinweis im Akzent, das ist kein Fehler. -->
      <small class="zaehler" aria-live="polite"
        >{laenge >= ERLAEUTERUNG_ZAEHLER_AB
          ? t('selbstauskunft.zeichen', { n: laenge, max: ERLAEUTERUNG_MAX })
          : ''}</small
      >
    {/if}
    {#if f === 'mietrueckstaende' && eingabe.sa.mietrueckstaende !== null}
      <button type="button" class="textlink" onclick={zusageAntwortEntfernen}
        >{t('selbstauskunft.antwortEntfernen')}</button
      >
    {/if}
  </div>
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
  {:else if hatAngaben(teil.id) || teil.fertig}
    <div class="teil-fuss">
      {#if hatAngaben(teil.id)}
        <button type="button" class="textlink leise" onclick={() => (loeschenFrage = teil.id)}
          >{t('selbstauskunft.angabenLoeschen')}</button
        >
      {/if}
      {#if teil.fertig}
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
          >{naechster
            ? t('selbstauskunft.weiterZu', { teil: t(`selbstauskunft.teil.${naechster}`) })
            : t('selbstauskunft.teilZu')}</button
        >
      {/if}
    </div>
  {/if}
{/snippet}

<div class="akkordeon" bind:this={wurzel}>
  {#each stand as teil, i (teil.id)}
    {@const titel = t(`selbstauskunft.teil.${teil.id}`)}
    {#if offen === teil.id}
      <section class="teil offen" aria-labelledby="{id}-{teil.id}">
        <h3 id="{id}-{teil.id}">
          <span class="nummer" aria-hidden="true">{i + 1}</span>
          <span class="teilname" class:lang={titel.length > 30}>{titel}</span>
          <small
            >{#if teil.fertig}<Symbol name="haken" groesse={16} />{t(
                'selbstauskunft.fertigMarke',
              )}{:else}{offenText(teil)}{/if}</small
          >
        </h3>

        {#if teil.id === 'kontakt'}
          <label class="eingabe">
            {t('selbstauskunft.telefon')}
            <input
              data-feld="telefon"
              bind:value={eingabe.telefon}
              type="tel"
              autocomplete="tel"
              inputmode="tel"
              onfocus={() => (imFeld = 'telefon')}
              onblur={() => (imFeld = null)}
              {...weiterTaste(teil.id)}
            />
          </label>
          {#if telefonHinweis}<p class="format" role="status">
              {t('selbstauskunft.telefonHinweis')}
            </p>{/if}
          <label class="eingabe">
            {t('selbstauskunft.email')}
            <input
              data-feld="email"
              bind:value={eingabe.email}
              type="email"
              autocomplete="email"
              inputmode="email"
              onfocus={() => (imFeld = 'email')}
              onblur={() => (imFeld = null)}
              {...weiterTaste(teil.id)}
            />
          </label>
          {#if emailHinweis}<p class="format" role="status">
              {t('selbstauskunft.emailHinweis')}
            </p>{/if}
        {:else if teil.id === 'einkommen'}
          {#if felder.has('nettoeinkommen')}
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
        {:else if teil.id === 'fragen'}
          {#each FRAGEN_JETZT as f (f)}
            {@render einzelFrage(teil.id, f)}
          {/each}
          <h4 class="zwischen">{t('mappe.schritt.zusage')}</h4>
          {@render einzelFrage(teil.id, 'mietrueckstaende')}
        {:else}
          <p class="hinweis">{t('selbstauskunft.haushaltHinweis')}</p>
          {#if vonName}
            <p class="von-wem">{t('selbstauskunft.vonWem', { name: vonName })}</p>
          {/if}
          <p class="einzug">{t('selbstauskunft.ziehenEin', { text: einziehendText })}</p>
          <div class="frage">
            <b>{allein ? t('selbstauskunft.haustiereDu') : t('selbstauskunft.haustiereIhr')}</b>
            <small>{t('selbstauskunft.haustiereHinweis')}</small>
            {@render jaNein(
              eingabe.hh.haustiere,
              (w) =>
                antworten(
                  teil.id,
                  () => (eingabe.hh.haustiere = w),
                  () => w === 'ja' && !eingabe.hh.haustiereText.trim(),
                ),
              allein ? t('selbstauskunft.haustiereDu') : t('selbstauskunft.haustiereIhr'),
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
      </section>
    {:else}
      <button type="button" class="teil zu" aria-expanded="false" onclick={() => (offen = teil.id)}>
        <span class="nummer" class:fertig={teil.fertig} aria-hidden="true"
          >{#if teil.fertig}<Symbol name="haken" groesse={16} />{:else}{i + 1}{/if}</span
        >
        <span class="tx">
          <b>{titel}</b>
          <small>{teil.fertig ? zusammenfassung(teil.id) : offenText(teil)}</small>
          {#if teil.id === 'kontakt' && zweifelKontakt}
            <small class="zweifel"
              >{t(
                zweifelTelefon && zweifelEmail
                  ? 'selbstauskunft.pruefenBeide'
                  : zweifelEmail
                    ? 'selbstauskunft.pruefenEmail'
                    : 'selbstauskunft.pruefenTelefon',
              )}</small
            >
          {/if}
        </span>
        {#if teil.fertig}
          <span class="aendern">{t('selbstauskunft.aendern')}</span>
        {:else}
          <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={20} /></span>
        {/if}
      </button>
    {/if}
  {/each}
</div>

<style>
  .akkordeon {
    display: grid;
    gap: 12px;
  }

  .teil {
    border-radius: 20px;
    background: var(--surface);
  }

  .offen {
    display: grid;
    gap: var(--space-3);
    padding: 14px 16px 16px;
    border: 2px solid var(--ink);
    scroll-margin: 16px 0 120px;
  }

  /* Reicht die Breite nicht, rutscht der Stand rechtsbündig unter den Titel (stil-c.md, C21). */
  h3 {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 10px;
    margin: 0;
    font-size: calc(18 * var(--px));
    line-height: calc(23 * var(--px));
    font-weight: 800;
    font-stretch: 100%;
    letter-spacing: 0;
  }

  h3 .teilname {
    flex: 1 1 min(8.5em, calc(100% - 38px));
    min-width: 0;
  }

  /* Lange Titel brauchen mehr: Sonst stünden sie auch bei 430 px in drei Zeilen neben dem Stand. */
  h3 .teilname.lang {
    flex-basis: min(11.5em, calc(100% - 38px));
  }

  h3 small {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
    margin-left: auto;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 600;
    color: var(--ink-muted);
    text-align: right;
  }

  .nummer {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: var(--surface);
    font-size: calc(14 * var(--px));
    font-weight: 800;
  }

  .nummer.fertig {
    background: var(--ink);
    color: var(--surface);
  }

  /* Ebenso „Ändern“ unter dem Text (stil-c.md, „Zeilen mit Ändern“). */
  .zu {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    width: 100%;
    min-height: 64px;
    padding: 10px 16px;
    border: 0;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    /* Nummer und Pfeil passen daneben; „Ändern“ rutscht im engsten Fall darunter. */
    flex: 1 1 min(10em, calc(100% - 70px));
    min-width: 0;
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

  .zweifel {
    color: var(--knapp-text);
  }

  .format {
    margin: -4px 0 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
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

  .tx b {
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .aendern {
    flex-shrink: 0;
    margin-left: auto;
    font-size: calc(15 * var(--px));
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .pfeil {
    flex-shrink: 0;
    transform: rotate(90deg);
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
    padding: 10px 14px;
    border: 1.5px solid var(--control-border);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: calc(16 * var(--px));
    resize: vertical;
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
</style>
