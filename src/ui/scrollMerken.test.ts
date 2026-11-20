import { describe, expect, it } from 'vitest';
import { stelleNachsetzen, type Fenster } from './scrollMerken';

// PC29 (A2) und PC111: Zurück an die alte Stelle, während sich die Seite aufbaut; aber nie gegen jemanden, der in
// der Zeit selbst scrollt. Das Fenster ist nachgestellt: Die Seite wächst je Bild um 300 px.

function fenster(wachsen = 300) {
  let hoehe = 400;
  const bilder: (() => void)[] = [];
  const w: Fenster & { y: number; bild: () => void } = {
    y: 0,
    get scrollY() {
      return this.y;
    },
    scrollTo(_x: number, y: number) {
      this.y = Math.max(0, Math.min(y, hoehe));
    },
    requestAnimationFrame(f: () => void) {
      bilder.push(f);
      return 0;
    },
    bild() {
      hoehe += wachsen;
      for (const f of bilder.splice(0)) f();
    },
  };
  return w;
}

describe('stelleNachsetzen', () => {
  it('erreicht die alte Stelle, sobald die Seite hoch genug ist', () => {
    const w = fenster();
    stelleNachsetzen(1500, w);
    expect(w.y).toBe(400);
    for (let i = 0; i < 6; i++) w.bild();
    expect(w.y).toBe(1500);
  });

  it('hört auf, wenn jemand anderes scrollt, und zieht die Seite nicht zurück', () => {
    const w = fenster();
    stelleNachsetzen(1500, w);
    w.bild();
    // Ein Finger oder ein Sprung zum Link: ganz nach oben.
    w.y = 0;
    for (let i = 0; i < 6; i++) w.bild();
    expect(w.y).toBe(0);
  });

  it('Gegenprobe: das alte Nachsetzen ohne diese Prüfung hätte die Seite zurückgezogen', () => {
    const w = fenster();
    const alt = (ziel: number) => {
      w.scrollTo(0, ziel);
      let runden = 0;
      const nachsetzen = () => {
        w.scrollTo(0, ziel);
        if (Math.abs(w.scrollY - ziel) > 1 && ++runden < 40) w.requestAnimationFrame(nachsetzen);
      };
      w.requestAnimationFrame(nachsetzen);
    };
    alt(1500);
    w.bild();
    w.y = 0;
    for (let i = 0; i < 6; i++) w.bild();
    expect(w.y).toBe(1500);
  });

  it('ohne Ziel oder schon da: kein Nachsetzen', () => {
    const w = fenster();
    stelleNachsetzen(0, w);
    stelleNachsetzen(200, w);
    w.bild();
    expect(w.y).toBe(200);
  });
});
