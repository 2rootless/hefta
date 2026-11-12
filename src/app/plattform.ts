// Web oder App (docs/test-native-apps.md). In der App laufen Teilen, Sichern und das Empfangen von
// PDFs über das System; im Browser bleibt alles, wie es ist. Die App-Bausteine laden nur in der App.

interface Bruecke {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  convertFileSrc?: (pfad: string) => string;
}

const bruecke = () => (window as unknown as { Capacitor?: Bruecke }).Capacitor;

export function istApp(): boolean {
  return !!bruecke()?.isNativePlatform?.();
}

export function istIosApp(): boolean {
  return istApp() && bruecke()?.getPlatform?.() === 'ios';
}

/**
 * Gibt es den Weg „Link einsetzen → Vorschau“ (B23)? Nur in der App für iPhone; Browsertests setzen
 * `window.__heftaInseratTest` (siehe `heftaInserat.ts`). Ohne Capacitor zu laden.
 */
export function linkWegDa(): boolean {
  return (
    !!(window as unknown as { __heftaInseratTest?: unknown }).__heftaInseratTest || istIosApp()
  );
}

export function istAndroidApp(): boolean {
  return istApp() && bruecke()?.getPlatform?.() === 'android';
}

/** Durch 3 teilbar: So lassen sich die Base64-Stücke einzeln anhängen. */
const STUECK = 3 * 1024 * 1024;
const ORDNER = 'ausgabe';

function base64(teil: Blob): Promise<string> {
  return new Promise((fertig, fehler) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result).split(',')[1] ?? '');
    leser.onerror = () => fehler(leser.error);
    leser.readAsDataURL(teil);
  });
}

/** Legt die Datei im Cache der App ab (nur für Teilen und Sichern) und gibt ihre Adresse zurück. */
export async function ablegen(datei: File): Promise<string> {
  const { Directory, Filesystem } = await import('@capacitor/filesystem');
  const path = `${ORDNER}/${datei.name}`;
  await Filesystem.writeFile({
    path,
    data: await base64(datei.slice(0, STUECK)),
    directory: Directory.Cache,
    recursive: true,
  });
  for (let von = STUECK; von < datei.size; von += STUECK)
    await Filesystem.appendFile({
      path,
      data: await base64(datei.slice(von, von + STUECK)),
      directory: Directory.Cache,
    });
  return (await Filesystem.getUri({ path, directory: Directory.Cache })).uri;
}

/** Kopien fürs Teilen und Sichern entfernen; beim Start und vor dem nächsten Mal. */
export async function ablageLeeren(): Promise<void> {
  const { Directory, Filesystem } = await import('@capacitor/filesystem');
  await Filesystem.rmdir({ path: ORDNER, directory: Directory.Cache, recursive: true }).catch(
    () => {},
  );
}

/** Teilen-Blatt des Systems. False, wenn abgebrochen. */
export async function appTeilen(dateien: File[], text?: string): Promise<boolean> {
  await ablageLeeren();
  const files: string[] = [];
  for (const datei of dateien) files.push(await ablegen(datei));
  const { Share } = await import('@capacitor/share');
  try {
    await Share.share(text ? { files, text } : { files });
    return true;
  } catch {
    return false;
  }
}

/** Sichern-Dialog des Systems, je Datei einmal. False, wenn abgebrochen. */
export async function appSichern(dateien: File[]): Promise<boolean> {
  await ablageLeeren();
  const { HeftaNativ } = await import('./heftaNativ');
  for (const datei of dateien) {
    const antwort = await HeftaNativ.alsDateiSichern({
      uri: await ablegen(datei),
      name: datei.name,
      typ: datei.type || 'application/octet-stream',
    });
    if (!antwort.gesichert) return false;
  }
  return true;
}

/** Eine Datei aus dem Speicher der App lesen, z. B. ein empfangenes PDF. */
export async function appDateiLesen(
  uri: string,
  name: string,
  typ = 'application/pdf',
): Promise<File> {
  const antwort = await fetch(bruecke()?.convertFileSrc?.(uri) ?? uri);
  return new File([await antwort.blob()], name, { type: typ });
}

/**
 * Backup wählen über iOS selbst: nur Hefta-Backups, keine Fotos, keine Kamera (Aufgabe 53). Gibt
 * `undefined` zurück, wenn abgebrochen. Nur in der App für iOS aufrufen.
 */
export async function appBackupWaehlen(): Promise<File | undefined> {
  const { HeftaNativ } = await import('./heftaNativ');
  const { uri, name } = await HeftaNativ.backupWaehlen();
  return uri && name ? appDateiLesen(uri, name, 'application/octet-stream') : undefined;
}

/**
 * Klick auf die Zeile „Backup einspielen“: In der App für iOS die eigene Auswahl statt der Auswahl
 * der Web-Ansicht.
 */
export function backupKlick(ereignis: MouseEvent, gewaehlt: (datei: File | undefined) => void) {
  if (!istIosApp()) return;
  ereignis.preventDefault();
  void appBackupWaehlen().then(gewaehlt);
}
