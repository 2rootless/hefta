#!/usr/bin/env python3
"""Fremder Leser für hefta.json, Fassung 1 (DP78, Design). Stand des Lesers: Fassung 4 (DP82). Grundlage: leser76.py (DP76), davor leser72.py aus CP66.

Geschrieben nach FORMAT.md (CP66), dem Stresskatalog aus PD116 und E216 bis E220. Die acht Regeln aus E220 (PC110)
liegen Design nicht vor. Gebaut ist darum nach der Spalte „soll“ des Katalogs. Jede Stelle, an der ich raten musste,
trägt LESART und eine Nummer V1 bis V24. Die Liste steht in DP76, Abschnitt 2.

Neu gegenüber CP66:
  - lesen(): streng. Echte Kalenderdaten, Monate 01 bis 12, `erstellt` genau nach Muster, keine doppelten Schlüssel,
    Grenzen für Größe und Tiefe, nur UTF-8, sauberer Text in allen Feldern, `telefon_e164` aus `telefon` abgeleitet.
  - passt(): Punkt 6 mit genau einem Hauptmieter (E216); Monate aufsteigend und ohne Doppel.
  - papier(): Punkt 5 des Katalogs, Bindung an das Papier. Was der Leser zeigt, steht auf dem Deckblatt oder im
    Verzeichnis „Was beiliegt“. Gelesen wird mit pypdf und mit pdfplumber.
  - e164(): T1 bis T4. als_text(): Monate über den Jahreswechsel (S25). CSV: `telefon_e164` ohne Apostroph (T5).

Neu in DP78 (nach E222 bis E224, PD118, PD119):
  - Telefon (E222, DP77): `telefon` steht in fester Form, `telefon_e164` ist Pflicht. Geprüft wird nur noch die Regel
    für Leser aus DP77: bei +49 sind die Ziffern von `telefon` „0“ und die Ziffern nach +49, sonst ist `telefon` ohne
    Leerzeichen gleich `telefon_e164`. e164() bleibt als Hilfe, prüft aber nichts mehr.
  - Mitziehende (V22): `text` ist die feste Form aus `anzahl` und `art` („Ein Kind“, „Zwei Kinder“, „Eine weitere
    Person“, „Zwei weitere Personen“, ab 13 mit Ziffern). Jede bekannte Art höchstens einmal.
  - `modus` (V23) gehört nicht mehr zu Fassung 1: nicht gezeigt, nicht in der CSV, nicht geprüft.
  - `schritt` (V23, DP78): gebunden an den festen Satz je Schritt, direkt unter dem Satz zum Haushalt auf dem
    Deckblatt. Ein Satz zum Schritt ohne passendes `schritt` passt nicht.
  Neue Stellen, an denen ich raten musste, tragen LESART L78-1 bis L78-4 (DP78, Abschnitt 4).

Protokoll, Fassung 2 des Lesers (DP80, nach PD122 und CP71):
  - D1: Verzeichnis nach V6, die Seiten in derselben Zeile („Selbstauskunft – Seite 2“). Die Zahl allein gilt weiter.
    LESART L78-5, bis ich die 95 Mappen aus CP71 habe.
  - D2: Text, der nicht in NFC steht, wird abgelehnt (V16). S11 heißt jetzt „nicht gezeigt“.
  Sonst unverändert. Die Fassung 1 des Lesers liegt als leser78-fassung1.py daneben.

Protokoll, Fassung 3 des Lesers (DP81, nach PD123, F1):
  - Das Verzeichnis kennt in Fassung 1 genau zwei Formen (V6): „Selbstauskunft – Seite 2“ und
    „Gehaltsnachweise, September bis November – Seiten 3 bis 5“. Nur diese bindet der Leser.
  - Die Lesart L78-5 entfällt: „Seiten 2–3“ und die Zahl allein passen nicht mehr. Fassung 2 liegt als leser78-fassung2.py daneben.

Protokoll, Fassung 4 des Lesers (DP82, nach PD124):
  - V7 streng: „Fassung n vom …“ steht in allen 95 Mappen aus PD124 (außer den zwei Mappen aus dem alten Bau). Fehlt die
    Zeile, passt die Mappe nicht mehr. Die Lesart V7 (fehlende Zeile heißt Fassung 1) entfällt. Fassung 3 liegt daneben.

Aufruf:
  python3 -I leser78.py DATEI.pdf          (liest den Anhang hefta.json und prüft alles, auch gegen das Papier)
  python3 -I leser78.py DATEI.json [--seiten N] [--schema schema.json] [--csv AUS.csv]
"""
import argparse, datetime, json, re, sys, unicodedata

try:
    import jsonschema
except ImportError:
    jsonschema = None

VERZEICHNIS = {  # FORMAT, Abschnitt 6, Spalte „Im Verzeichnis“
    'selbstauskunft': 'Selbstauskunft', 'gehaltsnachweis': 'Gehaltsnachweise', 'einkommen_selbststaendig': 'Einkommensnachweis',
    'einkommen_ausbildung': 'BAföG-Bescheid oder Ausbildungsvertrag', 'rentenbescheid': 'Rentenbescheid',
    'mietuebernahme_amt': 'Nachweis der Mietübernahme', 'einkommen_sonstig': 'Sonstiger Einkommensnachweis', 'bonitaet': 'Bonitätsnachweis',
    'mietzahlung': 'Mietzahlungen', 'buergschaftserklaerung': 'Bürgschaftserklärung', 'anschreiben': 'Anschreiben',
    'empfehlung_vorvermieter': 'Empfehlung des Vorvermieters', 'wbs': 'Wohnberechtigungsschein', 'ausweiskopie': 'Ausweiskopie',
    'schufa_datenkopie': 'SCHUFA-Datenkopie'}
TYP = VERZEICHNIS
ROLLE = {'hauptmieter': 'im Mietvertrag, zuerst', 'mitmieter': 'im Mietvertrag', 'buerge': 'Bürgschaft'}
VERMERK = {'seiten_weggelassen': 'weggelassen', 'verkleinert': 'verkleinert', 'als_bild': 'als Bild übernommen', 'formularfelder_fest': 'Formularfelder fest'}
MONATE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
SCHRITT_SATZ = {  # DP78: fester Satz je Schritt. Eine Änderung heißt Fassung 2 (wie V5).
    'besichtigung': 'Zur Besichtigung nur dieses Deckblatt. Die Unterlagen folgen auf Wunsch.',
    'will_wohnung': 'Zum Mietwunsch ohne Einkommens- und Bonitätsnachweise. Beide folgen nach der Zusage.',
    'zusage': 'Zum Vertrag ohne Ausweiskopie. Der Ausweis wird bei der Unterschrift vorgezeigt.'}
ZAHLWORT = ['', '', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun', 'zehn', 'elf', 'zwölf']   # wie Hefta (V22)
FESTE_FORM = re.compile(r'(\+[1-9]\d*|0\d*)( \d+)*')     # E222: Ziffern in Gruppen, ein Leerzeichen dazwischen


def mitziehend_text(anzahl, art):
    """V22: feste Form der Mitziehenden, wie Hefta sie setzt. Unbekannte Art: keine feste Form (LESART L78-1)."""
    if art not in ('kind', 'erwachsen'):
        return None
    eins, viele = ('Ein Kind', 'Kinder') if art == 'kind' else ('Eine weitere Person', 'weitere Personen')
    if anzahl == 1:
        return eins
    w = f"{ZAHLWORT[anzahl] if anzahl < len(ZAHLWORT) else anzahl} {viele}"
    return w[:1].upper() + w[1:]


def telefon_passt(telefon, e):
    """E222: Regel für Leser aus DP77 (angenommen mit E224)."""
    if not FESTE_FORM.fullmatch(telefon or '') or not E164.fullmatch(e or ''):
        return False
    if e.startswith('+49'):
        return telefon.startswith('0') and re.sub(r'\D', '', telefon) == '0' + e[3:]
    return telefon.startswith('+') and telefon.replace(' ', '') == e


GRENZE_BYTES = 1 << 20      # LESART V14: Die Beschreibung nennt keine Grenzen. 1 MiB, 50 Personen, 50 Unterlagen je Person, Tiefe 20.
GRENZE_PERSONEN, GRENZE_UNTERLAGEN, GRENZE_TIEFE = 50, 50, 20


class Abgelehnt(Exception):
    """Die Lesehilfe wird nicht gezeigt, auch nicht zum Teil."""


# ---------------------------------------------------------------- lesen
def _ohne_doppel(paare):
    schluessel = [k for k, _ in paare]
    if len(schluessel) != len(set(schluessel)):
        # LESART V13: Die Beschreibung sagt nicht, was bei doppelten Schlüsseln gilt. Ich lehne ab.
        # Folge: JSON.parse in JavaScript nimmt still den letzten Wert. Gleiches Urteil braucht dort einen eigenen Parser.
        raise Abgelehnt('doppelter Schlüssel: ' + ', '.join(sorted({k for k in schluessel if schluessel.count(k) > 1})))
    return dict(paare)


def _zahl(s):
    # S14: „1.0“ gilt wie 1, so wie JavaScript es ohnehin sieht. LESART V15: gilt für jede ganze Zahl, nicht nur für `hefta`.
    f = float(s)
    return int(f) if f.is_integer() and abs(f) < 2 ** 53 else f


def _tiefe(x, t=0):
    if t > GRENZE_TIEFE:
        raise Abgelehnt(f'zu tief verschachtelt (über {GRENZE_TIEFE} Ebenen)')
    for v in (x.values() if isinstance(x, dict) else x if isinstance(x, list) else ()):
        _tiefe(v, t + 1)


def _tag(s, feld):
    try:
        return datetime.date.fromisoformat(s)
    except (ValueError, TypeError):
        raise Abgelehnt(f'{feld}: „{s}“ ist kein Kalenderdatum')


def _monat(s, feld):
    if not re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', s or ''):
        raise Abgelehnt(f'{feld}: „{s}“ ist kein Monat')
    return s


ERSTELLT = re.compile(r'\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(Z|[+-]\d{2}:\d{2})')
def _zeitpunkt(s):
    # S4, S4b: genau JJJJ-MM-TTThh:mm:ss mit Z oder ±hh:mm; ohne Sekunden, mit Millisekunden, „+0100“: abgelehnt.
    if not ERSTELLT.fullmatch(s or ''):
        raise Abgelehnt(f'erstellt: „{s}“ hat nicht die Form JJJJ-MM-TTThh:mm:ss±hh:mm')
    try:
        return datetime.datetime.fromisoformat(s.replace('Z', '+00:00'))
    except ValueError:
        raise Abgelehnt(f'erstellt: „{s}“ ist kein Zeitpunkt')


UNSICHTBAR = lambda c: unicodedata.category(c) in ('Cc', 'Cf', 'Zl', 'Zp', 'Co', 'Cn')
def _text(s, feld, name=False, leer=False):
    """S7 bis S10, S27: sauberer Text. LESART V16: gilt für jedes Textfeld, das ein Leser zeigt, nicht nur für Namen."""
    if not isinstance(s, str):
        raise Abgelehnt(f'{feld}: kein Text')
    if s == '' and leer:
        return s
    if any(UNSICHTBAR(c) for c in s):
        raise Abgelehnt(f'{feld}: Steuer- oder unsichtbares Zeichen (U+{ord(next(c for c in s if UNSICHTBAR(c))):04X})')
    if s != s.strip() or s.strip() == '':
        raise Abgelehnt(f'{feld}: Leerzeichen am Rand oder nur Leerzeichen')
    if not unicodedata.is_normalized('NFC', s):
        raise Abgelehnt(f'{feld}: nicht in NFC (V16, PD122 D2)')           # S11 jetzt abgelehnt
    if name and re.search(r'\s\s', s):
        raise Abgelehnt(f'{feld}: zwei Leerzeichen hintereinander')       # LESART V17: S27 abgelehnt
    if name and _schriften(s) > 1:
        raise Abgelehnt(f'{feld}: Buchstaben aus mehreren Schriften')      # LESART V18: Mischschrift (A4, kyrillisches „а“)
    return s


def _schriften(s):
    sch = set()
    for c in s:
        if c.isalpha():
            n = unicodedata.name(c, '')
            sch.add(n.split(' ')[0] if n.split(' ')[0] in ('LATIN', 'CYRILLIC', 'GREEK', 'ARABIC', 'HEBREW', 'CJK', 'HANGUL', 'HIRAGANA', 'KATAKANA', 'ARMENIAN', 'GEORGIAN') else 'ANDERE')
    return len(sch)


def lesen(roh, schema=None):
    """Bytes oder Text → dict. Wirft Abgelehnt mit Grund. Wirft nie etwas anderes (S1, S22)."""
    try:
        return _lesen(roh, schema)
    except Abgelehnt:
        raise
    except RecursionError:
        raise Abgelehnt('zu tief verschachtelt')
    except Exception as e:  # ein fremder Leser darf nie abstürzen
        raise Abgelehnt(f'nicht lesbar ({type(e).__name__})')


def _lesen(roh, schema):
    if isinstance(roh, str):
        roh = roh.encode('utf-8')
    if len(roh) > GRENZE_BYTES:
        raise Abgelehnt(f'zu groß ({len(roh)} Bytes)')
    if roh[:2] in (b'\xff\xfe', b'\xfe\xff'):
        raise Abgelehnt('UTF-16, verlangt ist UTF-8')                      # S24
    if roh.startswith(b'\xef\xbb\xbf'):
        roh = roh[3:]                                                       # LESART U10 aus DP72, bleibt
    try:
        text = roh.decode('utf-8')
    except UnicodeDecodeError as e:
        raise Abgelehnt(f'kein UTF-8: {e.reason}')
    try:
        lh = json.loads(text, object_pairs_hook=_ohne_doppel, parse_float=_zahl)
    except json.JSONDecodeError as e:
        raise Abgelehnt(f'kein JSON: {e.msg}')
    if not isinstance(lh, dict):
        raise Abgelehnt('kein Objekt')
    _tiefe(lh)
    f = lh.get('hefta')
    if not isinstance(f, int) or isinstance(f, bool) or f < 1:
        raise Abgelehnt(f'Fassung {f!r}: dieser Leser nimmt Fassung 1 und höher')
    if schema is not None and jsonschema is not None:
        fehler = sorted(jsonschema.Draft7Validator(schema).iter_errors(lh), key=lambda e: list(e.path))
        if fehler:
            e = fehler[0]
            raise Abgelehnt(f"Schema: {'/'.join(map(str, e.path)) or '(oben)'}: {e.message}")
    _werte(lh)
    return lh


def _werte(lh):
    """Was das Schema nicht prüft: echte Daten, sauberer Text, Grenzen, abgeleitete Felder."""
    _zeitpunkt(lh.get('erstellt'))
    b = lh.get('bewerbung') or {}
    if b.get('einzug') is not None:
        _tag(b['einzug'], 'einzug')
    w = b.get('wohnung')
    if w:
        _text(w.get('strasse'), 'wohnung.strasse')
        _text(w.get('rest'), 'wohnung.rest', leer=True)
        for k, v in (w.get('teile') or {}).items():
            if not k.startswith('x_'):
                _text(v, f'teile.{k}', leer=True)
    if (b.get('inserat') or {}).get('portal') is not None:
        _text(b['inserat']['portal'], 'inserat.portal')
    if lh.get('loeschwunsch') is not None:
        _text(lh['loeschwunsch'], 'loeschwunsch')
    ps = lh['haushalt']['personen']
    if len(ps) > GRENZE_PERSONEN:
        raise Abgelehnt(f'mehr als {GRENZE_PERSONEN} Personen')
    for i, p in enumerate(ps):
        for k in ('name', 'vorname'):
            _text(p.get(k), f'personen[{i}].{k}', name=True)
        _text(p.get('nachname'), f'personen[{i}].nachname', name=True, leer=True)
        for k in ('telefon', 'email'):
            if p.get(k) is not None:
                _text(p[k], f'personen[{i}].{k}')
        if p.get('telefon') is not None:
            if p.get('telefon_e164') is None:
                raise Abgelehnt(f"personen[{i}]: telefon ohne telefon_e164 (E222: Pflicht)")
            if not telefon_passt(p['telefon'], p['telefon_e164']):
                # A12: Eine fremde Nummer in telefon_e164 bei passender Nummer auf dem Deckblatt. T1, T3: keine feste Form.
                raise Abgelehnt(f"personen[{i}]: telefon „{p['telefon']}“ und telefon_e164 „{p['telefon_e164']}“ passen nicht nach der Regel aus E222")
        elif p.get('telefon_e164') is not None:
            raise Abgelehnt(f"personen[{i}]: telefon_e164 ohne telefon")                 # LESART L78-2: steht nicht auf dem Papier
        if len(p['unterlagen']) > GRENZE_UNTERLAGEN:
            raise Abgelehnt(f'personen[{i}]: mehr als {GRENZE_UNTERLAGEN} Unterlagen')
        for j, u in enumerate(p['unterlagen']):
            if u.get('vom') is not None:
                _tag(u['vom'], f'personen[{i}].unterlagen[{j}].vom')
            for m in u.get('monate') or []:
                _monat(m, f'personen[{i}].unterlagen[{j}].monate')
            for v in u.get('vermerke') or []:
                if v.get('monat') is not None:
                    _monat(v['monat'], 'vermerk.monat')
    for m in lh['haushalt']['mitziehende']:
        _text(m.get('text'), 'mitziehende.text')


# ---------------------------------------------------------------- passt (Abschnitt 11, Punkte 1, 2, 5, 6)
def _personen(lh):
    return lh['haushalt']['personen']


def name_passt(p):
    v, n = p.get('vorname', ''), p.get('nachname', '')
    soll = v if n == '' else v + ' ' + n
    nfc = lambda s: unicodedata.normalize('NFC', s)
    return nfc(p['name']) == nfc(soll) and v != ''


def passt(lh, seiten=None):
    """Gründe, warum die Lesehilfe nicht zur Mappe passt; leer heißt: passt (ohne Papier, siehe papier())."""
    g = []
    if seiten is not None and lh['seitenzahl'] != seiten:
        g.append(f"Punkt 1: seitenzahl {lh['seitenzahl']}, PDF hat {seiten}")
    bereiche = []
    for p in _personen(lh):
        for u in p['unterlagen']:
            von, bis = u['seiten_mappe']['von'], u['seiten_mappe']['bis']
            if not (2 <= von <= bis <= lh['seitenzahl']):
                g.append(f"Punkt 2: {p['name']}, {u['typ']} auf Seite {von} bis {bis} liegt nicht in der Mappe")
            bereiche.append((von, bis, p['name'], u['typ']))
            m = u.get('monate') or []
            if m != sorted(m) or len(m) != len(set(m)):
                g.append(f"Monate bei {p['name']}, {u['typ']}: nicht aufsteigend oder doppelt")       # S5, S6
    bereiche.sort()
    for a, b in zip(bereiche, bereiche[1:]):
        if b[0] <= a[1]:
            g.append(f'Punkt 2: {a[2]}, {a[3]} ({a[0]}–{a[1]}) überschneidet {b[2]}, {b[3]} ({b[0]}–{b[1]})')
    for p in _personen(lh):
        if not name_passt(p):
            g.append(f"Punkt 5: name „{p['name']}“ ist nicht vorname + nachname")
    ps = _personen(lh)
    if sum(1 for p in ps if p.get('kontakt') is True) > 1:
        g.append('Punkt 6: mehr als eine Kontaktperson')
    haupt = [i for i, p in enumerate(ps) if p['rolle'] == 'hauptmieter']
    if haupt != [0]:
        g.append('Punkt 6: nicht genau ein Hauptmieter an erster Stelle (E216)')                    # S12, S13
    rollen = [p['rolle'] == 'buerge' for p in ps]
    if True in rollen and False in rollen[rollen.index(True):]:
        g.append('Punkt 6: Bürgin vor jemandem im Mietvertrag')
    mz = lh['haushalt']['mitziehende']                                                         # V22
    arten = [m['art'] for m in mz if m['art'] in ('kind', 'erwachsen')]
    if len(arten) != len(set(arten)):
        g.append('Punkt 6: Mitziehende derselben Art zweimal (V22)')
    for m in mz:
        soll = mitziehend_text(m['anzahl'], m['art'])
        if soll is not None and unicodedata.normalize('NFC', m['text']) != soll:
            g.append(f"Punkt 6: Mitziehende „{m['text']}“ ist nicht die feste Form zu Anzahl {m['anzahl']}, Art {m['art']} („{soll}“, V22)")   # A19
    return g


# ---------------------------------------------------------------- papier (Katalog, Punkt 5: Bindung an das Papier)
def _norm(t, bindestrich=False):
    """LESART V3, V4: NFC, weiche Trennstriche weg, geschützte Leerzeichen als Leerzeichen, Kleinschreibung nach
    Unicode (str.lower, wie toLowerCase in JavaScript, nicht casefold), Leerraum zu einem Leerzeichen.
    bindestrich=True: Zeilenumbruch direkt nach einem Bindestrich fällt weg („Beispielsdorf-⏎Mustermann“)."""
    t = unicodedata.normalize('NFC', t or '').replace('­', '').replace(' ', ' ').replace(' ', ' ')
    if bindestrich:
        t = re.sub(r'([-‐])[ \t]*\n\s*', r'\1', t)
    return re.sub(r'\s+', ' ', t).strip().lower()


def _wort(phrase, text):
    """Ganze Wörter (S36). LESART V3: Grenze ist Leerraum, Satzzeichen außer Bindestrich und Apostroph, oder Rand."""
    p = re.escape(phrase)
    return re.search(r"(?<![\w\-‐'’`])" + p + r"(?![\w\-‐'’`])", text) is not None


def _ohne_leer(s):
    return re.sub(r'\s+', '', s)


def _datum(tag):
    d = datetime.date.fromisoformat(tag)
    return f'{d.day}. {MONATE[d.month - 1]} {d.year}'


def _monate_text(m):
    """S25. LESART V6: Im Verzeichnis steht im selben Jahr „September bis November“ ohne Jahr, sonst mit Jahren."""
    a, b = [x.split('-') for x in (m[0], m[-1])]
    if len(m) == 1:
        return f'{MONATE[int(a[1]) - 1]} {a[0]}'
    if a[0] == b[0]:
        return f'{MONATE[int(a[1]) - 1]} bis {MONATE[int(b[1]) - 1]}'
    return f'{MONATE[int(a[1]) - 1]} {a[0]} bis {MONATE[int(b[1]) - 1]} {b[0]}'


def _seitenangabe(u):
    v, b = u['seiten_mappe']['von'], u['seiten_mappe']['bis']
    return f'{v}' if v == b else f'{v}–{b}'


def _seiten_re(u):
    """V6 (PD123, F1): genau zwei Formen, „– Seite 2“ und „– Seiten 3 bis 5“, in derselben Zeile wie die Unterlage."""
    v, b = u['seiten_mappe']['von'], u['seiten_mappe']['bis']
    if v == b:
        return r'–[ \t]+seite[ \t]+' + str(v)
    return r'–[ \t]+seiten[ \t]+' + f'{v}' + r' bis ' + f'{b}'


class _Text:
    """Text einer Lesart: normierte Zeilen (V4) und daraus flache Fassungen. Überschriften erkennt der Leser nur als
    ganze Zeile (LESART V5), sonst trifft „Zwei im Mietvertrag, … Eine Person bürgt.“ auf dem Deckblatt."""
    def __init__(self, roh):
        self.zeilen = [z for z in (_norm(x) for x in (roh or '').split('\n')) if z]
        self.flach = ' '.join(self.zeilen)
        self.flach_b = re.sub(r'([-\u2010]) ', r'\1', self.flach) if False else self._bindestrich(self.zeilen)

    @staticmethod
    def _bindestrich(zeilen):
        aus = ''
        for z in zeilen:
            aus += (z if aus.endswith(('-', '\u2010')) or not aus else ' ' + z)
        return aus

    def abschnitt(self, kopf, stopp):
        """Zeilen nach der Zeile `kopf` bis zur nächsten Zeile aus `stopp` (oder die mit einem Eintrag aus `stopp` beginnt)."""
        if kopf not in self.zeilen:
            return None
        i = self.zeilen.index(kopf) + 1
        j = next((k for k in range(i, len(self.zeilen)) if self.zeilen[k] in stopp or self.zeilen[k].startswith(('fassung ', 'erstellt mit hefta', 'seite 1 von'))), len(self.zeilen))
        z = self.zeilen[i:j]
        return ' '.join(z), self._bindestrich(z)


KOPF = ['im mietvertrag', 'ziehen mit ein', 'bürgt', 'kontakt', 'was beiliegt']


def papier_texte(pdf):
    """Text von Deckblatt und Verzeichnis, in zwei Lesarten. LESART V1: Verzeichnis = alle Seiten vor der ersten
    Unterlage. LESART V2: Reihenfolge des Inhalts (pypdf, wie pdf.js) und nach Lage (pdfplumber); eine reicht."""
    from pypdf import PdfReader
    import pdfplumber
    rd = PdfReader(pdf)
    return rd, [lambda n: '\n'.join((rd.pages[i].extract_text() or '') for i in range(n)),
                lambda n, _p=pdfplumber.open(pdf): '\n'.join((_p.pages[i].extract_text() or '') for i in range(n))]


def papier(lh, pdf):
    """Gründe, warum etwas, das der Leser zeigt, nicht auf dem Papier steht. Leer: alles gebunden.
    Je Prüfung genügt eine der beiden Lesarten (V2); welche trafen, steht in papier.lesarten."""
    rd, leser = papier_texte(pdf)
    erste = min([u['seiten_mappe']['von'] for p in _personen(lh) for u in p['unterlagen']] or [2])
    n = max(1, min(erste - 1, len(rd.pages)))
    T = [_Text(f(n)) for f in leser]
    T1 = [_Text(f(1)) for f in leser]
    papier.lesarten = {}

    def irgendwo(pruef, name):
        erg = [bool(pruef(x)) for x in T]
        papier.lesarten[name] = erg
        return any(erg)

    def im(x, kopf, phrase, danach=None):
        a = x.abschnitt(kopf, [k for k in KOPF if k != kopf] + ['bürgschaft'] * (kopf == 'was beiliegt' and False))
        if a is None:
            return False
        for t in a:
            for m in re.finditer(re.escape(phrase), t):
                if _wort(phrase, t[max(0, m.start() - 1):m.end() + 1]) and (danach is None or t[m.end():].lstrip().startswith(danach)):
                    return True
        return False

    g = []
    # DP78: Satz zum Schritt. LESART L78-3: Er steht auf Seite 1 vor der ersten Abschnittsüberschrift, also unter dem
    # Satz zum Haushalt. Jede Lesart für sich; eine genügt (V2). Ein fremder Satz zählt, wenn eine Lesart ihn findet.
    def kopfzone(x):
        z = []
        for zeile in x.zeilen:
            if any(zeile == k or zeile.startswith(k + ' ') for k in KOPF):
                break
            z.append(zeile)
        return ' ' + ' '.join(z) + ' ', ' ' + _Text._bindestrich(z) + ' '
    saetze = {k: _norm(v) for k, v in SCHRITT_SATZ.items()}
    s = lh.get('schritt')
    if s in saetze:                                   # LESART L78-4: unbekannter Schritt wird nicht gezeigt und nicht gebunden
        erg = [any(' ' + saetze[s] + ' ' in v for v in kopfzone(x)) for x in T1]
        papier.lesarten['schritt'] = erg
        if not any(erg):
            g.append(f"Schritt „{s}“: der feste Satz steht nicht unter dem Satz zum Haushalt")
    for k, satz in saetze.items():
        if k != s and any(' ' + satz + ' ' in v for x in T for v in (' ' + x.flach + ' ', ' ' + x.flach_b + ' ')):
            g.append(f"Satz zum Schritt „{k}“ steht im Deckblatt, die Lesehilfe nennt {'„' + s + '“' if s else 'keinen Schritt'}")
    w = lh['bewerbung'].get('wohnung')
    if w:
        for k in ('strasse', 'rest'):
            if w.get(k) and not irgendwo(lambda x, k=k: _wort(_norm(w[k]), x.flach) or _wort(_norm(w[k]), x.flach_b), k):
                g.append(f"Wohnung: „{w[k]}“ steht nicht auf dem Deckblatt")
        if w.get('teile') and teile(w['strasse'], w.get('rest', '')) != {k: v for k, v in w['teile'].items() if not k.startswith('x_')}:
            g.append(f"Wohnung: teile passen nicht zu „{w['strasse']}, {w.get('rest')}“ (Abschnitt 9)")      # A14
    b = lh['bewerbung']
    if b.get('einzug') and not irgendwo(lambda x: ('einzug möglich ab ' + _norm(_datum(b['einzug']))) in x.flach, 'einzug'):
        g.append(f"Einzug: „Einzug möglich ab {_datum(b['einzug'])}“ steht nicht auf dem Deckblatt")       # S35
    if (b.get('inserat') or {}).get('portal') and not irgendwo(lambda x: _wort('inserat auf ' + _norm(b['inserat']['portal']), x.flach), 'portal'):
        g.append(f"Portal „{b['inserat']['portal']}“ steht nicht auf dem Deckblatt")
    if lh.get('loeschwunsch') and not irgendwo(lambda x: _ohne_leer(_norm(lh['loeschwunsch'])) in _ohne_leer(x.flach_b), 'loeschwunsch'):
        g.append('Löschbitte steht nicht wörtlich auf dem Deckblatt')                                     # S16, A12
    for m in lh['haushalt']['mitziehende']:
        if not irgendwo(lambda x, m=m: im(x, 'ziehen mit ein', _norm(m['text'])), 'mitziehend'):
            g.append(f"Mitziehende „{m['text']}“ stehen nicht unter „Ziehen mit ein“")                         # S17, A11

    def fassung_ok(x):           # V7 (PD124): „Fassung n vom …“ steht immer da
        m = re.search(r'fassung (\d+) vom (\d+\. \w+ \d{4})', x.flach)
        return bool(m) and int(m.group(1)) == lh['fassung'] and m.group(2) == _norm(_datum(lh['erstellt'][:10]))
    if not irgendwo(fassung_ok, 'fassung'):
        g.append(f"Fassung {lh['fassung']} vom {_datum(lh['erstellt'][:10])} steht so nicht auf dem Deckblatt")
    if not irgendwo(lambda x: f"seite 1 von {lh['seitenzahl']}" in x.flach or 'seite 1 von' not in x.flach, 'fuss'):   # LESART V8
        g.append(f"Fuß nennt nicht „Seite 1 von {lh['seitenzahl']}“")
    cd = rd.metadata.creation_date if rd.metadata else None                                             # LESART V11
    if not cd or abs((cd - _zeitpunkt(lh['erstellt'])).total_seconds()) >= 1:
        g.append(f"erstellt {lh['erstellt']} ist nicht das Erstelldatum der PDF ({cd})")
    ps = _personen(lh)
    for p in ps:                                                                                         # LESART V5, V9
        nm = _norm(p['name'])
        kopf, rolle = ('bürgt', 'bürg') if p['rolle'] == 'buerge' else ('im mietvertrag', {'hauptmieter': 'hauptmiet', 'mitmieter': 'mitmiet'}.get(p['rolle'], ''))
        if not irgendwo(lambda x, nm=nm, kopf=kopf, rolle=rolle: im(x, kopf, nm, rolle), 'person:' + p['name']):
            g.append(f"{p['name']}: steht nicht als ganzer Name mit dieser Rolle unter „{'Bürgt' if kopf == 'bürgt' else 'Im Mietvertrag'}“")
        if p.get('kontakt'):
            def kontakt_ok(x, p=p):
                a = x.abschnitt('kontakt', [k for k in KOPF if k != 'kontakt'])
                return a is not None and _wort(_norm(p['name']), a[0]) and all(_ohne_leer(_norm(p[k])) in _ohne_leer(a[0]) for k in ('telefon', 'email') if p.get(k))
            if not irgendwo(kontakt_ok, 'kontakt'):
                g.append(f"{p['name']}: Kontakt mit Telefon und Mail steht so nicht unter „Kontakt“")       # A6
    namen = [_norm(p['name']) for p in ps]
    for i, p in enumerate(ps):                                                                           # LESART V6, V10
        for u in p['unterlagen']:
            wort = _norm(VERZEICHNIS.get(u['typ'], ''))
            zus = (', ' + _norm(_monate_text(u['monate']))) if u.get('monate') else (' vom ' + _norm(_datum(u['vom']))) if u.get('vom') else ''
            soll, seiten = ((wort + zus) if wort else None), _seitenangabe(u)
            def unterlage_ok(x, i=i, soll=soll, seiten=seiten):
                v = x.abschnitt('was beiliegt', [])
                if v is None:
                    return False
                for t in v:
                    for m in re.finditer(re.escape(namen[i]), t):
                        if not _wort(namen[i], t[max(0, m.start() - 1):m.end() + 1]):
                            continue
                        rest = t[m.end():]
                        ende = min([k for k in (rest.find(namen[j]) for j in range(len(ps)) if j != i) if k >= 0] + [len(rest)])
                        block = rest[:ende]
                        if soll is None and re.search(_seiten_re(u) + r'(?![\d–]| bis \d)', block):
                            return True
                        if soll is not None and re.search(r'(?<![\w])' + re.escape(soll) + r'[ \t]+' + _seiten_re(u) + r'(?![\d–]| bis \d)', block):
                            return True
                return False
            if not irgendwo(unterlage_ok, f"unterlage:{p['name']}:{u['typ']}:{seiten}"):
                g.append(f"{p['name']}: „{VERZEICHNIS.get(u['typ'], 'Unterlage')}{zus and ' …'} – {_seiten(u)}“ steht so nicht im Verzeichnis (V6)")   # S18, A7–A9
            for vm in u.get('vermerke') or []:
                if not irgendwo(lambda x, vm=vm: _norm(_vermerk(vm)) in x.flach, 'vermerk'):
                    g.append(f"{p['name']}: Vermerk „{_vermerk(vm)}“ steht nicht im Verzeichnis")         # A10
    for p in ps:                                                                                         # A1, LESART V12
        for u in p['unterlagen']:
            for s_ in range(u['seiten_mappe']['von'], min(u['seiten_mappe']['bis'], len(rd.pages)) + 1):
                pg = rd.pages[s_ - 1]
                bild = bool(pg.get('/Resources') and pg['/Resources'].get('/XObject'))
                if not (pg.extract_text() or '').strip() and not bild:
                    g.append(f"{p['name']}: Seite {s_} ist leer")
    return g


def teile(strasse, rest):
    """Abschnitt 9 nachgebaut. LESART V19: Hausnummer = letztes Wort der ersten Angabe, wenn es mit einer Ziffer
    beginnt; Lage = alle Angaben außer der mit Postleitzahl, mit „, “ verbunden (G7)."""
    m = re.fullmatch(r'(.+?)\s+(\d[\w/-]*)', strasse.strip())
    if not m:
        return None
    angaben = [a.strip() for a in rest.split(',') if a.strip()] if rest else []
    ort = next((a for a in angaben if re.match(r'\d{5}\s', a)), '')
    lage = ', '.join(a for a in angaben if a != ort)
    return {'strasse': m.group(1), 'hausnummer': m.group(2), 'plz': ort[:5] if ort else '', 'ort': ort[6:] if ort else '', 'lage': lage, 'land': 'DE'}


# ---------------------------------------------------------------- Anzeige
def _seiten(u):
    v, b = u['seiten_mappe']['von'], u['seiten_mappe']['bis']
    return f'Seite {v}' if v == b else f'Seiten {v} bis {b}'


def _liste(zahlen):
    z = [str(x) for x in zahlen]
    return z[0] if len(z) == 1 else ', '.join(z[:-1]) + ' und ' + z[-1]


def _vermerk(v):
    art = VERMERK.get(v['art'], 'angepasst')
    so = v.get('seiten_original')
    t = f"{'Seite' if len(so) == 1 else 'Seiten'} {_liste(so)} {art}" if so else art
    if 'monat' in v:
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
        z.append(f"Einzug möglich ab {_datum(lh['bewerbung']['einzug'])}")
    z.append(f"Fassung {lh['fassung']}, {lh['seitenzahl']} Seiten, erstellt {lh['erstellt']}")
    if lh.get('schritt') in SCHRITT_SATZ:
        z.append(SCHRITT_SATZ[lh['schritt']])
    for p in _personen(lh):
        z.append('')
        z.append(f"{p['name']} – {ROLLE.get(p['rolle'], 'Person')}")
        if p.get('kontakt'):
            z.append('  Kontakt: ' + ', '.join(x for x in (p.get('telefon'), p.get('email')) if x))
        for u in p['unterlagen']:
            zus = []
            if u.get('monate'):
                m = u['monate']; a, b = m[0].split('-'), m[-1].split('-')
                zus.append(f'{MONATE[int(a[1]) - 1]} {a[0]}' if len(m) == 1 else
                           f'{MONATE[int(a[1]) - 1]} bis {MONATE[int(b[1]) - 1]} {b[0]}' if a[0] == b[0] else
                           f'{MONATE[int(a[1]) - 1]} {a[0]} bis {MONATE[int(b[1]) - 1]} {b[0]}')            # S25
            if u.get('vom'):
                zus.append('vom ' + _datum(u['vom']))
            z.append(f"  {TYP.get(u['typ'], 'Unterlage')}{', ' + ', '.join(zus) if zus else ''} – {_seiten(u)}")
            for v in u.get('vermerke', []):
                z.append(f'      {_vermerk(v)}')
    mz = lh['haushalt']['mitziehende']
    if mz:
        z += ['', 'Ziehen mit ein: ' + ', '.join(m['text'] for m in mz)]
    if lh.get('loeschwunsch'):
        z += ['', lh['loeschwunsch']]
    return '\n'.join(z)


# ---------------------------------------------------------------- CSV
SPALTEN = ['kennung', 'fassung', 'erstellt', 'wohnung_strasse', 'wohnung_rest', 'strasse', 'hausnummer', 'plz', 'ort', 'lage', 'land',
           'einzug', 'portal', 'person_nr', 'rolle', 'vorname', 'nachname', 'name', 'kontakt', 'telefon', 'telefon_e164', 'email',
           'kinder', 'weitere_erwachsene', 'unterlagen', 'unterlagen_text', 'schritt', 'loeschwunsch']      # V23: ohne modus
E164 = re.compile(r'\+[1-9]\d{6,14}')


def _zelle(v, spalte=''):
    v = '' if v is None else str(v)
    # T5: telefon_e164 ist nach Abschnitt 8 geprüft und nie eine Formel; ohne Apostroph.
    # LESART V20: `telefon` mit „+“ am Anfang bekommt weiter den Apostroph; das ist für Software dieselbe Lücke wie T5.
    if v[:1] in ('=', '+', '-', '@', '\t', '\r', '\n') and not (spalte == 'telefon_e164' and E164.fullmatch(v)):
        v = "'" + v
    if any(c in v for c in ';"\r\n'):
        v = '"' + v.replace('"', '""') + '"'
    return v


def csv_zeilen(lh):
    b = lh['bewerbung']; w = b.get('wohnung') or {}; t = w.get('teile') or {}
    kinder = sum(m['anzahl'] for m in lh['haushalt']['mitziehende'] if m['art'] == 'kind')
    erw = sum(m['anzahl'] for m in lh['haushalt']['mitziehende'] if m['art'] == 'erwachsen')
    for i, p in enumerate(_personen(lh), 1):
        k = p.get('kontakt') is True
        yield {'kennung': b['kennung'], 'fassung': lh['fassung'], 'erstellt': lh['erstellt'],
               'wohnung_strasse': w.get('strasse', ''), 'wohnung_rest': w.get('rest', ''),
               **{x: t.get(x, '') for x in ('strasse', 'hausnummer', 'plz', 'ort', 'lage', 'land')},
               'einzug': b.get('einzug', ''), 'portal': (b.get('inserat') or {}).get('portal', ''),
               'person_nr': i, 'rolle': p['rolle'], 'vorname': p['vorname'], 'nachname': p['nachname'], 'name': p['name'],
               'kontakt': 'ja' if k else '', 'telefon': p.get('telefon', '') if k else '', 'telefon_e164': p.get('telefon_e164', '') if k else '',
               'email': p.get('email', '') if k else '', 'kinder': kinder, 'weitere_erwachsene': erw,
               'unterlagen': '|'.join(u['typ'] for u in p['unterlagen']),
               'unterlagen_text': ' | '.join(TYP.get(u['typ'], 'Unterlage') for u in p['unterlagen']),
               'schritt': lh.get('schritt', '') if lh.get('schritt') in SCHRITT_SATZ else '', 'loeschwunsch': lh.get('loeschwunsch', '')}


def als_csv(lesehilfen, bom=True):
    zeilen = [';'.join(SPALTEN)]
    for lh in lesehilfen:
        for r in csv_zeilen(lh):
            zeilen.append(';'.join(_zelle(r[s], s) for s in SPALTEN))
    return (b'\xef\xbb\xbf' if bom else b'') + ''.join(z + '\r\n' for z in zeilen).encode('utf-8')


# ---------------------------------------------------------------- Telefon (Abschnitt 8, mit T1 bis T4)
def e164(telefon):
    """Nur noch Hilfe für Software, die aus einer freien Eingabe eine Nummer machen will; prüft nichts (E222).
    LESART V21: Buchstaben (T4) und Bindestrich (T2, DIN 5008 setzt ihn vor die Durchwahl) machen die Nummer
    uneindeutig: kein Ergebnis. „(0)“ und eine 0 direkt nach +49 fallen weg (T1). Steht nach einer anderen
    Ländervorwahl eine 0 (T3), ist die Nummer ohne Ländertabelle nicht eindeutig: kein Ergebnis."""
    if re.search(r'[^\d\s/+().]', telefon):
        return None
    if re.match(r'\+(?!49)\d{1,3}[\s/.]+0', telefon):
        return None        # LESART V21: „+44 020 …“: Ob die 0 wegfällt, hängt vom Land ab (Italien behält sie). Nicht eindeutig.
    s = telefon.replace('(0)', '')
    for c in ' /.()':
        s = s.replace(c, '')
    if s.startswith('00'):
        s = '+' + s[2:]
    elif s.startswith('0'):
        s = '+49' + s[1:]
    if s.startswith('+490'):
        s = '+49' + s[4:]
    return s if E164.fullmatch(s) and s.count('+') == 1 else None


# ---------------------------------------------------------------- alles zusammen
def pruefe_pdf(pdf, schema=None):
    """Liest den Anhang einer Mappe und prüft alles: lesen, passt mit echter Seitenzahl, papier. → (lh, gruende)"""
    from pypdf import PdfReader
    rd = PdfReader(pdf)
    a = rd.attachments.get('hefta.json')
    if not a:
        raise Abgelehnt('kein Anhang hefta.json')
    lh = lesen(a[0], schema)
    return lh, passt(lh, len(rd.pages)) + papier(lh, pdf)


def main():
    a = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    a.add_argument('datei'); a.add_argument('--seiten', type=int); a.add_argument('--schema'); a.add_argument('--csv')
    o = a.parse_args()
    schema = json.load(open(o.schema, encoding='utf-8')) if o.schema else None
    try:
        if o.datei.lower().endswith('.pdf'):
            lh, g = pruefe_pdf(o.datei, schema)
        else:
            lh = lesen(open(o.datei, 'rb').read(), schema); g = passt(lh, o.seiten)
    except Abgelehnt as e:
        print('ABGELEHNT:', e); return 2
    if g:
        print('PASST NICHT, wird nicht gezeigt:'); [print('  -', x) for x in g]; return 3
    print(als_text(lh))
    if o.csv:
        open(o.csv, 'wb').write(als_csv([lh]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
