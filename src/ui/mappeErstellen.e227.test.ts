import 'fake-indexeddb/auto';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { describe, expect, it, vi } from 'vitest';
import { lesenMitGrund, pruefen, SCHRITT_SATZ } from '../../pakete/hefta-json/src/index';
import { neueId } from '../domain/modell';
import type { ExportEinstellungen } from '../domain/export';
import { datenbankOeffnen } from '../storage/db';
import { haushaltAnlegen, haushaltLaden } from '../storage/speicher';
import { pdfSchriften } from '../test/hilfen';
import { papierLesen, seitenText } from '../vermieter/papier';
import { mappeErstellen } from './mappeErstellen';

// E227 (PC116): `schritt` bleibt in Fassung 1, aber 2.0 schreibt weder den Satz zum Schritt noch `schritt`. Ein
// gespeicherter Stand „datensparsam, Besichtigung“ (aus einer früheren Fassung) ergibt ein Deckblatt ohne Satz und
// eine Lesehilfe ohne `schritt`, und die Mappe passt (Punkte 1 bis 7). Gegenprobe: Stünde der Satz doch auf dem
// Deckblatt, passte die Lesehilfe nicht mehr; der Test würde rot.

vi.mock('../pdf/schriften', async (original) => ({
  ...(await original<typeof import('../pdf/schriften')>()),
  pdfSchriftenLaden: async () => pdfSchriften(),
}));

const STAND: ExportEinstellungen = {
  modus: 'datensparsam',
  schritt: 'besichtigung',
  ohne: [],
  auswahl: {},
  ausgabe: 'eine',
  deckblatt: true,
  inhaltsverzeichnis: true,
  fusszeile: true,
  hinweis: true,
  dateiname: '',
};

async function bauen(e: ExportEinstellungen) {
  const db = await datenbankOeffnen(`e227-${neueId()}`);
  await haushaltAnlegen(db, {
    kinder: 0,
    weitereErwachsene: 0,
    personen: [
      {
        vorname: 'Zoë',
        nachname: 'Beispiel',
        bezeichnung: 'weiblich',
        rolle: 'hauptmieter',
        lebenssituation: 'angestellt',
      },
    ],
  });
  const ansicht = (await haushaltLaden(db))!;
  const erg = await mappeErstellen(
    db,
    ansicht,
    { adresse: 'Lindenring 8, 2. Obergeschoss\n20259 Hamburg', satz: '' },
    e,
    new Date(2026, 10, 18, 9, 0, 0),
  );
  const bytes = new Uint8Array(await erg.dateien[0]!.arrayBuffer());
  const aufgabe = pdfjs.getDocument({ data: bytes, verbosity: 0 });
  const dok = await aufgabe.promise;
  try {
    const anh = await dok.getAttachments();
    const t = [...anh!.entries()].find(([, a]) => a.filename === 'hefta.json')!;
    const roh = (await dok.getAttachmentContent(t[0]))!;
    const json = JSON.parse(new TextDecoder().decode(roh)) as Record<string, unknown>;
    const g = lesenMitGrund(roh);
    const papier = await papierLesen(dok, g.lesehilfe!);
    const seite1 = await seitenText(dok, 1);
    return { json, l: g.lesehilfe!, grund: g.grund, papier, seiten: dok.numPages, seite1 };
  } finally {
    await aufgabe.destroy();
  }
}

describe('E227: gespeicherter Stand „datensparsam, Besichtigung“ in 2.0', () => {
  it('Deckblatt ohne Satz zum Schritt, Lesehilfe ohne schritt und ohne modus; die Mappe passt', async () => {
    const m = await bauen(STAND);
    expect(m.grund).toBeNull();
    expect('schritt' in m.json).toBe(false);
    expect('modus' in m.json).toBe(false);
    const flach = m.seite1.replace(/\s+/g, ' ');
    for (const satz of Object.values(SCHRITT_SATZ)) expect(flach).not.toContain(satz);
    expect(flach).not.toContain('Zur Besichtigung');
    expect(pruefen(m.l, { ...m.papier, seiten: m.seiten })).toEqual([]);
  }, 60_000);

  it('Gegenprobe: mit dem Satz zur Besichtigung auf dem Deckblatt passt dieselbe Lesehilfe nicht', async () => {
    const m = await bauen(STAND);
    const mitSatz = `${m.papier.seite1}${String.fromCharCode(10)}${SCHRITT_SATZ.besichtigung}`;
    const g = pruefen(m.l, { ...m.papier, seite1: mitSatz, text: mitSatz, seiten: m.seiten });
    expect(g.join(' ')).toContain('Satz zum Schritt „besichtigung“');
  }, 60_000);
});
