<script lang="ts">
  // Personenansicht in Stil C (Entwürfe P1 bis P3): Karte in der Personenfarbe (Bürgen weiß mit
  // Rahmen und „Zusatz“), das Band waagerecht mit den Steinen der Person, ohne Ziel, darunter die
  // Unterlagen mit ihrem Stand in Worten. Freiwillige und meist unnötige hinter einem Textlink.
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { pruefhinweise } from '../domain/pruefhinweise';
  import { versionenAendern, versionenZurueck } from '../storage/speicher';
  import { haushaltStaende } from '../ui/pruefDaten';
  import { pruefAnzeige } from '../ui/pruefTexte';

  import WischZeile from '../ui/WischZeile.svelte';

  import {
    etikettBeschreibung,
    etikettText,
    listenText,
    ohneTrennstellen,
    personStand,
    rollenText,
    situationText,
    type UnterlagenStand,
  } from '../domain/regelkatalog';
  import { t, zahlwort } from '../i18n';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Eingeklappt from '../ui/Eingeklappt.svelte';
  import BandQuer, { type QuerStein } from '../ui/BandQuer.svelte';
  import { passend } from '../ui/passend';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Symbol from '../ui/Symbol.svelte';
  import { ohneDatum, standText } from '../ui/texte';
  import Zurueck from '../ui/Zurueck.svelte';

  let { id }: { id: string } = $props();

  const mitglied = $derived(daten.ansicht?.mitglieder.find((m) => m.person.id === id));
  const stand = $derived(
    mitglied && daten.ansicht
      ? personStand(
          mitglied.person,
          mitglied.zugehoerigkeit,
          daten.ansicht.dokumente,
          daten.ansicht.versionen,
          undefined,
          haushaltsAngabenAus(daten.ansicht),
        )
      : null,
  );
  const zusatz = $derived(stand?.rolle === 'buerge');
  // Auf dem Weg: übliche und vorhandene freiwillige Unterlagen. Der Rest hinter „weitere zeigen“.
  const weitere = $derived(stand ? stand.unterlagen.filter((u) => !stand.pfad.includes(u)) : []);
  const offen = $derived(
    stand?.unterlagen.filter((u) => u.status === 'fehlt' || u.status === 'bald').length ?? 0,
  );
  const steine = $derived<QuerStein[]>(
    (stand?.pfad ?? []).map((u) => ({
      farbe: stand!.farbe,
      art: u.status === 'da' ? 'drin' : u.status === 'bald' ? 'bald' : 'weg',
    })),
  );

  /** Die Zeile öffnet die Seite der Unterlage (UL1), „Datum eintragen“ gleich das Feld (UL3). */
  function ziel(u: UnterlagenStand): string {
    if (u.typ.inAppErstellt) return `#/selbstauskunft/${id}`;
    return `#/unterlage/${id}/${u.typ.id}${ohneDatum(u) ? '/datum' : ''}`;
  }

  function steinArt(u: UnterlagenStand): 'da' | 'bald' | 'fehlt' {
    if (u.status === 'da' || (u.status === 'optional' && u.versionen.length)) return 'da';
    return u.status === 'bald' ? 'bald' : 'fehlt';
  }

  let bearbeiten = $state(false);

  // Prüfhinweis als Unterzeile: „Bitte prüfen: Dieselbe Datei in drei Monaten“.
  const pruefFunde = $derived(pruefhinweise(haushaltStaende(daten.ansicht)));
  function bitte(u: UnterlagenStand): string | null {
    const h = pruefFunde.get(`${id}/${u.typ.id}`);
    if (!h) return null;
    const rufname = stand?.person.rufname || stand?.person.vorname || '';
    return t('pruef.bitte', { kurz: pruefAnzeige(h, rufname).kurz });
  }

  /** Löscht alle Versionen der Unterlage (OR7); „Rückgängig“ holt sie zurück. */
  async function unterlageWeg(u: UnterlagenStand) {
    const verbindung = await db();
    const stand = await versionenAendern(verbindung, { loeschen: u.versionen.map((v) => v.id) });
    await neuLaden();
    rueckgaengigAnbieten({
      text: t('unterlage.geloescht', { titel: ohneTrennstellen(listenText(u.typ)) }),
      seite: `/person/${id}`,
      ausfuehren: async () => {
        // Frisch holen: iOS beendet Verbindungen, wenn die App im Hintergrund war.
        await versionenZurueck(await db(), stand);
        await neuLaden();
      },
    });
  }

  const NAME = ['30px/32px', '26px/28px', '22px/26px'];
</script>

{#snippet zeile(u: UnterlagenStand)}
  {@const loeschbar = !u.typ.inAppErstellt && u.versionen.length > 0}
  <li class="bearbeitbar">
    <WischZeile aktiv={loeschbar} beimLoeschen={() => unterlageWeg(u)}>
      <a class="zeile" href={ziel(u)}>
        <span class="stein stein-{steinArt(u)}" aria-hidden="true"
          ><Symbol name={u.typ.symbol} groesse={16} /></span
        >
        <span class="tx">
          <b>{listenText(u.typ)}</b>
          <small>{bitte(u) ?? standText(u)}</small>
          {#if ohneDatum(u)}<span class="datum-eintragen">{t('person.datumEintragen')}</span>{/if}
        </span>
        {#if !(bearbeiten && loeschbar)}<Symbol name="weiter" groesse={18} />{/if}
      </a>
    </WischZeile>
    {#if bearbeiten && loeschbar}
      <button
        type="button"
        class="loesch-knopf"
        aria-label={t('person.unterlageWeg', { unterlage: ohneTrennstellen(listenText(u.typ)) })}
        onclick={() => unterlageWeg(u)}>{t('allgemein.loeschen')}</button
      >
    {/if}
  </li>
{/snippet}

<main class="seite farbe-{stand?.farbe ?? 1}">
  <div class="kopf">
    <Zurueck href="#/" text={t('person.zurueck')} />
    {#if stand}
      <a class="textlink" href="#/person-aendern/{id}/person">{t('person.aendern')}</a>
    {/if}
  </div>
  {#if !stand || !mitglied}
    <p class="leer">{t('person.nichtGefunden')}</p>
  {:else}
    <div class="karte" class:zusatz>
      <div class="kopfzeile">
        <h1 class="name" use:passend={NAME}>{stand.person.vorname}</h1>
        <span class="rolle">{rollenText(stand.rolle, stand.bezeichnung)}</span>
        {#if zusatz}<span class="marke">{t('allgemein.zusatz')}</span>{/if}
      </div>
      <p class="lage">
        {stand.person.lebenssituation
          ? situationText(stand.person.lebenssituation, stand.person.ausbildungArt)
          : t('person.keineLage')}
      </p>
    </div>
    <BandQuer
      {steine}
      haus={false}
      beschriftung={t('person.bandLabel', {
        name: stand.person.rufname || stand.person.vorname,
        da: zahlwort(stand.pfad.filter((u) => u.status === 'da').length),
        gesamt: zahlwort(stand.pfad.length),
      })}
    />

    <section>
      <div class="abschnitt-kopf">
        <h2>{t('person.unterlagen')}</h2>
        {#if stand.unterlagen.some((x) => !x.typ.inAppErstellt && x.versionen.length)}
          <button type="button" class="textlink" onclick={() => (bearbeiten = !bearbeiten)}
            >{bearbeiten ? t('allgemein.fertig') : t('allgemein.bearbeiten')}</button
          >
        {/if}
      </div>
      <ul class="liste">
        {#each stand.pfad as u (u.typ.id)}
          {@render zeile(u)}
        {/each}
      </ul>
    </section>

    <!-- „Kann helfen“ und „Meist unnötig“ eingeklappt: Sie sind nicht offen, nur möglich. -->
    {#each ['kann_helfen', 'meist_unnoetig'] as const as etikett (etikett)}
      {@const liste = weitere.filter((u) => u.typ.etikett === etikett)}
      {#if liste.length}
        <div class="eingeklappt">
          <Eingeklappt titel="{etikettText(etikett)} ({liste.length})">
            <p class="hinweis">{etikettBeschreibung(etikett)}</p>
            <ul class="liste">
              {#each liste as u (u.typ.id)}
                {@render zeile(u)}
              {/each}
            </ul>
          </Eingeklappt>
        </div>
      {/if}
    {/each}

    <!-- Rolle oder Lebenslage haben sich geändert: Es bleibt gespeichert und kommt nicht in die Mappe. -->
    {#if stand.nichtMehrNoetig.length}
      <div class="eingeklappt">
        <Eingeklappt titel="{t('person.nichtMehrNoetig')} ({stand.nichtMehrNoetig.length})">
          <p class="hinweis">{t('person.nichtMehrNoetigHinweis')}</p>
          <ul class="liste">
            {#each stand.nichtMehrNoetig as u (u.typ.id)}
              {@render zeile(u)}
            {/each}
          </ul>
        </Eingeklappt>
      </div>
    {/if}
  {/if}
</main>
{#if stand && offen}
  <Aktionsleiste
    text={t('person.unterlagenHinzufuegen')}
    zusatz={t('person.offenZusatz', { anzahl: offen })}
    href="#/rutsch/{id}"
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

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .leer {
    padding: 0 var(--space-5);
  }

  .karte {
    margin: 8px var(--space-4) 0;
    padding: 14px 16px 12px;
    border-radius: 22px;
    background: var(--farbe);
    color: var(--on-person);
  }

  .karte.zusatz {
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
    max-width: 100%;
    margin: 0;
    font-size: calc(30 * var(--px));
    line-height: calc(32 * var(--px));
    font-weight: 800;
    font-stretch: 118%;
    letter-spacing: -0.6px;
    overflow-wrap: normal;
  }

  .rolle {
    font-size: calc(14 * var(--px));
    font-weight: 500;
  }

  .marke {
    align-self: center;
    padding: 0 8px;
    border: 1.5px solid currentColor;
    border-radius: 10px;
    font-size: calc(12 * var(--px));
    line-height: calc(17 * var(--px));
    font-weight: 700;
  }

  .lage {
    margin: 2px 0 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  section {
    margin: 12px var(--space-4) 0;
  }

  h2 {
    margin: 0 var(--space-1) 8px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .abschnitt-kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 0 var(--space-1) 4px;
  }

  .abschnitt-kopf h2 {
    margin: 0;
  }

  .bearbeitbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .loesch-knopf {
    flex-shrink: 0;
    min-height: 44px;
    margin: 0 0 8px auto;
    padding: 0 12px;
    border: 1.5px solid var(--ink);
    border-radius: 22px;
    background: none;
    color: inherit;
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  .liste {
    margin: 0;
    padding: 0 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .liste li + li {
    border-top: 1px solid var(--track);
  }

  .zeile {
    color: inherit;
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 8px 0;
    border: 0;
    background: none;
    color: var(--ink);
    text-align: left;
    cursor: pointer;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    hyphens: manual;
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .stein {
    display: grid;
    place-items: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: 50%;
  }

  .stein-da {
    background: var(--farbe);
    color: var(--on-person);
  }

  .stein-bald {
    background: var(--surface);
    box-shadow: inset 0 0 0 2.5px var(--ink);
  }

  .stein-fehlt {
    border: 2px dashed var(--ink);
    background: var(--ground);
  }

  .eingeklappt {
    margin: 14px var(--space-4) 0;
  }

  .hinweis {
    margin: 0 var(--space-1) 8px;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  /* Die ganze Zeile öffnet die Versionen; dort lässt sich das Datum nachtragen. */
  .datum-eintragen {
    font-size: calc(14 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
