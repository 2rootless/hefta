<script lang="ts">
  // „Was sucht ihr?“ (B23 `#s=wuensche`, Zeile 5 des Bauplans): einmal festlegen, Hefta vergleicht jede
  // Wohnung damit, Kriterium für Kriterium, ohne Gesamtnote. Jeder Wunsch ist freiwillig; fehlt er, gibt es
  // dafür kein Urteil. Darunter „Nur für euch“: Netto des Haushalts und eine eigene Grenze für die Miete;
  // beides kommt nicht in die Mappe. „Wo“ (Stadtteile) kommt mit der Stadtkarte in Schritt 2.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
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

  /** Wünsche und Grenze direkt speichern (B28b: Felder statt Zeilen zum Aufklappen). */
  // Nacheinander und immer auf dem gespeicherten Stand: Zwei schnelle Änderungen (Warmmiete, gleich danach
  // ein Zimmer-Chip) überschrieben sonst die erste mit dem alten Stand der Seite.
  let reihe: Promise<void> = Promise.resolve();
  function speichern(neu: Partial<Wuensche>, mietgrenze?: number | null): Promise<void> {
    const id = hh?.id;
    if (!id) return reihe;
    reihe = reihe
      .then(async () => {
        const d = await db();
        const frisch = await d.get('haushalte', id);
        await haushaltAendern(d, id, {
          wuensche: { ...LEER, ...(frisch?.wuensche ?? {}), ...neu },
          mietgrenze: mietgrenze === undefined ? (frisch?.mietgrenze ?? null) : mietgrenze,
        });
        await stillLaden();
      })
      .catch((f: unknown) => {
        // Der nächste Schritt soll trotzdem laufen; den Fehler meldet der Kasten für Unerwartetes.
        reportError(f);
      });
    return reihe;
  }

  // Zimmer (PC9, B28b): Die Reihe „1 · 2 · 3 · 4 · 5“; neben der gewählten Zahl ein schmales „+ ½“, mit ihr
  // zu einer Fläche verbunden. Noch ein Tipp auf „+ ½“ nimmt es zurück, noch einer auf die Zahl den Wunsch.
  const zimmerGanz = $derived(wu.zimmerAb != null ? Math.floor(wu.zimmerAb) : null);
  const zimmerHalb = $derived(wu.zimmerAb != null && wu.zimmerAb % 1 !== 0);
  function zimmerWaehlen(n: number) {
    void speichern({ zimmerAb: zimmerGanz === n ? null : n });
  }
  function zimmerHalbWaehlen() {
    if (zimmerGanz === null) return;
    void speichern({ zimmerAb: zimmerHalb ? zimmerGanz : zimmerGanz + 0.5 });
  }

  /** Text vor und nach dem Platzhalter eines Wortlauts, für ein Feld mitten im Satz. */
  function teile(text: string): [string, string] {
    const i = text.indexOf('\u0000');
    return i < 0 ? [text, ''] : [text.slice(0, i).trim(), text.slice(i + 1).trim()];
  }
  const warmTeile = $derived(teile(t('wuensche.warmWert', { betrag: '\u0000' })));
  const grenzeTeile = $derived(teile(t('wuensche.grenzeWert', { wert: '\u0000' })));
  const flaecheTeile = $derived(teile(t('wuensche.ab', { wert: '\u0000' })));
  const feldWert = (n: number | null | undefined) => (n != null ? zahlText(n) : '');

  /** Haustiere folgen der Selbstauskunft (DP16, DP21); der Weg dorthin führt zur ersten Person. */
  const selbstauskunftZiel = $derived.by(() => {
    const m = ansicht?.mitglieder.find((x) => x.zugehoerigkeit.rolle !== 'buerge');
    return m ? `#/selbstauskunft/${m.person.id}` : '#/';
  });

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

  interface Zeile {
    k: Schluessel;
    name: string;
    wert: string | null;
    klein?: string;
  }
  const zeilen = $derived<Zeile[]>([
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

    <!-- B28b (DP21): jeder Wunsch eine weiche Fläche, das Feld steht im Satz. -->
    <div class="feld">
      <label class="name" for="w-warm">{t('wuensche.warmName')}</label>
      <div class="wert">
        <span>{warmTeile[0]}</span>
        <input
          id="w-warm"
          inputmode="decimal"
          value={feldWert(wu.warmBis)}
          onchange={(e) => speichern({ warmBis: nummer(e.currentTarget.value) })}
        /><span>{warmTeile[1]}</span>
      </div>
    </div>

    <div class="feld">
      <label class="name" for="w-grenze">{t('wuensche.grenzeName')}</label>
      <div class="wert">
        <span>{grenzeTeile[0]}</span>
        <input
          id="w-grenze"
          inputmode="decimal"
          value={feldWert(hh.mietgrenze)}
          onchange={(e) => speichern({}, nummer(e.currentTarget.value))}
        /><span>{grenzeTeile[1]}</span>
      </div>
      {#if netto == null}
        <p class="satz">
          {t(ihr ? 'wuensche.nettoLeerIhr' : 'wuensche.nettoLeerDu')}
          {t('wuensche.grenzeKlein')}
        </p>
      {:else}
        <p class="satz">{t('wuensche.grenzeSatz')}</p>
        <div class="aus">
          <span
            >{t('wuensche.einkommen')}<br /><b
              >{t('wuensche.einkommenWert', { betrag: eur(netto) })}</b
            ></span
          >
          <a class="link" href="#/wuensche/netto">{t('allgemein.aendern')}</a>
        </div>
        <p class="klein">
          {ausSa.teile.length > 1 || ihr
            ? t('wuensche.nettoAusIhr', {
                namen: ausSa.teile.map((x) => x.name).join(` ${t('wuensche.und')} `),
              })
            : t('wuensche.nettoAusDu')}
          {t('wuensche.nichtInMappe')}
        </p>
      {/if}
    </div>

    <div class="feld">
      <p class="name" id="w-zimmer-l">{t('wuensche.zimmer')}</p>
      <div class="chips" role="group" aria-labelledby="w-zimmer-l">
        {#each [1, 2, 3, 4, 5] as n (n)}
          {#if zimmerGanz === n}
            <span class="paar">
              <button
                class="chip an"
                type="button"
                aria-pressed="true"
                aria-label={t('wuensche.ab', { wert: zahlText(n) })}
                onclick={() => zimmerWaehlen(n)}>{n}</button
              ><button
                class="chip halb"
                class:an={zimmerHalb}
                type="button"
                aria-pressed={zimmerHalb}
                aria-label={t('wuensche.zimmerHalbAnsage')}
                onclick={zimmerHalbWaehlen}>{t('wuensche.zimmerHalb')}</button
              >
            </span>
          {:else}
            <button
              class="chip"
              type="button"
              aria-pressed="false"
              aria-label={t('wuensche.ab', { wert: zahlText(n) })}
              onclick={() => zimmerWaehlen(n)}>{n}</button
            >
          {/if}
        {/each}
      </div>
      <p class="satz">
        {wu.zimmerAb != null
          ? t('wuensche.zimmerAb', { zahl: zahlText(wu.zimmerAb) })
          : t('wuensche.nichtFestgelegt')}
      </p>
    </div>

    <div class="feld">
      <label class="name" for="w-flaeche">{t('wuensche.flaeche')}</label>
      <div class="wert">
        <span>{flaecheTeile[0]}</span>
        <input
          id="w-flaeche"
          inputmode="decimal"
          value={feldWert(wu.flaecheAb)}
          onchange={(e) => speichern({ flaecheAb: nummer(e.currentTarget.value) })}
        /><span>m²</span>
      </div>
    </div>

    <div class="feld">
      <p class="name">{t('wuensche.haustiere')}</p>
      {#if hh.haustiere === 'ja'}
        <p class="satz tier">
          {t('wuensche.tiereAngegeben', {
            tier: hh.haustiereText?.trim() || t('wuensche.tiereJa'),
          })}
        </p>
        <a class="link" href={selbstauskunftZiel}>{t('wuensche.tiereAendern')}</a>
      {:else if hh.haustiere === 'nein'}
        <p class="satz tier">{t('wuensche.haustiere')}: {t('wuensche.tiereNein')}</p>
        <a class="link" href={selbstauskunftZiel}>{t('wuensche.tiereAendern')}</a>
      {:else}
        <p class="satz tier">{t('wuensche.tiereFrage')}</p>
        <a class="link" href={selbstauskunftZiel}>{t('wuensche.tiereAngeben')}</a>
      {/if}
    </div>

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
        <span class="l">{t('wuensche.befristung')}</span><span class="v"
          >{t('wuensche.nurUnbefristet')}</span
        >
      </div>
    </div>

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

  /* Felder (B28b, DP21): weiche Fläche, das Feld im Satz, Einheit direkt daneben. */
  .feld {
    margin: 0 0 12px;
    padding: 14px 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .feld .name {
    display: block;
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .feld .wert {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 8px;
    margin-top: 6px;
    font-size: calc(22 * var(--px));
    font-weight: 720;
  }

  .feld .wert span {
    color: var(--ink-muted);
    font-size: calc(16 * var(--px));
    font-weight: 600;
  }

  .feld .wert input {
    box-sizing: border-box;
    width: 4.2em;
    min-height: 44px;
    padding: 6px 10px;
    border: 0;
    border-radius: 12px;
    background: var(--ground);
    color: inherit;
    font: inherit;
  }

  .feld .satz {
    margin: 8px 0 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .feld .satz.tier {
    color: var(--ink);
    font-size: calc(15 * var(--px));
  }

  .feld .klein {
    margin: 6px 0 0;
    color: var(--ink-quiet);
    font-size: calc(13 * var(--px));
  }

  .feld .link {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    color: var(--accent-text);
    font-size: calc(14 * var(--px));
    font-weight: 600;
    text-decoration: none;
  }

  .feld .aus {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
    box-shadow: 0 -1px 0 var(--line);
    font-size: calc(14.5 * var(--px));
  }

  .feld .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  .feld .chip {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 48px;
    height: 48px;
    padding: 0 12px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--ground);
    color: var(--ink);
    font: inherit;
    font-size: calc(17 * var(--px));
    font-weight: 650;
    cursor: pointer;
  }

  .feld .chip.an,
  .feld .chip.halb.an {
    box-shadow: none;
    background: var(--action);
    color: var(--on-action);
  }

  .feld .chip.halb {
    min-width: 44px;
    padding: 0 10px;
    box-shadow: inset 0 0 0 1.5px var(--line-strong);
    background: transparent;
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
  }

  .paar {
    display: inline-flex;
    gap: 2px;
  }

  .paar .chip.an:first-child {
    border-radius: var(--radius-full) 6px 6px var(--radius-full);
  }

  .paar .chip.halb {
    border-radius: 6px var(--radius-full) var(--radius-full) 6px;
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
