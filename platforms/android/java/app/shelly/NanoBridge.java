package app.shelly;

import android.app.Activity;
import android.os.Build;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.common.util.concurrent.ListenableFuture;
import com.google.mlkit.genai.common.DownloadCallback;
import com.google.mlkit.genai.common.FeatureStatus;
import com.google.mlkit.genai.common.GenAiException;
import com.google.mlkit.genai.prompt.Candidate;
import com.google.mlkit.genai.prompt.GenerateContentResponse;
import com.google.mlkit.genai.prompt.Generation;
import com.google.mlkit.genai.prompt.java.GenerativeModelFutures;

import org.json.JSONObject;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Gemini Nano on the phone, for the page (window.AndroidNano, see src/js/54c-nano.js).
 * It uses Google's ML Kit GenAI Prompt API, which runs Gemini Nano through Android AICore. Only phones
 * that ship Gemini Nano have it (for example Xiaomi 17 Ultra, Pixel 9/10, Galaxy S25); everywhere else
 * status() says "unavailable" and the app uses Gemini in the cloud only. Nothing leaves the phone.
 *   status()                          "available" | "downloadable" | "downloading" | "unavailable"
 *   download()                        fetches the model; progress goes to window.__nanoStatus(status, 0..1)
 *   prompt(id, system, text, temp)    answers later through window.__nanoDone(id, ok, text)
 */
public class NanoBridge {
    private final Activity activity;
    private final WebView web;
    private final ExecutorService pool = Executors.newSingleThreadExecutor();
    private GenerativeModelFutures model;
    private volatile String status = "unknown";

    public NanoBridge(Activity activity, WebView web) {
        this.activity = activity;
        this.web = web;
        try {
            if (Build.VERSION.SDK_INT >= 26) model = GenerativeModelFutures.from(Generation.INSTANCE.getClient());
        } catch (Throwable t) { model = null; }
        refresh();
    }

    private void refresh() {
        if (model == null) { status = "unavailable"; return; }
        pool.execute(() -> {
            try {
                int s = model.checkStatus().get();
                status = s == FeatureStatus.AVAILABLE ? "available" : s == FeatureStatus.DOWNLOADABLE ? "downloadable" : s == FeatureStatus.DOWNLOADING ? "downloading" : "unavailable";
            } catch (Throwable t) { status = "unavailable"; }
            js("window.__nanoStatus && window.__nanoStatus(" + JSONObject.quote(status) + ", 0)");
        });
    }

    @JavascriptInterface
    public String status() { return status; }

    @JavascriptInterface
    public void download() {
        if (model == null) return;
        status = "downloading";
        final long[] total = { 1 };
        model.download(new DownloadCallback() {
            @Override public void onDownloadStarted(long bytes) { total[0] = Math.max(1, bytes); report(0); }
            @Override public void onDownloadProgress(long done) { report((double) done / total[0]); }
            @Override public void onDownloadCompleted() { status = "available"; report(1); }
            @Override public void onDownloadFailed(GenAiException e) { status = "unavailable"; report(0); }
        });
    }

    private void report(double p) {
        js("window.__nanoStatus && window.__nanoStatus(" + JSONObject.quote(status) + ", " + Math.max(0, Math.min(1, p)) + ")");
    }

    @JavascriptInterface
    public void prompt(final String id, final String system, final String text, final double temperature) {
        if (model == null || !"available".equals(status)) { done(id, false, "Gemini Nano is not available"); return; }
        pool.execute(() -> {
            try {
                /* the Prompt API takes one text; the system instruction goes first */
                String full = (system == null || system.isEmpty() ? "" : system + "\n\n") + text;
                ListenableFuture<GenerateContentResponse> f = model.generateContent(full);
                GenerateContentResponse r = f.get();
                List<Candidate> c = r.getCandidates();
                String out = c == null || c.isEmpty() || c.get(0).getText() == null ? "" : c.get(0).getText();
                done(id, true, out);
            } catch (Throwable t) {
                done(id, false, String.valueOf(t.getMessage()));
            }
        });
    }

    private void done(String id, boolean ok, String text) {
        js("window.__nanoDone && window.__nanoDone(" + JSONObject.quote(id) + ", " + ok + ", " + JSONObject.quote(text == null ? "" : text) + ")");
    }

    private void js(final String code) {
        activity.runOnUiThread(() -> web.evaluateJavascript(code, null));
    }
}
