<script lang="ts">
  // Personenseite nach DP39, Abschnitt 2 (Richtung B): Kopf in der Tönung der Person mit Name, Rolle und Einkommen;
  // darunter der Stand als Karte „{n} von {N} da“ mit der Haarlinie (W19), dann die Unterlagen als Zeilen,
  // „Kann helfen“ und „Meist unnötig“ als Zeilen zum Aufklappen. Rot nur für Zurück (DP35, W5).
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
    lagenVon,
    personZeilen,
    rollenText,
    type UnterlagenStand,
  } from '../domain/regelkatalog';
  import { t, tagZusammen } from '../i18n';
  import { mietFrageOffen } from '../domain/mietFrage';
  import { einzugText } from '../domain/bewerben';
  import { erklaerungFuer, erklaerungTag } from '../domain/buergschaft';
  import { heftTitel } from '../domain/heftKarte';
  import { lage } from '../domain/heftLage';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Haarlinie, { type HaarStueck } from '../ui/Haarlinie.svelte';
  import { passend } from '../ui/passend';
  import { tonStil } from '../ui/personTon';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Symbol from '../ui/Symbol.svelte';
  import { keinerText, lagenText, mitLage, ohneDatum, standText, tagKurz } from '../ui/texte';
  import { anrede } from '../i18n/anrede.svelte';
  import { monatName } from '../i18n';
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
  const buerge = $derived(stand?.rolle === 'buerge');
  // Auf dem Weg: übliche und vorhandene freiwillige Unterlagen. Der Rest unter „Kann helfen“ und „Meist unnötig“.
  const weitere = $derived(
    stand ? stand.unterlagen.filter((u) => !stand.pfad.includes(u) && !u.typ.jeWohnung) : [],
  );
  // DP49 Punkt 5: Was je Wohnung gilt (Bürgschaftserklärung), steht in einem eigenen Abschnitt, freiwillig.
  const jeWohnung = $derived(stand ? stand.unterlagen.filter((u) => u.typ.jeWohnung) : []);
  /** „Lindenring 3: vom 20. Oktober. Lindenring 8: noch keine.“ Abgelegte Hefte bleiben weg. */
  function wohnungenText(u: UnterlagenStand): string {
    const ansicht = daten.ansicht;
    if (!ansicht) return standText(u);
    const heute = new Date();
    const teile = daten.hefte
      .filter((h) => !lage(h.ereignisse, heute, true).abgelegt)
      .map((h) => {
        const e = erklaerungFuer(id, ansicht.dokumente, ansicht.versionen, h.id);
        const wohnung = heftTitel(h).text;
        return e.eigene
          ? t('personenseite.erklaerungVom', {
              wohnung,
              datum: tagZusammen(einzugText(erklaerungTag(e.eigene), heute)),
            })
          : t('personenseite.erklaerungKeine', { wohnung });
      });
    const ohne = u.versionen.filter((v) => !v.heftId).at(-1);
    if (ohne)
      teile.push(
        t('personenseite.erklaerungOhneWohnung', {
          datum: tagZusammen(einzugText(erklaerungTag(ohne), heute)),
        }),
      );
    return teile.length ? teile.join(' ') : standText(u);
  }
  const offen = $derived(
    stand?.unterlagen.filter((u) => u.status === 'fehlt' || u.status === 'bald').length ?? 0,
  );
  const da = $derived(stand?.pfad.filter((u) => u.status === 'da').length ?? 0);

  // DP47b K1: „Leistungen vom Amt“ und „Angestellt“, Schalter aus: Hinweis unter der Liste.
  const amtOhneGehalt = $derived(
    !!stand &&
      !stand.person.einkommenTrotzdem &&
      lagenVon(stand.person).some((l) => l.situation === 'leistungsbezug') &&
      lagenVon(stand.person).some((l) => l.situation === 'angestellt'),
  );

  const UND = new Intl.ListFormat('de-DE', { type: 'conjunction' });
  /** DP45 G3: „Neu im Job: Oktober und Arbeitsvertrag“, sobald alles da ist. */
  function neuImJobZeile(u: UnterlagenStand): string | null {
    // Nur bei „Neu im Job“: Sonst hängt der Vertrag nur freiwillig an (G4) und die Zeile bleibt wie immer.
    if (u.neuSeit === undefined || !u.zusatz || u.status !== 'da') return null;
    const teile = [
      ...u.monate.map((m) => monatName(m)),
      ...(u.zusatz.versionen.length ? [t('neuImJob.zeileVertrag')] : []),
    ];
    return t('neuImJob.zeile', { teile: UND.format(teile) });
  }
  const stuecke = $derived<HaarStueck[]>(
    (stand?.pfad ?? []).map((u) => ({
      text: ohneTrennstellen(listenText(u.typ)),
      symbol: u.typ.symbol,
      zustand: u.status === 'da' ? 'fertig' : 'offen',
    })),
  );
  const unterzeile = $derived(
    stand
      ? [
          rollenText(stand.rolle, stand.bezeichnung),
          ...(buerge ? [t('personenseite.ziehtNicht')] : []),
          stand.person.lebenssituation
            ? (lagenText(stand.person) ?? '') +
              // DP45 G3: „Angestellt, seit 1. Oktober“.
              (stand.person.neuImJob?.seit
                ? `, ${t('neuImJob.kopf', { datum: tagKurz(stand.person.neuImJob.seit) })}`
                : '')
            : null,
        ]
          .filter(Boolean)
          .join(' · ')
      : '',
  );

  /** Die Zeile öffnet die Seite der Unterlage (UL1), „Datum eintragen“ gleich das Feld (UL3). */
  function ziel(u: UnterlagenStand): string {
    if (u.typ.inAppErstellt) return `#/selbstauskunft/${id}`;
    return `#/unterlage/${id}/${u.typ.id}${ohneDatum(u) ? '/datum' : ''}`;
  }
  /** DP39: Was noch fehlt, steht in Tinte 600, nicht in Rot (DP35). */
  const offenZeile = (u: UnterlagenStand) => u.status === 'fehlt' || u.status === 'bald';

  // Prüfhinweis als Unterzeile: „Bitte prüfen: Dieselbe Datei in drei Monaten“.
  const pruefFunde = $derived(pruefhinweise(haushaltStaende(daten.ansicht)));
  function bitte(u: UnterlagenStand): string | null {
    const h = pruefFunde.get(`${id}/${u.typ.id}`);
    if (!h) return null;
    const rufname = stand?.person.rufname || stand?.person.vorname || '';
    return t('pruef.bitte', { kurz: pruefAnzeige(h, rufname).kurz });
  }

  /** Löscht alle Versionen der Unterlage (OR7), per Wischen; „Rückgängig“ holt sie zurück. */
  async function unterlageWeg(u: UnterlagenStand) {
    const verbindung = await db();
    const vorher = await versionenAendern(verbindung, {
      loeschen: u.versionen.map((v) => v.id),
    });
    await neuLaden();
    rueckgaengigAnbieten({
      text: t('unterlage.geloescht', { titel: ohneTrennstellen(listenText(u.typ)) }),
      seite: `/person/${id}`,
      ausfuehren: async () => {
        // Frisch holen: iOS beendet Verbindungen, wenn die App im Hintergrund war.
        await versionenZurueck(await db(), vorher);
        await neuLaden();
      },
    });
  }

  // „Kann helfen“, „Meist unnötig“ und „Nicht mehr nötig“ klappen auf; nichts davon ist offen.
  let auf = $state<Record<string, boolean>>({});

  const NAME = ['34px/36px', '30px/32px', '26px/28px'];
</script>

{#snippet zeile(u: UnterlagenStand)}
  {@const loeschbar = !u.typ.inAppErstellt && u.versionen.length > 0}
  <li>
    <WischZeile
      aktiv={loeschbar}
      beimLoeschen={() => unterlageWeg(u)}
      loeschenText={t('person.unterlageWeg', { unterlage: ohneTrennstellen(listenText(u.typ)) })}
    >
      <a class="zeile" href={ziel(u)}>
        <span class="zeichen"><Symbol name={u.typ.symbol} groesse={20} /></span>
        <span class="tx">
          <b>{listenText(u.typ)}</b>
          <small class:offen={offenZeile(u) && !bitte(u)}
            >{bitte(u) ??
              (u.keinerMoeglich
                ? keinerText(u.keinerMoeglich, stand!.bezeichnung, anrede.wert === 'du')
                : null) ??
              mitLage(u, neuImJobZeile(u) ?? standText(u))}</small
          >
          {#if ohneDatum(u)}<span class="datum-eintragen">{t('person.datumEintragen')}</span>{/if}
        </span>
        <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
      </a>
    </WischZeile>
  </li>
{/snippet}

{#snippet mehr(schluessel: string, titel: string, liste: UnterlagenStand[], hinweis: string)}
  <li>
    <button
      type="button"
      class="mehr"
      aria-expanded={!!auf[schluessel]}
      onclick={() => (auf[schluessel] = !auf[schluessel])}
    >
      <span>{titel} <em>{liste.length}</em></span>
      <span class="pfeil" class:offen-pfeil={auf[schluessel]}
        ><Symbol name="weiter" groesse={16} /></span
      >
    </button>
    {#if auf[schluessel]}
      <p class="hinweis">{hinweis}</p>
      <ul class="unterliste">
        {#each liste as u (u.typ.id)}
          {@render zeile(u)}
        {/each}
      </ul>
    {/if}
  </li>
{/snippet}

<main class="seite">
  <div class="kopf">
    <Zurueck href="#/" text={t('tabs.mappe')} />
    {#if stand}
      <a class="aendern" href="#/person-aendern/{id}/person">{t('person.aendern')}</a>
    {/if}
  </div>
  {#if !stand || !mitglied}
    <p class="leer">{t('person.nichtGefunden')}</p>
  {:else}
    <div class="person-ton tafel" style={tonStil(stand.farbe)}>
      <div class="name-karte">
        <h1 class="name" use:passend={NAME}>{stand.person.vorname}</h1>
        <p class="unter">{unterzeile}</p>
      </div>

      <div class="karte stand">
        <div class="stand-kopf">
          <p class="zahl">{t('personenseite.stand', { da, gesamt: stand.pfad.length })}</p>
          <p class="ziel" class:startklar={offen === 0}>
            {offen === 0 ? t('personenseite.startklar') : t('personenseite.fuerMappe')}
          </p>
        </div>
        <div class="linie"><Haarlinie {stuecke} /></div>
      </div>
    </div>

    <ul class="karte liste">
      {#each personZeilen(stand) as u (u.typ.id)}
        {@render zeile(u)}
      {/each}
      {#if mietFrageOffen(stand.person, stand.rolle, daten.hefte)}
        <!-- PC65: Nach einer Zusage steht die offene Frage bei den offenen Dingen, nicht in Rot (W5). -->
        <li class="miet-offen">
          <a class="zeile" href="#/selbstauskunft/{id}">
            <span class="zeichen"><Symbol name="selbstauskunft" groesse={20} /></span>
            <span class="tx">
              <b>{t('stand.zusage.mietrueck')}</b>
              <small class="offen">{t('stand.zusage.mietrueckUnter')}</small>
            </span>
            <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
          </a>
        </li>
      {/if}
    </ul>
    {#if amtOhneGehalt}
      <!-- DP47b K1: Amt und Schalter aus: Die Gehaltsnachweise fehlen mit Absicht. -->
      <p class="amt-hinweis">{t('einkommenQuellen.personHinweis')}</p>
    {/if}

    {#if jeWohnung.length}
      <h2 class="je-wohnung">{t('personenseite.jeWohnung')}</h2>
      <ul class="karte liste je-wohnung-liste">
        {#each jeWohnung as u (u.typ.id)}
          <li>
            <a class="zeile" href={ziel(u)}>
              <span class="zeichen"><Symbol name={u.typ.symbol} groesse={20} /></span>
              <span class="tx">
                <b>{listenText(u.typ)}</b>
                <small>{wohnungenText(u)}</small>
              </span>
              <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
            </a>
          </li>
        {/each}
      </ul>
      {#if jeWohnung[0]?.typ.hilfe}<p class="hinweis je-wohnung-satz">
          {jeWohnung[0].typ.hilfe}
        </p>{/if}
    {/if}

    {#if weitere.length || stand.nichtMehrNoetig.length}
      <ul class="karte liste">
        {#each ['kann_helfen', 'meist_unnoetig'] as const as etikett (etikett)}
          {@const liste = weitere.filter((u) => u.typ.etikett === etikett)}
          {#if liste.length}
            {@render mehr(etikett, etikettText(etikett), liste, etikettBeschreibung(etikett))}
          {/if}
        {/each}
        <!-- Rolle oder Lebenslage haben sich geändert: Es bleibt gespeichert und kommt nicht in die Mappe. -->
        {#if stand.nichtMehrNoetig.length}
          {@render mehr(
            'nicht_mehr',
            t('person.nichtMehrNoetig'),
            stand.nichtMehrNoetig,
            t('person.nichtMehrNoetigHinweis'),
          )}
        {/if}
      </ul>
    {/if}
  {/if}
</main>
{#if stand}
  {#if offen}
    <Aktionsleiste
      text={t('person.unterlagenHinzufuegen')}
      zusatz={t('person.offenZusatz', { anzahl: offen })}
      href="#/rutsch/{id}"
    />
  {:else}
    <!-- DP39: Ist alles da, wird der Knopf leise und öffnet, was noch helfen kann. -->
    <Aktionsleiste
      text={t('personenseite.unterlageHinzufuegen')}
      leise
      onclick={() => {
        auf['kann_helfen'] = true;
        document.querySelector('.mehr')?.scrollIntoView({ block: 'center' });
      }}
    />
  {/if}
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(20px + env(safe-area-inset-top)) 0
      max(calc(140px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 52px;
    padding: 0 16px 0 12px;
  }

  .aendern {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 600;
    text-decoration: none;
  }

  .leer {
    padding: 0 16px;
  }

  .tafel {
    margin: 4px 16px 0;
  }

  .name-karte {
    padding: 20px;
    border-radius: 20px;
    background: var(--p-tint);
    color: var(--ink);
  }

  .name {
    max-width: 100%;
    margin: 0;
    font-size: calc(34 * var(--px));
    line-height: calc(36 * var(--px));
    font-weight: 800;
    font-stretch: 125%;
    letter-spacing: -0.01em;
    hyphens: manual;
    overflow-wrap: normal;
  }

  .unter {
    margin: 8px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .karte {
    border-radius: 20px;
    background: var(--surface);
  }

  .stand {
    margin-top: 12px;
    padding: 16px 16px 4px;
  }

  .stand-kopf {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .zahl {
    margin: 0;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 650;
  }

  .ziel {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .ziel.startklar {
    color: var(--ink);
    font-weight: 600;
  }

  .linie {
    margin: 12px 0 8px;
  }

  .liste {
    margin: 12px 16px 0;
    padding: 0;
    list-style: none;
    overflow: hidden;
  }

  .liste > li + li,
  .unterliste > li {
    border-top: 1px solid var(--track);
  }

  .unterliste {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 60px;
    padding: 12px 16px;
    color: var(--ink);
    text-decoration: none;
  }

  .zeichen {
    display: flex;
    flex-shrink: 0;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 600;
    hyphens: manual;
  }

  .tx small {
    margin-top: 2px;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .tx small.offen {
    color: var(--ink);
    font-weight: 600;
  }

  .pfeil {
    display: flex;
    flex-shrink: 0;
    color: var(--ink-quiet);
  }

  .offen-pfeil {
    transform: rotate(90deg);
  }

  .mehr {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    min-height: 52px;
    padding: 0 20px;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(16 * var(--px));
    font-weight: 600;
    text-align: left;
    cursor: pointer;
  }

  .mehr em {
    margin-left: 8px;
    font-style: normal;
    font-weight: 400;
    font-size: calc(14 * var(--px));
    color: var(--ink-muted);
  }

  .je-wohnung {
    margin: 20px 20px 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
    font-weight: 650;
  }

  .je-wohnung-liste {
    margin-top: 8px;
  }

  .je-wohnung-satz {
    margin: 8px 20px 0;
  }

  .hinweis {
    margin: 0 20px 12px;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  /* Ohne Datum: „Datum eintragen“ in Tinte 600; die ganze Zeile öffnet das Feld. */
  .datum-eintragen {
    margin-top: 4px;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 600;
  }
  .amt-hinweis {
    margin: 8px var(--space-5) 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }
</style>
