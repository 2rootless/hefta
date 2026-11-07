<script lang="ts">
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  // „Unterlagen in einem Rutsch“ (design/einrichtung-rutsch-navigation.md, Abschnitt 2; Entwürfe R0–R3):
  // Start mit allen offenen Unterlagen, dann eine nach der anderen, Person für Person. Pause führt zur
  // Übersicht, der Stand bleibt in den Einstellungen. Nur „PDF wählen“ (Entscheidung G).
  import { onMount, untrack } from 'svelte';
  import { daten, db, gehe, neuLaden } from '../app/daten.svelte';
  import { abschliessen } from '../app/router.svelte';
  import { monatAus, nochNicht, serienFenster } from '../domain/fristen';
  import {
    ohneTrennstellen,
    eintragenText,
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
  import BandQuer, { type QuerStein } from '../ui/BandQuer.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { alterGrenze, tagKurz } from '../ui/texte';
  import { passend, TITEL } from '../ui/passend';
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

  function farbe(personId: string): number {
    return staende.find((s) => s.person.id === personId)?.farbe ?? 1;
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

  const steine = $derived<QuerStein[]>(
    stand.liste.map((p, i) => {
      const ergebnis = stand.ergebnisse[postenSchluessel(p)];
      const art: QuerStein['art'] =
        i === stand.index && phase !== 'start' && phase !== 'ende'
          ? 'aktuell'
          : ergebnis === 'hochgeladen' || (unterlageVon(p) && !nochOffen(p))
            ? 'drin'
            : ergebnis || !unterlageVon(p)
              ? 'weg'
              : 'offen';
      return { farbe: farbe(p.personId), art };
    }),
  );
  const stellen = $derived(
    stand.liste.map((p, i) =>
      t('rutsch.stelle', {
        schritt: i + 1,
        gesamt: stand.liste.length,
        unterlage: unterlageVon(p)?.typ.text.replaceAll('\u00ad', '') ?? '',
        name: (() => {
          const person = staende.find((x) => x.person.id === p.personId)?.person;
          return person?.rufname || person?.vorname || '';
        })(),
      }),
    ),
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

  // Für Screenreader: Das Band ist ein Bild mit einem Satz.
  const bandSatz = $derived(
    t('rutsch.bandSatz', {
      schritt: zahlwort(stand.index + 1),
      gesamt: zahlwort(stand.liste.length),
      unterlage: aktuell ? ohneTrennstellen(eintragenText(aktuell.stand.typ)) : '',
      name: aktuell ? aktuell.person.rufname || aktuell.person.vorname : '',
    }),
  );
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

{#snippet kopf()}
  <div class="kopf">
    <Zurueck href="#{heim}" text={t('rutsch.pause')} />
    <span class="fortschritt">{schrittText}</span>
  </div>
  {#if phase === 'schritt'}
    <BandQuer {steine} beschriftung={bandSatz} {springen} {stellen} />
    <nav class="navi" aria-label={t('rutsch.navi')}>
      <button
        type="button"
        class="navi-knopf"
        disabled={stand.index === 0}
        onclick={() => springen(stand.index - 1)}
      >
        <span class="gedreht"><Symbol name="weiter" groesse={16} /></span>{t('rutsch.zurueck')}
      </button>
      <!-- Vorwärts geht es unten, mit dem Satz, was aus der Unterlage wird (R5). -->
      {#if proPerson.length > 1}
        <div class="sprung">
          {#each proPerson as x (x.person.id)}
            <button
              type="button"
              class="sprung-person farbe-{x.farbe}"
              aria-current={x.person.id === aktuell?.person.id ? 'true' : undefined}
              aria-label={t('rutsch.zuPerson', { name: x.person.rufname || x.person.vorname })}
              onclick={() => springen(ersterVon(x.person.id))}
              >{x.person.rufname || x.person.vorname}</button
            >
          {/each}
        </div>
      {/if}
    </nav>
  {:else}
    <BandQuer {steine} beschriftung={schrittText} />
  {/if}
{/snippet}

<main class="seite">
  {#if phase === 'start'}
    <div class="kopf"><Zurueck href="#{heim}" text={t('navigation.uebersicht')} /></div>
    <div class="titelblock">
      <h1 use:passend={TITEL} class="display frage">{t('rutsch.startTitel')}</h1>
      {#if stand.liste.length}
        <p class="lead">
          {t('rutsch.startLead', { anzahl: stand.liste.length })}
        </p>
      {:else}
        <p class="lead">{t('rutsch.nichtsOffen')}</p>
      {/if}
    </div>
    {#if stand.liste.length}
      <BandQuer
        {steine}
        {springen}
        {stellen}
        beschriftung={t('rutsch.startLead', { anzahl: stand.liste.length })}
      />
      <ul class="personen">
        {#each proPerson as x (x.person.id)}
          <li>
            <button
              type="button"
              class="pille farbe-{x.farbe}"
              onclick={() => springen(ersterVon(x.person.id))}
            >
              {t('rutsch.personZahl', {
                name: x.person.rufname || x.person.vorname,
                anzahl: x.anzahl,
              })}
            </button>
          </li>
        {/each}
      </ul>
      <p class="tipp">{t('rutsch.tipp')}</p>
    {/if}
  {:else if phase === 'ende'}
    <div class="kopf"><Zurueck href="#{heim}" text={t('navigation.uebersicht')} /></div>
    <div class="titelblock">
      <h1 use:passend={TITEL} class="display frage">{endeTitel}</h1>
      <p class="lead">{endeLead}</p>
    </div>
    <BandQuer {steine} beschriftung={endeTitel} {springen} {stellen} />
    {#if uebersprungen.length}
      <h2 class="liste-titel">{t('rutsch.uebersprungenTitel')}</h2>
      <ul class="liste liste-mit-titel">
        {#each uebersprungen as x (x.schluessel)}
          <li>
            <button type="button" class="eintrag" onclick={() => springen(x.index)}>
              <span class="punkt farbe-{farbe(x.person?.id ?? '')}" aria-hidden="true"></span>
              <span class="eintrag-text"
                >{x.typ ? listenText(x.typ) : ''}
                <span class="fuer-name"
                  >{t('rutsch.endeFuer', { name: x.person?.rufname ?? '' })}</span
                ></span
              >
              <Symbol name="weiter" groesse={16} />
            </button>
          </li>
        {/each}
      </ul>
    {/if}
    {#if neu.length}
      <section class="neu-dazu" aria-labelledby="neu-dazu">
        <h2 id="neu-dazu">
          {nichtsZuTun ? t('rutsch.nochOffenTitel') : t('rutsch.neuDazuTitel')}
        </h2>
        <ul>
          {#each neu as x (x.schluessel)}
            <li>
              <span class="punkt farbe-{farbe(x.person?.id ?? '')}" aria-hidden="true"></span>
              <span
                >{x.typ ? listenText(x.typ) : ''}
                <span class="fuer-name"
                  >{t('rutsch.endeFuer', { name: x.person?.rufname ?? '' })}</span
                ></span
              >
            </li>
          {/each}
        </ul>
        <button type="button" class="knopf-klein" onclick={mitmachen}
          >{t('rutsch.gleichMitmachen')}</button
        >
      </section>
    {/if}
  {:else if aktuell}
    {@render kopf()}
    <!-- Jeder Schritt blendet kurz ein; das Band oben bleibt stehen. -->
    {#key `${stand.index}-${phase}-${serie?.vorschlag ?? ''}`}
      <div class="einblenden">
        {#if phase === 'schritt'}
          <div class="karte farbe-{aktuell.farbe}" class:zusatz={aktuell.rolle === 'buerge'}>
            <p class="fuer">
              {t('rutsch.fuer', { name: aktuell.person.rufname || aktuell.person.vorname })}
            </p>
            <h1
              class="unterlage"
              use:passend={['28px/31px', '24px/28px', '21px/25px']}
              use:titelFokus
            >
              {aktuell.stand.typ.text}
            </h1>
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
          </div>
          {#if aktuell.stand.typ.inAppErstellt}
            {#if auskunft}
              <div class="auskunft">
                {#key auskunft.schluessel}
                  <SelbstauskunftAkkordeon
                    bind:this={akkordeon}
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
              <Symbol name="datei" groesse={28} />
              {serie
                ? t('rutsch.serieWaehlen', { monat: monatName(serie.vorschlag) })
                : schonDa
                  ? t('rutsch.neuereDatei')
                  : t('rutsch.dateiWaehlen')}
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
            <p class="sicher">
              {serie
                ? t('rutsch.serieMehrere')
                : aktuell.stand.typ.serie
                  ? t('rutsch.serieAufEinmal')
                  : t('rutsch.bleibt')}
            </p>
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
          <div class="klein-titel">
            <p class="fuer">
              {t('rutsch.fuer', { name: aktuell.person.rufname || aktuell.person.vorname })}
            </p>
            <h1 class="unterlage">{aktuell.stand.typ.text}</h1>
          </div>
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
  <Aktionsleiste
    text={t('rutsch.speichernWeiter')}
    grund={auskunftGrund}
    beiGrund={() => akkordeon?.fehlendenOeffnen()}
    onclick={() => auskunftSichern('hochgeladen')}
  />
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
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(150px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .fortschritt {
    font-size: calc(15 * var(--px));
    font-weight: 800;
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .frage {
    margin-top: 10px;
    text-wrap: balance;
  }

  .personen {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin: 18px var(--space-4) 0;
    padding: 0;
    list-style: none;
  }

  .pille {
    min-height: var(--tap-target);
    padding: 10px 18px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--farbe);
    color: var(--on-person);
    font-size: calc(16 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }

  /* Zurück und Personen (R5). Namen werden nie gekürzt; reicht es nicht, rutschen sie darunter. */
  .navi {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px 8px;
    padding: 0 var(--space-3);
  }

  .navi-knopf {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-height: var(--tap-target);
    padding: 0 6px;
    border: 0;
    background: none;
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }

  .navi-knopf:disabled {
    color: var(--ink-muted);
    opacity: 0.55;
    cursor: default;
  }

  .gedreht {
    display: inline-flex;
    transform: scaleX(-1);
  }

  .sprung {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-left: auto;
  }

  .sprung-person {
    min-height: var(--tap-target);
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-full);
    background: var(--farbe);
    color: var(--on-person);
    font-size: calc(15 * var(--px));
    line-height: calc(19 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }

  .sprung-person[aria-current] {
    box-shadow: inset 0 0 0 2px var(--ink);
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

  .tipp,
  .sicher {
    margin: 18px var(--space-5) 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
    color: var(--ink-muted);
  }

  .sicher {
    margin-top: 12px;
    font-size: calc(13 * var(--px));
  }

  .karte {
    margin: 14px var(--space-4) 0;
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

  .unterlage:focus {
    outline: none;
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

  .hilfe {
    margin: 4px 0 0;
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
  }

  .marken {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin: 10px 0 0;
    padding: 0;
    list-style: none;
  }

  .marken li {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    min-height: 32px;
    padding: 0 12px;
    border: 1.5px dashed var(--ink);
    border-radius: 16px;
    background: rgb(255 255 255 / 0.75);
    color: var(--ink);
    font-size: calc(14 * var(--px));
    font-weight: 700;
  }

  .marken li.da {
    border-style: solid;
    background: #fff;
  }

  .kachel {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    min-height: 120px;
    margin: 14px var(--space-4) 0;
    border-radius: 20px;
    background: var(--surface);
    box-shadow: 0 8px 18px rgb(25 26 44 / 0.08);
    font-size: calc(17 * var(--px));
    font-weight: 800;
    cursor: pointer;
  }

  .kachel:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .datei-fehler {
    margin: 16px var(--space-4) 0;
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

  .auskunft {
    margin: 24px var(--space-4) 0;
  }

  .klein-titel {
    padding: 14px var(--space-5) 0;
  }

  .klein-titel .unterlage {
    font-size: calc(26 * var(--px));
    line-height: calc(30 * var(--px));
  }

  .formular {
    margin: 10px var(--space-4) 0;
  }

  .liste-titel {
    margin: 24px var(--space-5) 0;
    font-size: calc(18 * var(--px));
    line-height: calc(24 * var(--px));
    font-weight: 800;
  }

  .liste-mit-titel {
    margin-top: 10px;
  }

  .liste {
    display: grid;
    gap: 6px;
    margin: 24px var(--space-4) 0;
    padding: 12px 16px;
    border-radius: 20px;
    background: var(--surface);
    list-style: none;
  }

  .eintrag {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    min-height: var(--tap-target);
    padding: 6px 0;
    border: 0;
    background: none;
    color: var(--ink);
    font-size: calc(17 * var(--px));
    line-height: calc(22 * var(--px));
    text-align: left;
    cursor: pointer;
  }

  .eintrag-text {
    flex: 1;
    min-width: 0;
  }

  .punkt {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--farbe);
  }

  .fuer-name {
    color: var(--ink-muted);
  }

  /* Z4: gestrichelter Kasten unter „Übersprungen“. */
  .neu-dazu {
    margin: 24px var(--space-4) 0;
    padding: 14px 16px 16px;
    border: 2px dashed var(--control-border);
    border-radius: 20px;
  }

  .neu-dazu h2 {
    margin: 0;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 800;
  }

  .neu-dazu ul {
    display: grid;
    margin: 4px 0 12px;
    padding: 0;
    list-style: none;
  }

  .neu-dazu li {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding-top: 10px;
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .knopf-klein {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    padding: 0 18px;
    border: 2px solid var(--ink);
    border-radius: var(--radius-full);
    background: none;
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }
</style>
