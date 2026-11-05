/* ================= BingO for classes: the connection to Firebase =================
   Everything the class features need from the cloud goes through this file:
   - Google sign-in: a pop-up on the web; on Android the phone's own Google account picker (AndroidAuth in
     MainActivity, because Google does not allow its sign-in page inside an app's WebView)
   - the profile and the role (custom claim "role", set by the registerProfile function)
   - Firestore reads with live updates, Cloud Functions calls, photo uploads to Storage
   - Google API access tokens for Classroom, Forms, Drive and Calendar (78-google.js)
   Firebase is loaded from Google's CDN only when the class features are used, so practice stays fully offline.
   The web config (not secret) comes from the build: tools/config.json "firebase" or the BINGO_FIREBASE variable. */

const FB_VERSION = '10.14.1';
const FB_CFG = (() => {
  const c = globalThis.BINGO_FIREBASE_OVERRIDE || globalThis.BINGO_FIREBASE || null;
  return c && c.projectId && c.apiKey ? c : null;
})();
const cloudConfigured = () => !!FB_CFG || (typeof demoCloudOn === 'function' && demoCloudOn());   /* the demo (80-demo-cloud.js) works without Firebase */

const CLOUD = { loading: null, ready: false, user: null, profile: null, role: '', claims: {}, app: null, auth: null, db: null, fn: null, storage: null, subs: new Set(), waiters: [] };

function loadScript(src) {
  return new Promise((res, rej) => {
    if ([...document.scripts].some(s => s.src === src)) return res();
    const s = document.createElement('script'); s.src = src; s.async = false;
    s.onload = res; s.onerror = () => rej(new Error(L('Няма връзка с интернет')));
    document.head.appendChild(s);
  });
}

/* Load Firebase and start listening to the sign-in state. Safe to call many times. */
function cloudLoad() {
  if (typeof demoCloudOn === 'function' && demoCloudOn()) return demoCloudLoad();
  if (!FB_CFG) return Promise.reject(new Error(L('Класната стая още не е настроена (Firebase)')));
  if (CLOUD.loading) return CLOUD.loading;
  CLOUD.loading = (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FB_VERSION}/`;
    for (const m of ['app', 'auth', 'firestore', 'functions', 'storage']) await loadScript(base + `firebase-${m}-compat.js`);
    const fb = window.firebase;
    CLOUD.app = fb.apps.length ? fb.app() : fb.initializeApp(FB_CFG);
    CLOUD.auth = fb.auth(); CLOUD.db = fb.firestore(); CLOUD.fn = CLOUD.app.functions(FB_CFG.region || 'europe-west1'); CLOUD.storage = fb.storage();
    if (FB_CFG.emulator) {
      const host = FB_CFG.emulatorHost || '127.0.0.1';
      CLOUD.auth.useEmulator(`http://${host}:9099`, { disableWarnings: true });
      CLOUD.db.useEmulator(host, 8085); CLOUD.fn.useEmulator(host, 5001); CLOUD.storage.useEmulator(host, 9199);
    } else {
      try { CLOUD.db.enablePersistence({ synchronizeTabs: true }).catch(() => { }); } catch (e) { }
    }
    await new Promise(resolve => {
      let first = true;
      CLOUD.auth.onAuthStateChanged(async u => {
        CLOUD.user = u;
        if (u) await cloudRefreshProfile(); else { CLOUD.profile = null; CLOUD.role = ''; CLOUD.claims = {}; cloudStopAll(); }
        if (first) { first = false; CLOUD.ready = true; resolve(); }
        else cloudChanged();
      });
    });
    return CLOUD;
  })();
  CLOUD.loading.catch(() => { CLOUD.loading = null; });
  return CLOUD.loading;
}

async function cloudRefreshProfile(force) {
  const u = CLOUD.user; if (!u) return null;
  try {
    const tok = await u.getIdTokenResult(!!force);
    CLOUD.claims = tok.claims || {}; CLOUD.role = CLOUD.claims.role || '';
    const d = await CLOUD.db.collection('users').doc(u.uid).get();
    CLOUD.profile = d.exists ? d.data() : null;
  } catch (e) { console.warn('profile', e); }
  return CLOUD.profile;
}

/* screens that show cloud data redraw when the sign-in or the role changes */
let _cloudChangeTimer = 0;
function cloudChanged() { clearTimeout(_cloudChangeTimer); _cloudChangeTimer = setTimeout(() => { if (typeof refresh === 'function' && NAV.length) refresh(); }, 50); }

const isTeacher = () => ['teacher', 'admin'].includes(CLOUD.role);
const isAdmin = () => CLOUD.role === 'admin';
const signedIn = () => !!CLOUD.user;
const myUid = () => (CLOUD.user ? CLOUD.user.uid : '');

/* ---------- Google sign-in ---------- */
const GOOGLE_BASE_SCOPES = ['email', 'profile'];
let _nativeAuth = null;
window.__googleSignedIn = (ok, tokenOrError) => { const w = _nativeAuth; _nativeAuth = null; if (w) ok ? w.resolve(tokenOrError) : w.reject(new Error(tokenOrError || L('Влизането беше отказано'))); };

async function signInGoogle() {
  await cloudLoad();
  if (typeof demoCloudOn === 'function' && demoCloudOn()) return CLOUD.user;
  const fb = window.firebase;
  if (window.AndroidAuth && FB_CFG.webClientId) {
    const idToken = await new Promise((resolve, reject) => { _nativeAuth = { resolve, reject }; window.AndroidAuth.signIn(FB_CFG.webClientId); });
    const cred = fb.auth.GoogleAuthProvider.credential(idToken);
    await CLOUD.auth.signInWithCredential(cred);
  } else {
    const p = new fb.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await CLOUD.auth.signInWithPopup(p); }
    catch (e) {
      if (/popup-blocked|operation-not-supported/.test(e.code || '')) return CLOUD.auth.signInWithRedirect(p);
      if (/popup-closed|cancelled-popup/.test(e.code || '')) throw new Error(L('Влизането беше отказано'));
      throw e;
    }
  }
  await cloudRefreshProfile(true);
  return CLOUD.user;
}

/* only with the emulator (tests and local development): sign in as anyone without Google */
async function cloudTestSignIn(email, name) {
  await cloudLoad();
  if (!FB_CFG.emulator) throw new Error('only in the emulator');
  const fb = window.firebase;
  await CLOUD.auth.signInWithCredential(fb.auth.GoogleAuthProvider.credential(JSON.stringify({ sub: 'g-' + email, email, email_verified: true, name })));
  await cloudRefreshProfile(true);
  return CLOUD.user;
}

async function signOutCloud() {
  if (typeof demoCloudOn === 'function' && demoCloudOn()) return demoExit();
  if (!CLOUD.auth) return;
  cloudStopAll(); GTOKENS.clear();
  if (window.AndroidAuth) try { window.AndroidAuth.signOut(); } catch (e) { }
  await CLOUD.auth.signOut();
}

/* Sign in if needed, then register the profile with the role the person picked */
async function cloudRegister(role, extra = {}) {
  if (!CLOUD.user) await signInGoogle();
  const r = await callFn('registerProfile', { role, name: extra.name || S.profile.name || (CLOUD.user && CLOUD.user.displayName) || '', school: extra.school || S.profile.school || '', schoolCode: extra.schoolCode || '', subjects: extra.subjects || [], lang: S.settings.lang });
  await cloudRefreshProfile(true);
  return r;
}

/* ---------- Cloud Functions ---------- */
const FN_ERR = {
  unavailable: 'Няма връзка със сървъра. Провери интернета.', unauthenticated: 'Влез с Google първо.', 'deadline-exceeded': 'Сървърът не отговори навреме.',
  internal: 'Грешка на сървъра. Опитай пак.', 'resource-exhausted': 'Твърде много заявки. Опитай след малко.'
};
async function callFn(name, data, opts = {}) {
  await cloudLoad();
  try {
    const r = await CLOUD.fn.httpsCallable(name, { timeout: opts.timeout || 120000 })(data || {});
    return r.data;
  } catch (e) {
    const code = String(e.code || '').replace('functions/', '');
    const msg = e.message && /[А-Яа-я]/.test(e.message) ? e.message : FN_ERR[code] ? L(FN_ERR[code]) : (e.message || String(e));
    const err = new Error(msg); err.code = code; throw err;
  }
}

/* ---------- Firestore with live updates that stop when the screen closes ---------- */
const col = path => CLOUD.db.collection(path);
const docRef = path => CLOUD.db.doc(path);
const FV = () => window.firebase.firestore.FieldValue;
const tsMs = v => (v == null ? null : typeof v === 'number' ? v : typeof v.toMillis === 'function' ? v.toMillis() : v.seconds != null ? v.seconds * 1000 : null);

/* watch(refOrQuery, onData, nav): onData(snapshot) on every change; stops when the screen `nav` is left */
function watch(ref, onData, nav, onErr) {
  const unsub = ref.onSnapshot(s => { try { onData(s); } catch (e) { console.error(e); } }, e => { console.warn('watch', e); onErr && onErr(e); });
  CLOUD.subs.add(unsub);
  const stop = () => { if (CLOUD.subs.delete(unsub)) unsub(); };
  if (nav) { const prev = nav.onLeave; nav.onLeave = () => { stop(); prev && prev(); }; }
  return stop;
}
function cloudStopAll() { for (const u of CLOUD.subs) try { u(); } catch (e) { } CLOUD.subs.clear(); }
const docs = snap => snap.docs.map(d => ({ id: d.id, ...d.data() }));

/* ---------- Storage: photos of handwritten work, pictures in questions ---------- */
async function shrinkImage(file, maxSide = 1800, quality = 0.82) {
  if (!/^image\//.test(file.type)) throw new Error(L('Избери снимка'));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise(res => c.toBlob(b => res(b || file), 'image/jpeg', quality));
  } catch (e) { return file; } finally { URL.revokeObjectURL(url); }
}
async function uploadImage(path, file) {
  await cloudLoad();
  const blob = await shrinkImage(file);
  const ref = CLOUD.storage.ref(path);
  await ref.put(blob, { contentType: 'image/jpeg' });
  return { path, url: await ref.getDownloadURL(), mime: 'image/jpeg' };
}
async function imageUrl(path) { await cloudLoad(); return CLOUD.storage.ref(path).getDownloadURL(); }

/* ---------- Google API tokens (Classroom, Forms, Drive, Calendar) ----------
   Web: Firebase's Google pop-up with the extra scopes gives an access token for about an hour.
   Android: the phone's Google authorization (AndroidAuth.authorize). */
const GTOKENS = new Map();
let _nativeAuthz = null;
window.__googleAuthorized = (ok, tokenOrError) => { const w = _nativeAuthz; _nativeAuthz = null; if (w) ok ? w.resolve(tokenOrError) : w.reject(new Error(tokenOrError || L('Достъпът беше отказан'))); };

async function googleToken(scopes, force) {
  if (typeof demoCloudOn === 'function' && demoCloudOn()) throw new Error(L('В демото няма връзка с Google акаунт. В истинското приложение тук се отваря Google.'));
  await cloudLoad();
  const full = scopes.map(s => (s.startsWith('http') ? s : 'https://www.googleapis.com/auth/' + s));
  const key = full.slice().sort().join(' '), have = GTOKENS.get(key);
  if (!force && have && have.exp > Date.now() + 60000) return have.token;
  let token;
  if (window.AndroidAuth && window.AndroidAuth.authorize) {
    token = await new Promise((resolve, reject) => { _nativeAuthz = { resolve, reject }; window.AndroidAuth.authorize(JSON.stringify(full)); });
  } else {
    const fb = window.firebase, p = new fb.auth.GoogleAuthProvider();
    full.forEach(s => p.addScope(s));
    if (CLOUD.user && CLOUD.user.email) p.setCustomParameters({ login_hint: CLOUD.user.email });
    const r = CLOUD.user ? await CLOUD.user.reauthenticateWithPopup(p) : await CLOUD.auth.signInWithPopup(p);
    token = r.credential && r.credential.accessToken;
  }
  if (!token) throw new Error(L('Google не даде достъп'));
  GTOKENS.set(key, { token, exp: Date.now() + 55 * 60000 });
  return token;
}

async function gapi(url, { method = 'GET', body, scopes, raw, headers = {} } = {}) {
  let token = await googleToken(scopes);
  for (let tryN = 0; tryN < 2; tryN++) {
    const res = await fetch(url, { method, headers: { Authorization: 'Bearer ' + token, ...(body && !(body instanceof Blob) && typeof body !== 'string' ? { 'Content-Type': 'application/json' } : {}), ...headers }, body: body && !(body instanceof Blob) && typeof body !== 'string' ? JSON.stringify(body) : body });
    if (res.status === 401 && tryN === 0) { token = await googleToken(scopes, true); continue; }
    if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error((j.error && j.error.message) || ('Google API ' + res.status)); }
    return raw ? res : res.status === 204 ? null : res.json();
  }
}

/* ---------- start: if someone signed in before, reconnect in the background ---------- */
function cloudBoot() {
  if (typeof demoCloudOn === 'function' && demoCloudOn()) { cloudLoad().then(cloudChanged); return; }
  if (!FB_CFG) return;
  const wants = S.cloud && S.cloud.signedIn;
  const join = (() => { try { return new URLSearchParams(location.search).get('join'); } catch (e) { return null; } })();
  if (wants || join || S.profile.role === 'teacher') cloudLoad().then(() => {
    if (CLOUD.user) cloudAfterSignIn();
    if (join) { try { history.replaceState(history.state, '', location.pathname); } catch (e) { } go('joinClass', { code: join }); }
    cloudChanged();
  }).catch(e => console.warn('cloud', e));
}
function cloudAfterSignIn() {
  S.cloud = { signedIn: true, uid: myUid() }; saveState(true);
  if (typeof cloudSyncProgress === 'function') cloudSyncProgress();
}
