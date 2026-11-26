<script lang="ts">
  // Leere Vorlage der Bürgschaftserklärung im Browser (W63; DP135, Abschnitt 4): „Der Bogen selbst“ wie die Selbstauskunft
  // (E111), dieselben Bausteine. „Bürgschaftserklärung von“ mit Vorname und Nachname; WER BÜRGT, FÜR WEN, VERMIETER,
  // WOHNUNG (mit Lage und Mietvertrag), HÖCHSTBETRAG, ART DER BÜRGSCHAFT; Ort, Datum und Unterschrift bleiben leer für
  // die Hand (U10). Nötig sind nur Höchstbetrag und Art (E112). Was man einträgt, bleibt in diesem Browser (W11).
  import { onMount, tick } from 'svelte';
  import { betragAus, betragText, type BuergschaftsArt } from '../domain/buergschaft';
  import {
    buergschaftFehlt,
    leereBuergschaft,
    nameVon,
    type BuergschaftBogenDaten,
  } from '../domain/bogen';
  import { leereAngaben } from '../domain/buergschaft';
  import { wohnungText } from '../domain/buergschaftEingabe';
  import { namensteil } from '../domain/dateiname';
  import { anschriftText } from '../formblatt/anschrift';
  import BogenAbschnitt from '../formblatt/bogen/BogenAbschnitt.svelte';
  import BogenAnschrift from '../formblatt/bogen/BogenAnschrift.svelte';
  import BogenBlatt from '../formblatt/bogen/BogenBlatt.svelte';
  import BogenFeld from '../formblatt/bogen/BogenFeld.svelte';
  import BogenJaNein from '../formblatt/bogen/BogenJaNein.svelte';
  import BogenSeite from '../formblatt/bogen/BogenSeite.svelte';
  import { t } from '../i18n';
  import { boegenLaden, boegenSetzen } from '../ui/boegenSpeicher';
  import { bogenZurueck } from '../ui/bogenZurueck';

  let b = $state<BuergschaftBogenDaten | null>(null);
  let betragEingabe = $state('');
  let letzter = '';

  onMount(() => {
    void boegenLaden().then((g) => {
      b = g.buergschaft ?? leereBuergschaft();
      betragEingabe = betragText(b.hoechstbetrag);
      letzter = JSON.stringify(b);
    });
  });

  let zeitgeber: ReturnType<typeof setTimeout> | undefined;
  $effect(() => {
    const jetzt = JSON.stringify(b);
    if (!b || jetzt === letzter) return;
    clearTimeout(zeitgeber);
    zeitgeber = setTimeout(() => {
      letzter = jetzt;
      void boegenSetzen('buergschaft', $state.snapshot(b) as BuergschaftBogenDaten);
    }, 400);
    return () => clearTimeout(zeitgeber);
  });

  const fehlt = $derived(b ? buergschaftFehlt(b) : []);
  const zurueck = bogenZurueck();
  const ARTEN: BuergschaftsArt[] = ['ausfall', 'selbstschuldnerisch'];

  let baut = $state(false);
  let fehler = $state(false);
  async function erstellen() {
    if (!b) return;
    if (fehlt.length) {
      await tick();
      if (!b.hoechstbetrag)
        document.querySelector<HTMLInputElement>('[data-feld="hoechstbetrag"]')?.focus();
      else document.querySelector<HTMLElement>('.arten [role="radio"]')?.focus();
      return;
    }
    baut = true;
    fehler = false;
    try {
      const [{ buergschaftBauen }, { pdfSchriftenLaden }, { teilen }] = await Promise.all([
        import('../pdf/buergschaft'),
        import('../pdf/schriften'),
        import('../ui/mappeErstellen'),
      ]);
      const s = $state.snapshot(b) as BuergschaftBogenDaten;
      const name = nameVon(s);
      const erg = await buergschaftBauen(
        {
          ...leereAngaben(),
          buerge: { name, anschrift: anschriftText(s.anschrift) },
          mieter: s.mieter.map(nameVon).filter(Boolean).length
            ? s.mieter.map(nameVon).filter(Boolean)
            : [''],
          vermieter: {
            name: s.vermieterName.trim(),
            anschrift: anschriftText(s.vermieterAnschrift),
          },
          wohnung: wohnungText(s),
          vertrag: s.vertrag,
          vertragTag: s.vertragTag,
          hoechstbetrag: s.hoechstbetrag,
          art: s.art,
        },
        await pdfSchriftenLaden(),
      );
      const datei = `${['Buergschaftserklaerung', namensteil(name)].filter(Boolean).join('_')}.pdf`;
      await teilen([new File([erg.bytes.slice()], datei, { type: 'application/pdf' })]);
    } catch {
      fehler = true;
    } finally {
      baut = false;
    }
  }

  let loeschenFrage = $state(false);
  async function allesLoeschen() {
    await boegenSetzen('buergschaft', undefined);
    b = leereBuergschaft();
    betragEingabe = '';
    letzter = JSON.stringify(b);
    loeschenFrage = false;
    window.scrollTo(0, 0);
  }
</script>

{#snippet alsPdf()}
  <h2 class="kopf">{t('bogen.alsPdf')}</h2>
  <p class="satz">{t('buergschaft.alsPdfSatz')}</p>
{/snippet}

{#snippet loeschen()}
  <p class="satz bleibt">{t('buergschaft.bleibt')}</p>
  {#if loeschenFrage}
    <p class="satz">{t('bogen.loeschenFrage')}</p>
    <div class="knoepfe">
      <button type="button" class="zweit" onclick={() => void allesLoeschen()}
        >{t('selbstauskunft.loeschen')}</button
      >
      <button type="button" class="leise" onclick={() => (loeschenFrage = false)}
        >{t('allgemein.abbrechen')}</button
      >
    </div>
  {:else}
    <button type="button" class="leise" onclick={() => (loeschenFrage = true)}
      >{t('bogen.allesLoeschen')}</button
    >
  {/if}
{/snippet}

{#if b}
  <BogenSeite
    titel={t('buergschaft.titel')}
    satz={t('buergschaft.satzOhne')}
    {zurueck}
    haupt={{
      text: t('buergschaft.erstellen'),
      unterzeile: t('buergschaft.zweiBlaetter'),
      grund: fehlt.length ? t('buergschaft.esFehlt', { liste: fehlt.join(', ') }) : null,
      onclick: () => void erstellen(),
    }}
  >
    <BogenBlatt
      titel={t('buergschaft.erklaerungVon')}
      bind:vorname={b.vorname}
      bind:nachname={b.nachname}
      satz={t('buergschaft.werSatz')}
      name={t('buergschaft.titel')}
    >
      <BogenAbschnitt titel={t('buergschaft.werBuergt')} />
      <BogenAnschrift bind:anschrift={b.anschrift} />

      <BogenAbschnitt titel={t('buergschaft.fuerWen')} />
      {#each b.mieter as m, i (i)}
        <div
          class="name-zeile"
          role="group"
          aria-label={t('buergschaft.mieterNr', { nummer: i + 1 })}
        >
          <div>
            <BogenFeld
              etikett="Vorname"
              bind:wert={m.vorname}
              breit
              feld={{ 'aria-describedby': 'b-fuer-wen' }}
            />
          </div>
          <div>
            <BogenFeld
              etikett="Nachname"
              bind:wert={m.nachname}
              breit
              feld={{ 'aria-describedby': 'b-fuer-wen' }}
            />
          </div>
        </div>
      {/each}
      <button
        type="button"
        class="weitere"
        onclick={() => b!.mieter.push({ vorname: '', nachname: '' })}
        >{t('buergschaft.plusWeitere')}</button
      >
      <p class="satz w30" id="b-fuer-wen" data-w30="gruppe">
        {t('buergschaft.fuerWenSatzOhne')}
      </p>

      <BogenAbschnitt titel={t('buergschaft.vermieter')} />
      <BogenFeld etikett={t('buergschaft.platzFirma')} bind:wert={b.vermieterName} />
      <BogenAnschrift bind:anschrift={b.vermieterAnschrift} satz={t('buergschaft.vermieterSatz')} />

      <BogenAbschnitt titel={t('buergschaft.wohnung')} />
      <BogenAnschrift bind:anschrift={b.wohnung} satz={t('buergschaft.wohnungSatz')}>
        {#snippet mitLage()}
          <BogenFeld
            etikett={t('buergschaft.lage')}
            bind:wert={b!.lage}
            feld={{ placeholder: t('buergschaft.platzLageEtwa') }}
          />
        {/snippet}
      </BogenAnschrift>
      <BogenJaNein
        frage={t('buergschaft.mietvertrag')}
        name={t('buergschaft.mietvertrag')}
        bind:wert={b.vertrag}
        optionen={[
          { wert: 'unterschrieben', text: t('buergschaft.schonUnterschrieben') },
          { wert: 'nochNicht', text: t('buergschaft.nochNicht') },
        ]}
      />
      <BogenFeld
        etikett={b.vertrag === 'unterschrieben'
          ? t('buergschaft.vertragVom')
          : t('buergschaft.einzugZum')}
        bind:wert={b.vertragTag}
        satz={b.vertrag === 'unterschrieben'
          ? t('buergschaft.vertragSatz')
          : t('buergschaft.einzugSatz')}
        feld={{ type: 'date' }}
      />

      <BogenAbschnitt titel={t('buergschaft.hoechstbetrag')} />
      <label class="betrag">
        <span class="l">{t('buergschaft.hoechstbetragEuro')}</span>
        <input
          inputmode="numeric"
          autocomplete="off"
          data-feld="hoechstbetrag"
          aria-describedby="b-bis"
          bind:value={betragEingabe}
          oninput={() => (b!.hoechstbetrag = betragAus(betragEingabe))}
          onblur={() => (betragEingabe = betragText(b!.hoechstbetrag))}
        />
      </label>
      <p class="satz w30" id="b-bis" data-w30="feld">{t('buergschaft.bisZuOhne')}</p>

      <BogenAbschnitt titel={t('buergschaft.art')} />
      <div class="arten" role="radiogroup" aria-label={t('buergschaft.art')}>
        {#each ARTEN as art (art)}
          <button
            type="button"
            class="art"
            role="radio"
            aria-checked={b.art === art}
            onclick={() => (b!.art = art)}
          >
            <span class="kreis" aria-hidden="true"></span>
            <span class="tx">
              <b>{t(art === 'ausfall' ? 'buergschaft.ausfall' : 'buergschaft.selbst')}</b>
              <small
                >{t(
                  art === 'ausfall' ? 'buergschaft.ausfallSatzOhne' : 'buergschaft.selbstSatzOhne',
                )}</small
              >
            </span>
          </button>
        {/each}
      </div>
      <p class="hand"><span class="linie" aria-hidden="true"></span>{t('bogen.ortDatum')}</p>
      <p class="hand">
        <span class="linie" aria-hidden="true"></span>{t('buergschaft.unterschrift')}
      </p>
      <p class="satz">{t('buergschaft.unterschriftSatz')}</p>
    </BogenBlatt>
    {#if baut}<p class="satz" role="status">{t('buergschaft.baut')}</p>{/if}
    {#if fehler}<p class="satz" role="alert">{t('buergschaft.fehlerBau')}</p>{/if}
    {#snippet unten()}{@render alsPdf()}{@render loeschen()}{/snippet}
    {#snippet pult()}{@render alsPdf()}{/snippet}
    {#snippet pultUnten()}{@render loeschen()}{/snippet}
  </BogenSeite>
{/if}

<style>
  .name-zeile {
    display: flex;
    flex-wrap: wrap;
    gap: 0 12px;
    margin-top: 12px;
  }

  .name-zeile > div {
    flex: 1 1 calc(120 * var(--px));
    min-width: 0;
  }

  .weitere {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    margin-top: 8px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .satz {
    margin: 4px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .betrag {
    display: block;
    margin-top: 16px;
  }

  .l {
    display: block;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 700;
    color: var(--ink-muted);
  }

  .betrag input {
    display: block;
    width: 100%;
    min-height: 44px;
    padding: 8px 0;
    border: 0;
    border-bottom: 1px solid var(--ink-quiet);
    border-radius: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(17 * var(--px));
  }

  .betrag input:focus-visible,
  .art:focus-visible,
  .weitere:focus-visible,
  .zweit:focus-visible,
  .leise:focus-visible {
    outline: none;
    box-shadow: 0 3px 0 0 var(--ink);
  }

  .arten {
    display: grid;
  }

  .art {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 12px 0;
    border: 0;
    border-bottom: 1px solid var(--line);
    background: none;
    color: var(--ink);
    text-align: left;
    font: inherit;
    cursor: pointer;
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
  }

  .tx small {
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .hand {
    margin: 40px 0 0;
    font-size: calc(13 * var(--px));
    line-height: calc(20 * var(--px));
    color: var(--ink-muted);
  }

  .linie {
    display: block;
    margin-bottom: 4px;
    border-top: 1px solid var(--ink);
  }

  .kopf {
    margin: 24px 0 0;
    font-size: calc(12 * var(--px));
    line-height: calc(16 * var(--px));
    font-weight: 700;
    letter-spacing: 0.08em;
    color: var(--ink-muted);
    text-transform: uppercase;
  }

  .knoepfe {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    align-items: center;
    margin-top: 16px;
  }

  .zweit {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 44px;
    padding: 0 20px;
    border: 1.5px solid var(--ink);
    border-radius: 999px;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .leise {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(15 * var(--px));
    text-decoration: underline;
    text-underline-offset: 4px;
    cursor: pointer;
  }

  .bleibt {
    margin-top: 16px;
  }
</style>
