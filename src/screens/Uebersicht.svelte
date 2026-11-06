<script lang="ts">
  import { haushaltsAngabenAus } from '../ui/selbstauskunftEingabe';
  // Übersicht in Stil C (design/stil-c.md, design/uebersicht-kompakt.md): Kopfzeile mit Einstellungen,
  // Haushaltszeile, bunte Karten am schwingenden Band, Hauptaktion „Unterlagen hinzufügen“ unten.
  // Ohne Haushalt ein leerer Weg mit „Haushalt anlegen“.
  import { onMount } from 'svelte';
  import { daten, gehe } from '../app/daten.svelte';
  import { speicherPruefen } from '../app/hinweise.svelte';
  import { einstellungenZustand } from '../ui/einstellungen.svelte';
  import ErsterStart from './ErsterStart.svelte';
  import { pruefhinweise } from '../domain/pruefhinweise';
  import { listenText, offeneDinge, personStand, type PersonStand } from '../domain/regelkatalog';
  import { pruefAnzeige } from '../ui/pruefTexte';
  import { fertig as rutschFertig } from '../domain/rutsch';
  import { neueUnterlagen, tageSeit } from '../domain/zeit';
  import { t, zahlwort } from '../i18n';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import Band from '../ui/Band.svelte';
  import HaushaltsZeile from '../ui/HaushaltsZeile.svelte';
  import HinweisKasten from '../ui/HinweisKasten.svelte';
  import BackupZeile from '../ui/BackupZeile.svelte';
  import KarteC from '../ui/KarteC.svelte';
  import Kopfzeile from '../ui/Kopfzeile.svelte';
  import { passend } from '../ui/passend';

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

  function eintragen(s: PersonStand) {
    const u = s.naechster;
    if (!u) return;
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
  // PH1: je Person der erste Prüfhinweis. Was fehlt, geht vor; „Zu alt“ und „Neuer Monat“ warten.
  const pruefFunde = $derived(pruefhinweise(staende));
  function pruefung(s: PersonStand) {
    const n = s.naechster;
    if (n && n.status === 'fehlt' && !n.veraltet) return undefined;
    const u = s.unterlagen.find((x) => pruefFunde.has(`${s.person.id}/${x.typ.id}`));
    if (!u) return undefined;
    const h = pruefFunde.get(`${s.person.id}/${u.typ.id}`)!;
    return {
      unterlage: listenText(u.typ),
      kurz: pruefAnzeige(h, s.person.rufname || s.person.vorname).kurz,
      href: `#/unterlage/${s.person.id}/${u.typ.id}`,
    };
  }
  const offen = $derived(offeneDinge(staende));
  const fertig = $derived(staende.length > 0 && offen === 0);
  // U15: Backup älter als 30 Tage und seitdem Neues dazugekommen. Ohne Änderungen bleibt die Zeile ruhig.
  const backupAlt = $derived.by(() => {
    const zuletzt = daten.einstellungen?.letztesBackup;
    if (!zuletzt || !daten.ansicht) return null;
    const tage = tageSeit(zuletzt);
    const neu = neueUnterlagen(daten.ansicht.versionen, zuletzt);
    return tage > 30 && neu > 0 ? { tage, neu } : null;
  });
  const neustart = $derived(staende.length > 0 && (daten.ansicht?.versionen.length ?? 0) === 0);
  const allein = $derived(vertrag.length === 1);
  const kinder = $derived(daten.ansicht?.haushalt.kinder ?? 0);
  const weitere = $derived(daten.ansicht?.haushalt.weitereErwachsene ?? 0);
  const rufname = $derived((vertrag[0] ?? staende[0])?.person.rufname ?? '');
  const rutsch = $derived(daten.einstellungen?.rutsch ?? null);
  const pausiert = $derived(!!rutsch && rutsch.index > 0 && !rutschFertig(rutsch));

  const lead = $derived.by(() => {
    if (fertig) return allein ? t('uebersicht.fertigDu') : t('uebersicht.fertigIhr');
    if (neustart) return allein ? t('uebersicht.neustartDu') : t('uebersicht.neustartIhr');
    const werte = { anzahl: offen, zahl: zahlwort(offen) };
    return allein ? t('uebersicht.offenDu', werte) : t('uebersicht.offenIhr', werte);
  });

  // Das Band als ein Bild mit einem Satz (design/unterlage-warum-haushalt.md, Abschnitt 4).
  const bandSatz = $derived.by(() => {
    const gesamt = staende.reduce((n, s) => n + s.pfad.length, 0);
    const da = staende.reduce((n, s) => n + s.pfad.filter((u) => u.status === 'da').length, 0);
    return da === gesamt
      ? t('uebersicht.bandFertig', { gesamt: zahlwort(gesamt) })
      : t('uebersicht.bandSatz', {
          da: zahlwort(da),
          gesamt: zahlwort(gesamt),
          offen: zahlwort(gesamt - da),
        });
  });
  const offenZahlwort = $derived(zahlwort(offen));

  // Begrüßung immer einzeilig: 34 px, passt sie nicht, 28 px, dann 24 px (per Messung).
  const BEGRUESSUNG = ['34px/36px', '28px/30px', '24px/28px'];
</script>

{#if !daten.ansicht}
  <ErsterStart />
{:else}
  <main class="uebersicht">
    <Kopfzeile />
    <div class="titelblock">
      <h1 class="display begruessung" use:passend={BEGRUESSUNG}>
        {fertig ? t('uebersicht.fertigTitel') : t('uebersicht.hallo', { name: rufname })}
      </h1>
      <HaushaltsZeile {vertrag} {weitere} {kinder} />
      {#if meldung}<p class="meldung" role="status">{meldung}</p>{/if}
      <p class="lead">{lead}</p>
    </div>

    <HinweisKasten />

    <Band bild={bandSatz} {fertig} merken="uebersicht" ansage={t('uebersicht.fertigTitel')}>
      {#if buergen.length}
        <h2 class="abschnitt" data-band="track">{t('uebersicht.abschnittVertrag')}</h2>
      {/if}
      {#each vertrag as s (s.person.id)}
        <KarteC
          stand={s}
          ebene={buergen.length ? 3 : 2}
          oneintragen={() => eintragen(s)}
          pruefung={pruefung(s)}
        />
      {/each}

      {#if buergen.length}
        <h2 class="abschnitt" data-band="open">{t('uebersicht.abschnittBuergen')}</h2>
        <p class="trenner" data-band="open">{t('uebersicht.zusatzZeile')}</p>
        {#each buergen as s (s.person.id)}
          <KarteC
            stand={s}
            zusatz
            ebene={3}
            oneintragen={() => eintragen(s)}
            pruefung={pruefung(s)}
          />
        {/each}
      {/if}

      <div class="zielzeile" data-band-ziel>
        {#if fertig}
          <span class="erreicht">{t('uebersicht.zielErreicht')}</span>
        {:else}
          <a class="textlink" href="#/mappe">{t('uebersicht.trotzdem')}</a>
        {/if}
      </div>
    </Band>

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
    <Aktionsleiste text={t('uebersicht.erstellen')} href="#/mappe" />
  {:else if pausiert && rutsch}
    <Aktionsleiste
      text={t('uebersicht.weitermachen')}
      zusatz={t('uebersicht.vonZusatz', { schritt: rutsch.index + 1, gesamt: rutsch.liste.length })}
      href="#/rutsch"
    />
  {:else}
    <Aktionsleiste
      text={t('uebersicht.unterlagenHinzufuegen')}
      zusatz={t('uebersicht.offenZusatz', { anzahl: offen })}
      ansage={t('uebersicht.hauptAnsage', { offen: offenZahlwort })}
      href="#/rutsch"
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
    position: relative;
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    /* Platz für die fixierte Hauptaktion */
    padding-bottom: max(
      calc(140px + env(safe-area-inset-bottom)),
      calc(var(--leiste-hoehe, 0px) + 16px)
    );
  }

  .titelblock {
    padding: 6px var(--space-5) 0;
  }

  .begruessung {
    margin-top: 10px;
    white-space: nowrap;
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

  .trenner {
    margin: 0 0 8px var(--spalte);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .zielzeile {
    display: flex;
    align-items: center;
    min-height: 56px;
    margin-left: calc(var(--spalte) + 20px);
    font-size: calc(15 * var(--px));
    font-weight: 700;
  }

  .backup {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    margin: 22px var(--space-5) 0;
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
  }

  .backup.alt {
    flex-wrap: wrap;
    margin: 22px var(--space-4) 0;
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
