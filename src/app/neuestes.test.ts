import { describe, expect, it } from 'vitest';
import { nurNeuestes } from './neuestes';

// Zwei Ladevorgänge überholen sich: Der erste liest noch den alten Stand, der zweite den neuen; der erste endet
// zuletzt. Auf dem Bildschirm muss der neue Stand bleiben (der verpuffte Tipp aus den wackelnden Tests).

function aufschub<T>() {
  let fertig!: (w: T) => void;
  const versprechen = new Promise<T>((r) => (fertig = r));
  return { versprechen, fertig };
}

async function ueberholen(
  bauen: (lesen: () => Promise<string>, uebernehmen: (w: string) => void) => () => Promise<void>,
) {
  const gelesen = [aufschub<string>(), aufschub<string>()];
  let i = 0;
  let bildschirm = 'leer';
  const laden = bauen(
    () => gelesen[i++]!.versprechen,
    (w) => (bildschirm = w),
  );
  const reihenfolge: string[] = [];
  const erstes = laden().then(() => reihenfolge.push(`erstes sieht ${bildschirm}`));
  const zweites = laden().then(() => reihenfolge.push(`zweites sieht ${bildschirm}`));
  gelesen[1]!.fertig('neu');
  await zweites;
  gelesen[0]!.fertig('alt');
  await erstes;
  return { bildschirm, reihenfolge };
}

/** Die frühere Art: Jedes Laden übernimmt, was es gelesen hat. */
function jedesUebernimmt<T>(lesen: () => Promise<T>, uebernehmen: (w: T) => void) {
  return async () => uebernehmen(await lesen());
}

describe('nurNeuestes', () => {
  it('ein älteres Laden, das zuletzt endet, setzt den alten Stand nicht zurück', async () => {
    const { bildschirm, reihenfolge } = await ueberholen(nurNeuestes);
    expect(bildschirm).toBe('neu');
    expect(reihenfolge).toEqual(['zweites sieht neu', 'erstes sieht neu']);
  });

  it('Gegenprobe: übernimmt jedes Laden, steht am Ende der alte Stand da', async () => {
    const { bildschirm } = await ueberholen(jedesUebernimmt);
    expect(bildschirm).toBe('alt');
  });

  it('ein älteres Laden wartet auf das neueste, bevor es fertig meldet', async () => {
    const gelesen = [aufschub<string>(), aufschub<string>()];
    let i = 0;
    let bildschirm = 'leer';
    const laden = nurNeuestes(
      () => gelesen[i++]!.versprechen,
      (w) => (bildschirm = w),
    );
    let erstesFertig = false;
    const erstes = laden().then(() => (erstesFertig = true));
    const zweites = laden();
    gelesen[0]!.fertig('alt');
    await Promise.resolve();
    await Promise.resolve();
    expect(erstesFertig).toBe(false);
    expect(bildschirm).toBe('leer');
    gelesen[1]!.fertig('neu');
    await Promise.all([erstes, zweites]);
    expect(bildschirm).toBe('neu');
  });

  it('einzeln übernimmt jedes Laden seinen Stand', async () => {
    let bildschirm = '';
    let n = 0;
    const laden = nurNeuestes(
      async () => `stand ${++n}`,
      (w) => (bildschirm = w),
    );
    await laden();
    expect(bildschirm).toBe('stand 1');
    await laden();
    expect(bildschirm).toBe('stand 2');
  });
});
