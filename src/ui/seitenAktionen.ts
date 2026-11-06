import { db } from '../app/daten.svelte';
import { ausstellungstag, datenFinden, monatFinden } from '../domain/datumErkennen';
import { monatAus, monatPlus } from '../domain/fristen';
import type { DateiVersion } from '../domain/modell';
import type { Dokumenttyp } from '../domain/regelkatalog';
import { dateiVon, eigeneSeiten, seiteHeraus, seiteHinein } from '../domain/seitenVersion';
import {
  dateiLesen,
  dateiSpeichern,
  versionAusSeiten,
  versionenAendern,
  type VersionenStand,
} from '../storage/speicher';

// „Verschieben“ (design/nachtraeglich-ordnen.md, OR6): Die Seite kommt zu einer Version, einem neuen
// Monat oder einer anderen Unterlage. Es wird nichts kopiert, solange es dieselbe Datei bleibt.

export type VerschiebeZiel =
  | { art: 'version'; version: DateiVersion }
  | { art: 'monat'; monat: string }
  | { art: 'unterlage'; personId: string; typ: Dokumenttyp };

async function dateiDaten(id: string): Promise<Uint8Array> {
  const datei = await dateiLesen(await db(), id);
  if (!datei) throw new Error('Datei nicht lesbar');
  return new Uint8Array(await datei.arrayBuffer());
}

async function zuVersion(
  ziel: DateiVersion,
  quelle: DateiVersion,
  seite: number,
  alle: DateiVersion[],
): Promise<{ version: DateiVersion; neueDatei?: string }> {
  const { pdfOeffnen, pdfSchliessen } = await import('../pdf/pdfjs');
  const daten = await dateiDaten(dateiVon(ziel));
  const dok = await pdfOeffnen(daten.slice());
  const gesamt = dok.numPages;
  await pdfSchliessen(dok);
  const eigene = eigeneSeiten(ziel, gesamt, alle);
  if (dateiVon(ziel) === dateiVon(quelle)) return { version: seiteHinein(ziel, eigene, seite) };

  // Andere Datei: Eine Version zeigt auf eine Datei, also entsteht eine aus beiden.
  const { seitenZusammenfuegen } = await import('../pdf/zusammenfuegen');
  const drin = eigene.filter((s) => !ziel.seiten?.length || ziel.seiten.includes(s));
  const bytes = await seitenZusammenfuegen([
    { daten, seiten: eigene },
    { daten: await dateiDaten(dateiVon(quelle)), seiten: [seite] },
  ]);
  const neueDatei = await dateiSpeichern(
    await db(),
    new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }),
  );
  const alle_ = [...eigene, -1];
  return {
    neueDatei,
    version: {
      ...ziel,
      aufbereitet: neueDatei,
      erkannteWerte: null,

      eigene: alle_.map((_, i) => i),
      seiten: alle_.flatMap((s, i) => (s === -1 || drin.includes(s) ? [i] : [])),
    },
  };
}

/** Datum oder Monat von der Seite. Ohne Fund steht sie ohne Datum dort; eine Serie braucht einen Monat. */
async function datumVonSeite(typ: Dokumenttyp, quelle: DateiVersion, seite: number) {
  const { pdfOeffnen, pdfSchliessen, seitenStuecke } = await import('../pdf/pdfjs');
  const dok = await pdfOeffnen(await dateiDaten(dateiVon(quelle)));
  try {
    const stuecke = await seitenStuecke(dok, seite + 1);
    if (typ.datum === 'abrechnungsmonat')
      return {
        abrechnungsmonat:
          monatFinden(stuecke) ?? quelle.abrechnungsmonat ?? monatPlus(monatAus(new Date()), -1),
        ausstellungsdatum: null,
      };
    return {
      abrechnungsmonat: null,
      ausstellungsdatum:
        typ.datum === 'ausstellungsdatum'
          ? (ausstellungstag(datenFinden(stuecke).map((f) => ({ ...f, seite: seite + 1 })))?.tag ??
            null)
          : null,
    };
  } finally {
    await pdfSchliessen(dok);
  }
}

export async function seiteVerschieben(
  quelle: DateiVersion,
  eigene: number[],
  seite: number,
  ziel: VerschiebeZiel,
  alle: DateiVersion[],
): Promise<VersionenStand> {
  const verbindung = await db();
  const rest = seiteHeraus(quelle, eigene, seite);
  // Bleibt nichts übrig, verschwindet die Version; ihre Datei behält, wer sie weiter nutzt.
  const basis = {
    loeschen: rest ? [] : [quelle.id],
    schreiben: rest ? [rest] : [],
  };
  // Vorlage ohne Datum und Monat: Beides gehört der Version, nicht der Seite.
  let neu: DateiVersion;
  let neueDatei: string | undefined;
  if (ziel.art === 'version') {
    ({ version: neu, neueDatei } = await zuVersion(ziel.version, quelle, seite, alle));
  } else if (ziel.art === 'monat') {
    const dokument = alle.find((v) => v.id === quelle.id)!.dokumentId;
    const bisher = alle.find((v) => v.dokumentId === dokument && v.abrechnungsmonat === ziel.monat);
    if (bisher) ({ version: neu, neueDatei } = await zuVersion(bisher, quelle, seite, alle));
    else
      neu = {
        ...quelle,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        abrechnungsmonat: ziel.monat,
        eigene: [seite],
        seiten: [seite],
      };
  } else {
    const werte = await datumVonSeite(ziel.typ, quelle, seite);
    neu = await versionAusSeiten(
      verbindung,
      {
        personId: ziel.personId,
        typ: ziel.typ.id,
        serie: ziel.typ.serie?.anzahl ?? null,
      },
      quelle,
      { ...werte, variante: ziel.typ.varianten?.[0]?.id ?? null, seite },
    );
  }
  return versionenAendern(verbindung, {
    ...basis,
    schreiben: [...basis.schreiben, neu],
    neueDateien: neueDatei ? [neueDatei] : [],
  });
}
