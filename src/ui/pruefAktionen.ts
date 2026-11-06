import { daten, db, neuLaden } from '../app/daten.svelte';
import { rueckgaengigAnbieten } from '../app/rueckgaengig.svelte';
import type { Pruefhinweis } from '../domain/pruefhinweise';
import { eigeneSeiten, seiteUmschalten } from '../domain/seitenVersion';
import { t } from '../i18n';
import {
  dokumentFuer,
  versionenAendern,
  versionenZurueck,
  type VersionenStand,
} from '../storage/speicher';

/** „Passt so“: gilt für diese Datei und diese Prüfung, für immer. */
export async function passtSo(h: Pruefhinweis): Promise<void> {
  const versionen = h.gruppe ?? [h.version];
  await versionenAendern(await db(), {
    schreiben: versionen.map((v) => ({
      ...v,
      vomNutzerBestaetigt: [...new Set([...(v.vomNutzerBestaetigt ?? []), h.art])],
    })),
  });
  await neuLaden();
}

/** Die Lösung, die Mappe selbst ausführen kann; „Rückgängig“ nimmt sie zurück. */
export async function hinweisLoesen(h: Pruefhinweis): Promise<void> {
  const verbindung = await db();
  const v = h.version;
  let stand: VersionenStand;
  if (h.art === 'monat') {
    stand = await versionenAendern(verbindung, {
      schreiben: [{ ...v, abrechnungsmonat: h.monat! }],
    });
  } else if (h.art === 'name') {
    const dokument = await dokumentFuer(verbindung, {
      personId: h.person!.id,
      typ: h.typ.id,
      serie: h.typ.serie?.anzahl ?? null,
    });
    stand = await versionenAendern(verbindung, { schreiben: [{ ...v, dokumentId: dokument.id }] });
  } else if (h.art === 'leer') {
    const alle = daten.ansicht?.versionen ?? [];
    const eigene = eigeneSeiten(v, v.erkannteWerte?.seiten.length ?? 0, alle);
    stand = await versionenAendern(verbindung, {
      schreiben: [seiteUmschalten(v, eigene, h.seite!)],
    });
  } else {
    stand = await versionenAendern(verbindung, { loeschen: [v.id] });
  }
  await neuLaden();
  rueckgaengigAnbieten({
    text: t('pruef.passtJetzt'),
    seite: location.hash.slice(1) || '/',
    ausfuehren: async () => {
      // Frisch holen: iOS beendet Verbindungen, wenn die App im Hintergrund war.
      await versionenZurueck(await db(), stand);
      await neuLaden();
    },
  });
}
