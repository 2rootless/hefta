import type { Page } from '@playwright/test';

// DP49b, W33: Prüfungen für den Prüfzustand der Nachfrage, im Browser ausgewertet. Gemeinsam genutzt von
// nachfrage.spec.ts und wunsch-w33.spec.ts.

/** Farbe eines Tokens als `rgb(…)`, wie der Browser sie berechnet. */
export function farbe(page: Page, token: string): Promise<string> {
  return page.evaluate((t) => {
    const probe = document.createElement('span');
    probe.style.setProperty('color', `var(${t})`);
    document.body.append(probe);
    const wert = getComputedStyle(probe).color;
    probe.remove();
    return wert;
  }, token);
}

/**
 * W33, NF5: Hat das Feld im Fokus einen Rand in Tinte (innen als box-shadow oder als outline)? Der Rand
 * bedeutet nur „Hefta fragt nach“, nie Fokus.
 */
export async function tintenrandImFokus(page: Page, selektor: string): Promise<boolean> {
  const tinte = await farbe(page, '--ink');
  // Ein echter Tipp ins Feld, wie mit dem Finger; danach steht der Cursor darin.
  await page.locator(selektor).click();
  // Überblenden abwarten (300 ms, DP49b).
  await page.waitForTimeout(350);
  return page.evaluate(
    ({ selektor, tinte }) => {
      const feld = document.querySelector<HTMLElement>(selektor)!;
      if (document.activeElement !== feld) throw new Error(`${selektor} hat keinen Fokus`);
      const s = getComputedStyle(feld);
      const schatten = s.boxShadow.includes(tinte) && s.boxShadow.includes('inset');
      const linie =
        s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0 && s.outlineColor === tinte;
      return schatten || linie;
    },
    { selektor, tinte },
  );
}

/**
 * W33, NF6: Flächen im Ton des Textmarkers (Gelb) außerhalb eines Dokuments. Stellen im Dokument (Klasse
 * `marke`, in Vorschauen von Unterlagen) zählen nicht (W20). Gibt die Klassen der gelben Elemente zurück.
 */
export function gelbAusserhalbVonDokumenten(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const gelb = (wert: string) => {
      const m = wert.match(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/);
      if (!m) return false;
      const [r, g, b, a] = [
        Number(m[1]),
        Number(m[2]),
        Number(m[3]),
        m[4] === undefined ? 1 : Number(m[4]),
      ];
      return a > 0.1 && r >= 200 && g >= 150 && b <= 140 && r - b >= 90 && g - b >= 60;
    };
    return [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((e) => !e.closest('.marke'))
      .filter((e) => gelb(getComputedStyle(e).backgroundColor))
      .map((e) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`);
  });
}
