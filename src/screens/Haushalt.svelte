<script lang="ts">
  // Einrichtung Schritt 2 „Wer gehört noch dazu?“ (design/einrichtung-rutsch-navigation.md): Das Band
  // baut sich mit dem Haushalt auf. Rangfolge über Größe und Ort: Mitmieter groß oben, Zähler klein in
  // der Mitte, Bürge abgesetzt unten. Später „Euer Haushalt“: dieselben Inhalte als ruhige Liste ohne
  // Band, weil sie sich sonst kaum von der Übersicht unterschied (Wunsch des Auftraggebers, 2.11.).
  // Personen hinzufügen und ändern auf eigenem Bildschirm (Entscheidung F). Änderungen gelten sofort.
  import { daten, db, neuLaden, stillLaden } from '../app/daten.svelte';
  import { abschliessen, ersetzen, neuAnfangen, zurueckGehen } from '../app/router.svelte';
  import { einmal } from '../ui/einmal';
  import type { Mitglied } from '../storage/speicher';
  import { rollenText, situationText } from '../domain/regelkatalog';
  import { t, tagZusammen } from '../i18n';
  import {
    haushaltAendern,
    haushaltLoeschen,
    haushaltZaehlen,
    mitgliedZurueckholen,
    zugehoerigkeitAendern,
  } from '../storage/speicher';
  import { dreiMonateHer } from '../domain/zeit';
  import { vollstaendig } from '../domain/selbstauskunft';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Band from '../ui/Band.svelte';
  import Eintragen from '../ui/Eintragen.svelte';
  import { homescreenNochmal } from '../ui/homescreen';
  import { passend } from '../ui/passend';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { herkunftsReiter } from '../ui/herkunft.svelte';
  import { nachLoeschen } from '../app/haushaltGeloescht.svelte';

  let { einrichtung = false }: { einrichtung?: boolean } = $props();
  const herkunft = $derived(herkunftsReiter());

  const mitglieder = $derived(daten.ansicht?.mitglieder ?? []);
  const vertrag = $derived([
    ...mitglieder.filter((m) => m.zugehoerigkeit.rolle === 'hauptmieter'),
    ...mitglieder.filter((m) => m.zugehoerigkeit.rolle === 'mitmieter'),
  ]);
  const buergen = $derived(mitglieder.filter((m) => m.zugehoerigkeit.rolle === 'buerge'));
  // PC10 (DP20): Solange die Einrichtung nicht weiß, wer einzieht, „ihr“. Danach ab zwei Personen „ihr“,
  // allein „du“.
  const leadIhr = $derived.by(() => {
    const hh = daten.ansicht?.haushalt;
    if (!hh || hh.einrichtungOffen) return true;
    return mitglieder.length - buergen.length + hh.kinder + hh.weitereErwachsene > 1;
  });
  const haushalt = $derived(daten.ansicht?.haushalt);
  const suffix = $derived(einrichtung ? '/einrichtung' : '');
  // Lange Namen nie mitten im Wort trennen: lieber kleinere Schrift (wie auf der Übersicht).
  const GROSS = ['24px/26px', '20px/24px', '18px/22px', '16px/20px'];
  const KLEIN = ['20px/24px', '18px/22px', '16px/20px', '14px/18px'];

  const herausgenommen = $derived(daten.ansicht?.herausgenommen ?? []);
  const auskunftFertig = $derived.by(() => {
    const hh = haushaltsAngabenAus(daten.ansicht);
    return mitglieder.filter((m) => vollstaendig(m.person, m.zugehoerigkeit.rolle, hh)).length;
  });
  function unterlagenVon(id: string): number {
    const a = daten.ansicht;
    if (!a) return 0;
    return a.dokumente.filter(
      (d) => d.personId === id && a.versionen.some((v) => v.dokumentId === d.id),
    ).length;
  }
  function tagMonat(iso: string | null | undefined): string {
    if (!iso) return '';
    return tagZusammen(
      new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'long' }).format(new Date(iso)),
    );
  }
  async function behaltenRoh(zugehoerigkeitId: string) {
    await zugehoerigkeitAendern(await db(), zugehoerigkeitId, { behalten: true });
    await neuLaden();
  }
  const behalten = einmal(behaltenRoh);

  async function zurueckholenRoh(zugehoerigkeitId: string) {
    await mitgliedZurueckholen(await db(), zugehoerigkeitId);
    await neuLaden();
  }
  const zurueckholen = einmal(zurueckholenRoh);

  async function zaehlen(feld: 'kinder' | 'weitereErwachsene', schritt: number) {
    if (!haushalt) return;
    await haushaltZaehlen(await db(), haushalt.id, feld, schritt);
    await neuLaden();
  }

  // „Haushalt löschen“ (E96): nur nach dem Blatt. Hefte bleiben und gelten wieder als ohne Haushalt.
  let loeschenOffen = $state(false);
  let geloescht = false;
  async function haushaltWeg() {
    const hh = daten.ansicht?.haushalt;
    if (!hh) return;
    const allein = vertrag.length === 1;
    geloescht = true;
    await haushaltLoeschen(await db(), hh.id);
    loeschenOffen = false;
    await neuLaden();
    nachLoeschen.du = allein;
    nachLoeschen.offen = daten.hefte.length > 0;
    abschliessen('/mappe-start');
  }

  $effect(() => {
    // Ohne Haushalt gibt es hier nichts zu bearbeiten: zurück zum Anfang der Einrichtung.
    if (daten.geladen && !daten.ansicht && !geloescht) ersetzen('/einrichtung');
  });
</script>

{#snippet karte(m: Mitglied, zusatz: boolean)}
  <div
    class="karte farbe-{m.zugehoerigkeit.farbe}"
    class:zusatz
    data-band="p"
    data-farbe={m.zugehoerigkeit.farbe}
    data-duenn={zusatz ? '1' : '0'}
  >
    <div class="kopfzeile">
      <span class="name" use:passend={zusatz ? KLEIN : GROSS}>{m.person.vorname}</span>
      <span class="rolle">{rollenText(m.zugehoerigkeit.rolle, m.zugehoerigkeit.bezeichnung)}</span>
      {#if zusatz}<span class="etikett">{t('allgemein.zusatz')}</span>{/if}
    </div>
    <div class="unterzeile">
      <span class="lage"
        >{m.person.lebenssituation
          ? situationText(m.person.lebenssituation, m.person.ausbildungArt)
          : ''}</span
      >
      <a class="aendern" href="#/person-aendern/{m.person.id}{suffix}"
        >{t('allgemein.aendern')}<span class="visually-hidden"> {m.person.vorname}</span></a
      >
    </div>
  </div>
{/snippet}

{#snippet zeile(m: Mitglied, zusatz: boolean)}
  <li class="zeile">
    <span class="punkt farbe-{m.zugehoerigkeit.farbe}" class:zusatz aria-hidden="true"
      >{m.person.vorname.slice(0, 1)}</span
    >
    <span class="tx">
      <b
        >{m.person.vorname}
        <span class="rolle">{rollenText(m.zugehoerigkeit.rolle, m.zugehoerigkeit.bezeichnung)}</span
        ></b
      >
      <small
        >{m.person.lebenssituation
          ? situationText(m.person.lebenssituation, m.person.ausbildungArt)
          : ''}</small
      >
    </span>
    <a class="aendern" href="#/person-aendern/{m.person.id}{suffix}"
      >{t('allgemein.aendern')}<span class="visually-hidden"> {m.person.vorname}</span></a
    >
  </li>
{/snippet}

{#snippet zaehler(feld: 'kinder' | 'weitereErwachsene', titel: string, hinweis: string)}
  <div class="zaehler" data-band="track">
    <span class="lab">{titel}<small>{hinweis}</small></span>
    <span class="stufen">
      <button
        type="button"
        aria-label="{t('allgemein.weniger')}: {titel}"
        disabled={!haushalt || haushalt[feld] === 0}
        onclick={() => zaehlen(feld, -1)}><Symbol name="minus" groesse={20} /></button
      >
      <b aria-live="polite">{haushalt?.[feld] ?? 0}</b>
      <button
        type="button"
        aria-label="{t('allgemein.mehr')}: {titel}"
        onclick={() => zaehlen(feld, 1)}><Symbol name="plus" groesse={20} /></button
      >
    </span>
  </div>
{/snippet}

{#snippet mitmieterFeld()}
  {#if vertrag.length <= 1}
    <Eintragen
      unterlage={t('einrichtung.haushalt.mitmieter')}
      grund={t('einrichtung.haushalt.mitmieterHinweis')}
      gross
      href="#/person-neu/mitmieter{suffix}"
    />
  {:else}
    <Eintragen
      unterlage={t('einrichtung.haushalt.weiterePerson')}
      grund={t('einrichtung.haushalt.weiterePersonHinweis')}
      href="#/person-neu/mitmieter{suffix}"
    />
  {/if}
{/snippet}

{#snippet buergeFeld()}
  <Eintragen
    unterlage={buergen.length
      ? t('einrichtung.haushalt.buergeWeiterer')
      : t('einrichtung.haushalt.buerge')}
    grund={t('einrichtung.haushalt.buergeHinweis')}
    href="#/person-neu/buerge{suffix}"
  />
{/snippet}

{#snippet zaehlerBeide()}
  {@render zaehler(
    'kinder',
    t('einrichtung.personen.kinder'),
    t('einrichtung.personen.kinderHinweis'),
  )}
  {@render zaehler(
    'weitereErwachsene',
    t('einrichtung.personen.weitere'),
    t('einrichtung.personen.weitereHinweis'),
  )}
{/snippet}

<main class="seite">
  <div class="kopf">
    {#if einrichtung}
      <!-- Schritt 1 ist abgeschlossen (12.11.): Zurück führt zum Reiter, aus dem man kam. -->
      <Zurueck href={herkunft.href} text={herkunft.text} />
      <span class="zaehler-schritt">{t('allgemein.schrittVon', { schritt: 2, gesamt: 2 })}</span>
    {:else}
      <a
        class="zurueck"
        href="#/"
        onclick={(e) => {
          e.preventDefault();
          zurueckGehen('/');
        }}><Symbol name="zurueck" groesse={20} />{t('tabs.mappe')}</a
      >
    {/if}
  </div>
  <div class="titelblock">
    <h1 class="display frage">
      {einrichtung ? t('einrichtung.haushalt.titel') : t('einrichtung.haushalt.titelBearbeiten')}
    </h1>
    <p class="lead">
      {einrichtung
        ? t(leadIhr ? 'einrichtung.haushalt.leadIhr' : 'einrichtung.haushalt.leadDu')
        : t('einrichtung.haushalt.leadBearbeiten')}
    </p>
  </div>
  {#if !einrichtung && mitglieder.length}
    <!-- E3c: Einstieg in den Bereich „Selbstauskünfte“ -->
    <a class="eintrag" href="#/selbstauskuenfte">
      <span class="tx">
        <b>{t('selbstauskuenfte.eintrag')}</b>
        <small
          >{t('selbstauskuenfte.eintragStand', {
            fertig: auskunftFertig,
            gesamt: mitglieder.length,
          })}</small
        >
      </span>
      <Symbol name="weiter" groesse={20} />
    </a>
  {/if}

  {#if haushalt && einrichtung}
    <Band>
      {#if buergen.length}
        <p class="abschnitt" data-band="track">{t('uebersicht.abschnittVertrag')}</p>
      {/if}
      {#each vertrag as m (m.person.id)}
        {@render karte(m, false)}
      {/each}
      <div class="feld" data-band="open">
        {@render mitmieterFeld()}
      </div>

      {@render zaehlerBeide()}

      <p class="abschnitt" data-band="open">{t('uebersicht.abschnittBuergen')}</p>
      <p class="trenner" data-band="open">{t('uebersicht.zusatzZeile')}</p>
      {#each buergen as m (m.person.id)}
        {@render karte(m, true)}
      {/each}
      <div class="feld" data-band="open">
        {@render buergeFeld()}
      </div>
      <div class="zielzeile" data-band-ziel></div>
    </Band>
  {:else if haushalt}
    <section class="hh-gruppe">
      <h2>{t('uebersicht.abschnittVertrag')}</h2>
      <ul class="liste">
        {#each vertrag as m (m.person.id)}
          {@render zeile(m, false)}
        {/each}
      </ul>
      <div class="feld">{@render mitmieterFeld()}</div>
    </section>
    <section class="hh-gruppe">
      <h2>{t('einrichtung.haushalt.abschnittOhneVertrag')}</h2>
      <div class="zaehler-kasten">{@render zaehlerBeide()}</div>
    </section>
    <section class="hh-gruppe">
      <h2>{t('uebersicht.abschnittBuergen')}</h2>
      <p class="gruppe-satz">{t('uebersicht.zusatzZeile')}</p>
      {#if buergen.length}
        <ul class="liste">
          {#each buergen as m (m.person.id)}
            {@render zeile(m, true)}
          {/each}
        </ul>
      {/if}
      <div class="feld">{@render buergeFeld()}</div>
    </section>
  {/if}
  {#if haushalt}
    {#if herausgenommen.length}
      <!-- E3d: Herausgenommene bleiben mit Unterlagen, bis man sie zurückholt oder ganz löscht. -->
      <section class="raus">
        <h2>{t('einrichtung.haushalt.herausgenommen')}</h2>
        <ul>
          {#each herausgenommen as m (m.person.id)}
            {@const zahl = unterlagenVon(m.person.id)}
            {@const frage =
              !!m.zugehoerigkeit.herausgenommenAm &&
              !m.zugehoerigkeit.behalten &&
              dreiMonateHer(m.zugehoerigkeit.herausgenommenAm)}
            <li>
              <span class="kreis" aria-hidden="true">{m.person.vorname.slice(0, 1)}</span>
              <div class="tx">
                <b
                  >{m.person.vorname}
                  <span class="rolle"
                    >{rollenText(m.zugehoerigkeit.rolle, m.zugehoerigkeit.bezeichnung)}</span
                  ></b
                >
                <small
                  >{t('einrichtung.haushalt.seit', {
                    datum: tagMonat(m.zugehoerigkeit.herausgenommenAm),
                  })}
                  {zahl
                    ? t('einrichtung.haushalt.gespeichert', { anzahl: zahl })
                    : t('einrichtung.haushalt.nichtsGespeichert')}</small
                >
                {#if frage}
                  <!-- E3d: eine einzige Frage nach drei Monaten, danach nie wieder. -->
                  <p class="drei-monate">{t('einrichtung.haushalt.dreiMonate')}</p>
                  <span class="aktionen">
                    <a class="textlink" href="#/person-loeschen/{m.person.id}"
                      >{t('einrichtung.haushalt.loeschen')}<span class="visually-hidden">
                        {m.person.vorname}</span
                      ></a
                    >
                    <button
                      type="button"
                      class="textlink"
                      onclick={() => behalten(m.zugehoerigkeit.id)}
                      >{t('einrichtung.haushalt.behalten')}<span class="visually-hidden">
                        {m.person.vorname}</span
                      ></button
                    >
                  </span>
                {/if}
                <span class="aktionen">
                  <button
                    type="button"
                    class="textlink"
                    onclick={() => zurueckholen(m.zugehoerigkeit.id)}
                    >{t('einrichtung.haushalt.zurueckholen')}<span class="visually-hidden">
                      {m.person.vorname}</span
                    ></button
                  >
                  {#if !frage}
                    <a class="textlink" href="#/person-loeschen/{m.person.id}"
                      >{t('einrichtung.haushalt.ganzLoeschen')}<span class="visually-hidden">
                        {m.person.vorname}</span
                      ></a
                    >
                  {/if}
                </span>
              </div>
            </li>
          {/each}
        </ul>
        {#if herausgenommen.some((m) => !m.zugehoerigkeit.behalten && !dreiMonateHer(m.zugehoerigkeit.herausgenommenAm ?? ''))}
          <p class="raus-hinweis">{t('einrichtung.haushalt.dreiMonateHinweis')}</p>
        {/if}
      </section>
    {/if}
    {#if haushalt}
      <button class="haushalt-weg" type="button" onclick={() => (loeschenOffen = true)}
        >{t('einrichtung.haushalt.haushaltLoeschen')}</button
      >
    {/if}
  {/if}
</main>
<Sheet bind:offen={loeschenOffen} titel={t('einrichtung.haushalt.haushaltLoeschenFrage')}>
  <p class="blatt-satz">
    {vertrag.length === 1
      ? t('einrichtung.haushalt.haushaltLoeschenSatzDu')
      : t('einrichtung.haushalt.haushaltLoeschenSatz')}
  </p>
  <button class="blatt-weg" type="button" onclick={haushaltWeg}
    >{t('einrichtung.haushalt.haushaltLoeschen')}</button
  >
  <button class="blatt-abbrechen" type="button" onclick={() => (loeschenOffen = false)}
    >{t('einrichtung.haushalt.abbrechen')}</button
  >
</Sheet>
{#if einrichtung}
  <Aktionsleiste
    text={t('einrichtung.haushalt.anlegen')}
    href={homescreenNochmal(daten.einstellungen) ? '#/homescreen/rutsch' : '#/rutsch'}
    onclick={async () => {
      // Fertig angelegt (B26): Der Tab „Mappe“ zeigt ab jetzt die Mappe, nicht mehr den Stand.
      const hh = daten.ansicht?.haushalt;
      if (hh?.einrichtungOffen) {
        await haushaltAendern(await db(), hh.id, { einrichtungOffen: false });
        await stillLaden();
      }
      neuAnfangen(homescreenNochmal(daten.einstellungen) ? '/homescreen/rutsch' : '/rutsch');
    }}
  />
{:else}
  <Aktionsleiste
    text={t('einrichtung.haushalt.fertig')}
    href="#/"
    onclick={() => abschliessen('/')}
  />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .zurueck {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: var(--tap-target);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 700;
    text-decoration: none;
  }

  .zaehler-schritt {
    font-size: calc(14 * var(--px));
    font-weight: 600;
    color: var(--ink-muted);
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .frage {
    margin-top: 10px;
    text-wrap: balance;
  }

  .karte {
    margin: 0 0 12px var(--spalte);
    padding: 12px 14px;
    border-radius: 20px;
    background: var(--farbe);
    color: var(--on-person);
    box-shadow: 0 8px 18px rgb(25 26 44 / 0.1);
  }

  .farbe-1 {
    --farbe: var(--person-1);
  }
  .farbe-2 {
    --farbe: var(--person-2);
  }
  .farbe-3 {
    --farbe: var(--person-3);
  }
  .farbe-4 {
    --farbe: var(--person-4);
  }

  .farbe-5 {
    --farbe: var(--person-5);
  }

  .farbe-6 {
    --farbe: var(--person-6);
  }

  .zusatz {
    border: 2px solid var(--farbe);
    background: var(--surface);
    color: var(--ink);
  }

  .kopfzeile {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 2px 8px;
  }

  .name {
    font-size: calc(24 * var(--px));
    line-height: calc(26 * var(--px));
    font-weight: 800;
    font-stretch: 118%;
    letter-spacing: -0.5px;
    max-width: 100%;
  }

  .zusatz .name {
    font-size: calc(20 * var(--px));
    line-height: calc(24 * var(--px));
  }

  .rolle {
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 600;
  }

  .etikett {
    align-self: center;
    padding: 0 8px;
    border: 1.5px solid currentColor;
    border-radius: 10px;
    font-size: calc(12 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 700;
  }

  .unterzeile {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
  }

  .lage {
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
  }

  .aendern {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    color: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .feld {
    margin: 0 0 12px var(--spalte);
    --on-person: var(--ink);
    --on-person-muted: var(--ink-muted);
    --slot-fill: var(--ground);
    --stone: var(--ground);
  }

  .zaehler {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 6px 10px;
    min-height: 56px;
    margin: 0 0 12px var(--spalte);
  }

  .lab {
    display: grid;
    flex: 1 1 55%;
    min-width: 55%;
    font-size: calc(15 * var(--px));
    font-weight: 700;
  }

  .lab small {
    font-size: calc(13 * var(--px));
    font-weight: 400;
    color: var(--ink-muted);
  }

  .stufen {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .stufen button {
    display: grid;
    place-items: center;
    width: var(--tap-target);
    height: var(--tap-target);
    border: 2px solid var(--ink);
    border-radius: 50%;
    background: none;
    color: var(--ink);
    font-size: calc(22 * var(--px));
    line-height: 1;
    cursor: pointer;
  }

  .stufen button:disabled {
    border-color: var(--control-border);
    color: var(--ink-muted);
    cursor: not-allowed;
  }

  .stufen b {
    min-width: 16px;
    font-size: calc(20 * var(--px));
    text-align: center;
  }

  .abschnitt {
    margin: 0 0 8px var(--spalte);
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 800;
  }

  .abschnitt + .trenner {
    margin-top: -6px;
  }

  /* Euer Haushalt: Abschnitte mit ruhigen Listen statt Karten am Band. */
  .hh-gruppe {
    margin: var(--space-5) var(--space-4) 0;
  }

  .hh-gruppe h2 {
    margin: 0 var(--space-1) 8px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .gruppe-satz {
    margin: -4px var(--space-1) 8px;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .liste,
  .zaehler-kasten {
    margin: 0;
    padding: 4px 14px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 2px 12px;
    min-height: 60px;
    padding: 6px 0;
  }

  .zeile + .zeile {
    border-top: 1px solid var(--track);
  }

  .punkt {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--farbe);
    color: var(--on-person);
    font-size: calc(15 * var(--px));
    font-weight: 800;
  }

  .punkt.zusatz {
    border: 2px solid var(--farbe);
    background: var(--surface);
    color: var(--ink);
  }

  .zeile .tx {
    display: grid;
    flex: 1 1 min(10em, calc(100% - 44px));
    min-width: 0;
  }

  .zeile b {
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
  }

  .zeile .rolle {
    margin-left: 4px;
    font-size: calc(14 * var(--px));
    font-weight: 600;
  }

  .zeile small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .zeile .aendern {
    margin-left: auto;
  }

  .hh-gruppe .feld {
    margin: 8px 0 0;
  }

  .zaehler-kasten .zaehler {
    margin: 0;
    padding: 6px 0;
  }

  .zaehler-kasten .zaehler + .zaehler {
    border-top: 1px solid var(--track);
  }

  .trenner {
    margin: 0 0 8px var(--spalte);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .eintrag {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 64px;
    margin: var(--space-4) var(--space-4) 0;
    padding: 10px 16px;
    border-radius: 20px;
    background: var(--surface);
    color: var(--ink);
    text-decoration: none;
  }

  .eintrag .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .eintrag b {
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
  }

  .eintrag small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .raus {
    margin: var(--space-6) var(--space-4) 0;
  }

  .raus h2 {
    margin: 0 var(--space-1) 8px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .raus ul {
    margin: 0;
    padding: 4px 14px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .haushalt-weg {
    display: block;
    min-height: var(--tap-target);
    margin: 32px auto 0;
    padding: 0 var(--space-5);
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 700;
  }

  .blatt-satz {
    margin: 0 0 20px;
    color: var(--ink-muted);
  }

  .blatt-weg {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 54px;
    padding: 0 20px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--action);
    color: var(--on-action);
    font: inherit;
    font-weight: 700;
  }

  .blatt-abbrechen {
    display: block;
    width: 100%;
    min-height: var(--tap-target);
    margin-top: 8px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-weight: 700;
  }

  .raus-hinweis {
    margin: 8px var(--space-1) 0;
    color: var(--muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .raus li {
    display: flex;
    gap: 12px;
    padding: 12px 0;
  }

  .raus li + li {
    border-top: 1px solid var(--track);
  }

  .raus .kreis {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border: 2px dashed var(--ink);
    border-radius: 50%;
    font-weight: 800;
  }

  .raus .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .raus b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .raus .rolle {
    margin-left: 6px;
    font-size: calc(13 * var(--px));
    font-weight: 500;
  }

  .raus small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .aktionen {
    display: flex;
    flex-wrap: wrap;
    gap: 0 18px;
  }

  .zielzeile {
    min-height: 56px;
  }

  .drei-monate {
    margin: 8px 0 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 700;
  }
</style>
