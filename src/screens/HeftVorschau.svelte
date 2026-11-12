<script lang="ts">
  // „Ist das die Wohnung?“ (B23 Bildschirm 2, `#s=vorschau`; E72, E76, Planung 11t): Hefta lädt das
  // Inserat genau einmal unsichtbar und zeigt eine kleine Karte. Foto, Portal und Nummer, Titel, Eckdaten,
  // bis zu drei Abweichungen erst nach fertigem Lesen. „Ja, einlesen“ übernimmt nur, was hier gelesen
  // ist; gespeichert wird erst mit „Heft anlegen“. Zurück zur Vorschau lädt nichts neu.
  // Fälle: lädt, Zeit um (8 s), nichts gelesen, kein Netz, Trefferliste, schon gemerkt (E56).
  import { onMount } from 'svelte';
  import { daten } from '../app/daten.svelte';
  import {
    heftaInserat,
    inseratNummer,
    istTrefferliste,
    linkSchluessel,
    type InseratGelesen,
  } from '../app/heftaInserat';
  import { gehe, zurueckGehen } from '../app/router.svelte';
  import { eckdaten, heftTitel } from '../domain/heftKarte';
  import type { Heft } from '../domain/modell';
  import { monatVorher, wichtigsteAbweichungen, type AbweichungsZeile } from '../domain/urteile';
  import { t } from '../i18n';
  import { portalAus, wohnungAus } from '../lesen/angaben';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import { entwurf, entwurfAusVorschau, hatEckdaten, vorschauStand } from '../ui/neuesHeft.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import UrteilZeichen from '../ui/UrteilZeichen.svelte';
  import Zurueck from '../ui/Zurueck.svelte';

  const NB = ' ';
  const plugin = heftaInserat();
  const ihr = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length > 1,
  );
  const hh = $derived(daten.ansicht?.haushalt ?? null);
  const link = $derived(entwurf.link);
  const portal = $derived(portalAus(link));
  const nummer = $derived(inseratNummer(link));
  /** Adresse ohne https:// zum Umbrechen an den Schrägstrichen. */
  const kurz = $derived(link.replace(/^https?:\/\/(www\.)?/, '').replace(/[?#].*$/, ''));

  const schon = $derived.by((): Heft | null => {
    const s = linkSchluessel(link);
    return daten.hefte.find((h) => h.link && linkSchluessel(h.link) === s) ?? null;
  });

  async function laden() {
    if (!plugin || !link) return;
    vorschauStand.link = link;
    vorschauStand.zustand = 'laden';
    vorschauStand.roh = null;
    const g: InseratGelesen = await plugin.vorschau({ url: link });
    if (vorschauStand.link !== link) return;
    vorschauStand.roh = g;
    if (g.zustand === 'ok') {
      entwurfAusVorschau(g, link);
      const nichtDa = (g.http ?? 200) >= 400 || !hatEckdaten(entwurf.angaben);
      vorschauStand.zustand = nichtDa ? 'leer' : 'ok';
    } else vorschauStand.zustand = g.zustand === 'fehler' ? 'leer' : g.zustand;
  }

  onMount(() => {
    if (!link) {
      zurueckGehen('/wohnung-neu');
      return;
    }
    // Schon einmal hier (zurück aus der Kontrolle): nichts neu laden (E72).
    if (vorschauStand.link === link && vorschauStand.zustand !== 'laden') return;
    if (istTrefferliste(link)) {
      vorschauStand.link = link;
      vorschauStand.zustand = 'liste';
      return;
    }
    if (schon) {
      vorschauStand.link = link;
      vorschauStand.zustand = 'schon';
      return;
    }
    void laden();
  });

  const zustand = $derived(vorschauStand.link === link ? vorschauStand.zustand : 'laden');

  /** Weiter mit dem, was gelesen ist; bei Zeit um oder leerem Lesen auch mit wenig. */
  function weiter() {
    if (!entwurf.angaben) entwurfAusVorschau(vorschauStand.roh ?? { zustand: 'fehler' }, link);
    gehe('/wohnung-neu/kontrolle');
  }

  function andererLink() {
    void plugin?.vorschauAbbrechen();
    vorschauStand.link = '';
    zurueckGehen('/wohnung-neu');
  }

  const ganzeSeite = () => void plugin?.seite({ url: link });

  const datum = new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' });
  const eur = (n: number) => `${new Intl.NumberFormat('de-DE').format(Math.round(n))}${NB}€`;
  const zahl = (n: number) =>
    new Intl.NumberFormat('de-DE', { maximumFractionDigits: 1 }).format(n);

  /** Die Eckdaten der Karte: warm, Zimmer, Fläche, Stadtteil; nur, was bekannt ist (E78: ganze Euro). */
  const eck = $derived.by(() => {
    const a = entwurf.angaben;
    if (!a) return [];
    const z: { wert: string; wort: string }[] = [];
    if (a.warm != null)
      z.push({ wert: `${a.warmCa ? `ca.${NB}` : ''}${eur(a.warm)}`, wort: t('vorschau.warm') });
    if (a.zimmer != null) z.push({ wert: zahl(a.zimmer), wort: t('vorschau.zimmer') });
    if (a.flaeche != null)
      z.push({
        wert: `${a.flaecheCa ? `ca.${NB}` : ''}${zahl(a.flaeche)}${NB}m²`,
        wort: t('vorschau.flaeche'),
      });
    if (a.stadtteil) z.push({ wert: a.stadtteil, wort: t('vorschau.stadtteil') });
    return z;
  });

  const abgleich = $derived.by(() => {
    const a = entwurf.angaben;
    const wu = hh?.wuensche;
    if (!a || !wu) return null;
    return wichtigsteAbweichungen(wohnungAus(a), wu, {
      netto: hh?.netto ?? null,
      grenze: null,
      ihr,
    });
  });

  /** Angabe mit Wert und Grund (Wortlaute B23 F5): „Warmmiete 1.290 € · 90 € über eurem Höchstwert“. */
  function zeile(z: AbweichungsZeile): { angabe: string; grund: string } {
    const wu = hh?.wuensche;
    const a = entwurf.angaben;
    const k = z.kriterium ?? '';
    const w = z.wert ?? '';
    if (!wu || !a) return { angabe: z.text, grund: '' };
    switch (k) {
      case 'Warmmiete':
        return {
          angabe: `${k} ${w}`,
          grund: t(ihr ? 'vorschau.grundWarmIhr' : 'vorschau.grundWarmDu', {
            betrag: eur((a.warm ?? 0) - wu.warmBis),
          }),
        };
      case 'Zimmer':
        return { angabe: `${w} Zimmer`, grund: t('vorschau.grundAb', { wert: zahl(wu.zimmerAb) }) };
      case 'Fläche':
        return {
          angabe: `${k} ${w}`,
          grund: t('vorschau.grundAb', { wert: `${zahl(wu.flaecheAb)}${NB}m²` }),
        };
      case 'Befristung':
        return {
          angabe: `${k} ${w}`,
          grund: t(ihr ? 'vorschau.grundUnbefristetIhr' : 'vorschau.grundUnbefristetDu'),
        };
      case 'Haustiere':
        return { angabe: `${k} ${t('neuesHeft.tiereNicht')}`, grund: '' };
      case 'Einzug': {
        const e = a.einzug ?? '';
        const grund =
          e > wu.einzugBis
            ? t(ihr ? 'vorschau.grundSpaetIhr' : 'vorschau.grundSpaetDu')
            : e >= monatVorher(wu.einzugVon)
              ? t('vorschau.grundFrueh')
              : t('neuesHeft.grundZuFrueh');
        return { angabe: `${k} ${w}`, grund };
      }
      default:
        return { angabe: z.text, grund: '' };
    }
  }

  const titel = $derived(
    entwurf.angaben ? heftTitel({ adresse: entwurf.adresse, angaben: entwurf.angaben }).text : '',
  );
  const quelle = $derived(
    [portal, nummer ? `${t('vorschau.inserat')} ${nummer}` : null].filter(Boolean).join(' · '),
  );
</script>

<main class="seite">
  <header class="kopf">
    <Zurueck href="#/wohnung-neu" text={t('vorschau.zurueck')} onclick={andererLink} />
  </header>

  {#if zustand === 'laden'}
    <h1 class="h2">{t('vorschau.frage')}</h1>
    <div class="karte laden" aria-busy="true">
      <div class="bild ruhe"></div>
      <div class="t">
        <p class="q">{kurz.split('/')[0]}</p>
        <span class="ph w80"></span><span class="ph w55"></span>
        <div class="eckph">
          <span class="ph"></span><span class="ph"></span><span class="ph"></span>
        </div>
      </div>
    </div>
    <p class="laedt" role="status">{t('vorschau.laedt')}</p>
    <div class="cta">
      <button class="zweit" type="button" onclick={andererLink}>{t('vorschau.andererLink')}</button>
    </div>
  {:else if zustand === 'ok' || zustand === 'schon'}
    {@const alt = zustand === 'schon' ? schon : null}
    {#if !alt}<h1 class="h2">{t('vorschau.frage')}</h1>{/if}
    <article class="karte" class:ohnefoto={!entwurf.bild || alt}>
      {#if alt}
        <p class="schonsatz">
          <Symbol name="haken" groesse={16} />{t(ihr ? 'vorschau.schonIhr' : 'vorschau.schonDu', {
            datum: datum.format(new Date(alt.createdAt)),
          })}
        </p>
      {:else if entwurf.bild}
        <div class="bild"><img src={entwurf.bild} alt="" /></div>
      {/if}
      <div class="t">
        {#if quelle}<p class="q">{quelle}</p>{/if}
        <h2 class="titel">{alt ? heftTitel(alt).text : titel}</h2>
        {#if alt}
          {#if eckdaten(alt)}<p class="eckzeile">{eckdaten(alt)}</p>{/if}
        {:else if eck.length}
          <div class="eck">
            {#each eck as e (e.wort)}<p><b>{e.wert}</b><span>{e.wort}</span></p>{/each}
          </div>
        {/if}
      </div>
      {#if !alt}
        {#if !abgleich}
          <p class="abg ohne">{t('vorschau.ohneWuensche')}</p>
        {:else if abgleich.zeilen.length === 0}
          <p class="abg passt">
            <UrteilZeichen art="passt" groesse={16} />{t(
              ihr ? 'vorschau.passtIhr' : 'vorschau.passtDu',
            )}
          </p>
        {:else}
          <div class="abg">
            <ul class="punkte">
              {#each abgleich.zeilen as z, i (i)}
                {@const p = zeile(z)}
                <li class={z.art}>
                  <UrteilZeichen art={z.art === 'knapp' ? 'knapp' : 'nicht'} /><span
                    ><b>{z.wort}:</b>
                    {p.angabe}{#if p.grund}<span class="grund">{` · ${p.grund}`}</span>{/if}</span
                  >
                </li>
              {/each}
            </ul>
            {#if abgleich.weitere}
              <p class="mehr">{t('vorschau.weitere', { anzahl: abgleich.weitere })}</p>
            {/if}
          </div>
        {/if}
      {/if}
    </article>
    {#if alt}
      <div class="cta">
        <Hauptbutton text={t('vorschau.heftOeffnen')} onclick={() => gehe(`/heft/${alt.id}`)} />
        <button class="ganz" type="button" onclick={ganzeSeite}
          ><Symbol name="datei" groesse={20} />{t('vorschau.ganzeSeite')}</button
        >
      </div>
    {:else}
      <p class="satz">{t(ihr ? 'vorschau.lesesatzIhr' : 'vorschau.lesesatzDu')}</p>
      <div class="cta">
        <Hauptbutton text={t('vorschau.einlesen')} onclick={weiter} />
        <div class="reihe">
          <button class="leise" type="button" onclick={andererLink}
            >{t('vorschau.andererLink')}</button
          >
          <button class="ganz" type="button" onclick={ganzeSeite}
            ><Symbol name="datei" groesse={20} />{t('vorschau.ganzeSeite')}</button
          >
        </div>
      </div>
    {/if}
  {:else}
    <div class="karte still">
      <div class="bild leer"><Symbol name="wohnung" groesse={24} /></div>
      <div class="t">
        <p class="q"><span class="link">{kurz}</span></p>
        {#if zustand === 'zeit'}
          <p class="fh">{t('vorschau.zeitTitel')}</p>
          <p class="fs">{t(ihr ? 'vorschau.zeitIhr' : 'vorschau.zeitDu')}</p>
        {:else if zustand === 'netz'}
          <p class="fh">{t('vorschau.netzTitel')}</p>
          <p class="fs">{t(ihr ? 'vorschau.netzIhr' : 'vorschau.netzDu')}</p>
        {:else if zustand === 'liste'}
          <p class="fh">{t('vorschau.listeTitel')}</p>
          <p class="fs">{t(ihr ? 'vorschau.listeIhr' : 'vorschau.listeDu')}</p>
        {:else}
          <p class="fh">{t('vorschau.leerTitel')}</p>
          <p class="fs">{t('vorschau.leerText')}</p>
        {/if}
      </div>
    </div>
    <div class="cta">
      {#if zustand === 'zeit'}
        <Hauptbutton text={t('vorschau.trotzdemEinlesen')} onclick={weiter} />
      {:else if zustand === 'leer'}
        <Hauptbutton text={t('vorschau.trotzdemAnlegen')} onclick={weiter} />
      {:else if zustand === 'netz'}
        <Hauptbutton text={t('vorschau.nochmal')} onclick={laden} />
      {:else}
        <Hauptbutton text={t('vorschau.andererLink')} onclick={andererLink} />
      {/if}
      {#if zustand !== 'netz'}
        <button class="ganz" type="button" onclick={ganzeSeite}
          ><Symbol name="datei" groesse={20} />{t('vorschau.ganzeSeite')}</button
        >
      {/if}
      {#if zustand !== 'liste'}
        <button class="zweit" type="button" onclick={andererLink}
          >{t('vorschau.andererLink')}</button
        >
      {/if}
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

  h1 {
    margin-bottom: 12px;
  }

  .karte {
    position: relative;
    overflow: hidden;
    border: 1px solid var(--line);
    border-radius: 18px;
    background: var(--surface);
  }

  .karte.ohnefoto {
    border-left: 6px solid var(--accent);
    border-radius: 6px 18px 18px 6px;
  }

  .karte.ohnefoto .t {
    padding-top: 16px;
  }

  .bild {
    display: block;
    aspect-ratio: 16 / 10;
    background: var(--line);
  }

  /* Hochkant-Fotos: Mitte bleibt (E75). */
  .bild img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bild.leer {
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 16 / 7;
    background: var(--ground);
    color: var(--ink-quiet);
  }

  .t {
    padding: 14px 16px 4px;
  }

  .q {
    display: flex;
    gap: 6px;
    margin: 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .link {
    min-width: 0;
    overflow-wrap: anywhere;
  }

  .titel {
    margin: 4px 0 12px;
    font-size: calc(19 * var(--px));
    font-weight: 700;
    line-height: 1.25;
  }

  .karte.ohnefoto .titel {
    margin-top: 6px;
    font-size: calc(21 * var(--px));
  }

  .eck {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 16px;
    margin: 0 0 12px;
  }

  .eck p {
    display: flex;
    flex-direction: column;
    min-width: 0;
    margin: 0;
  }

  .eck b {
    font-size: calc(16 * var(--px));
    font-weight: 700;
    white-space: nowrap;
  }

  .eck span {
    color: var(--ink-muted);
    font-size: calc(12 * var(--px));
  }

  .eckzeile {
    margin: 0 0 12px;
    color: var(--ink-muted);
  }

  .abg {
    margin: 0;
    padding: 12px 16px;
    border-top: 1px solid var(--line);
  }

  .abg.passt {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    color: var(--passt-text);
    font-weight: 650;
  }

  .abg.passt :global(svg) {
    flex: none;
    margin-top: 3px;
  }

  .abg.ohne {
    color: var(--ink-muted);
  }

  .punkte {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .punkte li {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: calc(14 * var(--px));
    line-height: 1.4;
  }

  .punkte li > :global(svg) {
    flex: none;
    margin-top: 2px;
  }

  .punkte li > span {
    flex: 1;
    min-width: 0;
  }

  .punkte b {
    font-weight: 650;
  }

  .punkte li.knapp b {
    color: var(--knapp-text);
  }

  .grund {
    color: var(--ink-muted);
  }

  .mehr {
    margin: 10px 0 0 24px;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .schonsatz {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin: 12px 12px 0;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--ground);
    font-size: calc(14 * var(--px));
    font-weight: 650;
    line-height: 1.35;
  }

  .schonsatz :global(svg) {
    flex: none;
    margin-top: 1px;
    color: var(--passt-text);
  }

  .satz {
    margin: 12px 2px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  .fh {
    margin: 10px 0 4px;
    font-size: calc(19 * var(--px));
    font-weight: 700;
    line-height: 1.25;
  }

  .fs {
    margin: 0 0 12px;
    color: var(--ink-muted);
  }

  .laedt {
    margin: 12px 2px 0;
    color: var(--ink-muted);
  }

  .bild.ruhe {
    background: var(--line);
  }

  .ph {
    display: block;
    height: 14px;
    margin: 8px 0;
    border-radius: 7px;
    background: var(--line);
  }

  .ph.w80 {
    width: 80%;
  }

  .ph.w55 {
    width: 55%;
  }

  .eckph {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-bottom: 12px;
  }

  .cta {
    position: sticky;
    bottom: 0;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    margin: auto calc(-1 * var(--space-4)) 0;
    padding: 16px var(--space-4) calc(env(safe-area-inset-bottom) + 16px);
    background: var(--ground);
    box-shadow: 0 -14px 14px -2px var(--ground);
  }

  .reihe {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0 28px;
  }

  .leise,
  .ganz {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: center;
    min-height: 44px;
    border: 0;
    background: none;
    font: inherit;
    font-weight: 600;
    cursor: pointer;
  }

  .leise {
    color: var(--ink);
  }

  .ganz {
    color: var(--accent-text);
  }

  .zweit {
    min-height: 52px;
    border: 1.5px solid var(--ink);
    border-radius: var(--radius-full);
    background: transparent;
    color: var(--ink);
    font: inherit;
    font-weight: 650;
    cursor: pointer;
  }
</style>
