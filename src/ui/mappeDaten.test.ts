import { describe, expect, it } from 'vitest';
import type { PersonStand } from '../domain/regelkatalog';
import type { HaushaltsAngaben } from '../domain/selbstauskunft';
import { zeichenFunde } from './mappeDaten';

const stand = (person: object, rolle = 'hauptmieter') =>
  ({
    rolle,
    person: {
      id: 'p1',
      vorname: 'Maximilian',
      rufname: 'Max',
      kontakt: {},
      lage: 'angestellt',
      ...person,
    },
  }) as unknown as PersonStand;
const leer = {} as HaushaltsAngaben;

describe('zeichenFunde: Freitext, den das PDF nicht schreiben kann', () => {
  it('nennt das Feld und führt zur Selbstauskunft der Person', () => {
    expect(zeichenFunde([stand({ arbeitgeber: 'ООО Ромашка' })], leer, null)).toEqual([
      { feld: 'Arbeitgeber bei Max', ziel: '#/selbstauskunft/p1/feld/arbeitgeber' },
    ]);
  });

  it('Adresse und Satz stehen bei der Bewerbung, Haustiere und Ort beim Haushalt', () => {
    const hh = { haustiereText: 'Кот', ort: 'Киев' } as HaushaltsAngaben;
    const funde = zeichenFunde([stand({})], hh, { adresse: 'улица 1', satz: 'Привет' });
    expect(funde.map((f) => f.ziel)).toEqual([
      'adresse',
      'satz',
      '#/selbstauskunft/p1/feld/haustiere',
      '#/selbstauskunft/p1/feld/ort',
    ]);
  });

  it('Was die Schrift kann, ist kein Fund: Euro, Anführungszeichen, Gedankenstrich, Zeilenumbruch', () => {
    const person = stand({
      arbeitgeber: 'Müller & Söhne – „Bau“ GmbH',
      beruf: 'Łukasz’ Büro',
      selbstauskunft: { stellungnahme: 'Miete 1.200 € …\nseit 2020' },
    });
    expect(zeichenFunde([person], leer, { adresse: 'Straße 1', satz: '' })).toEqual([]);
  });
});
