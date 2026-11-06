import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { ANHANG_NAME, anhangLesen, type HeftaAnhang } from '../pdf/anhang';
import '../pdf/stromPolyfill';
import { lesehilfePasst } from './regel';
import { t } from './texte';

// PDF.js ohne jede Verbindung. Die Hülle lädt den Worker und die Bilddecoder beim Öffnen der Seite:
// Ohne sie blieben JBIG2- und JPEG-2000-Scans ohne Netz stumm weiß. Getestet in tests/e2e/vermieter.spec.ts.
const adresse = (pfad: string) => new URL(pfad, document.baseURI).href;
pdfjs.GlobalWorkerOptions.workerSrc = adresse('./pdfjs/huelle.mjs');
const arbeiter = new pdfjs.PDFWorker();

export const GRENZE_BYTES = 100 * 1024 * 1024;

export type PdfDok = pdfjs.PDFDocumentProxy;

export function pdfOeffnen(daten: Uint8Array) {
  return pdfjs.getDocument({
    data: daten,
    worker: arbeiter,
    wasmUrl: adresse('./pdfjs/wasm/'),
    useWasm: false,
    useSystemFonts: true,
    enableXfa: false,
    verbosity: 0,
  });
}

export interface Mappe {
  datei: File;
  name: string;
  bytes: number;
  seiten: number;
  sha: string;
  /** Null: keine Lesehilfe oder eine, die nicht passt. */
  anhang: HeftaAnhang | null;
  passtNicht: boolean;
  neuereFassung: boolean;
}

export type Gelesen = { art: 'mappe'; mappe: Mappe } | { art: 'fehler'; text: string };

async function istPdf(datei: File): Promise<boolean> {
  const kopf = new Uint8Array(await datei.slice(0, 1024).arrayBuffer());
  return new TextDecoder('latin1').decode(kopf).includes('%PDF-');
}

async function anhangAus(dok: PdfDok): Promise<Uint8Array | null> {
  const anhaenge = await dok.getAttachments();
  if (!anhaenge) return null;
  const treffer = [...anhaenge.entries()].find(([, a]) => a.filename === ANHANG_NAME);
  if (!treffer) return null;
  return (await dok.getAttachmentContent(treffer[0])) ?? null;
}

async function ersteSeite(dok: PdfDok): Promise<string> {
  const seite = await dok.getPage(1);
  const inhalt = await seite.getTextContent();
  seite.cleanup();
  return inhalt.items.map((i) => ('str' in i ? i.str : '')).join(' ');
}

/** Liest eine Datei. `doppelt` sagt, welche Nummer die gleiche Datei in der Liste schon hat. */
export async function einlesen(
  datei: File,
  doppelt: (sha: string) => number | undefined,
): Promise<Gelesen> {
  if (!(await istPdf(datei))) return { art: 'fehler', text: t('fehler.keinePdf') };
  if (datei.size > GRENZE_BYTES) return { art: 'fehler', text: t('fehler.zuGross') };
  let daten: Uint8Array;
  let sha: string;
  try {
    daten = new Uint8Array(await datei.arrayBuffer());
    const summe = await crypto.subtle.digest('SHA-256', daten.buffer as ArrayBuffer);
    sha = [...new Uint8Array(summe)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return { art: 'fehler', text: t('fehler.kaputt') };
  }
  const nummer = doppelt(sha);
  if (nummer) return { art: 'fehler', text: t('fehler.doppelt', { nummer }) };

  const aufgabe = pdfOeffnen(daten);
  try {
    const dok = await aufgabe.promise;
    const seiten = dok.numPages;
    const roh = await anhangAus(dok).catch(() => null);
    const gelesen = roh ? anhangLesen(roh) : null;
    const text = gelesen ? await ersteSeite(dok).catch(() => '') : '';
    const passt = !!gelesen && lesehilfePasst(gelesen, seiten, text);
    return {
      art: 'mappe',
      mappe: {
        datei,
        name: datei.name,
        bytes: datei.size,
        seiten,
        sha,
        anhang: passt ? gelesen : null,
        passtNicht: !!roh && !passt,
        neuereFassung: passt && gelesen.hefta > 1,
      },
    };
  } catch (e) {
    const passwort = e instanceof Error && e.name === 'PasswordException';
    return { art: 'fehler', text: t(passwort ? 'fehler.passwort' : 'fehler.kaputt') };
  } finally {
    void aufgabe.destroy();
  }
}
