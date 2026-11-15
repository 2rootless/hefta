<script lang="ts">
  // „Woran erkennt ihr sie wieder?“ (B16): ein kurzer Name für das
  // Heft, höchstens 40 Zeichen. Er steht in der Übersicht ganz oben und ersetzt Titel, Straße und den
  // gebauten Titel (E78). Vorschlag aus dem Inserat ist dessen Überschrift, wenn Hefta sie hat; ein
  // leeres Feld heißt: wieder der Vorschlag von Hefta.
  import { daten, db, stillLaden } from '../app/daten.svelte';
  import { zurueckGehen } from '../app/router.svelte';
  import { heftTitel, zurueckZumHeft } from '../domain/heftKarte';
  import type { HeftAngaben } from '../domain/modell';
  import { t } from '../i18n';
  import { heftAendern } from '../storage/speicher';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const LAENGE = 40;
  let { id }: { id: string } = $props();

  const heft = $derived(daten.hefte.find((h) => h.id === id) ?? null);
  const ihr = $derived(
    // Ohne Haushalt „ihr“ (E74.4, Design 12.11.), sonst ab zwei Personen ohne Bürgen.
    !daten.ansicht ||
      daten.ansicht.mitglieder.filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const vorschlag = $derived((heft?.angaben?.titel ?? '').trim());
  /** Was oben stünde, gäbe es kein Merkmal: Titel, Straße oder der gebaute Titel. */
  const ohneMerkmal = $derived(
    heft
      ? heftTitel({
          ...heft,
          angaben: heft.angaben ? { ...heft.angaben, merkmal: null } : undefined,
        })
      : null,
  );

  let wert = $state('');
  let von = $state<string | null>(null);
  $effect(() => {
    if (heft && von !== heft.id) {
      wert = (heft.angaben?.merkmal ?? '').trim() || vorschlag;
      von = heft.id;
    }
  });

  const LEER: HeftAngaben = {
    titel: null,
    stadtteil: null,
    warm: null,
    zimmer: null,
    flaeche: null,
  };

  // DP33 5.2: Das Feld wächst bis drei Zeilen; über 40 Zeichen sagt der Zähler es, Hefta kürzt nicht.
  const zuLang = $derived(wert.trim().length > LAENGE);
  let feld = $state<HTMLTextAreaElement | null>(null);
  $effect(() => {
    void wert;
    if (!feld) return;
    feld.style.height = 'auto';
    const zeile = parseFloat(getComputedStyle(feld).lineHeight) || 24;
    const rand = feld.offsetHeight - feld.clientHeight;
    const innen = parseFloat(getComputedStyle(feld).paddingTop) * 2;
    feld.style.height = `${Math.min(feld.scrollHeight, zeile * 3 + innen) + rand}px`;
  });

  async function uebernehmen() {
    if (!heft || zuLang) return;
    const w = wert.trim();
    // Gleich dem Vorschlag: kein eigenes Merkmal, damit ein besserer Vorschlag später greift.
    const merkmal = w && w !== vorschlag ? w : null;
    await heftAendern(await db(), heft.id, { angaben: { ...(heft.angaben ?? LEER), merkmal } });
    await stillLaden();
    zurueckGehen(`/heft/${heft.id}`);
  }

  const oben = $derived(
    ohneMerkmal?.strasse ? t('merkmal.dieStrasse') : `„${ohneMerkmal?.text ?? ''}“`,
  );
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href={`#/heft/${id}`} text={zurueckZumHeft(heft) ?? t('merkmal.zurueck')} />
  </header>

  {#if !heft}
    <p class="sub">{t('heft.fehlt')}</p>
  {:else}
    <h1 class="h2">{t(ihr ? 'merkmal.titelIhr' : 'merkmal.titelDu')}</h1>
    <p class="sub">{t('merkmal.sub')}</p>

    <label class="visually-hidden" for="merkmal">{t('merkmal.feld')}</label>
    <textarea
      id="merkmal"
      class="feld"
      rows="1"
      autocomplete="off"
      placeholder={ohneMerkmal?.text ?? ''}
      bind:this={feld}
      bind:value={wert}
      onkeydown={(e) => {
        // Ein Name hat keine Zeilen: Eingabe übernimmt.
        if (e.key === 'Enter') {
          e.preventDefault();
          void uebernehmen();
        }
      }}></textarea>
    <p
      class="zz"
      class:zu-lang={zuLang}
      data-rot={zuLang ? 'grenze' : undefined}
      id="merkmal-zaehler"
      aria-live="polite"
    >
      {#if zuLang}<span>{t('merkmal.zuLang')}</span>{/if}
      <span>{t('merkmal.zaehler', { n: wert.trim().length })}</span>
    </p>

    {#if vorschlag}
      <h2 class="h3">{t('merkmal.ausInserat')}</h2>
      <div class="vorschlag">
        <span>{vorschlag}</span>
        <button type="button" onclick={() => (wert = vorschlag)}>{t('merkmal.einsetzen')}</button>
      </div>
      {#if heft.angaben?.merkmal}
        <button class="leis" type="button" onclick={() => (wert = vorschlag)}
          >{t('merkmal.wiederherstellen')}</button
        >
      {/if}
    {:else}
      <p class="hinweis">
        {t(
          heft.inseratText
            ? ihr
              ? 'merkmal.keinVorschlagIhr'
              : 'merkmal.keinVorschlagDu'
            : ihr
              ? 'merkmal.ohneTextIhr'
              : 'merkmal.ohneTextDu',
          { oben },
        )}
      </p>
    {/if}

    <div class="cta">
      <Hauptbutton
        text={t('merkmal.uebernehmen')}
        onclick={uebernehmen}
        grundBei={zuLang ? 'merkmal-zaehler' : undefined}
      />
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
    margin: 0 0 16px;
    color: var(--ink-muted);
  }

  /* DP33 A4 und 5.2: weiche Fläche ohne Linie wie „Notizen“; Fokus 2 px Tinte innen. */
  .feld {
    box-sizing: border-box;
    display: block;
    width: 100%;
    min-height: 52px;
    padding: 13px 14px;
    border: 0;
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    font-weight: 600;
    line-height: 1.4;
    resize: none;
    overflow-y: auto;
  }

  .feld:focus {
    outline: 0;
    box-shadow: inset 0 0 0 2px var(--ink);
  }

  .zz {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 2px 10px;
    margin: 6px 2px 0;
    color: var(--ink-quiet);
    font-size: calc(12 * var(--px));
    text-align: right;
  }

  .zz.zu-lang {
    color: var(--accent-text);
  }

  /* „Aus dem Inserat“: eine Zeile auf weicher Fläche, der Titel bricht um, rechts „Einsetzen“. */
  .vorschlag {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 52px;
    padding: 6px 6px 6px 14px;
    border-radius: 14px;
    background: var(--surface);
    margin-bottom: 6px;
  }

  .vorschlag span {
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-weight: 600;
  }

  .vorschlag button {
    /* DP35 R3: Aktion in Tinte; Rot nur für Zurück und Warnungen. */
    flex: none;
    min-height: 44px;
    padding: 0 10px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .h3 {
    margin: 22px 0 8px;
    font-size: calc(16 * var(--px));
    font-weight: 650;
  }

  .leis {
    /* DP35 R3: Aktion in Tinte; Rot nur für Zurück und Warnungen. */
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 44px;
    margin-top: 6px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .hinweis {
    margin: 14px 2px 0;
    color: var(--ink-muted);
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
