#!/usr/bin/env python3
"""Code (PC116): Urteil von Designs leser78.py über Lesehilfen ohne Papier (Punkte 1 bis 6) und seine CSV.
Aufruf: python3 -E -P -B gegen78.py <ordner des pakets> <faelle.json> <aus.json>
faelle.json: [{"nr": "…", "datei": "pfad.json", "seiten": n}, …]
aus.json: {"faelle": {nr: ["gezeigt" | "passt nicht" | "abgelehnt" | "ABSTURZ", "Grund"]},
           "csv": {name des beispiels: CSV-Text von leser78}}
leser78.py bleibt unverändert; Punkt 7 (Papier) prüft der Stresstest der App mit echten PDFs."""
import glob, json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leser78 as L

PAKET, FAELLE, AUS = sys.argv[1:4]
schema = json.load(open(f'{PAKET}/schema.json', encoding='utf-8'))
erg = {}
for f in json.load(open(FAELLE, encoding='utf-8')):
    try:
        lh = L.lesen(open(f['datei'], 'rb').read(), schema)
        g = L.passt(lh, f['seiten'])
        erg[f['nr']] = ['passt nicht', '; '.join(g)] if g else ['gezeigt', '']
    except L.Abgelehnt as e:
        erg[f['nr']] = ['abgelehnt', str(e)]
    except Exception as e:
        erg[f['nr']] = ['ABSTURZ', f'{type(e).__name__}: {e}'[:200]]
csv = {}
for d in sorted(glob.glob(f'{PAKET}/beispiele/*.json')):
    lh = L.lesen(open(d, 'rb').read(), schema)
    csv[os.path.basename(d)] = L.als_csv([lh]).decode('utf-8')
json.dump({'faelle': erg, 'csv': csv}, open(AUS, 'w', encoding='utf-8'), ensure_ascii=False)
print(f'ok: {len(erg)}')
