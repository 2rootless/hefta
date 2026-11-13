<script lang="ts">
  // Fragen für die Besichtigung (E52, B17c Abschnitt 3, B21 `x-fragen`): Liste zum Abhaken vor Ort, mit
  // „Antwort notieren“ unter jeder Frage. Mit Antwort steht diese eingerückt darunter, die Frage wird grau.
  // Eigene Fragen kommen ans Ende und gehören zum Gerät. Alles bleibt im Heft, nichts wird exportiert.
  // Ausblenden (E92, B25 n1 Abschnitt 4, Planung 12x): drei Punkte an jeder Frage öffnen ein kleines Menü.
  // Fragen von Hefta: „Ausblenden, auch in neuen Heften“ (Gerät, ab jetzt angelegte Hefte) oder „Nur in
  // diesem Heft ausblenden“ (am Heft). Eigene Fragen: bearbeiten oder entfernen. Danach eine Meldung mit
  // „Rückgängig“, etwa 6 Sekunden. Am Ende der Liste lassen sich ausgeblendete Fragen wieder zeigen.
  import { tick } from 'svelte';
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { route } from '../app/router.svelte';
  import {
    besichtigungsFragen,
    KEINE_FRAGEN,
    tierFrage,
    type Frage,
    type HeftFragen,
    type Thema,
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
      ausgeblendet: {
        hier: gespeichert.ausgeblendet ?? [],
        neu: daten.einstellungen?.ausgeblendeteFragen ?? [],
        heftAngelegt: heft.createdAt,
      },
      antworten: gespeichert.antworten,
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

  /** Meldungen nach dem Ausblenden und Entfernen: etwa 6 Sekunden, nicht weniger (B25a, B25 n1). */
  const MELDUNG_MS = 6000;

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

  // Menü an einer Frage: welche offen ist.
  let menue = $state<string | null>(null);

  function beantwortet(id: string): boolean {
    const a = gespeichert.antworten[id];
    return !!a && (a.ab || !!a.antwort.trim());
  }

  /** Stand vor einer Änderung, für „Rückgängig“. */
  function vorher() {
    return {
      heft: $state.snapshot(gespeichert),
      geraet: $state.snapshot(daten.einstellungen?.ausgeblendeteFragen ?? []),
      eigene: $state.snapshot(daten.einstellungen?.eigeneFragen ?? []),
    };
  }

  function rueckgaengig(text: string, alt: ReturnType<typeof vorher>) {
    rueckgaengigAnbieten({
      text,
      seite: route.pfad,
      dauerMs: MELDUNG_MS,
      ausfuehren: async () => {
        await einstellungenAendern(await db(), {
          ausgeblendeteFragen: alt.geraet,
          eigeneFragen: alt.eigene,
        });
        await sichern(alt.heft);
      },
    });
  }

  async function ausblenden(thema: Thema, auchNeu: boolean) {
    menue = null;
    const alt = vorher();
    // Schon beantwortet: Die Frage bleibt hier stehen, das Ausblenden gilt nur für neue Hefte. Menü und
    // Meldung sagen das dann genau (Design, nach B25 n1).
    const nurNeue = beantwortet(thema);
    if (!nurNeue && !(gespeichert.ausgeblendet ?? []).includes(thema))
      await sichern({ ...gespeichert, ausgeblendet: [...(gespeichert.ausgeblendet ?? []), thema] });
    if (auchNeu) {
      const geraet = $state
        .snapshot(daten.einstellungen?.ausgeblendeteFragen ?? [])
        .filter((a) => a.thema !== thema);
      await einstellungenAendern(await db(), {
        ausgeblendeteFragen: [...geraet, { thema, seit: new Date().toISOString() }],
      });
      await stillLaden();
    }
    rueckgaengig(
      t(nurNeue ? 'fragen.meldungFuerNeue' : auchNeu ? 'fragen.meldungNeu' : 'fragen.meldungHier'),
      alt,
    );
  }

  async function wiederZeigen(thema: Thema) {
    // Hebt beides auf: hier und für neue Hefte (B25 n1).
    await einstellungenAendern(await db(), {
      ausgeblendeteFragen: $state
        .snapshot(daten.einstellungen?.ausgeblendeteFragen ?? [])
        .filter((a) => a.thema !== thema),
    });
    await sichern({
      ...gespeichert,
      ausgeblendet: (gespeichert.ausgeblendet ?? []).filter((th) => th !== thema),
    });
  }

  let versteckteOffen = $state(false);

  /** Eine eigene Frage entfernen: aus dem Gerät und aus diesem Heft, mit „Rückgängig“. */
  async function entfernen(f: Frage) {
    menue = null;
    if (!f.text) return;
    const alt = vorher();
    const ohne = (liste: string[]) => liste.filter((x) => x.trim() !== f.text);
    await einstellungenAendern(await db(), {
      eigeneFragen: ohne(daten.einstellungen?.eigeneFragen ?? []),
    });
    await sichern({ ...gespeichert, eigene: ohne(gespeichert.eigene) });
    rueckgaengig(t('fragen.meldungEntfernt'), alt);
  }

  // Eine eigene Frage wird bearbeitet.
  let bearbeitet = $state<string | null>(null);
  let bearbeitetText = $state('');
  let bearbeitetFeld: HTMLInputElement | undefined = $state();

  async function bearbeiten(f: Frage) {
    menue = null;
    bearbeitet = f.id;
    bearbeitetText = f.text ?? '';
    await tick();
    bearbeitetFeld?.focus();
  }

  async function bearbeitenSichern(f: Frage) {
    const roh = bearbeitetText.trim().slice(0, 140);
    bearbeitet = null;
    if (!roh || !f.text) return;
    const neu = /[?.!]$/.test(roh) ? roh : `${roh}?`;
    if (neu === f.text) return;
    const tausch = (liste: string[]) => liste.map((x) => (x.trim() === f.text ? neu : x));
    await einstellungenAendern(await db(), {
      eigeneFragen: tausch(daten.einstellungen?.eigeneFragen ?? []),
    });
    // Häkchen und Antwort gehen mit.
    const antworten = { ...gespeichert.antworten };
    const bisher = antworten[f.id];
    if (bisher) {
      antworten[`eigen:${neu}`] = bisher;
      delete antworten[f.id];
    }
    await sichern({ ...gespeichert, eigene: tausch(gespeichert.eigene), antworten });
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

<svelte:window
  onclick={(ev) => {
    if (menue && !(ev.target as Element).closest('.menuewrap')) menue = null;
  }}
  onkeydown={(ev) => {
    if (ev.key === 'Escape') menue = null;
  }}
/>

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
          {#if bearbeitet === f.id}
            <form
              class="neu bearbeiten"
              onsubmit={(ev) => {
                ev.preventDefault();
                void bearbeitenSichern(f);
              }}
            >
              <input
                bind:this={bearbeitetFeld}
                bind:value={bearbeitetText}
                maxlength="140"
                autocomplete="off"
                enterkeyhint="done"
                aria-label={t('fragen.bearbeitenLabel')}
              />
              <button class="hinzu" type="submit">{t('fragen.uebernehmen')}</button>
            </form>
          {:else}
            <span class="frage" aria-hidden="true">{frage}</span>
          {/if}
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
        <div class="menuewrap">
          <button
            class="punkte"
            type="button"
            aria-label={t('fragen.mehr')}
            aria-haspopup="menu"
            aria-expanded={menue === f.id}
            onclick={() => (menue = menue === f.id ? null : f.id)}
            ><svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"
              ><circle cx="4" cy="10" r="1.8" /><circle cx="10" cy="10" r="1.8" /><circle
                cx="16"
                cy="10"
                r="1.8"
              /></svg
            ></button
          >
          {#if menue === f.id}
            <div class="menue" role="menu">
              {#if f.thema === 'eigen'}
                <button role="menuitem" type="button" onclick={() => bearbeiten(f)}
                  >{t('fragen.bearbeiten')}</button
                >
                <button role="menuitem" type="button" onclick={() => entfernen(f)}
                  >{t('fragen.entfernen')}</button
                >
              {:else}
                <button
                  role="menuitem"
                  type="button"
                  onclick={() => ausblenden(f.thema as Thema, true)}
                  >{t(
                    beantwortet(f.id) ? 'fragen.ausblendenFuerNeue' : 'fragen.ausblendenNeu',
                  )}</button
                >
                {#if !beantwortet(f.id)}
                  <button
                    role="menuitem"
                    type="button"
                    onclick={() => ausblenden(f.thema as Thema, false)}
                    >{t('fragen.ausblendenHier')}</button
                  >
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      </div>
    {/each}
    {#if liste.versteckt.length}
      <button
        class="plus versteckt-knopf"
        type="button"
        aria-expanded={versteckteOffen}
        onclick={() => (versteckteOffen = !versteckteOffen)}
        >{t('fragen.wiederZeigenAnzahl', { anzahl: liste.versteckt.length })}</button
      >
      {#if versteckteOffen}
        <ul class="versteckt">
          {#each liste.versteckt as v (v.thema)}
            {@const frage = text({ id: v.thema, thema: v.thema, offen: false, text: null })}
            <li>
              <span class="frage">{frage}</span>
              {#if v.auchNeu}<small>{t('fragen.auchNeu')}</small>{/if}
              <button
                class="notieren"
                type="button"
                aria-label={`${t('fragen.wiederZeigen')}: ${frage}`}
                onclick={() => wiederZeigen(v.thema)}>{t('fragen.wiederZeigen')}</button
              >
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
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

  /* 44 px hoch zum Tippen, aber schmaler: mehr Platz für die Frage bei 320 px (Prüfkatalog C21). */
  .kasten {
    display: grid;
    flex: none;
    place-items: center;
    width: 36px;
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

  .menuewrap {
    position: relative;
    flex: none;
  }

  .punkte {
    display: grid;
    place-items: center;
    width: 36px;
    height: 44px;
    margin-right: -10px;
    border: 0;
    background: none;
    color: var(--ink-muted);
    cursor: pointer;
  }

  .punkte svg {
    fill: currentColor;
  }

  .menue {
    position: absolute;
    z-index: 5;
    top: 40px;
    right: -6px;
    display: flex;
    flex-direction: column;
    min-width: 240px;
    padding: 6px 0;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    box-shadow: var(--shadow-card);
  }

  .menue button {
    min-height: 44px;
    padding: 0 16px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    text-align: left;
    cursor: pointer;
  }

  .versteckt-knopf {
    border-top: 1px solid var(--line);
  }

  .versteckt {
    margin: 0;
    padding: 0 14px 8px 48px;
    list-style: none;
  }

  .versteckt li {
    display: flex;
    flex-direction: column;
    padding: 8px 0 0;
    color: var(--ink-muted);
  }

  .versteckt small {
    font-size: calc(12 * var(--px));
  }

  .bearbeiten {
    padding: 0;
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
