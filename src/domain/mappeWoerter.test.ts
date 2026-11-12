import { describe, expect, it } from 'vitest';
import { werIstDabeiHinweis } from './mappeWoerter';

describe('Satz unter „Wer ist dabei?“ (B12c, E50)', () => {
  it('eine Bürgin, ein Bürge, als Paar und allein', () => {
    expect(werIstDabeiHinweis([{ vorname: 'Petra', bezeichnung: 'weiblich' }], false)).toBe(
      'Wer im Mietvertrag steht, ist immer dabei. Die Bürgin könnt ihr für diese Mappe abwählen.',
    );
    expect(werIstDabeiHinweis([{ vorname: 'Klaus', bezeichnung: 'maennlich' }], true)).toBe(
      'Wer im Mietvertrag steht, ist immer dabei. Den Bürgen kannst du für diese Mappe abwählen.',
    );
  });

  it('ohne gewählte Form mit Vornamen, ab zwei Bürgen immer mit Namen', () => {
    expect(werIstDabeiHinweis([{ vorname: 'Kim', bezeichnung: 'neutral' }], false)).toBe(
      'Wer im Mietvertrag steht, ist immer dabei. Kim könnt ihr für diese Mappe abwählen.',
    );
    expect(
      werIstDabeiHinweis(
        [
          { vorname: 'Petra', bezeichnung: 'weiblich' },
          { vorname: 'Klaus', bezeichnung: 'maennlich' },
        ],
        false,
      ),
    ).toBe(
      'Wer im Mietvertrag steht, ist immer dabei. Petra und Klaus könnt ihr für diese Mappe abwählen.',
    );
  });

  it('ohne Bürgen nur der erste Satz', () => {
    expect(werIstDabeiHinweis([], true)).toBe('Wer im Mietvertrag steht, ist immer dabei.');
  });
});
