#!/bin/sh
# PC188: Nimmt die Store-Bilder 01 bis 09 im Simulator auf, je in 1320 × 2868 (Pro Max) und 1206 × 2622 (Pro).
# Die App (Bau mit VITE_AUFNAHMEN=1) meldet „AUFNAHME BEREIT nn“ auf die Konsole; dann wird das Bild genommen.
# Je Gerät stehen in aufnahmen/<gerät>/messung.txt Gerät, Pixelgröße, Skala und safe-area-inset-top.
set -eu
APP=$(find build-sim/Build/Products -maxdepth 2 -name App.app | head -n 1)
test -n "$APP" || { echo "App.app nicht gefunden"; exit 1; }
BUNDLE=$(/usr/libexec/PlistBuddy -c 'Print :CFBundleIdentifier' "$APP/Info.plist")
mkdir -p aufnahmen
xcrun simctl list devicetypes > aufnahmen/geraetetypen.txt
RUNTIME=$(xcrun simctl list runtimes -j | python3 -c '
import json, sys
r = [x for x in json.load(sys.stdin)["runtimes"] if x["platform"] == "iOS" and x["isAvailable"]]
print(sorted(r, key=lambda x: [int(t) for t in x["version"].split(".")])[-1]["identifier"])')
echo "Laufzeit: $RUNTIME" | tee aufnahmen/laufzeit.txt

typ() {
  # Gerätetyp nach Namen; gibt es ihn nicht, leer.
  xcrun simctl list devicetypes -j | python3 -c '
import json, sys
n = sys.argv[1]
print(next((d["identifier"] for d in json.load(sys.stdin)["devicetypes"] if d["name"] == n), ""))' "$1"
}

aufnehmen() {
  NAME="$1"; KURZ="$2"; ERSATZ="$3"
  T=$(typ "$NAME")
  if [ -z "$T" ]; then echo "$NAME fehlt, nehme $ERSATZ"; NAME="$ERSATZ"; T=$(typ "$NAME"); fi
  test -n "$T" || { echo "Kein Gerätetyp für $KURZ"; return 1; }
  ZIEL="aufnahmen/$KURZ"; mkdir -p "$ZIEL"
  UDID=$(xcrun simctl create "Hefta $KURZ" "$T" "$RUNTIME")
  xcrun simctl boot "$UDID"
  xcrun simctl bootstatus "$UDID" -b > /dev/null
  xcrun simctl ui "$UDID" appearance light
  xcrun simctl status_bar "$UDID" override --time 9:41 --dataNetwork wifi --wifiMode active --wifiBars 3 \
    --cellularMode active --cellularBars 4 --batteryState charged --batteryLevel 100 --operatorName ''
  xcrun simctl install "$UDID" "$APP"
  sleep 5
  LOG="$ZIEL/konsole.txt"
  xcrun simctl launch --console-pty "$UDID" "$BUNDLE" > "$LOG" 2>&1 &
  PID=$!
  for NR in 01 02 03 04 05 06 07 08 09; do
    I=0
    until grep -q "AUFNAHME BEREIT $NR" "$LOG" 2>/dev/null; do
      if grep -q "AUFNAHME FEHLER" "$LOG"; then echo "Fehler in der App:"; grep "AUFNAHME" "$LOG"; break 2; fi
      I=$((I + 1)); if [ $I -gt 240 ]; then echo "Keine Meldung für $NR"; break 2; fi
      sleep 0.5
    done
    xcrun simctl io "$UDID" screenshot --type=png "$ZIEL/$NR.png"
  done
  B=$(sips -g pixelWidth "$ZIEL/01.png" 2>/dev/null | awk '/pixelWidth/ {print $2}')
  H=$(sips -g pixelHeight "$ZIEL/01.png" 2>/dev/null | awk '/pixelHeight/ {print $2}')
  {
    echo "Gerät: $NAME"
    echo "Pixel: ${B:-?} x ${H:-?}"
    echo "Skala: 3"
    grep "SAFE-AREA-TOP" "$LOG" | sed 's/.*SAFE-AREA-TOP/safe-area-inset-top (pt):/' | head -n 1
  } | tee "$ZIEL/messung.txt"
  grep "AUFNAHME" "$LOG" || echo "Keine Meldung der App in der Konsole"
  kill "$PID" 2>/dev/null || true
  xcrun simctl shutdown "$UDID" || true
  xcrun simctl delete "$UDID" || true
}

aufnehmen "iPhone 17 Pro Max" "1320x2868" "iPhone 16 Pro Max"
aufnehmen "iPhone 17 Pro" "1206x2622" "iPhone 16 Pro"
ls -R aufnahmen
