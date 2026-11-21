<script lang="ts">
  // Bürgschaftserklärung (E112, DP41 Abschnitt 6): Formular im Stil von „Person ändern“ (DP39). Aus dem Heft
  // kommt, was schon da ist (Bürgin, Mieter, Wohnung, Vermieter); ohne Heft ist alles leer. Pflicht sind
  // Höchstbetrag und Art (PC47 §3), keine Art ist vorgewählt. Danach: zwei Blätter zum Ausdrucken; Blatt 2
  // bleibt beim Bürgen und kommt nie in die Mappe. Ein Scan von Blatt 1 kommt als Unterlage zur Person, für
  // dieses Heft (DP49 Punkt 5).
  import { onDestroy, tick, untrack } from 'svelte';
  import { daten } from '../app/daten.svelte';
  import { pdfZeigen } from '../app/pdfFenster.svelte';
  import { gehe } from '../app/router.svelte';
  import { adresseZeilen } from '../domain/adresse';
  import {
    betragAus,
    betragText,
    leereAngaben,
    offenZahl,
    pflichtFehlt,
    type BuergschaftAngaben,
    type BuergschaftsArt,
  } from '../domain/buergschaft';
  import { namensteil } from '../domain/dateiname';
  import { nameImPdf, nameText } from '../domain/namen';
  import { rollenText } from '../domain/regelkatalog';
  import { t, tIn } from '../i18n';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { erklaerungHeft } from '../ui/erklaerungHeft.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { personId = null, heftId = null }: { personId?: string | null; heftId?: string | null } =
    $props();

  const mitglied = $derived(
    personId ? (daten.ansicht?.mitglieder.find((m) => m.person.id === personId) ?? null) : null,
  );
  const heft = $derived(heftId ? (daten.hefte.find((h) => h.id === heftId) ?? null) : null);
  const vertrag = $derived(
    (daten.ansicht?.mitglieder ?? []).filter(
      (m) => m.zugehoerigkeit.rolle !== 'buerge' && !m.zugehoerigkeit.herausgenommenAm,
    ),
  );
  const ausHeft = $derived(!!mitglied);
  const rufname = $derived(mitglied ? mitglied.person.rufname || mitglied.person.vorname : '');
  const an = $derived(vertrag.length > 1 ? 'ihr' : 'du');

  function start(): BuergschaftAngaben {
    const a = leereAngaben();
    const m = untrack(() => mitglied);
    const h = untrack(() => heft);
    if (!m) return a;
    return {
      ...a,
      buerge: { name: nameText(nameImPdf(m.person)), anschrift: m.person.kontakt.anschrift ?? '' },
      mieter: untrack(() => vertrag).map((v) => nameText(nameImPdf(v.person))),
      vermieter: { name: h?.angaben?.anbieter?.trim() ?? '', anschrift: '' },
      wohnung: h ? adresseZeilen(h.adresse).join(', ') : '',
      vertragTag: /^\d{4}-\d{2}-\d{2}$/.test(h?.einzug ?? '') ? h!.einzug! : '',
      bezeichnung: m.zugehoerigkeit.bezeichnung,
    };
  }

  let a = $state<BuergschaftAngaben>(start());
  let betragEingabe = $state(betragText(a.hoechstbetrag));
  let versucht = $state(false);
  let zustand = $state<'formular' | 'fertig'>('formular');
  let baut = $state(false);
  let bauFehler = $state(false);
  let datei = $state.raw<File | null>(null);
  let bilder = $state<string[]>([]);

  const offen = $derived(offenZahl(a));
  const fehlt = $derived(pflichtFehlt(a));
  const zeigeFehler = $derived(versucht ? fehlt : { betrag: false, art: false });

  let titelEl = $state<HTMLElement | null>(null);
  let betragEl = $state<HTMLInputElement | null>(null);
  let artEl = $state<HTMLElement | null>(null);

  const ARTEN: BuergschaftsArt[] = ['ausfall', 'selbstschuldnerisch'];
  function artSatz(art: BuergschaftsArt): string {
    if (!ausHeft)
      return t(art === 'ausfall' ? 'buergschaft.ausfallSatzOhne' : 'buergschaft.selbstSatzOhne');
    return tIn(an, art === 'ausfall' ? 'buergschaft.ausfallSatz' : 'buergschaft.selbstSatz', {
      name: rufname,
    });
  }

  function dateiname(): string {
    const teil = namensteil(a.buerge.name);
    return `${['Buergschaftserklaerung', teil].filter(Boolean).join('_')}.pdf`;
  }

  function bilderFrei() {
    for (const b of bilder) URL.revokeObjectURL(b);
    bilder = [];
  }
  onDestroy(bilderFrei);

  async function erstellen() {
    versucht = true;
    bauFehler = false;
    if (fehlt.betrag || fehlt.art) {
      await tick();
      if (fehlt.betrag) betragEl?.focus();
      else artEl?.querySelector<HTMLElement>('[role="radio"]')?.focus();
      return;
    }
    baut = true;
    try {
      const [{ buergschaftBauen }, { pdfSchriftenLaden }] = await Promise.all([
        import('../pdf/buergschaft'),
        import('../pdf/schriften'),
      ]);
      const erg = await buergschaftBauen(
        $state.snapshot(a) as BuergschaftAngaben,
        await pdfSchriftenLaden(daten.ansicht?.haushalt.mappeAussehen?.schrift),
      );
      datei = new File([erg.bytes.slice()], dateiname(), { type: 'application/pdf' });
      bilderFrei();
      zustand = 'fertig';
      window.scrollTo(0, 0);
      await tick();
      titelEl?.focus();
      void vorschauBauen(erg.bytes);
    } catch {
      bauFehler = true;
    } finally {
      baut = false;
    }
  }

  async function vorschauBauen(bytes: Uint8Array) {
    try {
      const { miniatur, pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
      const dok = await pdfOeffnen(bytes.slice());
      const neu = [await miniatur(dok, 1, 160), await miniatur(dok, 2, 160)];
      await pdfSchliessen(dok);
      if (zustand !== 'fertig') return neu.forEach((b) => URL.revokeObjectURL(b));
      bilder = neu;
    } catch {
      // Ohne Vorschau stehen die Blätter als Fläche da; das PDF selbst ist fertig.
    }
  }

  async function teilenKlick() {
    if (!datei) return;
    const { teilen } = await import('../ui/mappeErstellen');
    await teilen([datei]);
  }

  function hinzufuegen() {
    if (!personId) return;
    erklaerungHeft.personId = personId;
    erklaerungHeft.heftId = heftId;
    gehe(`/unterlage/${personId}/buergschaftserklaerung`);
  }

  async function aendern() {
    zustand = 'formular';
    window.scrollTo(0, 0);
    await tick();
    titelEl?.focus();
  }

  const zurueckZiel = $derived(
    heftId ? `#/heft/${heftId}` : personId ? `#/person/${personId}` : '#/',
  );
  const blatt2Satz = $derived(
    !ausHeft
      ? t('buergschaft.blatt2Satz.maennlich')
      : t(`buergschaft.blatt2Satz.${a.bezeichnung}`, { name: rufname }),
  );
</script>

{#snippet kopf(titel: string, rechts: string)}
  <div class="abschnitt-kopf">
    <h2>{titel}</h2>
    {#if rechts}<small>{rechts}</small>{/if}
  </div>
{/snippet}

{#snippet fehler(text: string, id: string)}
  <p class="fehler" {id}>
    <span class="warnzeichen" aria-hidden="true">!</span><span>{text}</span>
  </p>
{/snippet}

<main class="seite">
  <div class="kopf">
    {#if zustand === 'fertig' && ausHeft}
      <Zurueck href="#/person/{personId}" text={rufname} />
    {:else}
      <Zurueck href={zurueckZiel} text={t('buergschaft.abbrechen')} />
    {/if}
  </div>
  <div class="titelblock">
    <h1 class="display frage" tabindex="-1" bind:this={titelEl}>{t('buergschaft.titel')}</h1>
    <p class="lead">
      {#if zustand === 'fertig'}
        {ausHeft ? t('buergschaft.fertigSatz', { name: rufname }) : t('buergschaft.fertigSatzOhne')}
      {:else}
        {ausHeft ? t('buergschaft.satz', { name: rufname }) : t('buergschaft.satzOhne')}
      {/if}
    </p>
  </div>

  {#if zustand === 'formular'}
    <form
      class="formular"
      novalidate
      onsubmit={(e) => {
        e.preventDefault();
        void erstellen();
      }}
    >
      <section class="teil">
        {@render kopf(t('buergschaft.werBuergt'), ausHeft ? t('buergschaft.ausHeft') : '')}
        <div class="kasten">
          <label class="eingabe">
            {t('buergschaft.name')}
            <input
              bind:value={a.buerge.name}
              placeholder={t('buergschaft.platzName')}
              autocomplete="off"
            />
          </label>
          <label class="eingabe">
            {t('buergschaft.anschrift')}
            <input
              bind:value={a.buerge.anschrift}
              placeholder={t('buergschaft.platzAnschrift')}
              autocomplete="off"
            />
          </label>
        </div>
      </section>

      <section class="teil">
        {@render kopf(t('buergschaft.fuerWen'), ausHeft ? t('buergschaft.ausHeft') : '')}
        {#if ausHeft}
          <ul class="kasten mieter">
            {#each vertrag as m (m.person.id)}
              <li>
                <span
                  class="zeichen"
                  style:background="var(--person-{m.zugehoerigkeit.farbe})"
                  aria-hidden="true"
                ></span>
                <b>{nameText(nameImPdf(m.person))}</b>
                <small>{rollenText(m.zugehoerigkeit.rolle, m.zugehoerigkeit.bezeichnung)}</small>
              </li>
            {/each}
          </ul>
          <p class="satz">{t('buergschaft.alleImVertrag')}</p>
        {:else}
          <div class="kasten">
            {#each a.mieter.keys() as i (i)}
              <label class="eingabe">
                {i === 0 ? t('buergschaft.mieter') : t('buergschaft.mieterNr', { nummer: i + 1 })}
                <input
                  bind:value={a.mieter[i]}
                  placeholder={t('buergschaft.platzName')}
                  autocomplete="off"
                />
              </label>
            {/each}
            <button
              type="button"
              class="textlink weitere"
              onclick={() => (a.mieter = [...a.mieter, ''])}
              ><Symbol name="plus" groesse={16} />{t('buergschaft.weitere')}</button
            >
          </div>
        {/if}
      </section>

      <section class="teil">
        {@render kopf(t('buergschaft.vermieter'), '')}
        <div class="kasten">
          <label class="eingabe">
            {t('buergschaft.name')}
            <input
              bind:value={a.vermieter.name}
              placeholder={t('buergschaft.platzFirma')}
              autocomplete="off"
            />
          </label>
          <label class="eingabe">
            {t('buergschaft.anschrift')}
            <input
              bind:value={a.vermieter.anschrift}
              placeholder={t('buergschaft.platzAnschrift')}
              autocomplete="off"
            />
          </label>
        </div>
      </section>

      <section class="teil">
        {@render kopf(t('buergschaft.wohnung'), heft ? t('buergschaft.ausHeft') : '')}
        <div class="kasten">
          <label class="eingabe">
            {t('buergschaft.wohnungLage')}
            <input
              bind:value={a.wohnung}
              placeholder={t('buergschaft.platzWohnung')}
              autocomplete="off"
            />
          </label>
          <fieldset class="feld">
            <legend>{t('buergschaft.mietvertrag')}</legend>
            <div class="segmente" role="radiogroup" aria-label={t('buergschaft.mietvertrag')}>
              {#each ['unterschrieben', 'nochNicht'] as const as wert (wert)}
                <button
                  type="button"
                  class="chip"
                  role="radio"
                  aria-checked={a.vertrag === wert}
                  onclick={() => (a.vertrag = wert)}
                  >{t(
                    wert === 'unterschrieben'
                      ? 'buergschaft.schonUnterschrieben'
                      : 'buergschaft.nochNicht',
                  )}</button
                >
              {/each}
            </div>
          </fieldset>
          <label class="eingabe">
            {a.vertrag === 'unterschrieben'
              ? t('buergschaft.vertragVom')
              : t('buergschaft.einzugZum')}
            <input type="date" bind:value={a.vertragTag} />
          </label>
        </div>
      </section>

      <section class="teil">
        {@render kopf(t('buergschaft.hoechstbetrag'), t('buergschaft.pflicht'))}
        <div class="kasten">
          <label class="eingabe betrag">
            <span class="visually-hidden">{t('buergschaft.hoechstbetrag')}</span>
            <span class="betrag-feld">
              <input
                bind:this={betragEl}
                inputmode="numeric"
                autocomplete="off"
                placeholder={t('buergschaft.betrag')}
                aria-invalid={zeigeFehler.betrag}
                aria-describedby={zeigeFehler.betrag ? 'b-fehler-betrag' : 'b-bis'}
                bind:value={betragEingabe}
                oninput={() => (a.hoechstbetrag = betragAus(betragEingabe))}
                onblur={() => (betragEingabe = betragText(a.hoechstbetrag))}
              />
              <span class="euro" aria-hidden="true">{t('buergschaft.euro')}</span>
            </span>
          </label>
          {#if zeigeFehler.betrag}
            {@render fehler(t('buergschaft.fehlerBetrag'), 'b-fehler-betrag')}
          {:else}
            <p class="satz" id="b-bis">
              {ausHeft ? t('buergschaft.bisZu', { name: rufname }) : t('buergschaft.bisZuOhne')}
            </p>
          {/if}
        </div>
      </section>

      <section class="teil">
        {@render kopf(t('buergschaft.art'), t('buergschaft.pflicht'))}
        <div
          class="kasten arten"
          role="radiogroup"
          aria-label={t('buergschaft.art')}
          aria-invalid={zeigeFehler.art}
          aria-describedby={zeigeFehler.art ? 'b-fehler-art' : undefined}
          bind:this={artEl}
        >
          {#each ARTEN as art (art)}
            <button
              type="button"
              class="art"
              role="radio"
              aria-checked={a.art === art}
              onclick={() => (a.art = art)}
            >
              <span class="kreis" aria-hidden="true"></span>
              <span class="tx">
                <b>{t(art === 'ausfall' ? 'buergschaft.ausfall' : 'buergschaft.selbst')}</b>
                <small>{artSatz(art)}</small>
              </span>
            </button>
          {/each}
        </div>
        {#if zeigeFehler.art}
          <div class="art-fehler">{@render fehler(t('buergschaft.fehlerArt'), 'b-fehler-art')}</div>
        {/if}
      </section>
      <!-- DP112 B1: Bernstein nur mit Warnzeichen und Satz, wie bei .fehler (AK5). -->
      {#if bauFehler}<p class="fehler fehler-bau" role="alert">
          <span class="warnzeichen" aria-hidden="true">!</span><span
            >{t('buergschaft.fehlerBau')}</span
          >
        </p>{/if}
    </form>
  {:else}
    <section class="teil">
      {@render kopf(t('buergschaft.imPdf'), '')}
      <ul class="kasten blaetter">
        {#each [1, 2] as nummer (nummer)}
          <li>
            <button
              type="button"
              class="blatt"
              onclick={() => datei && pdfZeigen(datei)}
              aria-label="{nummer === 1
                ? t('buergschaft.blatt1')
                : ausHeft
                  ? t('buergschaft.blatt2', { name: rufname })
                  : t('buergschaft.blatt2Ohne')}. {t('buergschaft.vorschau', { nummer })}"
            >
              <span class="miniatur" aria-hidden="true">
                {#if bilder[nummer - 1]}<img src={bilder[nummer - 1]} alt="" />{/if}
              </span>
              <span class="tx">
                <b
                  >{nummer === 1
                    ? t('buergschaft.blatt1')
                    : ausHeft
                      ? t('buergschaft.blatt2', { name: rufname })
                      : t('buergschaft.blatt2Ohne')}</b
                >
                <small
                  >{nummer === 1
                    ? ausHeft
                      ? t('buergschaft.blatt1Satz', { name: rufname })
                      : t('buergschaft.blatt1SatzOhne')
                    : blatt2Satz}</small
                >
              </span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
    {#if ausHeft}
      <section class="teil">
        {@render kopf(t('buergschaft.danach'), '')}
        <div class="kasten danach">
          <button type="button" class="zeile" onclick={hinzufuegen}>
            <span class="sym" aria-hidden="true"><Symbol name="buergschaft" groesse={20} /></span>
            <span class="tx">
              <b>{t('buergschaft.hinzufuegen')}</b>
              <small>{t('buergschaft.hinzufuegenSatz', { name: rufname })}</small>
            </span>
            <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={16} /></span>
          </button>
        </div>
      </section>
    {/if}
    <button type="button" class="textlink aendern" onclick={() => void aendern()}
      >{t('buergschaft.aendern')}</button
    >
  {/if}
</main>

{#if zustand === 'formular'}
  {#if baut}
    <Aktionsleiste text={t('buergschaft.erstellen')}>
      {#snippet statt()}
        <p class="baut" role="status">{t('buergschaft.baut')}</p>
      {/snippet}
    </Aktionsleiste>
  {:else}
    <Aktionsleiste
      text={t('buergschaft.erstellen')}
      zusatz={offen ? t('buergschaft.offen', { anzahl: offen }) : undefined}
      ansage={offen ? t('buergschaft.offenAnsage', { anzahl: offen }) : undefined}
      onclick={() => void erstellen()}
    />
  {/if}
{:else}
  <Aktionsleiste text={t('buergschaft.teilen')} onclick={() => void teilenKlick()} />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(20px + env(safe-area-inset-top)) var(--space-4)
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
  }

  .titelblock {
    padding: 6px var(--space-1) 0;
  }

  .frage {
    margin-top: 10px;
    outline: none;
  }

  .lead {
    margin: 8px 0 0;
    color: var(--ink-muted);
  }

  .teil {
    margin-top: var(--space-5);
  }

  .abschnitt-kopf {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin: 0 var(--space-1) 8px;
  }

  .abschnitt-kopf h2 {
    margin: 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .abschnitt-kopf small {
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
  }

  .kasten {
    display: grid;
    gap: var(--space-3);
    margin: 0;
    padding: 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
    --weich: var(--weich-karte);
  }

  .eingabe input {
    min-height: 48px;
    border-radius: 14px;
  }

  .satz {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .teil > .satz {
    margin: 10px var(--space-1) 0;
  }

  .mieter {
    gap: 0;
    padding: 4px 14px;
  }

  .mieter li {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 8px;
    min-height: var(--tap-target);
    padding: 12px 0;
  }

  .mieter li + li {
    border-top: 1px solid var(--track);
  }

  .zeichen {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 2px;
  }

  .mieter b {
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .mieter small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .weitere {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    justify-self: start;
    min-height: var(--tap-target);
  }

  .feld {
    margin: 0;
    padding: 0;
    border: 0;
  }

  legend {
    margin-bottom: var(--space-2);
    padding: 0;
    font-size: calc(14 * var(--px));
    font-weight: 700;
  }

  .segmente {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .segmente .chip {
    padding: 0 14px;
    font-size: calc(15 * var(--px));
  }

  .betrag-feld {
    position: relative;
    display: block;
  }

  .betrag-feld input {
    padding-right: 64px;
    font-size: calc(20 * var(--px));
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .betrag-feld input::placeholder {
    font-size: calc(17 * var(--px));
    font-weight: 400;
  }

  .euro {
    position: absolute;
    top: 50%;
    right: 16px;
    transform: translateY(-50%);
    color: var(--ink-muted);
    font-size: calc(15 * var(--px));
    font-weight: 600;
    pointer-events: none;
  }

  .fehler {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    margin: 0;
    color: var(--fehler);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 600;
  }

  .art-fehler {
    margin: 10px var(--space-1) 0;
  }

  .warnzeichen {
    display: grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-top: 1px;
    border-radius: 8px;
    background: var(--fehler);
    color: var(--surface);
    font-size: calc(11 * var(--px));
    font-weight: 800;
    line-height: 1;
  }

  .arten {
    gap: 0;
    padding: 4px 14px;
  }

  .art {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 12px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .art + .art {
    border-top: 1px solid var(--track);
  }

  .kreis {
    flex: none;
    width: 22px;
    height: 22px;
    margin-top: 1px;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--ink-muted);
  }

  .art[aria-checked='true'] .kreis {
    box-shadow:
      inset 0 0 0 1.5px var(--ink),
      inset 0 0 0 5px var(--surface),
      inset 0 0 0 11px var(--ink);
  }

  .tx {
    display: grid;
    gap: 2px;
    min-width: 0;
  }

  .tx b {
    font-size: calc(15 * var(--px));
    font-weight: 650;
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .fehler-bau {
    margin: var(--space-4) var(--space-1) 0;
    color: var(--fehler);
    font-weight: 600;
  }

  .blaetter {
    gap: 0;
    padding: 4px 14px;
  }

  .blaetter li + li {
    border-top: 1px solid var(--track);
  }

  .blatt {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    padding: 12px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .miniatur {
    flex: none;
    width: 48px;
    height: 68px;
    overflow: hidden;
    border-radius: 3px;
    background: #fff;
    box-shadow: 0 0 0 1px var(--track);
  }

  .miniatur img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .danach {
    padding: 4px 14px;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 56px;
    padding: 10px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
  }

  .zeile .tx {
    flex: 1;
  }

  .sym,
  .pfeil {
    display: inline-flex;
    flex: none;
    color: var(--ink);
  }

  .pfeil {
    color: var(--ink-muted);
  }

  .aendern {
    display: flex;
    align-items: center;
    width: max-content;
    min-height: var(--tap-target);
    margin: var(--space-4) auto 0;
  }

  .baut {
    margin: 0;
    padding: 16px;
    text-align: center;
    color: var(--ink-muted);
  }
</style>
