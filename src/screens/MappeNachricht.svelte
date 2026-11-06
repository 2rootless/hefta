<script lang="ts">
  // Nachricht ans Inserat (design/nachricht-ans-inserat.md, PN1 bis PN10): ein Textfeld, eine fertige
  // Nachricht. Der Inseratstext wird nicht gespeichert, und was mitgeht, gilt nur für dieses Inserat.
  import { onMount, untrack } from 'svelte';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { adresseZeilen } from '../domain/adresse';
  import { standardEinstellungen, type ExportEinstellungen } from '../domain/export';
  import type { Bewerbung } from '../domain/modell';
  import {
    ANGABEN,
    angabenWerte,
    erkennen,
    erklaerung,
    mailLink,
    nachrichtText,
    type AngabeId,
  } from '../domain/nachricht';
  import { einziehend } from '../domain/selbstauskunft';
  import { groesse, t } from '../i18n';
  import { bewerbungLaden, bewerbungSpeichern, personAendern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import type { MappenErgebnis } from '../ui/mappeErstellen';
  import { bauSchluessel, gebauteMappen } from '../ui/mappeSpeicher';
  import { passend, TITEL } from '../ui/passend';
  import Schalter from '../ui/Schalter.svelte';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Zurueck from '../ui/Zurueck.svelte';

  let bewerbung = $state.raw<Bewerbung | null>(null);
  let e = $state.raw<ExportEinstellungen>(standardEinstellungen());
  let einzug = $state('');
  onMount(async () => {
    if (!daten.ansicht) return;
    bewerbung = (await bewerbungLaden(await db(), daten.ansicht.haushalt.id)) ?? null;
    e = { ...standardEinstellungen(), ...bewerbung?.export };
    einzug = bewerbung?.einzug ?? '';
  });

  let inserat = $state('');
  let anhaengen = $state(false);
  const erkannt = $derived(erkennen(inserat));
  const mitText = $derived(!!inserat.trim());

  const ansicht = $derived(daten.ansicht);
  const aktive = $derived(
    (ansicht?.mitglieder ?? []).filter((m) => !m.zugehoerigkeit.herausgenommenAm),
  );
  const vertrag = $derived(aktive.filter((m) => m.zugehoerigkeit.rolle !== 'buerge'));
  const person = $derived(vertrag[0]?.person ?? null);
  const werte = $derived(
    ansicht && person
      ? angabenWerte(
          person,
          einziehend(vertrag.length, ansicht.haushalt),
          haushaltsAngabenAus(ansicht),
          einzug,
        )
      : {},
  );

  // „Ändern“: je Angabe ein Schalter, nur für dieses Inserat. Neuer Text, neue Wahl.
  let listeOffen = $state(false);
  let wahl = $state<Partial<Record<AngabeId, boolean>>>({});
  $effect(() => {
    void erkannt.angaben.join();
    untrack(() => {
      wahl = {};
    });
  });
  const istDabei = (id: AngabeId) => !!werte[id] && (wahl[id] ?? erkannt.angaben.includes(id));
  const dabei = $derived(ANGABEN.map((a) => a.id).filter(istDabei));
  const gewaehlteWerte = $derived(Object.fromEntries(dabei.map((id) => [id, werte[id]])));

  const wohnung = $derived(
    (adresseZeilen(bewerbung?.adresse ?? '')[0] ?? '').replace(/\u00a0/g, ' '),
  );
  const nachricht = $derived(
    nachrichtText({
      name: person ? `${person.vorname} ${person.nachname}`.trim() : '',
      telefon: person?.kontakt.telefon ?? '',
      mail: person?.kontakt.email ?? '',
      wohnung,
      satz: bewerbung?.satz ?? '',
      angaben: gewaehlteWerte,
      mappe: anhaengen,
    }),
  );
  const satz = $derived(
    erklaerung({
      mitText,
      gefragt: erkannt.angaben,
      dabei,
      unzulaessig: erkannt.unzulaessig,
      mailImInserat: !anhaengen && erkannt.wege.includes('mail'),
      unterlagenGefragt: !anhaengen && erkannt.wege.includes('mappe'),
    }),
  );
  const fragtAnschrift = $derived(erkannt.angaben.includes('adresse') && !werte.adresse);
  const fragtEinzug = $derived(erkannt.angaben.includes('einzug'));

  // Eigenes Formular oder offene Besichtigung: Die Nachricht braucht man dann nicht. Weil ein Abgleich
  // von Wörtern sich irren kann, lässt sie sich trotzdem zeigen.
  let trotzdem = $state(false);
  const weg = $derived(
    trotzdem
      ? null
      : erkannt.wege.includes('formular')
        ? ('formular' as const)
        : erkannt.wege.includes('besichtigung')
          ? ('besichtigung' as const)
          : null,
  );

  let mappe = $state.raw<MappenErgebnis | null>(null);
  let mappeBaut = $state(false);
  let mappeFehler = $state(false);
  async function mappeHolen() {
    if (!ansicht) return;
    mappeBaut = true;
    mappeFehler = false;
    try {
      const { mappeGebaut } = await import('../ui/mappeErstellen');
      mappe =
        gebauteMappen.holen(bauSchluessel(ansicht, bewerbung, e)) ??
        (await mappeGebaut(await db(), ansicht, bewerbung, e));
    } catch {
      mappeFehler = true;
      anhaengen = false;
    } finally {
      mappeBaut = false;
    }
  }
  function anhangUmschalten() {
    anhaengen = !anhaengen;
    if (anhaengen && !mappe) void mappeHolen();
  }

  let meldung = $state('');
  async function kopieren() {
    try {
      await navigator.clipboard.writeText(nachricht);
      meldung = t('nachricht.kopiert');
    } catch {
      meldung = t('nachricht.nichtKopiert');
    }
  }

  const betreff = $derived(
    wohnung ? t('nachricht.betreff', { wohnung }) : t('nachricht.betreffOhne'),
  );
  async function alsMail() {
    meldung = '';
    const dateien = anhaengen ? mappe?.dateien : undefined;
    if (dateien?.length) {
      // Ein Mail-Link kann keinen Anhang tragen: Das Teilen-Blatt kann beides, ohne Titel (sonst legt
      // iOS eine Textdatei bei).
      if (navigator.canShare?.({ files: dateien, text: nachricht })) {
        await navigator.share({ files: dateien, text: nachricht }).catch(() => {});
        return;
      }
      const { sichern } = await import('../ui/mappeErstellen');
      sichern(dateien);
      meldung = t('nachricht.anhangSelbst');
    }
    window.location.href = mailLink(erkannt.mail, betreff, nachricht);
  }

  let anschrift = $state('');
  async function anschriftSpeichern() {
    const wert = anschrift.trim();
    if (!person || !wert) return;
    await personAendern(await db(), person.id, { kontakt: { ...person.kontakt, anschrift: wert } });
    await neuLaden();
  }
  async function einzugSpeichern() {
    if (!ansicht) return;
    bewerbung = await bewerbungSpeichern(await db(), ansicht.haushalt.id, {
      einzug: einzug.trim(),
    });
  }
</script>

<main class="seite">
  <div class="kopf"><Zurueck href="#/mappe" text={t('mappe.titel')} /></div>
  <div class="titelblock">
    <h1 class="display frage" use:passend={TITEL}>{t('nachricht.titel')}</h1>
    <p class="lead">{t('nachricht.lead')}</p>
  </div>

  <label class="feld">
    <span>{t('nachricht.feld')}</span>
    <textarea bind:value={inserat} rows="3" placeholder={t('nachricht.platzhalter')}></textarea>
  </label>

  {#if weg === 'formular'}
    <div class="weg">
      <b>{t('nachricht.formularTitel')}</b>
      <p>{t('nachricht.formularText')}</p>
      {#if person}
        <a class="textlink" href="#/selbstauskunft/{person.id}/uebertragen"
          >{t('uebertragen.titel')}</a
        >
      {/if}
      <button type="button" class="textlink" onclick={() => (trotzdem = true)}
        >{t('nachricht.trotzdem')}</button
      >
    </div>
  {:else if weg === 'besichtigung'}
    <div class="weg">
      <b>{t('nachricht.besichtigungTitel')}</b>
      <p>{t('nachricht.besichtigungText')}</p>
      <a class="textlink" href="#/selbstauskuenfte">{t('nachricht.selbstauskunftPdf')}</a>
      <button type="button" class="textlink" onclick={() => (trotzdem = true)}
        >{t('nachricht.trotzdem')}</button
      >
    </div>
  {:else}
    <p class="nachricht" aria-label={t('nachricht.label')}>{nachricht}</p>
    <div class="warum">
      <span class="ic" aria-hidden="true">i</span>
      <div class="warum-text">
        <p>{satz}</p>
        {#if mitText && (erkannt.angaben.length || erkannt.unzulaessig.length)}
          <button
            type="button"
            class="textlink"
            aria-expanded={listeOffen}
            onclick={() => (listeOffen = !listeOffen)}>{t('nachricht.aendern')}</button
          >
        {/if}
      </div>
    </div>
    {#if erkannt.unzulaessig.length}
      <p class="hinweis">{t('nachricht.keineBeratung')}</p>
    {/if}
    {#if fragtAnschrift}
      <label class="feld">
        <span>{t('nachricht.anschrift')}</span>
        <input
          bind:value={anschrift}
          autocomplete="street-address"
          onchange={anschriftSpeichern}
          placeholder={t('nachricht.anschriftBeispiel')}
        />
        <small>{t('nachricht.anschriftHinweis')}</small>
      </label>
    {/if}
    {#if fragtEinzug}
      <label class="feld">
        <span>{t('nachricht.einzug')}</span>
        <input
          bind:value={einzug}
          autocomplete="off"
          onchange={einzugSpeichern}
          placeholder={t('nachricht.einzugBeispiel')}
        />
        <small>{t('nachricht.einzugHinweis')}</small>
      </label>
    {/if}
    <div class="anhang">
      <span class="tx">
        <b>{t('nachricht.anhang')}</b>
        <small>
          {#if mappeFehler}
            {t('mappe.fehler')}
          {:else if !anhaengen}
            {t('nachricht.anhangAus')}
          {:else if mappeBaut || !mappe}
            {t('mappe.wirdErstellt')}
          {:else}
            {t('mappe.seiten', { anzahl: mappe.seiten })} · {groesse(mappe.groesse)}
          {/if}
        </small>
      </span>
      <Schalter an={anhaengen} label={t('nachricht.anhang')} onclick={anhangUmschalten} />
    </div>
    {#if listeOffen}
      <section class="liste">
        <h2>{t('nachricht.wasMitgeht')}</h2>
        <ul>
          {#each ANGABEN as a (a.id)}
            <li>
              <span class="tx">
                <b>{a.text}</b>
                <small
                  >{werte[a.id]
                    ? t(a.schritt === 'besichtigung' ? 'nachricht.schrittA' : 'nachricht.schrittB')
                    : t('nachricht.keinWert')}</small
                >
              </span>
              <Schalter
                an={istDabei(a.id)}
                gesperrt={!werte[a.id]}
                label={a.text}
                onclick={() => (wahl = { ...wahl, [a.id]: !istDabei(a.id) })}
              />
            </li>
          {/each}
        </ul>
        <p class="hinweis">{t('nachricht.immerDabei')}</p>
      </section>
    {/if}
    <p class="meldung" role="status">{meldung}</p>
  {/if}
</main>
{#if weg}
  <Aktionsleiste text={t('nachricht.zurueck')} href="#/mappe" />
{:else}
  <Aktionsleiste
    text={t('nachricht.kopieren')}
    onclick={kopieren}
    neben={{ text: t('nachricht.alsMail'), onclick: alsMail }}
  />
{/if}

<style>
  .seite {
    padding-bottom: 150px;
  }
  .kopf,
  .titelblock {
    padding: 0 var(--space-4);
  }
  .lead {
    margin: 6px 0 0;
    color: var(--ink-muted);
  }
  .feld {
    display: block;
    margin: 12px var(--space-4) 0;
  }
  .feld > span {
    display: block;
    margin-bottom: 4px;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 700;
  }
  .feld small {
    display: block;
    margin-top: 4px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }
  textarea,
  input {
    display: block;
    width: 100%;
    padding: 12px 14px;
    border-radius: 14px;
    border: 1.5px solid var(--ink-muted);
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-size: max(16px, calc(15 * var(--px)));
    line-height: calc(21 * var(--px));
  }
  textarea {
    min-height: 96px;
    max-height: 240px;
    resize: vertical;
  }
  .nachricht {
    margin: 12px var(--space-4) 0;
    padding: 14px 16px;
    border-radius: 18px;
    background: var(--surface);
    box-shadow: var(--shadow-chip);
    font-size: calc(15 * var(--px));
    line-height: calc(22 * var(--px));
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .warum {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    margin: 10px calc(var(--space-4) + 4px) 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }
  .warum-text {
    min-width: 0;
  }
  .warum p {
    margin: 0;
  }
  /* Eine Zeile für sich: Im Satz machte die Tippfläche die Zeile doppelt so hoch und riss ein Loch. Die
     Tippfläche reicht nach unten, so bleibt der Text nah am Satz, ohne ihn zu überdecken. */
  .warum .textlink {
    display: flex;
    align-items: flex-start;
    width: fit-content;
    padding-top: 4px;
  }
  .ic {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    border: 1.5px solid var(--ink);
    border-radius: 50%;
    color: var(--ink);
    font-size: 12px;
    font-weight: 800;
    font-style: normal;
  }
  .anhang {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    margin: 8px calc(var(--space-4) + 4px) 0;
  }
  .tx {
    flex: 1;
    min-width: 0;
  }
  .tx b {
    display: block;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
  }
  .tx small {
    display: block;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }
  .weg {
    margin: 12px var(--space-4) 0;
    padding: 14px 16px;
    border-radius: 18px;
    border: 2px solid var(--ink);
    background: var(--surface);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }
  .weg b {
    display: block;
    font-size: calc(16 * var(--px));
    margin-bottom: 4px;
  }
  .weg p {
    margin: 0 0 4px;
  }
  .weg .textlink {
    display: block;
    width: fit-content;
  }
  .liste {
    margin: 16px var(--space-4) 0;
  }
  .liste h2 {
    margin: 0 0 8px 4px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }
  .liste ul {
    margin: 0;
    padding: 4px 16px;
    list-style: none;
    border-radius: 18px;
    background: var(--surface);
  }
  .liste li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 52px;
    padding: 8px 0;
    border-top: 1px solid var(--track);
  }
  .liste li:first-child {
    border-top: 0;
  }
  .hinweis {
    margin: 8px 4px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }
  .meldung {
    margin: 8px calc(var(--space-4) + 4px) 0;
    min-height: calc(19 * var(--px));
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 700;
  }
</style>
