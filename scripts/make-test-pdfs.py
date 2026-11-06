"""Erzeugt kleine PDFs mit den Verschlüsselungen, die Portale verwenden: ohne Passwort lesbar, nur gegen Ändern geschützt."""
import sys
from pypdf import PdfReader, PdfWriter
from pypdf.generic import DecodedStreamObject, DictionaryObject, NameObject
ziel = sys.argv[1]
for name, algo in [('rc4-40', 'RC4-40'), ('rc4-128', 'RC4-128'), ('aes-128', 'AES-128'), ('aes-256', 'AES-256')]:
    w = PdfWriter()
    seite = w.add_blank_page(595, 842)
    inhalt = DecodedStreamObject()
    inhalt.set_data(f'BT /F1 18 Tf 50 700 Td (Lohnzettel {name}) Tj ET'.encode())
    seite[NameObject('/Contents')] = w._add_object(inhalt)
    schrift = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'), NameObject('/BaseFont'): NameObject('/Helvetica')})
    seite[NameObject('/Resources')] = DictionaryObject({NameObject('/Font'): DictionaryObject({NameObject('/F1'): w._add_object(schrift)})})
    w.encrypt(user_password='', owner_password='besitzer', algorithm=algo)
    w.write(f'{ziel}/portal-{name}.pdf')
    print(name, 'ok')
