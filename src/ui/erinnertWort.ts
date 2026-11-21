import type { Einstellungen } from '../domain/modell';

/**
 * W48 (Design, die fünf Sätze): „erinnert“ steht nur, wenn es stimmt: in der App, mit eingeschaltetem Schalter
 * „Unterlagen, bevor sie zu alt werden“ und erlaubten Mitteilungen. Sonst, und immer im Browser, „zeigt“ (W10).
 */
export function erinnertWirklich(o: {
  app: boolean;
  einstellungen: Pick<Einstellungen, 'erinnerungZuAlt'> | null | undefined;
  erlaubt: boolean | null;
}): boolean {
  return o.app && o.einstellungen?.erinnerungZuAlt !== false && o.erlaubt === true;
}
