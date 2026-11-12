import {
  openDB,
  type DBSchema,
  type IDBPDatabase,
  type IDBPTransaction,
  type StoreNames,
} from 'idb';
import { hefteAusBewerbungen } from '../domain/hefte';
import {
  type Bewerbung,
  type DateiEintrag,
  type DateiVersion,
  type Dokument,
  type Einstellungen,
  type Exportprofil,
  type Haushalt,
  type Heft,
  type Person,
  type Zugehoerigkeit,
} from '../domain/modell';

// IndexedDB von Hefta. Die Versionsnummer der Datenbank ist die Schema-Version.
// Jede Änderung am Schema kommt als neue Migration ans Ende der Liste, mit Test.
// Migrationen löschen nie Nutzerdaten ohne Rückfrage (CLAUDE.md).

export interface HeftaSchema extends DBSchema {
  personen: { key: string; value: Person };
  haushalte: { key: string; value: Haushalt };
  zugehoerigkeiten: {
    key: string;
    value: Zugehoerigkeit;
    indexes: { haushaltId: string; personId: string };
  };
  dokumente: { key: string; value: Dokument; indexes: { personId: string } };
  versionen: { key: string; value: DateiVersion; indexes: { dokumentId: string } };
  bewerbungen: { key: string; value: Bewerbung; indexes: { haushaltId: string } };
  /** Schema 2 (Hefta 2): Wohnungen. `haushaltId` darf leer sein (E45); dann steht das Heft nicht im Index. */
  hefte: { key: string; value: Heft; indexes: { haushaltId: string } };
  exportprofile: { key: string; value: Exportprofil };
  einstellungen: { key: string; value: Einstellungen };
  dateien: { key: string; value: DateiEintrag };
}

export type Speicherort = StoreNames<HeftaSchema>;
export type HeftaDb = IDBPDatabase<HeftaSchema>;
type Upgrade = IDBPTransaction<HeftaSchema, Speicherort[], 'versionchange'>;

/** Alle Speicherorte mit Angaben (ohne Dateien), in der Reihenfolge fürs Backup. */
export const DATENORTE = [
  'personen',
  'haushalte',
  'zugehoerigkeiten',
  'dokumente',
  'versionen',
  'bewerbungen',
  'hefte',
  'exportprofile',
  'einstellungen',
] as const satisfies readonly Speicherort[];

export const ALLE_ORTE = [...DATENORTE, 'dateien'] as const satisfies readonly Speicherort[];

/** Migrationen: Index 0 führt auf Version 1, Index 1 auf Version 2 usw. */
const MIGRATIONEN: ((db: HeftaDb, tx: Upgrade) => void)[] = [
  (db) => {
    db.createObjectStore('personen', { keyPath: 'id' });
    db.createObjectStore('haushalte', { keyPath: 'id' });
    const zug = db.createObjectStore('zugehoerigkeiten', { keyPath: 'id' });
    zug.createIndex('haushaltId', 'haushaltId');
    zug.createIndex('personId', 'personId');
    db.createObjectStore('dokumente', { keyPath: 'id' }).createIndex('personId', 'personId');
    db.createObjectStore('versionen', { keyPath: 'id' }).createIndex('dokumentId', 'dokumentId');
    db.createObjectStore('bewerbungen', { keyPath: 'id' }).createIndex('haushaltId', 'haushaltId');
    db.createObjectStore('exportprofile', { keyPath: 'id' });
    db.createObjectStore('einstellungen', { keyPath: 'id' });
    db.createObjectStore('dateien', { keyPath: 'id' });
  },
  // Schema 2, Hefta 2: Wohnungen als Hefte. Jede Bewerbung mit Adresse wird zu einem Heft; die Bewerbung
  // bleibt, wie sie ist (docs/32-bauplan-hefta-2-schritt-1.md).
  (db, tx) => {
    db.createObjectStore('hefte', { keyPath: 'id' }).createIndex('haushaltId', 'haushaltId');
    void tx
      .objectStore('bewerbungen')
      .getAll()
      .then(async (bewerbungen) => {
        for (const heft of hefteAusBewerbungen(bewerbungen))
          await tx.objectStore('hefte').put(heft);
      });
  },
];

export const SCHEMA_VERSION = MIGRATIONEN.length;
export const DB_NAME = 'hefta';

/** Rückmeldungen der Verbindung (für die Oberfläche; in Tests meist ohne). */
export interface Verbindungsereignisse {
  /** Ein anderer Tab hält noch eine ältere Verbindung offen; das Öffnen wartet. */
  blocked?: () => void;
  /** Ein anderer Tab mit neuerer Version will umbauen: diese Verbindung sollte schließen. */
  blocking?: () => void;
  /** Der Browser hat die Verbindung beendet (Safari im Hintergrund). */
  terminated?: () => void;
}

/** Öffnet die Datenbank; `version` nur für Migrationstests ändern. */
export function datenbankOeffnen(
  name = DB_NAME,
  version = SCHEMA_VERSION,
  ereignisse: Verbindungsereignisse = {},
): Promise<HeftaDb> {
  return openDB<HeftaSchema>(name, version, {
    upgrade(db, alt, neu, tx) {
      for (let v = alt; v < (neu ?? version); v++) MIGRATIONEN[v]!(db, tx);
    },
    ...ereignisse,
  });
}

/**
 * Migrationen für Datensätze aus einem Backup mit älterer Schema-Version.
 * Schlüssel: Version, von der aus migriert wird.
 */
export const DATEN_MIGRATIONEN: Record<
  number,
  (daten: Record<string, unknown[]>) => Record<string, unknown[]>
> = {
  1: (daten) => ({
    ...daten,
    hefte: hefteAusBewerbungen((daten.bewerbungen ?? []) as Bewerbung[]),
  }),
};

export function datenMigrieren(
  daten: Record<string, unknown[]>,
  vonVersion: number,
): Record<string, unknown[]> {
  let ergebnis = daten;
  for (let v = vonVersion; v < SCHEMA_VERSION; v++) {
    const schritt = DATEN_MIGRATIONEN[v];
    if (!schritt) throw new Error(`Keine Datenmigration von Version ${v}`);
    ergebnis = schritt(ergebnis);
  }
  return ergebnis;
}
