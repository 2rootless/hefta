import { expect, test } from '@playwright/test';
import { pruefen } from './pruef-c';

// wunsch-W3 (Wunschliste Fassung 5, PC47): keine Trennpunkte „·“ im sichtbaren Text der Vermieterseite. Geprüft
// wird in jedem Prüfkatalog als Regel C32, auf jeder Seite und in jeder Ansicht. In der App dürfen die Punkte
// bleiben. Hier die Gegenprobe: Auf der Vermieterseite schlägt ein „·“ an, in der App nicht.
const VERMIETER = '<header class="vs-top"></header><main><p>{text}</p></main>';
const APP = '<main><p>{text}</p></main>';

test('wunsch-W3: Regel C32 schlägt auf der Vermieterseite bei einem Trennpunkt an (Gegenprobe)', async ({
  page,
}) => {
  const c32 = async (html: string, text: string) => {
    await page.setContent(html.replace('{text}', text));
    return ((await page.evaluate(pruefen)) as { c32: string[] }).c32;
  };
  expect(await c32(VERMIETER, 'Max und Lea im Vertrag, drei Personen')).toEqual([]);
  expect(await c32(VERMIETER, 'Max und Lea im Vertrag \u00b7 drei Personen')).toEqual([
    'Max und Lea im Vertrag \u00b7 drei Personen',
  ]);
  // In der App bleibt der Punkt erlaubt.
  expect(await c32(APP, 'Für Petra \u00b7 Bürgin')).toEqual([]);
});
