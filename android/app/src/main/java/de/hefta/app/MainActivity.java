package de.hefta.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    /** Der erste Link in einem geteilten Text (E75: manche Portale teilen Titel mit Link). */
    private static final Pattern LINK = Pattern.compile("https?://[^\\s<>\"']+");

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(HeftaNativPlugin.class);
        geteiltenTextUmschreiben(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        geteiltenTextUmschreiben(intent);
        super.onNewIntent(intent);
    }

    /**
     * Teilen an Hefta (E81): Ein geteilter Text mit Link wird zu hefta://teilen?link=…, so wie auf dem iPhone.
     * Hefta öffnet damit die Vorschau. Gelesen wird nur der Text, den die Portal-App übergibt; geladen wird
     * die Seite erst in der App, genau einmal (E72).
     */
    private static void geteiltenTextUmschreiben(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String typ = intent.getType();
        if (typ == null || !typ.startsWith("text/")) return;
        String text = intent.getStringExtra(Intent.EXTRA_TEXT);
        if (text == null) return;
        Matcher fund = LINK.matcher(text);
        if (!fund.find()) return;
        String link = fund.group().replaceAll("[).,;:!?»“”]+$", "");
        intent.setAction(Intent.ACTION_VIEW);
        intent.setData(Uri.parse("hefta://teilen?link=" + Uri.encode(link)));
    }
}
