package cz.beeai.tvhry;

import android.app.Activity;
import android.content.pm.ActivityInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Log;
import android.util.SparseArray;
import android.webkit.ConsoleMessage;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Jedna hra přes celou obrazovku. Která hra, říká meta-data "game" dlaždice (activity-alias),
 * hra samotná je HTML/JS v assets/&lt;game&gt;/index.html.
 *
 * Klávesy ovladače i gamepadů posíláme hře sami přes window.tvKey(type, name, deviceId, isPad),
 * aby WebView neposouval fokus ani stránku. Zpět se ptá hry (window.tvBack()); když ho hra
 * nezpracuje (je v menu), aplikace se zavře.
 */
public class GameActivity extends Activity {

    private WebView web;
    private TextToSpeech tts;
    private volatile boolean ttsReady;
    /** Hlas běží mimo vlákno hry: přepnutí jazyka načítá model a trvá i sekundy, hra by zamrzla. */
    private final ExecutorService voice = Executors.newSingleThreadExecutor();
    private String voiceLang = "";
    /** Hlas je úplně připravený (oba jazyky načtené a jednou vyslovené). Hra do té doby ukazuje načítání. */
    private volatile boolean voiceWarm;
    /** Jazyky, které už jednou promluvily (studený engine potřebuje na první větu i ~20 s). */
    private final java.util.Set<String> warmLangs = java.util.concurrent.ConcurrentHashMap.newKeySet();
    private volatile CountDownLatch warmLatch;
    /** Poslední směr analogové páčky pro každé zařízení, ať posíláme jen změny. */
    private final SparseArray<String> stickDir = new SparseArray<>();

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        tts = new TextToSpeech(this, status -> {
            ttsReady = status == TextToSpeech.SUCCESS;
            Log.d("TvHry", "tts init " + status);
            if (ttsReady) voice.execute(this::warmUp);
            // Jen pro vývoj: am start ... --ez export_voice true vyrobí nahrávky hlášek (viz tools/voice_phrases.py).
            if (ttsReady && getIntent().getBooleanExtra("export_voice", false)) voice.execute(this::exportVoice);
            else voiceWarm = true; // bez hlasu, ale hra nesmí viset na načítání
        });

        web = new WebView(this);
        web.setBackgroundColor(0xFF000000);
        web.setFocusable(false);
        web.setFocusableInTouchMode(false);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(false);
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient() {
            // Konzole her do logcatu (tag TvHry), ať jde ladit přes adb logcat.
            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                Log.d("TvHry", m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        hideSystemBars();

        web.loadUrl("file:///android_asset/" + gameName() + "/index.html");
    }

    private String gameName() {
        try {
            ActivityInfo info = getPackageManager().getActivityInfo(getComponentName(), PackageManager.GET_META_DATA);
            if (info.metaData != null) {
                String g = info.metaData.getString("game");
                if (g != null && g.matches("[a-z0-9-]+")) return g;
            }
        } catch (PackageManager.NameNotFoundException ignored) {
            // Spuštěno bez dlaždice: výchozí hra.
        }
        return "pexeso";
    }

    @SuppressWarnings("deprecation")
    private void hideSystemBars() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.hide(WindowInsets.Type.systemBars());
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            }
        } else {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        }
    }

    private static String keyName(int code) {
        switch (code) {
            case KeyEvent.KEYCODE_DPAD_UP: return "up";
            case KeyEvent.KEYCODE_DPAD_DOWN: return "down";
            case KeyEvent.KEYCODE_DPAD_LEFT: return "left";
            case KeyEvent.KEYCODE_DPAD_RIGHT: return "right";
            case KeyEvent.KEYCODE_DPAD_CENTER:
            case KeyEvent.KEYCODE_ENTER:
            case KeyEvent.KEYCODE_NUMPAD_ENTER:
            case KeyEvent.KEYCODE_BUTTON_A:
            case KeyEvent.KEYCODE_BUTTON_START:
            case KeyEvent.KEYCODE_SPACE:
                return "ok";
            // B na gamepadu je herní tlačítko, ne Zpět: děti mačkají všechno a hru by nechtěně zavřely.
            // Hru opouští Zpět na ovladači od TV nebo Select na gamepadu.
            case KeyEvent.KEYCODE_BUTTON_B:
            case KeyEvent.KEYCODE_BUTTON_X:
            case KeyEvent.KEYCODE_BUTTON_Y:
            case KeyEvent.KEYCODE_BUTTON_R1:
            case KeyEvent.KEYCODE_BUTTON_L1:
                return "action";
            // Select na gamepadu (8BitDo Zero 2) = Zpět: ze hry do menu, z menu zavřít.
            case KeyEvent.KEYCODE_BACK:
            case KeyEvent.KEYCODE_BUTTON_SELECT:
            case KeyEvent.KEYCODE_ESCAPE:
                return "back";
            default: return null;
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        String name = keyName(e.getKeyCode());
        if (name == null) return super.dispatchKeyEvent(e); // hlasitost, Home a ostatní nechá systému
        boolean pad = (e.getSource() & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
                || (e.getSource() & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
        if (name.equals("back")) {
            if (e.getAction() == KeyEvent.ACTION_UP) {
                web.evaluateJavascript("(window.tvBack ? window.tvBack() : false)", r -> {
                    if (!"true".equals(r)) finish();
                });
            }
            return true;
        }
        if (e.getAction() == KeyEvent.ACTION_DOWN) {
            send(e.getRepeatCount() == 0 ? "down" : "repeat", name, e.getDeviceId(), pad);
        } else if (e.getAction() == KeyEvent.ACTION_UP) {
            send("up", name, e.getDeviceId(), pad);
        }
        return true;
    }

    /** Analogová páčka a křížový ovladač gamepadu hlášený jako osy (HAT). */
    @Override
    public boolean onGenericMotionEvent(MotionEvent e) {
        if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) != InputDevice.SOURCE_JOYSTICK
                || e.getAction() != MotionEvent.ACTION_MOVE) {
            return super.onGenericMotionEvent(e);
        }
        float x = e.getAxisValue(MotionEvent.AXIS_HAT_X);
        float y = e.getAxisValue(MotionEvent.AXIS_HAT_Y);
        if (Math.abs(x) < 0.5f && Math.abs(y) < 0.5f) {
            x = e.getAxisValue(MotionEvent.AXIS_X);
            y = e.getAxisValue(MotionEvent.AXIS_Y);
        }
        String dir = null;
        if (Math.abs(x) > 0.5f || Math.abs(y) > 0.5f) {
            dir = Math.abs(x) > Math.abs(y) ? (x > 0 ? "right" : "left") : (y > 0 ? "down" : "up");
        }
        int dev = e.getDeviceId();
        String prev = stickDir.get(dev);
        if (prev != null && !prev.equals(dir)) send("up", prev, dev, true);
        if (dir != null && !dir.equals(prev)) send("down", dir, dev, true);
        stickDir.put(dev, dir);
        return true;
    }

    private void send(String type, String name, int deviceId, boolean pad) {
        web.evaluateJavascript("window.tvKey && window.tvKey('" + type + "','" + name + "'," + deviceId + "," + pad + ")", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.tvPause && window.tvPause()", null);
        web.onPause();
        if (tts != null) tts.stop();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        voice.shutdownNow();
        if (tts != null) tts.shutdown();
        web.destroy();
        super.onDestroy();
    }

    /**
     * Načte angličtinu i češtinu a každou jednou potichu vysloví: první skutečné vyslovení jinak trvá
     * sekundy a zatíží procesor, takže by hra trhala a hlášky by přišly pozdě.
     */
    private void warmUp() {
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            @Override public void onStart(String id) { Log.d("TvHry", "utt start " + id); }
            @Override public void onDone(String id) { Log.d("TvHry", "utt done " + id); release(id); }
            @Override public void onError(String id) { Log.d("TvHry", "utt error " + id); release(id); }
            private void release(String id) {
                CountDownLatch l = warmLatch;
                if (id != null && (id.startsWith("warm") || id.startsWith("exp")) && l != null) l.countDown();
            }
        });
        long t0 = System.currentTimeMillis();
        for (String lang : new String[] {"cs-CZ"}) { // jen záloha pro nenahrané věty; angličtina je celá nahraná
            boolean ok = setLang(lang);
            Log.d("TvHry", "warm " + lang + " setLang=" + ok + " t=" + (System.currentTimeMillis() - t0));
            if (!ok) continue;
            // Syntéza do souboru: načte celý model a spolehlivě ohlásí onDone (tichý speak ho nehlásí).
            warmLatch = new CountDownLatch(1);
            java.io.File f = new java.io.File(getCacheDir(), "warm.wav");
            tts.synthesizeToFile(lang.startsWith("cs") ? "Ahoj" : "Hello", new Bundle(), f, "warm-" + lang);
            try {
                boolean done = warmLatch.await(20, TimeUnit.SECONDS);
                Log.d("TvHry", "warm " + lang + " spoken=" + done + " t=" + (System.currentTimeMillis() - t0));
                warmLangs.add(lang);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                break;
            }
        }
        voiceWarm = true;
    }

    /** Vyslovení všech hlášek z assets/common/voice/phrases.txt do WAV v Android/data/.../files/voice. */
    private void exportVoice() {
        java.io.File dir = getExternalFilesDir("voice");
        int ok = 0, total = 0;
        try (java.io.BufferedReader in = new java.io.BufferedReader(new java.io.InputStreamReader(
                getAssets().open("common/voice/phrases.txt"), java.nio.charset.StandardCharsets.UTF_8))) {
            String line;
            while ((line = in.readLine()) != null) {
                String[] p = line.split("[|]", 3);
                if (p.length < 3) continue;
                total++;
                if (!setLang(p[1])) continue;
                warmLatch = new CountDownLatch(1);
                tts.synthesizeToFile(p[2], new Bundle(), new java.io.File(dir, p[0] + ".wav"), "exp-" + p[0]);
                if (warmLatch.await(40, TimeUnit.SECONDS)) ok++;
                if (total % 10 == 0) Log.d("TvHry", "export " + total);
            }
        } catch (Exception e) {
            Log.d("TvHry", "export chyba " + e);
        }
        Log.d("TvHry", "EXPORT DONE " + ok + "/" + total + " -> " + dir);
    }

    /** Přepne jazyk hlasu jen při změně (běží ve vlákně voice). */
    private boolean setLang(String lang) {
        if (lang.equals(voiceLang)) return true;
        Locale loc = Locale.forLanguageTag(lang);
        int r = tts.setLanguage(loc);
        if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) return false;
        tts.setSpeechRate(loc.getLanguage().equals("en") ? 0.85f : 1.0f);
        voiceLang = lang;
        return true;
    }

    /** Volá se z JavaScriptu jako Android.speak("dog", "en-US"). */
    class Bridge {
        /** Vrací hned; mluví se na pozadí. false jen když TTS ještě není připravené. */
        @JavascriptInterface
        public boolean speak(String text, String lang) {
            if (!ttsReady || text == null) return false;
            final String l = lang == null ? "en-US" : lang;
            voice.execute(() -> {
                if (!setLang(l)) return;
                tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "say");
            });
            return true;
        }

        /** langs = "cs-CZ,en-US": true, až všechny promluvily (nebo hlas není vůbec k dispozici). */
        @JavascriptInterface
        public boolean isReady(String langs) {
            if (voiceWarm) return true;
            if (langs == null) return false;
            for (String l : langs.split(",")) if (!warmLangs.contains(l.trim())) return false;
            return true;
        }

        @JavascriptInterface
        public boolean hasVoice(String lang) {
            if (!ttsReady) return false;
            int r = tts.isLanguageAvailable(Locale.forLanguageTag(lang));
            return r >= TextToSpeech.LANG_AVAILABLE;
        }
    }
}
