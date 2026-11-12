<script lang="ts">
  // Ein Heft (B21 Fassung 4), erster Stand: Umschlag mit Titel, Adresse,
  // Eckdaten und Quelle, die Leiste „Stand x von 4“, die Besichtigung, Notizen und der Abgleich mit den
  // Wünschen. Fragen für die Besichtigung, Fotos und „Was hinausging“ kommen mit Schritt 8 und 9.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { eckdaten, heftAdresseKurz, heftTitel } from '../domain/heftKarte';
  import { stand, standNummer } from '../domain/heftStand';
  import { abweichungen, urteile } from '../domain/urteile';
  import { t, type TextSchluessel } from '../i18n';
  import { wohnungAus } from '../lesen/angaben';
  import { heftAendern } from '../storage/speicher';
  import TabLeiste from '../ui/TabLeiste.svelte';
  import TerminKarte from '../ui/TerminKarte.svelte';
  import UrteilZeichen from '../ui/UrteilZeichen.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const jetzt = new Date();
  const ihr = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );

  const st = $derived(heft ? stand(heft.ereignisse, jetzt) : 'gemerkt');
  const nummer = $derived(standNummer(st));

  const datum = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });

  const abgleich = $derived.by(() => {
    const a = heft?.angaben;
    const hh = daten.ansicht?.haushalt;
    if (!a || !hh?.wuensche) return null;
    const u = urteile(wohnungAus(a), hh.wuensche, { netto: hh.netto ?? null, grenze: null, ihr });
    return abweichungen(u);
  });

  let notiz = $state('');
  let notizVon = $state<string | null>(null);
  $effect(() => {
    // Beim Öffnen eines anderen Hefts die gespeicherte Notiz übernehmen, sonst nicht überschreiben.
    if (heft && notizVon !== heft.id) {
      notiz = heft.notiz;
      notizVon = heft.id;
    }
  });

  async function notizSichern() {
    if (!heft || notiz === heft.notiz) return;
    await heftAendern(await db(), heft.id, { notiz });
    await stillLaden();
  }
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href="#/wohnungen" text={t('heft.zurueck')} />
  </header>

  {#if !heft}
    <p class="fehlt">{t('heft.fehlt')}</p>
  {:else}
    {@const titel = heftTitel(heft)}
    {@const eck = eckdaten(heft)}
    {@const kommt = st === 'besichtigung'}
    <section class="umschlag" class:kommt class:abgelegt={st === 'abgelegt'}>
      <h1>{titel.text}</h1>
      {#if !titel.strasse}<p class="adr">{heftAdresseKurz(heft)}</p>{/if}
      <a class="merk" href={`#/heft/${heft.id}/merkmal`}
        >{t(
          heft.angaben?.merkmal
            ? 'heft.merkmalEigen'
            : heft.angaben?.titel
              ? 'heft.merkmalInserat'
              : 'heft.merkmalKeins',
        )} · <u>{t('heft.aendern')}</u></a
      >
      {#if eck}<p class="eck">{eck}</p>{/if}
      <p class="quelle">
        {heft.angaben?.portal
          ? t('heft.gefunden', {
              portal: heft.angaben.portal,
              datum: datum.format(new Date(heft.createdAt)),
            })
          : t('heft.gefundenAm', { datum: datum.format(new Date(heft.createdAt)) })}
        {#if heft.link}
          · <a href={heft.link} target="_blank" rel="noopener noreferrer"
            >{t('heft.inseratOeffnen')}</a
          >
        {/if}
      </p>
    </section>

    <section class="stand" class:kommt>
      <div
        class="leiste"
        role="img"
        aria-label={t('heft.standLabel', { stand: t(`heft.stand.${st}` as TextSchluessel) })}
      >
        <b>{t(`heft.stand.${st}` as TextSchluessel)}</b>
        <small>{t('heft.standVon', { nummer })}</small>
        <span class="seg" aria-hidden="true">
          {#each [1, 2, 3, 4] as n (n)}<i class:d={n < nummer} class:c={n === nummer}></i>{/each}
        </span>
      </div>
      {#if heft.ereignisse.termin}
        <TerminKarte {heft} {jetzt} titel={false} />
      {/if}
    </section>

    <section class="teil">
      <h2 class="fnh"><label for="notiz">{t('heft.notizen')}</label></h2>
      <textarea
        id="notiz"
        rows="3"
        placeholder={t(ihr ? 'heft.notizIhr' : 'heft.notizDu')}
        bind:value={notiz}
        onblur={notizSichern}></textarea>
    </section>

    {#if abgleich}
      <section class="teil">
        <h2>{t(ihr ? 'heft.wuenscheIhr' : 'heft.wuenscheDu')}</h2>
        <ul class="abw">
          {#each abgleich as z, i (i)}
            <li class={z.art}>
              {#if z.art === 'nicht' || z.art === 'knapp' || z.art === 'offen' || z.art === 'passt'}
                <UrteilZeichen art={z.art} groesse={16} /><span><b>{z.wort}:</b> {z.text}</span>
              {:else}
                <UrteilZeichen art="passt" groesse={16} /><span>{z.text}</span>
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</main>
<TabLeiste aktiv="wohnungen" />

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) calc(var(--tabs-hoehe, 72px) + 24px);
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  .fehlt {
    color: var(--ink-muted);
  }

  /* Umschlag (B16, B21 Fassung 4): Karte mit Rücken; der Rücken in der Terminfarbe, solange eine
     Besichtigung ansteht, abgelegt leise. */
  .umschlag {
    margin-top: 6px;
    padding: 0 0 14px;
    border: 1px solid var(--line);
    border-left: 5px solid var(--accent);
    border-radius: 10px 16px 16px 10px;
    background: var(--surface);
    box-shadow:
      4px 4px 0 -1px var(--surface),
      4px 4px 0 0 var(--line);
  }

  .umschlag.kommt {
    border-left-color: var(--termin);
  }

  .umschlag.abgelegt {
    border-left-color: var(--ink-quiet);
  }

  .umschlag > * {
    margin-right: 16px;
    margin-left: 16px;
  }

  .umschlag h1 {
    margin-top: 14px;
    margin-bottom: 0;
    font-size: calc(25 * var(--px));
    font-weight: 700;
    font-stretch: 108%;
    line-height: 1.12;
    letter-spacing: -0.01em;
    text-wrap: balance;
  }

  .adr {
    margin-top: 2px;
    margin-bottom: 0;
    font-size: calc(14 * var(--px));
  }

  .merk {
    display: block;
    min-height: 44px;
    padding: 12px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: 1.5;
    text-decoration: none;
  }

  .merk u {
    margin-left: 4px;
    color: var(--accent-text);
    text-underline-offset: 0.2em;
  }

  .eck {
    margin-top: 0;
    margin-bottom: 2px;
    color: var(--ink-muted);
  }

  .quelle {
    margin-top: 2px;
    margin-bottom: 0;
    color: var(--ink-quiet);
    font-size: calc(12 * var(--px));
  }

  .quelle a {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: inherit;
    text-decoration: underline;
  }

  /* Stand (B16 `x-stand`): eigene Karte; steht eine Besichtigung an, Überschrift und laufender Abschnitt
     in der Terminfarbe (B21 Fassung 4 `x8-kommt`). */
  .stand {
    display: flex;
    flex-direction: column;
    gap: 14px;
    margin-top: 18px;
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface);
  }

  .leiste {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 10px;
  }

  .leiste b {
    font-size: calc(20 * var(--px));
    font-weight: 700;
    font-stretch: 108%;
    line-height: 1.2;
  }

  .kommt .leiste b {
    color: var(--termin);
  }

  .leiste small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .seg {
    display: grid;
    flex-basis: 100%;
    grid-template-columns: repeat(4, 1fr);
    gap: 4px;
    margin-top: 8px;
  }

  .seg i {
    height: 6px;
    border: 1.4px solid var(--ink-quiet);
    border-radius: 3px;
  }

  .seg i.d {
    border-color: var(--ink);
    background: var(--ink);
  }

  .seg i.c {
    border-color: var(--accent);
    background: var(--accent);
  }

  .kommt .seg i.c {
    border-color: var(--termin);
    background: var(--termin);
  }

  .teil {
    margin-top: 26px;
  }

  .teil h2 {
    margin: 0 2px 8px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 650;
    line-height: 1.2;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 88px;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    resize: vertical;
  }

  .abw {
    margin: 0;
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    list-style: none;
  }

  .abw li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 4px 0;
    line-height: 1.4;
  }

  .abw li :global(svg) {
    margin-top: 3px;
  }

  .abw li.sonst,
  .abw li.alles {
    color: var(--ink-muted);
  }
</style>
