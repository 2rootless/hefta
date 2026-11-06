<script lang="ts">
  // Technik-Test (M0-Spike): prüft auf dem echten iPhone, ob die riskanten Teile tragen.
  // Diese Seite ist ein Werkzeug für den Bau, keine Oberfläche für Nutzer. Ihre Texte stehen darum
  // ausnahmsweise hier statt in i18n; die Seite wird vor Version 1 entfernt.
  import { PDFDocument } from '@cantoo/pdf-lib';
  import { onMount } from 'svelte';
  import { icsErzeugen, type Termin } from '../domain/kalender';
  import { tagAus } from '../domain/fristen';
  import { cspVerstoesse, fremdeHosts } from '../app/wache';
  import { fotoAufbereiten, fotoPixel, seiteAusFoto } from '../image/foto';
  import { jpegHatMetadaten } from '../image/jpegMetadaten';
  import { mappeBauen, type Teil } from '../pdf/mappe';
  import {
    PdfPasswortFehler,
    pdfOeffnen,
    pdfSchliessen,
    seiteRastern,
    seitenText,
  } from '../pdf/pdfjs';
  import { BackupFehler, backupErstellen, backupLesen } from '../storage/backup';
  import {
    BEISPIEL_BLATT,
    BEISPIEL_SCHWAERZUNG,
    beispielFoto,
    beispielSchraegesFoto,
    beispielPdf,
    groesse,
    pdfSchriftenLaden,
    pruefsumme,
    sekunden,
    testdatenErzeugen,
    testdatenListe,
    testdatenLoeschen,
  } from './werkzeuge';

  interface Pruefung {
    id: string;
    titel: string;
    ok: boolean | null;
    text: string;
  }

  let pruefungen = $state<Pruefung[]>([]);
  let laeuft = $state('');
  let fotos = $state<File[]>([]);
  let pdfs = $state<File[]>([]);
  let mappeDatei = $state<File | null>(null);
  let mappeUrl = $state('');
  let backupDatei = $state<File | null>(null);
  let backupUrl = $state('');
  let backupMitPasswort = $state(true);
  let backupPasswort = $state('');
  let importPasswort = $state('');
  let testMegabyte = $state(150);
  let fortschritt = $state('');
  let eigenesPasswortPdf = $state<File | null>(null);
  let eigenesPasswort = $state('');
  let seiteUrl = $state('');

  // Version 2 (D1): Foto → Ecken → gerade, helle Seite → PDF, mit Zeiten für das echte Gerät.
  async function fotoZurSeite(datei: Blob, beispiel: boolean) {
    const t0 = performance.now();
    const foto = await fotoPixel(datei);
    const t1 = performance.now();
    const seite = await seiteAusFoto(foto);
    const t2 = performance.now();
    const { fotosAlsPdf } = await import('../pdf/foto');
    const pdf = await fotosAlsPdf([seite]);
    const t3 = performance.now();
    if (beispiel) {
      // Geladen wird verkleinert (lange Seite 3000): Ecken auf diese Größe umrechnen.
      const f = foto.height / 4032;
      const abweichung = Math.max(
        ...seite.ecken.map((e, i) =>
          Math.hypot(e.x - BEISPIEL_BLATT[i]!.x * f, e.y - BEISPIEL_BLATT[i]!.y * f),
        ),
      );
      melden(
        'foto-ecken',
        'Ecken gefunden',
        seite.erkannt && abweichung < 40,
        `größte Abweichung ${Math.round(abweichung)} px bei ${foto.width} × ${foto.height}`,
      );
    } else
      melden(
        'foto-ecken',
        'Ecken gefunden',
        seite.erkannt ? true : null,
        seite.erkannt ? 'ja' : 'nein, ganzes Bild',
      );
    melden(
      'foto-seite',
      'Gerade gerückt und aufgehellt',
      seite.breite > 0 && t2 - t1 < 4000,
      `${seite.breite} × ${seite.hoehe}, ${groesse(seite.jpeg.length)}; laden ${sekunden(t1 - t0)}, rücken ${sekunden(t2 - t1)}`,
    );
    const seiten = (await PDFDocument.load(pdf, { updateMetadata: false })).getPageCount();
    melden(
      'foto-pdf',
      'Als A4-PDF',
      seiten === 1,
      `${seiten} Seite, ${groesse(pdf.length)}, ${sekunden(t3 - t2)}`,
    );
    if (seiteUrl) URL.revokeObjectURL(seiteUrl);
    seiteUrl = URL.createObjectURL(
      new Blob([seite.jpeg as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
    );
  }

  // Version 2.0, Kalender (design/version-2-0.md, W2): Was macht iOS mit einer .ics-Datei, und ersetzt
  // es Termine mit gleicher UID? Die Links liegen fertig bereit, damit der Tipp sie direkt öffnet.
  let kalender = $state<{ nr: number; titel: string; datei: File; url: string }[]>([]);

  async function kalenderVorbereiten() {
    const jetzt = new Date();
    const bald = new Date(jetzt.getTime() + 5 * 60_000);
    const tagNach = (tage: number) =>
      tagAus(new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tage));
    const zweistellig = (n: number) => String(n).padStart(2, '0');
    const text = 'Aus dem Technik-Test von Hefta. Du kannst ihn löschen.';
    const uid = 'technik-test@mappe';
    const termine: (Termin & { knopf: string })[] = [
      { knopf: 'Termin 1, morgen', uid, tag: tagNach(1), titel: 'Hefta-Test 1', text },
      { knopf: 'Termin 2, übermorgen', uid, tag: tagNach(2), titel: 'Hefta-Test 2', text },
      {
        knopf: 'Termin 3, in fünf Minuten',
        uid: 'technik-test-bald@mappe',
        tag: tagAus(bald),
        uhrzeit: `${zweistellig(bald.getHours())}${zweistellig(bald.getMinutes())}`,
        titel: 'Hefta-Test 3',
        text,
      },
    ];
    const cache = 'caches' in window ? await caches.open('kalender') : null;
    const alt = kalender;
    kalender = await Promise.all(
      termine.map(async ({ knopf, ...termin }, i) => {
        const nr = i + 1;
        const ics = icsErzeugen([termin], jetzt);
        const typ = 'text/calendar;charset=utf-8';
        await cache?.put(
          `./kalender-${nr}.ics`,
          new Response(ics, { headers: { 'Content-Type': typ } }),
        );
        const datei = new File([ics], `mappe-test-${nr}.ics`, { type: typ });
        return { nr, titel: knopf, datei, url: URL.createObjectURL(datei) };
      }),
    );
    for (const k of alt) URL.revokeObjectURL(k.url);
  }

  onMount(() => {
    void kalenderVorbereiten();
    const takt = setInterval(() => void kalenderVorbereiten(), 60_000);
    return () => clearInterval(takt);
  });

  function melden(id: string, titel: string, ok: boolean | null, text: string) {
    const eintrag = { id, titel, ok, text };
    const i = pruefungen.findIndex((p) => p.id === id);
    if (i >= 0) pruefungen[i] = eintrag;
    else pruefungen.push(eintrag);
  }

  async function ausfuehren(name: string, aufgabe: () => Promise<void>) {
    laeuft = name;
    try {
      await aufgabe();
    } catch (e) {
      melden(
        `fehler-${name}`,
        `${name}: Fehler`,
        false,
        e instanceof Error ? `${e.name}: ${e.message}` : String(e),
      );
    } finally {
      laeuft = '';
      fortschritt = '';
    }
  }

  async function geraetPruefen() {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    melden('geraet', 'Gerät', null, `${navigator.userAgent}`);
    melden(
      'homescreen',
      'Vom Homescreen gestartet',
      standalone,
      standalone ? 'ja' : 'nein (Safari-Tab)',
    );
    melden(
      'offline-sw',
      'Service Worker aktiv',
      !!navigator.serviceWorker?.controller,
      navigator.serviceWorker?.controller ? 'ja' : 'nein',
    );
    if (navigator.storage?.estimate) {
      const s = await navigator.storage.estimate();
      melden(
        'speicher',
        'Speicher',
        null,
        `belegt ${groesse(s.usage ?? 0)} von etwa ${groesse(s.quota ?? 0)}`,
      );
    }
    if (navigator.storage?.persisted) {
      const dauerhaft = await navigator.storage.persisted();
      melden(
        'dauerhaft',
        'Dauerhafter Speicher',
        dauerhaft,
        dauerhaft ? 'zugesagt' : 'nicht zugesagt',
      );
    }
  }

  async function dauerhaftAnfragen() {
    const ok = navigator.storage?.persist ? await navigator.storage.persist() : false;
    melden(
      'dauerhaft',
      'Dauerhafter Speicher',
      ok,
      ok ? 'zugesagt' : 'abgelehnt oder nicht unterstützt',
    );
  }

  async function mappeTesten() {
    const start = performance.now();
    const schriften = await pdfSchriftenLaden();
    const teile: Teil[] = [];

    // Fotos: eigene oder Beispiel (hochkant aufgenommen, mit GPS)
    const quellen: { name: string; blob: Blob; beispiel: boolean }[] = fotos.length
      ? fotos.map((f) => ({ name: f.name, blob: f, beispiel: false }))
      : [{ name: 'Beispielfoto', blob: await beispielFoto(), beispiel: true }];
    for (const [i, quelle] of quellen.entries()) {
      const t0 = performance.now();
      const roh = new Uint8Array(await quelle.blob.arrayBuffer());
      const istJpeg = roh[0] === 0xff && roh[1] === 0xd8;
      const vorher = istJpeg ? jpegHatMetadaten(roh) : null;
      try {
        const foto = await fotoAufbereiten(quelle.blob);
        const nachher = jpegHatMetadaten(foto.jpeg);
        const hochkant = foto.hoehe > foto.breite;
        melden(
          `foto-${i}`,
          `Foto ${quelle.name}`,
          !nachher && (!quelle.beispiel || hochkant),
          `${quelle.blob.type || 'unbekannter Typ'}, ${groesse(quelle.blob.size)} → ${foto.breite} × ${foto.hoehe}, ${groesse(foto.jpeg.length)}, ${sekunden(performance.now() - t0)}; ` +
            `EXIF vorher: ${vorher === null ? 'kein JPEG' : vorher ? 'ja' : 'nein'}, nachher: ${nachher ? 'JA (Fehler)' : 'nein'}; ${hochkant ? 'hochkant' : 'quer'}`,
        );
        if (quelle.beispiel) {
          melden(
            'exif-entfernt',
            'EXIF/GPS nach dem Speichern entfernt',
            vorher === true && !nachher,
            nachher ? 'noch enthalten' : 'entfernt',
          );
          melden(
            'hochkant',
            'Hochkant-Foto steht richtig',
            hochkant,
            `${foto.breite} × ${foto.hoehe}`,
          );
        }
        teile.push({ art: 'bild', jpeg: foto.jpeg, abschnitt: `Foto ${i + 1}` });
      } catch (e) {
        melden(
          `foto-${i}`,
          `Foto ${quelle.name}`,
          false,
          `Kann nicht geöffnet werden (${quelle.blob.type || 'unbekannt'}): ${e instanceof Error ? e.message : e}`,
        );
      }
    }

    // PDFs: eigene oder Beispiel; erste Seite des ersten PDFs wird geschwärzt und gerastert
    const pdfQuellen = pdfs.length
      ? await Promise.all(
          pdfs.map(async (f) => ({
            name: f.name,
            daten: new Uint8Array(await f.arrayBuffer()),
            beispiel: false,
          })),
        )
      : [{ name: 'Beispiel-Kontoauszug', daten: await beispielPdf(), beispiel: true }];
    let geschwaerzteSeite = 0;
    for (const [i, quelle] of pdfQuellen.entries()) {
      let dokument;
      try {
        dokument = await pdfOeffnen(quelle.daten);
      } catch (e) {
        const text =
          e instanceof PdfPasswortFehler
            ? 'passwortgeschützt, bitte unten bei „Passwort-PDF“ testen'
            : String(e);
        melden(`pdf-${i}`, `PDF ${quelle.name}`, null, text);
        continue;
      }
      if (i === 0) {
        const t0 = performance.now();
        const schwaerzung = quelle.beispiel
          ? BEISPIEL_SCHWAERZUNG
          : { x: 0.08, y: 0.15, breite: 0.84, hoehe: 0.1 };
        const bild = await seiteRastern(dokument, 1, [schwaerzung]);
        geschwaerzteSeite = teile.length + 2;
        teile.push({ art: 'bild', jpeg: bild.jpeg, abschnitt: `${quelle.name} (geschwärzt)` });
        melden(
          'raster',
          'Seite schwärzen und rastern (200 dpi)',
          true,
          `${bild.breite} × ${bild.hoehe}, ${groesse(bild.jpeg.length)}, ${sekunden(performance.now() - t0)}`,
        );
        if (dokument.numPages > 1) {
          const rest = Array.from({ length: dokument.numPages - 1 }, (_, n) => n + 1);
          teile.push({ art: 'pdf', daten: quelle.daten, abschnitt: quelle.name, seiten: rest });
        }
      } else {
        teile.push({ art: 'pdf', daten: quelle.daten, abschnitt: quelle.name });
      }
      melden(
        `pdf-${i}`,
        `PDF ${quelle.name}`,
        true,
        `${dokument.numPages} Seiten, ${groesse(quelle.daten.length)}`,
      );
      await pdfSchliessen(dokument);
    }

    const dateiname = 'Bewerbung_Mustermann_Hauptstr12.pdf';
    const fussName = 'Max und Lea Mustermann';
    const tBau = performance.now();
    const mappe = await mappeBauen({
      dateiname,
      fussName,
      deckblatt: {
        kopf: 'Bewerbung um die Wohnung',
        titel: ['Hauptstraße 12, 3. OG links', '22767 Hamburg'],
        satz: 'Wir sind ein ruhiges Paar mit einem Kind und suchen ab Januar 2027 eine Wohnung für die nächsten Jahre.',
      },
      teile,
      schriften,
    });
    const bauzeit = performance.now() - tBau;

    // Prüfen: Text unter der Schwärzung, Metadaten
    const ergebnis = await pdfOeffnen(mappe.bytes);
    if (geschwaerzteSeite) {
      const text = (await seitenText(ergebnis, geschwaerzteSeite))
        .replace(fussName, '')
        .replace(/Seite \d+ von \d+/, '')
        .trim();
      melden(
        'schwaerzung',
        'Text unter der Schwärzung nicht auslesbar',
        text === '',
        text === ''
          ? 'kein Text auf der Seite außer der Fußzeile'
          : `gefunden: „${text.slice(0, 80)}“`,
      );
    }
    const deckblattText = await seitenText(ergebnis, 1);
    melden(
      'schrift',
      'Archivo im PDF, Umlaute und ß',
      deckblattText.includes('Hauptstraße') && deckblattText.includes('für'),
      deckblattText.slice(0, 60),
    );
    await pdfSchliessen(ergebnis);

    const geladen = await PDFDocument.load(mappe.bytes, { updateMetadata: false });
    const neutral =
      geladen.getProducer() === undefined &&
      geladen.getCreator() === undefined &&
      geladen.getTitle() === 'Bewerbung_Mustermann_Hauptstr12';
    melden(
      'metadaten',
      'PDF-Metadaten neutral',
      neutral,
      `Titel: ${geladen.getTitle()}, Producer: ${geladen.getProducer() ?? '–'}, Creator: ${geladen.getCreator() ?? '–'}`,
    );

    const gesamt = performance.now() - start;
    abschottungPruefen();
    melden(
      'mappe',
      'Mappe gebaut',
      gesamt < 10000,
      `${mappe.seiten} Seiten, ${groesse(mappe.bytes.length)}, Zusammenbau ${sekunden(bauzeit)}, insgesamt ${sekunden(gesamt)} (Ziel unter 10 s)`,
    );

    if (mappeUrl) URL.revokeObjectURL(mappeUrl);
    mappeDatei = new File([mappe.bytes as Uint8Array<ArrayBuffer>], dateiname, {
      type: 'application/pdf',
    });
    mappeUrl = URL.createObjectURL(mappeDatei);
  }

  // Teilen direkt im Tipp aufrufen, ohne vorher zu warten: Safari verlangt das.
  function teilen(id: string, datei: File | null) {
    if (!datei) return;
    if (!navigator.canShare?.({ files: [datei] })) {
      melden(
        id,
        `Teilen: ${datei.name}`,
        false,
        'Dieser Browser kann die Datei nicht teilen. Nimm „Herunterladen“.',
      );
      return;
    }
    // Ohne title: iOS macht daraus sonst eine zusätzliche Textdatei.
    navigator.share({ files: [datei] }).then(
      () => melden(id, `Teilen: ${datei.name}`, true, 'Teilen-Menü geöffnet und abgeschlossen'),
      (e: Error) =>
        melden(
          id,
          `Teilen: ${datei.name}`,
          e.name === 'AbortError' ? null : false,
          e.name === 'AbortError'
            ? 'Teilen-Menü geöffnet, dann abgebrochen'
            : `${e.name}: ${e.message}`,
        ),
    );
  }

  async function passwortPdfTesten(daten: Uint8Array, passwort: string, beispiel: boolean) {
    const t0 = performance.now();
    if (beispiel) {
      let ohne: string;
      try {
        await pdfOeffnen(daten);
        ohne = 'öffnet ohne Passwort (Fehler)';
      } catch (e) {
        ohne = e instanceof PdfPasswortFehler && !e.falsch ? 'fragt nach Passwort' : String(e);
      }
      let falsch = '';
      try {
        await pdfOeffnen(daten, 'falsch');
      } catch (e) {
        falsch =
          e instanceof PdfPasswortFehler && e.falsch ? 'erkennt falsches Passwort' : String(e);
      }
      melden(
        'pw-erkennung',
        'Passwortschutz erkannt',
        ohne === 'fragt nach Passwort' && falsch === 'erkennt falsches Passwort',
        `${ohne}; ${falsch}`,
      );
    }
    const dokument = await pdfOeffnen(daten, passwort);
    let summe = 0;
    for (let n = 1; n <= dokument.numPages; n++)
      summe += (await seiteRastern(dokument, n)).jpeg.length;
    melden(
      'pw-raster',
      'Passwort-PDF entsperrt und gerastert',
      true,
      `${dokument.numPages} Seiten, vorher ${groesse(daten.length)}, gerastert ${groesse(summe)} (diese Größe zeigt die Vorschau), ${sekunden(performance.now() - t0)}`,
    );
    await pdfSchliessen(dokument);
    try {
      const entschluesselt = await PDFDocument.load(daten, {
        password: passwort,
        updateMetadata: false,
      });
      melden(
        'pw-text',
        'Alternative: entschlüsseln statt rastern',
        true,
        `pdf-lib kann es mit Passwort öffnen (${entschluesselt.getPageCount()} Seiten), Text bliebe erhalten`,
      );
    } catch (e) {
      melden(
        'pw-text',
        'Alternative: entschlüsseln statt rastern',
        null,
        `geht nicht: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  async function testdatenSpeichern() {
    const t0 = performance.now();
    const art = await testdatenErzeugen(
      testMegabyte,
      (mb) => (fortschritt = `${mb} von ${testMegabyte} MB gespeichert`),
    );
    const s = navigator.storage?.estimate ? await navigator.storage.estimate() : undefined;
    melden(
      'testdaten',
      `${testMegabyte} MB Testdaten gespeichert`,
      true,
      `${sekunden(performance.now() - t0)}${s ? `, belegt jetzt ${groesse(s.usage ?? 0)}` : ''}`,
    );
    melden(
      'speicherart',
      'Dateien als Blob in IndexedDB',
      art === 'blob',
      art === 'blob' ? 'ja' : 'nein, nur als ArrayBuffer möglich',
    );
  }

  async function backupBauen() {
    const t0 = performance.now();
    const liste = await testdatenListe();
    if (!liste.length) {
      melden('backup', 'Backup erstellen', false, 'Erst Testdaten speichern.');
      return;
    }
    const passwort = backupMitPasswort ? backupPasswort : undefined;
    if (backupMitPasswort && !passwort) {
      melden('backup', 'Backup erstellen', false, 'Passwort eingeben oder „ohne Passwort“ wählen.');
      return;
    }
    const eintraege = liste.map((e) => ({ pfad: `dateien/${e.name}`, daten: e.blob }));
    const blob = await backupErstellen(eintraege, passwort);
    const name = `hefta-backup_${new Date().toISOString().slice(0, 10)}.hefta`;
    if (backupUrl) URL.revokeObjectURL(backupUrl);
    backupDatei = new File([blob], name, { type: 'application/octet-stream' });
    backupUrl = URL.createObjectURL(backupDatei);
    melden(
      'backup',
      'Backup erstellen',
      true,
      `${liste.length} Dateien, ${groesse(blob.size)}, ${passwort ? 'mit' : 'ohne'} Passwort, ${sekunden(performance.now() - t0)}`,
    );
  }

  async function backupEinspielen(datei: File) {
    const t0 = performance.now();
    const erwartet = new Map((await testdatenListe()).map((e) => [`dateien/${e.name}`, e.hash]));
    let gleich = 0;
    let anders = 0;
    let fremd = 0;
    try {
      await backupLesen(datei, importPasswort || undefined, async ({ pfad, daten }) => {
        const soll = erwartet.get(pfad);
        if (!soll) fremd++;
        else if ((await pruefsumme(daten)) === soll) gleich++;
        else anders++;
        fortschritt = `${gleich + anders + fremd} Dateien gelesen`;
      });
    } catch (e) {
      const saetze: Record<string, string> = {
        passwort_falsch: 'Das Passwort passt nicht.',
        passwort_noetig: 'Dieses Backup hat ein Passwort.',
        kein_backup: 'Das ist keine Backup-Datei von Hefta.',
        beschaedigt: 'Die Datei ist beschädigt oder unvollständig.',
        version_neu: 'Das Backup stammt aus einer neueren Version.',
      };
      melden(
        'einspielen',
        'Backup einspielen',
        false,
        e instanceof BackupFehler ? (saetze[e.grund] ?? e.grund) : String(e),
      );
      return;
    }
    const ok = gleich === erwartet.size && anders === 0 && fremd === 0;
    melden(
      'einspielen',
      'Backup einspielen: identisch',
      ok,
      `${gleich} gleich, ${anders} verschieden, ${erwartet.size - gleich} fehlen, ${fremd} unbekannt; ${groesse(datei.size)} in ${sekunden(performance.now() - t0)}`,
    );
  }

  function abschottungPruefen() {
    const fremd = fremdeHosts();
    melden(
      'fremde-hosts',
      'Nichts von fremden Hosts geladen',
      fremd.length === 0,
      fremd.length ? fremd.join(', ') : 'nur vom eigenen Host',
    );
    melden(
      'csp',
      'Keine CSP-Verstöße',
      cspVerstoesse.length === 0,
      cspVerstoesse.length ? cspVerstoesse.join('; ') : 'keine',
    );
  }

  function ergebnisText(): string {
    return pruefungen
      .map(
        (p) =>
          `${p.ok === true ? 'OK' : p.ok === false ? 'PROBLEM' : 'INFO'} · ${p.titel}: ${p.text}`,
      )
      .join('\n');
  }

  async function kopieren() {
    abschottungPruefen();
    try {
      await navigator.clipboard.writeText(ergebnisText());
      melden('kopiert', 'Ergebnis kopiert', true, 'in der Zwischenablage');
    } catch {
      melden(
        'kopiert',
        'Ergebnis kopieren',
        false,
        'Zwischenablage nicht erlaubt; Text unten markieren und kopieren.',
      );
    }
  }

  onMount(() => {
    void geraetPruefen();
    return () => {
      if (mappeUrl) URL.revokeObjectURL(mappeUrl);
      if (backupUrl) URL.revokeObjectURL(backupUrl);
    };
  });
</script>

{#snippet antwort(id: string, frage: string, moeglich: string[])}
  <div class="antwort" role="group" aria-label={frage}>
    <span>{frage}</span>
    {#each moeglich as a (a)}
      <button
        type="button"
        aria-pressed={pruefungen.find((p) => p.id === id)?.text === a}
        onclick={() => melden(id, frage, null, a)}>{a}</button
      >
    {/each}
  </div>
{/snippet}

<main class="test">
  <a class="zurueck" href="#/">Zurück</a>
  <h1>Technik-Test</h1>
  <p class="lead">
    Prüft auf deinem iPhone, ob Hefta hier alles kann. Nichts davon verlässt dein Gerät.
  </p>

  <section>
    <h2>1 · Mappe bauen</h2>
    <p>
      Ohne Auswahl nimmt der Test ein Beispielfoto (hochkant, mit GPS) und ein Beispiel-PDF mit
      Kontonummer.
    </p>
    <label class="feld">
      <span>Fotos (Kamera oder Mediathek)</span>
      <input
        type="file"
        accept="image/*"
        multiple
        onchange={(e) => (fotos = [...(e.currentTarget.files ?? [])])}
      />
    </label>
    <label class="feld">
      <span>Foto direkt aufnehmen</span>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onchange={(e) => (fotos = [...fotos, ...(e.currentTarget.files ?? [])])}
      />
    </label>
    <label class="feld">
      <span>PDFs (optional)</span>
      <input
        type="file"
        accept="application/pdf"
        multiple
        onchange={(e) => (pdfs = [...(e.currentTarget.files ?? [])])}
      />
    </label>
    <p class="klein">{fotos.length} Fotos, {pdfs.length} PDFs gewählt</p>
    <button
      type="button"
      disabled={!!laeuft}
      onclick={() => ausfuehren('Mappe', mappeTesten)}
      data-aktion="mappe">Mappe bauen</button
    >
    {#if mappeDatei}
      <div class="reihe">
        <button type="button" onclick={() => teilen('teilen-mappe', mappeDatei)}
          >Mappe teilen</button
        >
        <a class="knopf" href={mappeUrl} download={mappeDatei.name}>Herunterladen</a>
        <a class="knopf" href={mappeUrl} target="_blank" rel="noopener">Ansehen</a>
      </div>
    {/if}
  </section>

  <section>
    <h2>2 · Passwort-PDF</h2>
    <button
      type="button"
      disabled={!!laeuft}
      data-aktion="passwort"
      onclick={() =>
        ausfuehren('Passwort-PDF', async () =>
          passwortPdfTesten(await beispielPdf('geheim'), 'geheim', true),
        )}
    >
      Beispiel mit Passwort testen
    </button>
    <label class="feld">
      <span>Eigenes geschütztes PDF</span>
      <input
        type="file"
        accept="application/pdf"
        onchange={(e) => (eigenesPasswortPdf = e.currentTarget.files?.[0] ?? null)}
      />
    </label>
    <label class="feld">
      <span>Passwort dafür</span>
      <input type="password" autocomplete="off" bind:value={eigenesPasswort} />
    </label>
    <button
      type="button"
      disabled={!!laeuft || !eigenesPasswortPdf || !eigenesPasswort}
      onclick={() =>
        ausfuehren('Passwort-PDF', async () =>
          passwortPdfTesten(
            new Uint8Array(await eigenesPasswortPdf!.arrayBuffer()),
            eigenesPasswort,
            false,
          ),
        )}
    >
      Eigenes PDF entsperren
    </button>
  </section>

  <section>
    <h2>3 · Speicher und Backup</h2>
    <label class="feld">
      <span>Menge Testdaten</span>
      <select bind:value={testMegabyte} data-feld="megabyte">
        <option value={10}>10 MB</option>
        <option value={50}>50 MB</option>
        <option value={150}>150 MB</option>
      </select>
    </label>
    <button
      type="button"
      disabled={!!laeuft}
      data-aktion="testdaten"
      onclick={() => ausfuehren('Testdaten', testdatenSpeichern)}>Testdaten speichern</button
    >
    <button
      type="button"
      disabled={!!laeuft}
      onclick={() => ausfuehren('Speicher', dauerhaftAnfragen)}
      >Dauerhaften Speicher anfragen</button
    >

    <fieldset>
      <legend>Backup</legend>
      <label class="wahl"
        ><input type="radio" bind:group={backupMitPasswort} value={true} /> Mit Passwort</label
      >
      <label class="wahl"
        ><input type="radio" bind:group={backupMitPasswort} value={false} /> Ohne Passwort</label
      >
      {#if backupMitPasswort}
        <label class="feld">
          <span>Passwort</span>
          <input
            type="password"
            autocomplete="new-password"
            bind:value={backupPasswort}
            data-feld="backup-passwort"
          />
        </label>
      {/if}
    </fieldset>
    <button
      type="button"
      disabled={!!laeuft}
      data-aktion="backup"
      onclick={() => ausfuehren('Backup', backupBauen)}>Backup erstellen</button
    >
    {#if backupDatei}
      <div class="reihe">
        <button type="button" onclick={() => teilen('teilen-backup', backupDatei)}
          >Backup teilen</button
        >
        <a class="knopf" href={backupUrl} download={backupDatei.name}>Herunterladen</a>
      </div>
    {/if}
    <label class="feld">
      <span>Passwort zum Einspielen</span>
      <input
        type="password"
        autocomplete="off"
        bind:value={importPasswort}
        data-feld="import-passwort"
      />
    </label>
    <label class="feld">
      <span>Backup einspielen</span>
      <input
        type="file"
        data-feld="backup-datei"
        onchange={(e) => {
          const datei = e.currentTarget.files?.[0];
          if (datei) void ausfuehren('Einspielen', () => backupEinspielen(datei));
        }}
      />
    </label>
    <button
      type="button"
      disabled={!!laeuft}
      onclick={() =>
        ausfuehren('Löschen', async () => {
          await testdatenLoeschen();
          melden('testdaten', 'Testdaten gelöscht', true, 'ok');
        })}>Testdaten löschen</button
    >
  </section>

  <section>
    <h2>4 · Foto zur Seite (vorerst nicht geplant)</h2>
    <button
      type="button"
      disabled={!!laeuft}
      data-aktion="foto-seite"
      onclick={() =>
        ausfuehren('Foto zur Seite', async () => fotoZurSeite(await beispielSchraegesFoto(), true))}
    >
      Beispielfoto gerade rücken
    </button>
    <label class="feld">
      <span>Eigenes Foto einer Unterlage</span>
      <input
        type="file"
        accept="image/*"
        onchange={(e) => {
          const datei = e.currentTarget.files?.[0];
          if (datei) void ausfuehren('Foto zur Seite', () => fotoZurSeite(datei, false));
        }}
      />
    </label>
    {#if seiteUrl}<img class="seite-bild" src={seiteUrl} alt="Gerade gerückte Seite" />{/if}
  </section>

  <section>
    <h2>5 · Für Version 2.0</h2>
    <p>
      Diese Proben sagen nur auf dem iPhone etwas, am besten vom Home-Bildschirm aus. Tippe danach
      an, was passiert ist; es landet im Ergebnis.
    </p>
    <h3>Dateien-App</h3>
    <p><a class="knopf" href="shareddocuments://">Dateien öffnen</a></p>
    {@render antwort('dateien-app', 'Was passierte beim Tippen auf „Dateien öffnen“?', [
      'Ging direkt auf',
      'Erst Rückfrage, dann auf',
      'Nichts passiert',
    ])}
    <h3>Kalender</h3>
    <p>
      Versuch bei Termin 1 die Wege A bis D, bis der Kalender fragt, ob er den Termin hinzufügen
      soll. Bleibt die Seite nach Weg A leer, schließ die App und öffne sie neu. Mit demselben Weg
      dann Termin 2 und 3. Termin 1 und 2 tragen dieselbe Kennung. Danach die Test-Termine im
      Kalender löschen.
    </p>
    <ul class="termine">
      {#each kalender as k (k.nr)}
        <li>
          <strong>{k.titel}</strong>
          <a class="knopf" href="./kalender-{k.nr}.ics">A</a>
          <a class="knopf" href={k.url} target="_blank" rel="noopener">B</a>
          <a class="knopf" href={k.url} download={k.datei.name}>C</a>
          <button type="button" onclick={() => teilen(`ics-${k.nr}`, k.datei)}>D</button>
        </li>
      {/each}
    </ul>
    {@render antwort('kalender-weg', 'Welcher Weg führt zum Kalender?', [
      'A',
      'B',
      'C',
      'D',
      'Keiner',
    ])}
    {@render antwort('kalender-uid', 'Was steht nach Termin 1 und 2 im Kalender?', [
      'Nur Termin 2',
      'Beide',
      'Keiner',
    ])}
    {@render antwort('kalender-mitteilung', 'Kam zu Termin 3 eine Mitteilung?', ['Ja', 'Nein'])}
  </section>

  <section aria-live="polite">
    <h2>Ergebnis</h2>
    {#if laeuft}<p class="laeuft" data-laeuft>{laeuft} läuft … {fortschritt}</p>{/if}
    <ul class="pruefungen">
      {#each pruefungen as p (p.id)}
        <li data-pruefung={p.id} data-ok={String(p.ok)}>
          <strong>{p.ok === true ? 'OK' : p.ok === false ? 'Problem' : 'Info'} · {p.titel}</strong>
          <span>{p.text}</span>
        </li>
      {/each}
    </ul>
    <button type="button" onclick={kopieren}>Ergebnis kopieren</button>
  </section>
</main>

<style>
  .termine {
    margin: var(--space-3) 0;
    padding: 0;
    list-style: none;
  }

  .termine li,
  .antwort {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-2);
  }

  .termine strong,
  .antwort span {
    flex: 1 0 100%;
  }

  .termine .knopf {
    justify-content: center;
    min-width: var(--tap-target);
  }

  .antwort button[aria-pressed='true'] {
    outline: 3px solid var(--ink);
  }

  .seite-bild {
    display: block;
    width: 60%;
    margin-top: var(--space-3);
    box-shadow: var(--shadow-chip);
  }

  .test {
    max-width: var(--content-width);
    margin: 0 auto;
    padding: calc(var(--space-5) + env(safe-area-inset-top)) var(--space-5)
      calc(var(--space-8) + env(safe-area-inset-bottom));
  }

  .zurueck,
  .knopf {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap-target);
    color: var(--ink);
    font-weight: 700;
    text-decoration: underline;
    text-underline-offset: 4px;
  }

  h1 {
    margin: var(--space-2) 0 0;
    font-size: calc(34 * var(--px));
    line-height: calc(36 * var(--px));
    font-weight: 800;
    font-stretch: 112%;
    letter-spacing: -1px;
  }

  .lead {
    margin: 6px 0 0;
    font-size: calc(16 * var(--px));
    line-height: calc(22 * var(--px));
    color: var(--ink-muted);
  }

  section {
    margin-top: var(--space-6);
    padding: var(--space-4);
    border-radius: var(--radius-card);
    background: var(--surface);
  }

  h2 {
    margin: 0 0 var(--space-2);
    font-size: calc(18 * var(--px));
    line-height: calc(24 * var(--px));
    font-weight: 800;
  }

  p {
    margin: 0 0 var(--space-3);
    font-size: calc(15 * var(--px));
    line-height: calc(21 * var(--px));
  }

  .klein {
    font-size: calc(13 * var(--px));
    color: var(--ink-muted);
  }

  .feld {
    display: grid;
    gap: var(--space-1);
    margin-bottom: var(--space-3);
    font-size: calc(14 * var(--px));
    font-weight: 700;
  }

  .feld input[type='password'],
  .feld select {
    min-height: var(--tap-target);
    padding: 0 var(--space-3);
    border: 1.5px solid var(--control-border);
    border-radius: var(--radius-slot);
    background: var(--surface);
    font-weight: 400;
  }

  .feld input[type='file'] {
    min-height: var(--tap-target);
    font-weight: 400;
  }

  fieldset {
    margin: var(--space-3) 0;
    padding: var(--space-3);
    border: 1.5px solid var(--line);
    border-radius: var(--radius-slot);
  }

  legend {
    font-size: calc(14 * var(--px));
    font-weight: 700;
  }

  .wahl {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    min-height: var(--tap-target);
  }

  button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: var(--tap-target);
    margin: 0 var(--space-2) var(--space-2) 0;
    padding: 0 var(--space-4);
    border: 2px solid var(--ink);
    border-radius: var(--radius-full);
    background: none;
    font-size: calc(15 * var(--px));
    font-weight: 700;
    cursor: pointer;
  }

  button:disabled {
    border-color: var(--line);
    color: var(--ink-muted);
    cursor: not-allowed;
  }

  .reihe {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-3);
  }

  .laeuft {
    font-weight: 700;
  }

  .pruefungen {
    margin: 0 0 var(--space-3);
    padding: 0;
    list-style: none;
  }

  .pruefungen li {
    display: grid;
    gap: 2px;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--line);
    font-size: calc(14 * var(--px));
    line-height: calc(19 * var(--px));
    overflow-wrap: anywhere;
  }
</style>
