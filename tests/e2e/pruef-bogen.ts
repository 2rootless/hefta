// Prüfkatalog DP134 (E1 bis E17) und DP135 für „Der Bogen selbst“, nach Designs pruef134.js, an den Bau angepasst: Er
// läuft in der Seite und gibt die Funde zurück. Gegenproben stehen im Test (pruefkatalog-bogen.spec.ts).

export interface BogenArg {
  mehr: boolean;
  /** Namen im Vertrag, die erste ist Ansprechperson (E13). */
  namen: string[];
  wbsJa: boolean;
  /** Formular mit Anschrift (E8). */
  form: boolean;
}

export function bogenKatalog(arg: BogenArg): string[] {
  const funde: string[] = [];
  const add = (k: string, ok: boolean, w: string) => {
    if (!ok && funde.filter((f) => f.startsWith(k + ' ')).length < 4) funde.push(`${k} ${w}`);
  };
  const vis = (e: Element) => {
    const r = e.getBoundingClientRect();
    const s = getComputedStyle(e);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none';
  };
  const rgb = (c: string) => (c.match(/[\d.]+/g) ?? ['0', '0', '0', '0']).map(Number);
  const lum = ([r, g, b]: number[]) => {
    const f = (v: number) => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
  };
  const kon = (a: number[], b: number[]) => {
    const x = lum(a);
    const y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };
  const grund = (e: Element | null): number[] => {
    let x = e;
    while (x) {
      const c = rgb(getComputedStyle(x).backgroundColor);
      if (c[3] === undefined || c[3] > 0.5) return c;
      x = x.parentElement;
    }
    return rgb(getComputedStyle(document.body).backgroundColor);
  };
  const zoom = parseFloat(document.documentElement.style.getPropertyValue('zoom') || '1') || 1;
  const W = innerWidth * zoom;
  const bereich = [...document.querySelectorAll('main *, .leiste *')];

  // E1 Überlauf und zerbrochene Namen
  add('E1', document.documentElement.scrollWidth <= innerWidth, 'Seite breiter');
  for (const e of bereich) {
    if (!vis(e)) continue;
    const r = e.getBoundingClientRect();
    if (r.right > W + 0.5 || r.left < -0.5)
      add('E1', false, `${e.className || e.tagName} ${Math.round(r.left)}–${Math.round(r.right)}`);
  }
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  while ((n = tw.nextNode())) {
    const t = n as Text;
    for (const wort of [
      'Konstantin',
      'Ellerbrock',
      'Ostendorp',
      'Ansprechperson',
      'Unterschrift',
    ]) {
      const i = t.data.indexOf(wort);
      if (i < 0 || !t.parentElement || !vis(t.parentElement)) continue;
      const rg = document.createRange();
      rg.setStart(t, i);
      rg.setEnd(t, i + wort.length);
      const zeilen = new Set(
        [...rg.getClientRects()].filter((x) => x.width > 0).map((x) => Math.round(x.top)),
      );
      if (zeilen.size > 1) add('E1', false, `${wort} zerbrochen`);
    }
  }
  // E2 Kontrast: Text ≥ 4,5, Feldgrenzen ≥ 3
  for (const e of bereich) {
    if (!vis(e)) continue;
    if (![...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim())) continue;
    const k = kon(rgb(getComputedStyle(e).color), grund(e));
    if (k < 4.5) add('E2', false, `${e.textContent!.trim().slice(0, 24)} ${k.toFixed(2)}`);
  }
  for (const i of document.querySelectorAll('main input')) {
    if (!vis(i) || (i as HTMLInputElement).type === 'radio') continue;
    const s = getComputedStyle(i);
    if (parseFloat(s.borderBottomWidth) <= 0) continue;
    const k = kon(rgb(s.borderBottomColor), grund(i.parentElement));
    if (k < 3) add('E2', false, `Feldgrenze ${k.toFixed(2)}`);
  }
  // E3 Rot nur an „Zurück“
  const probe = document.createElement('i');
  probe.style.color = 'var(--accent-text)';
  document.body.append(probe);
  const rot = getComputedStyle(probe).color;
  probe.remove();
  for (const e of document.querySelectorAll('main *, .leiste *')) {
    if (!vis(e) || e.closest('.zurueck')) continue;
    const s = getComputedStyle(e);
    const text = [...e.childNodes].some((c) => c.nodeType === 3 && c.textContent!.trim());
    if ((s.color === rot && text) || s.backgroundColor === rot || s.borderBottomColor === rot)
      add('E3', false, `${e.className || e.tagName}`);
  }
  // E4 Tippflächen ab 44 px (Felder und Knöpfe; Etiketten-Links im Text ausgenommen)
  for (const e of document.querySelectorAll('main button, main a, main input, .leiste button')) {
    if (!vis(e) || (e as HTMLInputElement).type === 'radio') continue;
    const r = e.getBoundingClientRect();
    if (r.height / zoom < 43.5 || r.width / zoom < 43.5)
      add(
        'E4',
        false,
        `${(e.textContent || e.getAttribute('aria-label') || e.tagName).trim().slice(0, 20)} ${Math.round(r.width)}×${Math.round(r.height)}`,
      );
  }
  // E5 verbotene Wörter (W32): „muss“, „Pflicht“, „Achtung“, Ausrufezeichen, Rollenwörter
  const text =
    (document.querySelector('main') as HTMLElement).innerText +
    ' ' +
    (document.querySelector('.leiste') as HTMLElement | null)?.innerText;
  for (const re of [/\bmuss\b/i, /\bmüsst\b/i, /Pflicht/, /Achtung/, /Hauptmiet/i, /Mitmiet/i, /!/])
    if (re.test(text)) add('E5', false, String(re));
  // E6 Anrede: bei mehreren ihr, bei einer Person du
  if (arg.mehr) {
    const m = text.match(/\b(du|dir|dich|dein|deine|einträgst|hast|löschst)\b/i);
    if (m) add('E6', false, `du-Form bei mehreren: ${m[0]}`);
  } else {
    const m = text.match(/\b(ihr|euch|euer|eure|euren|eintragt|habt|löscht)\b/i);
    if (m) add('E6', false, `ihr-Form bei einer Person: ${m[0]}`);
  }
  // E8 W60: drei Anschriftfelder, kein gemeinsames Feld
  if (arg.form) {
    const namen = [...document.querySelectorAll('main input')]
      .filter(vis)
      .map((i) => (i.closest('label')?.textContent ?? i.getAttribute('aria-label') ?? '').trim());
    for (const L of ['Straße und Hausnummer', 'PLZ', 'Ort'])
      add(
        'E8',
        namen.some((x) => x === L),
        `fehlt: ${L}`,
      );
    add('E8', !namen.some((x) => /^Anschrift$|Straße, Ort/.test(x)), 'gemeinsames Feld');
  }
  // E10 gesperrter Hauptknopf nennt, was fehlt
  for (const h of document.querySelectorAll('[aria-disabled="true"]')) {
    if (!vis(h)) continue;
    const id = h.getAttribute('aria-describedby');
    const t = id ? document.getElementById(id) : null;
    add('E10', !!t && /^Es fehlt noch/.test(t.textContent!.trim()), 'gesperrt ohne Satz');
  }
  // E13 Übernehmen nennt alle im Vertrag und die Ansprechperson
  const kasten = [...document.querySelectorAll('.kasten')].find(vis) as HTMLElement | undefined;
  if (kasten && arg.namen.length) {
    for (const nm of arg.namen) add('E13', kasten.innerText.includes(nm), `fehlt ${nm}`);
    add(
      'E13',
      /ist Ansprechperson|und ist Ansprechperson/.test(kasten.innerText) &&
        kasten.innerText.includes(arg.namen[0]!),
      'Ansprechperson fehlt',
    );
    if (arg.wbsJa)
      add(
        'E15',
        /Wohnberechtigungsschein/.test(kasten.innerText) &&
          /Für den ganzen Haushalt/.test(kasten.innerText),
        'Kasten ohne Ort des WBS',
      );
  }
  // E14 Personenzeichen mit Buchstabe
  for (const z of document.querySelectorAll('main .zeichen'))
    if (vis(z)) add('E14', /^[A-ZÄÖÜ?]$/.test(z.textContent!.trim()), 'Zeichen ohne Buchstabe');
  // E15 WBS einmal je Blatt, unter HAUSHALT, als Gruppe mit Namen
  if (arg.form && document.querySelector('main h1')?.textContent?.includes('Selbst'))
    for (const b of document.querySelectorAll('section.blatt')) {
      if (!vis(b)) continue;
      const w = b.querySelectorAll('[role="radiogroup"][aria-label="Wohnberechtigungsschein"]');
      add('E15', w.length === 1, `WBS-Gruppen: ${w.length}`);
      const abschnitte = [...b.querySelectorAll('h3')];
      const vor = abschnitte
        .filter((h) => w[0] && h.compareDocumentPosition(w[0]) & Node.DOCUMENT_POSITION_FOLLOWING)
        .at(-1);
      add('E15', !!vor && /Haushalt/i.test(vor.textContent!), 'WBS nicht unter HAUSHALT');
    }
  // E17 große Bildschirme: mittig, Rand ≥ 64, Inhalt ≥ 50 %, Pult statt Leiste
  if (innerWidth >= 1600) {
    const vorn = document.querySelector('main .vorn')!.getBoundingClientRect();
    const pult = document.querySelector('main .pult') as HTMLElement;
    add('E17', vis(pult), 'kein Pult');
    add(
      'E17',
      !document.querySelector('.leiste') || !vis(document.querySelector('.leiste')!),
      'Leiste unten trotz Pult',
    );
    const p = pult.getBoundingClientRect();
    const links = vorn.left;
    const rechts = innerWidth * zoom - p.right;
    add(
      'E17',
      links >= 63.5 && rechts >= 63.5,
      `Rand ${Math.round(links)} / ${Math.round(rechts)}`,
    );
    add(
      'E17',
      Math.abs(links - rechts) <= Math.max(48, innerWidth * zoom * 0.02) || innerWidth >= 3000,
      `nicht mittig ${Math.round(links)} / ${Math.round(rechts)}`,
    );
    const breite = (p.right - vorn.left) / (innerWidth * zoom);
    add(
      'E17',
      breite >= 0.5 || (!arg.mehr && innerWidth >= 3000),
      `Inhalt ${Math.round(breite * 100)} %`,
    );
    if (innerWidth >= 2400 && arg.mehr) {
      const blaetter = [...document.querySelectorAll('section.blatt')]
        .filter(vis)
        .map((b) => b.getBoundingClientRect());
      add(
        'E17',
        blaetter.length >= 2 && Math.abs(blaetter[0]!.top - blaetter[1]!.top) < 40,
        'Bögen nicht nebeneinander',
      );
    }
  }
  return funde;
}

/** E16 Tastatur: jedes fokussierbare Element hat einen Namen und zeigt den Fokus; Reihenfolge Bogen → Pult. */
export function tastaturFunde(): string[] {
  const funde: string[] = [];
  const els = [
    ...document.querySelectorAll<HTMLElement>('main a[href], main button, main input'),
  ].filter((e) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  });
  for (const e of els) {
    const name =
      e.getAttribute('aria-label') ||
      e.textContent!.trim() ||
      (e as HTMLInputElement).placeholder ||
      e.closest('label')?.textContent!.trim() ||
      (e.getAttribute('aria-labelledby')
        ? document.getElementById(e.getAttribute('aria-labelledby')!)?.textContent
        : '');
    if (!name) funde.push(`E16 ohne Namen: ${e.tagName} ${e.className}`);
  }
  // Reihenfolge: Im DOM steht das Pult hinter dem Bogen.
  const pult = document.querySelector('main .pult');
  const blatt = document.querySelector('main section.blatt');
  if (pult && blatt && !(blatt.compareDocumentPosition(pult) & Node.DOCUMENT_POSITION_FOLLOWING))
    funde.push('E16 Pult vor dem Bogen');
  return funde;
}
