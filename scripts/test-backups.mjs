// Fünf Test-Backups für Hefta, zum Ausprobieren am iPhone (Wunsch des Auftraggebers vom 5.11.2026).
// Die Daten entstehen mit den Speicherfunktionen der App selbst, im Browser über den
// Entwicklungsserver; das Backup mit derselben Funktion wie „Backup sichern“. Danach wird jedes
// Backup zur Probe in die gebaute App (dist/) eingespielt, wie es ein Mensch tun würde.
// Alle Personen und Dokumente sind erfunden, jedes PDF trägt oben „MUSTER“.
//
//   npm run build && node scripts/test-backups.mjs   → design-sync/test-backups/

import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, preview } from 'vite';

const ZIEL = 'design-sync/test-backups';
const TESTDATEIEN = 'design-sync/testdateien';
const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;
const MONATE = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
];
const monatText = (m) => `${MONATE[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
const tagText = (d) => `${d.slice(8)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;

// ---------- Muster-PDFs ----------

async function pdf(seiten, { grau = false } = {}) {
  const doc = await PDFDocument.create();
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  seiten.forEach(({ kopf, titel, zeilen }) => {
    const s = doc.addPage([595.28, 841.89]);
    if (grau)
      s.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.87, 0.87, 0.85) });
    s.drawText('MUSTER - Testdaten für Hefta, nicht echt', {
      x: 60,
      y: 805,
      size: 8,
      font: f,
      color: rgb(0.65, 0.1, 0.1),
    });
    s.drawText(kopf, { x: 60, y: 770, size: 13, font: fett });
    s.drawText(titel, { x: 60, y: 732, size: 12, font: fett });
    // Keine Zählung „Seite 1 von 3“: In einer Sammeldatei steht jede Abrechnung für sich.
    zeilen.forEach((z, j) => s.drawText(z, { x: 60, y: 700 - j * 18, size: 10, font: f }));
  });
  return Buffer.from(await doc.save()).toString('base64');
}

const gehaltSeite = (name, firma, monat, netto) => ({
  kopf: firma,
  titel: `Verdienstabrechnung ${monatText(monat)}`,
  zeilen: [
    `Mitarbeiter: ${name}`,
    `Abrechnungsmonat: ${monatText(monat)}`,
    'Gesamtbrutto 3.980,00 EUR',
    'Lohnsteuer 512,33 EUR',
    'Sozialversicherung 824,67 EUR',
    `Auszahlungsbetrag ${netto} EUR`,
  ],
});
const gehalt = (name, firma, monat, netto) => pdf([gehaltSeite(name, firma, monat, netto)]);
const gehaltSammel = (name, firma, monate, netto) =>
  pdf(monate.map((m) => gehaltSeite(name, firma, m, netto)));
const bonitaet = (name, datum) =>
  pdf([
    {
      kopf: 'Auskunftei (Muster)',
      titel: 'Bonitätsauskunft für Vermieter - Bonitätszertifikat',
      zeilen: [
        `Für: ${name}`,
        `Erstellt am ${tagText(datum)}`,
        'Prüfcode: MUSTER-4K2-7QX',
        'Keine Negativmerkmale gespeichert.',
        'Gültig zur Vorlage beim Vermieter.',
      ],
    },
  ]);
const brief = (kopf, titel, zeilen, optionen) => pdf([{ kopf, titel, zeilen }], optionen);
const datei = (pfad) => readFileSync(join(TESTDATEIEN, pfad)).toString('base64');

// ---------- Die fünf Fälle ----------

const NEIN = {
  einkommenArt: 'betrag',
  haustiere: 'nein',
  haustiereText: '',
  insolvenz: 'nein',
  raeumungstitel: 'nein',
  mietrueckstaende: 'nein',
  stellungnahme: '',
  erklaerungInsolvenz: '',
  erklaerungRaeumungstitel: '',
  ort: 'Hamburg',
};
const person = (
  vorname,
  nachname,
  bezeichnung,
  rolle,
  lebenssituation,
  angaben,
  unterlagen,
  mehr = {},
) => ({
  entwurf: { vorname, nachname, bezeichnung, rolle, lebenssituation, ...mehr },
  angaben,
  unterlagen,
});
const kontakt = (telefon, email) => ({ kontakt: { telefon, email } });

async function plaene() {
  const MAX = 'Max Mustermann';
  const LEA = 'Lea Mustermann';
  return [
    {
      id: '1-allein-ohne-passwort',
      titel: 'Max allein, alles da, ohne Passwort',
      passwort: null,
      kinder: 0,
      weitere: 0,
      haushalt: { haustiere: 'nein', haustiereText: '', ort: 'Hamburg' },
      personen: [
        person(
          'Max',
          'Mustermann',
          'maennlich',
          'hauptmieter',
          'angestellt',
          {
            ...kontakt('0170 1234567', 'max.mustermann@example.com'),
            beruf: 'Elektroniker',
            arbeitgeber: 'Musterwerk GmbH',
            nettoeinkommen: 2850,
            abrechnungMeist: 'ende',
            selbstauskunft: NEIN,
          },
          [
            ...['2026-08', '2026-09', '2026-10'].map((m) => ({
              typ: 'gehaltsnachweis',
              monat: m,
              variante: 'gehaltsabrechnung',
              name: `Gehalt_${m}.pdf`,
              daten: gehalt(MAX, 'Musterwerk GmbH', m, '2.850,00'),
            })),
            {
              typ: 'bonitaet',
              datum: '2026-10-28',
              name: 'Bonitaet.pdf',
              daten: bonitaet(MAX, '2026-10-28'),
            },
          ],
        ),
      ],
      bewerbung: { adresse: 'Hauptstraße 12, 3. OG links\n22767 Hamburg' },
    },
    {
      id: '2-familie-buergin-mit-passwort',
      titel: 'Max und Lea, ein Kind, Bürgin Petra, mit Passwort',
      passwort: 'Hefta-Test-2',
      kinder: 1,
      weitere: 0,
      haushalt: {
        haustiere: 'ja',
        haustiereText: 'eine Katze',
        ort: 'Hamburg',
        mappeAussehen: { art: 'einefarbe', akzent: 'tanne' },
      },
      personen: [
        person(
          'Max',
          'Mustermann',
          'maennlich',
          'hauptmieter',
          'angestellt',
          {
            ...kontakt('0170 1234567', 'max.mustermann@example.com'),
            beruf: 'Elektroniker',
            arbeitgeber: 'Musterwerk GmbH',
            nettoeinkommen: 2850,
            abrechnungMeist: 'ende',
            selbstauskunft: { ...NEIN, haustiere: 'ja', haustiereText: 'eine Katze' },
          },
          [
            {
              typ: 'gehaltsnachweis',
              variante: 'gehaltsabrechnung',
              name: 'Gehalt_Aug-Okt.pdf',
              aufteilung: ['2026-08', '2026-09', '2026-10'],
              daten: gehaltSammel(
                MAX,
                'Musterwerk GmbH',
                ['2026-08', '2026-09', '2026-10'],
                '2.850,00',
              ),
            },
            {
              typ: 'bonitaet',
              datum: '2026-10-28',
              name: 'Bonitaet_Max.pdf',
              daten: bonitaet(MAX, '2026-10-28'),
            },
            {
              typ: 'ausweiskopie',
              name: 'Ausweis.pdf',
              daten: brief('Personalausweis (Muster)', 'Kopie Vorder- und Rückseite', [
                `Name: ${MAX}`,
                'Nur als Muster',
              ]),
            },
            {
              typ: 'schufa_datenkopie',
              name: 'Datenkopie.pdf',
              daten: brief('Auskunftei (Muster)', 'Datenkopie nach Art. 15 DSGVO', [
                `Für: ${MAX}`,
                'Alle gespeicherten Daten',
              ]),
            },
          ],
        ),
        person(
          'Lea',
          'Mustermann',
          'weiblich',
          'mitmieter',
          'angestellt',
          {
            ...kontakt('0171 7654321', ''),
            beruf: 'Erzieherin',
            arbeitgeber: 'Kita Sonnenschein',
            nettoeinkommen: 1950,
            abrechnungMeist: 'ende',
            selbstauskunft: { ...NEIN, haustiere: 'ja', haustiereText: 'eine Katze' },
          },
          [
            ...['2026-08', '2026-09', '2026-10'].map((m) => ({
              typ: 'gehaltsnachweis',
              monat: m,
              variante: 'gehaltsabrechnung',
              name: `Lea_Gehalt_${m}.pdf`,
              daten: gehalt(LEA, 'Kita Sonnenschein', m, '1.950,00'),
            })),
            {
              typ: 'bonitaet',
              datum: '2026-10-30',
              name: 'Bonitaet_Lea.pdf',
              daten: bonitaet(LEA, '2026-10-30'),
            },
            {
              typ: 'mietzahlung',
              datum: '2026-10-15',
              variante: 'bescheinigung',
              name: 'Mietschuldenfreiheit.pdf',
              daten: brief(
                'Hausverwaltung Elbblick (Muster)',
                'Mietschuldenfreiheitsbescheinigung',
                [
                  `Mieterin: ${LEA}`,
                  'Die Miete wurde stets pünktlich und vollständig gezahlt.',
                  'Hamburg, 15.10.2026',
                ],
              ),
            },
            {
              typ: 'empfehlung_vorvermieter',
              datum: '2026-10-15',
              name: 'Empfehlung.pdf',
              daten: brief('Hausverwaltung Elbblick (Muster)', 'Empfehlung', [
                'Wir haben Frau Mustermann als ruhige und zuverlässige Mieterin kennengelernt.',
              ]),
            },
          ],
        ),
        person(
          'Petra',
          'Mustermann',
          'weiblich',
          'buerge',
          'rente',
          {
            ...kontakt('040 123456', ''),
            beruf: 'Rentnerin',
            arbeitgeber: '',
            nettoeinkommen: 2100,
            selbstauskunft: NEIN,
          },
          [
            {
              typ: 'buergschaftserklaerung',
              datum: '2026-10-20',
              name: 'Buergschaft_Scan.pdf',
              daten: brief(
                'Bürgschaftserklärung (Muster)',
                'Selbstschuldnerische Bürgschaft',
                [
                  'Ich bürge für die Verpflichtungen aus dem Mietvertrag von Max und Lea Mustermann.',
                  'Hamburg, 20.10.2026',
                  'Petra Mustermann',
                ],
                { grau: true },
              ),
            },
            {
              typ: 'rentenbescheid',
              datum: '2026-07-01',
              name: 'Rentenbescheid.pdf',
              daten: brief('Rentenversicherung (Muster)', 'Rentenanpassung zum 1. Juli 2026', [
                'Monatliche Rente 2.100,00 EUR',
              ]),
            },
            {
              typ: 'bonitaet',
              datum: '2026-10-21',
              name: 'Bonitaet_Petra.pdf',
              daten: bonitaet('Petra Mustermann', '2026-10-21'),
            },
          ],
        ),
      ],
      bewerbung: {
        adresse: 'Lindenallee 3, Erdgeschoss\n20259 Hamburg',
        satz: 'Wir suchen eine ruhige Wohnung nahe der Kita unserer Tochter.',
        export: { bitte: true },
      },
    },
    {
      id: '3-lebenslagen-datensparsam',
      titel: 'Drei Erwachsene in verschiedenen Lebenslagen, Bürge, „Datensparsam“',
      passwort: null,
      kinder: 0,
      weitere: 1,
      haushalt: {
        haustiere: 'nein',
        haustiereText: '',
        ort: 'Bremen',
        mappeAussehen: { art: 'schlicht', schrift: 'source_serif' },
      },
      personen: [
        person(
          'Jonas',
          'Becker',
          'maennlich',
          'hauptmieter',
          'selbststaendig',
          {
            ...kontakt('0151 2223334', 'jonas.becker@example.com'),
            beruf: 'Grafikdesigner (selbstständig)',
            arbeitgeber: 'eigenes Büro',
            nettoeinkommen: 3100,
            selbstauskunft: { ...NEIN, ort: 'Bremen' },
          },
          [
            {
              typ: 'einkommen_selbststaendig',
              datum: '2026-06-12',
              name: 'Steuerbescheid_2025.pdf',
              daten: brief('Finanzamt (Muster)', 'Bescheid für 2025 über Einkommensteuer', [
                'Zu versteuerndes Einkommen 41.200 EUR',
                'Bremen, 12.06.2026',
              ]),
            },
            {
              typ: 'bonitaet',
              datum: '2026-10-25',
              name: 'Bonitaet_Jonas.pdf',
              daten: bonitaet('Jonas Becker', '2026-10-25'),
            },
            {
              typ: 'wbs',
              name: 'WBS.pdf',
              daten: brief('Amt für Wohnungswesen (Muster)', 'Wohnberechtigungsschein', [
                'Haushaltsgröße: 3 Personen',
                'Gültig bis 30.09.2027',
              ]),
            },
          ],
        ),
        person(
          'Mira',
          'Yılmaz',
          'weiblich',
          'mitmieter',
          'studierend_azubi',
          {
            ...kontakt('0176 5556667', ''),
            beruf: 'Lehramt Deutsch und Kunst',
            arbeitgeber: 'Universität Bremen',
            nettoeinkommen: 934,
            selbstauskunft: { ...NEIN, ort: 'Bremen' },
          },
          [
            {
              typ: 'einkommen_ausbildung',
              datum: '2026-09-01',
              variante: 'bafoeg',
              name: 'BAfoeG_Bescheid.pdf',
              daten: brief('Studierendenwerk (Muster)', 'Bescheid über Ausbildungsförderung', [
                'Bewilligungszeitraum 10/2026 bis 09/2027',
                'Monatlich 934,00 EUR',
              ]),
            },
          ],
          { ausbildungArt: 'studium' },
        ),
        person(
          'Kim',
          'Nowak',
          'neutral',
          'mitmieter',
          'leistungsbezug',
          {
            ...kontakt('', 'kim.nowak@example.com'),
            beruf: 'auf Arbeitssuche',
            arbeitgeber: '',
            nettoeinkommen: null,
            selbstauskunft: { ...NEIN, ort: 'Bremen' },
          },
          [
            {
              typ: 'mietuebernahme_amt',
              datum: '2026-10-02',
              name: 'Kostenuebernahme.pdf',
              daten: brief(
                'Jobcenter (Muster)',
                'Zusicherung der Übernahme der Kosten der Unterkunft',
                ['Die anteilige Miete wird direkt an die Vermietung gezahlt.'],
              ),
            },
          ],
        ),
        person(
          'Hans',
          'Yılmaz',
          'maennlich',
          'buerge',
          'angestellt',
          {
            ...kontakt('0421 998877', ''),
            beruf: 'Busfahrer',
            arbeitgeber: 'Verkehrsbetriebe (Muster)',
            nettoeinkommen: 2600,
            abrechnungMeist: 'mitte',
            selbstauskunft: { ...NEIN, ort: 'Bremen' },
          },
          [
            {
              typ: 'buergschaftserklaerung',
              datum: '2026-10-10',
              name: 'Buergschaft_Hans.pdf',
              daten: brief('Bürgschaftserklärung (Muster)', 'Bürgschaft für Mira Yılmaz', [
                'Bremen, 10.10.2026',
              ]),
            },
            ...['2026-08', '2026-09', '2026-10'].map((m) => ({
              typ: 'gehaltsnachweis',
              monat: m,
              variante: 'gehaltsabrechnung',
              name: `Hans_Gehalt_${m}.pdf`,
              daten: gehalt('Hans Yilmaz', 'Verkehrsbetriebe (Muster)', m, '2.600,00'),
            })),
          ],
        ),
      ],
      bewerbung: {
        adresse: 'Am Wall 140\n28195 Bremen',
        export: { modus: 'datensparsam', schritt: 'will_wohnung' },
      },
    },
    {
      id: '4-luecken-lange-namen-mit-passwort',
      titel: 'Halbfertig: Lücken, zu Altes, Prüfhinweise, lange und fremde Namen, mit Passwort',
      passwort: 'Hefta-Test-4',
      kinder: 2,
      weitere: 0,
      haushalt: {
        haustiere: null,
        haustiereText: '',
        ort: 'Hamburg',
        mappeAussehen: { art: 'personen', flaeche: 'grau', kompakt: true },
      },
      personen: [
        person(
          'Maximilian-Alexander',
          'Müller-Lüdenscheidt',
          'maennlich',
          'hauptmieter',
          'angestellt',
          {
            ...kontakt('0160 1112223', ''),
            beruf: 'Projektleiter',
            arbeitgeber: 'Hanseatische Logistik GmbH & Co. KG',
            nettoeinkommen: 3400,
            abrechnungMeist: 'anfang',
            // Die Frage nach der Zusage ist noch offen.
            selbstauskunft: { ...NEIN, haustiere: null, mietrueckstaende: null },
          },
          [
            ...['2026-06', '2026-07'].map((m) => ({
              typ: 'gehaltsnachweis',
              monat: m,
              variante: 'gehaltsabrechnung',
              name: `Abrechnung_${m}.pdf`,
              daten: gehalt(
                'Maximilian-Alexander Mueller-Luedenscheidt',
                'Hanseatische Logistik GmbH & Co. KG',
                m,
                '3.400,00',
              ),
            })),
            // Dieselbe Datei noch einmal, als anderer Monat: soll „Bitte prüfen“ auslösen.
            {
              typ: 'gehaltsnachweis',
              monat: '2026-08',
              variante: 'gehaltsabrechnung',
              name: 'Abrechnung_2026-08.pdf',
              gleichWie: 1,
            },
            {
              typ: 'bonitaet',
              datum: '2026-07-01',
              name: 'Bonitaet_alt.pdf',
              daten: bonitaet('Maximilian-Alexander Mueller-Luedenscheidt', '2026-07-01'),
            },
            {
              typ: 'mietzahlung',
              datum: '2026-10-31',
              variante: 'kontoauszug',
              name: 'Zwoelf-Seiten.pdf',
              daten: datei('4-Zwoelf-Seiten.pdf'),
            },
          ],
          { rufname: 'Max' },
        ),
        person(
          'Олена',
          'Коваленко',
          'weiblich',
          'mitmieter',
          'angestellt',
          {
            ...kontakt('', 'olena@example.com'),
            beruf: 'Pflegefachfrau',
            arbeitgeber: '',
            nettoeinkommen: null,
            selbstauskunft: null,
          },
          [
            {
              typ: 'bonitaet',
              datum: null,
              name: 'Bonitaet_ohne_Datum.pdf',
              daten: datei('2-Bonitaet-Datum-nachlesen.pdf'),
            },
          ],
          { nameMappe: { vorname: 'Olena', nachname: 'Kovalenko' } },
        ),
        person(
          'Anna-Katharina Josephine',
          'von Hohenstein',
          'weiblich',
          'buerge',
          'angestellt',
          {
            ...kontakt('', ''),
            beruf: '',
            arbeitgeber: '',
            nettoeinkommen: null,
            selbstauskunft: null,
          },
          [],
          { herausnehmen: true },
        ),
      ],
      bewerbung: {
        adresse: 'Große Bergstraße 152, Hinterhaus, 4. OG rechts\n22767 Hamburg-Altona',
        export: {
          modus: 'eigene_auswahl',
          ausgabe: 'einzeln',
          inhaltsverzeichnis: false,
          auswahl: { '0:mietzahlung': false },
        },
      },
    },
    {
      id: '5-gross-viele-dateien-mit-passwort',
      titel: 'Großes Backup: ein Jahr Gehaltsabrechnungen, alte Bonitätsauskünfte, ein 10-MB-Scan',
      passwort: 'Hefta-Test-5',
      kinder: 0,
      weitere: 0,
      haushalt: {
        haustiere: 'nein',
        haustiereText: '',
        ort: 'Hamburg',
        mappeAussehen: { art: 'einefarbe', akzent: 'bordeaux', schrift: 'plex_sans' },
      },
      personen: [
        person(
          'Max',
          'Mustermann',
          'maennlich',
          'hauptmieter',
          'angestellt',
          {
            ...kontakt('0170 1234567', 'max.mustermann@example.com'),
            beruf: 'Elektroniker',
            arbeitgeber: 'Musterwerk GmbH',
            nettoeinkommen: 2850,
            abrechnungMeist: 'ende',
            selbstauskunft: NEIN,
          },
          [
            ...[
              '2025-11',
              '2025-12',
              '2026-01',
              '2026-02',
              '2026-03',
              '2026-04',
              '2026-05',
              '2026-06',
              '2026-07',
              '2026-08',
              '2026-09',
              '2026-10',
            ].map((m) => ({
              typ: 'gehaltsnachweis',
              monat: m,
              variante: 'gehaltsabrechnung',
              name: `Gehalt_${m}.pdf`,
              daten: gehalt(MAX, 'Musterwerk GmbH', m, '2.850,00'),
            })),
            ...['2026-02-10', '2026-06-18', '2026-10-28'].map((d) => ({
              typ: 'bonitaet',
              datum: d,
              name: `Bonitaet_${d}.pdf`,
              daten: bonitaet(MAX, d),
            })),
          ],
        ),
        person(
          'Petra',
          'Mustermann',
          'weiblich',
          'buerge',
          'angestellt',
          {
            ...kontakt('040 123456', ''),
            beruf: 'Steuerfachangestellte',
            arbeitgeber: 'Kanzlei am Hafen (Muster)',
            nettoeinkommen: 2400,
            abrechnungMeist: 'ende',
            selbstauskunft: NEIN,
          },
          [
            {
              typ: 'buergschaftserklaerung',
              datum: '2026-10-20',
              name: 'Grosser-Scan.pdf',
              daten: datei('5-Grosser-Scan.pdf'),
            },
            ...['2026-08', '2026-09', '2026-10'].map((m) => ({
              typ: 'gehaltsnachweis',
              monat: m,
              variante: 'gehaltsabrechnung',
              name: `Petra_Gehalt_${m}.pdf`,
              daten: gehalt('Petra Mustermann', 'Kanzlei am Hafen (Muster)', m, '2.400,00'),
            })),
            {
              typ: 'bonitaet',
              datum: '2026-10-21',
              name: 'Bonitaet_Petra.pdf',
              daten: bonitaet('Petra Mustermann', '2026-10-21'),
            },
          ],
        ),
      ],
      bewerbung: {
        adresse: 'Hauptstraße 12, 3. OG links\n22767 Hamburg',
        export: { modus: 'alles', kleiner: true },
      },
    },
  ];
}

async function aufloesen(liste) {
  for (const plan of liste)
    for (const p of plan.personen)
      for (const u of p.unterlagen) if (u.daten) u.daten = await u.daten;
  return liste;
}

// ---------- Im Browser: Daten anlegen und sichern ----------

async function erzeugen(page, plan) {
  return page.evaluate(
    async ({ plan, version }) => {
      const { datenbankOeffnen } = await import('/src/storage/db.ts');
      const sp = await import('/src/storage/speicher.ts');
      const { sicherungErstellen, sicherungPruefen } = await import('/src/storage/sicherung.ts');
      const { standardEinstellungen } = await import('/src/domain/export.ts');
      const db = await datenbankOeffnen(`test-backup-${plan.id}-${Date.now()}`);
      const blob = (b64) => {
        const roh = atob(b64);
        const bytes = new Uint8Array(roh.length);
        for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
        return new Blob([bytes], { type: 'application/pdf' });
      };
      const haushalt = await sp.haushaltAnlegen(db, {
        kinder: plan.kinder,
        weitereErwachsene: plan.weitere,
        personen: plan.personen.map((p) => p.entwurf),
      });
      const ansicht = await sp.haushaltLaden(db, haushalt.id);
      const mitglieder = [...ansicht.mitglieder].sort(
        (a, b) => a.zugehoerigkeit.reihenfolge - b.zugehoerigkeit.reihenfolge,
      );
      const ids = mitglieder.map((m) => m.person.id);
      await sp.haushaltAendern(db, haushalt.id, { ...plan.haushalt, angabenVon: ids[0] });
      for (const [i, p] of plan.personen.entries()) {
        const { selbstauskunft, ...rest } = p.angaben;
        await sp.personAendern(db, ids[i], selbstauskunft ? { ...rest, selbstauskunft } : rest);
        for (const u of p.unterlagen) {
          const daten = u.gleichWie !== undefined ? p.unterlagen[u.gleichWie].daten : u.daten;
          await sp.unterlageSpeichern(db, {
            personId: ids[i],
            typ: u.typ,
            serie: u.typ === 'gehaltsnachweis' ? 3 : null,
            original: blob(daten),
            aufbereitet: null,
            dateiname: u.name,
            ausstellungsdatum: u.datum ?? null,
            abrechnungsmonat: u.monat ?? null,
            variante: u.variante ?? null,
            seiten: null,
            gerastert: false,
            ...(u.aufteilung
              ? { aufteilung: u.aufteilung.map((monat, s) => ({ monat, seiten: [s] })) }
              : {}),
          });
        }
      }
      for (const [i, p] of plan.personen.entries())
        if (p.entwurf.herausnehmen)
          await sp.mitgliedHerausnehmen(db, mitglieder[i].zugehoerigkeit.id);
      const exp = { ...standardEinstellungen(), ...(plan.bewerbung.export ?? {}) };
      exp.auswahl = Object.fromEntries(
        Object.entries(exp.auswahl).map(([k, v]) => {
          const [i, typ] = k.split(':');
          return [`${ids[Number(i)]}:${typ}`, v];
        }),
      );
      await sp.bewerbungSpeichern(db, haushalt.id, { ...plan.bewerbung, export: exp });
      await sp.einstellungenAendern(db, {
        homescreenHinweisGezeigt: true,
        speicherAngefragt: true,
      });
      const backup = await sicherungErstellen(db, plan.passwort ?? undefined, version);
      await sicherungPruefen(backup, plan.passwort ?? undefined);
      const bytes = new Uint8Array(await backup.arrayBuffer());
      let roh = '';
      for (let i = 0; i < bytes.length; i += 0x8000)
        roh += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(roh);
    },
    { plan, version: VERSION },
  );
}

// ---------- In der gebauten App einspielen, wie ein Mensch ----------

async function einspielen(browser, basis, pfad, plan) {
  const kontext = await browser.newContext({
    baseURL: basis,
    viewport: { width: 390, height: 844 },
  });
  const page = await kontext.newPage();
  const fehler = [];
  page.on('pageerror', (e) => fehler.push(e.message));
  try {
    await page.goto('/#/einstellungen');
    await page.locator('input[type=file]').first().setInputFiles(pfad);
    await page.getByRole('heading', { level: 1, name: 'Backup einspielen' }).waitFor();
    if (plan.passwort) {
      await page.getByLabel('Passwort des Backups').fill(plan.passwort);
      await page.getByLabel('Passwort des Backups').press('Enter');
      await page.getByText(/Erstellt am /).waitFor({ timeout: 60_000 });
    }
    await page.getByRole('button', { name: 'Einspielen' }).click();
    const meldung = page.getByText(/^Eingespielt: /);
    await meldung.waitFor({ timeout: 120_000 });
    const eingespielt = (await meldung.textContent())?.trim();
    // Die Übersicht: „Hallo Max.“, oder „Alles beisammen.“, wenn nichts mehr fehlt.
    await page.getByRole('heading', { level: 1, name: /^Hallo |^Alles beisammen/ }).waitFor();
    const hallo = (await page.getByRole('heading', { level: 1 }).textContent())?.trim();
    await page.screenshot({ path: join(ZIEL, 'bilder', `${plan.id}.png`) });
    await page.goto('/#/mappe');
    const umfang = page.getByText(/^\d+ Seiten?( aus \d+ Dateien)?$|^\d+ Dateien$/).first();
    await umfang.waitFor({ timeout: 120_000 });
    return { eingespielt, hallo, mappe: (await umfang.textContent())?.trim(), fehler };
  } catch (e) {
    await page.screenshot({ path: join(ZIEL, `fehler-${plan.id}.png`) });
    const h1 = await page.locator('h1').allTextContents();
    return { problem: String(e).split('\n')[0], h1, url: page.url(), fehler };
  } finally {
    await kontext.close();
  }
}

// ---------- Ablauf ----------

mkdirSync(ZIEL, { recursive: true });
const liste = await aufloesen(await plaene());
const dev = await createServer({ server: { port: 4196, strictPort: true }, logLevel: 'error' });
await dev.listen();
const vorschau = await preview({ preview: { port: 4197, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch();
const ergebnisse = [];
try {
  const seite = await browser.newPage();
  await seite.goto('http://localhost:4196/robots.txt');
  // Erster Abruf: Vite bereitet die Abhängigkeiten vor, danach sind die Module stabil.
  await seite.evaluate(() => import('/src/storage/sicherung.ts')).catch(() => {});
  await seite.waitForTimeout(1500);
  await seite.goto('http://localhost:4196/robots.txt');
  for (const plan of liste) {
    const b64 = await erzeugen(seite, plan);
    const pfad = join(ZIEL, `Hefta-Test-${plan.id}.hefta`);
    writeFileSync(pfad, Buffer.from(b64, 'base64'));
    const probe = await einspielen(browser, 'http://localhost:4197', pfad, plan);
    const mb = (Buffer.byteLength(b64, 'base64') / 1048576).toFixed(1);
    ergebnisse.push({ datei: pfad, mb, passwort: plan.passwort, titel: plan.titel, ...probe });
    console.log(JSON.stringify(ergebnisse.at(-1)));
  }
} finally {
  await browser.close();
  await dev.close();
  await vorschau.close();
}
writeFileSync(join(ZIEL, 'ergebnis.json'), JSON.stringify(ergebnisse, null, 2));
