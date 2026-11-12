<script lang="ts">
  // „Netto des Haushalts“ (B23 `#s=netto`): was im Monat zusammen hereinkommt, vorbelegt mit der Summe aus
  // den Selbstauskünften. Änderbar, etwa für Kindergeld; die Zahl bleibt in Hefta und kommt nicht in die
  // Mappe. „Auf … zurücksetzen“, sobald sie von der Summe abweicht.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
  import { nettoAusSelbstauskuenften } from '../domain/netto';
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
  const ausSa = $derived(nettoAusSelbstauskuenften(ansicht?.mitglieder ?? []));
  const eur = (n: number) => `${new Intl.NumberFormat('de-DE').format(n)}${NB}€`;

  let eingabe = $state('');
  let von = $state<string | null>(null);
  $effect(() => {
    if (hh && von !== hh.id) {
      const n = hh.netto ?? ausSa.summe;
      eingabe = n != null ? new Intl.NumberFormat('de-DE').format(n) : '';
      von = hh.id;
    }
  });
  const wert = $derived(eingabe.trim() ? zahl(eingabe.replace(/[€\s]/g, '')) : null);

  async function uebernehmen() {
    if (!hh) return;
    // Gleich der Summe: nichts Eigenes speichern, damit spätere Änderungen der Selbstauskunft greifen.
    const netto = wert != null && wert !== ausSa.summe ? wert : null;
    await haushaltAendern(await db(), hh.id, { netto });
    await stillLaden();
    zurueckGehen('/wuensche');
  }
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href="#/wuensche" text={t('wuensche.zurueck')} />
  </header>
  <h1 class="h2">{t('wuensche.netto')}</h1>
  <p class="sub">{t('wuensche.nettoSub')}</p>

  <div class="feld">
    <label class="visually-hidden" for="netto">{t('wuensche.netto')}</label>
    <input id="netto" inputmode="decimal" autocomplete="off" bind:value={eingabe} />
    <span aria-hidden="true">€</span>
  </div>
  <p class="nm"><Symbol name="schloss" groesse={16} />{t('wuensche.nichtInMappe')}</p>

  {#if ausSa.teile.length}
    <h2 class="h3">{t('wuensche.ausSelbstauskuenften')}</h2>
    <div class="blatt">
      {#each ausSa.teile as p (p.id)}
        <div class="nq">
          <span class="kch" style={`--person: var(--person-${p.farbe})`} aria-hidden="true"></span>
          <span>{p.name}</span><b>{eur(p.betrag)}</b>
        </div>
      {/each}
      <div class="nq summe">
        <span>{t('wuensche.zusammen')}</span><b>{eur(ausSa.summe ?? 0)}</b>
      </div>
    </div>
    <p class="klein">{t(ihr ? 'wuensche.nettoKleinIhr' : 'wuensche.nettoKleinDu')}</p>
    {#if ausSa.summe != null && wert !== ausSa.summe}
      <button
        class="leis"
        type="button"
        onclick={() => (eingabe = new Intl.NumberFormat('de-DE').format(ausSa.summe!))}
        >{t('wuensche.zuruecksetzenAuf', { betrag: eur(ausSa.summe) })}</button
      >
    {/if}
  {/if}

  <div class="cta">
    <Hauptbutton text={t('merkmal.uebernehmen')} onclick={uebernehmen} />
  </div>
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

  .feld {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 52px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
    font-size: calc(18 * var(--px));
    font-weight: 650;
  }

  .feld:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .feld input {
    flex: 1;
    min-width: 0;
    padding: 12px 0;
    border: 0;
    outline: 0;
    background: none;
    color: var(--ink);
    font: inherit;
  }

  .nm {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 8px 2px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .h3 {
    margin: 22px 2px 8px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .blatt {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .nq {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 14px;
    border-top: 1px solid var(--line);
  }

  .nq:first-child {
    border-top: 0;
  }

  .nq span:not(.kch) {
    flex: 1;
  }

  .nq.summe {
    font-weight: 650;
  }

  .kch {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--person);
  }

  /* Feste Leiste (B23 F2): Ihr Übergang deckt sonst den letzten Satz. */
  .klein {
    margin: 10px 2px 28px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .leis {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    margin-top: 6px;
    border: 0;
    background: none;
    color: var(--accent-text);
    font: inherit;
    font-weight: 600;
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
