import { describe, expect, it } from 'vitest';
import { werIstDabeiHinweis } from './mappeWoerter';

describe('Satz unter „Wer ist dabei?“ (B12c, E50)', () => {
  it('PC205 (E363): eine Person, die bürgt, steht mit Vornamen da, für jede gewählte Form', () => {
    expect(werIstDabeiHinweis([{ vorname: 'Petra', bezeichnung: 'weiblich' }], false)).toBe(
      'Wer im Mietvertrag steht, ist immer dabei. Petra könnt ihr für diese Mappe abwählen.',
    );
    expect(werIstDabeiHinweis([{ vorname: 'Klaus', bezeichnung: 'maennlich' }], true)).toBe(
      'Wer im Mietvertrag steht, ist immer dabei. Klaus kannst du für diese Mappe abwählen.',
    );
    // Ohne Vornamen ein neutraler Satz, nie „Die Bürgin“.
    expect(werIstDabeiHinweis([{ vorname: ' ', bezeichnung: 'weiblich' }], false)).toBe(
      'Wer im Mietvertrag steht, ist immer dabei. Die bürgende Person könnt ihr für diese Mappe abwählen.',
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
