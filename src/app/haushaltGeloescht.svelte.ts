// Nach „Haushalt löschen“ (E96): Die Startseite der Mappe fragt einmal, ob auch die Hefte weg sollen. Sie
// löscht nicht selbst, sondern führt zu „Alles löschen“ mit eigener Bestätigung.

export const nachLoeschen = $state<{ offen: boolean; du: boolean }>({ offen: false, du: false });
