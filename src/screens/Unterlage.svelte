<script lang="ts">
  import { anrede } from '../i18n/anrede.svelte';
  // Seite einer Unterlage (design/unterlage-warum-haushalt.md, UL1 bis UL3, UL5, UL6), Form nach DP39,
  // Abschnitt 3 (Richtung A): Kopf in der Tönung der Person, Hinweis, was in der Mappe ist, als Zeilen mit
  // Pfeil, ältere Versionen, Notiz. Rot nur für Zurück und das Warnzeichen (DP35, W5); Löschen grau unten.
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
    ohneTrennstellen,
    personStand,
    rollenText,
    warumInhalt,
    type UnterlagenStand,
  } from '../domain/regelkatalog';
  import { monatName, t, tagText } from '../i18n';
  import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
  import { dokumentAendern, versionLoeschen, versionenZurueck } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Hauptbutton from '../ui/Hauptbutton.svelte';
  import { passend } from '../ui/passend';
  import { tonStil } from '../ui/personTon';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Sheet from '../ui/Sheet.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { tagKurzAus, unterlageSatz } from '../ui/texte';
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
  const buerge = $derived(stand?.rolle === 'buerge');
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
  /**
   * Plus-Zeile einer vollen Reihe: Ist der nächste Monat schon vorbei, steht er da („Oktober hinzufügen“ am
   * 6. November); der laufende Monat ist noch nicht abgerechnet, dann nur „Neue Version hinzufügen“.
   */
  const fruehText = $derived.by(() => {
    const d = new Date();
    const jetzt = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return u?.naechsterMonat && u.naechsterMonat < jetzt
      ? t('unterlage.monatHinzufuegen', { monat: monatName(u.naechsterMonat) })
      : t('unterlage.neueVersion');
  });
  const hauptText = $derived.by(() => {
    if (!u?.versionen.length) return t('unterlage.hinzufuegen');
    if (u.typ.serie && u.naechsterMonat)
      return t('unterlage.monatHinzufuegen', { monat: monatName(u.naechsterMonat) });
    return t('unterlage.neueVersion');
  });

  const pruefHinweis = $derived(
    pruefhinweise(haushaltStaende(daten.ansicht)).get(`${personId}/${typId}`) ?? null,
  );

  const warum = $derived(u ? warumInhalt(u.typ, anrede.wert) : null);
  const pruefcode = $derived(u ? pruefcodeStand(u) : null);
  // DP39 (W10, RU2): Kein eigener Satz zum Alter; der Kopf sagt es mit dem Warnzeichen. Hier steht, was zur
  // Unterlage gehört.
  const hinweis = $derived(
    pruefcode?.art === 'laeuft'
      ? t('unterlage.pruefcodeLaeuft', { am: tagKurzAus(pruefcode.am) })
      : u?.typ.hinweis,
  );
  /** Zu alt oder Prüfcode abgelaufen: Warnzeichen vor dem Satz im Kopf (DP39, A5). */
  const warnung = $derived(
    !!u &&
      !nichtMehr &&
      ((u.veraltet && u.versionen.length > 0) || pruefcode?.art === 'abgelaufen'),
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

{#snippet versionKarte(v: DateiVersion, mitDatum: boolean, mitLoeschen: boolean)}
  <div class="karte">
    <div class="seiten">
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
    </div>
    {#if mitDatum && u?.typ.datum === 'ausstellungsdatum'}
      <a class="zeile" href="#{basis}/datum/{v.id}">
        <span class="tx">
          <b>{t('unterlage.ausgestelltAm')}</b>
          <small
            >{v.ausstellungsdatum ? tagText(v.ausstellungsdatum) : t('unterlage.keinDatum')}</small
          >
        </span>
        <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
      </a>
    {/if}
    <a class="zeile" href="#{basis}/version/{v.id}/seiten">
      <span class="tx"><b>{t('seiten.titel')}</b></span>
      <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
    </a>
    {#if mitLoeschen}
      <button type="button" class="loeschen in-karte" onclick={() => versionWeg(v)}
        >{t('unterlage.versionLoeschenLink')}</button
      >
    {/if}
  </div>
{/snippet}

{#snippet plusZeile(text: string, unter: string, onclick: () => void)}
  <button type="button" class="karte zeile plus" {onclick}>
    <span class="plus-zeichen"><Symbol name="plus" groesse={20} /></span>
    <span class="tx"><b>{text}</b><small>{unter}</small></span>
  </button>
{/snippet}

{#snippet monatZeile(v: DateiVersion, drin: boolean)}
  <li>
    <WischZeile
      beimLoeschen={() => versionWeg(v)}
      loeschenText={t('unterlage.versionWeg', {
        titel: monatName(v.abrechnungsmonat ?? '2000-01'),
      })}
    >
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
        <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
      </a>
    </WischZeile>
  </li>
{/snippet}

<main class="seite person-ton" style={stand ? tonStil(stand.farbe) : undefined}>
  <div class="kopf">
    <Zurueck href="#/person/{personId}" text={name || t('allgemein.zurueck')} />
  </div>

  {#if !stand || !u}
    <p class="leer">{t('person.nichtGefunden')}</p>
  {:else}
    <div class="titel-karte">
      <p class="fuer">
        {t('rutsch.fuer', {
          name,
        })}{#if buerge}{` · ${rollenText(stand.rolle, stand.bezeichnung)}`}{/if}
      </p>
      <h1 class="unterlage" use:passend={['26px/31px', '23px/28px', '21px/25px']}>
        {listenText(u.typ)}
      </h1>
      <p class="satz" class:warnung>
        {#if warnung}<span class="warnzeichen" role="img" aria-label={t('unterlageSeite.warnung')}
            >!</span
          >{/if}<span>{unterlageSatz(u, !!nichtMehr)}</span>
      </p>
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
      <div class="block hinweis-karte">
        <span class="info"><Symbol name="info" groesse={20} /></span>
        <p>
          {hinweis}
          {#if warum}
            <button type="button" class="warum" onclick={warumZeigen}>{t('unterlage.warum')}</button
            >
          {/if}
        </p>
      </div>
    {/if}

    {#if u.typ.serie && u.versionen.length}
      <section>
        <h2 class="etikett">{t('unterlage.inDerMappeSerie', { anzahl: u.typ.serie.anzahl })}</h2>
        <ul class="karte gruppe">
          {#each aktuell as v (v.id)}
            {@render monatZeile(v, true)}
          {/each}
        </ul>
      </section>
      {#if !zuTun && !nichtMehr}
        <!-- Ist nichts fällig, steht unten nur „Fertig“: Ein früher Monat kommt über diese Zeile dazu. -->
        <div class="block">
          {@render plusZeile(
            fruehText,
            t('unterlage.neueVersionGrund'),
            () => (hochladenOffen = true),
          )}
        </div>
      {/if}
      {#if aeltere.length}
        <section>
          <h2 class="etikett">{t('unterlage.aeltereMonate')}</h2>
          <ul class="karte gruppe">
            {#each aeltere as v (v.id)}
              {@render monatZeile(v, false)}
            {/each}
          </ul>
        </section>
      {/if}
      <p class="klein">{t('unterlage.serieRueckt')}</p>
    {:else}
      {#if aktuell.length}
        <section>
          <h2 class="etikett">
            {ohneMappe ? t('unterlage.gespeichert') : t('unterlage.inDerMappe')}
          </h2>
          {#each aktuell as v (v.id)}
            {@render versionKarte(v, !ohneMappe, aktuell.length > 1)}
          {/each}
          {#if ohneMappe && !nichtMehr}
            <p class="klein">{t('unterlage.brauchstDu')}</p>
          {/if}
        </section>
      {/if}

      {#if !zuTun && !ohneMappe}
        <div class="block">
          {@render plusZeile(
            t('unterlage.neueVersion'),
            t('unterlage.neueVersionGrund'),
            () => (hochladenOffen = true),
          )}
        </div>
      {/if}

      {#if aeltere.length}
        <section>
          <h2 class="etikett">{t('unterlage.aeltereVersionen')}</h2>
          <ul class="karte gruppe">
            {#each aeltere as v (v.id)}
              <li>
                <WischZeile
                  beimLoeschen={() => versionWeg(v)}
                  loeschenText={t('unterlage.versionWeg', { titel: versionTitel(v) })}
                >
                  <a class="zeile" href="#{basis}/version/{v.id}">
                    <span class="tx">
                      <b>{versionTitel(v)}</b>
                      <small
                        >{zahlen[v.id]
                          ? t('unterlage.seitenZahl', { anzahl: zahlen[v.id]! }) + '. '
                          : ''}{t('unterlage.nichtInMappe')}</small
                      >
                    </span>
                    <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
                  </a>
                </WischZeile>
              </li>
            {/each}
          </ul>
        </section>
      {/if}
    {/if}

    {#if notiz !== null && u.versionen.length}
      <div class="block">
        {#if notiz}
          <button
            type="button"
            class="karte zeile"
            onclick={() => {
              notizText = notiz;
              notizOffen = true;
            }}
          >
            <span class="tx"><b>{t('unterlage.notiz')}</b><small>{notiz}</small></span>
            <span class="pfeil"><Symbol name="weiter" groesse={16} /></span>
          </button>
        {:else}
          {@render plusZeile(t('unterlageSeite.notizHinzufuegen'), t('unterlage.notizSatz'), () => {
            notizText = '';
            notizOffen = true;
          })}
        {/if}
      </div>
    {/if}

    {#if warum && !hinweis}
      <div class="block">
        <button type="button" class="karte zeile" onclick={warumZeigen}>
          <span class="tx"
            ><b
              >{t('unterlageSeite.warumUnterlage', {
                unterlage: ohneTrennstellen(listenText(u.typ)),
              })}</b
            ></span
          >
        </button>
      </div>
    {/if}

    {#if !u.typ.serie && aktuell.length === 1}
      <button type="button" class="loeschen" onclick={() => versionWeg(aktuell[0]!)}
        >{t('unterlage.versionLoeschenLink')}</button
      >
    {/if}
  {/if}
</main>

{#if stand && u}
  {#if zuTun}
    <Aktionsleiste text={hauptText} onclick={() => (hochladenOffen = true)} />
  {:else}
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
    padding: calc(20px + env(safe-area-inset-top)) 0
      calc(var(--leiste-hoehe, 0px) + 32px + env(safe-area-inset-bottom));
  }

  .kopf {
    display: flex;
    align-items: center;
    min-height: 52px;
    padding: 0 16px 0 12px;
  }

  .leer {
    margin: 20px 16px;
  }

  .titel-karte {
    margin: 4px 16px 0;
    padding: 20px;
    border-radius: 20px;
    background: var(--p-tint);
    color: var(--ink);
  }

  .fuer {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 650;
  }

  .unterlage {
    margin: 4px 0 0;
    font-size: calc(26 * var(--px));
    line-height: calc(31 * var(--px));
    font-weight: 650;
    hyphens: manual;
  }

  .satz {
    display: flex;
    gap: 8px;
    margin: 8px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .satz.warnung {
    font-weight: 600;
  }

  .warnzeichen {
    display: grid;
    flex: none;
    place-items: center;
    width: 16px;
    height: 16px;
    margin-top: 2px;
    border-radius: 8px;
    background: var(--accent);
    color: var(--surface);
    font-size: calc(11 * var(--px));
    font-weight: 800;
    line-height: 1;
  }

  .block {
    margin: 12px 16px 0;
  }

  .hinweis-karte {
    display: flex;
    gap: 12px;
    padding: 16px;
    border-radius: 20px;
    background: var(--surface);
  }

  .hinweis-karte p {
    margin: 0;
    font-size: calc(14 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .info {
    display: flex;
    flex: none;
  }

  /* DP39, 3: „Warum?“ steht unterstrichen im Satz (Ziel im Fließtext, C5 nimmt es aus wie WCAG 2.5.8). */
  .warum {
    display: inline;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }

  section {
    margin: 24px 16px 0;
  }

  .etikett {
    margin: 0 4px 8px;
    font-size: calc(12 * var(--px));
    line-height: calc(16 * var(--px));
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--ink-muted);
  }

  .karte {
    display: block;
    width: 100%;
    border: 0;
    border-radius: 20px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    text-align: left;
  }

  .karte + .karte {
    margin-top: 12px;
  }

  .seiten {
    display: grid;
    gap: 8px;
    padding: 16px 16px 12px;
  }

  .datei {
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
    overflow-wrap: anywhere;
  }

  .zeile {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 12px 16px;
    color: var(--ink);
    text-decoration: none;
    cursor: pointer;
  }

  .seiten + .zeile,
  .zeile + .zeile,
  .zeile + .loeschen {
    border-top: 1px solid var(--track);
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
    overflow-wrap: anywhere;
  }

  .pfeil {
    display: flex;
    flex: none;
    color: var(--ink-quiet);
  }

  .plus-zeichen {
    display: flex;
    flex: none;
  }

  .gruppe {
    margin: 0;
    padding: 0;
    overflow: hidden;
    list-style: none;
  }

  .gruppe li + li {
    border-top: 1px solid var(--track);
  }

  .monat {
    display: grid;
    flex-shrink: 0;
    place-items: center;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--track);
    font-size: calc(11 * var(--px));
    font-weight: 700;
    letter-spacing: 0.04em;
    line-height: calc(13 * var(--px));
  }

  .monat.drin {
    background: var(--p-tint);
  }

  .klein {
    margin: 8px 20px 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  /* Löschen grau, mittig (DP35, DP39). */
  .loeschen {
    display: block;
    min-height: var(--tap-target);
    margin: 16px auto 0;
    padding: 0 16px;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .loeschen.in-karte {
    width: 100%;
    margin: 0;
  }
</style>
