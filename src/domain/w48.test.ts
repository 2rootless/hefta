// W48: Erinnerung, bevor eine Unterlage zu alt ist, als Mitteilung. Rechnung, Wortlaut, die fünf Sätze.
import { describe, expect, it } from 'vitest';
import { t } from '../i18n';
import { erinnertWirklich } from '../ui/erinnertWort';
import {
  ERINNERUNGEN_HOECHSTENS,
  ZU_ALT_VORLAUF_TAGE,
  erinnerungenPlanen,
  type ZuAltUnterlage,
} from './erinnerungen';

const JETZT = new Date(2026, 10, 1, 9, 0);
const plan = (zuAlt: ZuAltUnterlage[], zuAltAn = true) =>
  erinnerungenPlanen({
    hefte: [],
    gehalt: [],
    besichtigungenAn: true,
    gehaltAn: true,
    jetzt: JETZT,
    zuAlt,
    zuAltAn,
  });

// Bonitätsnachweis vom 29. August: 90 Tage, also ab dem 28. November zu alt; Mitteilung 14 Tage vorher.
const bonitaet = (personId = 'selin'): ZuAltUnterlage => ({
  personId,
  typId: 'bonitaet',
  datum: '2026-08-29',
  warnungTage: 90,
});
const miete = (personId = 'selin'): ZuAltUnterlage => ({
  personId,
  typId: 'mietzahlung',
  datum: '2026-06-01',
  warnungTage: 180,
});

describe('W48: Rechnung', () => {
  it('eine Unterlage: morgens, zwei Wochen vor „zu alt“; Tipp öffnet die Unterlage', () => {
    const [e] = plan([bonitaet()]);
    expect(e?.art).toBe('zuAlt');
    expect(e?.unterlagen?.[0]?.ab).toEqual(new Date(2026, 10, 28));
    expect(e?.am).toEqual(new Date(2026, 10, 28 - ZU_ALT_VORLAUF_TAGE, 10));
    expect(e?.ziel).toBe('/unterlage/selin/bonitaet');
  });

  it('dieselbe Person am selben Tag: eine Mitteilung mit beiden, Tipp auf die Personenseite', () => {
    // Mietzahlungen vom 31. Mai (180 Tage): wie die Bonität ab dem 28. November, Mitteilung am selben Tag.
    const gleicherTag: ZuAltUnterlage = { ...miete(), datum: '2026-05-31' };
    const liste = plan([gleicherTag, bonitaet()]);
    expect(liste).toHaveLength(1);
    expect(liste[0]?.unterlagen?.map((u) => u.typId).sort()).toEqual(['bonitaet', 'mietzahlung']);
    expect(liste[0]?.ziel).toBe('/person/selin');
  });

  it('Gegenprobe: zwei Personen oder zwei Tage ergeben zwei Mitteilungen', () => {
    expect(plan([bonitaet('selin'), bonitaet('jonas')])).toHaveLength(2);
    expect(plan([bonitaet(), miete()])).toHaveLength(2);
  });

  it('Schalter aus: keine; schon vorbei: keine; ohne Datum gibt es keinen Eintrag', () => {
    expect(plan([bonitaet()], false)).toEqual([]);
    expect(plan([{ ...bonitaet(), datum: '2026-07-01' }])).toEqual([]);
    expect(plan([{ ...bonitaet(), datum: '' }])).toEqual([]);
  });

  it('höchstens 40; die nächste hat Vorrang', () => {
    const viele = Array.from({ length: 60 }, (_, i) => ({
      ...bonitaet(`p${i}`),
      datum: `2026-${String(9 + Math.floor(i / 28)).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
    }));
    const liste = plan(viele);
    expect(liste).toHaveLength(ERINNERUNGEN_HOECHSTENS);
    expect(liste[0]?.personId).toBe('p0');
  });
});

describe('W48: Wortlaut (Design)', () => {
  it('Titel und Zeile, eine und mehrere', () => {
    expect(t('erinnerung.zuAltTitel', { unterlage: 'Bonitätsnachweis', name: 'Selin' })).toBe(
      'Bonitätsnachweis von Selin wird bald zu alt',
    );
    expect(t('erinnerung.zuAltText', { datum: '28. November', grenze: '3 Monate' })).toBe(
      'Ab dem 28. November älter als 3 Monate. Vielen Vermietern ist das zu alt.',
    );
    expect(t('erinnerung.zuAltMehrTitel', { zahl: 'Zwei', name: 'Selin' })).toBe(
      'Zwei Unterlagen von Selin werden bald zu alt',
    );
    expect(
      t('erinnerung.zuAltMehrText', {
        datum: '28. November',
        erste: 'Bonitätsnachweis',
        rest: 'Mietzahlungen',
      }),
    ).toBe('Ab dem 28. November: Bonitätsnachweis, dann Mietzahlungen.');
  });

  it('der dritte Schalter', () => {
    expect(t('einstellungen.erinnerungZuAltTitel')).toBe('Unterlagen, bevor sie zu alt werden');
    expect(t('einstellungen.erinnerungZuAltText')).toBe(
      'Für Unterlagen mit Datum. Höchstens eine Mitteilung je Person und Tag.',
    );
  });
});

describe('W48: die fünf Sätze, „erinnert“ nur, wenn es stimmt', () => {
  const an = { erinnerungZuAlt: true };
  it('nur in der App, mit Schalter an und erlaubten Mitteilungen', () => {
    expect(erinnertWirklich({ app: true, einstellungen: an, erlaubt: true })).toBe(true);
  });

  it('Gegenprobe: Schalter aus, ohne Erlaubnis, nicht gefragt und im Browser nie „erinnert“', () => {
    expect(
      erinnertWirklich({ app: true, einstellungen: { erinnerungZuAlt: false }, erlaubt: true }),
    ).toBe(false);
    expect(erinnertWirklich({ app: true, einstellungen: an, erlaubt: false })).toBe(false);
    expect(erinnertWirklich({ app: true, einstellungen: an, erlaubt: null })).toBe(false);
    expect(erinnertWirklich({ app: false, einstellungen: an, erlaubt: true })).toBe(false);
  });

  it('jede „zeigt“-Fassung sagt nie „erinnert“, jede „erinnert“-Fassung sagt es', () => {
    const form = { anzahl: 1, er: 'er', app: 'Hefta' };
    const zeigt = [
      t('person.standOhneDatumZeigt', { app: 'Hefta' }),
      t('unterlage.datumSatz', form),
      t('unterlage.datumSatz', { ...form, anzahl: 2 }),
      t('unterlage.datumEntfernenSatzZeigt', form),
      t('unterlage.datumEntfernenSatzZeigt', { ...form, anzahl: 2 }),
    ];
    for (const s of zeigt) expect(s).not.toContain('erinnert');
    const erinnert = [
      t('person.standOhneDatum', { app: 'Hefta' }),
      t('unterlage.datumSatzErinnert', form),
      t('unterlage.datumSatzErinnert', { ...form, anzahl: 2 }),
      t('unterlage.datumEntfernenSatz', form),
      t('unterlage.datumEntfernenSatz', { ...form, anzahl: 2 }),
    ];
    for (const s of erinnert) expect(s).toContain('erinnert');
    expect(t('person.standOhneDatum', { app: 'Hefta' })).toBe('Ohne Datum erinnert Hefta nicht');
    expect(t('unterlage.datumSatzErinnert', form)).toBe(
      'Mit Datum erinnert Hefta euch, bevor er zu alt ist.',
    );
  });
});

describe('W48: Wortlaut aus der App', () => {
  it('eine, zwei und drei Unterlagen', async () => {
    const { zuAltWortlaut } = await import('../ui/zuAltWortlaut');
    const u = (namen: string[]) =>
      namen.map((name) => ({ name, ab: new Date(2026, 10, 28), warnungTage: 90 }));
    const eine = zuAltWortlaut('Selin', u(['Bonitätsnachweis']));
    expect(eine.titel).toBe('Bonitätsnachweis von Selin wird bald zu alt');
    expect(eine.text).toBe(
      'Ab dem 28. November älter als drei Monate. Vielen Vermietern ist das zu alt.',
    );
    const zwei = zuAltWortlaut('Selin', u(['Bonitätsnachweis', 'Mietzahlungen']));
    expect(zwei.titel).toBe('Zwei Unterlagen von Selin werden bald zu alt');
    expect(zwei.text).toBe('Ab dem 28. November: Bonitätsnachweis, dann Mietzahlungen.');
    expect(zuAltWortlaut('Selin', u(['A', 'B', 'C'])).text).toBe(
      'Ab dem 28. November: A, dann B und C.',
    );
    // Titel höchstens 50 Zeichen, Zeile höchstens 90 (Design), mit dem längsten kurzen Namen.
    for (const w of [eine, zwei]) {
      expect(w.titel.length).toBeLessThanOrEqual(50);
      expect(w.text.length).toBeLessThanOrEqual(90);
    }
  });
});
