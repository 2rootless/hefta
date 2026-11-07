// Muster-Mappen für das Design (Aufgabe 44, 6.11.2026): gebaut mit dem echten Mappenbau der App
// (`mappeErstellen`, mit Lesehilfe), aus dem Haushalt von Test-Backup 2. Dazu eine fremde PDF ohne
// Lesehilfe, wie sie Bewerber ohne Hefta schicken. Alles erfunden, jede Seite trägt „MUSTER“.
//
//   npm run build && npm run test:backups   (einmal, für Test-Backup 2)
//   node scripts/muster-mappen.mjs          → design-sync/muster-mappen/

import { PDFDocument, StandardFonts, rgb } from '@cantoo/pdf-lib';
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createServer } from 'vite';

const ZIEL = 'design-sync/muster-mappen';
const BACKUP = 'design-sync/test-backups/Hefta-Test-2-familie-buergin-mit-passwort.hefta';
const PASSWORT = 'Hefta-Test-2';
// Fest statt zufällig: So tragen alle Muster-Mappen bei jedem Lauf dieselbe Kennung der Bewerbung, die
// der ersten Lieferung vom 6.11.2026. Es sind Fassungen derselben Bewerbung (Z9).
const KENNUNG = 'd2e0f734-0b59-41ea-95f4-c9715acbe034';

// Auswahl je Vorname; im Browser wird daraus die ID der Person.
const FAELLE = [
  {
    datei: '1-Mustermann.pdf',
    titel: 'Max und Lea, ein Kind, Petra bürgt. „Marktüblich“, Schritt „Ich will die Wohnung“',
    e: {},
  },
  {
    datei: '2-Mustermann-ohne-Kopfzeile.pdf',
    titel: 'Dieselbe Mappe ohne Kopf- und Fußzeile',
    e: { fusszeile: false },
  },
  {
    datei: '3-Mustermann-mit-Ausweis-und-Datenkopie.pdf',
    titel: '„Eigene Auswahl“: dazu Ausweiskopie und SCHUFA-Datenkopie von Max',
    e: {
      modus: 'eigene_auswahl',
      auswahl: { 'Max:ausweiskopie': true, 'Max:schufa_datenkopie': true },
    },
  },
  {
    datei: '4-Mustermann-datensparsam-Besichtigung.pdf',
    titel: '„Datensparsam“, Schritt „Besichtigung“',
    e: { modus: 'datensparsam', schritt: 'besichtigung' },
  },
  {
    // Aufgabe 47: Die Lesehilfe trägt dann `loeschwunsch`, die Vermieterseite zeigt „Bitte der Bewerber“.
    datei: '6-Mustermann-mit-Bitte-zum-Loeschen.pdf',
    titel: '„Marktüblich“ mit der Bitte zum Löschen auf dem Deckblatt',
    e: { bitte: true },
  },
];

// ---------- Im Browser: Backup einspielen, Mappen bauen, Scans zeichnen ----------

async function mappenBauen(page) {
  return page.evaluate(
    async ({ b64, passwort, faelle, kennung }) => {
      const { datenbankOeffnen } = await import('/src/storage/db.ts');
      const sp = await import('/src/storage/speicher.ts');
      const { sicherungEinspielen } = await import('/src/storage/sicherung.ts');
      const { standardEinstellungen } = await import('/src/domain/export.ts');
      const { mappeErstellen } = await import('/src/ui/mappeErstellen.ts');
      const { AUSSEHEN_STANDARD } = await import('/src/domain/modell.ts');
      const { wohnungsSchluessel } = await import('/src/domain/adresse.ts');
      const roh = atob(b64);
      const bytes = new Uint8Array(roh.length);
      for (let i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
      const db = await datenbankOeffnen(`muster-mappen-${Date.now()}`);
      await sicherungEinspielen(db, new Blob([bytes]), passwort);
      const ansicht = await sp.haushaltLaden(db);
      const geladen = await sp.bewerbungLaden(db, ansicht.haushalt.id);
      const bewerbung = await sp.bewerbungAendern(db, geladen.id, {
        kennungen: { ...geladen.kennungen, [wohnungsSchluessel(geladen.adresse)]: kennung },
      });
      const id = Object.fromEntries(ansicht.mitglieder.map((m) => [m.person.vorname, m.person.id]));
      const aus = [];
      for (const fall of faelle) {
        const auswahl = Object.fromEntries(
          Object.entries(fall.e.auswahl ?? {}).map(([k, v]) => {
            const [vorname, typ] = k.split(':');
            return [`${id[vorname]}:${typ}`, v];
          }),
        );
        const e = { ...standardEinstellungen(), ...fall.e, auswahl };
        // Fester Tag, damit die Mappen bei jedem Lauf gleich datiert sind.
        const erg = await mappeErstellen(
          db,
          ansicht,
          bewerbung,
          e,
          new Date(2026, 10, 6, 12),
          AUSSEHEN_STANDARD,
        );
        const daten = new Uint8Array(await erg.dateien[0].arrayBuffer());
        let s = '';
        for (let i = 0; i < daten.length; i += 0x8000)
          s += String.fromCharCode(...daten.subarray(i, i + 0x8000));
        aus.push({ seiten: erg.seiten, b64: btoa(s), unlesbar: erg.unlesbar.length });
      }
      return aus;
    },
    {
      b64: readFileSync(BACKUP).toString('base64'),
      passwort: PASSWORT,
      faelle: FAELLE,
      kennung: KENNUNG,
    },
  );
}

/** Ein Scan wie vom Flachbett oder Handy: graues Papier, leicht schief, Rauschen, ohne Textschicht. */
async function scans(page, liste) {
  return page.evaluate(async (liste) => {
    const aus = [];
    for (const s of liste) {
      const c = document.createElement('canvas');
      c.width = s.breite;
      c.height = s.hoehe;
      const g = c.getContext('2d');
      g.fillStyle = s.foto ? '#8a8378' : '#ffffff';
      g.fillRect(0, 0, c.width, c.height);
      g.save();
      g.translate(c.width / 2, c.height / 2);
      g.rotate((s.schief * Math.PI) / 180);
      const b = c.width * (s.foto ? 0.84 : 0.97);
      const h = c.height * (s.foto ? 0.86 : 0.97);
      g.fillStyle = s.papier;
      g.fillRect(-b / 2, -h / 2, b, h);
      g.fillStyle = '#a31a1a';
      g.font = `${Math.round(b / 50)}px sans-serif`;
      g.fillText('MUSTER - Testdaten, nicht echt', -b / 2 + b * 0.07, -h / 2 + h * 0.05);
      g.fillStyle = '#23242a';
      g.font = `bold ${Math.round(b / 30)}px sans-serif`;
      g.fillText(s.kopf, -b / 2 + b * 0.07, -h / 2 + h * 0.1);
      g.font = `${Math.round(b / 42)}px sans-serif`;
      s.zeilen.forEach((z, i) =>
        g.fillText(z, -b / 2 + b * 0.07, -h / 2 + h * 0.16 + i * (b / 26)),
      );
      g.restore();
      const bild = g.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < bild.data.length; i += 4) {
        const r = (Math.random() - 0.5) * (s.foto ? 26 : 14);
        bild.data[i] += r;
        bild.data[i + 1] += r;
        bild.data[i + 2] += r;
      }
      g.putImageData(bild, 0, 0);
      aus.push(c.toDataURL('image/jpeg', 0.72).split(',')[1]);
    }
    return aus;
  }, liste);
}

// ---------- Die fremde PDF ohne Lesehilfe ----------

const A4 = [595.28, 841.89];
const scan = (kopf, zeilen, mehr = {}) => ({
  breite: 1240,
  hoehe: 1754,
  schief: 0.6,
  papier: '#f4f1ea',
  kopf,
  zeilen,
  ...mehr,
});

async function fremdeMappe(page) {
  const liste = [
    scan(
      'Personalausweis',
      ['Vorderseite und Rückseite', 'Name: BECKER, Jonas', 'Nur als Muster'],
      {
        breite: 1754,
        hoehe: 1240,
        schief: -1.2,
      },
    ),
    scan(
      'Gehaltsabrechnung Oktober 2026',
      ['Sara Klein', 'Praxis am Park', 'Auszahlung 2.310,00 EUR'],
      {
        breite: 1200,
        hoehe: 1600,
        schief: 2.5,
        foto: true,
      },
    ),
    scan('Kontoauszug 9/2026', [
      'Konto Jonas Becker',
      'Miete 980,00',
      'Gehalt 2.640,00',
      'Strom 62,00',
    ]),
    scan('Kontoauszug 10/2026', [
      'Konto Jonas Becker',
      'Miete 980,00',
      'Gehalt 2.640,00',
      'Handy 19,99',
    ]),
    scan(
      'Mietschuldenfreiheitsbescheinigung',
      ['Mieter: Jonas Becker', 'Keine Rückstände.', 'Bremen, 1.10.2026'],
      {
        schief: -0.9,
        papier: '#ece6d8',
      },
    ),
  ];
  const bilder = await scans(page, liste);

  const doc = await PDFDocument.create();
  doc.setTitle('Bewerbung Becker Klein');
  doc.setCreator('Scanner-App (Muster)');
  doc.setProducer('Muster');
  const f = await doc.embedFont(StandardFonts.Helvetica);
  const fett = await doc.embedFont(StandardFonts.HelveticaBold);
  const textSeite = (kopf, zeilen, groesse = A4) => {
    const s = doc.addPage(groesse);
    const oben = groesse[1] - 40;
    s.drawText('MUSTER - Testdaten, nicht echt', {
      x: 56,
      y: oben,
      size: 8,
      font: f,
      color: rgb(0.64, 0.1, 0.1),
    });
    s.drawText(kopf, { x: 56, y: oben - 40, size: 15, font: fett });
    zeilen.forEach((z, i) => s.drawText(z, { x: 56, y: oben - 80 - i * 17, size: 10.5, font: f }));
  };
  const bildSeite = async (b64, groesse) => {
    const bild = await doc.embedJpg(Buffer.from(b64, 'base64'));
    const s = doc.addPage(groesse);
    s.drawImage(bild, { x: 0, y: 0, width: groesse[0], height: groesse[1] });
  };

  textSeite('Bewerbung um die Wohnung Hauptstraße 12', [
    'Sehr geehrte Damen und Herren,',
    '',
    'wir bewerben uns um die Wohnung in der Hauptstraße 12, 3. OG links.',
    'Wir sind Jonas Becker (Mechatroniker) und Sara Klein (Physiotherapeutin)',
    'und suchen eine Wohnung näher an unseren Arbeitsstellen.',
    '',
    'Anbei finden Sie unsere Unterlagen:',
    '- Mieterselbstauskunft',
    '- Personalausweis',
    '- Gehaltsabrechnungen',
    '- Bonitätsauskunft',
    '- Kontoauszüge',
    '- Mietschuldenfreiheitsbescheinigung',
    '- Arbeitsvertrag',
    '',
    'Mit freundlichen Grüßen',
    'Jonas Becker und Sara Klein',
    'Telefon 0151 2345678',
  ]);
  textSeite('Mieterselbstauskunft', [
    'Mietinteressent 1: Jonas Becker, geb. 12.04.1993',
    'Mietinteressent 2: Sara Klein, geb. 03.09.1995',
    'Derzeitige Anschrift: Am Deich 7, 28199 Bremen',
    'Arbeitgeber 1: Nordtechnik GmbH, seit 2019',
    'Arbeitgeber 2: Praxis am Park, seit 2022',
    'Nettoeinkommen gesamt: 4.950 EUR',
    'Haustiere: nein',
    'Insolvenzverfahren in den letzten 5 Jahren: nein',
    'Räumungstitel: nein',
    '',
    'Bremen, 2.11.2026         Unterschrift: J. Becker   S. Klein',
  ]);
  await bildSeite(bilder[0], [A4[1], A4[0]]);
  for (const m of ['August', 'September', 'Oktober'])
    textSeite(`Verdienstabrechnung ${m} 2026`, [
      'Nordtechnik GmbH',
      'Mitarbeiter: Jonas Becker',
      'Gesamtbrutto 3.720,00 EUR',
      'Lohnsteuer 451,20 EUR',
      'Sozialversicherung 628,80 EUR',
      'Auszahlungsbetrag 2.640,00 EUR',
    ]);
  textSeite('Bonitätsauskunft für Vermieter', [
    'Auskunftei (Muster)',
    'Für: Jonas Becker',
    'Erstellt am 28.10.2026',
    'Prüfcode: MUSTER-8Z1-Q4P',
    'Keine Negativmerkmale gespeichert.',
  ]);
  await bildSeite(bilder[1], [576, 768]);
  await bildSeite(bilder[2], A4);
  await bildSeite(bilder[3], A4);
  await bildSeite(bilder[4], A4);
  for (const n of [1, 2, 3])
    textSeite(`Arbeitsvertrag, Seite ${n} von 3`, [
      'zwischen Nordtechnik GmbH und Jonas Becker',
      `§ ${n * 3 - 2} ...`,
      `§ ${n * 3 - 1} ...`,
      `§ ${n * 3} ...`,
    ]);
  return doc.save();
}

// ---------- Nachsehen: Seiten, Lesehilfe, Textschicht ----------

async function nachsehen(bytes) {
  const aufgabe = pdfjs.getDocument({ data: new Uint8Array(bytes), verbosity: 0 });
  const dok = await aufgabe.promise;
  // Wie die Vermieter-Seite (src/vermieter/lesen.ts): PDF.js 6 liefert eine Map, den Inhalt einzeln.
  const anhaenge = await dok.getAttachments();
  const treffer = anhaenge && [...anhaenge.entries()].find(([, a]) => a.filename === 'hefta.json');
  const inhalt = treffer ? await dok.getAttachmentContent(treffer[0]) : null;
  const lesehilfe = inhalt ? JSON.parse(new TextDecoder().decode(inhalt)) : null;
  const mitText = [];
  const texte = [];
  for (let n = 1; n <= dok.numPages; n++) {
    const seite = await dok.getPage(n);
    const t = (await seite.getTextContent()).items.map((i) => i.str ?? '').join(' ');
    texte.push(t);
    // Eine Seite zählt als „mit Text“, wenn mehr als die Kopfzeile darauf lesbar ist.
    if (t.replace(/\s+/g, ' ').trim().length > 120) mitText.push(n);
  }
  await aufgabe.destroy();
  return { seiten: texte.length, lesehilfe, mitText, texte };
}

// ---------- Ablauf ----------

mkdirSync(ZIEL, { recursive: true });
const dev = await createServer({ server: { port: 4198, strictPort: true }, logLevel: 'error' });
await dev.listen();
const browser = await chromium.launch();
const bericht = [];
try {
  const page = await browser.newPage();
  await page.goto('http://localhost:4198/robots.txt');
  // Erster Abruf: Vite bereitet die Abhängigkeiten vor, danach sind die Module stabil.
  await page.evaluate(() => import('/src/ui/mappeErstellen.ts')).catch(() => {});
  await page.waitForTimeout(1500);
  await page.goto('http://localhost:4198/robots.txt');
  const mappen = await mappenBauen(page);
  for (const [i, fall] of FAELLE.entries()) {
    const bytes = Buffer.from(mappen[i].b64, 'base64');
    writeFileSync(join(ZIEL, fall.datei), bytes);
    const n = await nachsehen(bytes);
    bericht.push({
      datei: fall.datei,
      titel: fall.titel,
      kb: Math.round(bytes.length / 1024),
      unlesbar: mappen[i].unlesbar,
      ...n,
    });
  }
  const fremd = await fremdeMappe(page);
  const fdatei = '5-Fremd-ohne-Lesehilfe-14-Seiten.pdf';
  writeFileSync(join(ZIEL, fdatei), fremd);
  bericht.push({
    datei: fdatei,
    titel:
      'Fremde PDF ohne Lesehilfe: Jonas Becker und Sara Klein, Scans und Textseiten gemischt, eine Seite quer, ein Handyfoto',
    kb: Math.round(fremd.length / 1024),
    ...(await nachsehen(fremd)),
  });
} finally {
  await browser.close();
  await dev.close();
}

const rolle = (b) =>
  b.lesehilfe?.haushalt.personen.map((p) => `${p.name} (${p.rolle})`).join(', ') ?? '–';
const zeilen = bericht.map(
  (b) =>
    `| ${b.datei} | ${b.titel} | ${b.seiten} | ${b.kb} KB | ${b.lesehilfe ? `Fassung ${b.lesehilfe.hefta}, ${b.lesehilfe.modus}, ${b.lesehilfe.schritt ?? '–'}` : 'keine'} | ${b.mitText.length} von ${b.seiten} |`,
);
writeFileSync(
  join(ZIEL, 'LIESMICH.md'),
  [
    '# Muster-Mappen für das Design (Aufgabe 44)',
    '',
    'Gebaut am 6. November 2026 mit dem echten Mappenbau der App, aus Test-Backup 2. Alle Personen und Unterlagen sind erfunden.',
    '',
    '| Datei | Was | Seiten | Größe | Lesehilfe | Seiten mit Textschicht |',
    '| --- | --- | --- | --- | --- | --- |',
    ...zeilen,
    '',
    `Personen in der Lesehilfe: ${rolle(bericht[0])}. Die Kennung der Bewerbung ist in allen Mappen aus Hefta dieselbe, bei jedem Lauf (\`${bericht[0].lesehilfe?.bewerbung.kennung}\`): Es sind Fassungen derselben Bewerbung.`,
    '',
  ].join('\n'),
);
writeFileSync(
  join(ZIEL, 'bericht.json'),
  JSON.stringify(
    bericht.map(({ texte, ...b }) => ({ ...b, ersteSeite: texte[0].slice(0, 300) })),
    null,
    2,
  ),
);
for (const b of bericht)
  console.log(
    b.datei,
    b.seiten,
    `${b.kb} KB`,
    b.lesehilfe ? `hefta ${b.lesehilfe.hefta} ${b.lesehilfe.modus} ${b.lesehilfe.schritt}` : 'ohne',
    'Text:',
    b.mitText.join(','),
  );
