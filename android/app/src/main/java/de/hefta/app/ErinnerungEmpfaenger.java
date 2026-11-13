package de.hefta.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * Erinnerungen von Hefta (Zeile 9): Zur geplanten Zeit weckt Android diesen Empfänger, er zeigt die
 * Mitteilung. Ein Tipp öffnet Hefta an der Stelle, um die es geht. Alles bleibt auf dem Gerät.
 */
public class ErinnerungEmpfaenger extends BroadcastReceiver {

    static final String KANAL = "erinnerungen";
    static final String ZIEL = "hefta_ziel";

    static void kanalAnlegen(Context kontext) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel kanal = new NotificationChannel(KANAL, "Erinnerungen", NotificationManager.IMPORTANCE_DEFAULT);
        kanal.setDescription("Besichtigungen, Nachfassen, neuer Gehaltsnachweis");
        NotificationManager verwalter = kontext.getSystemService(NotificationManager.class);
        if (verwalter != null) verwalter.createNotificationChannel(kanal);
    }

    @Override
    public void onReceive(Context kontext, Intent absicht) {
        kanalAnlegen(kontext);
        int nummer = absicht.getIntExtra("nummer", 0);
        Intent oeffnen = new Intent(kontext, MainActivity.class);
        oeffnen.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        oeffnen.putExtra(ZIEL, absicht.getStringExtra("ziel"));
        PendingIntent tippen = PendingIntent.getActivity(
            kontext, nummer, oeffnen, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        NotificationCompat.Builder mitteilung = new NotificationCompat.Builder(kontext, KANAL)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle(absicht.getStringExtra("titel"))
            .setContentText(absicht.getStringExtra("text"))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(absicht.getStringExtra("text")))
            .setContentIntent(tippen)
            .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(kontext).notify(nummer, mitteilung.build());
        } catch (SecurityException verboten) {
            // Mitteilungen sind nicht erlaubt: dann still nichts.
        }
    }
}
