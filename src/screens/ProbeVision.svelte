<script lang="ts">
  // Probe Vision gegen Tesseract (PC75, PC68 Abschnitt 4). Nur im Probe-Bau, nie im Release: liest die
  // Musterfotos aus dem Probelauf CP40 mit der Texterkennung des iPhones und mit Tesseract, alles auf dem
  // Gerät, und zeigt das Ergebnis als Text zum Kopieren. Keine Verbindung nach außen, keine echten Daten (W7).
  import { t } from '../i18n';
  import { passend, TITEL } from '../ui/passend';
  import Zurueck from '../ui/Zurueck.svelte';
  import { bericht, type Foto, type Lauf } from '../probe/auswerten';
  import { ocrbLesen, tesseractLesen, tesseractStarten, visionLesen } from '../probe/lesen';

  let fotos = $state<Foto[]>([]);
  let stand = $state('');
  let laeuft = $state(false);
  let text = $state('');
  let kopiert = $state(false);

  $effect(() => {
    void fetch('/probe/fotos.json')
      .then((r) => r.json())
      .then((l: Foto[]) => (fotos = l));
  });

  function bildLaden(src: string): Promise<HTMLImageElement> {
    return new Promise((fertig, fehler) => {
      const b = new Image();
      b.onload = () => fertig(b);
      b.onerror = () => fehler(new Error(`${src} fehlt`));
      b.src = src;
    });
  }

  async function alsAdresse(src: string): Promise<string> {
    const blob = await (await fetch(src)).blob();
    return new Promise((fertig) => {
      const r = new FileReader();
      r.onload = () => fertig(r.result as string);
      r.readAsDataURL(blob);
    });
  }

  const fehlerText = (e: unknown) => (e instanceof Error ? e.message : String(e));

  async function starten() {
    laeuft = true;
    text = '';
    kopiert = false;
    const ergebnisse: { foto: Foto; laeufe: Lauf[] }[] = [];
    let start: string;
    stand = t('probe.startet');
    try {
      start = `Tesseract gestartet in ${await tesseractStarten()} ms`;
    } catch (e) {
      start = `Tesseract startet nicht: ${fehlerText(e)}`;
    }
    for (const [i, foto] of fotos.entries()) {
      stand = t('probe.laeuft', { nr: i + 1, zahl: fotos.length, datei: foto.datei });
      const src = `/probe/fotos/${foto.datei}`;
      const laeufe: Lauf[] = [];
      const adresse = await alsAdresse(src);
      for (const korrektur of foto.mrz ? [true, false] : [true]) {
        const weg = korrektur ? 'Vision' : 'Vision ohne Korrektur';
        try {
          laeufe.push({ weg, ...(await visionLesen(adresse, korrektur)) });
        } catch (e) {
          laeufe.push({ weg, zeilen: [], ms: 0, fehler: fehlerText(e) });
        }
      }
      try {
        const r = await tesseractLesen(await bildLaden(src), !!foto.mrz);
        laeufe.push({ weg: 'Tesseract', zeilen: r.zeilen, ms: r.ms });
        // Dritter Lauf (PC77 E155/2): nur wo es Zeilen unten gibt, mit dem OCR-B-Modell.
        if (foto.mrz)
          try {
            laeufe.push({ weg: 'Tesseract OCR-B', ...(await ocrbLesen(r.hell, r.oben, r.msOben)) });
          } catch (e) {
            laeufe.push({ weg: 'Tesseract OCR-B', zeilen: [], ms: 0, fehler: fehlerText(e) });
          }
      } catch (e) {
        laeufe.push({ weg: 'Tesseract', zeilen: [], ms: 0, fehler: fehlerText(e) });
      }
      ergebnisse.push({ foto, laeufe });
    }
    const geraet = `${navigator.userAgent}; ${start}`;
    text = bericht(ergebnisse, geraet);
    stand = t('probe.fertig');
    laeuft = false;
  }

  async function kopieren() {
    await navigator.clipboard.writeText(text);
    kopiert = true;
  }
</script>

<main class="seite">
  <div class="kopf"><Zurueck href="#/einstellungen" text={t('einstellungen.titel')} /></div>
  <h1 use:passend={TITEL} class="display">{t('probe.titel')}</h1>
  <p class="nicht"><b>{t('probe.nicht')}</b></p>
  <p>{t('probe.lead', { zahl: fotos.length })}</p>
  <button type="button" class="knopf haupt" disabled={laeuft || !fotos.length} onclick={starten}
    >{t('probe.starten')}</button
  >
  {#if stand}<p role="status">{stand}</p>{/if}
  {#if text}
    <button type="button" class="knopf" onclick={kopieren}>{t('probe.kopieren')}</button>
    {#if kopiert}<p role="status">{t('probe.kopiert')}</p>{/if}
    <label class="ergebnis"
      >{t('probe.ergebnis')}<textarea readonly rows="16" value={text}></textarea></label
    >
  {/if}
</main>

<style>
  .nicht {
    padding: 12px 14px;
    border: 1.5px solid var(--ink);
    border-radius: 12px;
  }
  .knopf {
    margin-top: 16px;
  }
  .ergebnis {
    display: grid;
    gap: 8px;
    margin-top: 16px;
  }
  textarea {
    font:
      12px/1.4 ui-monospace,
      monospace;
    width: 100%;
  }
</style>
