// Teilen-Probe: Läuft nur, wenn man aus Safari an „Hefta Probe“ teilt. Gibt Adresse, Titel, Auswahl und
// den sichtbaren Text der Seite an die Probe; die schreibt ihn ins Protokoll. Nichts geht ins Netz.
// Bericht 61 (E46): Dazu sucht sie, ob die Seite die Lage als Zahlen enthält (JSON-LD, Meta-Angaben,
// Datenattribute, Kartenlinks, Skripte). Sie liest nur, was schon in der Seite steht, und lädt nichts nach.
var Vorverarbeitung = function () {};

function heftaOrte() {
  var funde = [];
  function merke(quelle, lat, lon, zusatz) {
    var a = parseFloat(lat);
    var o = parseFloat(lon);
    // Nur Deutschland, grob: so fallen Preise, Flächen und Kennungen heraus.
    if (isNaN(a) || isNaN(o) || a < 47 || a > 55.2 || o < 5.5 || o > 15.5) return;
    if (funde.length < 20) funde.push({ quelle: quelle, lat: a, lon: o, zusatz: zusatz || '' });
  }
  function geoSuchen(x, tiefe) {
    if (!x || typeof x !== 'object' || tiefe > 8) return;
    if (x.latitude !== undefined && x.longitude !== undefined) merke('json-ld', x.latitude, x.longitude);
    for (var k in x) if (Object.prototype.hasOwnProperty.call(x, k)) geoSuchen(x[k], tiefe + 1);
  }
  try {
    var ld = document.querySelectorAll('script[type="application/ld+json"]');
    for (var i = 0; i < ld.length; i++) {
      try { geoSuchen(JSON.parse(ld[i].textContent), 0); } catch (e) { /* kaputtes JSON-LD */ }
    }
    var meta = function (n) {
      var m = document.querySelector('meta[property="' + n + '"],meta[name="' + n + '"]');
      return m ? m.getAttribute('content') : null;
    };
    merke('meta-place', meta('place:location:latitude'), meta('place:location:longitude'));
    merke('meta-og', meta('og:latitude'), meta('og:longitude'));
    var pos = meta('geo.position') || meta('ICBM');
    if (pos) { var p = pos.split(/[;,]\s*/); merke('meta-geo', p[0], p[1]); }
    var attr = document.querySelectorAll('[data-lat],[data-latitude],[data-lng],[data-lon]');
    for (var j = 0; j < attr.length && j < 20; j++) {
      var el = attr[j];
      merke('data-attribut', el.getAttribute('data-lat') || el.getAttribute('data-latitude'),
        el.getAttribute('data-lng') || el.getAttribute('data-lon') || el.getAttribute('data-longitude'),
        el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 40));
    }
    var links = document.querySelectorAll('a[href*="maps"],iframe[src*="maps"],img[src*="maps"]');
    for (var l = 0; l < links.length && l < 20; l++) {
      var u = links[l].getAttribute('href') || links[l].getAttribute('src') || '';
      var m1 = u.match(/(?:q|center|ll|query|destination)=(-?\d{1,2}\.\d+)(?:,|%2C)(-?\d{1,3}\.\d+)/);
      if (m1) merke('kartenlink', m1[1], m1[2], u.split('?')[0].slice(0, 60));
    }
    var skripte = document.querySelectorAll('script:not([src])');
    var muster = /["']?(lat|latitude)["']?\s*[:=]\s*["']?(-?\d{1,2}\.\d{3,})["']?[^{}]{0,80}?["']?(lng|lon|long|longitude)["']?\s*[:=]\s*["']?(-?\d{1,3}\.\d{3,})/g;
    for (var s = 0; s < skripte.length; s++) {
      var t = skripte[s].textContent || '';
      if (t.length > 2000000) continue;
      var m2;
      muster.lastIndex = 0;
      while ((m2 = muster.exec(t)) !== null && funde.length < 20) {
        merke('skript', m2[2], m2[4], t.slice(Math.max(0, m2.index - 40), m2.index).replace(/\s+/g, ' '));
      }
    }
  } catch (e) {
    funde.push({ quelle: 'fehler', zusatz: String(e).slice(0, 120) });
  }
  return JSON.stringify(funde);
}

Vorverarbeitung.prototype = {
  run: function (argumente) {
    argumente.completionFunction({
      url: document.URL,
      titel: document.title,
      sprache: document.documentElement.lang || '',
      auswahl: String(window.getSelection() || ''),
      text: document.body ? document.body.innerText : '',
      orte: heftaOrte(),
    });
  },
};

var ExtensionPreprocessingJS = new Vorverarbeitung();
