// PC25 B6: Was meldet das Teilen-Blatt von iOS? Nur im Testbau (TestFlight), nie im Store-Bau: Nach dem
// Teilen steht kurz da, welche App gewählt war und ob iOS „fertig“ (completed) meldet. Damit prüft der
// Auftraggeber, ob Gmail nur beim echten Senden „fertig“ sagt. Ein Werkzeug zum Prüfen, kein Text der
// Oberfläche, darum nicht in i18n.

import { istIosApp } from './plattform';

let testbau: Promise<boolean> | null = null;

function istTestbau(): Promise<boolean> {
  testbau ??= import('./heftaNativ')
    .then(({ HeftaNativ }) => HeftaNativ.testbau())
    .then((a) => a.ja)
    .catch(() => false);
  return testbau;
}

export async function teilenMelden(app: string | null | undefined, fertig: boolean): Promise<void> {
  if (!istIosApp() || !(await istTestbau())) return;
  window.alert(
    `Nur im Testbau: Das Teilen-Blatt meldet\nApp: ${app || '(keine)'}\ncompleted: ${fertig}`,
  );
}
