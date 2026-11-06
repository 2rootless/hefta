<script lang="ts">
  // Selbstauskunft einer Person auf eigener Seite (Entwurf A4): oben der fertige Bogen als PDF, darunter
  // die vier Teile zugeklappt mit Zusammenfassung und „Ändern“. Änderungen werden sofort gespeichert.
  import { untrack } from 'svelte';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { ERKLAERUNG, einziehend, einziehendText, vollstaendig } from '../domain/selbstauskunft';
  import { t, tagZusammen } from '../i18n';
  import { haushaltAendern, personAendern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import SelbstauskunftAkkordeon from '../ui/SelbstauskunftAkkordeon.svelte';
  import {
    angabenAus,
    eingabeAus,
    haushaltAus,
    haushaltsAngabenAus,
    type SelbstauskunftEingabe,
  } from '../ui/selbstauskunftEingabe';
  import Zurueck from '../ui/Zurueck.svelte';

  let {
    personId,
    ausBereich = false,
    feld,
  }: { personId: string; ausBereich?: boolean; feld?: string } = $props();

  const mitglied = $derived(daten.ansicht?.mitglieder.find((m) => m.person.id === personId));
  const start = untrack(() =>
    mitglied && daten.ansicht
      ? { eingabe: eingabeAus(mitglied.person, haushaltsAngabenAus(daten.ansicht)) }
      : null,
  );
  let eingabe = $state<SelbstauskunftEingabe | null>(start?.eingabe ?? null);
  let vorher = untrack(() => haushaltsAngabenAus(daten.ansicht));
  const zurueckZu = $derived(ausBereich ? '/selbstauskuenfte' : `/person/${personId}`);
  const rolle = $derived(mitglied?.zugehoerigkeit.rolle ?? 'mitmieter');
  const vertragsZahl = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length,
  );
  const wer = $derived(
    daten.ansicht ? einziehend(vertragsZahl, daten.ansicht.haushalt) : { erwachsene: 0, kinder: 0 },
  );
  const fertig = $derived(
    !!mitglied &&
      !!eingabe &&
      vollstaendig({ ...mitglied.person, ...angabenAus(eingabe) }, rolle, eingabe.hh),
  );

  // Sofort speichern: kurz nach jeder Änderung, ohne Knopf (A4: „Änderungen werden sofort gespeichert.“).
  let letzter = untrack(() => JSON.stringify(eingabe));
  let zeitgeber: ReturnType<typeof setTimeout> | undefined;
  async function speichern() {
    if (!mitglied || !eingabe || !daten.ansicht) return;
    const jetzt = JSON.stringify(eingabe);
    if (jetzt === letzter) return;
    letzter = jetzt;
    const verbindung = await db();
    await personAendern(verbindung, mitglied.person.id, angabenAus(eingabe));
    const hh = haushaltAus(eingabe, vorher, mitglied.person.id);
    if (hh && rolle !== 'buerge') {
      await haushaltAendern(verbindung, daten.ansicht.haushalt.id, hh);
      vorher = { ...eingabe.hh };
    }
    await neuLaden();
  }
  $effect(() => {
    void JSON.stringify(eingabe);
    clearTimeout(zeitgeber);
    zeitgeber = setTimeout(() => void speichern(), 400);
    return () => clearTimeout(zeitgeber);
  });

  const erklaert = $derived(Object.values(ERKLAERUNG).some((feld) => eingabe?.sa[feld]?.trim()));

  // Wer die Haushaltsangaben eingetragen hat, wenn es jemand anderes war.
  const angabenVon = $derived.by(() => {
    const h = daten.ansicht?.haushalt;
    if (!h?.angabenVon || h.angabenVon === personId) return '';
    const von = daten.ansicht?.mitglieder.find((m) => m.person.id === h.angabenVon)?.person;
    return von ? von.rufname || von.vorname : '';
  });

  let beschaeftigt = $state(false);
  async function pdfZeigen() {
    if (beschaeftigt || !daten.ansicht) return;
    beschaeftigt = true;
    try {
      await speichern();
      const m = daten.ansicht.mitglieder.find((x) => x.person.id === personId)!;
      const { dateiOeffnen, selbstauskunftDatei } = await import('../ui/selbstauskunftPdf');
      dateiOeffnen(await selbstauskunftDatei(m.person, m.zugehoerigkeit.rolle, daten.ansicht));
    } finally {
      beschaeftigt = false;
    }
  }

  const geaendert = $derived(
    mitglied
      ? tagZusammen(
          new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(
            new Date(mitglied.person.updatedAt),
          ),
        )
      : '',
  );
</script>

<main class="seite">
  <div class="kopf">
    <Zurueck
      href="#{zurueckZu}"
      text={ausBereich
        ? t('selbstauskuenfte.titel')
        : (mitglied?.person.rufname ?? t('allgemein.zurueck'))}
    />
  </div>
  {#if !mitglied || !eingabe}
    <p>{t('personSeite.nichtGefunden')}</p>
  {:else}
    <div class="titelblock">
      <h1 class="display frage">{t('selbstauskunft.titel')}</h1>
      <p class="lead">
        {t('selbstauskunft.leadSeite', {
          name: mitglied.person.rufname || mitglied.person.vorname,
        })}
      </p>
    </div>
    <div class="bogen">
      <span class="blatt farbe-{mitglied.zugehoerigkeit.farbe}" aria-hidden="true">
        <i></i><i class="farbig"></i><i></i><i></i><i></i>
      </span>
      <div class="tx">
        <b
          >{fertig
            ? // Lange Erklärungen können eine zweite Seite brauchen.
              t(erklaert ? 'selbstauskunft.fertigMarke' : 'selbstauskunft.pdfFertig')
            : t('selbstauskunft.pdfOffen')}</b
        >
        <small>{t('selbstauskunft.zuletzt', { datum: geaendert })}</small>
        {#if fertig}
          <button type="button" class="textlink" onclick={pdfZeigen}
            >{t('selbstauskunft.pdfAnsehen')}</button
          >
        {/if}
        <a class="textlink" href="#/selbstauskunft/{personId}/uebertragen"
          >{t('uebertragen.titel')}</a
        >
      </div>
    </div>
    {#if beschaeftigt}<p class="hinweis" role="status">{t('selbstauskunft.pdfLaedt')}</p>{/if}
    <div class="inhalt">
      <SelbstauskunftAkkordeon
        bind:eingabe
        vonName={angabenVon}
        person={mitglied.person}
        {rolle}
        du={rolle === 'hauptmieter'}
        allein={vertragsZahl === 1 && wer.erwachsene === 1 && !wer.kinder}
        einziehendText={einziehendText(wer)}
        personenGesamt={wer.erwachsene + wer.kinder}
        start="zu"
        {feld}
      />
    </div>
  {/if}
</main>
{#if mitglied && eingabe}
  <Aktionsleiste
    text={t('selbstauskunft.fertigKnopf')}
    onclick={async () => {
      await speichern();
      abschliessen(zurueckZu);
    }}
  />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) var(--space-4)
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
  }

  .titelblock {
    padding: 6px var(--space-1) 0;
  }

  .frage {
    margin-top: 10px;
  }

  .bogen {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-top: var(--space-5);
    padding: 14px 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .blatt {
    display: grid;
    align-content: start;
    gap: 5px;
    flex-shrink: 0;
    width: 54px;
    height: 76px;
    padding: 9px 7px;
    border-radius: 4px;
    background: #fff;
    box-shadow: 0 2px 8px rgb(25 26 44 / 0.15);
  }

  .blatt i {
    display: block;
    height: 2px;
    border-radius: 1px;
    background: var(--track);
  }

  .blatt i:first-child {
    width: 70%;
    height: 4px;
    background: #191a2c;
  }

  .blatt .farbig {
    width: 50%;
    height: 3px;
    background: var(--farbe);
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

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
    justify-items: start;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .inhalt {
    margin-top: 12px;
  }

  .hinweis {
    margin: 8px 0 0;
    font-size: calc(14 * var(--px));
    color: var(--ink-muted);
  }
</style>
