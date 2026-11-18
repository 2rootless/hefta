#!/usr/bin/env python3
"""Code (PC110, PC116): Urteil von Designs leser78.py über eine Liste von Mappen, für den Stresstest der App.
Aufruf: python3 -E -P -B urteil78.py <schema.json> <liste.json> <aus.json>
liste.json: ["pfad.pdf", ...]  →  aus.json: {"pfad.pdf": ["gezeigt" | "passt nicht" | "abgelehnt" | "ABSTURZ", "Grund"]}
leser78.py bleibt unverändert; dieses Skript ruft nur pruefe_pdf() auf."""
import json, os, sys
sys.stdout.reconfigure(encoding='utf-8')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import leser78 as L

schema = json.load(open(sys.argv[1], encoding='utf-8'))
aus = {}
for pdf in json.load(open(sys.argv[2], encoding='utf-8')):
    try:
        _, g = L.pruefe_pdf(pdf, schema)
        aus[pdf] = ['passt nicht', '; '.join(g)] if g else ['gezeigt', '']
    except L.Abgelehnt as e:
        aus[pdf] = ['abgelehnt', str(e)]
    except Exception as e:  # ein fremder Leser darf nie abstürzen; wenn doch, zeigt der Test es
        aus[pdf] = ['ABSTURZ', f'{type(e).__name__}: {e}'[:200]]
json.dump(aus, open(sys.argv[3], 'w', encoding='utf-8'), ensure_ascii=False)
print(f'ok: {len(aus)}')
