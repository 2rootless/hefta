// Teilen-Probe: Läuft nur, wenn man aus Safari an „Hefta Probe“ teilt. Gibt Adresse, Titel, Auswahl und
// den sichtbaren Text der Seite an die Probe; die schreibt ihn ins Protokoll. Nichts geht ins Netz.
var Vorverarbeitung = function () {};

Vorverarbeitung.prototype = {
  run: function (argumente) {
    argumente.completionFunction({
      url: document.URL,
      titel: document.title,
      sprache: document.documentElement.lang || '',
      auswahl: String(window.getSelection() || ''),
      text: document.body ? document.body.innerText : '',
    });
  },
};

var ExtensionPreprocessingJS = new Vorverarbeitung();
