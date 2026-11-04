package app.shelly;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Intent;
import android.content.IntentSender;
import android.os.CancellationSignal;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;

import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialException;

import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.common.api.Scope;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Google sign-in for BingO for classes (window.AndroidAuth, see src/js/71-cloud.js).
 * Google does not allow its sign-in page inside a WebView, so the phone's own account picker is used
 * (Credential Manager, "Sign in with Google"). The Google ID token goes back to the page, which signs in to
 * Firebase with it. For Google Classroom, Forms, Drive and Calendar the page asks for an access token with
 * the needed scopes (Identity AuthorizationClient), which may show Google's consent screen.
 *   signIn(webClientId)   answers through window.__googleSignedIn(ok, idTokenOrError)
 *   authorize(scopesJson) answers through window.__googleAuthorized(ok, accessTokenOrError)
 *   signOut()
 */
public class GoogleAuthBridge {
    static final int REQ_AUTHZ = 31;
    private final Activity activity;
    private final WebView web;
    private final Executor pool = Executors.newSingleThreadExecutor();

    public GoogleAuthBridge(Activity activity, WebView web) { this.activity = activity; this.web = web; }

    private void js(final String code) { activity.runOnUiThread(() -> web.evaluateJavascript(code, null)); }
    private void reply(String fn, boolean ok, String value) { js("window." + fn + " && window." + fn + "(" + ok + "," + JSONObject.quote(value == null ? "" : value) + ")"); }

    @JavascriptInterface
    public void signIn(final String webClientId) {
        activity.runOnUiThread(() -> {
            try {
                GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(webClientId).build();
                GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
                CredentialManager.create(activity).getCredentialAsync(activity, request, new CancellationSignal(), pool,
                    new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                        @Override public void onResult(GetCredentialResponse result) {
                            Credential c = result.getCredential();
                            if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                                try { reply("__googleSignedIn", true, GoogleIdTokenCredential.createFrom(c.getData()).getIdToken()); }
                                catch (Exception e) { reply("__googleSignedIn", false, "Невалиден отговор от Google"); }
                            } else reply("__googleSignedIn", false, "Неочакван вид акаунт");
                        }
                        @Override public void onError(GetCredentialException e) { reply("__googleSignedIn", false, e.getMessage()); }
                    });
            } catch (Throwable t) { reply("__googleSignedIn", false, t.getMessage()); }
        });
    }

    @JavascriptInterface
    public void authorize(final String scopesJson) {
        activity.runOnUiThread(() -> {
            try {
                JSONArray arr = new JSONArray(scopesJson);
                List<Scope> scopes = new ArrayList<>();
                for (int i = 0; i < arr.length(); i++) scopes.add(new Scope(arr.getString(i)));
                AuthorizationRequest req = AuthorizationRequest.builder().setRequestedScopes(scopes).build();
                Identity.getAuthorizationClient(activity).authorize(req)
                    .addOnSuccessListener(this::handle)
                    .addOnFailureListener(e -> reply("__googleAuthorized", false, e.getMessage()));
            } catch (Throwable t) { reply("__googleAuthorized", false, t.getMessage()); }
        });
    }

    private void handle(AuthorizationResult r) {
        if (r.hasResolution()) {
            PendingIntent pi = r.getPendingIntent();
            try { activity.startIntentSenderForResult(pi.getIntentSender(), REQ_AUTHZ, null, 0, 0, 0); }
            catch (IntentSender.SendIntentException e) { reply("__googleAuthorized", false, e.getMessage()); }
            return;
        }
        reply("__googleAuthorized", r.getAccessToken() != null, r.getAccessToken() != null ? r.getAccessToken() : "Няма токен");
    }

    /** MainActivity passes the consent screen's answer here */
    public boolean onActivityResult(int req, int result, Intent data) {
        if (req != REQ_AUTHZ) return false;
        try {
            AuthorizationResult r = Identity.getAuthorizationClient(activity).getAuthorizationResultFromIntent(data);
            reply("__googleAuthorized", r.getAccessToken() != null, r.getAccessToken() != null ? r.getAccessToken() : "Достъпът беше отказан");
        } catch (Exception e) { reply("__googleAuthorized", false, "Достъпът беше отказан"); }
        return true;
    }

    @JavascriptInterface
    public void signOut() {
        try {
            CredentialManager.create(activity).clearCredentialStateAsync(new ClearCredentialStateRequest(), new CancellationSignal(), pool,
                new CredentialManagerCallback<Void, ClearCredentialException>() {
                    @Override public void onResult(Void v) { }
                    @Override public void onError(ClearCredentialException e) { }
                });
        } catch (Throwable ignored) { }
    }
}
