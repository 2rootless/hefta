<script lang="ts">
  // Backup einspielen (design/mappe-erstellen-einstellungen.md, Abschnitt 4, S6–S8): gewählte Datei,
  // Passwort, was jetzt in der App ist und was im Backup steckt. Das Backup ersetzt alles.
  import { onDestroy, onMount, tick } from 'svelte';
  import { daten, db, neuLaden } from '../app/daten.svelte';
  import { abschliessen, zurueckGehen } from '../app/router.svelte';
  import { tagAus } from '../domain/fristen';
  import { datum, groesse, t } from '../i18n';
  import { BackupFehler, backupAccept, backupArt } from '../storage/backup';
  import { istApp } from '../app/plattform';
  import {
    bestandAusDb,
    sicherungEinspielen,
    sicherungVorschau,
    type Bestand,
    type SicherungsVorschau,
  } from '../storage/sicherung';
  import { einstellungenAendern } from '../storage/speicher';
  import Aktionsleiste from '../ui/Aktionsleiste.svelte';
  import { bestandKurz, einstellungenZustand } from '../ui/einstellungen.svelte';
  import WerIstDabei from '../ui/WerIstDabei.svelte';
  import Notiz from '../ui/Notiz.svelte';
  import { tagKurz } from '../ui/texte';
  import Zurueck from '../ui/Zurueck.svelte';

  const datei = $derived(einstellungenZustand.datei);

  // E25: Vor dem Passwort nur Datum und „mit Passwort“. In der verschlüsselten Datei steht nichts
  // lesbar, auch kein Datum; es kommt aus dem Dateinamen, den Hefta beim Erstellen vergibt.
  function passwortZeile(d: File): string {
    const m = /(\d{4})-(\d{2})-(\d{2})/.exec(d.name);
    const tag = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
    return tag && !Number.isNaN(tag.getTime())
      ? t('einspielenSeite.mitPasswortDatum', { datum: datum(tag), groesse: groesse(d.size) })
      : t('einspielenSeite.mitPasswort', { groesse: groesse(d.size) });
  }
  // Vom ersten Start aus („Ich habe ein Backup“) gibt es noch keinen Haushalt: zurück dorthin.
  const heim = $derived(daten.ansicht ? '/einstellungen' : '/');
  let verschluesselt = $state(false);
  let passwort = $state('');
  let feld = $state<HTMLInputElement>();
  let vorschau = $state<SicherungsVorschau | null>(null);
  let passwortFalsch = $state(false);
  // Fehler, nach dem sich diese Datei nicht einspielen lässt (kein Backup, beschädigt, zu neu).
  let sperre = $state('');
  let jetzt = $state<Bestand | null>(null);
  let laeuft = $state(false);
  let pruefung: Promise<boolean> | null = null;
  // Schon als falsch gemeldet: Verlässt man das Feld, wird nicht noch einmal gefragt und nicht wieder fokussiert.
  let falschGeprueft = '';

  const appLeer = $derived(!!jetzt && jetzt.personen === 0 && jetzt.unterlagen === 0);

  function fehlerText(e: unknown): string {
    const grund = e instanceof BackupFehler ? e.grund : 'unbekannt';
    return t(`einspielenSeite.fehler.${grund}`);
  }

  async function dateiLesen(d: File | null) {
    vorschau = null;
    sperre = '';
    passwortFalsch = false;
    passwort = '';
    falschGeprueft = '';
    if (!d) return;
    const art = await backupArt(d);
    verschluesselt = art === 'verschluesselt';
    if (art === 'unbekannt') {
      sperre = t('einspielenSeite.fehler.kein_backup');
      return;
    }
    if (!verschluesselt) await pruefen();
    else {
      await tick();
      feld?.focus();
    }
  }

  /** Liest nur das Manifest: prüft das Passwort und zeigt, was im Backup steckt. */
  function pruefen(): Promise<boolean> {
    if (vorschau) return Promise.resolve(true);
    const d = datei;
    if (!d || (verschluesselt && !passwort)) return Promise.resolve(false);
    if (verschluesselt && passwort === falschGeprueft) return Promise.resolve(false);
    // Verlassen des Felds und Tipp auf „Einspielen“ kommen gleichzeitig: nur einmal prüfen.
    pruefung ??= (async () => {
      try {
        vorschau = await sicherungVorschau(d, verschluesselt ? passwort : undefined);
        passwortFalsch = false;
        return true;
      } catch (e) {
        vorschau = null;
        if (e instanceof BackupFehler && e.grund === 'passwort_falsch') {
          passwortFalsch = true;
          falschGeprueft = passwort;
          feld?.focus();
        } else sperre = fehlerText(e);
        return false;
      } finally {
        pruefung = null;
      }
    })();
    return pruefung;
  }

  async function einspielen() {
    if (!datei || laeuft) return;
    if (!vorschau && !(await pruefen())) return;
    // Vom ersten Start aus: danach die Übersicht, nicht die Einstellungen. Hinter ihnen läge noch der
    // alte Startbildschirm, und den zeigt iOS beim Zurückwischen als Standbild.
    const vomStart = !daten.ansicht;
    laeuft = true;
    try {
      const inhalt = await sicherungEinspielen(
        await db(),
        datei,
        verschluesselt ? passwort : undefined,
      );
      // Das eingespielte Backup existiert ja: sein Datum gilt als letztes Backup.
      await einstellungenAendern(await db(), { letztesBackup: inhalt.erstellt });
      await neuLaden();
      einstellungenZustand.datei = null;
      einstellungenZustand.meldung = t('einstellungen.eingespielt', {
        personen: bestandKurz(inhalt.bestand),
        unterlagen: t('zahlen.unterlagen', { anzahl: inhalt.unterlagen }),
        stand: tagKurz(tagAus(new Date(inhalt.erstellt))),
      });
      abschliessen(vomStart ? '/' : '/einstellungen');
    } catch (e) {
      sperre = fehlerText(e);
    } finally {
      laeuft = false;
    }
  }

  function andereDatei(d: File | undefined) {
    if (!d) return;
    einstellungenZustand.datei = d;
    void dateiLesen(d);
  }

  function abbrechen() {
    if (laeuft) return;
    einstellungenZustand.datei = null;
    zurueckGehen(heim);
  }

  // Wer weggeht, nimmt die Datei nicht mit: Beim nächsten Mal wird neu gewählt.
  onDestroy(() => {
    if (!laeuft) einstellungenZustand.datei = null;
  });

  const grund = $derived(
    !datei
      ? t('einspielenSeite.keineDatei')
      : sperre
        ? sperre
        : verschluesselt && !passwort
          ? t('einspielenSeite.passwortFehlt')
          : undefined,
  );

  onMount(() => {
    void (async () => {
      jetzt = await bestandAusDb(await db());
    })();
    void dateiLesen(datei);
  });
</script>

<main class="seite">
  <div class="kopf">
    {#if !laeuft}
      <Zurueck
        href="#{heim}"
        text={daten.ansicht ? t('einstellungen.titel') : t('allgemein.zurueck')}
      />
    {/if}
  </div>
  <div class="titelblock">
    <h1 class="display">{t('einspielenSeite.titel')}</h1>
  </div>

  <section class="abschnitt">
    {#if datei}
      <ul class="zeilen">
        <li>
          <div class="listenzeile">
            <span class="tx"
              ><b>{datei.name}</b><small
                >{vorschau
                  ? t('einspielenSeite.erstellt', {
                      datum: datum(new Date(vorschau.erstellt)),
                      groesse: groesse(datei.size),
                    })
                  : verschluesselt
                    ? passwortZeile(datei)
                    : groesse(datei.size)}</small
              ></span
            >
          </div>
        </li>
      </ul>
    {/if}
    <label class="textlink datei">
      {datei ? t('einspielenSeite.andere') : t('einspielenSeite.dateiWaehlen')}
      <input
        type="file"
        class="visually-hidden"
        accept={backupAccept(istApp())}
        onchange={(e) => andereDatei(e.currentTarget.files?.[0])}
      />
    </label>
    {#if sperre}<Notiz stark><p role="alert">{sperre}</p></Notiz>{/if}
  </section>

  {#if datei && verschluesselt && !sperre}
    <section class="abschnitt">
      <label class="eingabe">
        {t('einspielenSeite.passwort')}
        <input
          type="password"
          autocomplete="off"
          bind:this={feld}
          bind:value={passwort}
          aria-invalid={passwortFalsch}
          aria-describedby={passwortFalsch ? 'pw-falsch' : undefined}
          oninput={() => {
            vorschau = null;
            passwortFalsch = false;
          }}
          onblur={() => void pruefen()}
          onkeydown={(e) => {
            if (e.key === 'Enter') void pruefen();
          }}
        />
      </label>
      {#if passwortFalsch}<p id="pw-falsch" class="fehlzeile" role="alert">
          {t('einspielenSeite.falsch')}
        </p>{/if}
    </section>
  {/if}

  {#if datei && !sperre}
    <section class="abschnitt" aria-labelledby="was-passiert">
      <h2 id="was-passiert">{t('einspielenSeite.wasPassiert')}</h2>
      <div class="vergleich">
        <div>
          <b>{t('einspielenSeite.jetzt')}</b>
          {#if jetzt}<WerIstDabei bestand={jetzt} />{t('zahlen.unterlagen', {
              anzahl: jetzt.unterlagen,
            })}{/if}
        </div>
        <div>
          <b>{t('einspielenSeite.imBackup')}</b>
          {#if vorschau}<WerIstDabei bestand={vorschau.bestand} />{t('zahlen.unterlagen', {
              anzahl: vorschau.bestand.unterlagen,
            })}{:else}<span class="leise">{t('einspielenSeite.nachPasswort')}</span>{/if}
        </div>
      </div>
      {#if !appLeer}
        <div class="ersetzt"><Notiz stark><p>{t('einspielenSeite.ersetzt')}</p></Notiz></div>
      {/if}
    </section>
  {/if}
</main>
<Aktionsleiste
  text={laeuft ? t('einspielenSeite.laeuft') : t('einspielenSeite.knopf')}
  {grund}
  onclick={einspielen}
  neben={laeuft ? undefined : { text: t('einspielenSeite.abbrechen'), onclick: abbrechen }}
/>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0
      max(calc(180px + env(safe-area-inset-bottom)), calc(var(--leiste-hoehe, 0px) + 16px));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
  }

  .datei {
    margin-left: var(--space-1);
  }

  .datei:focus-within {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
  }

  .leise {
    color: var(--ink-muted);
  }

  .ersetzt {
    margin-top: 8px;
  }
</style>
