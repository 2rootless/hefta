<script lang="ts">
  import { versionKurz } from '../app/version';
  import { backupKlick, istAndroidApp, istApp } from '../app/plattform';
  // Einstellungen mit Register (DP50 Punkt 10, W13, W18): Trennblätter „Hefte“, „Mappe“, „App“ wie im Rutsch,
  // hier neutral. Jeder Reiter zeigt alles zu seinem Teil. Backup erstellen, einspielen, alles löschen und die
  // Fragen für die Besichtigung sind eigene Seiten.
  import { onMount, tick } from 'svelte';
  import { daten, db, gehe } from '../app/daten.svelte';
  import { backupWort } from '../ui/backupWort';
  import { QUELLCODE_ADRESSE } from '../app/name';
  import { RUECKMELDUNG_ADRESSE, rueckmeldungLink } from '../app/impressum';
  import { tageSeit } from '../domain/zeit';
  import { backupAccept } from '../storage/backup';
  import { KATALOG_STAND, rollenText } from '../domain/regelkatalog';
  import { THEMEN } from '../domain/besichtigungsFragen';
  import { groesse, monatName, t, zahlwort } from '../i18n';
  import { speicherBelegt } from '../storage/speicher';
  import { einstellungenZustand, type EinstellungenReiter } from '../ui/einstellungen.svelte';
  import Symbol from '../ui/Symbol.svelte';
  import { passend, TITEL } from '../ui/passend';
  import Rueckmeldung from '../ui/Rueckmeldung.svelte';
  import { empfangLive } from '../rueckmeldung/senden';
  import { FRAGE_REIHE } from '../rueckmeldung/fragen';
  import Sheet from '../ui/Sheet.svelte';
  import RueckmeldungMail from '../ui/RueckmeldungMail.svelte';
  import Zurueck from '../ui/Zurueck.svelte';
  import { homescreenFragen } from '../ui/homescreen';
  import { aussehenSetzen, aussehenWahl, type Aussehen } from '../app/theme';
  import { dauer } from '../ui/bewegung';
  import { herkunftsReiter } from '../ui/herkunft.svelte';
  import { erinnerungenZeigen, mitteilungen } from '../app/erinnerungen.svelte';
  import { einstellungenAendern } from '../storage/speicher';
  import { stillLaden } from '../app/daten.svelte';
  import SchalterZeile from '../ui/SchalterZeile.svelte';
  import MitUmbruch from '../ui/MitUmbruch.svelte';
  import HaushaltLoeschenBlatt from '../ui/HaushaltLoeschenBlatt.svelte';
  import { tonStil } from '../ui/personTon';
  import { wunschZeilen } from '../ui/wunschZeilen';

  const meldung = einstellungenZustand.meldung;
  einstellungenZustand.meldung = '';
  // Eine Meldung kommt vom Backup (erstellt oder eingespielt): Sie gehört zum Reiter „App“.
  if (meldung) einstellungenZustand.reiter = 'app';

  const REITER: { wert: EinstellungenReiter; text: string }[] = [
    { wert: 'hefte', text: t('einstellungen.reiterHefte') },
    { wert: 'mappe', text: t('einstellungen.reiterMappe') },
    { wert: 'app', text: t('einstellungen.reiterApp') },
  ];
  const reiter = $derived(einstellungenZustand.reiter);
  let reiterEls = $state<HTMLButtonElement[]>([]);

  /** Pfeiltasten wie bei jedem Register (WAI-ARIA Tabs): links, rechts, Anfang, Ende. */
  async function reiterTaste(e: KeyboardEvent, i: number) {
    const n = REITER.length;
    const ziel =
      e.key === 'ArrowRight'
        ? (i + 1) % n
        : e.key === 'ArrowLeft'
          ? (i - 1 + n) % n
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? n - 1
              : null;
    if (ziel === null) return;
    e.preventDefault();
    einstellungenZustand.reiter = REITER[ziel]!.wert;
    await tick();
    reiterEls[ziel]?.focus();
  }

  // DP49-Regeln (wie das Rutsch-Register): Reichen die Reiter bis an den Rand, ist die Kante oben rechts gerade,
  // und der vordere Reiter am Rand hat dort keine Rundung.
  let registerEl = $state<HTMLElement | null>(null);
  let blattEl = $state<HTMLElement | null>(null);
  let randVoll = $state(false);
  let vornAmRand = $state(false);
  $effect(() => {
    const r = registerEl;
    const b = blattEl;
    void reiter;
    if (!r || !b) return;
    const messen = () => {
      const rechts = b.getBoundingClientRect().right;
      const letzter = r.lastElementChild?.getBoundingClientRect();
      const vorn = r.querySelector('.einst-reiter.an')?.getBoundingClientRect();
      randVoll = !!letzter && letzter.right > rechts - 20;
      vornAmRand = !!vorn && vorn.right >= rechts - 1;
    };
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(b);
    return () => beobachter.disconnect();
  });

  const backupText = $derived.by(() => {
    const zuletzt = daten.einstellungen?.letztesBackup;
    if (!zuletzt) return t('einstellungen.letztesNie');
    const tage = tageSeit(zuletzt);
    if (tage === 0) return backupWort(t('einstellungen.letztesHeute'), daten.einstellungen);
    const text = backupWort(t('einstellungen.letztesTage', { anzahl: tage }), daten.einstellungen);
    return tage > 30 ? `${text}. ${t('einstellungen.zeitFuerNeues')}` : text;
  });

  // Speicher: belegt laut Browser (sonst die Summe der Dateien), frei bis zur Grenze des Browsers.
  let belegt = $state(0);
  let frei = $state<number | null>(null);
  let dauerhaft = $state<boolean | null>(null);
  let balken = $state<HTMLElement>();

  async function speicherMessen() {
    const eigene = await speicherBelegt(await db());
    const schaetzung = await navigator.storage?.estimate?.().catch(() => undefined);
    belegt = Math.max(eigene, schaetzung?.usage ?? 0);
    frei = schaetzung?.quota ? Math.max(0, schaetzung.quota - belegt) : null;
    // In der App liegt alles im Speicher der App; „dauerhaft speichern“ ist eine Frage des Browsers.
    dauerhaft =
      !istApp() && navigator.storage?.persisted ? await navigator.storage.persisted() : null;
  }

  // Breite über CSSOM, weil die Inhaltsrichtlinie keine Inline-Styles erlaubt.
  $effect(() => {
    if (!balken) return;
    const anteil = frei === null ? 0 : belegt / (belegt + frei || 1);
    balken.style.width = `${Math.max(2, Math.min(100, anteil * 100))}%`;
  });

  async function dauerhaftAnfragen() {
    try {
      dauerhaft = (await navigator.storage?.persist?.()) ?? false;
    } catch {
      dauerhaft = false;
    }
  }

  const homescreen =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;

  // Stand des Regelkatalogs als „Oktober 2026“ (mit Jahr, darum ein Bezugsdatum in einem anderen Jahr).
  const stand = monatName(KATALOG_STAND.slice(0, 7), new Date(0));

  async function erinnerungUmschalten(
    feld: 'erinnerungBesichtigungen' | 'erinnerungGehalt' | 'erinnerungZuAlt',
    an: boolean,
  ) {
    await einstellungenAendern(await db(), { [feld]: an });
    await stillLaden();
  }

  // Zurück zum Reiter, aus dem man kam (Auftraggeber 13.11.).
  const herkunft = $derived(herkunftsReiter());

  // Aussehen (Auftraggeber, 12.11.): System, Hell oder Dunkel, nur auf diesem Gerät.
  let aussehen = $state<Aussehen>(aussehenWahl());
  const AUSSEHEN: { wert: Aussehen; text: string }[] = [
    { wert: 'system', text: t('einstellungen.aussehenSystem') },
    { wert: 'hell', text: t('einstellungen.aussehenHell') },
    { wert: 'dunkel', text: t('einstellungen.aussehenDunkel') },
  ];

  function backupGewaehlt(datei: File | undefined) {
    if (!datei) return;
    einstellungenZustand.datei = datei;
    gehe('/einstellungen/einspielen');
  }

  // DP50 (W4): Das Kopierzeichen an der Mail; danach „Kopiert“ mit Haken in derselben Zeile, kein Fenster.
  let kopiert = $state(false);
  async function adresseKopieren() {
    try {
      await navigator.clipboard.writeText(RUECKMELDUNG_ADRESSE);
      kopiert = true;
      setTimeout(() => (kopiert = false), dauer('verweilen'));
    } catch {
      // Ohne Erlaubnis zum Kopieren bleibt die Adresse als Text und Link stehen.
    }
  }

  onMount(() => {
    void speicherMessen();
  });

  // DP29: Rückmeldung als Zeile mit Blatt; nach einer Antwort „Danke, beantwortet am …“.
  let rueckOffen = $state(false);
  // PC92 K6 (E166): „Mehr zu sagen? Schreib an {adresse}.“ An der Stelle der Adresse steht der Link.
  const mehrTeile = $derived(t('rueckmeldung.mehr', { adresse: '\u0000' }).split('\u0000'));
  // Das Leerzeichen am Ende bleibt: Bildschirmleser lesen sonst „anhallo“.
  const mehrVor = $derived(mehrTeile[0] ?? '');
  const mehrNach = $derived(mehrTeile[1] ?? '');
  const rueckAm = $derived.by(() => {
    const am = daten.einstellungen?.rueckmeldungAm;
    return am
      ? new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(new Date(am))
      : null;
  });

  // Reiter „Hefte“: die Wünsche des Haushalts in Kurzform; jede Zeile führt zu „Was ihr sucht“.
  const ansicht = $derived(daten.ansicht);
  const wuensche = $derived(wunschZeilen(ansicht?.haushalt?.wuensche ?? null));

  /** „Elf von Hefta, zwei eigene“: eingeschaltete Fragen von Hefta und eigene des Geräts. */
  const fragenText = $derived.by(() => {
    const aus = new Set(daten.einstellungen?.fragenAus ?? []);
    const an = THEMEN.filter((th) => !aus.has(th)).length;
    const eigene = (daten.einstellungen?.eigeneFragen ?? []).length;
    const Zahl = zahlwort(an).replace(/^./, (c) => c.toLocaleUpperCase('de'));
    return eigene
      ? t('einstellungen.fragenZahlEigene', { Zahl, zahl: zahlwort(eigene), anzahl: eigene })
      : t('einstellungen.fragenZahl', { Zahl });
  });

  // Reiter „Mappe“: Haushalt mit Marke und Rolle; „Haushalt löschen“ nur nach dem Blatt (E96).
  const vertragZahl = $derived(
    (ansicht?.mitglieder ?? []).filter((m) => m.zugehoerigkeit.rolle === 'vertrag').length,
  );
  let loeschenOffen = $state(false);
</script>

{#snippet pfeil()}
  <span class="pfeil" aria-hidden="true"><Symbol name="weiter" groesse={20} /></span>
{/snippet}

{#snippet kopf(id: string, text: string, satz = '')}
  <h2 class="einst-kopf" {id}>{text}</h2>
  {#if satz}<p class="einst-satz">{satz}</p>{/if}
{/snippet}

{#snippet mitteilungenHinweis()}
  {#if mitteilungen.erlaubt === false}
    <p class="hinweis-klein">{t('einstellungen.mitteilungenAus')}</p>
  {/if}
{/snippet}

<main class="seite">
  <div class="kopf"><Zurueck href={herkunft.href} text={herkunft.text} /></div>
  <div class="titelblock">
    <h1 use:passend={TITEL} class="display">{t('einstellungen.titel')}</h1>
    {#if meldung}<p class="meldung" role="status">{meldung}</p>{/if}
  </div>

  <div class="einst-rahmen">
    <div
      class="einst-register"
      role="tablist"
      aria-label={t('einstellungen.register')}
      bind:this={registerEl}
    >
      {#each REITER as r, i (r.wert)}
        <button
          type="button"
          role="tab"
          id={`reiter-${r.wert}`}
          class="einst-reiter"
          class:an={reiter === r.wert}
          class:am-rand={reiter === r.wert && vornAmRand}
          aria-selected={reiter === r.wert}
          aria-controls="einst-blatt"
          tabindex={reiter === r.wert ? 0 : -1}
          bind:this={reiterEls[i]}
          onclick={() => (einstellungenZustand.reiter = r.wert)}
          onkeydown={(e) => void reiterTaste(e, i)}>{r.text}</button
        >
      {/each}
    </div>

    <div
      class="einst-blatt"
      class:ecke-rechts={randVoll}
      id="einst-blatt"
      role="tabpanel"
      aria-labelledby={`reiter-${reiter}`}
      bind:this={blattEl}
    >
      {#if reiter === 'hefte'}
        <section aria-labelledby="g-suche">
          {@render kopf(
            'g-suche',
            t('einstellungen.wasIhrSucht'),
            t('einstellungen.wasIhrSuchtSatz'),
          )}
          <ul class="zeilen">
            {#each wuensche as w (w.titel)}
              <li>
                <a class="listenzeile" href="#/wuensche">
                  <span class="tx"
                    ><b>{w.titel}</b><small class:offen={!w.wert}
                      >{w.wert ?? t('einstellungen.offen')}</small
                    ></span
                  >
                  {@render pfeil()}
                </a>
              </li>
            {/each}
          </ul>
        </section>

        <section aria-labelledby="g-besichtigung">
          {@render kopf('g-besichtigung', t('einstellungen.besichtigung'))}
          <ul class="zeilen">
            <li>
              <a class="listenzeile" href="#/einstellungen/fragen">
                <span class="tx"><b>{t('fragen.titel')}</b><small>{fragenText}</small></span>
                {@render pfeil()}
              </a>
            </li>
            {#if erinnerungenZeigen()}
              <!-- E4: eigener Schalter für Hefte, getrennt von dem für Unterlagen. -->
              <li>
                <SchalterZeile
                  an={daten.einstellungen?.erinnerungBesichtigungen !== false}
                  titel={t('einstellungen.erinnerungenTitel')}
                  text={t('einstellungen.erinnerungHefte')}
                  onclick={() =>
                    void erinnerungUmschalten(
                      'erinnerungBesichtigungen',
                      daten.einstellungen?.erinnerungBesichtigungen === false,
                    )}
                />
              </li>
            {/if}
          </ul>
          {@render mitteilungenHinweis()}
        </section>
      {:else if reiter === 'mappe'}
        <section aria-labelledby="g-haushalt">
          {@render kopf('g-haushalt', t('einstellungen.haushalt'), t('einstellungen.haushaltSatz'))}
          <ul class="zeilen">
            {#if ansicht}
              {#each ansicht.mitglieder as m (m.person.id)}
                <li>
                  <a class="listenzeile oben" href={`#/person/${m.person.id}`}>
                    <!-- Ü2: Die Marke steht an der ersten Zeile, der Pfeil bleibt mittig. -->
                    <span class="marke-zeile"
                      ><i
                        class="marke person-ton"
                        class:umriss={m.zugehoerigkeit.rolle === 'buerge'}
                        style={tonStil(m.zugehoerigkeit.farbe)}
                        aria-hidden="true"
                      ></i></span
                    >
                    <span class="tx"
                      ><b>{m.person.rufname || m.person.vorname}</b><small
                        >{rollenText(m.zugehoerigkeit.rolle, m.zugehoerigkeit.bezeichnung)}</small
                      ></span
                    >
                    {@render pfeil()}
                  </a>
                </li>
              {/each}
            {:else}
              <li>
                <a class="listenzeile" href="#/">
                  <span class="tx"><b>{t('mappeStart.titel')}</b></span>
                  {@render pfeil()}
                </a>
              </li>
            {/if}
          </ul>
        </section>

        {#if erinnerungenZeigen()}
          <section aria-labelledby="g-unterlagen">
            {@render kopf('g-unterlagen', t('einstellungen.unterlagen'))}
            <ul class="zeilen">
              <li>
                <SchalterZeile
                  an={daten.einstellungen?.erinnerungGehalt !== false}
                  titel={t('einstellungen.erinnerungenTitel')}
                  text={t('einstellungen.erinnerungUnterlagen')}
                  onclick={() =>
                    void erinnerungUmschalten(
                      'erinnerungGehalt',
                      daten.einstellungen?.erinnerungGehalt === false,
                    )}
                />
              </li>
              <!-- W48: dritter Schalter, Wortlaut von Design. -->
              <li>
                <SchalterZeile
                  an={daten.einstellungen?.erinnerungZuAlt !== false}
                  titel={t('einstellungen.erinnerungZuAltTitel')}
                  text={t('einstellungen.erinnerungZuAltText')}
                  onclick={() =>
                    void erinnerungUmschalten(
                      'erinnerungZuAlt',
                      daten.einstellungen?.erinnerungZuAlt === false,
                    )}
                />
              </li>
            </ul>
            {@render mitteilungenHinweis()}
          </section>
        {/if}

        {#if ansicht}
          <!-- W5: leise, in Grau; gelöscht wird erst nach dem Blatt. -->
          <button class="haushalt-weg" type="button" onclick={() => (loeschenOffen = true)}
            >{t('einrichtung.haushalt.haushaltLoeschen')}</button
          >
        {/if}
      {:else}
        <section aria-labelledby="g-sicherung">
          {@render kopf('g-sicherung', t('einstellungen.sicherung'))}
          <ul class="zeilen">
            <li>
              <a class="listenzeile" href="#/einstellungen/backup">
                <span class="tx"
                  ><b>{t('einstellungen.backupErstellen')}</b><small>{backupText}</small></span
                >
                {@render pfeil()}
              </a>
            </li>
            <li>
              {#if !daten.ansicht && homescreenFragen(daten.einstellungen)}
                <!-- Hefta 2: Ohne Haushalt spielt man hier ein (B15). Am iPhone in Safari erst der Hinweis auf
                     die App (E30): In Safari eingespielt, fehlt das Backup später in der App. -->
                <a class="listenzeile" href="#/homescreen/einspielen">
                  <span class="tx"
                    ><b>{t('einstellungen.backupEinspielen')}</b><small
                      >{t('einstellungen.einspielenHinweis')}</small
                    ></span
                  >
                  {@render pfeil()}
                </a>
              {:else}
                <label class="listenzeile">
                  <span class="tx"
                    ><b>{t('einstellungen.backupEinspielen')}</b><small
                      >{t('einstellungen.einspielenHinweis')}</small
                    ></span
                  >
                  {@render pfeil()}
                  <input
                    type="file"
                    class="visually-hidden"
                    accept={backupAccept(istApp())}
                    onclick={(e) => backupKlick(e, backupGewaehlt)}
                    onchange={(e) => backupGewaehlt(e.currentTarget.files?.[0])}
                  />
                </label>
              {/if}
            </li>
          </ul>
        </section>

        <section aria-labelledby="g-speicher">
          {@render kopf('g-speicher', t('einstellungen.speicher'))}
          <ul class="zeilen">
            <li class="speicher">
              <b>{t('einstellungen.belegt', { groesse: groesse(belegt) })}</b>
              {#if frei !== null}
                <span class="balken" aria-hidden="true"><i bind:this={balken}></i></span>
              {/if}
              <small>
                {#if frei !== null}{t('einstellungen.frei', { groesse: groesse(frei) })}{/if}
                {#if dauerhaft === true}{t(
                    'einstellungen.dauerhaftJa',
                  )}{:else if dauerhaft === false}{t('einstellungen.dauerhaftNein')}{/if}
              </small>
              {#if dauerhaft === false}
                <button type="button" class="textlink" onclick={dauerhaftAnfragen}
                  >{t('einstellungen.anfragen')}</button
                >
              {/if}
            </li>
            <li class:app={istApp()}>
              {#if homescreen}
                <div class="listenzeile">
                  <span class="tx"
                    ><b>{t('einstellungen.homescreen')}</b><small
                      >{t('einstellungen.homescreenHinweis')}</small
                    ></span
                  >
                  <span class="wert">{t('einstellungen.ja')}</span>
                </div>
              {:else}
                <a class="listenzeile" href="#/homescreen/einstellungen">
                  <span class="tx"
                    ><b>{t('einstellungen.homescreen')}</b><small
                      >{t('einstellungen.homescreenHinweis')}</small
                    ></span
                  >
                  <span class="wert">{t('einstellungen.nein')}</span>
                  {@render pfeil()}
                </a>
              {/if}
            </li>
          </ul>
        </section>

        <section aria-labelledby="g-aussehen">
          {@render kopf('g-aussehen', t('einstellungen.aussehenUndSprache'))}
          <ul class="zeilen">
            <li>
              <!-- Bei 320 px stehen die drei Knöpfe unter dem Wort und nehmen die ganze Breite. -->
              <div class="listenzeile aussehen-zeile">
                <span class="tx" id="aussehen-titel"><b>{t('einstellungen.aussehen')}</b></span>
                <div class="segmente" role="radiogroup" aria-labelledby="aussehen-titel">
                  {#each AUSSEHEN as a (a.wert)}
                    <button
                      type="button"
                      role="radio"
                      aria-checked={aussehen === a.wert}
                      onclick={() => {
                        aussehen = a.wert;
                        aussehenSetzen(a.wert);
                      }}>{a.text}</button
                    >
                  {/each}
                </div>
              </div>
            </li>
            <li>
              <div class="listenzeile">
                <span class="tx"><b>{t('einstellungen.sprache')}</b></span>
                <span class="wert">{t('einstellungen.deutsch')}</span>
              </div>
            </li>
          </ul>
        </section>

        <section aria-labelledby="g-ueber">
          {@render kopf('g-ueber', t('einstellungen.ueber'))}
          <!-- Unter Android ohne Internet-Berechtigung: statt der Fragen eine Mail (Planung 13.11.). -->
          {#if istAndroidApp()}
            <div class="blatt-rueck"><RueckmeldungMail /></div>
          {/if}
          <ul class="zeilen">
            {#if !istAndroidApp() && empfangLive()}
              <!-- DP29: eine Zeile; die Fragen stehen in einem Blatt von unten. -->
              <li>
                <button type="button" class="listenzeile" onclick={() => (rueckOffen = true)}>
                  <span class="tx"
                    ><b>{t('einstellungen.rueckmeldung')}</b><small
                      >{rueckAm
                        ? t('einstellungen.rueckmeldungDanke', { datum: rueckAm })
                        : t('einstellungen.rueckmeldungUnter', {
                            Zahl: zahlwort(FRAGE_REIHE.length),
                          })}</small
                    ></span
                  >
                  {@render pfeil()}
                </button>
              </li>
            {/if}
            <li>
              <div class="listenzeile rueck">
                <!-- PC92 K6 (E166): „Mehr zu sagen? Schreib an hallo@hefta.de.“ Die Adresse steht als Link im Satz, die
                     erste Zeile endet vor ihr. -->
                <span class="tx"
                  ><b>{mehrVor}</b><span
                    ><a
                      class="adresse"
                      href={rueckmeldungLink(t('einstellungen.rueckmeldungBetreff'))}
                      ><span class="adresse-text"
                        ><MitUmbruch text={RUECKMELDUNG_ADRESSE} nach="@" /></span
                      ></a
                    >{mehrNach}</span
                  ></span
                >
                {#if kopiert}
                  <span class="kopiert" role="status"
                    >{t('einstellungen.kopiert')}<Symbol name="haken" groesse={16} /></span
                  >
                {:else}
                  <button
                    type="button"
                    class="kopieren"
                    aria-label={t('einstellungen.adresseKopieren')}
                    onclick={adresseKopieren}><Symbol name="kopieren" groesse={20} /></button
                  >
                {/if}
              </div>
            </li>
            <li>
              <div class="listenzeile">
                <span class="tx"
                  ><b>{t('einstellungen.version')}</b><small
                    >{t('einstellungen.versionWert', {
                      version: versionKurz(__APP_VERSION__),
                      stand,
                    })}</small
                  ></span
                >
              </div>
            </li>
            <li>
              <div class="listenzeile">
                <span class="tx"
                  ><b>{t('einstellungen.lizenz')}</b><small>{t('einstellungen.lizenzWert')}</small
                  ></span
                >
              </div>
            </li>
            {#if QUELLCODE_ADRESSE}
              <li>
                <a class="listenzeile" href={QUELLCODE_ADRESSE} rel="noreferrer" target="_blank">
                  <span class="tx"><b>{t('einstellungen.quellcode')}</b></span>
                </a>
              </li>
            {/if}
          </ul>
        </section>

        <section aria-labelledby="g-datenschutz">
          {@render kopf('g-datenschutz', t('einstellungen.datenschutz'))}
          <ul class="zeilen">
            <li>
              <a class="listenzeile" href="#/einstellungen/rechtliches">
                <span class="tx"
                  ><b>{t('einstellungen.datenschutz')}</b><small
                    >{t('einstellungen.datenschutzSatz')}</small
                  ></span
                >
                {@render pfeil()}
              </a>
            </li>
            <li>
              <a class="listenzeile" href="#/einstellungen/loeschen">
                <span class="tx"
                  ><b>{t('einstellungen.allesLoeschen')}</b><small
                    >{t('einstellungen.allesLoeschenHinweis')}</small
                  ></span
                >
                {@render pfeil()}
              </a>
            </li>
          </ul>
        </section>
      {/if}
    </div>
  </div>

  <Sheet bind:offen={rueckOffen} titel={t('rueckmeldung.titel')}>
    <p class="rueck-satz">{t('rueckmeldung.freiwillig')}</p>
    <Rueckmeldung />
  </Sheet>
  <HaushaltLoeschenBlatt bind:offen={loeschenOffen} allein={vertragZahl === 1} />
</main>

<style>
  .seite {
    max-width: var(--content-width);
    min-height: 100dvh;
    margin: 0 auto;
    padding: calc(40px + env(safe-area-inset-top)) 0 calc(48px + env(safe-area-inset-bottom));
  }

  .kopf {
    min-height: var(--tap-target);
    padding: 0 var(--space-5) 0 12px;
  }

  .titelblock {
    padding: 16px var(--space-5) 0;
  }

  .meldung {
    margin: 10px 0 0;
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
    font-weight: 700;
  }

  /* Register (DP50 Punkt 10 nach DP49): neutral, das vordere Blatt in der Kartenfarbe, die hinteren im weichen
     Ton. Der vordere Reiter wächst aus der Kante (12 px nach innen gerundet), die hinteren stecken 8 px darunter. */
  .einst-rahmen {
    margin: 20px 16px 0;
    container-type: inline-size;
  }

  .einst-register {
    display: flex;
    align-items: flex-end;
    gap: 4px;
  }

  .einst-reiter {
    position: relative;
    z-index: 1;
    display: flex;
    flex: none;
    align-items: center;
    min-height: 44px;
    padding: 0 16px 8px;
    border: 0;
    border-radius: 12px 12px 0 0;
    /* Der weiche Ton: auf Seitenebene ist --weich die Kartenfarbe, --track trägt in hell und dunkel. */
    background: var(--track);
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    white-space: nowrap;
    cursor: pointer;
    transform: translateY(8px);
  }

  .einst-reiter.an {
    z-index: 3;
    padding: 0 20px;
    border-radius: 14px 14px 0 0;
    background: var(--surface);
    color: var(--ink);
    font-size: calc(15 * var(--px));
    font-weight: 650;
    transform: none;
  }

  .einst-reiter:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: -2px;
  }

  .einst-reiter.an::before,
  .einst-reiter.an::after {
    content: '';
    position: absolute;
    bottom: 0;
    width: 12px;
    height: 12px;
    pointer-events: none;
  }

  .einst-reiter.an::before {
    left: -12px;
    background: radial-gradient(circle at 0 0, transparent 11.5px, var(--surface) 12px);
  }

  .einst-reiter.an::after {
    right: -12px;
    background: radial-gradient(circle at 100% 0, transparent 11.5px, var(--surface) 12px);
  }

  /* Links ist die Kante immer gerade; am rechten Rand ebenso. */
  .einst-reiter.an:first-child::before,
  .einst-reiter.an.am-rand::after {
    display: none;
  }

  /* 320 px: schmalere Reiter (12 bzw. 16 px Rand). */
  @container (max-width: 300px) {
    .einst-reiter {
      padding-right: 12px;
      padding-left: 12px;
    }

    .einst-reiter.an {
      padding-right: 16px;
      padding-left: 16px;
    }
  }

  .einst-blatt {
    position: relative;
    z-index: 2;
    padding: 4px 0 8px;
    border-radius: 0 20px 20px 20px;
    background: var(--surface);
    container-type: inline-size;
  }

  .einst-blatt.ecke-rechts {
    border-top-right-radius: 0;
  }

  /* Ü1 auch hier: Großbuchstaben mit festem Zeilenabstand von 18 px, auch wenn sie umbrechen. */
  .einst-kopf {
    margin: 20px 16px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    font-weight: 650;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .einst-satz {
    margin: 4px 16px 0;
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    line-height: 1.4;
  }

  /* Die Zeilen liegen auf dem Blatt: ohne eigene Fläche, sonst ragten ihre Ecken aus der Rundung. */
  .einst-blatt .zeilen {
    margin-top: 4px;
    border-radius: 0;
    background: none;
  }

  .listenzeile small.offen {
    font-style: normal;
  }

  /* Ü2: Marke an der ersten Zeile; der Pfeil bleibt mittig. */
  .listenzeile.oben {
    align-items: flex-start;
  }

  .listenzeile.oben .pfeil {
    align-self: center;
  }

  .marke-zeile {
    display: flex;
    flex: none;
    align-items: center;
    height: calc(21 * var(--px));
  }

  .marke {
    display: inline-block;
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background: var(--p-app);
  }

  .marke.umriss {
    background: none;
    box-shadow: inset 0 0 0 2px var(--p-linie);
  }

  .haushalt-weg {
    display: block;
    min-height: var(--tap-target);
    margin: 8px 16px 0;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(15 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  .hinweis-klein {
    margin: 8px 16px 0;
    color: var(--ink-muted);
    font-size: calc(13 * var(--px));
  }

  /* Aussehen: Wort und drei Knöpfe in einer Zeile; bei 320 px die Knöpfe darunter, über die ganze Breite. */
  .aussehen-zeile {
    flex-wrap: wrap;
    gap: 8px 12px;
  }

  .aussehen-zeile .tx {
    flex: 1 0 auto;
  }

  @container (max-width: 300px) {
    .aussehen-zeile .tx {
      flex-basis: 100%;
    }

    .segmente {
      flex: 1;
    }
  }

  /* Kein Rahmen um die ganze Zeile nach dem Tippen (Design 12.11.): Der Fokusring sitzt nur bei Tastatur
     auf dem einzelnen Segment. */
  .aussehen-zeile:focus-within {
    outline: none;
  }

  .segmente button:focus-visible {
    outline: 2px solid var(--focus);
    outline-offset: 2px;
    box-shadow: none;
  }

  /* Drei Segmente wie ein Schalter: das gewählte gefüllt. Bei sehr großer Schrift brechen sie in eine zweite
     Reihe statt mitten im Wort. */
  .segmente {
    display: flex;
    flex-wrap: wrap;
    padding: 3px;
    border-radius: 22px;
    background: var(--ground);
  }

  .segmente button {
    flex: 1 1 auto;
    min-height: 44px;
    white-space: nowrap;
    padding: 0 14px;
    border: 0;
    border-radius: var(--radius-full);
    background: none;
    color: var(--ink-muted);
    font: inherit;
    font-size: calc(14 * var(--px));
    font-weight: 600;
    cursor: pointer;
  }

  /* B28b (DP21 Abschnitt 4): Grund als Fläche, gewählt hell gehoben, ohne Rahmen. */
  .segmente button[aria-checked='true'] {
    box-shadow: var(--shadow-chip);
    background: var(--surface);
    color: var(--ink);
  }

  .speicher {
    display: grid;
    padding: 16px;
  }

  .speicher b {
    font-size: calc(16 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .speicher small {
    font-size: calc(13 * var(--px));
    line-height: calc(18 * var(--px));
    color: var(--ink-muted);
  }

  .speicher .textlink {
    justify-self: start;
    font-size: calc(14 * var(--px));
  }

  .balken {
    display: block;
    height: 10px;
    margin: 10px 0 4px;
    overflow: hidden;
    border-radius: 5px;
    background: var(--track);
  }

  .balken i {
    display: block;
    width: 2%;
    height: 100%;
    border-radius: 5px;
    background: var(--ink);
  }

  /* Eine App ist schon auf dem Homescreen. */
  .app {
    display: none;
  }

  .blatt-rueck {
    margin: 4px 0 10px;
  }

  .rueck .tx {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Tippfläche mindestens 44 px (C5). Die Adresse steht in einem eigenen span: Im inline-flex wären „hallo“, „@“ und
     „hefta.de“ sonst je ein eigenes Stück (C33), und der Umbruch nach dem @ (DP73 Z1) ginge nicht. */
  .rueck .adresse {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    /* DP35 R5: Link in Tinte, unterstrichen, Versatz 2 px. */
    color: var(--ink);
    font-weight: 600;
    text-decoration: underline;
    text-underline-offset: 2px;
    overflow-wrap: break-word;
  }

  /* DP50 (W4): kleines Kopierzeichen statt der Pille; danach „Kopiert“ mit Haken an derselben Stelle. */
  .kopieren {
    display: grid;
    flex: none;
    place-items: center;
    width: var(--tap-target);
    height: var(--tap-target);
    margin-right: -10px;
    padding: 0;
    border: 0;
    background: none;
    color: var(--ink-muted);
    cursor: pointer;
  }

  .kopiert {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 8px;
    min-height: var(--tap-target);
    color: var(--ink-muted);
    font-size: calc(14 * var(--px));
    font-weight: 600;
  }

  button.listenzeile {
    width: 100%;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .rueck-satz {
    margin: 0 0 12px;
    color: var(--ink-muted);
  }
</style>
