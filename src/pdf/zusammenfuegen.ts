import { PDFDocument } from '@cantoo/pdf-lib';
import { pdfLaden } from './laden';

// Mehrere PDFs zu einem Dokument („+ Seite“ beim Hochladen) und Bilder zu einem PDF.
// Läuft ohne Browser-APIs, damit es unter Node getestet werden kann.

/** Hängt PDFs in der gegebenen Reihenfolge aneinander. Inhalt und Text bleiben unverändert. */
export async function pdfsZusammenfuegen(teile: Uint8Array[]): Promise<Uint8Array> {
  if (teile.length === 1) return teile[0]!;
  const ziel = await PDFDocument.create({ updateMetadata: false });
  for (const teil of teile) {
    const quelle = await pdfLaden(teil);
    for (const seite of await ziel.copyPages(quelle, quelle.getPageIndices())) ziel.addPage(seite);
  }
  return ziel.save();
}

/** Baut aus Seiten verschiedener PDFs ein neues; „Verschieben“ in eine Version mit anderer Datei. */
export async function seitenZusammenfuegen(
  teile: { daten: Uint8Array; seiten: number[] }[],
): Promise<Uint8Array> {
  const ziel = await PDFDocument.create({ updateMetadata: false });
  for (const { daten, seiten } of teile) {
    const quelle = await pdfLaden(daten);
    for (const seite of await ziel.copyPages(quelle, seiten)) ziel.addPage(seite);
  }
  return ziel.save();
}

/** Seitenzahl eines (unverschlüsselten) PDFs. */
export async function seitenZahl(daten: Uint8Array): Promise<number> {
  return (await pdfLaden(daten)).getPageCount();
}

/**
 * Baut aus gerasterten Seiten (JPEG) ein PDF, jede Seite in der Größe des Originals (in pt).
 * Für entsperrte passwortgeschützte PDFs: Danach ist nichts mehr verschlüsselt, der Text aber nicht markierbar.
 */
export async function bilderAlsPdf(
  seiten: { jpeg: Uint8Array; breitePt: number; hoehePt: number }[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create({ updateMetadata: false });
  for (const s of seiten) {
    const bild = await pdf.embedJpg(s.jpeg);
    pdf
      .addPage([s.breitePt, s.hoehePt])
      .drawImage(bild, { x: 0, y: 0, width: s.breitePt, height: s.hoehePt });
  }
  return pdf.save();
}

/**
 * Ersetzt einzelne Seiten durch Bilder (gescannte Seiten verkleinern, X6c); alle anderen Seiten
 * werden unverändert übernommen, ihr Text bleibt markierbar. Seitenzahl und Reihenfolge bleiben.
 */
export async function seitenErsetzen(
  daten: Uint8Array,
  ersatz: Map<number, { jpeg: Uint8Array; breitePt: number; hoehePt: number }>,
): Promise<Uint8Array> {
  const quelle = await pdfLaden(daten);
  const ziel = await PDFDocument.create({ updateMetadata: false });
  for (const index of quelle.getPageIndices()) {
    const neu = ersatz.get(index);
    if (neu) {
      const bild = await ziel.embedJpg(neu.jpeg);
      ziel
        .addPage([neu.breitePt, neu.hoehePt])
        .drawImage(bild, { x: 0, y: 0, width: neu.breitePt, height: neu.hoehePt });
    } else {
      const [seite] = await ziel.copyPages(quelle, [index]);
      ziel.addPage(seite!);
    }
  }
  return ziel.save();
}

/**
 * Entsperrt ein passwortgeschütztes PDF: Die Seiten werden in ein neues, unverschlüsseltes PDF
 * übernommen. Text und Qualität bleiben erhalten. Wirft, wenn das Passwort falsch ist oder die
 * Verschlüsselung nicht unterstützt wird; dann bleibt das Umwandeln in Bilder als Ausweg.
 */
export async function pdfEntsperren(daten: Uint8Array, passwort: string): Promise<Uint8Array> {
  const quelle = await pdfLaden(daten, passwort);
  const ziel = await PDFDocument.create({ updateMetadata: false });
  for (const seite of await ziel.copyPages(quelle, quelle.getPageIndices())) ziel.addPage(seite);
  return ziel.save();
}
