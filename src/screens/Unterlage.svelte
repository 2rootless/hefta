<script lang="ts">
  // Seite einer Unterlage (design/unterlage-warum-haushalt.md, UL1 bis UL3, UL5, UL6): was in der Mappe
  // ist, ob etwas zu tun ist, ältere Versionen, Notiz. Das Datum lässt sich hier nachtragen.
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { ersetzen, zurueckGehen } from '../app/router.svelte';
  import { einmal } from '../ui/einmal';
  import { pruefcodeStand, pruefhinweise } from '../domain/pruefhinweise';

  import { haushaltStaende } from '../ui/pruefDaten';
  import PruefKasten from '../ui/PruefKasten.svelte';

  import { aktuelleVersionen, vergleichsTag } from '../domain/fristen';
  import type { DateiVersion } from '../domain/modell';
  import {
    listenText,
    personStand,
    warumInhalt,
    type UnterlagenStand,
  } from '../domain/regelkatalog';
  import { monatName, t, tagText } from '../i18n';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { dokumentAendern, versionLoeschen, versionenZurueck } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Eintragen from '../ui/Eintragen.svelte';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import { passend } from '../ui/passend';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { alterGrenze, tagKurzAus, unterlageSatz } from '../ui/texte';
  import { dateiZeile, monatJahr, monatKuerzel, seitenZahl, versionTitel } from '../ui/versionInfo';
  import VersionSeiten from '../ui/VersionSeiten.svelte';
  import WarumBlatt from '../ui/WarumBlatt.svelte';
  import WischZeile from '../ui/WischZeile.svelte';

  import Zurueck from '../ui/Zurueck.svelte';

  let { personId, typId }: { personId: string; typId: string } = $props();

  const mitglied = $derived(daten.ansicht?.mitglieder.find((m) => m.person.id === personId));
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
  const nichtMehr = $derived(stand?.nichtMehrNoetig.find((u) => u.typ.id === typId) ?? null);
  const u = $derived<UnterlagenStand | null>(
    stand?.unterlagen.find((x) => x.typ.id === typId) ?? nichtMehr,
  );
  const zusatz = $derived(stand?.rolle === 'buerge');
  const name = $derived(stand ? stand.person.rufname || stand.person.vorname : '');
  const basis = $derived(`/unterlage/${personId}/${typId}`);

  const neuesteZuerst = (a: DateiVersion, b: DateiVersion) =>
    (b.abrechnungsmonat ?? vergleichsTag(b)).localeCompare(
      a.abrechnungsmonat ?? vergleichsTag(a),
    ) || b.createdAt.localeCompare(a.createdAt);
  const aktuell = $derived(
    u ? aktuelleVersionen(u.versionen, u.typ.serie, u.typ.jeVariante).sort(neuesteZuerst) : [],
  );
  const aeltere = $derived(
    u
      ? u.versionen
          .filter((v) => !aktuell.some((a) => a.id === v.id))
          .slice()
          .sort(neuesteZuerst)
      : [],
  );

  const ohneMappe = $derived(!!nichtMehr || u?.typ.etikett === 'meist_unnoetig');
  // Etwas zu tun: Das wird zur Hauptaktion unten.
  const zuTun = $derived(
    !!u &&
      !nichtMehr &&
      (!u.versionen.length ||
        (!ohneMappe && (u.status === 'fehlt' || u.status === 'bald' || u.veraltet))),
  );
  const hauptText = $derived.by(() => {
    if (!u?.versionen.length) return t('unterlage.hinzufuegen');
    if (u.typ.serie && u.naechsterMonat)
      return t('unterlage.monatHinzufuegen', { monat: monatName(u.naechsterMonat) });
    return t('unterlage.versionHinzufuegen');
  });

  const pruefHinweis = $derived(
    pruefhinweise(haushaltStaende(daten.ansicht)).get(`${personId}/${typId}`) ?? null,
  );

  const warum = $derived(u ? warumInhalt(u.typ) : null);
  const pruefcode = $derived(u ? pruefcodeStand(u) : null);
  const hinweis = $derived(
    u?.veraltet && u.versionen.length
      ? t('unterlage.hinweisZuAlt', { grenze: alterGrenze(u) })
      : pruefcode?.art === 'laeuft'
        ? t('unterlage.pruefcodeLaeuft', { am: tagKurzAus(pruefcode.am) })
        : u?.typ.hinweis,
  );
  let warumOffen = $state(false);
  let warumKnopf = $state<HTMLElement | null>(null);
  function warumZeigen(e: MouseEvent) {
    warumKnopf = e.currentTarget as HTMLElement;
    warumOffen = true;
  }

  // Seitenzahlen stehen nur in der Datei: erst lesen, wenn die Seite sie zeigt.
  let zahlen = $state<Record<string, number | null>>({});
  $effect(() => {
    for (const v of u?.versionen ?? []) {
      if (v.id in zahlen) continue;
      zahlen[v.id] = null;
      void seitenZahl(v).then((anzahl) => (zahlen[v.id] = anzahl));
    }
  });

  let hochladenOffen = $state(false);
  const hochladen = () => import('../ui/Hochladen.svelte');

  let bearbeiten = $state(false);

  async function versionWegRoh(v: DateiVersion) {
    const verbindung = await db();
    const geloescht = await versionLoeschen(verbindung, v.id);
    await neuLaden();

    rueckgaengigAnbieten({
      text: t('unterlage.geloescht', { titel: versionTitel(v) }),
      seite: basis,
      ausfuehren: async () => {
        // Frisch holen: iOS beendet Verbindungen, wenn die App im Hintergrund war.
        await versionenZurueck(await db(), geloescht);
        await neuLaden();
      },
    });
  }
  const versionWeg = einmal(versionWegRoh);

  // Notiz: nur für dich, kommt nicht in die Mappe. Beim freien Namen steht dort der Name der Unterlage.
  const notiz = $derived(u?.typ.freierName ? null : (u?.dokument?.notiz ?? ''));
  let notizOffen = $state(false);
  let notizText = $state('');

  async function notizSpeichern() {
    if (!u) return;
    await dokumentAendern(await db(), personId, u.typ.id, u.typ.serie?.anzahl ?? null, {
      notiz: notizText.trim(),
    });
    await neuLaden();
    notizOffen = false;
  }

  $effect(() => {
    if (u?.typ.inAppErstellt) ersetzen(`/selbstauskunft/${personId}`);
  });
</script>

{#snippet versionKarte(v: DateiVersion, mitDatum: boolean)}
  <div class="karte-weiss">
    <VersionSeiten version={v} />
    <p class="datei">
      {[
        dateiZeile(v, zahlen[v.id]),
        v.variante ? u?.typ.varianten?.find((x) => x.id === v.variante)?.text : null,
        v.gerastert ? t('versionen.gerastert') : null,
      ]
        .filter(Boolean)
        .join(', ')}{#if zahlen[v.id] || v.dateiname}.{/if}
      {t('unterlage.seitenGross')}
    </p>
    {#if mitDatum && u?.typ.datum === 'ausstellungsdatum'}
      <div class="datum-zeile">
        <span>
          <b>{t('unterlage.ausgestelltAm')}</b>
          <small
            >{v.ausstellungsdatum ? tagText(v.ausstellungsdatum) : t('unterlage.keinDatum')}</small
          >
        </span>
        <a class="textlink" href="#{basis}/datum/{v.id}"
          >{v.ausstellungsdatum ? t('allgemein.aendern') : t('unterlage.datumEintragen')}</a
        >
      </div>
    {/if}
    <div class="versions-links">
      <a class="textlink" href="#{basis}/version/{v.id}/seiten">{t('seiten.titel')}</a>
      <button type="button" class="textlink" onclick={() => versionWeg(v)}
        >{t('unterlage.versionLoeschenLink')}</button
      >
    </div>
  </div>
{/snippet}

{#snippet aeltereKopf(titel: string)}
  <div class="abschnitt-kopf">
    <h2>{titel}</h2>
    <button type="button" class="textlink" onclick={() => (bearbeiten = !bearbeiten)}
      >{bearbeiten ? t('allgemein.fertig') : t('allgemein.bearbeiten')}</button
    >
  </div>
{/snippet}

{#snippet loeschKnopf(v: DateiVersion)}
  <button
    type="button"
    class="loesch-knopf"
    aria-label={t('unterlage.versionWeg', { titel: versionTitel(v) })}
    onclick={() => versionWeg(v)}>{t('allgemein.loeschen')}</button
  >
{/snippet}

{#snippet monatZeile(v: DateiVersion, drin: boolean)}
  <li class="bearbeitbar">
    <WischZeile beimLoeschen={() => versionWeg(v)}>
      <a class="zeile" href="#{basis}/version/{v.id}">
        <span class="monat" class:drin aria-hidden="true"
          >{monatKuerzel(v.abrechnungsmonat ?? '2000-01')}</span
        >
        <span class="tx">
          <b>{v.abrechnungsmonat ? monatJahr(v.abrechnungsmonat) : versionTitel(v)}</b>
          <small>
            {#if drin}
              {dateiZeile(v, zahlen[v.id])}
            {:else}
              {zahlen[v.id] ? t('unterlage.seitenZahl', { anzahl: zahlen[v.id]! }) + '. ' : ''}{t(
                'unterlage.nichtInMappe',
              )}
            {/if}
          </small>
        </span>
        {#if drin || !bearbeiten}<Symbol name="weiter" groesse={20} />{/if}
      </a>
    </WischZeile>
    {#if bearbeiten && !drin}{@render loeschKnopf(v)}{/if}
  </li>
{/snippet}

<main class="seite farbe-{stand?.farbe ?? 1}">
  <div class="kopf">
    <Zurueck href="#/person/{personId}" text={name || t('allgemein.zurueck')} />
  </div>

  {#if !stand || !u}
    <p class="leer">{t('person.nichtGefunden')}</p>
  {:else}
    <div class="karte" class:zusatz>
      <p class="fuer">{t('rutsch.fuer', { name })}</p>
      <h1 class="unterlage" use:passend={['28px/31px', '24px/28px', '21px/25px']}>
        {listenText(u.typ)}
      </h1>
      <p class="satz">{unterlageSatz(u, !!nichtMehr)}</p>
    </div>

    {#if pruefHinweis}
      <div class="block">
        <PruefKasten
          hinweis={pruefHinweis}
          rufname={name}
          hochladen={() => (hochladenOffen = true)}
          warum={warumZeigen}
        />
      </div>
    {/if}
    {#if hinweis}
      <div class="block">
        <Notiz>
          <p class="hinweis">{hinweis}</p>
          {#if warum}
            <button type="button" class="textlink warum" onclick={warumZeigen}
              >{t('unterlage.warum')}</button
            >
          {/if}
        </Notiz>
      </div>
    {:else if warum}
      <div class="block">
        <button type="button" class="textlink" onclick={warumZeigen}>{t('unterlage.warum')}</button>
      </div>
    {/if}

    {#if u.typ.serie && u.versionen.length}
      <section>
        <h2>{t('unterlage.inDerMappeSerie', { anzahl: u.typ.serie.anzahl })}</h2>
        <ul class="gruppe">
          {#each aktuell as v (v.id)}
            {@render monatZeile(v, true)}
          {/each}
        </ul>
      </section>
      {#if !zuTun}
        <div class="block">
          <Eintragen
            gross
            unterlage={t('unterlage.neueVersion')}
            grund={t('unterlage.neueVersionGrund')}
            onclick={() => (hochladenOffen = true)}
          />
        </div>
      {/if}
      {#if aeltere.length}
        <section>
          {@render aeltereKopf(t('unterlage.aeltereMonate'))}
          <ul class="gruppe">
            {#each aeltere as v (v.id)}
              {@render monatZeile(v, false)}
            {/each}
          </ul>
          <p class="klein">{t('unterlage.serieRueckt')}</p>
        </section>
      {:else}
        <p class="klein block">{t('unterlage.serieRueckt')}</p>
      {/if}
    {:else}
      {#if aktuell.length}
        <section>
          <h2>{ohneMappe ? t('unterlage.gespeichert') : t('unterlage.inDerMappe')}</h2>
          {#each aktuell as v (v.id)}
            {@render versionKarte(v, !ohneMappe)}
          {/each}
          {#if ohneMappe && !nichtMehr}
            <p class="klein">{t('unterlage.brauchstDu')}</p>
          {/if}
        </section>
      {/if}

      {#if !zuTun && !ohneMappe}
        <div class="block">
          <Eintragen
            gross
            unterlage={t('unterlage.neueVersion')}
            grund={t('unterlage.neueVersionGrund')}
            onclick={() => (hochladenOffen = true)}
          />
        </div>
      {/if}

      {#if aeltere.length}
        <section>
          {@render aeltereKopf(t('unterlage.aeltereVersionen'))}
          <ul class="gruppe">
            {#each aeltere as v (v.id)}
              <li class="bearbeitbar">
                <WischZeile beimLoeschen={() => versionWeg(v)}>
                  <a class="zeile" href="#{basis}/version/{v.id}">
                    <span class="tx">
                      <b>{versionTitel(v)}</b>
                      <small
                        >{zahlen[v.id]
                          ? t('unterlage.seitenZahl', { anzahl: zahlen[v.id]! }) + '. '
                          : ''}{t('unterlage.nichtInMappe')}</small
                      >
                    </span>
                    {#if !bearbeiten}<Symbol name="weiter" groesse={20} />{/if}
                  </a>
                </WischZeile>
                {#if bearbeiten}{@render loeschKnopf(v)}{/if}
              </li>
            {/each}
          </ul>
          <p class="klein">{t('unterlage.immerNeueste')}</p>
        </section>
      {/if}
    {/if}

    {#if notiz !== null && u.versionen.length}
      <section class="notiz-zeile">
        <div class="karte-weiss zeile-notiz">
          <span class="tx">
            <b>{t('unterlage.notiz')}</b>
            <small>{notiz || t('unterlage.notizSatz')}</small>
          </span>
          <button
            type="button"
            class="textlink"
            onclick={() => {
              notizText = notiz;
              notizOffen = true;
            }}>{notiz ? t('allgemein.aendern') : t('unterlage.hinzufuegen')}</button
          >
        </div>
      </section>
    {/if}
  {/if}
</main>

{#if stand && u}
  {#if zuTun}
    <Aktionsleiste text={hauptText} onclick={() => (hochladenOffen = true)} />
  {:else if !bearbeiten}
    <Aktionsleiste
      text={t('allgemein.fertig')}
      onclick={() => zurueckGehen(`/person/${personId}`)}
    />
  {/if}

  <WarumBlatt bind:offen={warumOffen} typ={u.typ} zurueck={warumKnopf} />

  <Sheet bind:offen={notizOffen} titel={t('unterlage.notiz')}>
    <label class="eingabe">
      {t('unterlage.notizSatz')}
      <textarea rows="3" bind:value={notizText}></textarea>
    </label>
    <Hauptbutton text={t('allgemein.speichern')} onclick={notizSpeichern} />
  </Sheet>

  {#if hochladenOffen}
    {#await hochladen() then modul}
      <modul.default
        bind:offen={hochladenOffen}
        person={stand.person}
        farbe={stand.farbe}
        stand={u}
      />
    {/await}
  {/if}
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      calc(var(--leiste-hoehe, 0px) + 40px + env(safe-area-inset-bottom));
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
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 var(--space-4);
  }

  .leer {
    margin: var(--space-5) var(--space-4);
  }

  .karte {
    margin: 8px var(--space-4) 0;
    padding: 14px 16px;
    border-radius: 20px;
    background: var(--farbe);
    color: var(--on-person);
  }

  .karte.zusatz {
    border: 2px solid var(--farbe);
    background: var(--surface);
    color: var(--ink);
  }

  .fuer {
    margin: 0;
    font-size: calc(14 * var(--px));
    font-weight: 500;
  }

  .unterlage {
    margin: 2px 0 0;
    font-size: calc(28 * var(--px));
    line-height: calc(31 * var(--px));
    font-weight: 800;
    font-stretch: 112%;
    letter-spacing: -0.6px;
    hyphens: manual;
  }

  .satz {
    margin: 4px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .block {
    margin: 14px var(--space-4) 0;
  }

  .hinweis {
    margin: 0;
  }

  .warum {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    margin: -4px 0 -6px;
  }

  section {
    margin: 22px var(--space-4) 0;
  }

  h2 {
    margin: 0 4px 8px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 800;
  }

  .karte-weiss {
    display: grid;
    gap: 8px;
    padding: 14px 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .karte-weiss + .karte-weiss {
    margin-top: 8px;
  }

  .datei {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .datum-zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 12px;
    padding-top: 8px;
    border-top: 1px solid var(--line);
  }

  .datum-zeile span {
    display: grid;
  }

  .datum-zeile b {
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .datum-zeile small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .versions-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0 18px;
    font-size: calc(14 * var(--px));
  }

  .abschnitt-kopf {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin: 0 4px 4px;
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
    margin: 0 12px 8px auto;
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

  .gruppe {
    margin: 0;
    padding: 0;
    overflow: hidden;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .gruppe li + li {
    border-top: 1px solid var(--line);
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 16px;
    color: inherit;
    text-decoration: none;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  .tx small {
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .monat {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 1.5px solid var(--line);
    border-radius: 12px;
    font-size: calc(12 * var(--px));
    font-weight: 800;
    line-height: calc(13 * var(--px));
  }

  .monat.drin {
    border-color: var(--farbe);
    background: var(--farbe);
    color: var(--on-person);
  }

  .klein {
    margin: 8px 4px 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .klein.block {
    margin: 10px var(--space-5) 0;
  }

  .zeile-notiz {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
  }
</style>
