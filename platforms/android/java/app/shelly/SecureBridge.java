package app.shelly;

import android.accessibilityservice.AccessibilityServiceInfo;
import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.hardware.display.DisplayManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import com.google.android.play.core.integrity.IntegrityManager;
import com.google.android.play.core.integrity.IntegrityManagerFactory;
import com.google.android.play.core.integrity.IntegrityTokenRequest;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.function.Consumer;

/**
 * Protection during a class test (window.AndroidSecure, see antiCheat() in src/js/73-class-student.js).
 * What a banking or streaming app does, switched on only while a teacher's test is open:
 *   - no screenshots, screen recording or casting (FLAG_SECURE), and no picture of the test in Recents
 *   - other apps cannot draw over BingO (chat heads, floating windows; Android 12+), and taps through an overlay are ignored
 *   - apps that read the screen through accessibility get nothing (Android 14+); others are reported before the test
 *   - the screen stays on and can be pinned to BingO (screen pinning)
 * and it tells the page (window.__acEvent(type, json)) when the student leaves: split screen or a floating window,
 * unpinning, the notification shade, a screenshot attempt (Android 14+), screen recording (Android 15+) or a second display.
 *   check()                 the device: root, emulator, USB debugging, apps reading the screen, model, Android version
 *   begin(json) / end()     start and stop the protection (json: secure, lockApp, noOverlays, blockA11y)
 *   pin()                   ask again to pin the screen
 *   state()                 {pinned, multiWindow, recording}
 *   deviceId()              a stable id for this phone and app (to notice a second device)
 *   integrity(nonce, proj)  Google Play Integrity token; the answer comes to window.__acIntegrity(ok, tokenOrError)
 */
public class SecureBridge {
    private final Activity act;
    private final WebView web;
    private final Handler ui = new Handler(Looper.getMainLooper());

    private volatile boolean active = false;
    private boolean wantPin, wantSecure, pinnedOnce, wasPinned, multiWindow, recording, paused;
    private long blurAt = 0, pinAskedAt = 0, begunAt = 0;
    private Set<String> a11yAtStart = new HashSet<>();
    private boolean adbAtStart;
    private Object captureCallback;                    /* Activity.ScreenCaptureCallback, Android 14+ */
    private Consumer<Integer> recordingCallback;       /* Android 15+ */
    private DisplayManager.DisplayListener displayListener;
    private final Runnable pinWatch = new Runnable() { @Override public void run() { watchPin(); if (active && wantPin) ui.postDelayed(this, 1200); } };

    /* screen readers that ship with phones but are sometimes updated from the Play Store */
    private static final Set<String> A11Y_ALLOWED = new HashSet<>(Arrays.asList(
        "com.google.android.marvin.talkback", "com.google.android.accessibility.switchaccess", "com.samsung.android.accessibility.talkback",
        "com.google.android.apps.accessibility.voiceaccess", "com.google.audio.hearing.visualization.accessibility.scribe"));
    private static final String[] SU_PATHS = { "/system/bin/su", "/system/xbin/su", "/sbin/su", "/system/su", "/su/bin/su", "/data/local/su",
        "/data/local/bin/su", "/data/local/xbin/su", "/system/sd/xbin/su", "/system/bin/failsafe/su", "/system/app/Superuser.apk",
        "/data/adb/magisk", "/data/adb/ksu", "/data/adb/ap", "/sbin/.magisk", "/cache/.disable_magisk", "/dev/.magisk.unblock" };
    private static final String[] ROOT_APPS = { "com.topjohnwu.magisk", "io.github.vvb2060.magisk", "io.github.huskydg.magisk", "eu.chainfire.supersu",
        "com.koushikdutta.superuser", "com.noshufou.android.su", "me.weishu.kernelsu", "me.bmax.apatch", "com.kingroot.kinguser" };
    private static final String[] HOOK_APPS = { "de.robv.android.xposed.installer", "org.lsposed.manager", "org.meowcat.edxposed.manager", "com.saurik.substrate" };

    public SecureBridge(Activity act, WebView web) { this.act = act; this.web = web; }

    private void emit(final String type, final JSONObject data) {
        final String code = "window.__acEvent && window.__acEvent(" + JSONObject.quote(type) + "," + (data == null ? "{}" : data.toString()) + ")";
        ui.post(new Runnable() { @Override public void run() { try { web.evaluateJavascript(code, null); } catch (Exception ignored) { } } });
    }
    private static JSONObject obj(Object... kv) {
        JSONObject o = new JSONObject();
        try { for (int i = 0; i + 1 < kv.length; i += 2) o.put(String.valueOf(kv[i]), kv[i + 1]); } catch (Exception ignored) { }
        return o;
    }

    /* ---------- the device ---------- */
    @JavascriptInterface
    public String check() {
        JSONObject o = new JSONObject();
        try {
            o.put("platform", "android");
            o.put("model", (Build.MANUFACTURER + " " + Build.MODEL).trim());
            o.put("os", "Android " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ")");
            try { o.put("app", act.getPackageManager().getPackageInfo(act.getPackageName(), 0).versionName); } catch (Exception e) { o.put("app", ""); }
            JSONObject c = new JSONObject();
            c.put("root", rooted());
            c.put("hook", hooked());
            c.put("emulator", emulator());
            c.put("adb", adb());
            c.put("overlaysBlocked", Build.VERSION.SDK_INT >= 31);
            c.put("a11y", new JSONArray(readers()));
            c.put("monitors", displays());
            o.put("checks", c);
        } catch (Exception ignored) { }
        return o.toString();
    }

    private boolean rooted() {
        for (String p : SU_PATHS) if (new File(p).exists()) return true;
        String tags = Build.TAGS;
        if (tags != null && tags.contains("test-keys")) return true;
        PackageManager pm = act.getPackageManager();
        for (String p : ROOT_APPS) if (installed(pm, p)) return true;
        return false;
    }
    private boolean hooked() {
        PackageManager pm = act.getPackageManager();
        for (String p : HOOK_APPS) if (installed(pm, p)) return true;
        if (new File("/data/local/tmp/frida-server").exists() || new File("/data/local/tmp/re.frida.server").exists()) return true;
        try (BufferedReader r = new BufferedReader(new FileReader("/proc/self/maps"))) {
            String line;
            while ((line = r.readLine()) != null) {
                String l = line.toLowerCase(Locale.ROOT);
                if (l.contains("frida") || l.contains("libxposed") || l.contains("lspd") || l.contains("edxp") || l.contains("substrate")) return true;
            }
        } catch (Exception ignored) { }
        return false;
    }
    private static boolean installed(PackageManager pm, String p) { try { pm.getPackageInfo(p, 0); return true; } catch (Exception e) { return false; } }
    private static boolean emulator() {
        String f = Build.FINGERPRINT == null ? "" : Build.FINGERPRINT, m = Build.MODEL == null ? "" : Build.MODEL, h = Build.HARDWARE == null ? "" : Build.HARDWARE;
        String pr = Build.PRODUCT == null ? "" : Build.PRODUCT, man = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        return f.startsWith("generic") || f.startsWith("unknown") || f.contains("emulator") || m.contains("google_sdk") || m.contains("Emulator")
            || m.contains("Android SDK built for") || h.equals("goldfish") || h.equals("ranchu") || h.contains("vbox86") || pr.contains("sdk_gphone")
            || pr.equals("sdk") || pr.contains("emulator") || pr.contains("simulator") || man.contains("Genymotion")
            || (Build.BRAND != null && Build.BRAND.startsWith("generic") && Build.DEVICE != null && Build.DEVICE.startsWith("generic"));
    }
    private boolean adb() {
        try {
            if (Settings.Global.getInt(act.getContentResolver(), Settings.Global.ADB_ENABLED, 0) == 1) return true;
            return Settings.Global.getInt(act.getContentResolver(), "adb_wifi_enabled", 0) == 1;
        } catch (Exception e) { return false; }
    }
    /* apps that can read what is on the screen (accessibility services that are not part of the phone's system) */
    private List<String> readers() {
        java.util.ArrayList<String> out = new java.util.ArrayList<>();
        try {
            AccessibilityManager am = (AccessibilityManager) act.getSystemService(Context.ACCESSIBILITY_SERVICE);
            if (am == null) return out;
            PackageManager pm = act.getPackageManager();
            for (AccessibilityServiceInfo info : am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_ALL_MASK)) {
                ResolveInfo ri = info.getResolveInfo();
                if (ri == null || ri.serviceInfo == null) continue;
                ApplicationInfo ai = ri.serviceInfo.applicationInfo;
                String pkg = ri.serviceInfo.packageName;
                boolean system = ai != null && (ai.flags & (ApplicationInfo.FLAG_SYSTEM | ApplicationInfo.FLAG_UPDATED_SYSTEM_APP)) != 0;
                boolean reads = (info.getCapabilities() & AccessibilityServiceInfo.CAPABILITY_CAN_RETRIEVE_WINDOW_CONTENT) != 0;
                if (system || !reads || A11Y_ALLOWED.contains(pkg) || act.getPackageName().equals(pkg)) continue;
                CharSequence label = ri.loadLabel(pm);
                out.add(label != null && label.length() > 0 ? label.toString() : pkg);
            }
        } catch (Exception ignored) { }
        return out;
    }
    private int displays() {
        try { DisplayManager dm = (DisplayManager) act.getSystemService(Context.DISPLAY_SERVICE); return dm == null ? 1 : dm.getDisplays().length; }
        catch (Exception e) { return 1; }
    }

    @JavascriptInterface
    public String deviceId() {
        try {
            String id = Settings.Secure.getString(act.getContentResolver(), Settings.Secure.ANDROID_ID);
            byte[] d = MessageDigest.getInstance("SHA-256").digest(("bingo:" + id).getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder("a-");
            for (int i = 0; i < 10; i++) sb.append(String.format(Locale.ROOT, "%02x", d[i]));
            return sb.toString();
        } catch (Exception e) { return ""; }
    }

    /* ---------- protection on / off ---------- */
    @JavascriptInterface
    public void begin(final String json) {
        ui.post(new Runnable() { @Override public void run() {
            JSONObject o; try { o = new JSONObject(json == null ? "{}" : json); } catch (Exception e) { o = new JSONObject(); }
            active = true; paused = false; blurAt = 0; begunAt = SystemClock.elapsedRealtime();
            wantSecure = o.optBoolean("secure", true);
            wantPin = o.optBoolean("lockApp", false);
            boolean noOverlays = o.optBoolean("noOverlays", true), sensitive = o.optBoolean("blockA11y", true) || wantSecure;
            a11yAtStart = new HashSet<>(readers());
            adbAtStart = adb();
            act.getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            if (wantSecure) {
                act.getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);
                if (Build.VERSION.SDK_INT >= 33) act.setRecentsScreenshotEnabled(false);
            }
            if (noOverlays) {
                if (Build.VERSION.SDK_INT >= 31) act.getWindow().setHideOverlayWindows(true);
                web.setFilterTouchesWhenObscured(true);
            }
            if (sensitive && Build.VERSION.SDK_INT >= 34) web.setAccessibilityDataSensitive(View.ACCESSIBILITY_DATA_SENSITIVE_YES);
            watchCapture(true);
            watchDisplays(true);
            multiWindow = act.isInMultiWindowMode();
            if (multiWindow) emit("split", obj("on", true));
            if (wantPin) { pinnedOnce = false; wasPinned = pinState(); askPin(); ui.removeCallbacks(pinWatch); ui.postDelayed(pinWatch, 800); }
        }});
    }

    @JavascriptInterface
    public void end() {
        ui.post(new Runnable() { @Override public void run() { stop(); } });
    }

    void stop() {
        if (!active) return;
        active = false;
        ui.removeCallbacks(pinWatch);
        act.getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SECURE | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        if (Build.VERSION.SDK_INT >= 33) act.setRecentsScreenshotEnabled(true);
        if (Build.VERSION.SDK_INT >= 31) act.getWindow().setHideOverlayWindows(false);
        web.setFilterTouchesWhenObscured(false);
        if (Build.VERSION.SDK_INT >= 34) web.setAccessibilityDataSensitive(View.ACCESSIBILITY_DATA_SENSITIVE_AUTO);
        watchCapture(false);
        watchDisplays(false);
        if (wantPin && pinState()) { try { act.stopLockTask(); } catch (Exception ignored) { } }
        wantPin = false;
    }

    @JavascriptInterface
    public void pin() { ui.post(new Runnable() { @Override public void run() { if (active && wantPin) askPin(); } }); }
    private void askPin() { pinAskedAt = SystemClock.elapsedRealtime(); try { act.startLockTask(); } catch (Exception ignored) { } }

    private boolean pinState() {
        try { ActivityManager am = (ActivityManager) act.getSystemService(Context.ACTIVITY_SERVICE); return am != null && am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE; }
        catch (Exception e) { return false; }
    }
    private void watchPin() {
        if (!active || !wantPin) return;
        boolean now = pinState();
        if (now && !wasPinned) { pinnedOnce = true; emit("pinned", null); }
        if (!now && wasPinned) emit("unpin", null);
        wasPinned = now;
    }

    @JavascriptInterface
    public String state() {
        return obj("pinned", pinState(), "pinnedOnce", pinnedOnce, "multiWindow", act.isInMultiWindowMode(), "recording", recording, "active", active).toString();
    }

    /* screenshots (Android 14+) and screen recording (Android 15+) */
    private void watchCapture(boolean on) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                if (on && captureCallback == null) {
                    Activity.ScreenCaptureCallback cb = new Activity.ScreenCaptureCallback() { @Override public void onScreenCaptured() { emit("screenshot", obj("blocked", wantSecure)); } };
                    act.registerScreenCaptureCallback(act.getMainExecutor(), cb);
                    captureCallback = cb;
                } else if (!on && captureCallback != null) {
                    act.unregisterScreenCaptureCallback((Activity.ScreenCaptureCallback) captureCallback);
                    captureCallback = null;
                }
            }
        } catch (Throwable ignored) { captureCallback = null; }
        try {
            if (Build.VERSION.SDK_INT >= 35) {
                WindowManager wm = act.getWindowManager();
                if (on && recordingCallback == null) {
                    recordingCallback = new Consumer<Integer>() { @Override public void accept(Integer st) {
                        boolean rec = st != null && st == WindowManager.SCREEN_RECORDING_STATE_VISIBLE;
                        if (rec != recording) { recording = rec; emit("recording", obj("on", rec)); }
                    } };
                    int st = wm.addScreenRecordingCallback(act.getMainExecutor(), recordingCallback);
                    recording = st == WindowManager.SCREEN_RECORDING_STATE_VISIBLE;
                    if (recording) emit("recording", obj("on", true));
                } else if (!on && recordingCallback != null) {
                    wm.removeScreenRecordingCallback(recordingCallback);
                    recordingCallback = null; recording = false;
                }
            }
        } catch (Throwable ignored) { recordingCallback = null; }
    }

    /* casting or a second screen */
    private void watchDisplays(boolean on) {
        try {
            DisplayManager dm = (DisplayManager) act.getSystemService(Context.DISPLAY_SERVICE);
            if (dm == null) return;
            if (on && displayListener == null) {
                displayListener = new DisplayManager.DisplayListener() {
                    @Override public void onDisplayAdded(int id) { Display d = dm.getDisplay(id); emit("cast", obj("on", true, "name", d != null ? d.getName() : "")); }
                    @Override public void onDisplayRemoved(int id) { }
                    @Override public void onDisplayChanged(int id) { }
                };
                dm.registerDisplayListener(displayListener, ui);
                if (dm.getDisplays().length > 1) emit("cast", obj("on", true, "name", dm.getDisplays()[1].getName()));
            } else if (!on && displayListener != null) {
                dm.unregisterDisplayListener(displayListener);
                displayListener = null;
            }
        } catch (Exception ignored) { }
    }

    /* ---------- from MainActivity ---------- */
    void onPause() { if (active) { paused = true; blurAt = 0; } }
    void onResume() {
        if (!active) return;
        paused = false;
        /* something new that reads the screen, or USB debugging switched on while the test was open */
        List<String> r = readers();
        JSONArray added = new JSONArray();
        for (String x : r) if (!a11yAtStart.contains(x)) added.put(x);
        if (added.length() > 0) { emit("a11y", obj("apps", added)); a11yAtStart.addAll(r); }
        boolean a = adb();
        if (a && !adbAtStart) emit("adb", null);
        adbAtStart = a;
        if (wantPin) ui.postDelayed(pinWatch, 300);
    }
    /* the notification shade, a system dialog or a chat bubble over the test (the window loses focus but the app keeps running) */
    void onFocus(boolean has) {
        if (!active) return;
        long now = SystemClock.elapsedRealtime();
        boolean pinDialog = wantPin && !pinnedOnce && now - pinAskedAt < 15000;
        if (!has) { if (!paused && !pinDialog && now - begunAt > 1500) blurAt = now; return; }
        if (blurAt > 0) { long secs = (now - blurAt) / 1000; blurAt = 0; emit("blur", obj("secs", secs)); }
        if (wantPin) ui.postDelayed(pinWatch, 300);
    }
    void onMultiWindow(boolean on) { if (active && on != multiWindow) { multiWindow = on; emit("split", obj("on", on)); } }

    /* ---------- Google Play Integrity ---------- */
    @JavascriptInterface
    public void integrity(final String nonce, final String project) {
        try {
            long pn = Long.parseLong(project == null ? "" : project.trim());
            IntegrityManager m = IntegrityManagerFactory.create(act.getApplicationContext());
            m.requestIntegrityToken(IntegrityTokenRequest.builder().setNonce(nonce).setCloudProjectNumber(pn).build())
                .addOnSuccessListener(r -> answer(true, r.token()))
                .addOnFailureListener(e -> answer(false, String.valueOf(e.getMessage())));
        } catch (Throwable t) { answer(false, t.toString()); }
    }
    private void answer(boolean ok, String v) {
        final String code = "window.__acIntegrity && window.__acIntegrity(" + ok + "," + JSONObject.quote(v == null ? "" : v) + ")";
        ui.post(new Runnable() { @Override public void run() { try { web.evaluateJavascript(code, null); } catch (Exception ignored) { } } });
    }
}
