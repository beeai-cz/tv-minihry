# Metody volané z JavaScriptu přes @JavascriptInterface nesmí R8 přejmenovat ani odstranit.
-keepclassmembers class cz.beeai.tvhry.GameActivity$Bridge {
    @android.webkit.JavascriptInterface <methods>;
}
