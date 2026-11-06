import { describe, expect, it } from 'vitest';
import katalog from '../../data/regelkatalog.de.json';
import type { DateiVersion, Dokument, Person } from './modell';
import {
  LEBENSSITUATIONEN,
  situationOptionen,
  situationText,
  offeneDinge,
  personStand,
  rollenText,
  ohneTrennstellen,
  unterlagenFuer,
} from './regelkatalog';
import { leereSelbstauskunft } from './selbstauskunft';

function ids(liste: { id: string }[]) {
  return liste.map((d) => d.id);
}

function person(teil: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    createdAt: '',
    updatedAt: '',
    vorname: 'Max',
    nachname: 'Mustermann',
    rufname: 'Max',
    kontakt: { telefon: '', email: '' },
    lebenssituation: 'angestellt',
    beruf: '',
    arbeitgeber: '',
    nettoeinkommen: null,
    abrechnungMeist: null,
    ...teil,
  };
}

function dokument(typ: string, id = `d-${typ}`): Dokument {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    personId: 'p1',
    typ,
    notiz: '',
    serie: null,
    stummBis: null,
  };
}

function version(dokumentId: string, n = 1): DateiVersion[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${dokumentId}-v${i}`,
    createdAt: '',
    updatedAt: '',
    dokumentId,
    ausstellungsdatum: '2026-10-01',
    abrechnungsmonat: `2026-0${7 + i}`,
    variante: null,
    original: 'f',
    aufbereitet: null,
    seiten: null,
    schwaerzungen: {},
    gerastert: false,
    erkannteWerte: null,
    vomNutzerBestaetigt: null,
  }));
}

describe('Regelkatalog: wer braucht was', () => {
  it('Hauptmieter, angestellt: Selbstauskunft, Gehaltsnachweise, Bonität; dazu freiwillige und unnötige', () => {
    expect(ids(unterlagenFuer('hauptmieter', 'angestellt'))).toEqual([
      'selbstauskunft',
      'gehaltsnachweis',
      'bonitaet',
      'mietzahlung',
      'empfehlung_vorvermieter',
      'ausweiskopie',
      'schufa_datenkopie',
    ]);
  });

  it('jede Lebenssituation bekommt genau einen Einkommensnachweis', () => {
    for (const situation of LEBENSSITUATIONEN) {
      const einkommen = unterlagenFuer('mitmieter', situation).filter((d) => d.symbol === 'euro');
      expect(einkommen, situation).toHaveLength(1);
    }
  });

  it('ohne Lebenssituation gibt es noch keinen Einkommensnachweis', () => {
    expect(unterlagenFuer('hauptmieter', null).some((d) => d.symbol === 'euro')).toBe(false);
  });

  it('Bürge: Bürgschaftserklärung zuerst, keine Mietzahlungen', () => {
    const liste = ids(unterlagenFuer('buerge', 'rente'));
    expect(liste[0]).toBe('buergschaftserklaerung');
    expect(liste).toContain('rentenbescheid');
    expect(liste).not.toContain('mietzahlung');
  });

  it('Studierende als Bürge haben im Katalog keinen Einkommensnachweis', () => {
    expect(unterlagenFuer('buerge', 'studierend_azubi').some((d) => d.symbol === 'euro')).toBe(
      false,
    );
  });

  it('Anschreiben und WBS gehören zur Bewerbung, nicht zur Person', () => {
    for (const situation of LEBENSSITUATIONEN) {
      expect(ids(unterlagenFuer('hauptmieter', situation))).not.toContain('anschreiben');
      expect(ids(unterlagenFuer('hauptmieter', situation))).not.toContain('wbs');
    }
  });

  it('nie zulässige Angaben kommen als Unterlage nicht vor (außer Ausweiskopie als „Meist unnötig“)', () => {
    const nie = new Set(katalog.nieAbfragen);
    for (const typ of katalog.dokumenttypen) {
      if (nie.has(typ.id)) expect(typ.etikett, typ.id).toBe('meist_unnoetig');
    }
  });

  it('nennt Rollen in der gewünschten Form', () => {
    expect(rollenText('mitmieter', 'weiblich')).toBe('Mitmieterin');
    expect(rollenText('buerge', 'maennlich')).toBe('Bürge');
    expect(rollenText('hauptmieter', 'neutral')).toBe('Hauptmietpartei');
    expect(rollenText('buerge', 'neutral')).toBe('bürgt');
  });
});

// Fester Tag, damit Fristen-Ergebnisse nicht vom Testdatum abhängen.
const HEUTE = new Date(2026, 9, 31);

describe('Stand einer Person', () => {
  it('ohne Unterlagen: alles Übliche fehlt, nächster Schritt ist die erste Unterlage im Katalog', () => {
    const stand = personStand(person(), 'hauptmieter', [], [], HEUTE);
    expect(stand.pfad.map((u) => [u.typ.id, u.status])).toEqual([
      ['selbstauskunft', 'fehlt'],
      ['gehaltsnachweis', 'fehlt'],
      ['bonitaet', 'fehlt'],
    ]);
    expect(stand.naechster?.typ.id).toBe('selbstauskunft');
    expect(stand.naechster?.grund).toBe('Fehlt noch');
  });

  it('Serie: Gehaltsnachweise sind erst mit drei Monaten da', () => {
    const d = dokument('gehaltsnachweis');
    expect(
      personStand(person(), 'hauptmieter', [d], version(d.id, 2), HEUTE).unterlagen[1]!.status,
    ).toBe('fehlt');
    expect(
      personStand(person(), 'hauptmieter', [d], version(d.id, 3), HEUTE).unterlagen[1]!.status,
    ).toBe('da');
  });

  it('freiwillige Unterlagen liegen erst auf dem Pfad, wenn eine Version da ist', () => {
    const d = dokument('mietzahlung');
    expect(
      personStand(person(), 'mitmieter', [], [], HEUTE).pfad.map((u) => u.typ.id),
    ).not.toContain('mietzahlung');
    const mit = personStand(person(), 'mitmieter', [d], version(d.id), HEUTE);
    expect(mit.pfad.map((u) => u.typ.id)).toContain('mietzahlung');
    expect(mit.unterlagen.find((u) => u.typ.id === 'mietzahlung')?.status).toBe('da');
  });

  it('alles da: kein nächster Schritt, nichts offen', () => {
    const doks = ['selbstauskunft', 'gehaltsnachweis', 'bonitaet'].map((t) => dokument(t));
    const versionen = doks.flatMap((d) => version(d.id, 3));
    const ausgefuellt = person({
      kontakt: { telefon: '0170 1234567', email: '' },
      nettoeinkommen: 2800,
      selbstauskunft: {
        ...leereSelbstauskunft(),
        haustiere: 'nein',
        insolvenz: 'nein',
        raeumungstitel: 'nein',
        mietrueckstaende: 'nein',
        ort: 'Hamburg',
      },
    });
    const stand = personStand(ausgefuellt, 'hauptmieter', doks, versionen, HEUTE);
    expect(stand.naechster).toBeNull();
    expect(offeneDinge([stand])).toBe(0);
  });

  it('zählt offene Dinge im ganzen Haushalt', () => {
    const max = personStand(person(), 'hauptmieter', [], [], HEUTE);
    const petra = personStand(
      person({ id: 'p3', lebenssituation: 'rente' }),
      'buerge',
      [],
      [],
      HEUTE,
    );
    expect(offeneDinge([max, petra])).toBe(3 + 4);
  });
});

describe('Trennstellen', () => {
  it('lange Wörter in Unterlagen-Namen haben weiche Trennstellen im Katalog', () => {
    for (const typ of katalog.dokumenttypen) {
      for (const feld of [
        typ.text,
        (typ as { textEinzeln?: string }).textEinzeln,
        (typ as { textKurz?: string }).textKurz,
      ]) {
        for (const wort of (feld ?? '').split(/[\s-]+/)) {
          if (wort.replaceAll('­', '').length > 13) expect(wort, typ.id).toContain('­');
        }
      }
    }
  });

  it('entfernt Trennstellen für Vorlesen und PDF', () => {
    expect(ohneTrennstellen('Selbst­auskunft')).toBe('Selbstauskunft');
  });
});

describe('Studium oder Ausbildung', () => {
  it('heißt so, wie die Person es macht', () => {
    expect(situationText('studierend_azubi', 'studium')).toBe('Im Studium');
    expect(situationText('studierend_azubi', 'ausbildung')).toBe('In Ausbildung');
    expect(situationOptionen().map((o) => o.wert)).toContain('studierend_azubi:ausbildung');
  });

  it('verlangt je nach Art die passende Unterlage, unter derselben Kennung', () => {
    const typ = (art: 'studium' | 'ausbildung') =>
      unterlagenFuer('hauptmieter', 'studierend_azubi', art).find(
        (u) => u.id === 'einkommen_ausbildung',
      )!;
    expect(typ('studium').text).toBe('BAföG oder Unterhalt');
    expect(typ('ausbildung').text.replaceAll('\u00ad', '')).toBe('Ausbildungsvertrag');
    expect(typ('studium').jeVariante).toBe(true);
  });
});
