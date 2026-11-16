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
  import { homescreenNochmal } from '../ui/homescreen';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { tonStil } from '../ui/personTon';
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

{#snippet zeile(m: Mitglied, zusatz: boolean)}
  <li class="zeile">
    <!-- DP39, 1.1: Zeichen in der App-Farbe; Bürgen mit Umriss in der Druckfarbe. -->
    <span
      class="zeichen person-ton"
      class:zusatz
      style={tonStil(m.zugehoerigkeit.farbe)}
      aria-hidden="true"
    ></span>
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
    <!-- DP35 R2: kein Wort am Rand; die ganze Zeile öffnet die Person, mit Pfeil. -->
    <a class="aendern" href="#/person-aendern/{m.person.id}{suffix}"
      ><span class="visually-hidden">{t('allgemein.aendern')} {m.person.vorname}</span><Symbol
        name="weiter"
        groesse={16}
      /></a
    >
  </li>
{/snippet}

{#snippet zaehler(feld: 'kinder' | 'weitereErwachsene', titel: string, hinweis: string)}
  <div class="zaehler">
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

{#snippet plusZeile(text: string, grund: string, href: string)}
  <li class="zeile plus">
    <span class="plus-zeichen"><Symbol name="plus" groesse={20} /></span>
    <a class="tx plus-link" {href}><b>{text}</b><small>{grund}</small></a>
  </li>
{/snippet}

{#snippet mitmieterFeld()}
  {#if vertrag.length <= 1}
    {@render plusZeile(
      t('einrichtung.haushalt.mitmieter'),
      t('einrichtung.haushalt.mitmieterHinweis'),
      `#/person-neu/mitmieter${suffix}`,
    )}
  {:else}
    {@render plusZeile(
      t('einrichtung.haushalt.weiterePerson'),
      t('einrichtung.haushalt.weiterePersonHinweis'),
      `#/person-neu/mitmieter${suffix}`,
    )}
  {/if}
{/snippet}

{#snippet buergeFeld()}
  {@render plusZeile(
    buergen.length ? t('einrichtung.haushalt.buergeWeiterer') : t('einrichtung.haushalt.buerge'),
    t('einrichtung.haushalt.buergeHinweis'),
    `#/person-neu/buerge${suffix}`,
  )}
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

  {#if haushalt}
    <!-- DP39, Abschnitt 5: Gruppen als Etikett über einer Karte; Personen als Zeilen, keine Farbflächen. -->
    <section class="hh-gruppe">
      <h2>{t('uebersicht.abschnittVertrag')}</h2>
      <ul class="liste">
        {#each vertrag as m (m.person.id)}
          {@render zeile(m, false)}
        {/each}
        {@render mitmieterFeld()}
      </ul>
    </section>
    <section class="hh-gruppe">
      <h2>{t('einrichtungZwei.ziehenMitEin')}</h2>
      <div class="zaehler-kasten">{@render zaehlerBeide()}</div>
    </section>
    <section class="hh-gruppe">
      <div class="gruppe-kopf">
        <h2>{t('uebersicht.abschnittBuergen')}</h2>
        <p class="gruppe-satz">{t('uebersicht.zusatzZeile')}</p>
      </div>
      <ul class="liste">
        {#each buergen as m (m.person.id)}
          {@render zeile(m, true)}
        {/each}
        {@render buergeFeld()}
      </ul>
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
                    <a class="textlink grau" href="#/person-loeschen/{m.person.id}"
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
                    <a class="textlink grau" href="#/person-loeschen/{m.person.id}"
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
    /* DP33 A7: Zurück in Akzent, wie im Heft. */
    color: var(--accent-text);
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

  .zusatz {
    border: 2px solid var(--farbe);
    background: var(--surface);
    color: var(--ink);
  }

  .rolle {
    font-size: calc(14 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 600;
  }

  /* DP35 R2: Pfeil (16 px, grau) statt „Ändern“; die Fläche des Links deckt die ganze Zeile. */
  .aendern {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    color: var(--ink-quiet);
    text-decoration: none;
  }

  .aendern::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .zeile {
    position: relative;
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
    gap: 12px;
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

  .zaehler-kasten .zaehler {
    margin: 0;
    padding: 6px 0;
  }

  .zaehler-kasten .zaehler + .zaehler {
    border-top: 1px solid var(--track);
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

  .drei-monate {
    margin: 8px 0 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 700;
  }

  /* DP39, Abschnitt 5 */
  .hh-gruppe {
    margin: 24px 16px 0;
  }

  .hh-gruppe h2 {
    margin: 0 4px 8px;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .gruppe-kopf {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 0 12px;
    margin: 0 4px 8px;
  }

  .gruppe-kopf h2 {
    margin: 0;
  }

  .gruppe-kopf .gruppe-satz {
    margin: 0;
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
  }

  .liste,
  .zaehler-kasten {
    margin: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .zeile {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 60px;
    padding: 12px 16px;
  }

  .zeile + .zeile {
    border-top: 1px solid var(--track);
  }

  .zeichen {
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--p-app);
  }

  .zeichen.zusatz {
    background: none;
    box-shadow: inset 0 0 0 2px var(--p-linie);
  }

  .zeile b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 650;
  }

  .zeile .rolle {
    margin-left: 8px;
    font-size: calc(14 * var(--px));
    font-weight: 400;
    color: var(--ink-muted);
  }

  .zeile small {
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .plus-zeichen {
    display: flex;
    flex: none;
  }

  .zeile.plus {
    padding-top: 0;
    padding-bottom: 0;
  }

  /* Die ganze Zeile ist der Link, mindestens 60 px hoch (C5). */
  .plus-link {
    display: flex;
    flex: 1;
    flex-direction: column;
    justify-content: center;
    align-self: stretch;
    min-height: 60px;
    padding: 12px 0;
    color: var(--ink);
    text-decoration: none;
  }

  /* Die ganze Zeile nimmt den Tipp. */
  .plus-link::after {
    content: '';
    position: absolute;
    inset: 0;
  }

  .zaehler-kasten .zaehler {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    min-height: 60px;
    margin: 0;
    padding: 12px 16px;
  }

  .zaehler-kasten .zaehler + .zaehler {
    border-top: 1px solid var(--track);
  }

  .stufen button {
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 22px;
    background: var(--track);
    color: var(--ink);
  }

  .stufen button:disabled {
    opacity: 0.4;
  }
</style>
