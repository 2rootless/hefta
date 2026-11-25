// Liest eine Lesehilfe `hefta.json`, Fassung 1 (E218). Streng nach E220 und E223: nur UTF-8, keine doppelten
// Schlüssel, Grenzen für Größe, Tiefe und Anzahl, echte Kalenderwerte, sauberer Text. Was nicht passt, ergibt null
// mit einem Grund (`lesenMitGrund`). Wirft nie (E220, Regel 1). Ob die Lesehilfe zur Mappe passt, prüft `passt()`.
import type { Lesehilfe } from './typen.js';
import { doppelterSchluessel } from './json.js';

export const GRENZE_BYTES = 1 << 20;
export const GRENZE_PERSONEN = 50;
export const GRENZE_UNTERLAGEN = 50;
export const GRENZE_TIEFE = 20;

export type Gelesen = { lesehilfe: Lesehilfe; grund: null } | { lesehilfe: null; grund: string };

class Abgelehnt extends Error {}
const ab = (grund: string): never => {
  throw new Abgelehnt(grund);
};

type Roh = Record<string, unknown>;
const objekt = (v: unknown): v is Roh => !!v && typeof v === 'object' && !Array.isArray(v);
const KENNUNG_LISTE = /^[a-z][a-z0-9_]*$/;
// Wie das Schema: UUID Version 4, klein geschrieben.
const KENNUNG = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const PLZ = /^(\d{5})?$/;
const LAND = /^[A-Z]{2}$/;
const ZEITPUNKT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(Z|[+-]\d{2}:\d{2})$/;
const TAG = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONAT = /^\d{4}-(0[1-9]|1[0-2])$/;
const E164 = /^\+[1-9]\d{6,14}$/;
/** E222: feste Form der Nummer auf dem Deckblatt, Ziffern in Gruppen mit je einem Leerzeichen. */
const FESTE_FORM = /^(\+[1-9]\d*|0\d*)( \d+)*$/;

/** Liest und gibt die Lesehilfe zurück; sonst null. */
export function lesen(eingabe: string | Uint8Array): Lesehilfe | null {
  return lesenMitGrund(eingabe).lesehilfe;
}

/** Wie `lesen()`, mit dem Grund der Ablehnung. */
export function lesenMitGrund(eingabe: string | Uint8Array): Gelesen {
  try {
    return { lesehilfe: streng(eingabe), grund: null };
  } catch (e) {
    return {
      lesehilfe: null,
      grund:
        e instanceof Abgelehnt ? e.message : `nicht lesbar (${(e as Error)?.name ?? 'Fehler'})`,
    };
  }
}

function streng(eingabe: string | Uint8Array): Lesehilfe {
  const bytes = typeof eingabe === 'string' ? new TextEncoder().encode(eingabe) : eingabe;
  if (bytes.length > GRENZE_BYTES) ab(`zu groß (${bytes.length} Bytes)`);
  if ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))
    ab('UTF-16, verlangt ist UTF-8');
  let text: string;
  try {
    // Eine BOM wird überlesen (U10); TextDecoder entfernt sie von selbst.
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return ab('kein UTF-8');
  }
  const doppelt = doppelterSchluessel(text);
  if (doppelt === undefined) ab('kein JSON');
  if (doppelt) ab(`doppelter Schlüssel: ${doppelt}`);
  let roh: unknown;
  try {
    roh = JSON.parse(text);
  } catch {
    return ab('kein JSON');
  }
  if (!objekt(roh)) ab('kein Objekt');
  tiefe(roh);
  const l = roh as Roh;
  if (!Number.isInteger(l.hefta) || (l.hefta as number) < 1)
    ab(`Fassung ${String(l.hefta)}: gelesen wird Fassung 1 und höher`);
  aufbau(l);
  werte(l as unknown as Lesehilfe);
  return l as unknown as Lesehilfe;
}

function tiefe(wurzel: unknown) {
  const stapel: [unknown, number][] = [[wurzel, 0]];
  while (stapel.length) {
    const [v, t] = stapel.pop()!;
    if (t > GRENZE_TIEFE) ab(`zu tief verschachtelt (über ${GRENZE_TIEFE} Ebenen)`);
    if (Array.isArray(v)) for (const x of v) stapel.push([x, t + 1]);
    else if (objekt(v)) for (const x of Object.values(v)) stapel.push([x, t + 1]);
  }
}

const ganz = (v: unknown, min = 1) => Number.isInteger(v) && (v as number) >= min;
const istText = (v: unknown) => typeof v === 'string';

/** Was das Schema verlangt (schema.json): Pflichtfelder und Typen. */
function aufbau(l: Roh) {
  if (!istText(l.erstellt)) ab('erstellt fehlt');
  if (!ganz(l.fassung)) ab('fassung fehlt oder ist keine ganze Zahl ab 1');
  if (!ganz(l.seitenzahl)) ab('seitenzahl fehlt oder ist keine ganze Zahl ab 1');
  const b = l.bewerbung;
  if (!objekt(b)) ab('bewerbung fehlt');
  const bw = b as Roh;
  if (!istText(bw.kennung) || !KENNUNG.test(bw.kennung as string)) ab('bewerbung.kennung fehlt');
  if (bw.wohnung !== null) {
    if (!objekt(bw.wohnung)) ab('bewerbung.wohnung fehlt');
    const w = bw.wohnung as Roh;
    if (!istText(w.strasse) || !istText(w.rest)) ab('wohnung: strasse und rest sind Text');
    if (!(w.strasse as string).length) ab('wohnung.strasse ist leer');
    if (w.teile !== undefined) {
      if (!objekt(w.teile)) ab('wohnung.teile ist kein Objekt');
      const t = w.teile as Roh;
      for (const k of ['strasse', 'hausnummer', 'plz', 'ort', 'lage', 'land'])
        if (!istText(t[k])) ab(`wohnung.teile.${k} fehlt`);
      if (!(t.strasse as string).length || !(t.hausnummer as string).length)
        ab('wohnung.teile: strasse und hausnummer sind nicht leer');
      if (!PLZ.test(t.plz as string)) ab('wohnung.teile.plz: fünf Ziffern oder leer');
      if (!LAND.test(t.land as string)) ab('wohnung.teile.land: zwei Großbuchstaben (ISO 3166-1)');
    }
  }
  if (
    bw.inserat !== undefined &&
    !(objekt(bw.inserat) && istText(bw.inserat.portal) && (bw.inserat.portal as string).length)
  )
    ab('bewerbung.inserat.portal fehlt');
  if (bw.einzug !== undefined && !istText(bw.einzug)) ab('bewerbung.einzug ist kein Text');
  const h = l.haushalt;
  if (!objekt(h) || !Array.isArray(h.personen) || !Array.isArray(h.mitziehende))
    ab('haushalt mit personen und mitziehende fehlt');
  const hh = h as Roh;
  const personen = hh.personen as unknown[];
  if (!personen.length) ab('keine Person');
  if (personen.length > GRENZE_PERSONEN) ab(`mehr als ${GRENZE_PERSONEN} Personen`);
  personen.forEach((p, i) => {
    if (!objekt(p)) ab(`personen[${i}] ist kein Objekt`);
    const q = p as Roh;
    for (const k of ['name', 'vorname', 'nachname'])
      if (!istText(q[k])) ab(`personen[${i}].${k} fehlt`);
    if (!istText(q.rolle) || !KENNUNG_LISTE.test(q.rolle as string)) ab(`personen[${i}].rolle`);
    if (q.kontakt !== undefined && q.kontakt !== true) ab(`personen[${i}].kontakt ist nur true`);
    if (q.ansprech !== undefined && q.ansprech !== true) ab(`personen[${i}].ansprech ist nur true`);
    for (const k of ['telefon', 'telefon_e164', 'email'])
      if (q[k] !== undefined && !istText(q[k])) ab(`personen[${i}].${k} ist kein Text`);
    if (q.email !== undefined && (q.email as string).length < 3) ab(`personen[${i}].email zu kurz`);
    if (!(q.vorname as string).length || !(q.name as string).length)
      ab(`personen[${i}]: name und vorname sind nicht leer`);
    // Schema, dependencies: Telefon und Mail nur bei der Kontaktperson (Fassung 2: `ansprech`, Fassung 1:
    // `kontakt`); E222: telefon genau mit telefon_e164.
    const marke = (l.hefta as number) >= 2 ? 'ansprech' : 'kontakt';
    for (const k of ['telefon', 'email'])
      if (q[k] !== undefined && q[marke] !== true) ab(`personen[${i}].${k} ohne ${marke}`);
    if ((q.telefon === undefined) !== (q.telefon_e164 === undefined))
      ab(`personen[${i}]: telefon und telefon_e164 nur zusammen`);
    if (!Array.isArray(q.unterlagen)) ab(`personen[${i}].unterlagen fehlt`);
    const us = q.unterlagen as unknown[];
    if (us.length > GRENZE_UNTERLAGEN)
      ab(`personen[${i}]: mehr als ${GRENZE_UNTERLAGEN} Unterlagen`);
    us.forEach((u, j) => {
      const wo = `personen[${i}].unterlagen[${j}]`;
      if (!objekt(u)) ab(`${wo} ist kein Objekt`);
      const v = u as Roh;
      if (!istText(v.typ) || !KENNUNG_LISTE.test(v.typ as string)) ab(`${wo}.typ`);
      const s = v.seiten_mappe;
      if (!objekt(s) || !ganz(s.von) || !ganz(s.bis)) ab(`${wo}.seiten_mappe`);
      if (v.monate !== undefined && !(Array.isArray(v.monate) && v.monate.length))
        ab(`${wo}.monate ist eine Liste`);
      if (v.vom !== undefined && !istText(v.vom)) ab(`${wo}.vom ist kein Text`);
      if (v.vermerke !== undefined && !(Array.isArray(v.vermerke) && v.vermerke.every(objekt)))
        ab(`${wo}.vermerke ist eine Liste`);
      for (const m of (v.vermerke ?? []) as Roh[]) {
        if (!istText(m.art) || !KENNUNG_LISTE.test(m.art as string)) ab(`${wo}: vermerk.art`);
        const so = m.seiten_original;
        if (
          so !== undefined &&
          !(
            Array.isArray(so) &&
            so.length &&
            so.every((x) => ganz(x)) &&
            new Set(so).size === so.length
          )
        )
          ab(`${wo}: vermerk.seiten_original ist eine Liste verschiedener ganzer Zahlen ab 1`);
        if (m.art === 'seiten_weggelassen' && so === undefined)
          ab(`${wo}: seiten_weggelassen ohne seiten_original`);
        if (m.datei !== undefined && !ganz(m.datei))
          ab(`${wo}: vermerk.datei ist eine ganze Zahl ab 1`);
      }
    });
  });
  (hh.mitziehende as unknown[]).forEach((m, i) => {
    if (!objekt(m) || !istText(m.text) || !ganz(m.anzahl) || !istText(m.art))
      ab(`mitziehende[${i}]: text, anzahl ab 1 und art`);
    if (!KENNUNG_LISTE.test((m as Roh).art as string)) ab(`mitziehende[${i}].art`);
  });
  if (
    l.loeschwunsch !== undefined &&
    !(istText(l.loeschwunsch) && (l.loeschwunsch as string).length)
  )
    ab('loeschwunsch ist kein Text oder leer');
  if (l.schritt !== undefined && !istText(l.schritt)) ab('schritt ist kein Text');
}

/** E220, Regel 2: echte Kalenderwerte. */
function tag(s: string, feld: string) {
  const m = TAG.exec(s);
  const [j, mo, t] = m ? [+m[1]!, +m[2]!, +m[3]!] : [0, 0, 0];
  const d = new Date(Date.UTC(j, mo - 1, t));
  if (!m || d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t)
    ab(`${feld}: „${s}“ ist kein Kalenderdatum`);
}

function zeitpunkt(s: string) {
  const m = ZEITPUNKT.exec(s);
  if (!m) return ab(`erstellt: „${s}“ hat nicht die Form JJJJ-MM-TTThh:mm:ss±hh:mm`);
  tag(`${m[1]}-${m[2]}-${m[3]}`, 'erstellt');
  if (+m[4]! > 23 || +m[5]! > 59 || +m[6]! > 59) ab(`erstellt: „${s}“ ist kein Zeitpunkt`);
  if (m[7] !== 'Z') {
    const [hh, mm] = m[7]!.slice(1).split(':').map(Number);
    if (hh! > 14 || mm! > 59) ab(`erstellt: „${s}“ hat keine gültige Zeitzone`);
  }
}

/** E220 Regel 3, E223 V16: NFC, kein Steuer- oder unsichtbares Formatzeichen, kein Leerzeichen am Rand. */
const UNSICHTBAR = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}]/u;
function sauber(s: string, feld: string, { leer = false, name = false } = {}) {
  if (s === '' && leer) return;
  if (s.normalize('NFC') !== s) ab(`${feld}: nicht in NFC`);
  const zeichen = UNSICHTBAR.exec(s);
  if (zeichen)
    ab(
      `${feld}: Steuer- oder unsichtbares Zeichen (U+${zeichen[0].codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`,
    );
  if (s !== s.trim() || !s.trim()) ab(`${feld}: Leerzeichen am Rand oder nur Leerzeichen`);
  if (name && /\s\s/.test(s)) ab(`${feld}: zwei Leerzeichen hintereinander`);
  // V18: Namen nur in lateinischer Schrift (dazu Leerzeichen, Bindestrich, Apostroph, Akzente).
  if (name && [...s].some((c) => /\p{L}/u.test(c) && !/\p{Script=Latin}/u.test(c)))
    ab(`${feld}: Buchstaben außerhalb der lateinischen Schrift`);
}

/** E222, DP77 Abschnitt 4: Bei +49 sind die Ziffern von `telefon` gleich „0“ und den Ziffern danach, sonst ist
 * `telefon` ohne Leerzeichen gleich `telefon_e164`. Leser rechnen nie selbst um. */
export function telefonPasst(telefon: string, e164: string): boolean {
  if (!FESTE_FORM.test(telefon) || !E164.test(e164)) return false;
  if (e164.startsWith('+49'))
    return telefon.startsWith('0') && telefon.replace(/\D/g, '') === `0${e164.slice(3)}`;
  return telefon.startsWith('+') && telefon.replaceAll(' ', '') === e164;
}

/** Was das Schema nicht prüft: echte Daten, sauberer Text, abgeleitete Felder. */
function werte(l: Lesehilfe) {
  zeitpunkt(l.erstellt);
  const b = l.bewerbung;
  if (b.einzug !== undefined) tag(b.einzug, 'einzug');
  const w = b.wohnung;
  if (w) {
    sauber(w.strasse, 'wohnung.strasse');
    sauber(w.rest, 'wohnung.rest', { leer: true });
    for (const [k, v] of Object.entries(w.teile ?? {}))
      if (!k.startsWith('x_')) {
        if (typeof v !== 'string') ab(`teile.${k} ist kein Text`);
        sauber(v, `teile.${k}`, { leer: true });
      }
  }
  if (b.inserat) sauber(b.inserat.portal, 'inserat.portal');
  if (l.loeschwunsch !== undefined) sauber(l.loeschwunsch, 'loeschwunsch');
  l.haushalt.personen.forEach((p, i) => {
    sauber(p.name, `personen[${i}].name`, { name: true });
    sauber(p.vorname ?? '', `personen[${i}].vorname`, { name: true });
    sauber(p.nachname ?? '', `personen[${i}].nachname`, { name: true, leer: true });
    for (const k of ['telefon', 'email'] as const)
      if (p[k] !== undefined) sauber(p[k]!, `personen[${i}].${k}`);
    // E222: `telefon_e164` ist Pflicht, sobald es `telefon` gibt; ohne `telefon` steht es nicht auf dem Papier (L78-2).
    if (p.telefon !== undefined && p.telefon_e164 === undefined)
      ab(`personen[${i}]: telefon ohne telefon_e164`);
    if (p.telefon === undefined && p.telefon_e164 !== undefined)
      ab(`personen[${i}]: telefon_e164 ohne telefon`);
    if (p.telefon !== undefined && !telefonPasst(p.telefon, p.telefon_e164!))
      ab(`personen[${i}].telefon_e164 „${p.telefon_e164}“ ist nicht „${p.telefon}“`);
    p.unterlagen.forEach((u, j) => {
      if (u.vom !== undefined) tag(u.vom, `personen[${i}].unterlagen[${j}].vom`);
      for (const m of u.monate ?? [])
        if (typeof m !== 'string' || !MONAT.test(m))
          ab(`personen[${i}].unterlagen[${j}].monate: „${String(m)}“ ist kein Monat`);
      for (const v of u.vermerke ?? [])
        if (v.monat !== undefined && !MONAT.test(v.monat)) ab('vermerk.monat ist kein Monat');
    });
  });
  for (const m of l.haushalt.mitziehende) sauber(m.text, 'mitziehende.text');
}
