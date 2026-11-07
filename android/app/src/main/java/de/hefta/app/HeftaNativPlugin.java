package de.hefta.app;

import android.app.Activity;
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
@CapacitorPlugin(name = "HeftaNativ")
public class HeftaNativPlugin extends Plugin {

    @Override
    public void load() {
        annehmen(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        annehmen(intent);
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
