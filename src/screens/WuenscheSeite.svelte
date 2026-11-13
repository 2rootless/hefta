<script lang="ts">
  // „Was sucht ihr?“ (B23 `#s=wuensche`, Zeile 5 des Bauplans): einmal festlegen, Hefta vergleicht jede
  // Wohnung damit, Kriterium für Kriterium, ohne Gesamtnote. Jeder Wunsch ist freiwillig; fehlt er, gibt es
  // dafür kein Urteil. Darunter „Nur für euch“: Netto des Haushalts und eine eigene Grenze für die Miete;
  // beides kommt nicht in die Mappe. „Wo“ (Stadtteile) kommt mit der Stadtkarte in Schritt 2.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { gehe, zurueckGehen } from '../app/router.svelte';
  import { haushaltsNetto, nettoAusSelbstauskuenften } from '../domain/netto';
  import type { Wuensche } from '../domain/urteile';
  import { t } from '../i18n';
  import { zahl } from '../lesen/leser';
  import { haushaltAendern } from '../storage/speicher';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const NB = ' ';
  const ansicht = $derived(daten.ansicht);
  const hh = $derived(ansicht?.haushalt ?? null);
  const ihr = $derived(
    !ansicht || ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const LEER: Wuensche = {
    warmBis: null,
    zimmerAb: null,
    flaecheAb: null,
    ort: null,
    einzugVon: null,
    einzugBis: null,
  };
  const wu = $derived<Wuensche>({ ...LEER, ...(hh?.wuensche ?? {}) });
  const ausSa = $derived(nettoAusSelbstauskuenften(ansicht?.mitglieder ?? []));
  const netto = $derived(hh ? haushaltsNetto(hh, ansicht?.mitglieder ?? []) : null);

  const eur = (n: number) => `${new Intl.NumberFormat('de-DE').format(n)}${NB}€`;
  const zahlText = (n: number) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);
  const tag = (d: string) =>
    new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short', year: 'numeric' }).format(
      new Date(`${d}T12:00`),
    );

  type Schluessel = 'warm' | 'zimmer' | 'flaeche' | 'weg' | 'einzug' | 'grenze';
  let offen = $state<Schluessel | null>(null);
  let e1 = $state('');
  let e2 = $state('');
  /** Postleitzahl des eigenen Orts (E46): daraus die Luftlinie, nur auf dem Gerät. */
  let e3 = $state('');

  function oeffnen(k: Schluessel) {
    offen = k;
    const zahlOderLeer = (n: number | null | undefined) => (n != null ? zahlText(n) : '');
    e2 = '';
    e3 = '';
    if (k === 'warm') e1 = zahlOderLeer(wu.warmBis);
    if (k === 'zimmer') e1 = zahlOderLeer(wu.zimmerAb);
    if (k === 'flaeche') e1 = zahlOderLeer(wu.flaecheAb);
    if (k === 'grenze') e1 = zahlOderLeer(hh?.mietgrenze);
    if (k === 'weg') {
      e1 = wu.ort?.name ?? '';
      e2 = wu.ort ? zahlText(wu.ort.kmBis) : '';
      e3 = wu.ort?.plz ?? '';
    }
    if (k === 'einzug') {
      e1 = wu.einzugVon ?? '';
      e2 = wu.einzugBis ?? '';
    }
  }

  const nummer = (s: string) => (s.trim() ? zahl(s.replace(/[€%m²\s]/g, '')) : null);

  async function uebernehmen(k: Schluessel) {
    if (!hh) return;
    const neu: Wuensche = { ...wu };
    let mietgrenze = hh.mietgrenze ?? null;
    if (k === 'warm') neu.warmBis = nummer(e1);
    if (k === 'zimmer') neu.zimmerAb = nummer(e1);
    if (k === 'flaeche') neu.flaecheAb = nummer(e1);
    if (k === 'weg') {
      const km = nummer(e2);
      const plz = e3.replace(/\D/g, '');
      neu.ort =
        e1.trim() && km
          ? { name: e1.trim(), kmBis: km, ...(plz.length === 5 ? { plz } : {}) }
          : null;
    }
    if (k === 'einzug') {
      neu.einzugVon = /^\d{4}-\d{2}-\d{2}$/.test(e1) ? e1 : null;
      neu.einzugBis = /^\d{4}-\d{2}-\d{2}$/.test(e2) ? e2 : null;
    }
    if (k === 'grenze') mietgrenze = nummer(e1);
    await haushaltAendern(await db(), hh.id, { wuensche: neu, mietgrenze });
    await stillLaden();
    offen = null;
  }

  const einzugText = $derived.by(() => {
    // Im selben Jahr steht das Jahr nur einmal: „1. Jan. bis 1. März 2027“ (E84.4).
    if (wu.einzugVon && wu.einzugBis) {
      const gleich = wu.einzugVon.slice(0, 4) === wu.einzugBis.slice(0, 4);
      return t('wuensche.einzugVonBis', {
        von: gleich ? tagOhneJahr(wu.einzugVon) : tag(wu.einzugVon),
        bis: tag(wu.einzugBis),
      });
    }
    if (wu.einzugVon) return t('wuensche.einzugAb', { von: tag(wu.einzugVon) });
    if (wu.einzugBis) return t('wuensche.einzugBis', { bis: tag(wu.einzugBis) });
    return null;
  });
  const tagOhneJahr = (d: string) =>
    new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(
      new Date(`${d}T12:00`),
    );

  const tiereText = $derived(
    hh?.haustiere === 'ja'
      ? hh.haustiereText?.trim() || t('wuensche.tiereJa')
      : hh?.haustiere === 'nein'
        ? t('wuensche.tiereNein')
        : null,
  );

  interface Zeile {
    k: Schluessel;
    name: string;
    wert: string | null;
    klein?: string;
  }
  const zeilen = $derived<Zeile[]>([
    { k: 'warm', name: t('wuensche.warm'), wert: wu.warmBis != null ? eur(wu.warmBis) : null },
    {
      k: 'zimmer',
      name: t('wuensche.zimmer'),
      wert: wu.zimmerAb != null ? t('wuensche.ab', { wert: zahlText(wu.zimmerAb) }) : null,
    },
    {
      k: 'flaeche',
      name: t('wuensche.flaeche'),
      wert:
        wu.flaecheAb != null
          ? t('wuensche.ab', { wert: `${zahlText(wu.flaecheAb)}${NB}m²` })
          : null,
    },
    {
      k: 'weg',
      name: t('wuensche.weg'),
      wert: wu.ort?.name ?? null,
      klein: wu.ort ? t('wuensche.wegKlein', { km: zahlText(wu.ort.kmBis) }) : undefined,
    },
    { k: 'einzug', name: t('wuensche.einzug'), wert: einzugText },
  ]);
</script>

{#snippet wert(z: { wert: string | null })}
  {#if z.wert}<span class="v">{z.wert}</span>{:else}<span class="v offenwert"
      >{t('wuensche.nichtFestgelegt')}</span
    >{/if}
{/snippet}

{#snippet editor(k: Schluessel, name: string)}
  <form
    class="wz offen-z"
    onsubmit={(e) => {
      e.preventDefault();
      void uebernehmen(k);
    }}
  >
    <label class="l" for={`w-${k}`}>{name}</label>
    {#if k === 'weg'}
      <input id={`w-${k}`} placeholder={t('wuensche.wegOrt')} bind:value={e1} />
      <span class="mit-einheit">
        <input
          aria-label={t('wuensche.wegKm')}
          placeholder={t('wuensche.wegKm')}
          inputmode="decimal"
          bind:value={e2}
        /><span aria-hidden="true">km</span>
      </span>
      <input
        aria-label={t('wuensche.wegPlz')}
        placeholder={t('wuensche.wegPlz')}
        inputmode="numeric"
        autocomplete="postal-code"
        maxlength="5"
        bind:value={e3}
      />
      <p class="hilfe">{t('wuensche.wegPlzHilfe')}</p>
    {:else if k === 'einzug'}
      <label class="unter" for={`w-${k}`}>{t('wuensche.von')}</label>
      <input id={`w-${k}`} type="date" bind:value={e1} />
      <label class="unter" for={`w-${k}-bis`}>{t('wuensche.bis')}</label>
      <input id={`w-${k}-bis`} type="date" bind:value={e2} />
    {:else}
      <input id={`w-${k}`} inputmode="decimal" bind:value={e1} />
    {/if}
    <p class="hilfe">{t('wuensche.leerLassen')}</p>
    <button class="fertig" type="submit">{t('merkmal.uebernehmen')}</button>
  </form>
{/snippet}

<main class="seite">
  <header class="kopf">
    <Zurueck href="#/wohnungen" text={t('heft.zurueck')} />
  </header>

  {#if !hh}
    <p class="sub">{t('wuensche.ohneHaushalt')}</p>
  {:else}
    <h1 class="h2">{t(ihr ? 'wuensche.titelIhr' : 'wuensche.titelDu')}</h1>
    <p class="sub">{t('wuensche.sub')}</p>

    <div class="blatt">
      {#each zeilen as z (z.k)}
        {#if offen === z.k}
          {@render editor(z.k, z.name)}
        {:else}
          <button class="wz" type="button" onclick={() => oeffnen(z.k)}>
            <span class="l">{z.name}</span>{@render wert(z)}<span class="p"
              ><Symbol name="weiter" groesse={16} /></span
            >
            {#if z.klein}<small>{z.klein}</small>{/if}
          </button>
        {/if}
      {/each}
      <div class="wz fest">
        <span class="l">{t('wuensche.haustiere')}</span>
        <!-- Aus der Selbstauskunft, hier nicht festlegbar: „nicht angegeben“ (E84.4). -->
        {#if tiereText}<span class="v">{tiereText}</span>{:else}<span class="v offenwert"
            >{t('wuensche.nichtAngegeben')}</span
          >{/if}
        <small>{t(ihr ? 'wuensche.haustiereKleinIhr' : 'wuensche.haustiereKleinDu')}</small>
      </div>
      <div class="wz fest">
        <span class="l">{t('wuensche.befristung')}</span><span class="v"
          >{t('wuensche.nurUnbefristet')}</span
        >
      </div>
    </div>

    <h2 class="h3">
      <Symbol name="schloss" groesse={16} />{t(ihr ? 'wuensche.nurIhr' : 'wuensche.nurDu')}
    </h2>
    <div class="blatt">
      {#if ausSa.summe === null && hh.netto == null}
        <div class="wz fest">
          <span class="l">{t('wuensche.netto')}</span><span class="v">–</span>
          <small>{t(ihr ? 'wuensche.nettoLeerIhr' : 'wuensche.nettoLeerDu')}</small>
        </div>
      {:else}
        <button class="wz" type="button" onclick={() => gehe('/wuensche/netto')}>
          <span class="l">{t('wuensche.netto')}</span><span class="v"
            >{netto != null ? eur(netto) : '–'}</span
          ><span class="p"><Symbol name="weiter" groesse={16} /></span>
          <small
            >{ausSa.teile.length > 1 || ihr
              ? t('wuensche.nettoAusIhr', {
                  namen: ausSa.teile.map((x) => x.name).join(` ${t('wuensche.und')} `),
                })
              : t('wuensche.nettoAusDu')}</small
          >
          <small class="nm"
            ><Symbol name="schloss" groesse={16} />{t('wuensche.nichtInMappe')}</small
          >
        </button>
      {/if}
      {#if offen === 'grenze'}
        {@render editor('grenze', t('wuensche.grenze'))}
      {:else}
        <button class="wz" type="button" onclick={() => oeffnen('grenze')}>
          <span class="l">{t('wuensche.grenze')}</span>{@render wert({
            wert:
              hh.mietgrenze != null
                ? t('wuensche.grenzeWert', { wert: zahlText(hh.mietgrenze) })
                : null,
          })}<span class="p"><Symbol name="weiter" groesse={16} /></span>
          <small>{t('wuensche.grenzeKlein')}</small>
        </button>
      {/if}
    </div>
    <p class="klein">{t('wuensche.anteilSatz')}</p>

    <div class="cta">
      <Hauptbutton text={t('wuensche.fertig')} onclick={() => zurueckGehen('/wohnungen')} />
    </div>
  {/if}
</main>

<style>
  .seite {
    display: flex;
    flex-direction: column;
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) 0;
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  .sub {
    margin: 0 0 16px;
    color: var(--ink-muted);
  }

  .blatt {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .wz {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto auto;
    align-items: center;
    column-gap: 10px;
    width: 100%;
    min-height: 52px;
    padding: 10px 12px 10px 14px;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .wz:first-child {
    border-top: 0;
  }

  .wz.fest {
    grid-template-columns: minmax(0, 1fr) auto;
    cursor: default;
  }

  .l {
    font-weight: 600;
  }

  .v {
    color: var(--ink-muted);
    text-align: right;
  }

  .offenwert {
    color: var(--ink-quiet);
  }

  .p {
    display: flex;
    color: var(--ink-quiet);
  }

  .wz small {
    grid-column: 1 / -1;
    margin-top: 4px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: 1.35;
  }

  .wz small.nm {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .h3 {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 22px 2px 8px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  /* Feste Leiste (B23 F2): Ihr Übergang deckt sonst den letzten Satz. */
  .klein {
    margin: 10px 2px 28px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .offen-z {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    cursor: default;
  }

  .offen-z input {
    box-sizing: border-box;
    width: 100%;
    min-height: 48px;
    padding: 10px 12px;
    border: 1px solid var(--control-border);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
  }

  .mit-einheit {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .mit-einheit span {
    color: var(--ink-muted);
  }

  .unter,
  .hilfe {
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .fertig {
    align-self: flex-end;
    min-height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }

  .cta {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: auto calc(-1 * var(--space-4)) 0;
    padding: 28px var(--space-4) calc(env(safe-area-inset-bottom) + 16px);
    background: var(--ground);
    box-shadow: 0 -14px 14px -2px var(--ground);
  }
</style>
