<script lang="ts">
  // „Stand selbst setzen“ (B23 `s=stand`, Zeile 9): vier Stände zur Wahl. „Gemerkt“ und „Beworben“ gelten
  // sofort, „Besichtigung“ führt zum Termin, „Ergebnis“ zur Frage, wie es ausgegangen ist. „Keine Antwort“
  // setzt nur Hefta (B16).
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { abschliessen, gehe } from '../app/router.svelte';
  import { heftTitel, zurueckZumHeft } from '../domain/heftKarte';
  import { stand, standSetzen } from '../domain/heftStand';
  import { t, type TextSchluessel } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const ihr = $derived(
    // Ohne Haushalt „ihr“ (E74.4, Design 12.11.), sonst ab zwei Personen ohne Bürgen.
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const jetzt = new Date();
  const aktuell = $derived.by(() => {
    if (!heft) return null;
    const s = stand(heft.ereignisse, jetzt);
    return s === 'keine_antwort' ? 'beworben' : s === 'abgelegt' ? 'ergebnis' : s;
  });

  type Wahl = 'gemerkt' | 'beworben' | 'besichtigung' | 'ergebnis';
  const WAHL: { wahl: Wahl; titel: TextSchluessel; sub: () => TextSchluessel }[] = [
    { wahl: 'gemerkt', titel: 'heft.stand.gemerkt', sub: () => 'standSetzen.gemerktSub' },
    { wahl: 'beworben', titel: 'heft.stand.beworben', sub: () => 'standSetzen.beworbenSub' },
    {
      wahl: 'besichtigung',
      titel: 'heft.stand.besichtigung',
      sub: () => (ihr ? 'standSetzen.besichtigungSubIhr' : 'standSetzen.besichtigungSubDu'),
    },
    { wahl: 'ergebnis', titel: 'standSetzen.ergebnis', sub: () => 'standSetzen.ergebnisSub' },
  ];

  async function waehlen(w: Wahl) {
    if (!heft) return;
    if (w === 'besichtigung') return gehe(`/heft/${heft.id}/termin`);
    if (w === 'ergebnis') return gehe(`/heft/${heft.id}/ergebnis`);
    await heftAendern(await db(), heft.id, {
      ereignisse: $state.snapshot(standSetzen(heft.ereignisse, w, new Date())),
    });
    await stillLaden();
    abschliessen(`/heft/${heft.id}`);
  }
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href={`#/heft/${id}`} text={zurueckZumHeft(heft) ?? t('standSetzen.zurueck')} />
  </header>

  {#if !heft}
    <p class="sub">{t('heft.fehlt')}</p>
  {:else}
    <h1 class="h2">{t('standSetzen.titel')}</h1>
    <p class="sub">{heftTitel(heft).text}</p>

    <div class="wahl">
      {#each WAHL as w (w.wahl)}
        <button
          class="sz"
          class:an={aktuell === w.wahl}
          type="button"
          aria-current={aktuell === w.wahl ? 'true' : undefined}
          onclick={() => waehlen(w.wahl)}
        >
          <span class="rad" aria-hidden="true"
            >{#if aktuell === w.wahl}<Symbol name="haken" groesse={16} />{/if}</span
          >
          <span class="tx"><b>{t(w.titel)}</b><small>{t(w.sub())}</small></span>
        </button>
      {/each}
    </div>
    <p class="klein">{t('standSetzen.keineAntwort')}</p>
  {/if}
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: env(safe-area-inset-top) var(--space-4) 24px;
  }

  .kopf {
    --on-zurueck: var(--accent-text);
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 4px 0;
  }

  h1 {
    margin: 6px 0 6px;
  }

  .sub {
    margin: 0 0 16px;
    color: var(--ink-muted);
  }

  .wahl {
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .sz {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 12px 14px;
    border: 0;
    border-top: 1px solid var(--line);
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .sz:first-child {
    border-top: 0;
  }

  .rad {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border: 1.5px solid var(--line-strong);
    border-radius: 50%;
  }

  .an .rad {
    border-color: var(--ink);
    background: var(--ink);
    color: var(--ground);
  }

  .tx {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: 1.35;
  }

  .klein {
    margin: 12px 2px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }
</style>
