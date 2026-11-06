import boldUrl from './fonts/Archivo-Bold.ttf?url';
import titelUrl from './fonts/Archivo-ExtraBold-Wide.ttf?url';
import regularUrl from './fonts/Archivo-Regular.ttf?url';
import plexBoldUrl from './fonts/IBMPlexSans-Bold.ttf?url';
import plexRegularUrl from './fonts/IBMPlexSans-Regular.ttf?url';
import serifBoldUrl from './fonts/SourceSerif4-Bold.ttf?url';
import serifRegularUrl from './fonts/SourceSerif4-Regular.ttf?url';
import type { MappenSchrift } from '../domain/modell';
import type { Schriften } from './mappe';

// Die Schriften für erzeugte PDFs, mit der App ausgeliefert (kein Netz zur Laufzeit), alle unter der OFL.
const DATEIEN: Record<MappenSchrift, { regular: string; bold: string; titel: string }> = {
  archivo: { regular: regularUrl, bold: boldUrl, titel: titelUrl },
  source_serif: { regular: serifRegularUrl, bold: serifBoldUrl, titel: serifBoldUrl },
  plex_sans: { regular: plexRegularUrl, bold: plexBoldUrl, titel: plexBoldUrl },
};

export async function pdfSchriftenLaden(schrift: MappenSchrift = 'archivo'): Promise<Schriften> {
  const laden = async (url: string) => new Uint8Array(await (await fetch(url)).arrayBuffer());
  const d = DATEIEN[schrift];
  const [regular, bold, titel] = await Promise.all([
    laden(d.regular),
    laden(d.bold),
    laden(d.titel),
  ]);
  return { regular, bold, titel };
}
