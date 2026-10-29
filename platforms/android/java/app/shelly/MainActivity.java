package app.shelly;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.res.Configuration;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.util.Base64;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

/* Shelly: a WebView that serves the bundled app from assets/ and works fully offline.
   AndroidFiles (below) moves module files in and out: picking a file, saving or sending a shared module,
   and opening a module that another app ("Open with…" / "Share to…") hands over. */
public class MainActivity extends Activity {
    static final String HOST = "appassets.androidplatform.net";
    static final String START = "https://" + HOST + "/index.html";
    static final int REQ_PICK = 1, REQ_SAVE = 2;
    static final int CHUNK = 786432; // multiple of 3, so base64 pieces join cleanly

    WebView web;
    FrameLayout root;
    ValueCallback<Uri[]> pickCallback;
    File outFile;
    Uri pendingIncoming;
    volatile boolean pageReady = false;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        web = new WebView(this);
        if (Build.VERSION.SDK_INT >= 26) web.setDefaultFocusHighlightEnabled(false);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(Color.parseColor("#F6F3EC"));
        root.addView(web, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);
        hideNavigationBar();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(true);
        s.setTextZoom(100);
        s.setUserAgentString(s.getUserAgentString() + " ShellyApp/1.0");

        web.addJavascriptInterface(new UiBridge(), "AndroidUI");
        web.addJavascriptInterface(new FilesBridge(), "AndroidFiles");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (!HOST.equals(u.getHost())) return null;
                String path = u.getPath();
                if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                try {
                    InputStream in = getAssets().open(path.substring(1));
                    WebResourceResponse r = new WebResourceResponse(mime(path), "utf-8", in);
                    Map<String, String> h = new HashMap<>();
                    h.put("Cache-Control", "no-cache");
                    r.setResponseHeaders(h);
                    return r;
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest req) {
                Uri u = req.getUrl();
                if (HOST.equals(u.getHost())) return false;
                openOutside(u);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (pickCallback != null) pickCallback.onReceiveValue(null);
                pickCallback = callback;
                Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try { startActivityForResult(Intent.createChooser(i, null), REQ_PICK); }
                catch (ActivityNotFoundException e) { pickCallback = null; return false; }
                return true;
            }
        });

        pendingIncoming = incomingUri(getIntent());
        if (state != null) web.restoreState(state); else web.loadUrl(START);
    }

    /* Hide the system navigation bar while the app is open. Swiping from the bottom edge shows it for a moment, then it hides again.
       Android 11+ uses the insets controller (the old flags are unreliable there, and some phones bring the bar back on their own). */
    void hideNavigationBar() {
        if (Build.VERSION.SDK_INT >= 30) {
            WindowInsetsController c = getWindow().getInsetsController();
            if (c != null) {
                c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                c.hide(WindowInsets.Type.navigationBars());
            }
            return;
        }
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(d.getSystemUiVisibility() | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideNavigationBar();
    }

    void openOutside(Uri u) { try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (ActivityNotFoundException ignored) { } }

    static String mime(String p) {
        p = p.toLowerCase(Locale.ROOT);
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    /* ---------- a module file handed over by another app ---------- */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        Uri u = incomingUri(intent);
        if (u == null) return;
        if (pageReady) deliver(u); else pendingIncoming = u;
    }

    Uri incomingUri(Intent i) {
        if (i == null) return null;
        if (Intent.ACTION_VIEW.equals(i.getAction())) return i.getData();
        if (Intent.ACTION_SEND.equals(i.getAction())) {
            Object extra = i.getParcelableExtra(Intent.EXTRA_STREAM);
            if (extra instanceof Uri) return (Uri) extra;
            ClipData c = i.getClipData();
            if (c != null && c.getItemCount() > 0) return c.getItemAt(0).getUri();
        }
        return null;
    }

    void deliver(final Uri uri) {
        new Thread(new Runnable() { @Override public void run() {
            String name = "module.zip";
            try (Cursor c = getContentResolver().query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
                if (c != null && c.moveToFirst() && c.getString(0) != null) name = c.getString(0);
            } catch (Exception ignored) { }
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                js("__incoming.begin(" + quote(name) + ")");
                byte[] buf = new byte[CHUNK];
                while (true) {
                    int n = 0, r;
                    while (n < CHUNK && (r = in.read(buf, n, CHUNK - n)) > 0) n += r;
                    if (n == 0) break;
                    js("__incoming.chunk('" + Base64.encodeToString(buf, 0, n, Base64.NO_WRAP) + "')");
                    if (n < CHUNK) break;
                }
                js("__incoming.end()");
            } catch (Exception e) { js("toast(t('imp.notZip'))"); }
        }}).start();
    }

    void js(final String code) {
        runOnUiThread(new Runnable() { @Override public void run() { web.evaluateJavascript(code, null); } });
    }

    static String quote(String s) {
        StringBuilder b = new StringBuilder("'");
        for (char ch : s.toCharArray()) {
            if (ch == '\'' || ch == '\\') b.append('\\').append(ch);
            else if (ch < 32 || ch == '\u2028' || ch == '\u2029') b.append(' ');
            else b.append(ch);
        }
        return b.append('\'').toString();
    }

    /* ---------- results from the file picker and "save as" ---------- */
    @Override
    protected void onActivityResult(int req, int result, Intent data) {
        if (req == REQ_PICK) {
            if (pickCallback != null) {
                Uri u = result == RESULT_OK && data != null ? data.getData() : null;
                pickCallback.onReceiveValue(u != null ? new Uri[]{u} : null);
                pickCallback = null;
            }
            return;
        }
        if (req == REQ_SAVE) {
            boolean ok = false;
            if (result == RESULT_OK && data != null && data.getData() != null && outFile != null) {
                try (InputStream in = new FileInputStream(outFile); OutputStream out = getContentResolver().openOutputStream(data.getData())) {
                    byte[] buf = new byte[65536]; int n;
                    while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    ok = true;
                } catch (Exception ignored) { }
            }
            js("window.__fileDone && __fileDone(" + (result == RESULT_OK ? String.valueOf(ok) : "null") + ")");
            return;
        }
        super.onActivityResult(req, result, data);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) { super.onSaveInstanceState(out); web.saveState(out); }

    @Override
    public void onBackPressed() {
        try {
            web.evaluateJavascript("(window.__back ? window.__back() : '')", new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) { if (v == null || !v.contains("h")) finish(); }
            });
        } catch (Exception e) { finish(); }
    }

    @Override protected void onPause() { super.onPause(); web.onPause(); }
    @Override protected void onResume() { super.onResume(); web.onResume(); hideNavigationBar(); }
    @Override protected void onDestroy() { web.destroy(); super.onDestroy(); }

    /* System bars follow the app theme */
    /* the phone's light/dark setting, for the app's "System" theme */
    boolean systemNight() { return (getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES; }

    @Override
    public void onConfigurationChanged(Configuration c) {
        super.onConfigurationChanged(c);
        js("window.__systemTheme && __systemTheme()");
    }

    class UiBridge {
        @JavascriptInterface
        public boolean night() { return systemNight(); }

        @JavascriptInterface
        public void bars(final String hex, final boolean dark) {
            runOnUiThread(new Runnable() { @Override public void run() {
                try {
                    int c = Color.parseColor(hex);
                    Window w = getWindow();
                    w.setStatusBarColor(c);
                    w.setNavigationBarColor(c);
                    web.setBackgroundColor(c);
                    if (Build.VERSION.SDK_INT >= 30) {
                        WindowInsetsController ic = w.getInsetsController();
                        if (ic != null) {
                            int light = WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS | WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS;
                            ic.setSystemBarsAppearance(dark ? 0 : light, light);
                        }
                        hideNavigationBar();
                        return;
                    }
                    View d = w.getDecorView();
                    int f = d.getSystemUiVisibility();
                    if (dark) f &= ~View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; else f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
                    if (Build.VERSION.SDK_INT >= 26) {
                        if (dark) f &= ~View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR; else f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                    }
                    d.setSystemUiVisibility(f);
                    hideNavigationBar();
                } catch (Exception ignored) { }
            }});
        }
    }

    /* Files out of the app: the page sends the file in base64 pieces, then asks to save or send it */
    class FilesBridge {
        OutputStream out;
        String mimeType = "application/zip", fileName = "module.zip";

        @JavascriptInterface
        public void ready() {
            pageReady = true;
            if (pendingIncoming != null) { Uri u = pendingIncoming; pendingIncoming = null; deliver(u); }
        }

        @JavascriptInterface
        public void begin(String name, String mime) {
            try {
                if (out != null) out.close();
                File dir = new File(getCacheDir(), "out"); dir.mkdirs();
                File[] old = dir.listFiles(); if (old != null) for (File f : old) f.delete();
                fileName = FilesProvider.safeName(name); mimeType = mime == null || mime.isEmpty() ? "application/zip" : mime;
                outFile = new File(dir, fileName);
                out = new FileOutputStream(outFile);
            } catch (Exception e) { out = null; }
        }

        @JavascriptInterface
        public void chunk(String b64) {
            try { if (out != null) out.write(Base64.decode(b64, Base64.DEFAULT)); } catch (Exception e) { out = null; }
        }

        @JavascriptInterface
        public void finish(final String mode) {
            boolean ok = out != null;
            try { if (out != null) out.close(); } catch (Exception e) { ok = false; }
            out = null;
            if (!ok) { js("window.__fileDone && __fileDone(false)"); return; }
            runOnUiThread(new Runnable() { @Override public void run() {
                try {
                    if ("share".equals(mode)) {
                        Uri u = Uri.parse("content://" + getPackageName() + ".files/" + Uri.encode(fileName));
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType(mimeType);
                        send.putExtra(Intent.EXTRA_STREAM, u);
                        send.setClipData(ClipData.newRawUri(fileName, u));
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(send, null));
                        js("window.__fileDone && __fileDone(null)");
                    } else {
                        Intent save = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                        save.addCategory(Intent.CATEGORY_OPENABLE);
                        save.setType(mimeType);
                        save.putExtra(Intent.EXTRA_TITLE, fileName);
                        startActivityForResult(save, REQ_SAVE);
                    }
                } catch (Exception e) { js("window.__fileDone && __fileDone(false)"); }
            }});
        }
    }
}
