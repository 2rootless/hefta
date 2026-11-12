import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { adresseTeile, adresseZeilen } from '../domain/adresse';
import { APP_NAME } from './name';
import { RUECKMELDUNG_ADRESSE, rueckmeldungLink } from './impressum';

const lesen = (pfad: string) => readFileSync(pfad, 'utf-8');

describe('Der Name steht an einer Stelle', () => {
  it('Texte und Regelkatalog schreiben {app}, nie den Namen selbst', () => {
    for (const pfad of ['src/i18n/de.json', 'data/regelkatalog.de.json']) {
      expect(lesen(pfad)).not.toContain(APP_NAME);
      expect(lesen(pfad)).toContain('{app}');
    }
  });

  it('kein Satz nennt noch den alten Namen als Dienst', () => {
    const alt =
      /(?<![Dd]ie |[Dd]er |[Ee]ine |[Ee]iner |Eure |Deine |eurer |deiner |jede |ganze |zur |dieser |mit )\bMappe\b(?! erstellen| anpassen| ansehen| anhängen| wird erstellt| trotzdem| teilen)/;
    const treffer = [lesen('src/i18n/de.json'), lesen('data/regelkatalog.de.json')]
      .join('\n')
      .split('\n')
      .filter((zeile) => alt.test(zeile))
      // Hefta 2: „Mappe“ ist der Name des Tabs (B12), nicht des Dienstes.
      // Ebenso der Schritt „Mappe“ beim Bewerben (B23).
      .filter((zeile) => !/^"mappe": "Mappe",?$/.test(zeile.trim()));
    expect(treffer).toEqual([]);
  });

  it('der Name steht nie mit Artikel wie die Mappe: „die ganze Hefta“ gibt es nicht', () => {
    const falsch = /\b(die|der|den|eine|einer|ganze|diese|deine|eure)\s+\{app\}/i;
    const treffer = [lesen('src/i18n/de.json'), lesen('data/regelkatalog.de.json')]
      .join('\n')
      .split('\n')
      .filter((zeile) => falsch.test(zeile));
    expect(treffer).toEqual([]);
  });

  it('die statischen Dateien bekommen ihn vom Build', () => {
    for (const pfad of ['index.html', 'public/manifest.webmanifest', 'public/404.html'])
      expect(lesen(pfad)).toContain('%APP_NAME%');
    expect(lesen('public/manifest.webmanifest')).not.toContain('Mappe');
  });

  it('auch intern heißt alles Hefta', () => {
    expect(lesen('src/storage/sicherung.ts')).toContain("FORMAT = 'hefta-backup'");
    expect(lesen('src/storage/backup.ts')).toContain("encode('HEFTABAK')");
    expect(lesen('src/storage/db.ts')).toContain("DB_NAME = 'hefta'");
    expect(lesen('src/sw/sw.js')).toContain('`hefta-${VERSION}`');
  });
});

describe('Adresse auf dem Deckblatt', () => {
  it('teilt in Straße und den Rest', () => {
    expect(adresseTeile(adresseZeilen('Hauptstraße 12, 3. OG links\n22767 Hamburg'))).toEqual({
      strasse: 'Hauptstraße 12',
      rest: '3.\u00a0OG links · 22767\u00a0Hamburg',
    });
    expect(
      adresseTeile(['Große Bergstraße 152, Hinterhaus, 4. OG rechts', '22767 Hamburg-Altona']),
    ).toEqual({
      strasse: 'Große Bergstraße 152',
      rest: 'Hinterhaus, 4.\u00a0OG rechts · 22767\u00a0Hamburg-Altona',
    });
    expect(adresseTeile(['Lindenallee 3'])).toEqual({ strasse: 'Lindenallee 3', rest: '' });
    expect(adresseZeilen('  \n ')).toEqual([]);
  });
});

describe('Rückmeldung (E52)', () => {
  it('nimmt die Adresse aus dem Impressum und setzt den Betreff', () => {
    expect(RUECKMELDUNG_ADRESSE).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/);
    expect(rueckmeldungLink('Mehrere Geräte')).toBe(
      `mailto:${RUECKMELDUNG_ADRESSE}?subject=Mehrere%20Ger%C3%A4te`,
    );
  });
});
