<script lang="ts">
  // Ein PDF in der Seitenansicht zeigen (nur in der App, siehe pdfFenster.svelte.ts).
  import { pdfFenster } from '../app/pdfFenster.svelte';
  import { pdfOeffnen, pdfSchliessen, type PdfDokument } from '../pdf/pdfjs';
  import SeitenAnsicht from './SeitenAnsicht.svelte';

  let offen = $state(false);
  let index = $state(0);
  let seiten = $state.raw<{ dokument: PdfDokument; nummer: number; schluessel: string }[]>([]);
  let dokument: PdfDokument | null = null;

  $effect(() => {
    const datei = pdfFenster.datei;
    if (!datei) return;
    let abgebrochen = false;
    void datei
      .arrayBuffer()
      .then((bytes) => pdfOeffnen(new Uint8Array(bytes)))
      .then((d) => {
        if (abgebrochen) return pdfSchliessen(d);
        dokument = d;
        seiten = Array.from({ length: d.numPages }, (_, n) => ({
          dokument: d,
          nummer: n + 1,
          schluessel: String(n),
        }));
        index = 0;
        offen = true;
      });
    return () => {
      abgebrochen = true;
    };
  });

  $effect(() => {
    if (offen || !dokument) return;
    void pdfSchliessen(dokument);
    dokument = null;
    seiten = [];
    pdfFenster.datei = null;
  });
</script>

<SeitenAnsicht bind:offen bind:index {seiten} />
