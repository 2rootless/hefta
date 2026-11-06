// Allgemeine Prüfungen C1 bis C26 für jeden Bildschirm. Läuft als ganze Funktion im Browser.
/** C1 bis C16 (ohne C6, C8, C12), wie in design/werkzeug/pruef_c.py, auf die Klassen des Produkts übertragen. */
export function pruefen() {
  const out = {
    c1: false,
    c2: [] as string[],
    c3: [] as string[],
    c4: [] as string[],
    c5: [] as string[],
    c7: '',
    c9: [] as string[],
    c10: [] as string[],
    c11: [] as string[],
    c13: '',
    c14: [] as string[],
    c15: [] as string[],
    c16: [] as string[],
    c17: [] as string[],
    c18: [] as string[],
    c19: [] as string[],
    c20: [] as string[],
    c21: [] as string[],
    c22: [] as string[],
    c23: [] as string[],
    c24: [] as string[],
    c25: [] as string[],
    c26: [] as string[],
    hoehe: 0,
  };
  const main = document.querySelector('main')!;
  const leiste = document.querySelector('.leiste');
  // „Größerer Text“: Ansicht 200 % setzt --px. Dort passt „Unterlagen hinzufügen“ rechnerisch nicht mehr
  // in eine Zeile (34 px fett), zwei Zeilen sind die richtige Antwort.
  const schrift =
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px')) || 1;
  // Zugeklappte Abschnitte zählen nicht, nur ihre Überschrift.
  const zugeklappt = (e: Element) => !!e.closest('details:not([open])') && !e.closest('summary');
  const sichtbar = (e: Element) => !e.closest('.visually-hidden') && !zugeklappt(e);
  out.c1 = document.documentElement.scrollWidth > window.innerWidth + 1;

  const rechtecke = (r: Range) => [...r.getClientRects()].filter((x) => x.width > 0);
  // Zeilen eines Texts: Rechtecke auf etwa gleicher Höhe zählen als eine Zeile.
  const zeilenZahl = (rects: DOMRect[]) => {
    const oben = rects.map((x) => x.top).sort((a, b) => a - b);
    return oben.filter((y, i) => i === 0 || y - oben[i - 1]! > 8).length;
  };
  // Textstücke mit ihren Rechtecken (für C2, C4, C10, C11)
  const texte: { wort: string; rects: DOMRect[]; el: Element; stuecke: DOMRect[][] }[] = [];
  for (const wurzel of [main, leiste].filter(Boolean) as Element[]) {
    const walker = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    let n: Node | null;
    while ((n = walker.nextNode())) {
      const el = n.parentElement!;
      if (!sichtbar(el)) continue;
      const text = n.textContent ?? '';
      for (const m of text.matchAll(/\S+/g)) {
        const r = document.createRange();
        r.setStart(n, m.index!);
        r.setEnd(n, m.index! + m[0].length);
        // Die Stücke zwischen den erlaubten Trennstellen: Nur dort darf ein Wort umbrechen.
        const stuecke = [...m[0].matchAll(/[^\u00ad\u200b-]{2,}/g)].map((t) => {
          // Nach einer Trennstelle ohne das erste Zeichen: Dessen Range greift den Trennstrich am
          // Ende der Zeile davor mit, das sähe aus wie ein Umbruch im Stück.
          const s = document.createRange();
          s.setStart(n!, m.index! + t.index! + (t.index ? 1 : 0));
          s.setEnd(n!, m.index! + t.index! + t[0].length);
          return rechtecke(s);
        });
        texte.push({ wort: m[0], rects: rechtecke(r), el, stuecke });
      }
      // C21: Titel und Sätze werden nicht neben anderem in eine schmale Spalte gequetscht
      // (drei und mehr Zeilen auf weniger als 45 % der Breite ihres Kastens).
      if (/\S\s+\S/.test(text) && !el.closest('.band-svg, .seiten, .leiste, .haus')) {
        const r = document.createRange();
        r.selectNodeContents(n);
        const rects = rechtecke(r);
        if (rects.length && zeilenZahl(rects) >= 3) {
          const kasten = el.closest(
            '.eintragen, .teil, .karte, .notiz, .kasten, .abgleich, .backup, .vergleich > div, .vs-detail, li, section, main',
          );
          const breite =
            Math.max(...rects.map((x) => x.right)) - Math.min(...rects.map((x) => x.left));
          if (kasten && breite < 0.45 * kasten.clientWidth) out.c21.push(text.trim().slice(0, 24));
        }
      }
    }
  }
  // C2: Trennung mitten im Wort. Erlaubt nur an weicher Trennstelle, Bindestrich und an der
  // Umbruchstelle nach „_“ in Dateinamen (Design X7): Hat ein Wort so eine Stelle, bricht es aber
  // woanders um („Ausbildung/svertrag“), zählt das auch (gelernt 2.11.). Dateinamen sind davon
  // ausgenommen: Ein langer Name passt manchmal in keine Zeile.
  for (const { wort, stuecke } of texte)
    if (
      !wort.includes('\u200b') &&
      stuecke.some((r) => new Set(r.map((x) => Math.round(x.top))).size > 1)
    )
      out.c2.push(wort);
  // C3 (Karten) und C9 (Formulare, Kacheln, Felder, Listen): Inhalt ragt nicht heraus
  const ragt = (sel: string, ziel: string[]) =>
    document.querySelectorAll(sel).forEach((k) => {
      const kr = k.getBoundingClientRect();
      k.querySelectorAll('*').forEach((e) => {
        // Die feste Leiste liegt über der Seite, nicht im Kasten (geprüft mit C11, C13, C14).
        if (!k.matches('.leiste') && e.closest('.leiste')) return;
        // Ein offener Dialog liegt in der obersten Ebene, nicht im Kasten, in dem er steht.
        if (e.closest('dialog') !== k.closest('dialog')) return;
        const r = e.getBoundingClientRect();
        if (sichtbar(e) && r.width && (r.right > kr.right + 1 || r.left < kr.left - 1))
          ziel.push(`${sel} ${e.tagName}: ${(e.textContent ?? '').trim().slice(0, 20)}`);
      });
    });
  ragt('.karte', out.c3);
  ragt('.formular, .kasten, .kachel, .feld, .liste, .personen, .leiste, .stufen', out.c9);
  // C4: Zeilen im Band überlappen nicht; Ziel und Backup-Zeile überlappen nicht
  const band = document.querySelector('.band');
  if (band) {
    const zeilen = [
      ...band.querySelectorAll(':scope > [data-band], :scope > [data-band-ziel]'),
    ].map((z) => z.getBoundingClientRect());
    for (let i = 1; i < zeilen.length; i++)
      if (zeilen[i]!.top < zeilen[i - 1]!.bottom - 1) out.c4.push(`Zeile ${i}`);
  }
  // C3 auch senkrecht, wie CHECK_JS in design/werkzeug/pruef_c.py: Text hält mindestens 6 px Abstand
  // zum oberen und unteren Innenrand seines Kastens (umbrechende Links lagen auf der Unterkante).
  for (const t of texte) {
    // Nur was als Kasten zu sehen ist: Auf der Personenseite ist `.teil` bloß ein Abschnitt.
    const AUSWAHL = '.kasten, .notiz, .karte, .abgleich, .teil, .backup';
    const gemalt = (e: Element) => {
      const st = getComputedStyle(e);
      return (
        st.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
        parseFloat(st.borderTopWidth) > 0 ||
        parseFloat(st.borderBottomWidth) > 0
      );
    };
    let kasten = t.el.closest(AUSWAHL);
    while (kasten && !gemalt(kasten)) kasten = kasten.parentElement?.closest(AUSWAHL) ?? null;
    if (!kasten || t.el.closest('.eintragen')) continue;
    const k = kasten.getBoundingClientRect();
    const stil = getComputedStyle(kasten);
    const oben = k.top + (parseFloat(stil.borderTopWidth) || 0) + 6;
    const unten = k.bottom - (parseFloat(stil.borderBottomWidth) || 0) - 6;
    if (t.rects.some((r) => r.height && (r.top < oben - 0.5 || r.bottom > unten + 0.5)))
      out.c3.push(`senkrecht: ${t.wort}`);
  }
  // Ein Knopf zeigt seinen ganzen Text („Ganz“ war in D9b zu „Gar“ abgeschnitten, gelernt 2.11.).
  document.querySelectorAll<HTMLElement>('button, a.knopf').forEach((b) => {
    // Ohne Text gibt es nichts abzuschneiden; die Pfeile sind nur durch ihre Tippfläche breiter (D9b).
    if (sichtbar(b) && b.textContent?.trim() && b.scrollWidth > b.clientWidth + 1)
      out.c3.push(`Knopf zu schmal: ${(b.textContent ?? '').trim().slice(0, 24)}`);
  });
  // C22, wie CHECK_JS in design/werkzeug/pruef_c.py: Nichts liegt ganz außerhalb eines Kastens, der
  // abschneidet (in D11b fehlte bei 320 px mit 130 % die Auswahl). Anders als dort endet die Suche an
  // einem scrollenden Kasten, denn dorthin kommt man. Hinter einem offenen Dialog zählt nur er.
  const modal = document.querySelector('dialog[open]');
  (modal ? modal : document).querySelectorAll('main *, .leiste *, dialog *').forEach((e) => {
    const bedienbar = e.matches('a, button, input, select, textarea');
    const mitText = [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim());
    if ((!bedienbar && !mitText) || !sichtbar(e)) return;
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height) return;
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) {
      const stil = getComputedStyle(a);
      const clipY = /hidden|clip/.test(stil.overflowY);
      const clipX = /hidden|clip/.test(stil.overflowX);
      if (!clipX && !clipY) {
        if (/auto|scroll/.test(stil.overflowY + stil.overflowX)) return;
        continue;
      }
      const k = a.getBoundingClientRect();
      if (
        (clipY && (r.top >= k.bottom - 1 || r.bottom <= k.top + 1)) ||
        (clipX && (r.left >= k.right - 1 || r.right <= k.left + 1))
      ) {
        out.c22.push(`${e.tagName}: ${(e.textContent ?? '').trim().slice(0, 24)}`);
        return;
      }
      if (/auto|scroll/.test(stil.overflowY + stil.overflowX)) return;
    }
  });
  // D9b: Die Leiste der großen Seite bleibt eine Zeile.
  const stufen = [...document.querySelectorAll('dialog.ansicht .reihe > *')].map((e) => {
    const r = e.getBoundingClientRect();
    return r.top + r.height / 2;
  });
  if (stufen.some((y) => Math.abs(y - stufen[0]!) > 4)) out.c4.push('Leiste der Seite umgebrochen');
  // Und nichts darin überlappt („3×“ lag in D9b auf dem Pfeil, gelernt 2.11.).
  const knoepfe = [...document.querySelectorAll('dialog.ansicht .reihe button')]
    .filter(sichtbar)
    .map((e) => e.getBoundingClientRect())
    .sort((a, b) => a.left - b.left);
  if (knoepfe.some((r, i) => i > 0 && r.left < knoepfe[i - 1]!.right - 0.5))
    out.c4.push('Leiste der Seite überlappt');
  // C4 auch für Bedienelemente: Sie liegen nicht über fremdem Text (Schalter über
  // „Inhaltsverzeichnis“ bei 320 px mit 130 %; bisher maß keine Prüfung das, gelernt 2.11.).
  document.querySelectorAll('main [role=switch], main .textlink, main button').forEach((e) => {
    const r = e.getBoundingClientRect();
    // Die Vollbild-Dialoge scrollen in sich: Was unten abgeschnitten ist, läge sonst scheinbar
    // über der festen Zeile darunter.
    if (!r.width || !sichtbar(e) || e.closest('.leiste, dialog.ansicht')) return;
    for (const t of texte) {
      if (e.contains(t.el) || t.el.closest('.leiste')) continue;
      if (t.el.closest('dialog') !== e.closest('dialog')) continue;
      for (const tr of t.rects)
        if (
          Math.min(r.right, tr.right) - Math.max(r.left, tr.left) > 2 &&
          Math.min(r.bottom, tr.bottom) - Math.max(r.top, tr.top) > 2
        )
          out.c4.push(`${e.getAttribute('aria-label') ?? e.tagName} über „${t.wort}“`);
    }
  });
  const backup = document.querySelector('.backup');
  const zielzeile = document.querySelector('.zielzeile');
  if (backup && zielzeile) {
    if (zielzeile.getBoundingClientRect().bottom > backup.getBoundingClientRect().top + 1)
      out.c4.push('Ziel und Backup-Zeile');
  }
  // C5: jede Tippfläche mindestens 44 px hoch
  document
    .querySelectorAll('main a, main button, main label:has(input[type=file]), .leiste button')
    .forEach((e) => {
      const r = e.getBoundingClientRect();
      // Der Link der Person steht in der Überschrift, seine Fläche ist die ganze Karte.
      const flaeche = e.matches('.ueberzug') ? e.closest('.karte')!.getBoundingClientRect() : r;
      if (flaeche.height > 0 && flaeche.height < 43.5 && sichtbar(e))
        out.c5.push(`${(e.textContent ?? '').trim().slice(0, 30)} ${Math.round(r.height)}`);
    });
  // C7: Begrüßung einzeilig und nicht abgeschnitten; Schrift 34, 28 oder 24 px
  const h1 = document.querySelector('.begruessung') as HTMLElement | null;
  if (h1) {
    const groesse = `${parseFloat(getComputedStyle(h1).fontSize) / schrift}px`;
    if (h1.scrollWidth > h1.clientWidth + 1 || !['34px', '28px', '24px'].includes(groesse))
      out.c7 = `${h1.textContent} ${groesse}`;
  }
  // C10: Haus und Steine überdecken keinen Text
  const formen = [...document.querySelectorAll('.band .haus, .band-svg circle, .band-svg svg')].map(
    (e) => ({ e, r: e.getBoundingClientRect() }),
  );
  for (const { e, r } of formen) {
    if (!r.width) continue;
    for (const t of texte) {
      if (e.contains(t.el) || t.el.closest('.haus, .leiste, .band-svg')) continue;
      for (const tr of t.rects) {
        const ueber =
          Math.min(r.right, tr.right) - Math.max(r.left, tr.left) > 2 &&
          Math.min(r.bottom, tr.bottom) - Math.max(r.top, tr.top) > 2;
        if (ueber) out.c10.push(`${e.getAttribute('class') ?? e.tagName} über „${t.wort}“`);
      }
    }
  }
  // C20: Steine und Punkte im Band überdecken einander nicht.
  const kreise = [...document.querySelectorAll('.band-svg circle:not(.marke)')].map((e) =>
    e.getBoundingClientRect(),
  );
  kreise.forEach((a, i) =>
    kreise.slice(i + 1).forEach((b, j) => {
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1)
        if (Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1)
          out.c20.push(`Kreis ${i + 1} und ${i + j + 2}`);
    }),
  );
  // C19: keine Null als Menge im Satz („0 hast du übersprungen“) und keine leeren Gruppen.
  const seitenText = `${(main as HTMLElement).innerText} ${(leiste as HTMLElement | null)?.innerText ?? ''}`;
  const nullImSatz = seitenText.match(/(^|[\s(])0 [a-zäöüA-ZÄÖÜ]\S*/);
  if (nullImSatz) out.c19.push(nullImSatz[0].trim());
  document.querySelectorAll('main ul, main ol').forEach((l) => {
    if (!l.children.length && !l.textContent?.trim()) out.c19.push(`leere Liste ${l.className}`);
  });
  if (leiste) {
    // C13: feste Leiste mit deckendem Hintergrund
    const stil = getComputedStyle(leiste);
    const durchsichtig = /rgba\(0, 0, 0, 0\)|transparent/.test(stil.backgroundColor);
    if (stil.backgroundImage === 'none' && durchsichtig) out.c13 = 'Leiste ohne Hintergrund';
    // C14: ganz unten gescrollt überdeckt der deckende Teil der Leiste keinen Text. Liegt ein
    // Vollbild-Dialog darüber (Seitenansicht), ist die Seite samt Leiste ohnehin verdeckt.
    const verdeckt = !!document.querySelector('dialog:modal') && !leiste.closest('dialog:modal');
    window.scrollTo(0, document.documentElement.scrollHeight);
    const lr = (leiste.querySelector('.innen') ?? leiste).getBoundingClientRect();
    // Textpositionen nach dem Scrollen neu messen (die gesammelten gelten für Scrollstand 0).
    for (const t of texte) {
      if (verdeckt || leiste.contains(t.el) || !t.rects.length || zugeklappt(t.el)) continue;
      // Ein offener Vollbild-Dialog (Seitenansicht) liegt über der Leiste.
      if (t.el.closest('dialog:modal') && !leiste.closest('dialog:modal')) continue;
      const r = t.el.getBoundingClientRect();
      if (r.width && r.bottom > lr.top + 1 && r.top < lr.bottom)
        out.c14.push(`Leiste über „${t.wort}“`);
    }
    window.scrollTo(0, 0);
  }
  // C15: Text ragt nicht aus Eingabefeldern
  document
    .querySelectorAll<HTMLInputElement>('main input:not([type=file]), main textarea')
    .forEach((e) => {
      // Mit „…“ am Ende ist es gewollt (Dateiname in „Mappe anpassen“, X8).
      const auslassung = getComputedStyle(e).textOverflow === 'ellipsis';
      if (sichtbar(e) && !auslassung && e.scrollWidth > e.clientWidth + 1)
        out.c15.push(
          `${e.getAttribute('aria-label') ?? e.closest('label')?.textContent?.trim().slice(0, 20) ?? e.tagName}`,
        );
    });
  // C16: Bedien-Icons höchstens 40 px
  document
    .querySelectorAll('main a svg, main button svg, main label svg, .leiste svg')
    .forEach((e) => {
      const r = e.getBoundingClientRect();
      // In CSS-Pixeln: Große Schrift (200 %) vergrößert Zeichen mit, das ist gewollt.
      const faktor = parseFloat(document.documentElement.style.getPropertyValue('zoom') || '1');
      if (r.width / faktor > 40.5 || r.height / faktor > 40.5)
        out.c16.push(
          `${e.closest('a, button, label')?.textContent?.trim().slice(0, 20)} ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
    });
  // C17: Steht unter dem Hauptbutton, was fehlt, ist er gedämpft (Attribut und sichtbar).
  // C18: Hauptbuttons bleiben einzeilig; ein Zusatz steht daneben oder als ganze Zeile darunter.
  const zoom = parseFloat(document.documentElement.style.getPropertyValue('zoom') || '1');
  const probe = document.createElement('span');
  probe.style.setProperty('background', 'var(--action)');
  document.body.append(probe);
  const volleFarbe = getComputedStyle(probe).backgroundColor;
  probe.remove();
  document.querySelectorAll('.leiste').forEach((l) => {
    // Eine Hauptaktion kann ein Link sein, wenn sie eine andere Seite öffnet.
    const knopf = l.querySelector<HTMLElement>('.haupt, button:not(.neben)');
    if (!knopf) return;
    // Für Screenreader steht der Satz daneben, gemessen wird das Sichtbare.
    const sichtbarerText = (c: ChildNode) =>
      !!c.textContent?.trim() && !(c instanceof Element && c.matches('.visually-hidden'));
    const hinweis = [...l.querySelectorAll('p')].some((p) => p.textContent?.trim());
    if (
      hinweis &&
      (knopf.getAttribute('aria-disabled') !== 'true' ||
        getComputedStyle(knopf).backgroundColor === volleFarbe)
    )
      out.c17.push(knopf.textContent?.trim().slice(0, 30) ?? '');
    const hoehe = knopf.getBoundingClientRect().height / zoom;
    const zusatz = knopf.querySelector('small');
    const text = [...knopf.childNodes].find(sichtbarerText) ?? null;
    if (hoehe > 62 && schrift < 1.5)
      out.c18.push(`${knopf.textContent?.trim().slice(0, 30)} ${Math.round(hoehe)} px`);
    // Zusatz als zweite Spalte: Er steht neben dem Text, ragt aber über dessen Zeile hinaus.
    if (zusatz && text) {
      const bereich = document.createRange();
      bereich.selectNodeContents(text);
      const t = bereich.getBoundingClientRect();
      const z = zusatz.getBoundingClientRect();
      if (
        z.left >= t.right - 1 &&
        Math.abs(z.top + z.height / 2 - (t.top + t.height / 2)) > 8 * zoom
      )
        out.c18.push(`Zusatz als Spalte: ${zusatz.textContent}`);
    }
    // Auch bei normaler Höhe: Beschriftung und Zusatz brechen je für sich nicht um.
    knopf.childNodes.forEach((c) => {
      const r = document.createRange();
      r.selectNodeContents(c);
      if (schrift < 1.5 && sichtbarerText(c) && zeilenZahl(rechtecke(r)) > 1)
        out.c18.push(`zweizeilig: ${c.textContent?.trim().slice(0, 30)}`);
    });
  });
  // C18 seit 3.11. auch für Nebenknöpfe: Sie bleiben einzeilig.
  document.querySelectorAll('main .chip, dialog[open] .chip, main .knopf').forEach((b) => {
    // Zeilen mit eigenem Aufbau (Name und Stand, Frage und Antwort) sind keine Knöpfe im Sinn von C18.
    if (schrift >= 1.5 || !sichtbar(b) || b.querySelector(':scope > :not(svg)')) return;
    const r = document.createRange();
    r.selectNodeContents(b);
    if (zeilenZahl(rechtecke(r)) > 1)
      out.c18.push(`zweizeilig: ${b.textContent?.trim().slice(0, 30)}`);
  });
  // C23, wie CHECK_JS in design/werkzeug/pruef_c.py: Tag und Monat brechen nie auseinander. Geprüft an
  // der Quelle: Zwischen „12.“ und „Juli“ steht ein geschütztes Leerzeichen.
  const monate =
    /\b\d{1,2}\. (Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|Jan|Feb|Mär|Apr|Aug|Sep|Sept|Okt|Nov|Dez)\b/;
  for (const wurzel of document.querySelectorAll('main, .leiste, dialog[open]')) {
    const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    while (gang.nextNode()) {
      const m = gang.currentNode.textContent?.match(monate);
      if (m) out.c23.push(m[0]);
    }
  }
  // C24, ebenso: Kästen und Buttons halten mindestens 12 px Abstand zum Bildschirmrand, ganz breite
  // Flächen wie Blätter ausgenommen. C25: Personenkarten und Hauptbutton nutzen die Breite.
  document.querySelectorAll('main *, .leiste *, dialog[open] *').forEach((e) => {
    if (e.closest('svg') || !sichtbar(e)) return;
    const stil = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (!r.width || !r.height || r.width >= window.innerWidth - 1) return;
    const kasten =
      parseFloat(stil.borderTopLeftRadius) >= 8 &&
      (stil.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(stil.borderTopWidth) > 0);
    if (kasten && (r.left < 11.5 || r.right > window.innerWidth - 11.5))
      out.c24.push(
        `${(e.textContent ?? e.tagName).trim().slice(0, 24)} ${Math.round(r.left)}–${Math.round(r.right)}`,
      );
  });
  document.querySelectorAll('.band .karte, .leiste .haupt').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (r.width && r.right < window.innerWidth - 32)
      out.c25.push(`${(e.textContent ?? '').trim().slice(0, 20)} ${Math.round(r.right)}`);
  });
  // C26, wie OVERLAP_JS in design/werkzeug/pruef_c19.py: Text und Knöpfe liegen nicht aufeinander.
  // Gemessen werden die Textzeilen, nicht der Kasten: Umgebrochener Text neben „Warum?“ und eine
  // Überschrift neben dem × wären sonst Treffer. Was ein Rollbereich abschneidet, zählt nicht.
  // Gewollt überlappen die Kreise der Haushaltszeile (.figuren) und die Datumsfunde im Dokument (.fund);
  // unter einen festen Knopf (sticky, fixed) rollt Text wie unter die Leiste.
  const wurzel = document.querySelector('dialog[open]') ?? main;
  const haftet = (e: Element): boolean => {
    for (let p: Element | null = e; p && p !== wurzel; p = p.parentElement)
      if (/sticky|fixed/.test(getComputedStyle(p).position)) return true;
    return false;
  };
  const flaechen = [...wurzel.querySelectorAll('*')].filter(
    (e) =>
      !e.closest('svg, .deko, .leiste, .figuren, .fund') &&
      sichtbar(e) &&
      (e.tagName === 'BUTTON' || (!e.children.length && (e.textContent ?? '').trim())) &&
      !haftet(e),
  );
  const beschnitten = (e: Element, r: DOMRect): DOMRect | null => {
    let k = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
    for (let p = e.parentElement; p && p !== wurzel; p = p.parentElement) {
      const st = getComputedStyle(p);
      if (st.overflowY === 'visible' && st.overflowX === 'visible') continue;
      const b = p.getBoundingClientRect();
      k = {
        left: Math.max(k.left, b.left),
        top: Math.max(k.top, b.top),
        right: Math.min(k.right, b.right),
        bottom: Math.min(k.bottom, b.bottom),
      };
    }
    return k.right - k.left > 0 && k.bottom - k.top > 0
      ? new DOMRect(k.left, k.top, k.right - k.left, k.bottom - k.top)
      : null;
  };
  const kaesten = flaechen.map((e) => {
    let liste: DOMRect[];
    if (e.tagName === 'BUTTON') liste = [e.getBoundingClientRect()];
    else {
      const r = document.createRange();
      r.selectNodeContents(e);
      liste = [...r.getClientRects()].filter((x) => x.width > 0 && x.height > 0);
    }
    return liste.map((x) => beschnitten(e, x)).filter((x): x is DOMRect => !!x);
  });
  flaechen.forEach((a, i) => {
    for (let j = i + 1; j < flaechen.length; j++) {
      const b = flaechen[j]!;
      if (a.contains(b) || b.contains(a)) continue;
      const trifft = kaesten[i]!.some((ra) =>
        kaesten[j]!.some(
          (rb) =>
            Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left) > 2 &&
            Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > 2,
        ),
      );
      if (trifft)
        out.c26.push(
          `${(a.textContent ?? '').trim().slice(0, 16)} / ${(b.textContent ?? '').trim().slice(0, 16)}`,
        );
    }
  });
  // C11: nichts ragt über den Bildschirmrand
  document.querySelectorAll('main *, .leiste *').forEach((e) => {
    const r = e.getBoundingClientRect();
    if (!r.width || !sichtbar(e) || e.closest('svg')) return;
    if (r.right > window.innerWidth + 1 || r.left < -1)
      out.c11.push(
        `${e.tagName}.${e.getAttribute('class') ?? ''} ${Math.round(r.left)}–${Math.round(r.right)}`,
      );
  });
  // C11 auch für Text: ein Wort ragt über den Rand, obwohl sein Kasten passt (seit 2.11.).
  for (const { wort, rects, el } of texte) {
    if (el.closest('.band-svg') || getComputedStyle(el).textOverflow === 'ellipsis') continue;
    if (rects.some((x) => x.right > window.innerWidth + 1 || x.left < -1))
      out.c11.push(`Wort „${wort}“`);
  }
  out.hoehe = Math.round(main.getBoundingClientRect().height);
  return out;
}
