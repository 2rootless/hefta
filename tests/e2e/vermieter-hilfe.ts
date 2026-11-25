import { AFRelationship, PDFDocument } from '@cantoo/pdf-lib';
import fontkit from '@cantoo/fontkit';
import { readFileSync } from 'node:fs';
import { deckblattZeilen } from '../../pakete/hefta-json/test/deckblatt';
import { mitziehendText, type Lesehilfe } from '../../pakete/hefta-json/src/index';

// Mappen für die Vermieter-Seite: echte PDFs mit Lesehilfe, Seite 1 trägt Namen und Straße.
export const NB = ' ';
const BITTE =
  'Falls die Wohnung an jemand anderen geht, löschen Sie diese Unterlagen bitte. Vielen Dank.';
const WOHNUNG = { strasse: 'Beispielstraße 1', rest: `3. OG links · 12345 Musterstadt` };

export interface Probe {
  datei: string;
  seiten: number;
  anhang?: Record<string, unknown>;
  /** Anderer Text auf Seite 1 als die Namen (für „passt nicht“). */
  ersteSeite?: string;
  passwort?: string;
}

const u = (person: number, typ: string, seiten: [number, number], rest: object = {}) => ({
  person,
  typ,
  seiten,
  ...rest,
});
const QUARTAL = { monate: ['2026-07', '2026-08', '2026-09'] };

export const M1: Probe = {
  datei: 'Bewerbung_Mustermann.pdf',
  seiten: 18,
  anhang: {
    // Fassung 3 (E17): Telefon und Mail der Kontaktperson, wie auf Seite 1.
    hefta: 3,
    erstellt: '2026-11-02',
    bewerbung: { kennung: '6f1c2b9e-4d7a-4c1e-9b2f-3a5d8e7c1f40', wohnung: WOHNUNG },
    haushalt: {
      personen: [
        { name: 'Max Mustermann', rolle: 'hauptmieter', kontakt: true },
        { name: 'Lea Mustermann', rolle: 'mitmieter' },
        { name: 'Petra Mustermann', rolle: 'buerge' },
      ],
      mitziehende: [{ text: 'Ein Kind', anzahl: 1, art: 'kind' }],
      kontakt: { telefon: '0171 3920001', email: 'max.mustermann@example.com' },
    },
    modus: 'marktueblich',
    loeschwunsch: BITTE,
    seitenzahl: 18,
    unterlagen: [
      u(0, 'selbstauskunft', [2, 2]),
      u(0, 'gehaltsnachweis', [3, 6], QUARTAL),
      u(0, 'bonitaet', [7, 7], { vom: '2026-10-20', pruefweg: 'pruefcode' }),
      u(1, 'selbstauskunft', [8, 8]),
      u(1, 'gehaltsnachweis', [9, 12], QUARTAL),
      u(1, 'mietzahlung', [13, 13], { vom: '2026-10-12' }),
      u(2, 'selbstauskunft', [14, 14]),
      u(2, 'buergschaftserklaerung', [15, 15]),
      u(2, 'rentenbescheid', [16, 16], { vom: '2026-07-01' }),
      u(2, 'bonitaet', [17, 18], { vom: '2026-10-18', pruefweg: 'pruefcode' }),
    ],
  },
};
export const M2: Probe = {
  datei: 'Bewerbung_Kovalenko.pdf',
  seiten: 9,
  anhang: {
    hefta: 3,
    erstellt: '2026-11-03',
    bewerbung: { kennung: '2a9d4c71-5e3b-4f80-8c16-7b2e9f0d3a55', wohnung: WOHNUNG },
    haushalt: {
      personen: [{ name: 'Olena Kovalenko', rolle: 'hauptmieter', kontakt: true }],
      mitziehende: [],
    },
    modus: 'marktueblich',
    seitenzahl: 9,
    unterlagen: [
      u(0, 'selbstauskunft', [2, 2]),
      u(0, 'gehaltsnachweis', [3, 5], { monate: ['2026-08', '2026-09', '2026-10'] }),
      u(0, 'bonitaet', [6, 6], { vom: '2026-09-02', pruefweg: 'pruefcode' }),
      u(0, 'empfehlung_vorvermieter', [7, 7], { vom: '2026-09-15' }),
      u(0, 'ausweiskopie', [8, 9]),
    ],
  },
};
export const M3: Probe = { datei: 'Bewerbung_Schmidt_Beispielstr1.pdf', seiten: 12 };
export const M4: Probe = {
  datei: 'Bewerbung_Becker_Yilmaz.pdf',
  seiten: 3,
  anhang: {
    hefta: 3,
    erstellt: '2026-11-04',
    bewerbung: { kennung: '8e3f1a26-0b7c-4d95-a4e1-5c6d2b8f9e07', wohnung: WOHNUNG },
    haushalt: {
      personen: [
        { name: 'Jonas Becker', rolle: 'hauptmieter', kontakt: true },
        { name: 'Mira Yılmaz', rolle: 'mitmieter' },
      ],
      mitziehende: [],
    },
    modus: 'datensparsam',
    schritt: 'will_wohnung',
    seitenzahl: 3,
    unterlagen: [u(0, 'selbstauskunft', [2, 2]), u(1, 'selbstauskunft', [3, 3])],
  },
};
/** Für den Vertrag zusammengestellt (VS9f): Die Fragen des Musterbogens sind schon beantwortet. */
export const M4z: Probe = {
  ...M4,
  datei: 'Bewerbung_Becker_Yilmaz_Vertrag.pdf',
  seiten: 9,
  anhang: {
    ...M4.anhang,
    schritt: 'zusage',
    seitenzahl: 9,
    unterlagen: [
      u(0, 'selbstauskunft', [2, 2]),
      u(1, 'selbstauskunft', [3, 3]),
      u(0, 'gehaltsnachweis', [4, 6], { monate: ['2026-08', '2026-09', '2026-10'] }),
      u(0, 'bonitaet', [7, 7], { vom: '2026-11-02', pruefweg: 'pruefcode' }),
      u(1, 'einkommen_ausbildung', [8, 9], { vom: '2026-09-01' }),
    ],
  },
};
/**
 * Fassung 1 (E218) aus den kurzen Testdaten: Unterlagen zur Person, Seiten als von/bis, Kontakt bei der Person mit
 * `telefon_e164` (E222), Vor- und Nachname am ersten Leerzeichen getrennt (nur für diese Musternamen), Zeitpunkt
 * statt Tag, ohne `modus` (V23), Mitziehende in fester Form (V22).
 */
export function alsFassung1(alt: Record<string, unknown>, hefta = 1): Record<string, unknown> {
  type AltU = { person: number; seiten: [number, number] } & Record<string, unknown>;
  const haushalt = alt.haushalt as {
    personen: ({ name: string } & Record<string, unknown>)[];
    mitziehende: { anzahl: number; art: string; text: string }[];
    kontakt?: Record<string, string>;
  };
  const kontakt = { ...(haushalt.kontakt ?? {}) };
  if (kontakt.telefon) kontakt.telefon_e164 = `+49${kontakt.telefon.replace(/\D/g, '').slice(1)}`;
  const personen = haushalt.personen.map((p, i) => {
    const [vorname = '', ...rest] = p.name.split(' ');
    return {
      ...p,
      vorname,
      nachname: rest.join(' '),
      ...(p.kontakt ? kontakt : {}),
      unterlagen: (alt.unterlagen as AltU[])
        .filter((u) => u.person === i)
        .map((x) => {
          const { person, seiten, ...u } = x;
          void person;
          return { ...u, seiten_mappe: { von: seiten[0], bis: seiten[1] } };
        }),
    };
  });
  const { unterlagen, modus, ...oben } = alt;
  void unterlagen;
  void modus;
  return {
    ...oben,
    hefta,
    erstellt: `${String(alt.erstellt)}T10:00:00+01:00`,
    fassung: 1,
    haushalt: {
      personen,
      mitziehende: haushalt.mitziehende.map((m) => ({
        ...m,
        text: mitziehendText(m.anzahl, m.art) ?? m.text,
      })),
    },
  };
}

export { deckblattZeilen } from '../../pakete/hefta-json/test/deckblatt';

export const M6: Probe = {
  datei: 'Bewerbung_Nguyen.pdf',
  seiten: 8,
  anhang: {
    hefta: 3,
    erstellt: '2026-11-04',
    bewerbung: {
      kennung: 'c47b0e93-2d1f-4a68-9f35-e8a1d6c4b210',
      wohnung: { strasse: 'Lindenring 3', rest: `Erdgeschoss · 20259 Hamburg` },
    },
    haushalt: {
      personen: [{ name: 'Tom Nguyen', rolle: 'hauptmieter', kontakt: true }],
      mitziehende: [{ text: 'Zwei Kinder', anzahl: 2, art: 'kind' }],
    },
    modus: 'marktueblich',
    seitenzahl: 8,
    unterlagen: [
      u(0, 'einkommen_selbststaendig', [2, 5], { vom: '2026-06-30' }),
      u(0, 'bonitaet', [6, 7], { vom: '2026-10-28', pruefweg: 'pruefcode' }),
      u(0, 'mietzahlung', [8, 8], { vom: '2026-10-01' }),
    ],
  },
};
/** Eine Seite wurde entfernt: Die Lesehilfe nennt 18, die Datei hat 17. */
export const M7: Probe = { ...M1, datei: 'Bewerbung_Wagner.pdf', seiten: 17 };
export const LANG: Probe = {
  datei: 'Bewerbung_Mueller-Luedenscheidt.pdf',
  seiten: 15,
  anhang: {
    hefta: 3,
    erstellt: '2026-11-02',
    bewerbung: {
      kennung: '5d8a2f40-9c3e-4b71-b6d2-0e4f7a1c8b93',
      wohnung: {
        strasse: 'Große Beispielstraße 1',
        rest: 'Hinterhaus, 4. OG rechts · 12345 Musterstadt-Nord',
      },
    },
    haushalt: {
      personen: [
        { name: 'Maximilian-Alexander Müller-Lüdenscheidt', rolle: 'hauptmieter', kontakt: true },
        { name: 'Bartholomäus Wiśniewski-Kowalczyk', rolle: 'mitmieter' },
        { name: 'Anna-Katharina Josephine von Hohenstein', rolle: 'buerge' },
      ],
      mitziehende: [
        { text: 'Zwei Kinder', anzahl: 2, art: 'kind' },
        { text: 'Eine weitere Person', anzahl: 1, art: 'erwachsen' },
      ],
    },
    modus: 'eigene_auswahl',
    loeschwunsch: BITTE,
    seitenzahl: 15,
    unterlagen: [
      u(0, 'selbstauskunft', [2, 2]),
      u(0, 'gehaltsnachweis', [3, 5], QUARTAL),
      u(0, 'bonitaet', [6, 6], { vom: '2026-10-20', pruefweg: 'pruefcode' }),
      u(1, 'selbstauskunft', [7, 7]),
      u(1, 'einkommen_ausbildung', [8, 9], { vom: '2026-08-01' }),
      u(1, 'wbs', [10, 10]),
      u(2, 'selbstauskunft', [11, 11]),
      u(2, 'buergschaftserklaerung', [12, 12]),
      u(2, 'bonitaet', [13, 15], { vom: '2026-10-18' }),
    ],
  },
};

// Alle Proben mit Lesehilfe in Fassung 1 (E218); die kurze Schreibweise oben bleibt lesbar.
for (const p of [M1, M2, M4, M4z, M6, M7, LANG]) p.anhang = alsFassung1(p.anhang!);
/** Eine neuere Fassung (2) mit einem Feld, das diese Seite nicht kennt. */
/** Fassung 2 (W57): wie Fassung 1, nur `vertrag` oder `buerge` als Rolle und `ansprech` statt `kontakt`. */
export function alsFassung2(fassung1: Record<string, unknown>, hefta = 2): Record<string, unknown> {
  const haushalt = fassung1.haushalt as { personen: Record<string, unknown>[] };
  return {
    ...fassung1,
    hefta,
    haushalt: {
      ...haushalt,
      personen: haushalt.personen.map(({ kontakt, ...p }) => ({
        ...p,
        rolle: p.rolle === 'buerge' ? 'buerge' : 'vertrag',
        ...(kontakt ? { ansprech: true } : {}),
      })),
    },
  };
}

export const M5: Probe = {
  ...M1,
  datei: 'Bewerbung_Mustermann_neu.pdf',
  // eine Fassung über der, die die Seite kennt (W57: die Seite kennt Fassung 2)
  anhang: { ...alsFassung2(M1.anhang!, 3), x_zusatz: 'unbekannt' },
};
/** Für den Export als CSV. */
export const M8: Probe = { ...M1, datei: 'Bewerbung_Mustermann_Fassung_1.pdf' };

export interface Datei {
  name: string;
  mimeType: string;
  buffer: Buffer;
}

const speicher = new Map<string, Datei>();

export async function pdf(p: Probe): Promise<Datei> {
  const merken = p.datei + p.seiten;
  const fertig = speicher.get(merken);
  if (fertig) return fertig;
  const dok = await PDFDocument.create();
  dok.registerFontkit(fontkit);
  const schrift = await dok.embedFont(readFileSync('src/pdf/fonts/Archivo-Regular.ttf'), {
    subset: false,
  });
  const a = p.anhang as unknown as Lesehilfe | undefined;
  // Seite 1 als Deckblatt nach dem Format (E223); `ersteSeite` ersetzt es für „passt nicht“.
  const zeilen = p.ersteSeite ? [p.ersteSeite] : a ? deckblattZeilen(a) : [p.datei];
  for (let i = 1; i <= p.seiten; i++) {
    const seite = dok.addPage([595, 842]);
    if (i === 1) {
      zeilen.forEach((z, k) =>
        seite.drawText(z, { x: 30, y: 810 - k * 13, size: 8, font: schrift }),
      );
    } else {
      seite.drawText(`Seite ${i}`, { x: 40, y: 780, size: 40, font: schrift });
    }
  }
  // V11: Das Erstelldatum der PDF ist `erstellt` der Lesehilfe.
  if (a?.erstellt) dok.setCreationDate(new Date(a.erstellt));
  if (p.anhang) {
    await dok.attach(new TextEncoder().encode(JSON.stringify(p.anhang)), 'hefta.json', {
      mimeType: 'application/json',
      afRelationship: AFRelationship.Data,
    });
  }
  if (p.passwort) dok.encrypt({ userPassword: p.passwort, ownerPassword: `${p.passwort}-x` });
  const bytes = await dok.save({ useObjectStreams: !p.passwort });
  const datei = { name: p.datei, mimeType: 'application/pdf', buffer: Buffer.from(bytes) };
  speicher.set(merken, datei);
  return datei;
}

export const FALSCH: Datei = {
  name: 'Anschreiben.docx',
  mimeType: 'application/octet-stream',
  buffer: Buffer.from('PK\u0003\u0004 kein PDF'),
};
export const KAPUTT: Datei = {
  name: 'Bewerbung_Kraus.pdf',
  mimeType: 'application/pdf',
  buffer: Buffer.from('%PDF-1.7\nhier bricht die Datei ab'),
};
