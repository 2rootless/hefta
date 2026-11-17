#!/usr/bin/env python3
"""Unabhängiger Leser für hefta.json, Fassung 4 (DP72).

Geschrieben nur nach der Anlage zu PD106:
  - format-hefta-json-4-entwurf.md
  - schema.json
  - beispiele/
  - export-entwurf.md, Abschnitt 2
Code von Hefta habe ich nicht gesehen.

Stellen, an denen ich raten musste, sind mit LESART markiert; sie stehen auch in DP72, Abschnitt 2.

Angepasst von Code nach den Entscheidungen der Planung (E208, PC101), sonst unverändert:
  - U5: Wortlaut im Verzeichnis für Text und CSV, in der CSV getrennt mit „ | “
  - U9: Punkt 6 in passt()
  - U1: unbekannte Art der Mitziehenden als „weitere Person“

Aufruf:
  python3 leser72.py DATEI.json [--seiten N] [--schema schema.json] [--csv AUS.csv]
"""
import argparse
import json
import sys
import unicodedata

try:
    import jsonschema
except ImportError:  # der Leser läuft auch ohne; dann nur die eigenen Prüfungen
    jsonschema = None

# Feste Listen, Abschnitt 6. Die Kurzform für Text und CSV steht so nicht in der Beschreibung.
# LESART U5: Kurzform = Bedeutung bis zum ersten Komma, Semikolon oder zur Klammer. Für mietuebernahme_amt
# geht das schief („Nachweis“), darum ist die Kurzform hier ausgeschrieben.
TYP = {  # E208, U5: Wortlaut im Verzeichnis (Abschnitt 6, Spalte „Im Verzeichnis“)
    'selbstauskunft': 'Selbstauskunft',
    'gehaltsnachweis': 'Gehaltsnachweise',
    'einkommen_selbststaendig': 'Einkommensnachweis',
    'einkommen_ausbildung': 'BAföG-Bescheid oder Ausbildungsvertrag',
    'rentenbescheid': 'Rentenbescheid',
    'mietuebernahme_amt': 'Nachweis der Mietübernahme',
    'einkommen_sonstig': 'Sonstiger Einkommensnachweis',
    'bonitaet': 'Bonitätsnachweis',
    'mietzahlung': 'Mietzahlungen',
    'buergschaftserklaerung': 'Bürgschaftserklärung',
    'anschreiben': 'Anschreiben',
    'empfehlung_vorvermieter': 'Empfehlung des Vorvermieters',
    'wbs': 'Wohnberechtigungsschein',
    'ausweiskopie': 'Ausweiskopie',
    'schufa_datenkopie': 'SCHUFA-Datenkopie',
}
# LESART U1, U5: Wortlaut der Rollen für Menschen. Die Beschreibung nennt nur die Bedeutung.
ROLLE = {'hauptmieter': 'im Mietvertrag, zuerst', 'mitmieter': 'im Mietvertrag', 'buerge': 'Bürgschaft'}
# LESART U11: Wortlaut der Vermerke nach DP64; die Beschreibung (Abschnitt 10) nennt keinen.
VERMERK = {'seiten_weggelassen': 'weggelassen', 'verkleinert': 'verkleinert', 'als_bild': 'als Bild übernommen',
           'formularfelder_fest': 'Formularfelder fest'}
MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']


class Abgelehnt(Exception):
    """Die Lesehilfe wird nicht gezeigt, auch nicht zum Teil (Abschnitt 11)."""


def lesen(roh, schema=None):
    """Bytes oder Text → dict. Wirft Abgelehnt mit Grund."""
    if isinstance(roh, bytes):
        if roh.startswith(b'\xef\xbb\xbf'):
            # LESART U10: Abschnitt 2 sagt „ohne BOM“, aber nicht, was ein Leser mit BOM tut. Ich nehme sie an.
            roh = roh[3:]
        try:
            roh = roh.decode('utf-8')
        except UnicodeDecodeError as e:
            raise Abgelehnt(f'kein UTF-8: {e}')
    try:
        lh = json.loads(roh)
    except json.JSONDecodeError as e:
        raise Abgelehnt(f'kein JSON: {e}')
    if not isinstance(lh, dict):
        raise Abgelehnt('kein Objekt')
    f = lh.get('hefta')
    if not isinstance(f, int) or isinstance(f, bool) or f < 4:
        # Abschnitt 13: Fremde Leser müssen Fassung 1 bis 3 nicht lesen.
        raise Abgelehnt(f'Fassung {f!r}: dieser Leser nimmt nur Fassung 4 und höher')
    if schema is not None and jsonschema is not None:
        fehler = sorted(jsonschema.Draft7Validator(schema).iter_errors(lh), key=lambda e: list(e.path))
        if fehler:
            e = fehler[0]
            raise Abgelehnt(f"Schema: {'/'.join(map(str, e.path)) or '(oben)'}: {e.message}")
    return lh


def _personen(lh):
    return lh['haushalt']['personen']


def name_passt(p, lesart='B'):
    """Abschnitt 11, Punkt 5. LESART U2: Punkt 5 sagt nur „vorname + Leerzeichen + nachname“.
    Abschnitt 5 und 7 sagen: ohne Nachnamen nur der Vorname. Lesart A = wörtlich Punkt 5, B = mit Ausnahme."""
    v, n = p.get('vorname', ''), p.get('nachname', '')
    if lesart == 'A':
        soll = v + ' ' + n
    else:
        soll = v if n == '' else v + ' ' + n
    # LESART U10: Vergleich nach NFC; Abschnitt 2 verlangt NFC, sagt aber nicht, ob der Leser normalisiert.
    nfc = lambda s: unicodedata.normalize('NFC', s)
    return nfc(p['name']) == nfc(soll) and v != ''


def passt(lh, seiten=None, lesart_name='B'):
    """Abschnitt 11, Punkte 1, 2 und 5 (3 und 4 brauchen den Text von Seite 1). Gibt eine Liste der Gründe zurück;
    leer heißt: passt."""
    gruende = []
    if seiten is not None and lh['seitenzahl'] != seiten:
        gruende.append(f"Punkt 1: seitenzahl {lh['seitenzahl']}, PDF hat {seiten}")
    bereiche = []
    for p in _personen(lh):
        for u in p['unterlagen']:
            von, bis = u['seiten_mappe']['von'], u['seiten_mappe']['bis']
            # LESART U3: „liegt in der Mappe“ – ab Seite 1 oder ab Seite 2 (Seite 1 ist das Deckblatt)? Ich nehme 2.
            if not (2 <= von <= bis <= lh['seitenzahl']):
                gruende.append(f"Punkt 2: {p['name']}, {u['typ']} auf Seite {von} bis {bis} liegt nicht in der Mappe")
            bereiche.append((von, bis, p['name'], u['typ']))
    bereiche.sort()
    for a, b in zip(bereiche, bereiche[1:]):
        if b[0] <= a[1]:
            gruende.append(f'Punkt 2: {a[2]}, {a[3]} ({a[0]}–{a[1]}) überschneidet {b[2]}, {b[3]} ({b[0]}–{b[1]})')
    for p in _personen(lh):
        if not name_passt(p, lesart_name):
            gruende.append(f"Punkt 5: name „{p['name']}“ ist nicht vorname + nachname")
    # E208, U9: Punkt 6.
    ps = _personen(lh)
    if sum(1 for p in ps if p.get('kontakt') is True) > 1:
        gruende.append('Punkt 6: mehr als eine Kontaktperson')
    haupt = [i for i, p in enumerate(ps) if p['rolle'] == 'hauptmieter']
    if len(haupt) > 1 or (haupt and haupt[0] != 0):
        gruende.append('Punkt 6: Hauptmieter nicht genau zuerst')
    rollen = [p['rolle'] == 'buerge' for p in ps]
    if True in rollen and False in rollen[rollen.index(True):]:
        gruende.append('Punkt 6: Bürgin vor jemandem im Mietvertrag')
    if all(rollen):
        gruende.append('Punkt 6: niemand im Mietvertrag')
    if 'schritt' in lh and lh.get('modus') != 'datensparsam':
        gruende.append('Punkt 6: schritt ohne datensparsam')
    return gruende


def _seiten(u):
    v, b = u['seiten_mappe']['von'], u['seiten_mappe']['bis']
    return f'Seite {v}' if v == b else f'Seiten {v} bis {b}'


def _liste(zahlen):
    z = [str(x) for x in zahlen]
    return z[0] if len(z) == 1 else ', '.join(z[:-1]) + ' und ' + z[-1]


def _vermerk(v):
    art = VERMERK.get(v['art'], 'angepasst')       # Abschnitt 10: unbekannte Art neutral als „angepasst“
    so = v.get('seiten_original')
    t = f"{'Seite' if len(so) == 1 else 'Seiten'} {_liste(so)} {art}" if so else art
    if 'monat' in v:                    # DP64, Regel 2: der Teil vor dem Vermerk, mit Doppelpunkt
        j, m = v['monat'].split('-')
        return f'{MONATE[int(m) - 1]} {j}: {t}'
    if 'datei' in v:
        return f"Datei {v['datei']}: {t}"
    return t[:1].upper() + t[1:]


def als_text(lh):
    z = []
    w = lh['bewerbung'].get('wohnung')
    z.append('Bewerbung um ' + (f"die Wohnung {w['strasse']}" + (f", {w['rest']}" if w.get('rest') else '') if w else 'eine Wohnung'))
    if lh['bewerbung'].get('inserat'):
        z.append(f"Inserat auf {lh['bewerbung']['inserat']['portal']}")
    if lh['bewerbung'].get('einzug'):
        j, m, t = lh['bewerbung']['einzug'].split('-')
        z.append(f'Einzug möglich ab {int(t)}. {MONATE[int(m) - 1]} {j}')
    z.append(f"Fassung {lh['fassung']}, {lh['seitenzahl']} Seiten, erstellt {lh['erstellt']}")
    for p in _personen(lh):
        z.append('')
        z.append(f"{p['name']} – {ROLLE.get(p['rolle'], 'Person')}")   # LESART U1, U5: unbekannte Rolle als „Person“
        if p.get('kontakt'):
            k = [x for x in (p.get('telefon'), p.get('email')) if x]
            z.append('  Kontakt: ' + ', '.join(k))
        for u in p['unterlagen']:
            name = TYP.get(u['typ'], 'Unterlage')                   # Abschnitt 3: unbekannt neutral
            zus = []
            if u.get('monate'):
                a, b = u['monate'][0].split('-'), u['monate'][-1].split('-')
                zus.append(f'{MONATE[int(a[1]) - 1]} bis {MONATE[int(b[1]) - 1]} {b[0]}' if len(u['monate']) > 1 else f'{MONATE[int(a[1]) - 1]} {a[0]}')
            if u.get('vom'):
                j, m, t = u['vom'].split('-')
                zus.append(f'vom {int(t)}. {MONATE[int(m) - 1]} {j}')
            z.append(f"  {name}{', ' + ', '.join(zus) if zus else ''} – {_seiten(u)}")
            for v in u.get('vermerke', []):
                z.append(f'      {_vermerk(v)}')
    mz = lh['haushalt']['mitziehende']
    if mz:
        z.append('')
        z.append('Ziehen mit ein: ' + ', '.join(m['text'] for m in mz))
    if lh.get('loeschwunsch'):
        z.append('')
        z.append(lh['loeschwunsch'])
    return '\n'.join(z)


# CSV nach export-entwurf.md, Abschnitt 2
SPALTEN = ['kennung', 'fassung', 'erstellt', 'wohnung_strasse', 'wohnung_rest', 'strasse', 'hausnummer', 'plz', 'ort', 'lage', 'land',
           'einzug', 'portal', 'person_nr', 'rolle', 'vorname', 'nachname', 'name', 'kontakt', 'telefon', 'telefon_e164', 'email',
           'kinder', 'weitere_erwachsene', 'unterlagen', 'unterlagen_text', 'modus', 'schritt', 'loeschwunsch']


def _zelle(v):
    v = '' if v is None else str(v)
    if v[:1] in ('=', '+', '-', '@', '\t', '\r', '\n'):
        v = "'" + v            # Schutz vor Formeln; LESART U14: erst Apostroph, dann Anführungszeichen
    if any(c in v for c in ';"\r\n'):
        v = '"' + v.replace('"', '""') + '"'
    return v


def csv_zeilen(lh):
    b = lh['bewerbung']; w = b.get('wohnung') or {}; t = w.get('teile') or {}
    kinder = sum(m['anzahl'] for m in lh['haushalt']['mitziehende'] if m['art'] == 'kind')
    erw = sum(m['anzahl'] for m in lh['haushalt']['mitziehende'] if m['art'] == 'erwachsen')
    for i, p in enumerate(_personen(lh), 1):
        k = p.get('kontakt') is True
        yield {
            'kennung': b['kennung'], 'fassung': lh['fassung'], 'erstellt': lh['erstellt'],
            'wohnung_strasse': w.get('strasse', ''), 'wohnung_rest': w.get('rest', ''),
            **{x: t.get(x, '') for x in ('strasse', 'hausnummer', 'plz', 'ort', 'lage', 'land')},
            'einzug': b.get('einzug', ''), 'portal': (b.get('inserat') or {}).get('portal', ''),
            'person_nr': i, 'rolle': p['rolle'], 'vorname': p['vorname'], 'nachname': p['nachname'], 'name': p['name'],
            'kontakt': 'ja' if k else '', 'telefon': p.get('telefon', '') if k else '', 'telefon_e164': p.get('telefon_e164', '') if k else '',
            'email': p.get('email', '') if k else '', 'kinder': kinder, 'weitere_erwachsene': erw,
            'unterlagen': '|'.join(u['typ'] for u in p['unterlagen']),
            'unterlagen_text': ' | '.join(TYP.get(u['typ'], 'Unterlage') for u in p['unterlagen']),
            'modus': lh.get('modus', ''), 'schritt': lh.get('schritt', ''), 'loeschwunsch': lh.get('loeschwunsch', ''),
        }


def als_csv(lesehilfen, bom=True):
    """LESART U4: Abschnitt 2 verlangt BOM, das Beispiel hat keine. bom=True folgt der Beschreibung.
    LESART U13: Kopfzeile mit den Spaltennamen, und auch die letzte Zeile endet mit CRLF; beides zeigt nur das Beispiel."""
    zeilen = [';'.join(SPALTEN)]
    for lh in lesehilfen:
        for r in csv_zeilen(lh):
            zeilen.append(';'.join(_zelle(r[s]) for s in SPALTEN))
    text = ''.join(z + '\r\n' for z in zeilen)
    return (b'\xef\xbb\xbf' if bom else b'') + text.encode('utf-8')


def e164(telefon):
    """Abschnitt 8, Regeln 1 bis 4: für die Gegenprobe gegen die Beispiele."""
    s = telefon.replace('(0)', '')
    for c in ' /-.()':
        s = s.replace(c, '')
    if s.startswith('00'):
        s = '+' + s[2:]
    elif s.startswith('0'):
        s = '+49' + s[1:]
    ok = s.startswith('+') and s[1:2] in '123456789' and s[1:2] != '' and s[1:].isdigit() and 7 <= len(s) - 1 <= 15
    return s if ok else None


def main():
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument('datei'); a.add_argument('--seiten', type=int); a.add_argument('--schema'); a.add_argument('--csv')
    o = a.parse_args()
    schema = json.load(open(o.schema, encoding='utf-8')) if o.schema else None
    try:
        lh = lesen(open(o.datei, 'rb').read(), schema)
    except Abgelehnt as e:
        print('ABGELEHNT:', e); return 2
    g = passt(lh, o.seiten)
    if g:
        print('PASST NICHT, wird nicht gezeigt:'); [print('  -', x) for x in g]; return 3
    print(als_text(lh))
    if o.csv:
        open(o.csv, 'wb').write(als_csv([lh]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
