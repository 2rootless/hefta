<script lang="ts">
  // Fragen für die Besichtigung (E52, B17c Abschnitt 3, B21 `x-fragen`): Liste zum Abhaken vor Ort, mit
  // „Antwort notieren“ unter jeder Frage. Mit Antwort steht diese eingerückt darunter, die Frage wird grau.
  // Eigene Fragen kommen ans Ende und gehören zum Gerät. Alles bleibt im Heft, nichts wird exportiert.
  import { tick } from 'svelte';
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import {
    besichtigungsFragen,
    KEINE_FRAGEN,
    tierFrage,
    type Frage,
    type HeftFragen,
  } from '../domain/besichtigungsFragen';
  import type { Heft } from '../domain/modell';
  import type { Urteil } from '../domain/urteile';
  import { t, type TextSchluessel } from '../i18n';
  import { einstellungenAendern, heftAendern } from '../storage/speicher';
  import Symbol from './Symbol.svelte';

  let { heft, urteile, ihr }: { heft: Heft; urteile: Urteil[]; ihr: boolean } = $props();

  const hh = $derived(daten.ansicht?.haushalt ?? null);
  const gespeichert = $derived(heft.fragen ?? KEINE_FRAGEN);
  const liste = $derived(
    besichtigungsFragen({
      angaben: heft.angaben,
      urteile,
      mitTieren: hh?.haustiere === 'ja',
      eigene: [...gespeichert.eigene, ...(daten.einstellungen?.eigeneFragen ?? [])],
    }),
  );
  const abgehakt = $derived(liste.fragen.filter((f) => gespeichert.antworten[f.id]?.ab).length);

  function text(f: Frage): string {
    if (f.text) return f.text;
    if (f.thema === 'ablauf') return t(ihr ? 'fragen.frage.ablaufUns' : 'fragen.frage.ablaufMir');
    if (f.thema === 'haustiere') {
      const tier = hh?.haustiere === 'ja' ? tierFrage(hh.haustiereText) : null;
      if (tier)
        return t(tier.art === 'ein' ? 'fragen.frage.haustiereEin' : 'fragen.frage.haustiereMehr', {
          tier: tier.tier,
        });
    }
    return t(`fragen.frage.${f.thema}` as TextSchluessel);
  }

  async function sichern(neu: HeftFragen) {
    // Ohne Proxys von Svelte: IndexedDB kann sie nicht kopieren.
    await heftAendern(await db(), heft.id, { fragen: $state.snapshot(neu) });
    await stillLaden();
  }

  function eintrag(id: string) {
    return gespeichert.antworten[id] ?? { ab: false, antwort: '' };
  }

  function haken(f: Frage) {
    const alt = eintrag(f.id);
    void sichern({
      ...gespeichert,
      antworten: { ...gespeichert.antworten, [f.id]: { ...alt, ab: !alt.ab } },
    });
  }

  // Eine Antwort wird gerade geschrieben: welche Frage, mit welchem Text.
  let schreibt = $state<string | null>(null);
  let entwurf = $state('');
  let feld: HTMLTextAreaElement | undefined = $state();

  async function notieren(f: Frage) {
    schreibt = f.id;
    entwurf = eintrag(f.id).antwort;
    await tick();
    feld?.focus();
  }

  function antwortSichern(f: Frage) {
    if (schreibt !== f.id) return;
    const antwort = entwurf.trim();
    schreibt = null;
    const alt = eintrag(f.id);
    if (antwort === alt.antwort) return;
    // Mit Antwort gilt die Frage als abgehakt.
    void sichern({
      ...gespeichert,
      antworten: {
        ...gespeichert.antworten,
        [f.id]: { ab: antwort ? true : alt.ab, antwort },
      },
    });
  }

  let neuOffen = $state(false);
  let neueFrage = $state('');
  let neuFeld: HTMLInputElement | undefined = $state();

  async function eigeneOeffnen() {
    neuOffen = true;
    await tick();
    neuFeld?.focus();
  }

  async function eigeneHinzufuegen() {
    const roh = neueFrage.trim().slice(0, 140);
    neuOffen = false;
    neueFrage = '';
    if (!roh) return;
    // Wie die anderen endet jede Frage mit einem Fragezeichen.
    const frage = /[?.!]$/.test(roh) ? roh : `${roh}?`;
    const geraet = daten.einstellungen?.eigeneFragen ?? [];
    if (!geraet.includes(frage))
      await einstellungenAendern(await db(), { eigeneFragen: [...geraet, frage] });
    await sichern({
      ...gespeichert,
      eigene: gespeichert.eigene.includes(frage)
        ? gespeichert.eigene
        : [...gespeichert.eigene, frage],
    });
  }
</script>

<section class="fragen" aria-labelledby="fragen-titel">
  <h2 class="kopf" id="fragen-titel">
    <span>{t('fragen.titel')}</span>
    <small>{t('fragen.zaehler', { ab: abgehakt, alle: liste.fragen.length })}</small>
  </h2>
  <p class="satz">{t('fragen.satz')}</p>
  {#if liste.weg.length}
    <p class="weg">
      {t('fragen.weg', {
        themen: liste.weg.map((th) => t(`fragen.thema.${th}` as TextSchluessel)).join(', '),
      })}
    </p>
  {/if}
  <div class="blatt">
    {#each liste.fragen as f (f.id)}
      {@const e = eintrag(f.id)}
      {@const frage = text(f)}
      <div class="zeile" class:ab={e.ab}>
        <button
          class="kasten"
          type="button"
          role="checkbox"
          aria-checked={e.ab}
          aria-label={frage}
          onclick={() => haken(f)}
          ><span class="k" aria-hidden="true"
            >{#if e.ab}<Symbol name="haken" groesse={16} />{/if}</span
          ></button
        >
        <div class="tx">
          {#if f.offen}<small class="etikett offen"
              >{t(ihr ? 'fragen.offenIhr' : 'fragen.offenDu')}</small
            >{:else if f.thema === 'eigen'}<small class="etikett">{t('fragen.eigenEtikett')}</small
            >{/if}
          <span class="frage" aria-hidden="true">{frage}</span>
          {#if schreibt === f.id}
            <textarea
              bind:this={feld}
              bind:value={entwurf}
              rows="2"
              aria-label={t('fragen.antwortLabel', { frage })}
              onblur={() => antwortSichern(f)}></textarea>
          {:else if e.antwort}
            <button
              class="antwort"
              type="button"
              aria-label={t('fragen.antwortAendern', { antwort: e.antwort })}
              onclick={() => notieren(f)}>{e.antwort}</button
            >
          {:else}
            <button class="notieren" type="button" onclick={() => notieren(f)}
              ><Symbol name="plus" groesse={16} /><span>{t('fragen.antwortNotieren')}</span></button
            >
          {/if}
        </div>
      </div>
    {/each}
    {#if neuOffen}
      <form
        class="neu"
        onsubmit={(ev) => {
          ev.preventDefault();
          void eigeneHinzufuegen();
        }}
      >
        <input
          bind:this={neuFeld}
          bind:value={neueFrage}
          maxlength="140"
          autocomplete="off"
          enterkeyhint="done"
          aria-label={t('fragen.eigeneFrage')}
        />
        <button class="hinzu" type="submit">{t('fragen.eigeneHinzufuegen')}</button>
      </form>
    {:else}
      <button class="plus" type="button" onclick={eigeneOeffnen}
        ><Symbol name="plus" groesse={20} /><span>{t('fragen.eigeneFrage')}</span></button
      >
    {/if}
  </div>
  <p class="klein">{t('fragen.eigeneSatz')}</p>
</section>

<style>
  .fragen {
    margin-top: 26px;
  }

  .kopf {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    margin: 0 2px 4px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .kopf small {
    font-size: calc(13 * var(--px));
    font-weight: 600;
    letter-spacing: 0;
    text-transform: none;
    white-space: nowrap;
  }

  .satz,
  .weg,
  .klein {
    margin: 0 2px 8px;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: 1.4;
  }

  .klein {
    margin-top: 8px;
  }

  .blatt {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .zeile {
    display: flex;
    align-items: flex-start;
    gap: 4px;
    padding: 6px 14px 6px 4px;
    border-bottom: 1px solid var(--line);
  }

  .kasten {
    display: grid;
    flex: none;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    background: none;
    cursor: pointer;
  }

  .k {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border: 2px solid var(--ink-muted);
    border-radius: 7px;
    background: var(--surface);
    color: var(--ground);
  }

  .ab .k {
    border-color: var(--ink);
    background: var(--ink);
  }

  .tx {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
    padding-top: 10px;
  }

  .etikett {
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 650;
  }

  .etikett.offen {
    color: var(--knapp-text);
  }

  .frage {
    line-height: 1.4;
  }

  .ab .frage {
    color: var(--ink-muted);
  }

  .notieren,
  .antwort,
  .plus {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .antwort {
    margin-left: 12px;
    color: var(--ink);
    font-weight: 500;
  }

  textarea,
  .neu input {
    box-sizing: border-box;
    width: 100%;
    margin: 6px 0 8px;
    padding: 10px 12px;
    border: 1px solid var(--line-strong);
    border-radius: 12px;
    background: var(--ground);
    color: var(--ink);
    font: inherit;
  }

  textarea {
    resize: vertical;
  }

  .plus {
    padding: 4px 14px;
  }

  .neu {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
  }

  .neu input {
    flex: 1;
    min-width: 0;
    margin: 0;
  }

  .hinzu {
    flex: none;
    min-height: 44px;
    padding: 0 16px;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
</style>
