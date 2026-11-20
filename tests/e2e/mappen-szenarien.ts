// Die Muster-Mappen MP1 bis MP9 (design/mappe-pdf.md), gebaut mit dem Code der App: Personen,
// Selbstauskunft, Haushaltszeile und Kontakt kommen aus src/, nicht von Hand. Genutzt von
// pdfmappe.spec.ts (Bilder, P17) und vermieter.spec.ts (die Mappe der echten App lesen, CP44).
import { BITTE_VORSCHLAG } from '../../src/domain/export';
import { PDFDocument, StandardFonts, degrees, rgb } from '@cantoo/pdf-lib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Person, Rolle } from '../../src/domain/modell';
import { haushaltsZeile, nameImPdf, nameText } from '../../src/domain/namen';
import { einziehend, ortUndDatum, selbstauskunftBloecke } from '../../src/domain/selbstauskunft';
import type { BewerbungAuftrag, MappenBlock, MappenTeil } from '../../src/pdf/bewerbung';

const SCHRIFTEN = 'src/pdf/fonts';
const schriften = {
  regular: readFileSync(join(SCHRIFTEN, 'Archivo-Regular.ttf')),
  bold: readFileSync(join(SCHRIFTEN, 'Archivo-Bold.ttf')),
  titel: readFileSync(join(SCHRIFTEN, 'Archivo-ExtraBold-Wide.ttf')),
};

const FARBEN = ['#e9a970', '#b8e07c', '#e3b25a', '#ffadc9'];
const BUERGE = '#c8abff';

async function zeilen(
  titel: string,
  texte: string[],
  groesse: [number, number] = [595.28, 841.89],
  seiten = 1,
) {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const fett = await pdf.embedFont(StandardFonts.HelveticaBold);
  for (let n = 1; n <= seiten; n++) {
    const seite = pdf.addPage(groesse);
    const oben = groesse[1] - 70;
    seite.drawText('Musterfirma GmbH', { x: 60, y: oben, size: 13, font: fett });
    seite.drawText(titel, { x: 60, y: oben - 40, size: 11, font: fett });
    texte.forEach((t, i) => seite.drawText(t, { x: 60, y: oben - 70 - i * 18, size: 9, font: f }));
    if (seiten > 1) seite.drawText(`Blatt ${n}/${seiten}`, { x: 60, y: 60, size: 8, font: f });
  }
  return pdf.save();
}

const abrechnung = (monat: string, seiten = 1) =>
  zeilen(
    `Verdienstabrechnung ${monat} 2026`,
    ['Grundgehalt 3.980,00', 'Lohnsteuer 512,33', 'Sozialabgaben 824,67', 'Auszahlung 2.643,00'],
    undefined,
    seiten,
  );

async function scan() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.TimesRoman);
  const seite = pdf.addPage([595.28, 841.89]);
  // Graues Papier wie vom Handy: Im harten Schwarzweiß fällt die Fläche weg.
  seite.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.86, 0.86, 0.85) });
  seite.drawText('Bürgschaftserklärung', { x: 60, y: 760, size: 20, font: f });
  for (let i = 0; i < 12; i++)
    seite.drawLine({
      start: { x: 60, y: 700 - i * 34 },
      end: { x: 500 - (i % 4) * 30, y: 702 - i * 34 },
      thickness: 1,
      color: rgb(0.25, 0.25, 0.25),
    });
  return pdf.save();
}

async function gedreht() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.Helvetica);
  const seite = pdf.addPage([841.89, 595.28]);
  seite.setRotation(degrees(90));
  seite.drawText('Verdienstabrechnung Oktober 2026 (Handy-Scan)', {
    x: 80,
    y: 60,
    size: 14,
    font: f,
    rotate: degrees(90),
  });
  return pdf.save();
}

async function formular() {
  const pdf = await PDFDocument.create();
  const f = await pdf.embedFont(StandardFonts.HelveticaBold);
  const seite = pdf.addPage([595.28, 841.89]);
  seite.drawText('Mieterselbstauskunft des Vermieters (Formular)', {
    x: 60,
    y: 780,
    size: 12,
    font: f,
  });
  seite.drawText('Name:', { x: 60, y: 740, size: 12, font: f });
  const feld = pdf.getForm().createTextField('name');
  feld.setText('Max Mustermann');
  feld.addToPage(seite, { x: 120, y: 730, width: 250, height: 20 });
  return pdf.save();
}

interface Mensch {
  person: Person;
  rolle: Rolle;
  rolleText: string;
  farbe: string;
}

function mensch(
  vorname: string,
  nachname: string,
  rolle: Rolle,
  rolleText: string,
  angaben: Partial<Person> & { n?: number } = {},
): Mensch {
  const { n = 0, ...rest } = angaben;
  return {
    rolle,
    rolleText,
    farbe: rolle === 'buerge' ? BUERGE : FARBEN[n % FARBEN.length]!,
    person: {
      id: `${vorname}-${nachname}`,
      createdAt: '',
      updatedAt: '',
      vorname,
      nachname,
      rufname: vorname,
      kontakt: {
        telefon: '0171 3920001',
        telefonLand: 'DE',
        telefonE164: '+491713920001',
        email: `${vorname.toLowerCase()}@example.com`,
      },
      lebenssituation: 'angestellt',
      beruf: '',
      arbeitgeber: '',
      nettoeinkommen: 2643,
      abrechnungMeist: null,
      selbstauskunft: {
        einkommenArt: 'betrag',
        haustiere: null,
        haustiereText: '',
        insolvenz: 'nein',
        raeumungstitel: 'nein',
        mietrueckstaende: 'nein',
        stellungnahme: '',
        ort: '',
      },
      ...rest,
    } as Person,
  };
}

const HH = { haustiere: 'nein' as const, haustiereText: '', ort: 'Hamburg' };

function auskunft(m: Mensch, alle: Mensch[]): MappenTeil {
  const wer = einziehend(alle.filter((x) => x.rolle !== 'buerge').length, {
    kinder: 1,
    weitereErwachsene: 0,
  });
  return {
    abschnitt: 'Selbstauskunft',
    quellen: [],
    auskunft: {
      name: nameText(nameImPdf(m.person)),
      rolle: m.rolleText,
      farbe: m.farbe,
      bloecke: selbstauskunftBloecke(m.person, m.rolle, wer, HH, 'zusage', {
        rolleText: m.rolleText,
        buergschaftDabei: m.rolle === 'buerge',
      }),
      ...ortUndDatum(m.rolle, HH.ort, '2. November 2026'),
    },
  };
}

async function gehalt(): Promise<MappenTeil> {
  return {
    abschnitt: 'Gehaltsnachweise',
    detail: 'Juli bis September',
    quellen: [
      { daten: await abrechnung('September'), kopf: 'Gehaltsnachweis September 2026' },
      { daten: await abrechnung('August', 2), kopf: 'Gehaltsnachweis August 2026' },
      { daten: await abrechnung('Juli'), kopf: 'Gehaltsnachweis Juli 2026' },
    ],
  };
}

async function bonitaet(): Promise<MappenTeil> {
  return {
    abschnitt: 'Bonitätsnachweis',
    detail: 'vom 20. Oktober 2026',
    kopf: 'Bonitätsnachweis vom 20. Oktober 2026',
    quellen: [{ daten: await zeilen('Bonitätsauskunft', ['Ausgestellt am 20.10.2026']) }],
  };
}

const block = (m: Mensch, teile: MappenTeil[]): MappenBlock => ({
  person: {
    name: nameText(nameImPdf(m.person)),
    rolle: m.rolleText,
    beruf: m.person.beruf,
    farbe: m.farbe,
    buerge: m.rolle === 'buerge',
  },
  teile,
});

/** Baut den Auftrag wie src/ui/mappeErstellen.ts: Haushaltszeile, Autor und Kontakt aus den Personen. */
function auftrag(
  menschen: Mensch[],
  bloecke: MappenBlock[],
  teil: Partial<BewerbungAuftrag> = {},
): BewerbungAuftrag {
  const vertrag = menschen.filter((m) => m.rolle !== 'buerge');
  const fussName = haushaltsZeile(vertrag.map((m) => nameImPdf(m.person)));
  const erste = vertrag[0]!.person;
  const kurz =
    teil.kurz === undefined && 'kurz' in teil ? undefined : (teil.kurz ?? 'Beispielstraße 1');
  return {
    titel: kurz ? `Bewerbung ${kurz} – ${fussName}` : `Bewerbung – ${fussName}`,
    autor: nameText(nameImPdf(erste)),
    fussName,
    kurz,
    adresse: ['Beispielstraße 1, 3. OG links', '12345 Musterstadt'],
    satz: 'Wir sind ein ruhiges Paar mit einem Kind und suchen ab Januar 2027 eine Wohnung für die nächsten Jahre. Alle Unterlagen liegen bei.',
    mitziehende: [{ text: 'Ein Kind', anzahl: 1, art: 'kind' }],
    // Wie in der App: Mit Lesehilfe trägt jede Mappe die Kennung der Bewerbung (Pflicht seit E21).
    kennung: '6f1c2b9e-4d7a-4c1e-9b2f-3a5d8e7c1f40',
    hinweis: true,
    aussehen: { art: 'personen' },
    kontakt: [nameText(nameImPdf(erste)), erste.kontakt.telefon, erste.kontakt.email],
    bloecke,
    deckblatt: true,
    inhaltsverzeichnis: true,
    fusszeile: true,
    schriften,
    datum: new Date(2026, 10, 2),
    ...teil,
  };
}

const MAX = mensch('Max', 'Mustermann', 'hauptmieter', 'Hauptmieter', { beruf: 'Elektroniker' });
const LEA = mensch('Lea', 'Mustermann', 'mitmieter', 'Mitmieterin', {
  n: 1,
  beruf: 'Lehrerin',
  nettoeinkommen: 2310,
});
const PETRA = mensch('Petra', 'Mustermann', 'buerge', 'Bürgin', { nettoeinkommen: 1850 });

async function mp1(): Promise<MappenBlock[]> {
  const alle = [MAX, LEA, PETRA];
  return [
    block(MAX, [auskunft(MAX, alle), await gehalt(), await bonitaet()]),
    block(LEA, [
      auskunft(LEA, alle),
      await gehalt(),
      {
        abschnitt: 'Mietzahlungen',
        detail: 'August bis Oktober',
        kopf: 'Mietzahlungen August bis Oktober',
        quellen: [
          {
            daten: await zeilen(
              'Umsatzübersicht',
              ['01.10.2026 Dauerauftrag Miete 980,00', '01.09.2026 Dauerauftrag Miete 980,00'],
              [841.89, 595.28],
            ),
          },
        ],
      },
      {
        abschnitt: 'Mietschuldenfreiheit',
        detail: 'vom 12. Oktober 2026',
        kopf: 'Mietschuldenfreiheitsbescheinigung',
        quellen: [
          {
            daten: await zeilen(
              'Mietschuldenfreiheit',
              ['Die Miete wurde stets pünktlich gezahlt.'],
              [419.53, 595.28],
            ),
          },
        ],
      },
    ]),
    block(PETRA, [
      auskunft(PETRA, alle),
      { abschnitt: 'Bürgschaftserklärung', quellen: [{ daten: await scan() }] },
      {
        abschnitt: 'Rentenbescheid',
        detail: 'Juli 2026',
        kopf: 'Rentenbescheid Juli 2026',
        quellen: [{ daten: await zeilen('Deutsche Rentenversicherung', [], [612, 792]) }],
      },
      await bonitaet(),
    ]),
  ];
}

export const SZENARIEN: Record<string, () => Promise<BewerbungAuftrag>> = {
  'MP1-standard': async () => auftrag([MAX, LEA, PETRA], await mp1()),
  'MP2-allein': async () =>
    auftrag([MAX], [block(MAX, [auskunft(MAX, [MAX]), await gehalt(), await bonitaet()])], {
      kurz: undefined,
      adresse: [],
      satz: '',
      mitziehende: [],
    }),
  'MP3-lange-namen': async () => {
    const a = mensch(
      'Maximilian-Alexander',
      'Müller-Lüdenscheidt',
      'hauptmieter',
      'Hauptmietpartei',
      {
        beruf: 'Elektroingenieur im öffentlichen Dienst',
      },
    );
    const b = mensch('Bartholomäus', 'Wiśniewski-Kowalczyk', 'mitmieter', 'Mitmietpartei', {
      n: 1,
    });
    const c = mensch('Jonas', 'Becker', 'mitmieter', 'Mitmieter', { n: 2 });
    const d = mensch('Anna-Katharina Josephine', 'von Hohenstein', 'buerge', 'Bürgin');
    return auftrag(
      [a, b, c, d],
      [
        block(a, [await gehalt(), await bonitaet()]),
        block(b, [await bonitaet()]),
        block(c, [await gehalt()]),
        block(d, [{ abschnitt: 'Bürgschaftserklärung', quellen: [{ daten: await scan() }] }]),
      ],
      {
        kurz: 'Große Beispielstraße 1',
        adresse: ['Große Beispielstraße 1, Hinterhaus, 4. OG rechts', '12345 Musterstadt-Nord'],
        mitziehende: [],
      },
    );
  },
  'MP4-datensparsam': async () =>
    auftrag(
      [MAX, LEA],
      [block(MAX, [auskunft(MAX, [MAX, LEA])]), block(LEA, [auskunft(LEA, [MAX, LEA])])],
      { satz: '' },
    ),
  'MP5-ohne-kopfzeile': async () => auftrag([MAX, LEA, PETRA], await mp1(), { fusszeile: false }),
  'MP6-einzeldatei-gehalt': async () =>
    auftrag([MAX, LEA], [block(MAX, [await gehalt()])], {
      titel: 'Gehaltsnachweise – Max Mustermann – Bewerbung Beispielstraße 1',
      deckblatt: false,
      inhaltsverzeichnis: false,
    }),
  'MP7-randfaelle': async () =>
    auftrag(
      [MAX],
      [
        block(MAX, [
          {
            abschnitt: 'Formular des Vermieters',
            detail: 'ausgefüllt',
            quellen: [{ daten: await formular() }],
          },
          {
            abschnitt: 'Gehaltsnachweis',
            detail: 'Oktober',
            kopf: 'Gehaltsnachweis Oktober 2026',
            quellen: [{ daten: await gedreht() }],
          },
        ]),
      ],
      { adresse: [], kurz: undefined, satz: '', mitziehende: [] },
    ),
  'MP8-langer-inhalt': async () => {
    const leute = [
      mensch('Max', 'Mustermann', 'hauptmieter', 'Hauptmieter', { beruf: 'Elektroniker' }),
      mensch('Lea', 'Mustermann', 'mitmieter', 'Mitmieterin', { n: 1 }),
      mensch('Tom', 'Becker', 'mitmieter', 'Mitmieter', { n: 2 }),
      mensch('Anna', 'Schmidt', 'mitmieter', 'Mitmieterin', { n: 3 }),
      mensch('Petra', 'Mustermann', 'buerge', 'Bürgin'),
    ];
    const seite = await zeilen('Unterlage', ['Eine Seite']);
    const namen = [
      'Selbstauskunft',
      'Gehaltsnachweise',
      'Bonitätsnachweis',
      'Mietzahlungen',
      'Mietschuldenfreiheit',
      'Ausweis',
    ];
    return auftrag(
      leute,
      leute.map((m) =>
        block(
          m,
          namen.map((abschnitt) => ({ abschnitt, quellen: [{ daten: seite }] })),
        ),
      ),
    );
  },
  'MP1-bitte': async () => ({ ...(await SZENARIEN['MP1-standard']!()), bitte: BITTE_VORSCHLAG }),
  'MP8-bitte': async () => ({
    ...(await SZENARIEN['MP8-langer-inhalt']!()),
    bitte: BITTE_VORSCHLAG,
  }),
  // Die volle Leiste: passt noch ohne Stufe (mappe-pdf.md, „Volle Leiste“).
  'MP10-volle-leiste': async () => {
    const vertrag = [
      mensch('Maximilian-Alexander', 'Müller-Lüdenscheidt', 'hauptmieter', 'Hauptmietpartei', {
        beruf: 'Elektroingenieur im öffentlichen Dienst',
      }),
      mensch('Bartholomäus', 'Wiśniewski-Kowalczyk', 'mitmieter', 'Mitmietpartei', {
        n: 1,
        beruf: 'Auszubildender zum Mechatroniker',
      }),
      mensch('Anna-Katharina Josephine', 'von Hohenstein', 'mitmieter', 'Mitmieterin', {
        n: 2,
        beruf: 'Fachärztin für Kinder- und Jugendmedizin',
      }),
      mensch('Jonas', 'Becker', 'mitmieter', 'Mitmieter', { n: 3, beruf: 'Pflegefachmann' }),
      mensch('Mira', 'Yılmaz', 'mitmieter', 'Mitmieterin', {
        n: 4,
        beruf: 'Studentin der Rechtswissenschaft',
      }),
      mensch('Tom', 'Nguyen', 'mitmieter', 'Mitmieter', { n: 5, beruf: 'Koch' }),
    ];
    const buergen = [
      mensch('Petra', 'Mustermann', 'buerge', 'Bürgin'),
      mensch('Hans-Jürgen', 'Wiśniewski-Kowalczyk', 'buerge', 'Bürge'),
    ];
    const seite = await zeilen('Unterlage', ['Eine Seite']);
    const leute = [...vertrag, ...buergen];
    return auftrag(
      leute,
      leute.map((m) => block(m, [{ abschnitt: 'Selbstauskunft', quellen: [{ daten: seite }] }])),
      {
        adresse: ['Große Beispielstraße 1, Hinterhaus, 4. OG rechts', '12345 Musterstadt-Nord'],
        kurz: 'Große Beispielstraße 1',
        satz: 'Wir sind eine große Wohngemeinschaft mit zwei Kindern und suchen ab März eine Wohnung für mehrere Jahre.',
        mitziehende: [
          { text: 'Zwei Kinder', anzahl: 2, art: 'kind' },
          { text: 'Eine weitere Person', anzahl: 1, art: 'erwachsen' },
        ],
      },
    );
  },
  'MP9-andere-schrift': async () => {
    const olena = mensch('Олена', 'Коваленко', 'hauptmieter', 'Hauptmieterin', {
      nameMappe: { vorname: 'Olena', nachname: 'Kovalenko' },
      kontakt: {
        telefon: '0171 3920004',
        telefonLand: 'DE',
        telefonE164: '+491713920004',
        email: 'olena@example.com',
      },
    });
    const piotr = mensch('Piotr', 'Wiśniewski', 'mitmieter', 'Mitmieter', { n: 1 });
    const mai = mensch('Thị Mai', 'Nguyễn', 'mitmieter', 'Mitmieterin', {
      n: 2,
      kontakt: {
        telefon: '0171 3920005',
        telefonLand: 'DE',
        telefonE164: '+491713920005',
        email: 'mai@example.com',
      },
    });
    const alle = [olena, piotr, mai];
    return auftrag(alle, [
      block(olena, [auskunft(olena, alle), await bonitaet()]),
      block(piotr, [auskunft(piotr, alle)]),
      block(mai, [auskunft(mai, alle)]),
    ]);
  },
};
