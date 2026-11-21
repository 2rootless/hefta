import { expect, test } from '@playwright/test';
import { nachbarnPruefen } from './pruef-c';

// C33 (DP50, Liste für Code 10): Die Prüfung „Nachbarn“ selbst. Zwei Wörter in einer Zeile mit 2 px Abstand
// werden gemeldet, mit 10 px nicht; Überlappung zählt. Im Prüfkatalog läuft sie auf Wunsch
// (NACHBARN_ZAEHLEN=1), die Funde stehen in docs/nachbarn-befunde.md.

test.use({ viewport: { width: 390, height: 844 } });

test('C33 meldet zu nahe und überlappende Nachbarn, nicht aber genug Abstand', async ({ page }) => {
  await page.goto('/#/wohnungen');
  await page.locator('main h1').first().waitFor();
  const funde = (abstand: number, klasse = '', woerter = ['Links', 'Rechts']) =>
    page.evaluate(
      ({ abstand, pruefen, klasse, woerter }) => {
        document.querySelector('#c33-probe')?.remove();
        const zeile = document.createElement('div');
        zeile.id = 'c33-probe';
        zeile.style.display = 'flex';
        zeile.style.gap = `${Math.max(abstand, 0)}px`;
        for (const w of woerter) {
          const s = document.createElement('span');
          s.className = `probe-${w === '\u00b7' ? 'punkt' : w.toLowerCase()}${klasse ? ` ${klasse}` : ''}`;
          s.textContent = w;
          // Ohne Text: eine kleine Fläche wie das Personenzeichen.
          if (!w) {
            s.className = `probe-zeichen${klasse ? ` ${klasse}` : ''}`;
            s.style.cssText = 'display:block;width:10px;height:10px;background:#c33';
          }
          zeile.append(s);
        }
        if (abstand < 0) (zeile.lastElementChild as HTMLElement).style.marginLeft = `${abstand}px`;
        document.querySelector('main')!.prepend(zeile);
        // Die Funktion kommt als Text herein, wie bei page.evaluate(nachbarnPruefen).
        return (new Function(`return (${pruefen})()`)() as string[]).filter((f) =>
          f.includes('probe-'),
        );
      },
      { abstand, pruefen: nachbarnPruefen.toString(), klasse, woerter },
    );
  expect(await funde(2)).toHaveLength(1);
  expect(await funde(-6)).toHaveLength(1);
  expect(await funde(10)).toHaveLength(0);
  // PC79: Ausnahmen nur nach Design-Paket. Personenkreise dürfen überlappen; Gegenprobe: Chips nicht.
  expect(await funde(-6, 'kreis')).toHaveLength(0);
  expect(await funde(-6, 'chip')).toHaveLength(1);
  // Reiter mit 4 px Fuge (DP49); Gegenprobe: 2 px sind zu eng, auch für Reiter.
  expect(await funde(4, 'reiter')).toHaveLength(0);
  expect(await funde(2, 'reiter')).toHaveLength(1);
  // Chips mit 6 px sind zu eng (PC79), mit 8 px nicht.
  expect(await funde(6, 'chip')).toHaveLength(1);
  expect(await funde(8, 'chip')).toHaveLength(0);
  // Ein Element ohne Text (Personenzeichen) ist ein Zeichen: 4 px reichen, 2 px nicht.
  expect(await funde(4, '', ['', 'Max'])).toHaveLength(0);
  expect(await funde(2, '', ['', 'Max'])).toHaveLength(1);
  // Der Trennpunkt ist ein Zeichen: 4 px reichen, 2 px nicht.
  expect(await funde(4, '', ['32 Seiten', '\u00b7', '79 KB'])).toHaveLength(0);
  expect(await funde(2, '', ['32 Seiten', '\u00b7', '79 KB'])).toHaveLength(2);
});
