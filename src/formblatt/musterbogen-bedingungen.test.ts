import { describe, expect, it } from 'vitest';
import de from '../i18n/de.json';
import katalog from '../../data/regelkatalog.de.json';
import nachforderung from '../../data/nachforderung.de.json';

// PC211, Abschnitt 2 (E356): Die Fragen C.4 bis C.6 tragen in App, PDF und auf der Vermieterseite alle Bedingungen
// des Musterbogens (design/quellen/dsk-musterbogen-v2.txt), keine fehlt. Gegenprobe: Ein Satz ohne eine Bedingung
// wird rot.

const BEDINGUNGEN: Record<'c4' | 'c5' | 'c6', RegExp[]> = {
  c4: [
    /(jetzigen|bestehenden) Mietverhältnis/,
    /zwei (Monate nacheinander|aufeinanderfolgende Monate)/,
    /mehr als einer? Monatsmiete/,
  ],
  c5: [
    /(jetzigen|bestehenden) Mietverhältnis/,
    /mehr als zwei Monate/,
    /mindestens zwei Monatsmieten/,
  ],
  c6: [
    /[Ll]etzte/,
    /tatsächlich vorliegenden/,
    /erheblichen Verletzung des Mietvertrags/,
    /gekündigt/,
    /rechtswirksam/,
    /rechtskräftig festgestellt/,
    // „rechtskräftig festgestellt“ gehört zur Kündigung, nicht zur Pflichtverletzung.
    /Kündigung (rechtswirksam|die rechtswirksam|.{0,20}rechtswirksam ist)/,
  ],
};

function fehlend(art: keyof typeof BEDINGUNGEN, text: string): string[] {
  return BEDINGUNGEN[art].filter((r) => !r.test(text)).map(String);
}

const sa = de.selbstauskunft;
const pdf = (id: string) => katalog.selbstauskunftFelder.find((f) => f.id === id)!.pdfText;
const [vm4, vm5, vm6] = nachforderung.fragen as [string, string, string];

describe('PC211: Bedingungen des Musterbogens C.4 bis C.6', () => {
  it('in der App (du und mit Namen), im PDF und auf der Vermieterseite', () => {
    const stellen: [keyof typeof BEDINGUNGEN, string, string][] = [
      ['c4', 'App du', sa.rueckstandMonateDu],
      ['c4', 'App Name', sa.rueckstandMonate],
      ['c4', 'PDF', pdf('rueckstand_monate')],
      ['c4', 'Vermieterseite', vm4],
      ['c5', 'App du', sa.rueckstandMietenDu],
      ['c5', 'App Name', sa.rueckstandMieten],
      ['c5', 'PDF', pdf('rueckstand_mieten')],
      ['c5', 'Vermieterseite', vm5],
      ['c6', 'App du', sa.kuendigungDu],
      ['c6', 'App Name', sa.kuendigung],
      ['c6', 'PDF', pdf('kuendigung')],
      ['c6', 'Vermieterseite', vm6],
    ];
    const funde = stellen.flatMap(([art, wo, text]) =>
      fehlend(art, text).map((f) => `${art} ${wo}: ${f}`),
    );
    expect(funde).toEqual([]);
    // Das Feld zu C.6 bleibt, der Musterbogen fragt danach; C.7 nach dem Musterbogen (DP143).
    expect(sa.kuendigungWelche).toBe('Um welche Verletzung des Mietvertrags ging es?');
    expect(sa.gruende).toBe('Gründe, warum das nicht wieder vorkommt (freiwillig)');
    expect(sa.gruendeBeispiel).toBe('Etwa ein höheres Nettoeinkommen.');
  });

  it('Gegenprobe: der alte Satz zu C.6 und eine fehlende Bedingung werden rot', () => {
    expect(
      fehlend(
        'c6',
        'Ob Ihr letztes Mietverhältnis wegen einer tatsächlich vorliegenden, erheblichen Verletzung des Mietvertrags rechtswirksam gekündigt oder eine solche Pflichtverletzung rechtskräftig festgestellt wurde.',
      ),
    ).not.toEqual([]);
    expect(
      fehlend(
        'c5',
        'Hast du über mehr als zwei Monate mindestens zwei Monatsmieten nicht gezahlt?',
      ),
    ).toEqual([String(BEDINGUNGEN.c5[0])]);
  });
});
