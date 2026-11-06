import { FAKTEN_STAND } from '../../src/domain/pruefhinweise';

// Szenarien aus design/pruefkatalog.md als Testdaten. Jede Unterlage bekommt einen Zustand;
// daraus entstehen Versionen mit passenden Daten relativ zum festen Testtag HEUTE.
// Die Unterlagen folgen dem Regelkatalog (nicht den Entwurfs-Symbolen).

export const HEUTE = new Date(2026, 10, 6, 10, 0); // 6. November 2026

// „alt“: zu alt (Warnstufe, zählt wie fehlt), „bald2“: läuft bald ab, „Noch nicht“ diesen Monat schon einmal.
type Zustand = 'da' | 'bald' | 'fehlt' | 'alt' | 'bald2' | 'ohneDatum' | 'daMitAlt' | 'baldMitAlt';
type Lage =
  'angestellt' | 'selbststaendig' | 'studierend_azubi' | 'rente' | 'leistungsbezug' | 'sonstiges';

interface SzenarioPerson {
  vorname: string;
  nachname?: string;
  rufname?: string;
  bezeichnung: 'maennlich' | 'weiblich' | 'neutral';
  rolle: 'hauptmieter' | 'mitmieter' | 'buerge';
  lage: Lage;
  /** Zustand je Dokumenttyp (Regelkatalog-ID); nicht genannte übliche Unterlagen fehlen. */
  unterlagen: Record<string, Zustand>;
  /** Aus dem Haushalt genommen am (ISO-Zeit); bleibt mit Unterlagen gespeichert. */
  raus?: string;
  /** Weitere Angaben der Person, etwa Beruf oder Arbeitgeber. */
  angaben?: Record<string, unknown>;
}

export interface Szenario {
  id: string;
  kinder?: number;
  weitere?: number;
  personen: SzenarioPerson[];
  /** Pausierter Rutsch: Posten als [Personenindex, Typ], aktueller Index, Ergebnisse davor. */
  rutsch?: { posten: [number, string][]; index: number; erledigt: number };
  /** Letztes Backup (Standard: drei Tage vor HEUTE). */
  letztesBackup?: Date;
}

const alleDa = (lage: Lage, rolle: SzenarioPerson['rolle']): Record<string, Zustand> => {
  const einkommen: Record<Lage, string> = {
    angestellt: 'gehaltsnachweis',
    selbststaendig: 'einkommen_selbststaendig',
    studierend_azubi: 'einkommen_ausbildung',
    rente: 'rentenbescheid',
    leistungsbezug: 'mietuebernahme_amt',
    sonstiges: 'einkommen_sonstig',
  };
  return {
    ...(rolle === 'buerge' ? { buergschaftserklaerung: 'da' as const } : {}),
    selbstauskunft: 'da',
    [einkommen[lage]]: 'da',
    bonitaet: 'da',
  };
};

const max = (u: Record<string, Zustand>): SzenarioPerson => ({
  vorname: 'Max',
  nachname: 'Mustermann',
  bezeichnung: 'maennlich',
  rolle: 'hauptmieter',
  lage: 'angestellt',
  unterlagen: u,
});
const MAX_BALD = max({ selbstauskunft: 'da', gehaltsnachweis: 'bald', bonitaet: 'da' });
const LEA_DA: SzenarioPerson = {
  vorname: 'Lea',
  nachname: 'Mustermann',
  bezeichnung: 'weiblich',
  rolle: 'mitmieter',
  lage: 'angestellt',
  unterlagen: { ...alleDa('angestellt', 'mitmieter'), mietzahlung: 'da' },
};
const petra = (u: Record<string, Zustand>): SzenarioPerson => ({
  vorname: 'Petra',
  nachname: 'Mustermann',
  bezeichnung: 'weiblich',
  rolle: 'buerge',
  lage: 'angestellt',
  unterlagen: u,
});
const PETRA_FEHLT = petra({
  buergschaftserklaerung: 'da',
  selbstauskunft: 'da',
  gehaltsnachweis: 'da',
  bonitaet: 'fehlt',
});
const PETRA_DA = petra(alleDa('angestellt', 'buerge'));
const jonas = (u: Record<string, Zustand>, lage: Lage = 'angestellt'): SzenarioPerson => ({
  vorname: 'Jonas',
  nachname: 'Beispiel',
  bezeichnung: 'maennlich',
  rolle: 'mitmieter',
  lage,
  unterlagen: u,
});

export const SZENARIEN: Szenario[] = [
  { id: '01-standard', kinder: 1, personen: [MAX_BALD, LEA_DA, PETRA_FEHLT] },
  {
    id: '02-neustart',
    kinder: 1,
    personen: [max({}), { ...LEA_DA, unterlagen: {} }, petra({})],
  },
  {
    id: '03-mehrere-offen',
    personen: [
      max({ selbstauskunft: 'da', gehaltsnachweis: 'fehlt', bonitaet: 'fehlt' }),
      { ...LEA_DA, unterlagen: {} },
    ],
  },
  {
    id: '04-fertig',
    kinder: 1,
    personen: [max(alleDa('angestellt', 'hauptmieter')), LEA_DA, PETRA_DA],
  },
  {
    id: '05-nur-buerge-offen',
    personen: [
      max(alleDa('angestellt', 'hauptmieter')),
      LEA_DA,
      petra({ buergschaftserklaerung: 'da' }),
    ],
  },
  {
    // PF1: Alle sechs Farben sind vergeben, die Wahl bleibt trotzdem sichtbar.
    id: '27-sechs-personen',
    personen: [
      MAX_BALD,
      LEA_DA,
      jonas({ selbstauskunft: 'da', bonitaet: 'da' }),
      { ...LEA_DA, vorname: 'Sina', nachname: 'Beispiel' },
      { ...LEA_DA, vorname: 'Tom', nachname: 'Beispiel', bezeichnung: 'maennlich' },
      PETRA_FEHLT,
    ],
  },
  {
    id: '06-drei-erwachsene',
    kinder: 2,
    weitere: 1,
    personen: [MAX_BALD, LEA_DA, jonas({ selbstauskunft: 'da', bonitaet: 'da' }), PETRA_FEHLT],
  },
  {
    id: '07-vier-erwachsene',
    personen: [
      MAX_BALD,
      LEA_DA,
      jonas({ selbstauskunft: 'da', bonitaet: 'da' }),
      {
        vorname: 'Mira',
        nachname: 'Beispiel',
        bezeichnung: 'weiblich',
        rolle: 'mitmieter',
        lage: 'angestellt',
        unterlagen: alleDa('angestellt', 'mitmieter'),
      },
    ],
  },
  {
    id: '08-zwei-buergen',
    personen: [
      MAX_BALD,
      LEA_DA,
      PETRA_FEHLT,
      {
        vorname: 'Karl',
        nachname: 'Mustermann',
        bezeichnung: 'maennlich',
        rolle: 'buerge',
        lage: 'rente',
        unterlagen: {
          buergschaftserklaerung: 'da',
          selbstauskunft: 'da',
          rentenbescheid: 'bald',
          bonitaet: 'da',
        },
      },
    ],
  },
  {
    id: '09-lebenslagen',
    personen: [
      {
        ...max({
          selbstauskunft: 'da',
          einkommen_selbststaendig: 'fehlt',
          bonitaet: 'da',
          mietzahlung: 'da',
          empfehlung_vorvermieter: 'da',
        }),
        lage: 'selbststaendig',
      },
      { ...LEA_DA, lage: 'studierend_azubi', unterlagen: { selbstauskunft: 'da', bonitaet: 'da' } },
      jonas({ selbstauskunft: 'da', bonitaet: 'da' }, 'leistungsbezug'),
    ],
  },
  {
    id: '10-lange-namen',
    personen: [
      {
        vorname: 'Maximilian-Alexander',
        nachname: 'Mustermann',
        bezeichnung: 'neutral',
        rolle: 'hauptmieter',
        lage: 'angestellt',
        unterlagen: { selbstauskunft: 'da', gehaltsnachweis: 'bald', bonitaet: 'da' },
      },
      {
        vorname: 'Bartholomäus',
        nachname: 'Mustermann',
        bezeichnung: 'neutral',
        rolle: 'mitmieter',
        lage: 'angestellt',
        unterlagen: alleDa('angestellt', 'mitmieter'),
      },
      {
        vorname: 'Anna-Katharina Josephine',
        nachname: 'von Hohenstein',
        bezeichnung: 'neutral',
        rolle: 'buerge',
        lage: 'angestellt',
        unterlagen: {
          buergschaftserklaerung: 'da',
          selbstauskunft: 'da',
          gehaltsnachweis: 'da',
          bonitaet: 'fehlt',
        },
      },
    ],
  },
  { id: '11-allein', personen: [max({ gehaltsnachweis: 'bald' })] },
  {
    // Viele Unterlagen auf einem kurzen Abschnitt: Im Band überlappt nichts.
    id: '21-viele-unterlagen',
    personen: [
      max({
        selbstauskunft: 'da',
        gehaltsnachweis: 'fehlt',
        bonitaet: 'fehlt',
        mietzahlung: 'alt',
        empfehlung_vorvermieter: 'alt',
        ausweiskopie: 'da',
        schufa_datenkopie: 'da',
      }),
      {
        ...LEA_DA,
        unterlagen: {
          ...LEA_DA.unterlagen,
          mietzahlung: 'da',
          empfehlung_vorvermieter: 'da',
          ausweiskopie: 'da',
          schufa_datenkopie: 'da',
        },
      },
    ],
  },
  {
    id: '12-allein-buerge',
    personen: [
      {
        vorname: 'Lea',
        nachname: 'Mustermann',
        bezeichnung: 'weiblich',
        rolle: 'hauptmieter',
        lage: 'angestellt',
        unterlagen: alleDa('angestellt', 'hauptmieter'),
      },
      PETRA_FEHLT,
    ],
  },
  { id: '13-kinder-ohne-buerge', kinder: 3, personen: [MAX_BALD, LEA_DA] },
  {
    // Wie 03-mehrere-offen, nach zwei erledigten Schritten pausiert (Abgleich Design 31.10.).
    id: '14-pausiert',
    personen: [
      max({ selbstauskunft: 'da', gehaltsnachweis: 'da', bonitaet: 'da' }),
      { ...LEA_DA, unterlagen: {} },
    ],
    rutsch: {
      posten: [
        [0, 'gehaltsnachweis'],
        [0, 'bonitaet'],
        [1, 'selbstauskunft'],
        [1, 'gehaltsnachweis'],
        [1, 'bonitaet'],
      ],
      index: 2,
      erledigt: 2,
    },
  },
  {
    // Selbstauskunft im Rutsch, zweite Person (A2): Max hat die Haushaltsangaben schon eingetragen.
    id: '16-auskunft-lea',
    kinder: 1,
    personen: [max(alleDa('angestellt', 'hauptmieter')), { ...LEA_DA, unterlagen: {} }],
  },
  {
    // Person und Haushalt (K, E3d): Jonas ist herausgenommen und bringt vier Unterlagen mit.
    id: '15-herausgenommen',
    kinder: 1,
    personen: [
      MAX_BALD,
      LEA_DA,
      PETRA_FEHLT,
      {
        ...jonas({
          selbstauskunft: 'da',
          gehaltsnachweis: 'da',
          bonitaet: 'bald',
          mietzahlung: 'da',
        }),
        nachname: 'Becker',
        raus: '2026-10-12T10:00:00.000Z',
      },
    ],
  },
  {
    // Übersicht und Alles löschen mit altem Backup (U15, S2, S9): 34 Tage her, seitdem Neues.
    id: '17-backup-alt',
    kinder: 1,
    personen: [MAX_BALD, LEA_DA, PETRA_FEHLT],
    letztesBackup: new Date(2026, 9, 3),
  },
  {
    // Zeit vergeht (Z1–Z3): neuer Monat, bald zu alt, zu alt; Lea hat schon einmal gewartet.
    id: '18-zeit',
    kinder: 1,
    personen: [
      max({ selbstauskunft: 'da', gehaltsnachweis: 'bald', bonitaet: 'bald' }),
      { ...LEA_DA, unterlagen: { selbstauskunft: 'da', gehaltsnachweis: 'bald2', bonitaet: 'da' } },
      { ...PETRA_FEHLT, unterlagen: { ...PETRA_FEHLT.unterlagen, bonitaet: 'alt' } },
    ],
  },
  {
    // Rutsch-Ende, während des Rutschs neu fällig geworden (Z4): Max' Gehalt fehlt in der Liste.
    id: '19-neu-faellig',
    kinder: 1,
    personen: [
      max({ selbstauskunft: 'da', gehaltsnachweis: 'bald', bonitaet: 'da' }),
      { ...LEA_DA, unterlagen: { selbstauskunft: 'da', gehaltsnachweis: 'da' } },
    ],
    rutsch: {
      posten: [
        [0, 'bonitaet'],
        [1, 'bonitaet'],
      ],
      index: 1,
      erledigt: 1,
    },
  },
  {
    // R3d: Die Runde war pausiert, ihre Unterlagen sind inzwischen da. Bei Lea fehlt noch etwas,
    // sonst ginge es direkt zur fertigen Übersicht.
    id: '22-alles-schon-da',
    personen: [
      max({ selbstauskunft: 'da', gehaltsnachweis: 'da', bonitaet: 'da' }),
      { ...LEA_DA, unterlagen: {} },
    ],
    rutsch: {
      posten: [
        [0, 'gehaltsnachweis'],
        [0, 'bonitaet'],
      ],
      index: 1,
      erledigt: 0,
    },
  },
  {
    // Datum freiwillig: Die Personenansicht sagt, dass Hefta hier nicht erinnern kann.
    id: '23-ohne-datum',
    personen: [max({ selbstauskunft: 'da', gehaltsnachweis: 'da', bonitaet: 'ohneDatum' })],
  },
  {
    // K8: Name in einer anderen Schrift, noch ohne lateinische Schreibweise (ältere Daten, Backup).
    id: '24-name-ohne-latein',
    personen: [
      max({ selbstauskunft: 'da', gehaltsnachweis: 'da', bonitaet: 'da' }),
      {
        vorname: 'Олена',
        nachname: 'Коваленко',
        bezeichnung: 'weiblich',
        rolle: 'mitmieter',
        lage: 'angestellt',
        unterlagen: { selbstauskunft: 'da', gehaltsnachweis: 'da', bonitaet: 'da' },
      },
    ],
  },
  {
    // Freitext, den das PDF nicht schreiben kann: Hefta nennt das Feld und führt hin.
    id: '26-fremde-zeichen',
    personen: [
      {
        ...max({ selbstauskunft: 'da', gehaltsnachweis: 'da', bonitaet: 'da' }),
        angaben: { arbeitgeber: 'ООО Ромашка' },
      },
    ],
  },
  {
    // Seite einer Unterlage (UL1, UL2, UL5, UL6), Warum-Blatt, Rollentausch (HA1).
    id: '25-unterlage-seiten',
    kinder: 1,
    personen: [
      max({
        selbstauskunft: 'da',
        gehaltsnachweis: 'baldMitAlt',
        bonitaet: 'daMitAlt',
        mietzahlung: 'da',
        ausweiskopie: 'da',
      }),
      { ...LEA_DA },
      {
        ...PETRA_FEHLT,
        unterlagen: { selbstauskunft: 'da', buergschaftserklaerung: 'da', bonitaet: 'alt' },
      },
    ],
  },
  {
    // E3d: Jonas ist seit über drei Monaten herausgenommen, die einmalige Frage erscheint.
    id: '20-lange-raus',
    kinder: 1,
    personen: [
      MAX_BALD,
      LEA_DA,
      {
        ...jonas({ selbstauskunft: 'da', gehaltsnachweis: 'da', bonitaet: 'alt' }),
        nachname: 'Becker',
        raus: '2026-07-20T10:00:00.000Z',
      },
    ],
  },
];

// ---------- Datensätze ----------

const ZEIT = HEUTE.toISOString();
const tag = (j: number, m: number, d: number) =>
  `${j}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Versionen für einen Zustand, passend zu den Fristen im Regelkatalog bei HEUTE = 6.11.2026. */
function versionen(
  typ: string,
  zustand: Zustand,
): { ausstellungsdatum: string | null; abrechnungsmonat: string | null }[] {
  if (zustand === 'fehlt') return [];
  if (zustand === 'ohneDatum') return [{ ausstellungsdatum: null, abrechnungsmonat: null }];
  if (zustand === 'alt')
    return typ === 'gehaltsnachweis'
      ? ['2026-04', '2026-05', '2026-06'].map((m) => ({
          ausstellungsdatum: null,
          abrechnungsmonat: m,
        }))
      : [{ ausstellungsdatum: tag(2026, 7, 12), abrechnungsmonat: null }];
  if (zustand === 'bald2') return versionen(typ, 'bald');
  if (zustand === 'daMitAlt')
    return [
      { ausstellungsdatum: tag(2026, 7, 12), abrechnungsmonat: null },
      { ausstellungsdatum: tag(2026, 10, 20), abrechnungsmonat: null },
    ];
  if (zustand === 'baldMitAlt')
    return ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map((m) => ({
      ausstellungsdatum: null,
      abrechnungsmonat: m,
    }));
  if (typ === 'gehaltsnachweis') {
    // da: Juli–September (Oktober erst ab 28.11. fällig); bald: Juni–August (September seit 28.10. fällig)
    const monate =
      zustand === 'da' ? ['2026-07', '2026-08', '2026-09'] : ['2026-06', '2026-07', '2026-08'];
    return monate.map((m) => ({ ausstellungsdatum: null, abrechnungsmonat: m }));
  }
  if (typ === 'bonitaet')
    return [
      {
        ausstellungsdatum: zustand === 'da' ? tag(2026, 10, 20) : tag(2026, 8, 25),
        abrechnungsmonat: null,
      },
    ];
  return [
    {
      ausstellungsdatum: zustand === 'da' ? tag(2026, 10, 1) : tag(2025, 9, 1),
      abrechnungsmonat: null,
    },
  ];
}

export function datensaetze(s: Szenario) {
  const haushaltId = `h-${s.id}`;
  const personen: unknown[] = [];
  const zugehoerigkeiten: unknown[] = [];
  const dokumente: unknown[] = [];
  const versionenListe: unknown[] = [];
  s.personen.forEach((p, i) => {
    const id = `p-${s.id}-${i}`;
    personen.push({
      id,
      createdAt: ZEIT,
      updatedAt: ZEIT,
      vorname: p.vorname,
      nachname: p.nachname ?? '',
      rufname: p.rufname ?? p.vorname.split(/[\s-]/)[0],
      kontakt: { telefon: '', email: '' },
      lebenssituation: p.lage,
      beruf: '',
      arbeitgeber: '',
      nettoeinkommen: null,
      abrechnungMeist: null,
      // Selbstauskunft „da“ heißt: alle Angaben beisammen (sie entsteht in der App, nicht als Datei).
      ...(p.unterlagen.selbstauskunft === 'da'
        ? {
            kontakt: { telefon: '0170 1234567', email: '' },
            nettoeinkommen: 2800,
            selbstauskunft: {
              einkommenArt: 'betrag',
              haustiere: 'nein',
              haustiereText: '',
              insolvenz: 'nein',
              raeumungstitel: 'nein',
              mietrueckstaende: 'nein',
              stellungnahme: '',
              ort: 'Hamburg',
            },
          }
        : {}),
      ...p.angaben,
    });
    zugehoerigkeiten.push({
      id: `z-${id}`,
      createdAt: ZEIT,
      updatedAt: ZEIT,
      haushaltId,
      personId: id,
      rolle: p.rolle,
      bezeichnung: p.bezeichnung,
      farbe: (i % 6) + 1,
      reihenfolge: i,
      herausgenommenAm: p.raus ?? null,
    });
    for (const [typ, zustand] of Object.entries(p.unterlagen)) {
      const dokId = `d-${id}-${typ}`;
      dokumente.push({
        id: dokId,
        createdAt: ZEIT,
        updatedAt: ZEIT,
        personId: id,
        typ,
        notiz: '',
        serie: typ === 'gehaltsnachweis' ? 3 : null,
        stummBis: null,
        ...(zustand === 'bald2'
          ? { stummBis: tag(2026, 11, 5), stummMonat: '2026-11', stummAnzahl: 1 }
          : {}),
      });
      versionen(typ, zustand).forEach((v, j) =>
        versionenListe.push({
          id: `v-${dokId}-${j}`,
          createdAt: ZEIT,
          updatedAt: ZEIT,
          dokumentId: dokId,
          ...v,
          variante: null,
          original: `keine-datei-${versionenListe.length}`,
          aufbereitet: null,
          seiten: null,
          schwaerzungen: {},
          gerastert: false,
          erkannteWerte: { stand: FAKTEN_STAND, hash: null, seiten: [] },
          vomNutzerBestaetigt: null,
        }),
      );
    }
  });
  return {
    haushalte: [
      {
        id: haushaltId,
        createdAt: ZEIT,
        updatedAt: ZEIT,
        name: '',
        notiz: '',
        kinder: s.kinder ?? 0,
        weitereErwachsene: s.weitere ?? 0,
        // Haushaltsangaben der Selbstauskunft, sobald jemand sie ausgefüllt hat.
        ...(() => {
          const i = s.personen.findIndex(
            (p) => p.unterlagen.selbstauskunft === 'da' && p.rolle !== 'buerge',
          );
          return i < 0
            ? {}
            : {
                haustiere: 'nein',
                haustiereText: '',
                ort: 'Hamburg',
                angabenVon: `p-${s.id}-${i}`,
              };
        })(),
      },
    ],
    personen,
    zugehoerigkeiten,
    dokumente,
    versionen: versionenListe,
    einstellungen: [
      {
        id: 'app',
        updatedAt: ZEIT,
        letztesBackup: (s.letztesBackup ?? new Date(2026, 10, 3)).toISOString(),
        speicherAngefragt: true,
        homescreenHinweisGezeigt: false,
        ohnePasswortHinweisGezeigt: false,
        sprache: 'de',
        fristen: {},
        rutsch: s.rutsch
          ? {
              liste: s.rutsch.posten.map(([i, typ]) => ({ personId: `p-${s.id}-${i}`, typ })),
              index: s.rutsch.index,
              ergebnisse: Object.fromEntries(
                s.rutsch.posten
                  .slice(0, s.rutsch.erledigt)
                  .map(([i, typ]) => [`p-${s.id}-${i}:${typ}`, 'hochgeladen']),
              ),
            }
          : null,
      },
    ],
  };
}
