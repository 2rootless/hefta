<script lang="ts">
  // „Termin eintragen“ (B23 `s=termin`, Zeile 9): Tag aus den nächsten vier Tagen oder „Anderer Tag“,
  // Uhrzeit, freiwillig Treffpunkt oder Notiz. Mit dem Termin steht das Heft auf „Besichtigung“. Den Satz
  // „Hefta erinnert am Vorabend …“ aus dem Entwurf gibt es erst mit den Erinnerungen; bis dahin trägt
  // „In den Kalender“ die Erinnerung (eine Stunde vorher).
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { tagAus } from '../domain/fristen';
  import { terminKurz } from '../domain/heftKarte';
  import { terminSetzen } from '../domain/heftStand';
  import { t } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const heute = new Date();
  const TAGE = Array.from({ length: 4 }, (_, i) =>
    tagAus(new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() + 1 + i)),
  );
  const zwei = (n: number) => String(n).padStart(2, '0');

  let tag = $state('');
  let anderer = $state(false);
  let uhrzeit = $state('18:00');
  let treffpunkt = $state('');
  let von = $state<string | null>(null);
  let fehlt = $state(false);

  $effect(() => {
    // Beim Ändern stehen Tag, Uhrzeit und Treffpunkt des bisherigen Termins schon da.
    if (heft && von !== heft.id) {
      von = heft.id;
      const alt = heft.ereignisse.termin;
      if (alt) {
        const d = new Date(alt.am);
        tag = tagAus(d);
        anderer = !TAGE.includes(tag);
        uhrzeit = `${zwei(d.getHours())}:${zwei(d.getMinutes())}`;
        treffpunkt = alt.treffpunkt;
      }
    }
  });

  function waehlen(t: string) {
    tag = t;
    anderer = false;
    fehlt = false;
  }

  async function speichern() {
    if (!heft) return;
    if (!tag) {
      fehlt = true;
      return;
    }
    const [j, m, d] = tag.split('-').map(Number);
    const [h, min] = (uhrzeit || '18:00').split(':').map(Number);
    const am = new Date(j!, m! - 1, d!, h ?? 18, min ?? 0);
    await heftAendern(await db(), heft.id, {
      ereignisse: $state.snapshot(terminSetzen(heft.ereignisse, am, treffpunkt)),
    });
    await stillLaden();
    abschliessen(`/heft/${heft.id}`);
  }
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href={`#/heft/${id}`} text={t('termin.zurueck')} />
  </header>

  {#if !heft}
    <p class="sub">{t('heft.fehlt')}</p>
  {:else}
    <h1 class="h2">{t(heft.ereignisse.termin ? 'termin.titelAendern' : 'termin.titelNeu')}</h1>
    <p class="sub">{t('termin.sub')}</p>

    <h2 class="h3" id="termin-tag">{t('termin.tag')}</h2>
    <div class="wege" role="group" aria-labelledby="termin-tag">
      {#each TAGE as tg (tg)}
        <button
          class="chip"
          class:on={!anderer && tag === tg}
          type="button"
          aria-pressed={!anderer && tag === tg}
          onclick={() => waehlen(tg)}>{terminKurz(`${tg}T00:00:00`, false)}</button
        >
      {/each}
      <button
        class="chip"
        class:on={anderer}
        type="button"
        aria-pressed={anderer}
        onclick={() => {
          anderer = true;
          fehlt = false;
        }}><Symbol name="kalender" groesse={16} />{t('termin.andererTag')}</button
      >
    </div>
    {#if anderer}
      <div class="feld">
        <label class="visually-hidden" for="termin-datum">{t('termin.datum')}</label>
        <input id="termin-datum" type="date" bind:value={tag} oninput={() => (fehlt = false)} />
      </div>
    {/if}
    {#if fehlt}<p class="fehlt" role="alert">{t('termin.ohneTag')}</p>{/if}

    <h2 class="h3"><label for="termin-uhr">{t('termin.uhrzeit')}</label></h2>
    <div class="feld">
      <input id="termin-uhr" type="time" bind:value={uhrzeit} />
    </div>

    <h2 class="h3">
      <label for="termin-treff">{t('termin.treffpunkt')}</label>
      <small>{t('termin.freiwillig')}</small>
    </h2>
    <div class="feld">
      <input
        id="termin-treff"
        autocomplete="off"
        maxlength="120"
        placeholder={t('termin.beispiel')}
        bind:value={treffpunkt}
      />
    </div>

    <div class="cta">
      <Hauptbutton text={t('termin.speichern')} onclick={speichern} />
    </div>
  {/if}
</main>

<style>
  .seite {
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

  h1 {
    margin: 6px 0 6px;
  }

  .sub {
    margin: 0 0 8px;
    color: var(--ink-muted);
  }

  .h3 {
    margin: 22px 0 8px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .h3 small {
    margin-left: 6px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    font-weight: 500;
  }

  .wege {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 44px;
    padding: 0 14px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius-full);
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .chip.on {
    border-color: var(--ink);
    background: var(--surface);
  }

  .feld {
    display: flex;
    align-items: center;
    min-height: 52px;
    margin-top: 8px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--surface);
  }

  .h3 + .feld {
    margin-top: 0;
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
    font-weight: 600;
  }

  .fehlt {
    margin: 8px 2px 0;
    color: var(--knapp-text);
    font-size: calc(14 * var(--px));
  }

  .cta {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 24px calc(-1 * var(--space-4)) 0;
    padding: 12px var(--space-4) calc(env(safe-area-inset-bottom) + 16px);
    background: var(--ground);
    box-shadow: 0 -14px 14px -2px var(--ground);
  }
</style>
