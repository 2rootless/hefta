import { describe, expect, it } from 'vitest';
import {
  abstand,
  einrasten,
  ganzAnteil,
  GROESSTE_STUFE,
  mitte,
  scrollKorrektur,
  stufeNachGeste,
} from './zweiFinger';

describe('Vergrößern mit zwei Fingern', () => {
  it('folgt dem Abstand der Finger, in Grenzen', () => {
    expect(stufeNachGeste(1, 100, 200, 0.9)).toBe(2);
    expect(stufeNachGeste(2, 100, 50, 0.9)).toBe(1);
    expect(stufeNachGeste(1, 100, 10, 0.9)).toBe(0.9);
    expect(stufeNachGeste(3, 100, 1000, 0.9)).toBe(GROESSTE_STUFE);
    expect(stufeNachGeste(2, 0, 100, 0.9)).toBe(2);
  });

  it('kennt Abstand und Mitte der Finger', () => {
    expect(abstand({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(mitte({ x: 0, y: 2 }, { x: 4, y: 6 })).toEqual({ x: 2, y: 4 });
  });

  it('die ganze Seite ist schmaler als die Fläche, wenn nur die Höhe begrenzt', () => {
    expect(ganzAnteil(100, 100, 100, 200)).toBe(0.5);
    expect(ganzAnteil(100, 1000, 100, 141)).toBe(1);
    expect(ganzAnteil(0, 100, 100, 200)).toBe(1);
  });

  it('rastet nah an einer Stufe ein, sonst bleibt der freie Wert', () => {
    const stufen = [1, 2, 3];
    expect(einrasten(0.8, stufen)).toBe(1);
    expect(einrasten(1.05, stufen)).toBe(1);
    expect(einrasten(1.95, stufen)).toBe(2);
    expect(einrasten(2.5, stufen)).toBe(2.5);
    expect(einrasten(3.77777, stufen)).toBe(3.78);
  });

  it('hält den Punkt unter den Fingern', () => {
    // Das Blatt wächst von 300 auf 600; die Fingermitte lag bei der Hälfte und liegt bei 150.
    expect(scrollKorrektur(0.5, 0, 600, 150)).toBe(150);
    // Es steht schon richtig: nichts zu tun.
    expect(scrollKorrektur(0.5, -150, 600, 150)).toBe(0);
  });
});
