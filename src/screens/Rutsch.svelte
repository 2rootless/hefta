<script lang="ts">
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  // „Unterlagen in einem Rutsch“ (design/einrichtung-rutsch-navigation.md, Abschnitt 2; Entwürfe R0–R3):
  // Start mit allen offenen Unterlagen, dann eine nach der anderen, Person für Person. Pause führt zur
  // Übersicht, der Stand bleibt in den Einstellungen. Nur „PDF wählen“ (Entscheidung G).
  // Form nach DP39 (W18, W19): Personen als Register wie Trennblätter, die Karte hängt am aktiven Reiter;
  // der Fortschritt der Person als Haarlinie, die aktuelle Unterlage im Ring, Übersprungenes mit Pfeil.
  import { onMount, untrack } from 'svelte';
  import { daten, db, gehe, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { monatAus, nochNicht, serienFenster } from '../domain/fristen';
  import {
    ohneTrennstellen,
    listenText,
    offeneDinge,
    personStand,
    rollenText,
    type PersonStand,
  } from '../domain/regelkatalog';
  import {
    fertig,
    neuDazu,
    neuerRutsch,
    postenSchluessel,
    weiter,
    zaehlen,
    type RutschErgebnis,
    type RutschPosten,
    type RutschStand,
  } from '../domain/rutsch';
  import { monatName, t, zahlwort } from '../i18n';
  import {
    dokumentAendern,
    einstellungenAendern,
    haushaltAendern,
    personAendern,
  } from '../storage/speicher';
  import { einziehend, einziehendText, type HaushaltsAngaben } from '../domain/selbstauskunft';
  import SelbstauskunftAkkordeon from '../ui/SelbstauskunftAkkordeon.svelte';
  import {
    angabenAus,
    eingabeAus,
    grundFuer,
    haushaltAus,
    type SelbstauskunftEingabe,
  } from '../ui/selbstauskunftEingabe';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Haarlinie, { type HaarStueck, type HaarZustand } from '../ui/Haarlinie.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { alterGrenze, tagKurz } from '../ui/texte';
  import { passend, TITEL_BREIT } from '../ui/passend';
  import { tonStil } from '../ui/personTon';
  import Zurueck from '../ui/Zurueck.svelte';

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

  // Läuft schon eine Runde (nach einer Pause), geht es dort weiter; sonst der Startbildschirm.
  // Aus der Personenansicht: nur die Unterlagen dieser Person, ohne den Stand des Haushalts-Rutschs.
  let { nurPerson = null }: { nurPerson?: string | null } = $props();
  const heim = untrack(() => (nurPerson ? `/person/${nurPerson}` : '/'));
  // Wohin „Zurück“ führt, mit seinem Namen: die Person oder der Reiter Mappe (Auftraggeber 13.11.).
  const heimName = $derived(
    (nurPerson &&
      (daten.ansicht?.mitglieder.find((m) => m.person.id === nurPerson)?.person.rufname ||
        daten.ansicht?.mitglieder.find((m) => m.person.id === nurPerson)?.person.vorname)) ||
      t('tabs.mappe'),
  );
  const gespeichert = untrack(() => (nurPerson ? null : (daten.einstellungen?.rutsch ?? null)));
  const fortsetzen = !!gespeichert && gespeichert.index > 0 && !fertig(gespeichert);
  let stand = $state<RutschStand>(
    fortsetzen
      ? gespeichert!
      : untrack(() =>
          neuerRutsch(nurPerson ? staende.filter((x) => x.person.id === nurPerson) : staende, true),
        ),
  );
  let phase = $state<'start' | 'schritt' | 'gewaehlt' | 'ende'>(fortsetzen ? 'schritt' : 'start');
  let gewaehlt = $state<File[] | null>(null);
  let fehler = $state('');
  // Serien (z. B. drei Gehaltsnachweise): nach dem ersten Monat gleich den nächsten anbieten.
  let serie = $state<{
    drin: string;
    fenster: { monat: string; da: boolean }[];
    fehlend: string[];
    vorschlag: string;
  } | null>(null);

  const posten = $derived(
    phase === 'schritt' || phase === 'gewaehlt' ? stand.liste[stand.index] : undefined,
  );
  const aktuell = $derived.by(() => {
    if (!posten) return null;
    const s = staende.find((x) => x.person.id === posten.personId);
    const u = s?.unterlagen.find((x) => x.typ.id === posten.typ);
    return s && u
      ? { person: s.person, rolle: s.rolle, farbe: s.farbe, bezeichnung: s.bezeichnung, stand: u }
      : null;
  });

  // Selbstauskunft als Akkordeon direkt im Ablauf (Entwürfe A1 bis A3). Haustiere und Ort gehören
  // dem Haushalt: einmal eingetragen, stehen sie in jedem Bogen.
  let auskunft = $state<{
    schluessel: string;
    eingabe: SelbstauskunftEingabe;
    vorher: HaushaltsAngaben;
  } | null>(null);
  $effect(() => {
    const p = posten;
    const a = aktuell;
    if (phase !== 'schritt' || !p || !a || !a.stand.typ.inAppErstellt) return;
    const schluessel = postenSchluessel(p);
    untrack(() => {
      if (auskunft?.schluessel === schluessel || !daten.ansicht) return;
      const hh = haushaltsAngabenAus(daten.ansicht);
      auskunft = { schluessel, eingabe: eingabeAus(a.person, hh), vorher: hh };
    });
  });
  let akkordeon = $state<{ fehlendenOeffnen: () => void }>();
  // DP39, Selbstauskunft als erster Schritt: zuerst die vier Teile als Liste und „Ausfüllen“; das öffnet den
  // ersten offenen Teil, danach heißt der Knopf „Speichern und weiter“.
  let ausfuellenBei = $state<string | null>(null);
  const ausfuellen = $derived(!!auskunft && ausfuellenBei === auskunft.schluessel);
  const auskunftGrund = $derived(
    aktuell && auskunft ? grundFuer(aktuell.person, aktuell.rolle, auskunft.eingabe) : undefined,
  );
  const vertragsZahl = $derived(
    (daten.ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle !== 'buerge').length,
  );
  const wer = $derived(
    daten.ansicht ? einziehend(vertragsZahl, daten.ansicht.haushalt) : { erwachsene: 0, kinder: 0 },
  );
  // Wer die Haushaltsangaben schon eingetragen hat (für „Von Max: …“ und die Kopfzeile in A2).
  const angabenVon = $derived.by(() => {
    const h = daten.ansicht?.haushalt;
    if (!auskunft || !aktuell || !h?.angabenVon || h.angabenVon === aktuell.person.id) return '';
    const fertig = auskunft.vorher.haustiere !== null && !!auskunft.vorher.ort.trim();
    const von = daten.ansicht?.mitglieder.find((m) => m.person.id === h.angabenVon)?.person;
    return fertig && von ? von.rufname || von.vorname : '';
  });
  const auskunftLead = $derived.by(() => {
    if (!aktuell) return '';
    if (aktuell.rolle === 'buerge')
      return aktuell.bezeichnung === 'neutral'
        ? t('selbstauskunft.rutschLeadBuerge', {
            name: aktuell.person.rufname || aktuell.person.vorname,
          })
        : t('selbstauskunft.rutschLeadAls', { rolle: rollenText('buerge', aktuell.bezeichnung) });
    if (angabenVon) return t('selbstauskunft.rutschLeadSpaeter', { name: angabenVon });
    return t('selbstauskunft.rutschLead');
  });

  /** Was im Bogen steht, sichern; auch beim Springen, damit nichts verloren geht. */
  async function auskunftMerken(): Promise<boolean> {
    if (!aktuell?.stand.typ.inAppErstellt || !auskunft || !daten.ansicht) return false;
    const verbindung = await db();
    await personAendern(verbindung, aktuell.person.id, angabenAus(auskunft.eingabe));
    const hh = haushaltAus(auskunft.eingabe, auskunft.vorher, aktuell.person.id);
    if (hh && aktuell.rolle !== 'buerge')
      await haushaltAendern(verbindung, daten.ansicht.haushalt.id, hh);
    return true;
  }

  async function auskunftSichern(ergebnis: RutschErgebnis) {
    if (await auskunftMerken()) naechster(ergebnis);
  }

  function unterlageVon(p: RutschPosten | undefined) {
    return staende
      .find((x) => x.person.id === p?.personId)
      ?.unterlagen.find((x) => x.typ.id === p?.typ);
  }

  function nochOffen(p: RutschPosten | undefined): boolean {
    const u = unterlageVon(p);
    return !!u && (u.status === 'fehlt' || u.status === 'bald');
  }

  /** DP39, 1.2: Zustand eines Postens auf der Haarlinie. */
  function zustandVon(p: RutschPosten, i: number): HaarZustand {
    const ergebnis = stand.ergebnisse[postenSchluessel(p)];
    if (i === stand.index && (phase === 'schritt' || phase === 'gewaehlt')) return 'aktuell';
    if (ergebnis === 'hochgeladen') return 'fertig';
    if (ergebnis === 'uebersprungen' || ergebnis === 'nochNicht' || !unterlageVon(p))
      return 'uebersprungen';
    return nochOffen(p) ? 'offen' : 'fertig';
  }
  /** Die Stücke der Haarlinie einer Person, in der Reihenfolge der Runde. */
  function stueckeVon(personId: string): HaarStueck[] {
    return stand.liste.flatMap((p, i) => {
      if (p.personId !== personId) return [];
      const u = unterlageVon(p);
      return [
        {
          text: u ? ohneTrennstellen(listenText(u.typ)) : '',
          symbol: u?.typ.symbol ?? 'weiteres',
          zustand: zustandVon(p, i),
          ziel: i,
        },
      ];
    });
  }
  /** Der Zähler am Reiter zählt nur Fertiges, keine übersprungenen Unterlagen (DP39, 1.3). */
  const fertigVon = (personId: string) =>
    stueckeVon(personId).filter((s) => s.zustand === 'fertig').length;
  const buergeVon = (personId: string) =>
    staende.find((s) => s.person.id === personId)?.rolle === 'buerge';
  const rufname = (person: { rufname: string; vorname: string } | undefined) =>
    person?.rufname || person?.vorname || '';
  const hatUebersprungen = $derived(
    stand.liste.some((p, i) => zustandVon(p, i) === 'uebersprungen'),
  );
  // Schon erledigt (man ist dorthin zurückgesprungen): Man kann eine neuere Datei wählen oder weiter.
  const schonDa = $derived(!!aktuell && !nochOffen(posten));

  const proPerson = $derived(
    staende
      .map((s) => ({
        person: s.person,
        farbe: s.farbe,
        anzahl: stand.liste.filter((p) => p.personId === s.person.id).length,
      }))
      .filter((x) => x.anzahl > 0)
      .sort(
        (a, b) =>
          stand.liste.findIndex((p) => p.personId === a.person.id) -
          stand.liste.findIndex((p) => p.personId === b.person.id),
      ),
  );

  /** Noch offen? Inzwischen Erledigtes (z. B. über die Übersicht) und Entfernte überspringen. */
  function gueltig(s: RutschStand): boolean {
    return nochOffen(s.liste[s.index]);
  }

  async function sichern(neu: RutschStand) {
    let s = neu;
    while (!fertig(s) && !gueltig(s)) s = { ...s, index: s.index + 1 };
    stand = s;
    gewaehlt = null;
    serie = null;
    fehler = '';
    const ende = fertig(s);
    // Den nächsten Schritt sofort zeigen (nicht erst nach dem Speichern): wer schnell schon die
    // nächste Datei wählt, darf sie nicht durch ein spätes Zurücksetzen verlieren.
    if (!ende) {
      phase = 'schritt';
      window.scrollTo(0, 0);
    }
    if (!nurPerson)
      await einstellungenAendern(await db(), { rutsch: ende ? null : $state.snapshot(s) });
    await neuLaden();
    if (!ende) return;
    if (offeneDinge(staende) === 0) {
      abschliessen(heim); // Alles da: direkt die fertige Übersicht.
    } else {
      phase = 'ende';
      window.scrollTo(0, 0);
    }
  }

  /**
   * Frei springen (Band, Personen, Zurück und Weiter): Nichts gilt dadurch als übersprungen, und
   * was offen bleibt, steht am Ende in der Liste.
   */
  async function springen(i: number) {
    if (await auskunftMerken()) await neuLaden();
    const richtung = i < stand.index ? -1 : 1;
    let ziel = i;
    while (ziel >= 0 && ziel < stand.liste.length && !unterlageVon(stand.liste[ziel]))
      ziel += richtung;
    if (ziel < 0) return;
    gewaehlt = null;
    serie = null;
    fehler = '';
    if (ziel >= stand.liste.length) {
      await sichern({ ...$state.snapshot(stand), index: stand.liste.length });
      return;
    }
    stand = { ...$state.snapshot(stand), index: ziel };
    phase = 'schritt';
    window.scrollTo(0, 0);
    if (!nurPerson) await einstellungenAendern(await db(), { rutsch: $state.snapshot(stand) });
  }

  function ersterVon(personId: string): number {
    return stand.liste.findIndex((p) => p.personId === personId);
  }

  // Inzwischen Erledigtes am Anfang der fortgesetzten Runde gleich überspringen.
  onMount(() => {
    if (fortsetzen && !gueltig(stand)) void sichern(stand);
  });

  function los() {
    void sichern(stand);
  }

  function naechster(ergebnis: RutschErgebnis) {
    void sichern(weiter(stand, ergebnis));
  }

  async function nichtDa() {
    if (!aktuell) return;
    const { person, stand: u } = aktuell;
    await dokumentAendern(
      await db(),
      person.id,
      u.typ.id,
      u.typ.serie?.anzahl ?? null,
      nochNicht(u.dokument ?? {}, new Date()),
    );
    naechster('nochNicht');
  }

  function hochgeladen() {
    if (!aktuell) return;
    const u = aktuell.stand;
    const anzahl = u.typ.serie?.anzahl ?? 0;
    const alle = [
      ...new Set(u.versionen.map((v) => v.abrechnungsmonat).filter((m): m is string => !!m)),
    ].sort();
    const neuester = alle.at(-1);
    if (anzahl > 1 && neuester) {
      // Fenster der Serie: bis zum erwarteten neuesten Monat (Entwurf RS1, „der neueste zuerst“).
      const fenster = serienFenster(neuester, anzahl, new Date(), aktuell.person.abrechnungMeist);
      const fehlend = fenster.filter((m) => !alle.includes(m));
      const vorschlag = fehlend.at(-1);
      if (vorschlag) {
        serie = {
          drin: monatName(neuester),
          fenster: fenster.map((m) => ({ monat: m, da: alle.includes(m) })),
          fehlend,
          vorschlag,
        };
        gewaehlt = null;
        phase = 'schritt';
        window.scrollTo(0, 0);
        return;
      }
    }
    naechster('hochgeladen');
  }

  /** „August und Oktober“ */
  function aufzaehlung(monate: string[]): string {
    const namen = monate.map((m) => monatName(m));
    return namen.length < 2
      ? (namen[0] ?? '')
      : `${namen.slice(0, -1).join(', ')} ${t('rutsch.und')} ${namen.at(-1)}`;
  }

  function dateiGewaehlt(liste: FileList | null) {
    if (!liste?.length) return;
    fehler = '';
    gewaehlt = [...liste];
    phase = 'gewaehlt';
  }

  const ergebnisse = $derived(zaehlen(stand));
  // Z4: seit dem Start fällig geworden (nur am Ende gezeigt); „Gleich mitmachen“ startet eine
  // kurze Runde nur damit.
  const neuePosten = $derived(
    phase === 'ende'
      ? neuDazu(stand, nurPerson ? staende.filter((x) => x.person.id === nurPerson) : staende)
      : [],
  );
  const neu = $derived(
    neuePosten.map((p) => ({
      schluessel: postenSchluessel(p),
      person: staende.find((s) => s.person.id === p.personId)?.person,
      typ: staende.flatMap((s) => s.unterlagen).find((u) => u.typ.id === p.typ)?.typ,
    })),
  );
  function mitmachen() {
    void sichern({ liste: $state.snapshot(neuePosten), index: 0, ergebnisse: {} });
  }
  // Auch, woran man nur vorbeigesprungen ist, solange es offen ist.
  const uebersprungen = $derived(
    stand.liste.flatMap((p, index) => {
      const e = stand.ergebnisse[postenSchluessel(p)];
      return e === 'uebersprungen' || e === 'nochNicht' || (!e && nochOffen(p))
        ? [
            {
              schluessel: postenSchluessel(p),
              index,
              person: staende.find((s) => s.person.id === p.personId)?.person,
              typ: unterlageVon(p)?.typ,
            },
          ]
        : [];
    }),
  );
  // Nichts hochgeladen: kein „Gut gemacht.“ (Abgleich Design 31.10., Entwurf R3b).
  const nichtsZuTun = $derived(!ergebnisse.hochgeladen && !uebersprungen.length);
  const endeTitel = $derived(
    nichtsZuTun
      ? t('rutsch.endeTitelNichts')
      : ergebnisse.hochgeladen
        ? t('rutsch.endeTitel')
        : t('rutsch.endeTitelSpaeter'),
  );
  // Nichts übersprungen: keine Null im Satz und kein leerer Kasten (Prüfkatalog R10, C19).
  // R3e: In dieser Runde war nichts zu tun, aber bei anderen ist noch etwas offen.
  const restSatz = $derived.by(() => {
    const namen = staende
      .filter((s) => s.unterlagen.some((u) => u.status === 'fehlt' || u.status === 'bald'))
      .map((s) => s.person.rufname || s.person.vorname);
    if (!namen.length) return t('rutsch.endeNichtsMehr');
    if (namen.length === 1) return t('rutsch.endeRest.eins', { name: namen[0]! });
    if (namen.length === 2) return t('rutsch.endeRest.zwei', { a: namen[0]!, b: namen[1]! });
    return t('rutsch.endeRest.mehr');
  });
  const endeLead = $derived.by(() => {
    const drin = ergebnisse.hochgeladen;
    const offen = uebersprungen.length;
    if (!drin && !offen) return restSatz;
    if (!drin) return t('rutsch.endeAlleUebersprungen', { anzahl: offen });
    if (offen)
      return `${t('rutsch.endeDrin', { anzahl: drin })} ${t('rutsch.endeUebersprungen', { anzahl: offen })}`;
    return drin === 2 ? t('rutsch.endeBeideDrin') : t('rutsch.endeAlleDrin', { anzahl: drin });
  });

  const schrittText = $derived(
    t('rutsch.schritt', { schritt: stand.index + 1, gesamt: stand.liste.length }),
  );
  const uploadFormular = () => import('../ui/UploadFormular.svelte');

  // Neuer Schritt: Der alte Knopf ist weg, der Fokus stünde sonst auf der ganzen Seite. Screenreader
  // fingen dann oben wieder an.
  function titelFokus(titel: HTMLElement) {
    if (document.activeElement && document.activeElement !== document.body) return;
    titel.tabIndex = -1;
    titel.focus({ preventScroll: true });
  }
</script>

{#snippet zeichen(farbeNr: number, buerge: boolean)}
  <i class="zeichen-p person-ton" class:umriss={buerge} style={tonStil(farbeNr)} aria-hidden="true"
  ></i>
{/snippet}

{#snippet hilfeText()}
  {#if aktuell}
    {#if serie}
      <p class="hilfe" role="status">
        {t('rutsch.serieNoch', {
          anzahl: serie.fehlend.length,
          monat: serie.drin,
          zahl: zahlwort(serie.fehlend.length),
        })}
      </p>
      <ul class="marken">
        {#each serie.fenster as f (f.monat)}
          <li class:da={f.da}>
            {#if f.da}<Symbol name="haken" groesse={16} />{/if}{monatName(f.monat)}
          </li>
        {/each}
      </ul>
    {:else if aktuell.stand.typ.inAppErstellt}
      <p class="hilfe">{auskunftLead}</p>
    {:else if schonDa}
      <p class="hilfe">{t('rutsch.schonDa')}</p>
    {:else if aktuell.stand.status === 'fehlt' && aktuell.stand.veraltet && aktuell.stand.neuestesDatum}
      <!-- Z2: zu alt, mit Grund und Datum -->
      <p class="hilfe">
        {t('rutsch.zuAlt', {
          datum: tagKurz(aktuell.stand.neuestesDatum),
          grenze: alterGrenze(aktuell.stand),
        })}
      </p>
    {:else if aktuell.stand.typ.hilfe}
      <p class="hilfe">{aktuell.stand.typ.hilfe}</p>
    {/if}
  {/if}
{/snippet}

{#snippet kopf()}
  <div class="kopf">
    <Zurueck href="#{heim}" text={t('rutsch.pause')} />
    <span class="fortschritt">{schrittText}</span>
  </div>
  {#if aktuell}
    {@const aktiv = proPerson.findIndex((x) => x.person.id === aktuell.person.id)}
    <div class="register-rahmen">
      {#if proPerson.length > 1}
        <!-- DP39, 1.3 (W18): Reiter je Person, in der Reihenfolge des Haushalts; Namen nie gekürzt. -->
        <nav class="register" aria-label={t('rutsch.navi')}>
          {#each proPerson as x, i (x.person.id)}
            <button
              type="button"
              class="reiter person-ton"
              class:an={i === aktiv}
              style={tonStil(x.farbe)}
              aria-current={i === aktiv ? 'true' : undefined}
              onclick={() => springen(ersterVon(x.person.id))}
            >
              {@render zeichen(x.farbe, buergeVon(x.person.id))}<span class="reiter-name"
                >{rufname(x.person)}</span
              ><small>{fertigVon(x.person.id)}/{x.anzahl}</small>
            </button>
          {/each}
        </nav>
      {/if}
      <div
        class="karte person-ton"
        class:ecke={aktiv === 0 && proPerson.length > 1}
        style={tonStil(aktuell.farbe)}
      >
        <div class="linie">
          <Haarlinie stuecke={stueckeVon(aktuell.person.id)} {springen} />
        </div>
        <!-- Jeder Schritt blendet kurz ein; Register und Linie bleiben stehen (W8, W9). -->
        {#key `${stand.index}-${serie?.vorschlag ?? ''}`}
          <div class="einblenden">
            <p class="fuer">
              {@render zeichen(aktuell.farbe, aktuell.rolle === 'buerge')}{t('rutsch.fuer', {
                name: rufname(aktuell.person),
              })}
            </p>
            <h1
              class="unterlage"
              use:passend={['26px/30px', '23px/27px', '21px/25px']}
              use:titelFokus
            >
              {aktuell.stand.typ.text}
            </h1>
            {@render hilfeText()}
          </div>
        {/key}
      </div>
    </div>
  {/if}
{/snippet}

{#snippet personZeile(
  x: { person: { id: string; rufname: string; vorname: string }; farbe: number; anzahl: number },
  unter: string,
)}
  <li class="person-zeile person-ton" style={tonStil(x.farbe)}>
    <button type="button" class="pz-knopf" onclick={() => springen(ersterVon(x.person.id))}>
      <span class="pz-name"
        >{@render zeichen(x.farbe, buergeVon(x.person.id))}<b>{rufname(x.person)}</b></span
      >
      <small>{unter}</small>
    </button>
    <div class="pz-linie"><Haarlinie stuecke={stueckeVon(x.person.id)} /></div>
  </li>
{/snippet}

<main class="seite">
  {#if phase === 'start'}
    <div class="kopf"><Zurueck href="#{heim}" text={heimName} /></div>
    <div class="titelblock">
      <h1 use:passend={TITEL_BREIT} class="display-breit frage">{t('rutsch.startTitel')}</h1>
      {#if stand.liste.length}
        <p class="lead">
          {t('rutsch.startLead', { anzahl: stand.liste.length })}
        </p>
      {:else}
        <p class="lead">{t('rutsch.nichtsOffen')}</p>
      {/if}
    </div>
    {#if stand.liste.length}
      <!-- DP39, Start: je Person eine Zeile mit Rolle, Anzahl und Haarlinie, alles offen. -->
      <ul class="karte-weiss personen">
        {#each proPerson as x (x.person.id)}
          {@const s = staende.find((y) => y.person.id === x.person.id)}
          {@render personZeile(
            x,
            `${s ? rollenText(s.rolle, s.bezeichnung) : ''}, ${zahlwort(x.anzahl)}`,
          )}
        {/each}
      </ul>
      <p class="tipp">{t('rutsch.tipp')}</p>
    {/if}
  {:else if phase === 'ende'}
    <div class="kopf"><Zurueck href="#{heim}" text={heimName} /></div>
    <div class="titelblock">
      <h1 use:passend={TITEL_BREIT} class="display-breit frage">{endeTitel}</h1>
      <p class="lead">{endeLead}</p>
    </div>
    {#if stand.liste.length && (ergebnisse.hochgeladen || uebersprungen.length)}
      <!-- DP39, Ende: Reihen je Person mit „{n} von {N}“ und Haarlinie, darunter die Legende. -->
      <ul class="karte-weiss personen">
        {#each proPerson as x (x.person.id)}
          {@render personZeile(
            x,
            t('rutsch.endeVon', { fertig: fertigVon(x.person.id), gesamt: x.anzahl }),
          )}
        {/each}
      </ul>
      {#if hatUebersprungen}
        <p class="legende">
          <svg
            viewBox="0 0 12 12"
            width="12"
            height="12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
            ><path d="M2 8.5C2.6 5 6.5 3.4 9.4 5.6" /><path d="M9.6 2.9v2.9H6.7" /></svg
          >{t('rutsch.legende')}
        </p>
      {/if}
    {/if}
    {#if neu.length}
      <!-- DP39: „Hier war schon alles da.“ mit der offenen Unterlage als Zeile und „Gleich mitmachen“. -->
      <section class="neu-dazu" aria-labelledby="neu-dazu">
        <h2 id="neu-dazu" class="visually-hidden">
          {nichtsZuTun ? t('rutsch.nochOffenTitel') : t('rutsch.neuDazuTitel')}
        </h2>
        <ul class="karte-weiss">
          {#each neu as x, i (x.schluessel)}
            <li class="neu-zeile">
              {#if x.typ}<Symbol name={x.typ.symbol} groesse={20} />{/if}
              <span class="tx"
                ><b>{x.typ ? listenText(x.typ) : ''}</b><small
                  >{t('rutsch.endeFuer', { name: rufname(x.person) })}</small
                ></span
              >
              {#if i === 0}
                <button type="button" class="mitmachen" onclick={mitmachen}
                  >{t('rutsch.gleichMitmachen')}</button
                >
              {/if}
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {:else if aktuell}
    {@render kopf()}
    {#key `${stand.index}-${phase}-${serie?.vorschlag ?? ''}`}
      <div class="einblenden">
        {#if phase === 'schritt'}
          {#if aktuell.stand.typ.inAppErstellt}
            {#if auskunft}
              <div class="auskunft">
                {#key auskunft.schluessel}
                  <SelbstauskunftAkkordeon
                    bind:this={akkordeon}
                    start="zu"
                    bind:eingabe={auskunft.eingabe}
                    person={aktuell.person}
                    rolle={aktuell.rolle}
                    du={aktuell.rolle === 'hauptmieter'}
                    allein={vertragsZahl === 1 && !wer.kinder && wer.erwachsene === 1}
                    einziehendText={einziehendText(wer)}
                    gruppen={{
                      vertrag: vertragsZahl,
                      kinder: wer.kinder,
                      weitere: wer.erwachsene - vertragsZahl,
                    }}
                    vonName={angabenVon}
                  />
                {/key}
              </div>
            {/if}
            <div class="ausweg">
              <button
                type="button"
                class="textlink"
                onclick={() => auskunftSichern('uebersprungen')}>{t('rutsch.ueberspringen')}</button
              >
              <span>{t('rutsch.ueberspringenHinweis')}</span>
            </div>
          {:else}
            {#if fehler}
              <!-- D7: starker Hinweis über der Kachel; man versucht es direkt nochmal. -->
              <div class="datei-fehler"><Notiz stark><p role="alert">{fehler}</p></Notiz></div>
            {/if}
            <label class="kachel">
              <Symbol name="datei" groesse={24} />
              <span class="tx"
                ><b
                  >{serie
                    ? t('rutsch.serieWaehlen', { monat: monatName(serie.vorschlag) })
                    : schonDa
                      ? t('rutsch.neuereDatei')
                      : t('rutsch.dateiWaehlen')}</b
                >{#if aktuell.stand.typ.serie && !serie}<small>{t('rutsch.serieAufEinmal')}</small
                  >{/if}</span
              >
              <input
                class="visually-hidden"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                data-feld="pdf"
                onchange={(e) => dateiGewaehlt(e.currentTarget.files)}
              />
            </label>
            {#if !serie && !schonDa}<p class="sicher">{t('rutsch.papier')}</p>{/if}
            {#if serie}<p class="sicher">{t('rutsch.serieMehrere')}</p>{/if}
            <div class="ausweg">
              {#if serie}
                <button type="button" class="textlink" onclick={() => naechster('hochgeladen')}
                  >{t('rutsch.serieWeiterLink')}</button
                >
                <span
                  >{t('rutsch.serieOffen', {
                    anzahl: serie.fehlend.length,
                    monate: aufzaehlung(serie.fehlend),
                  })}</span
                >
              {:else if schonDa}
                <button type="button" class="textlink" onclick={() => springen(stand.index + 1)}
                  >{t('rutsch.weiter')}</button
                >
              {:else if aktuell.stand.status === 'bald'}
                <button type="button" class="textlink" onclick={nichtDa}
                  >{t('rutsch.nochNichtDa')}</button
                >
                <span
                  >{aktuell.stand.dokument?.stummMonat === monatAus(new Date())
                    ? t('rutsch.nochNichtZweitesMal')
                    : t('rutsch.nochNichtDaHinweis')}</span
                >
              {:else}
                <button type="button" class="textlink" onclick={() => naechster('uebersprungen')}
                  >{t('rutsch.ueberspringen')}</button
                >
                <span>{t('rutsch.ueberspringenHinweis')}</span>
              {/if}
            </div>
          {/if}
        {:else if gewaehlt}
          <div class="formular">
            {#await uploadFormular() then modul}
              {#key gewaehlt}
                <modul.default
                  person={aktuell.person}
                  typ={aktuell.stand.typ}
                  start={gewaehlt}
                  knopfText={t('rutsch.speichernWeiter')}
                  vorbelegterMonat={serie?.vorschlag ?? null}
                  fixiert
                  onfertig={hochgeladen}
                  onleer={(f: string) => {
                    fehler = f;
                    gewaehlt = null;
                    phase = 'schritt';
                  }}
                  abbrechen={{
                    text: t('allgemein.abbrechen'),
                    onclick: () => {
                      fehler = '';
                      gewaehlt = null;
                      phase = 'schritt';
                    },
                  }}
                />
              {/key}
            {/await}
          </div>
        {/if}
      </div>
    {/key}
  {/if}
</main>

{#if phase === 'start'}
  {#if stand.liste.length}
    <Aktionsleiste
      text={t('rutsch.los')}
      onclick={los}
      neben={{ text: t('rutsch.spaeter'), onclick: () => abschliessen(heim) }}
    />
  {:else}
    <Aktionsleiste text={t('rutsch.zurUebersicht')} href="#{heim}" />
  {/if}
{:else if phase === 'schritt' && aktuell?.stand.typ.inAppErstellt}
  {#if ausfuellen || !auskunftGrund}
    <Aktionsleiste
      text={t('rutsch.speichernWeiter')}
      grund={auskunftGrund}
      beiGrund={() => akkordeon?.fehlendenOeffnen()}
      onclick={() => auskunftSichern('hochgeladen')}
    />
  {:else}
    <Aktionsleiste
      text={t('person.ausfuellen')}
      onclick={() => {
        ausfuellenBei = auskunft?.schluessel ?? null;
        akkordeon?.fehlendenOeffnen();
      }}
    />
  {/if}
{:else if phase === 'ende'}
  <Aktionsleiste
    text={t('rutsch.zurUebersicht')}
    href="#{heim}"
    neben={nichtsZuTun
      ? undefined
      : { text: t('uebersicht.trotzdem'), onclick: () => gehe('/mappe') }}
  />
{/if}

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(20px + env(safe-area-inset-top)) 0
      max(calc(150px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 52px;
    padding: 0 16px 0 12px;
  }

  .fortschritt {
    font-size: calc(15 * var(--px));
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  .titelblock {
    padding: 4px 20px 0;
  }

  .frage {
    margin-top: 8px;
    text-wrap: balance;
  }

  /* Zeichen der Person: Fläche in der App-Farbe, Bürgen mit Umriss in der Druckfarbe (DP39, 1.1). */
  .zeichen-p {
    display: inline-block;
    flex: none;
    width: 10px;
    height: 10px;
    border-radius: 2px;
    background: var(--p-app);
  }

  .zeichen-p.umriss {
    background: none;
    box-shadow: inset 0 0 0 2px var(--p-linie);
  }

  /* Register (DP39, 1.3): Reiter je Person, die Karte schließt am aktiven ohne Spalt an. */
  .register-rahmen {
    margin: 4px 16px 0;
    container-type: inline-size;
  }

  .register {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 4px;
  }

  .reiter {
    display: flex;
    flex: 0 1 auto;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 44px;
    margin-bottom: 4px;
    padding: 12px 16px;
    border: 0;
    border-radius: 14px 14px 0 0;
    background: var(--track);
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 500;
    overflow-wrap: anywhere;
    text-align: left;
    cursor: pointer;
  }

  .reiter.an {
    margin-bottom: 0;
    background: var(--p-tint);
    color: var(--ink);
    font-weight: 650;
  }

  .reiter small {
    font-size: calc(13 * var(--px));
    font-weight: 500;
    color: var(--ink-muted);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  /* Bis 300 px brechen die Reiter um; der aktive steht unten, damit er an der Karte hängt. */
  @container (max-width: 300px) {
    .reiter.an {
      order: 1;
    }
  }

  .karte {
    --hl-grund: var(--p-tint);
    padding: 16px 20px 20px;
    border-radius: 20px;
    background: var(--p-tint);
    color: var(--ink);
  }

  .karte.ecke {
    border-top-left-radius: 0;
  }

  .linie {
    margin: 0 0 16px;
  }

  .fuer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 600;
  }

  .unterlage:focus {
    outline: none;
  }

  .unterlage {
    margin: 4px 0 0;
    font-size: calc(26 * var(--px));
    line-height: calc(30 * var(--px));
    font-weight: 650;
    hyphens: manual;
  }

  .hilfe {
    margin: 8px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(20 * var(--px));
  }

  .marken {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin: 12px 0 0;
    padding: 0;
    list-style: none;
  }

  .marken li {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: 32px;
    padding: 0 12px;
    border-radius: 16px;
    background: var(--surface);
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    font-weight: 600;
  }

  .marken li.da {
    color: var(--ink);
  }

  /* Weiße Karten mit Zeilen: Start, Ende, „Hier war schon alles da.“ */
  .karte-weiss {
    margin: 20px 16px 0;
    padding: 0;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
    container-type: inline-size;
  }

  /* 320 px mit Text 130 %: Name oben, Haarlinie darunter in voller Breite. */
  @container (max-width: 300px) {
    .person-zeile {
      grid-template-columns: minmax(0, 1fr);
      gap: 4px;
    }
  }

  .person-zeile {
    display: grid;
    grid-template-columns: minmax(96px, auto) minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 8px 16px;
  }

  .person-zeile + .person-zeile,
  .neu-zeile + .neu-zeile {
    border-top: 1px solid var(--track);
  }

  .pz-knopf {
    display: grid;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .pz-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pz-name b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 650;
  }

  .pz-knopf small {
    padding-left: 18px;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .legende {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 12px 20px 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .tipp,
  .sicher {
    margin: 16px 20px 0;
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  /* „PDF wählen“ als weiße Zeile (DP39, Abschnitt 4). */
  .kachel {
    display: flex;
    align-items: center;
    gap: 16px;
    min-height: 72px;
    margin: 12px 16px 0;
    padding: 16px;
    border-radius: 20px;
    background: var(--surface);
    color: var(--ink);
    cursor: pointer;
  }

  .kachel:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .tx {
    display: grid;
    flex: 1;
    min-width: 0;
  }

  .tx b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 650;
  }

  .tx small {
    margin-top: 2px;
    font-size: calc(13 * var(--px));
    line-height: calc(17 * var(--px));
    color: var(--ink-muted);
  }

  .datei-fehler {
    margin: 16px 16px 0;
  }

  .ausweg {
    display: grid;
    justify-items: center;
    gap: 4px;
    margin-top: 48px;
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
    text-align: center;
  }

  .ausweg .textlink {
    color: var(--ink);
    font-weight: 600;
    text-decoration: none;
  }

  .auskunft {
    margin: 12px 16px 0;
  }

  .formular {
    margin: 12px 16px 0;
  }

  .neu-dazu {
    margin: 0;
  }

  .neu-zeile {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 12px;
    min-height: 60px;
    padding: 12px 16px;
  }

  .neu-zeile .tx {
    display: grid;
    flex: 1 1 8em;
    min-width: 0;
  }

  .mitmachen {
    margin-left: auto;
    min-height: 44px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }
</style>
