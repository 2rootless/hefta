#!/usr/bin/env python3
"""DP72: Gegenproben für leser72.py. Aufruf: python3 -I gegen72.py <ordner des pakets> <beispiel.csv> [<faelle.json>]

Angepasst von Code nach E208 (PC101): Das Schema ist jetzt offen, darum werden G2a und G7a gelesen; G10a (Lesart A)
entfällt; die CSV hat die BOM (C1) und trennt unterlagen_text mit „ | “ (C5); Rufnummern nur aus den Musterbereichen
(W7). Statt gegen72.json neben sich schreibt es die Fälle, wenn ein dritter Pfad kommt, für den Vergleich mit hefta-json.
"""
import copy, json, sys, os
sys.stdout.reconfigure(encoding='utf-8')  # Code: Ausgabe auch unter Windows
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leser72 as L

A = sys.argv[1]
CSV = sys.argv[2]
FAELLE = sys.argv[3] if len(sys.argv) > 3 else None
ROH = []  # (nr, erwartet, ist, json-text, seiten) für den Vergleich mit dem Paket
SCHEMA = json.load(open(f'{A}/schema.json', encoding='utf-8'))
OFFEN = copy.deepcopy(SCHEMA)   # wie PD106 es von Code erbeten hat
OFFEN['properties']['hefta'] = {'type': 'integer', 'minimum': 4}
OFFEN['definitions']['wohnung']['properties']['teile']['properties']['land'] = {'type': 'string', 'pattern': '^[A-Z]{2}$'}
B = {n: json.load(open(f'{A}/beispiele/{n}.json', encoding='utf-8')) for n in
     ('1-eine-person', '2-paar-kind-buergin', '3-nach-der-zusage', '4-ohne-wohnung', '5-grenzfaelle-namen')}
ERG = []


def probe(nr, was, erwartet, lh=None, schema=SCHEMA, seiten='auto', lesart='B', roh=None):
    """erwartet: 'gelesen', 'abgelehnt' (Schema oder Fassung) oder 'passt nicht' (Abschnitt 11)."""
    try:
        x = L.lesen(roh if roh is not None else json.dumps(lh, ensure_ascii=False).encode(), schema)
        g = L.passt(x, x['seitenzahl'] if seiten == 'auto' else seiten, lesart)
        ist, grund = ('passt nicht', '; '.join(g)) if g else ('gelesen', '')
    except L.Abgelehnt as e:
        x, ist, grund = None, 'abgelehnt', str(e)
    ERG.append(dict(nr=nr, probe=was, erwartet=erwartet, ist=ist, ok=ist == erwartet, grund=grund[:160]))
    text = roh.decode('utf-8') if isinstance(roh, bytes) else json.dumps(lh, ensure_ascii=False)
    seite = (x['seitenzahl'] if x else None) if seiten == 'auto' else seiten
    ROH.append(dict(nr=nr, erwartet=erwartet, ist=ist, text=text, seiten=seite))
    return x


# 0 Alle Beispiele, Schema aus der Anlage, Seitenzahl angenommen = seitenzahl
for n, lh in B.items():
    probe('G0', f'Beispiel {n}', 'gelesen', lh)

# 1 Fassung 3 statt 4
x = copy.deepcopy(B['2-paar-kind-buergin']); x['hefta'] = 3
probe('G1', 'Fassung 3 statt 4', 'abgelehnt', x)

# 2 Fassung 5 mit unbekanntem Feld: mit dem Schema der Anlage und mit dem geöffneten
x = copy.deepcopy(B['2-paar-kind-buergin']); x['hefta'] = 5; x['wohnung_lage_neu'] = 'Hinterhaus'
x['haushalt']['personen'][0]['neues_feld'] = 1
probe('G2a', 'Fassung 5 mit unbekannten Feldern, Schema des Pakets (ganze Zahl ab 4)', 'gelesen', x)
y = probe('G2b', 'dieselbe Datei, Schema geöffnet (hefta: ganze Zahl ab 4)', 'gelesen', x, OFFEN)
ERG.append(dict(nr='G2c', probe='unbekannte Felder werden überlesen: Text gleich wie ohne sie', erwartet='gleich',
                ist='gleich' if y and L.als_text(y).replace('Fassung 2, 16', 'Fassung 2, 16') == L.als_text(B['2-paar-kind-buergin']) else 'anders', ok=bool(y) and L.als_text(y) == L.als_text(B['2-paar-kind-buergin']), grund=''))

# 3 x_-Felder in mehreren Objekten
x = copy.deepcopy(B['2-paar-kind-buergin']); x['x_test_eingang'] = '2026-11-19'; x['haushalt']['personen'][1]['x_test_notiz'] = 'ruft an'
x['haushalt']['personen'][0]['unterlagen'][1]['x_test_geprueft'] = True; x['bewerbung']['wohnung']['teile']['x_test_bezirk'] = 'Eimsbüttel'
y = probe('G3', 'x_-Felder oben, in Person, Unterlage und teile', 'gelesen', x)
ERG.append(dict(nr='G3b', probe='x_-Felder überlesen: Text und CSV gleich wie ohne sie', erwartet='gleich',
                ist='gleich' if y and L.als_text(y) == L.als_text(B['2-paar-kind-buergin']) and L.als_csv([y]) == L.als_csv([B['2-paar-kind-buergin']]) else 'anders',
                ok=bool(y) and L.als_text(y) == L.als_text(B['2-paar-kind-buergin']), grund=''))

# 4 Unbekannte Kennung bei typ
x = copy.deepcopy(B['1-eine-person']); x['haushalt']['personen'][0]['unterlagen'][2]['typ'] = 'kontoauszug_neu'
y = probe('G4', 'unbekannter typ „kontoauszug_neu“', 'gelesen', x)
ERG.append(dict(nr='G4b', probe='… wird als „Unterlage“ gezeigt', erwartet='Unterlage', ist='Unterlage' if y and '  Unterlage, vom 28. Oktober 2026 – Seite 6' in L.als_text(y) else 'anders', ok=bool(y) and '  Unterlage, vom' in L.als_text(y), grund=''))

# 5 Überschneidende Seiten
x = copy.deepcopy(B['2-paar-kind-buergin']); x['haushalt']['personen'][1]['unterlagen'][0]['seiten_mappe'] = {'von': 6, 'bis': 7}
probe('G5', 'Seiten 6–7 von Lea überschneiden Seite 6 von Max', 'passt nicht', x)

# 6 name nicht aus Vor- und Nachname
x = copy.deepcopy(B['2-paar-kind-buergin']); x['haushalt']['personen'][1]['name'] = 'Lea Musterfrau'
probe('G6', 'name „Lea Musterfrau“ bei vorname Lea, nachname Mustermann', 'passt nicht', x)

# 7 land mit zwei Großbuchstaben
x = copy.deepcopy(B['1-eine-person']); x['bewerbung']['wohnung']['teile']['land'] = 'AT'
probe('G7a', 'land „AT“, Schema des Pakets (zwei Großbuchstaben)', 'gelesen', x)
probe('G7b', 'land „AT“, Schema geöffnet (zwei Großbuchstaben)', 'gelesen', x, OFFEN)

# Weitere Proben, die eine Unklarheit zeigen
x = copy.deepcopy(B['2-paar-kind-buergin']); x['haushalt']['personen'][2]['rolle'] = 'untermieter'
probe('G8', 'neue Kennung bei rolle („untermieter“); laut Abschnitt 3 und 6 erlaubt', 'gelesen', x, OFFEN)
x = copy.deepcopy(B['1-eine-person']); x['modus'] = 'nur_ausweis'
probe('G9', 'neue Kennung bei modus; laut Abschnitt 6 erlaubt', 'gelesen', x, OFFEN)
probe('G10b', 'Aylin, Punkt 5 mit der Ausnahme aus Abschnitt 5 (Lesart B)', 'gelesen', B['5-grenzfaelle-namen'], lesart='B')
x = copy.deepcopy(B['1-eine-person']); x['haushalt']['personen'][0]['unterlagen'][0]['seiten_mappe'] = {'von': 1, 'bis': 2}
probe('G11', 'Unterlage auf Seite 1 (Deckblatt)', 'passt nicht', x)
x = copy.deepcopy(B['4-ohne-wohnung']); x['haushalt']['personen'][1].update(kontakt=True, email='mia.beispiel@example.com')
probe('G12', 'zwei Personen mit kontakt: true (Schema lässt es zu)', 'passt nicht', x)
probe('G13', 'Datei mit BOM', 'gelesen', roh=b'\xef\xbb\xbf' + json.dumps(B['1-eine-person']).encode())
probe('G14', 'Seitenzahl der PDF weicht ab (angenommen 15 statt 16)', 'passt nicht', B['2-paar-kind-buergin'], seiten=15)
x = copy.deepcopy(B['1-eine-person']); x['haushalt']['personen'][0]['vorname'] = ''; x['haushalt']['personen'][0]['name'] = ' Muster'
probe('G15', 'vorname leer, name „ Muster“ (Schema lässt leeren vorname zu)', 'passt nicht', x)

# Telefon nach Abschnitt 8
TEL = [('0171 3920001', '+491713920001'), ('+49 171 3920001', '+491713920001'), ('0049 (0)171 39 200 01', '+491713920001'),
       ('0171/3920007', '+491713920007'), ('+44 20 7946 0018', '+442079460018'), ('3920001', None), ('+49 (0)171 3920006', '+491713920006'),
       ('0171 3920002', '+491713920002')]
for t, soll in TEL:
    ERG.append(dict(nr='T', probe=f'telefon_e164 aus „{t}“', erwartet=str(soll), ist=str(L.e164(t)), ok=L.e164(t) == soll, grund=''))

# CSV gegen das Beispiel, Zeichen für Zeichen
bsp = open(CSV, 'rb').read()
mit = L.als_csv([B['2-paar-kind-buergin']], bom=True); ohne = L.als_csv([B['2-paar-kind-buergin']], bom=False)
ERG.append(dict(nr='C1', probe='CSV nach Beschreibung (mit BOM) gleich dem Beispiel', erwartet='gleich', ist='gleich' if mit == bsp else f'anders, erstes abweichendes Byte {next(i for i, (a, b) in enumerate(zip(mit, bsp)) if a != b)}', ok=mit == bsp, grund='Beispiel beginnt mit „kennung“, ohne BOM'))
ERG.append(dict(nr='C2', probe='CSV ohne BOM ist nicht das Beispiel (U4: mit BOM)', erwartet='anders', ist='gleich' if ohne == bsp else 'anders', ok=ohne != bsp, grund=''))
x = copy.deepcopy(B['2-paar-kind-buergin']); p = x['haushalt']['personen'][1]
p.update(vorname='=HYPERLINK("x")', name='=HYPERLINK("x") Mustermann'); x['haushalt']['personen'][2]['nachname'] = 'Muster;mann'
z = L.als_csv([x], bom=False).decode().split('\r\n')
ERG.append(dict(nr='C3', probe='Formel im Namen bekommt Apostroph, Anführungszeichen verdoppelt', erwartet='"\'=HYPERLINK(""x"")"', ist=z[2].split(';')[15], ok=z[2].split(';')[15] == '"\'=HYPERLINK(""x"")"', grund='Reihenfolge Apostroph/Anführungszeichen ist meine Lesart U14'))
ERG.append(dict(nr='C4', probe='Semikolon im Namen steht in Anführungszeichen', erwartet='"Muster;mann"', ist=z[3].split('"')[1] if '"' in z[3] else '', ok='"Muster;mann"' in z[3], grund=''))
x = copy.deepcopy(B['3-nach-der-zusage']); x['haushalt']['personen'][1]['unterlagen'].append({'typ': 'mietuebernahme_amt', 'seiten_mappe': {'von': 16, 'bis': 16}}); x['seitenzahl'] = 16
z = L.als_csv([x], bom=False).decode().split('\r\n')[2]
teile = z.split(';')[25].split(' | ')
eindeutig = teile == [L.TYP[u['typ']] for u in x['haushalt']['personen'][1]['unterlagen']]
ERG.append(dict(nr='C5', probe='unterlagen_text mit „ | “ getrennt (U5): jeder Teil genau ein Wortlaut', erwartet='eindeutig', ist='eindeutig' if eindeutig else 'mehrdeutig', ok=eindeutig, grund=z.split(';')[25]))

if FAELLE:
    json.dump(dict(ergebnisse=ERG, faelle=ROH), open(FAELLE, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
for e in ERG:
    print(('ok  ' if e['ok'] else 'ROT ') + f"{e['nr']:5} {e['probe']} → {e['ist']}" + (f"  [{e['grund']}]" if e['grund'] and not e['ok'] else ''))
print('ok:', sum(e['ok'] for e in ERG), 'von', len(ERG))
sys.exit(0 if all(e['ok'] for e in ERG) else 1)
