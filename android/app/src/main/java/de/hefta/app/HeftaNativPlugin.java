package de.hefta.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import androidx.activity.result.ActivityResult;
import androidx.core.content.IntentCompat;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * Eigene Gerätefunktionen der App: PDFs von anderen Apps empfangen und Dateien über den
 * Sichern-Dialog des Systems ablegen.
 */
@CapacitorPlugin(
    name = "HeftaNativ",
    permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "mitteilungen") }
)
public class HeftaNativPlugin extends Plugin {

    @Override
    public void load() {
        annehmen(getActivity().getIntent());
        erinnerungGetippt(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        annehmen(intent);
        erinnerungGetippt(intent);
    }

    // ---- Erinnerungen (Zeile 9): lokale Mitteilungen über den Wecker von Android ----

    private static final String ABLAGE = "hefta_erinnerungen";

    /** Tipp auf eine Erinnerung: Hefta öffnet die Stelle, um die es geht. */
    private void erinnerungGetippt(Intent intent) {
        if (intent == null) return;
        String ziel = intent.getStringExtra(ErinnerungEmpfaenger.ZIEL);
        if (ziel == null || ziel.isEmpty()) return;
        intent.removeExtra(ErinnerungEmpfaenger.ZIEL);
        JSObject daten = new JSObject();
        daten.put("ziel", ziel);
        notifyListeners("erinnerung", daten, true);
    }

    /** Plant die Erinnerungen neu. Fragt ab Android 13 einmal nach der Erlaubnis, sobald es etwas gibt. */
    @PluginMethod
    public void erinnerungenSetzen(PluginCall call) {
        JSArray liste = call.getArray("liste", new JSArray());
        if (liste.length() > 0
            && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && getPermissionState("mitteilungen") == PermissionState.PROMPT) {
            requestPermissionForAlias("mitteilungen", call, "nachErlaubnis");
            return;
        }
        planen(call);
    }

    @PermissionCallback
    private void nachErlaubnis(PluginCall call) {
        planen(call);
    }

    private void planen(PluginCall call) {
        Context kontext = getContext();
        ErinnerungEmpfaenger.kanalAnlegen(kontext);
        AlarmManager wecker = (AlarmManager) kontext.getSystemService(Context.ALARM_SERVICE);
        SharedPreferences ablage = kontext.getSharedPreferences(ABLAGE, Context.MODE_PRIVATE);
        // Die alten weg, damit nichts doppelt kommt.
        for (String alt : ablage.getStringSet("nummern", new HashSet<>())) {
            PendingIntent pi = weckerAbsicht(kontext, Integer.parseInt(alt), null, PendingIntent.FLAG_NO_CREATE);
            if (pi != null && wecker != null) {
                wecker.cancel(pi);
                pi.cancel();
            }
        }
        Set<String> neu = new HashSet<>();
        boolean erlaubt = NotificationManagerCompat.from(kontext).areNotificationsEnabled();
        JSONArray liste = call.getArray("liste", new JSArray());
        if (erlaubt && wecker != null) {
            for (int i = 0; i < liste.length(); i++) {
                JSONObject e = liste.optJSONObject(i);
                if (e == null) continue;
                int nummer = e.optInt("nummer");
                Intent inhalt = new Intent(kontext, ErinnerungEmpfaenger.class);
                inhalt.putExtra("nummer", nummer);
                inhalt.putExtra("titel", e.optString("titel"));
                inhalt.putExtra("text", e.optString("text"));
                inhalt.putExtra("ziel", e.optString("ziel"));
                PendingIntent pi = weckerAbsicht(kontext, nummer, inhalt, PendingIntent.FLAG_UPDATE_CURRENT);
                // Ungefähr genügt; genaue Wecker bräuchten eine eigene Berechtigung.
                wecker.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, (long) e.optDouble("am"), pi);
                neu.add(Integer.toString(nummer));
            }
        }
        ablage.edit().putStringSet("nummern", neu).apply();
        JSObject antwort = new JSObject();
        antwort.put("erlaubt", erlaubt);
        call.resolve(antwort);
    }

    private static PendingIntent weckerAbsicht(Context kontext, int nummer, Intent inhalt, int art) {
        Intent absicht = inhalt != null ? inhalt : new Intent(kontext, ErinnerungEmpfaenger.class);
        return PendingIntent.getBroadcast(kontext, nummer, absicht, art | PendingIntent.FLAG_IMMUTABLE);
    }

    private void annehmen(Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        List<Uri> quellen = new ArrayList<>();
        switch (intent.getAction()) {
            case Intent.ACTION_SEND:
                Uri eine = IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri.class);
                if (eine != null) quellen.add(eine);
                break;
            case Intent.ACTION_SEND_MULTIPLE:
                List<Uri> mehrere = IntentCompat.getParcelableArrayListExtra(intent, Intent.EXTRA_STREAM, Uri.class);
                if (mehrere != null) quellen.addAll(mehrere);
                break;
            case Intent.ACTION_VIEW:
                if (intent.getData() != null) quellen.add(intent.getData());
                break;
            default:
                return;
        }
        if (quellen.isEmpty()) return;
        // Sonst käme dieselbe Datei nach einem Neuaufbau der Activity noch einmal an.
        getActivity().setIntent(new Intent(Intent.ACTION_MAIN));
        getBridge().execute(() -> {
            JSArray dateien = new JSArray();
            for (Uri quelle : quellen) {
                try {
                    String name = nameVon(quelle);
                    File ordner = new File(getContext().getCacheDir(), "eingang");
                    ordner.mkdirs();
                    File ziel = new File(ordner, name);
                    try (InputStream rein = getContext().getContentResolver().openInputStream(quelle);
                         OutputStream raus = new FileOutputStream(ziel)) {
                        kopieren(rein, raus);
                    }
                    JSObject datei = new JSObject();
                    datei.put("uri", Uri.fromFile(ziel).toString());
                    datei.put("name", name);
                    dateien.put(datei);
                } catch (IOException | SecurityException e) {
                    android.util.Log.w("HeftaNativ", "Datei nicht angenommen", e);
                }
            }
            if (dateien.length() == 0) return;
            JSObject daten = new JSObject();
            daten.put("dateien", dateien);
            notifyListeners("eingang", daten, true);
        });
    }

    /** Nur der Dateiname, ohne Pfad: Er kommt von einer fremden App. */
    private String nameVon(Uri quelle) {
        String name = null;
        try (Cursor zeile = getContext().getContentResolver().query(quelle, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (zeile != null && zeile.moveToFirst()) name = zeile.getString(0);
        } catch (RuntimeException ignoriert) {
            // Manche Quellen beantworten das nicht; dann bleibt der Name aus der Adresse.
        }
        if (name == null) name = quelle.getLastPathSegment();
        if (name == null || name.isEmpty()) name = "Dokument.pdf";
        return new File(name).getName();
    }

    private static void kopieren(InputStream rein, OutputStream raus) throws IOException {
        if (rein == null || raus == null) throw new IOException("Datei nicht lesbar");
        byte[] puffer = new byte[64 * 1024];
        int anzahl;
        while ((anzahl = rein.read(puffer)) != -1) raus.write(puffer, 0, anzahl);
    }

    @PluginMethod
    public void alsDateiSichern(PluginCall call) {
        Intent dialog = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        dialog.addCategory(Intent.CATEGORY_OPENABLE);
        dialog.setType(call.getString("typ", "application/octet-stream"));
        dialog.putExtra(Intent.EXTRA_TITLE, call.getString("name", "Hefta"));
        startActivityForResult(call, dialog, "gesichert");
    }

    @ActivityCallback
    private void gesichert(PluginCall call, ActivityResult ergebnis) {
        if (call == null) return;
        Intent antwort = ergebnis.getData();
        if (ergebnis.getResultCode() != Activity.RESULT_OK || antwort == null || antwort.getData() == null) {
            JSObject nein = new JSObject();
            nein.put("gesichert", false);
            call.resolve(nein);
            return;
        }
        Uri ziel = antwort.getData();
        String quelle = Uri.parse(call.getString("uri", "")).getPath();
        getBridge().execute(() -> {
            try (InputStream rein = new FileInputStream(quelle);
                 OutputStream raus = getContext().getContentResolver().openOutputStream(ziel)) {
                kopieren(rein, raus);
                JSObject ja = new JSObject();
                ja.put("gesichert", true);
                call.resolve(ja);
            } catch (IOException | SecurityException e) {
                call.reject("Sichern hat nicht geklappt", e);
            }
        });
    }
}
