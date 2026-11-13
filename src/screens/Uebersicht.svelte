<script lang="ts">
  // Tab „Mappe“ (B12b, B18 Fassung 2 und 3, Nachricht 10.11. k): „Eure Mappe“ mit dem Rahmen-Satz aus E25,
  // Haushaltszeile, Aufgaben, je Person ein Blatt mit Reiter, Kinder, Bürgen, Hauptaktion und Backup.
  // Gegrüßt wird im Tab „Wohnungen“. Ohne Haushalt beginnt alles dort.
  import { onMount, untrack } from 'svelte';
  import { daten, gehe } from '../app/daten.svelte';
  import { speicherPruefen } from '../app/hinweise.svelte';
  import { mitziehendeTexte, werIstDabeiSatz } from '../domain/mappeWoerter';
  import { pruefhinweise } from '../domain/pruefhinweise';
  import {
    offeneDinge,
    personStand,
    type PersonStand,
    type UnterlagenStand,
  } from '../domain/regelkatalog';
  import { fertig as rutschFertig } from '../domain/rutsch';
  import { neueUnterlagen, tageSeit } from '../domain/zeit';
  import { t, zahlwort } from '../i18n';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import BackupZeile from '../ui/BackupZeile.svelte';
  import { bewegungReduziert } from '../ui/bewegung';
  import { einstellungenZustand } from '../ui/einstellungen.svelte';
  import GrafikPlatz from '../ui/GrafikPlatz.svelte';
  import HaushaltsZeile from '../ui/HaushaltsZeile.svelte';
  import HinweisKasten from '../ui/HinweisKasten.svelte';
  import Kopfzeile from '../ui/Kopfzeile.svelte';
  import {
    blickMerken,
    keinWechsel,
    letzterBlick,
    mitGeistern,
    wechselVon,
    type Blick,
    type Wechsel,
    type ZeilenArt,
  } from '../ui/mappeBlick';
  import MitziehendeZeile from '../ui/MitziehendeZeile.svelte';
  import PersonBlatt from '../ui/PersonBlatt.svelte';
  import { pruefAnzeige } from '../ui/pruefTexte';
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  import Symbol from '../ui/Symbol.svelte';
  import TabLeiste from '../ui/TabLeiste.svelte';
  import MappeStart from './MappeStart.svelte';
  import { naechsterText } from '../ui/texte';
  import Wohnungen from './Wohnungen.svelte';

  onMount(() => void speicherPruefen());

  let hochladenOffen = $state(false);
  let gewaehlt = $state<{ personId: string; typ: string } | null>(null);
  const hochladen = () => import('../ui/Hochladen.svelte');
  // Nach dem Einspielen vom ersten Start aus: Die Bestätigung steht hier statt in den Einstellungen.
  const meldung = einstellungenZustand.meldung;
  einstellungenZustand.meldung = '';
  // Aktueller Stand der gewählten Unterlage (bleibt nach dem Speichern aktuell).
  const auswahl = $derived.by(() => {
    if (!gewaehlt) return null;
    const s = staende.find((x) => x.person.id === gewaehlt!.personId);
    const u = s?.unterlagen.find((x) => x.typ.id === gewaehlt!.typ);
    return s && u ? { person: s.person, farbe: s.farbe, stand: u } : null;
  });

  function aufgabeOeffnen(s: PersonStand, u: UnterlagenStand) {
    if (u.typ.inAppErstellt) return gehe(`/selbstauskunft/${s.person.id}`);
    gewaehlt = { personId: s.person.id, typ: u.typ.id };
    hochladenOffen = true;
  }

  const staende = $derived<PersonStand[]>(
    daten.ansicht
      ? daten.ansicht.mitglieder.map((m) =>
          personStand(
            m.person,
            m.zugehoerigkeit,
            daten.ansicht!.dokumente,
            daten.ansicht!.versionen,
            undefined,
            haushaltsAngabenAus(daten.ansicht),
          ),
        )
      : [],
  );
  // Rollenreihenfolge: Hauptmieter, Mitmieter (in Reihenfolge der Einrichtung), dann Bürgen.
  const vertrag = $derived([
    ...staende.filter((s) => s.rolle === 'hauptmieter'),
    ...staende.filter((s) => s.rolle === 'mitmieter'),
  ]);
  const buergen = $derived(staende.filter((s) => s.rolle === 'buerge'));
  // Aufgaben: alles, was fehlt oder bald abläuft, Person für Person (Nachricht 10.11. k: alle).
  const aufgaben = $derived(
    [...vertrag, ...buergen].flatMap((stand) =>
      stand.unterlagen
        .filter((u) => u.status === 'fehlt' || u.status === 'bald')
        .map((u) => ({ stand, u })),
    ),
  );
  /** „für Max · neuer Monat“; „Fehlt noch“ sagt die Liste schon. */
  function fuerText(s: PersonStand, grund: string): string {
    const fuer = t('mappeTab.fuer', { name: s.person.rufname || s.person.vorname });
    if (!grund || /^fehlt noch\.?$/i.test(grund)) return fuer;
    return `${fuer} · ${grund.charAt(0).toLowerCase()}${grund.slice(1).replace(/\.$/, '')}`;
  }

  // Prüfhinweise (PH1): Marke „prüfen“ an der Zeile (Nachricht 10.11. k).
  const pruefFunde = $derived(pruefhinweise(staende));
  function pruefKurz(s: PersonStand, typ: string): string | null {
    const h = pruefFunde.get(`${s.person.id}/${typ}`);
    return h ? pruefAnzeige(h, s.person.rufname || s.person.vorname).kurz : null;
  }
  const pruefZahl = $derived(
    staende.reduce((n, s) => n + s.pfad.filter((u) => pruefKurz(s, u.typ.id)).length, 0),
  );

  // Nachname freiwillig beim Anlegen (E96, 3), fehlt er, ist er ein eigener Punkt im Kasten.
  const ohneNachname = $derived([...vertrag, ...buergen].filter((s) => !s.person.nachname.trim()));
  const offen = $derived(offeneDinge(staende) + ohneNachname.length);
  // Schwelle (Auftraggeber 13.11.): Oben höchstens drei Aufgaben; der Rest steht ohnehin unten bei den
  // Personen. Frisch angelegt wären es sonst zehn und mehr, oben und unten doppelt.
  const OBEN = 3;
  const fertig = $derived(staende.length > 0 && offen === 0);
  // U15: Backup älter als 30 Tage und seitdem Neues dazugekommen. Ohne Änderungen bleibt die Zeile ruhig.
  const backupAlt = $derived.by(() => {
    const zuletzt = daten.einstellungen?.letztesBackup;
    if (!zuletzt || !daten.ansicht) return null;
    const tage = tageSeit(zuletzt);
    const neu = neueUnterlagen(daten.ansicht.versionen, zuletzt);
    return tage > 30 && neu > 0 ? { tage, neu } : null;
  });
  const allein = $derived(vertrag.length === 1);
  const kinder = $derived(daten.ansicht?.haushalt.kinder ?? 0);
  const weitere = $derived(daten.ansicht?.haushalt.weitereErwachsene ?? 0);
  const rutsch = $derived(daten.einstellungen?.rutsch ?? null);
  const pausiert = $derived(!!rutsch && rutsch.index > 0 && !rutschFertig(rutsch));
  // Rahmen-Satz aus E25, wie auf der Vermieterseite.
  const rahmen = $derived(
    werIstDabeiSatz(vertrag.length, mitziehendeTexte(kinder, weitere), buergen.length),
  );

  const lead = $derived.by(() => {
    const werte = { anzahl: offen, zahl: zahlwort(offen) };
    return allein ? t('uebersicht.offenDu', werte) : t('uebersicht.offenIhr', werte);
  });
  // Nachricht 10.11. l und m: Ein offener Prüfhinweis ändert „startklar“, hält aber nicht auf.
  const fertigSatz = $derived(
    pruefZahl
      ? t(allein ? 'mappeTab.pruefenDu' : 'mappeTab.pruefenIhr', { anzahl: pruefZahl })
      : allein
        ? t('mappeTab.startklarDu')
        : t('mappeTab.startklarIhr'),
  );
  const offenZahlwort = $derived(zahlwort(offen));

  // B21: Bewegung seit dem letzten Blick auf den Tab. Was sich geändert hat, bewegt sich einmal, höchstens
  // 400 ms lang; danach nimmt Hefta die Marken wieder weg und, was gegangen ist, ganz heraus.
  type Aufgabe = (typeof aufgaben)[number];
  function zeilenArt(s: PersonStand, u: UnterlagenStand): ZeilenArt {
    if (pruefKurz(s, u.typ.id)) return 'pruef';
    if (u.status === 'fehlt') return 'fehlt';
    if (u.status === 'bald') return 'bald';
    return 'da';
  }
  const haushaltId = $derived(daten.ansicht?.haushalt.id ?? '');
  const blick = $derived<Blick<PersonStand, Aufgabe>>({
    personen: [...vertrag, ...buergen].map((s) => ({ id: s.person.id, daten: s })),
    zeilen: new Map(
      [...vertrag, ...buergen].flatMap((s) =>
        s.pfad.map((u) => [`${s.person.id}/${u.typ.id}`, zeilenArt(s, u)] as const),
      ),
    ),
    aufgaben: aufgaben.map((a) => ({ schluessel: `${a.stand.person.id}/${a.u.typ.id}`, daten: a })),
    offen,
    startklar: fertig && pruefZahl === 0,
    satz: fertig ? fertigSatz : lead,
  });
  const wechsel = $derived.by<Wechsel<PersonStand, Aufgabe>>(() => {
    const jetzt = blick;
    if (!haushaltId) return keinWechsel();
    return wechselVon(
      untrack(() => letzterBlick<PersonStand, Aufgabe>(haushaltId)),
      jetzt,
    );
  });
  $effect(() => blickMerken(haushaltId, blick));
  let vorbei = $state(0);
  const reduziert = bewegungReduziert();
  $effect(() => {
    const nr = wechsel.nr;
    if (!nr) return;
    const uhr = setTimeout(() => (vorbei = nr), 450);
    return () => clearTimeout(uhr);
  });
  const aktiv = $derived(wechsel.nr > 0 && wechsel.nr !== vorbei);
  const bw = $derived(aktiv ? wechsel : keinWechsel<PersonStand, Aufgabe>());
  const geister = $derived(aktiv && !reduziert);
  function zeilenFuer(s: PersonStand): Set<string> {
    return new Set(
      [...bw.kam, ...bw.pruef].flatMap((k) => {
        const [person, typ] = k.split('/');
        return person === s.person.id && typ ? [typ] : [];
      }),
    );
  }
  const aufgabenListe = $derived(
    mitGeistern(
      aufgaben,
      geister ? bw.wegAufgaben.map((a) => ({ platz: a.platz, daten: a.daten })) : [],
    ),
  );
  const blaetter = $derived(
    mitGeistern(
      [...vertrag, ...buergen],
      geister ? bw.wegPersonen.map((p) => ({ platz: p.platz, daten: p.daten })) : [],
    ),
  );
  const blaetterVertrag = $derived(blaetter.filter((b) => b.wert.rolle !== 'buerge'));
  const blaetterBuergen = $derived(blaetter.filter((b) => b.wert.rolle === 'buerge'));
  // Nur eine Person: Ihr Blatt steht gleich darunter und zeigt dieselben offenen Unterlagen. Dann bleibt
  // vom Kasten nur der Satz, die Liste stünde doppelt da (Auftraggeber, 12.11.).
  const nurEinBlatt = $derived(blaetter.filter((b) => !b.geist).length === 1);
  // Person geht: lang; sonst schließt eine Aufgabe ihren Platz in „mittel“.
  const zuDauer = $derived(bw.wegPersonen.length ? 'var(--bw-lang)' : 'var(--bw-mittel)');
</script>

{#snippet blattPlatz(b: { wert: PersonStand; geist: boolean })}
  {#if b.geist}
    <div class="platz geist" style:--zu={zuDauer} inert aria-hidden="true">
      <div><PersonBlatt stand={b.wert} pruefen={() => null} /></div>
    </div>
  {:else}
    <div class="platz" class:neu={bw.neuePersonen.has(b.wert.person.id)}>
      <div>
        <PersonBlatt
          stand={b.wert}
          pruefen={(typ) => pruefKurz(b.wert, typ)}
          kam={zeilenFuer(b.wert)}
        />
      </div>
    </div>
  {/if}
{/snippet}

{#if !daten.ansicht}
  <!-- Hefta 2: Ohne Haushalt beginnt alles im Tab „Wohnungen“ (E45, B15, B16). -->
  <Wohnungen />
{:else if daten.ansicht.haushalt.einrichtungOffen}
  <!-- B26 (E93): Angefangen, aber nicht fertig: die wachsende Mappe statt der Übersicht. -->
  <MappeStart />
{:else}
  <TabLeiste aktiv="mappe" />
  <main class="uebersicht">
    <Kopfzeile />
    <div class="titelblock">
      <h1 class="titel">{allein ? t('mappeTab.titelDu') : t('mappeTab.titelIhr')}</h1>
      <p class="rahmen">{rahmen}</p>
      <HaushaltsZeile {vertrag} {weitere} {kinder} buergen={buergen.length} />
      {#if meldung}<p class="meldung" role="status">{meldung}</p>{/if}
    </div>

    <HinweisKasten />

    {#if fertig}
      <!-- B21, Stelle 2: „Alles da“ ist der Moment der Vorfreude, nur ohne offenen Prüfhinweis. -->
      <div class="aufgaben fertig" class:moment={bw.startklar}>
        <GrafikPlatz name="alles-da" hoehe={96}>
          <span class="zeichen" aria-hidden="true"><Symbol name="haken" groesse={24} /></span>
        </GrafikPlatz>
        <p class:blende={bw.satz && !bw.startklar}>
          <b>{fertigSatz}</b><small>{t('mappeTab.bereit')}</small>
        </p>
      </div>
    {:else}
      <section class="aufgaben" aria-labelledby="aufgaben-titel">
        <h2 id="aufgaben-titel" class:blende={bw.satz}>{lead}</h2>
        <ul hidden={nurEinBlatt}>
          {#each aufgabenListe.slice(0, OBEN) as { wert: a, geist } ((geist ? 'g:' : '') + `${a.stand.person.id}/${a.u.typ.id}`)}
            {@const text = naechsterText(a.u, a.stand.person)}
            <li
              class:geist
              class:neu={!geist && bw.neueAufgaben.has(`${a.stand.person.id}/${a.u.typ.id}`)}
              style:--zu={geist ? zuDauer : undefined}
              inert={geist}
              aria-hidden={geist ? 'true' : undefined}
            >
              <div class="platz-innen">
                <button type="button" class="aufgabe" onclick={() => aufgabeOeffnen(a.stand, a.u)}>
                  <span class="sym" aria-hidden="true"
                    ><Symbol name={a.u.typ.symbol} groesse={20} /></span
                  >
                  <span class="tx">
                    <b>{text.unterlage}</b>
                    <small>{fuerText(a.stand, text.grund)}</small>
                  </span>
                  <Symbol name="weiter" groesse={16} />
                </button>
              </div>
            </li>
          {/each}
        </ul>
        {#if !nurEinBlatt && aufgaben.length > OBEN}
          <p class="mehr-unten">
            {t('uebersicht.weitereUnten', { anzahl: aufgaben.length - OBEN })}
          </p>
        {/if}
        {#if ohneNachname.length}
          <ul class="namen">
            {#each ohneNachname as s (s.person.id)}
              <li>
                <a class="aufgabe" href="#/person-aendern/{s.person.id}/mappe">
                  <span class="sym" aria-hidden="true"><Symbol name="person" groesse={20} /></span>
                  <span class="tx">
                    <b
                      >{t('uebersicht.nachnameFehlt', {
                        name: s.person.rufname || s.person.vorname,
                      })}</b
                    >
                    <small>{t('uebersicht.nachnameWozu')}</small>
                  </span>
                  <Symbol name="weiter" groesse={16} />
                </a>
              </li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

    {#each blaetterVertrag as b ((b.geist ? 'g:' : '') + b.wert.person.id)}
      {@render blattPlatz(b)}
    {/each}
    <MitziehendeZeile {kinder} {weitere} />

    {#if blaetterBuergen.length}
      <p class="trenner">{t('uebersicht.zusatzZeile')}</p>
      {#each blaetterBuergen as b ((b.geist ? 'g:' : '') + b.wert.person.id)}
        {@render blattPlatz(b)}
      {/each}
    {/if}

    {#if backupAlt}
      <div class="backup alt">
        <p>
          <b>{t('uebersicht.backupAlt', { anzahl: backupAlt.tage })}</b><br />{t(
            'uebersicht.backupNeu',
            { anzahl: backupAlt.neu },
          )}
        </p>
        <a class="sichern" href="#/einstellungen/backup">{t('uebersicht.sichern')}</a>
      </div>
    {:else}
      <div class="backup">
        <BackupZeile />
        <a class="textlink" href="#/einstellungen/backup">{t('uebersicht.jetztSichern')}</a>
      </div>
    {/if}
  </main>

  {#if fertig}
    <Aktionsleiste
      text={t('mappeTab.teilen')}
      href="#/mappe"
      einblenden={bw.startklar}
      nebenGeist={bw.startklar && geister ? t('mappeTab.trotzdemTeilen') : undefined}
    />
  {:else if pausiert && rutsch}
    <Aktionsleiste
      text={t('uebersicht.weitermachen')}
      zusatz={t('uebersicht.vonZusatz', { schritt: rutsch.index + 1, gesamt: rutsch.liste.length })}
      zahlNeu={bw.zahl}
      href="#/rutsch"
      neben={{ text: t('mappeTab.trotzdemTeilen'), onclick: () => gehe('/mappe') }}
    />
  {:else}
    <Aktionsleiste
      text={t('uebersicht.unterlagenHinzufuegen')}
      zusatz={t('uebersicht.offenZusatz', { anzahl: offen })}
      zahlNeu={bw.zahl}
      ansage={t('uebersicht.hauptAnsage', { offen: offenZahlwort })}
      href="#/rutsch"
      neben={{ text: t('mappeTab.trotzdemTeilen'), onclick: () => gehe('/mappe') }}
    />
  {/if}
{/if}

{#if hochladenOffen && auswahl}
  {#await hochladen() then modul}
    <modul.default
      bind:offen={hochladenOffen}
      person={auswahl.person}
      farbe={auswahl.farbe}
      stand={auswahl.stand}
    />
  {/await}
{/if}

<style>
  .meldung {
    margin: 10px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  .uebersicht {
    --spalte: 0px;
    position: relative;
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding-inline: var(--space-5);
    /* Platz für die fixierte Hauptaktion */
    padding-bottom: max(
      calc(140px + env(safe-area-inset-bottom)),
      calc(var(--leiste-hoehe, 0px) + var(--tabs-hoehe, 0px) + 16px)
    );
  }

  /* Der Tab hat eigene Seitenränder; der Hinweiskasten bringt seine für Seiten ohne mit (C21). */
  .uebersicht > :global(.kasten) {
    margin-inline: 0;
  }

  .titelblock {
    padding: 6px 0 0;
  }

  .titel {
    margin: 10px 0 4px;
    font-size: calc(34 * var(--px));
    line-height: calc(38 * var(--px));
    font-weight: 800;
  }

  .rahmen {
    margin: 0 0 12px;
    font-size: calc(17 * var(--px));
    line-height: calc(23 * var(--px));
    font-weight: 600;
  }

  .aufgaben {
    margin: 18px 0 8px;
    padding: 14px;
    border-radius: 16px;
    background: var(--accent-soft);
  }

  .aufgaben h2 {
    margin: 0 0 10px;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 700;
  }

  /* Eine Spalte, die schmaler werden darf als das längste Wort: Sonst ragt die Zeile bei 320 px
     mit großer Schrift aus dem Kasten (C3). */
  .aufgaben ul {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Nur eine Person: nur der Satz (siehe `nurEinBlatt`). */
  .mehr-unten {
    margin: 8px 2px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
  }

  .aufgaben ul.namen {
    margin-top: 8px;
  }

  .aufgaben a.aufgabe {
    color: inherit;
    text-decoration: none;
  }

  .aufgaben ul[hidden] {
    display: none;
  }

  .aufgaben h2:has(+ ul[hidden]) {
    margin-bottom: 0;
  }

  .aufgabe {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: 64px;
    padding: 10px 14px;
    border: 0;
    border-radius: 14px;
    background: var(--surface);
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .aufgabe .tx,
  .aufgaben.fertig p {
    display: grid;
    flex: 1 1 12em;
    min-width: 0;
    margin: 0;
  }

  .aufgabe b,
  .aufgaben.fertig b {
    overflow-wrap: break-word;
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    font-weight: 700;
  }

  .aufgabe small,
  .aufgaben.fertig small {
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  /* Bei 320 px mit großer Schrift rückt der Satz unter das Zeichen, statt schmal daneben zu stehen (C21). */
  .aufgaben.fertig {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    background: var(--passt);
  }

  .zeichen {
    display: inline-flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: var(--surface);
    color: var(--passt-text);
  }

  /* B21: Platz öffnet und schließt sich über grid-template-rows, Inhalt steigt 8 px ein. Alles mit
     `backwards`, damit das Ende jeder Bewegung der Ruhezustand ist. Bei „Bewegung reduzieren“ sind die
     Dauern 0; was „knapp einblendet“, nimmt --bw-nur-reduziert. */
  .platz {
    display: grid;
    grid-template-rows: 1fr;
  }

  .platz > div,
  .platz-innen {
    min-height: 0;
  }

  li.neu,
  li.geist {
    display: grid;
    grid-template-rows: 1fr;
  }

  .platz.neu > div,
  li.neu .platz-innen,
  .platz.geist > div,
  li.geist .platz-innen {
    overflow: hidden;
  }

  .platz.neu,
  li.neu {
    animation: bw-auf var(--bw-mittel) var(--bw-ziel) backwards;
  }

  .platz.neu > div,
  li.neu .platz-innen {
    animation:
      bw-steigen var(--bw-mittel) var(--bw-ziel) var(--bw-takt) backwards,
      bw-blende var(--bw-nur-reduziert) var(--bw-gleich) backwards;
  }

  .platz.geist {
    grid-template-rows: 0fr;
    opacity: 0;
    animation: bw-zu var(--zu) var(--bw-ziel) backwards;
  }

  /* In der Liste fällt mit der Aufgabe auch ihr Abstand weg. */
  li.geist {
    grid-template-rows: 0fr;
    opacity: 0;
    margin-bottom: -8px;
    animation: aufgabe-zu var(--zu) var(--bw-ziel) backwards;
  }

  @keyframes aufgabe-zu {
    0% {
      grid-template-rows: 1fr;
      opacity: 1;
      margin-bottom: 0;
    }
    50% {
      opacity: 0;
    }
    100% {
      grid-template-rows: 0fr;
      opacity: 0;
      margin-bottom: -8px;
    }
  }

  .blende {
    animation: bw-blende var(--bw-kurz) var(--bw-weich) backwards;
  }

  /* „Alles da“: Der Kasten wird grün, der Satz steigt ein, der Haken zieht sich als Letztes. */
  .aufgaben.fertig.moment {
    animation:
      fertig-grund var(--bw-mittel) var(--bw-weich) backwards,
      bw-blende var(--bw-nur-reduziert) var(--bw-gleich) backwards;
  }

  .moment p {
    animation: bw-steigen var(--bw-mittel) var(--bw-ziel) var(--bw-takt) backwards;
  }

  .moment .zeichen :global(svg path) {
    stroke-dasharray: 30;
    animation: bw-haken var(--bw-kurz) var(--bw-weich) calc(3 * var(--bw-takt)) backwards;
  }

  @keyframes fertig-grund {
    from {
      background-color: var(--accent-soft);
    }
  }

  .trenner {
    margin: 26px 0 0;
    padding-top: 12px;
    border-top: 1px dashed var(--control-border);
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
  }

  .backup {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin: 22px 0 0;
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
  }

  .backup.alt {
    flex-wrap: wrap;
    margin: 22px 0 0;
    padding: 6px 6px 6px 14px;
    border-radius: 16px;
    background: var(--surface);
    color: var(--ink);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .backup.alt p {
    flex: 1 1 11em;
    min-width: 0;
    margin: 0;
  }

  .sichern {
    display: inline-flex;
    flex-shrink: 0;
    margin-left: auto;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 16px;
    border-radius: var(--radius-full);
    background: var(--ink);
    color: var(--ground);
    font-size: calc(15 * var(--px));
    font-weight: 700;
    text-decoration: none;
  }

  .backup .textlink {
    flex-shrink: 0;
    font-size: calc(13 * var(--px));
    white-space: nowrap;
  }
</style>
