/* A small in-page stand-in for the Firebase "compat" SDK, enough for BingO's Messages and class screens.
   tests/ui_messages.py serves it in place of Google's firebase-*-compat.js, so the UI can be clicked through
   without the Firebase emulators (which need a download from Google). It keeps everything in memory,
   applies FieldValue transforms, runs live queries (where / orderBy / limit), and "uploads" files with
   PUT to the test server. It does NOT check security rules: tests/emulator/chat.test.mjs does that. */
(function () {
  if (window.firebase) return;
  const STORE = new Map();          /* path -> data */
  const LISTENERS = new Set();
  const now = () => Date.now() + (window.__fakeClockSkew || 0);
  class Timestamp { constructor(ms) { this.ms = ms; this.seconds = Math.floor(ms / 1000); } toMillis() { return this.ms; } toDate() { return new Date(this.ms); } }
  const SENT = { serverTimestamp: { __fv: 'ts' }, delete: { __fv: 'del' } };
  const FieldValue = {
    serverTimestamp: () => SENT.serverTimestamp, delete: () => SENT.delete,
    arrayUnion: (...v) => ({ __fv: 'union', v }), arrayRemove: (...v) => ({ __fv: 'remove', v }), increment: n => ({ __fv: 'inc', n })
  };
  const clone = v => (v instanceof Timestamp ? v : Array.isArray(v) ? v.map(clone) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v);
  function apply(cur, v) {
    if (v && v.__fv === 'ts') return new Timestamp(now());
    if (v && v.__fv === 'union') return [...new Set([...(Array.isArray(cur) ? cur : []), ...v.v])];
    if (v && v.__fv === 'remove') return (Array.isArray(cur) ? cur : []).filter(x => !v.v.includes(x));
    if (v && v.__fv === 'inc') return (cur || 0) + v.n;
    if (v instanceof Date) return new Timestamp(v.getTime());
    if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Timestamp)) { const o = {}; for (const [k, x] of Object.entries(v)) { const r = apply(undefined, x); if (!(x && x.__fv === 'del')) o[k] = r; } return o; }
    return clone(v);
  }
  function setPath(obj, path, v) {
    const ks = path.split('.'); let o = obj;
    for (let i = 0; i < ks.length - 1; i++) { if (!o[ks[i]] || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    const k = ks[ks.length - 1];
    if (v && v.__fv === 'del') delete o[k]; else o[k] = apply(o[k], v);
  }
  const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
  const valOf = v => (v instanceof Timestamp ? v.ms : v);
  let notifyQueued = false;
  function changed() { if (notifyQueued) return; notifyQueued = true; setTimeout(() => { notifyQueued = false; LISTENERS.forEach(l => l()); }, 0); }
  const rid = () => Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 10);

  function docSnap(path) {
    const d = STORE.get(path), id = path.split('/').pop();
    return { id, ref: new DocRef(path), exists: !!d, metadata: { hasPendingWrites: false, fromCache: false }, data: () => (d ? clone(d) : undefined), get: f => d && getPath(d, f) };
  }
  class DocRef {
    constructor(path) { this.path = path; this.id = path.split('/').pop(); }
    collection(c) { return new Query(this.path + '/' + c); }
    async get() { return docSnap(this.path); }
    async set(data, opt) {
      const base = opt && opt.merge ? clone(STORE.get(this.path) || {}) : {};
      for (const [k, v] of Object.entries(data)) { if (v && v.__fv === 'del') delete base[k]; else base[k] = apply(base[k], v); }
      STORE.set(this.path, base); changed();
    }
    async update(data) { if (!STORE.has(this.path)) { const e = new Error('No document to update: ' + this.path); e.code = 'not-found'; throw e; } const base = STORE.get(this.path); for (const [k, v] of Object.entries(data)) setPath(base, k, v); changed(); }
    async delete() { STORE.delete(this.path); changed(); }
    onSnapshot(next, err) { const l = () => next(docSnap(this.path)); LISTENERS.add(l); setTimeout(l, 0); return () => LISTENERS.delete(l); }
  }
  class Query {
    constructor(path, f = [], o = [], n = 0) { this.path = path; this.f = f; this.o = o; this.n = n; }
    doc(id) { return new DocRef(this.path + '/' + (id || rid())); }
    where(field, op, v) { return new Query(this.path, [...this.f, [field, op, v]], this.o, this.n); }
    orderBy(field, dir = 'asc') { return new Query(this.path, this.f, [...this.o, [field, dir]], this.n); }
    limit(n) { return new Query(this.path, this.f, this.o, n); }
    async add(data) { const r = this.doc(); await r.set(data); return r; }
    run() {
      const depth = this.path.split('/').length + 1;
      let rows = [...STORE.keys()].filter(p => p.startsWith(this.path + '/') && p.split('/').length === depth).map(p => [p, STORE.get(p)]);
      for (const [field, op, v] of this.f) rows = rows.filter(([, d]) => { const x = valOf(getPath(d, field)); return op === '==' ? x === v : op === 'array-contains' ? Array.isArray(x) && x.includes(v) : op === 'in' ? v.includes(x) : op === '>' ? x > valOf(v) : op === '<' ? x < valOf(v) : true; });
      for (const [field, dir] of [...this.o].reverse()) rows.sort((a, b) => { const x = valOf(getPath(a[1], field)), y = valOf(getPath(b[1], field)); return (x > y ? 1 : x < y ? -1 : 0) * (dir === 'desc' ? -1 : 1); });
      if (this.n) rows = rows.slice(0, this.n);
      const docs = rows.map(([p]) => docSnap(p));
      return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, forEach: f => docs.forEach(f) };
    }
    async get() { return this.run(); }
    onSnapshot(next) { const l = () => next(this.run()); LISTENERS.add(l); setTimeout(l, 0); return () => LISTENERS.delete(l); }
  }
  const db = {
    collection: p => new Query(p), doc: p => new DocRef(p), enablePersistence: async () => { }, useEmulator() { },
    batch() { const ops = []; return { set: (r, d, o) => ops.push(() => r.set(d, o)), update: (r, d) => ops.push(() => r.update(d)), delete: r => ops.push(() => r.delete()), commit: async () => { await new Promise(r => setTimeout(r, window.__fakeLatency || 60)); for (const op of ops) await op(); } }; },
    runTransaction: async fn => fn({ get: r => r.get(), set: (r, d, o) => r.set(d, o), update: (r, d) => r.update(d), delete: r => r.delete() })
  };

  /* ---------- auth ---------- */
  const AUTH_CBS = new Set();
  let current = null;
  const mkUser = (uid, email, name) => ({ uid, email, displayName: name, photoURL: '', async getIdTokenResult() { const u = STORE.get('users/' + uid); return { claims: { role: (u && u.role) || '' } }; }, async getIdToken() { return 'fake'; },
    async reauthenticateWithPopup() { return { credential: { accessToken: 'fake-google-token' } }; } });
  const auth = {
    get currentUser() { return current; }, useEmulator() { },
    onAuthStateChanged(cb) { AUTH_CBS.add(cb); setTimeout(() => cb(current), 0); return () => AUTH_CBS.delete(cb); },
    async signInWithCredential(cred) { const j = JSON.parse(cred.token); current = mkUser('u-' + j.sub.replace(/[^\w]/g, ''), j.email, j.name); AUTH_CBS.forEach(cb => cb(current)); return { user: current }; },
    async signInWithPopup() { if (!current) throw Object.assign(new Error('no user'), { code: 'auth/popup-closed-by-user' }); return { user: current, credential: { accessToken: 'fake-google-token' } }; },
    async signOut() { current = null; AUTH_CBS.forEach(cb => cb(null)); }
  };
  class GoogleAuthProvider { static credential(token) { return { token }; } setCustomParameters() { } addScope() { } }

  /* ---------- functions: the handful BingO calls in these screens ---------- */
  const FNS = {
    async registerProfile(d) { const u = current; const ref = 'users/' + u.uid; const prev = STORE.get(ref) || {}; STORE.set(ref, { ...prev, uid: u.uid, email: u.email, name: d.name || u.displayName, role: prev.role || (d.role === 'teacher' ? 'teacher' : 'student'), photo: '' }); changed(); return { uid: u.uid, role: STORE.get(ref).role, joined: [] }; },
    async chatEnsure() { return { chats: [] }; },
    async chatOpenDm(d) {
      const me = current.uid, id = 'dm_' + [me, d.uid].sort().join('_'), cls = STORE.get('chats/class_' + d.classId);
      const p = (cls && cls.people) || {};
      if (!STORE.has('chats/' + id)) await new DocRef('chats/' + id).set({ type: 'dm', members: [me, d.uid].sort(), teacherIds: Object.keys(p).filter(k => p[k].teacher && [me, d.uid].includes(k)), classIds: [d.classId], people: { [me]: p[me] || { name: current.displayName }, [d.uid]: p[d.uid] || {} }, createdAt: SENT.serverTimestamp, updatedAt: SENT.serverTimestamp, reads: {}, typing: {} });
      return { chatId: id };
    },
    async chatEmails() { return { emails: ['teacher@school.bg'] }; }
  };
  const functions = { useEmulator() { }, httpsCallable: name => async data => { if (!FNS[name]) { const e = new Error('fake: no function ' + name); e.code = 'functions/unimplemented'; throw e; } window.__fakeCalls = (window.__fakeCalls || []).concat([[name, data]]); return { data: await FNS[name](data || {}) }; } };

  /* ---------- storage: PUT to the test server ---------- */
  const storage = {
    useEmulator() { },
    ref(path) {
      const url = location.origin + '/fakestore/' + path.split('/').map(encodeURIComponent).join('/');
      return {
        fullPath: path,
        put(file, meta) {
          const handlers = [];
          const task = { on(ev, next, err, done) { handlers.push({ next, err, done }); } };
          (async () => {
            const total = file.size || 1;
            for (let i = 1; i <= 4; i++) { await new Promise(r => setTimeout(r, window.__fakeUploadMs || 120)); handlers.forEach(h => h.next && h.next({ bytesTransferred: total * i / 4, totalBytes: total })); }
            try { const r = await fetch(url, { method: 'PUT', body: file, headers: { 'Content-Type': (meta && meta.contentType) || file.type || 'application/octet-stream' } }); if (!r.ok) throw new Error('upload ' + r.status); handlers.forEach(h => h.done && h.done()); }
            catch (e) { handlers.forEach(h => h.err && h.err(e)); }
          })();
          return task;
        },
        async getDownloadURL() { return url + '?alt=media&token=fake'; },
        async delete() { await fetch(url, { method: 'DELETE' }).catch(() => { }); }
      };
    }
  };

  /* ---------- Cloud Messaging: a fixed token, so the test can check it is saved ---------- */
  const messaging = { async getToken(o) { window.__fakePushOpts = o; return 'fake-push-token-123'; }, async deleteToken() { return true; } };

  const app = { functions: () => functions, name: '[DEFAULT]' };
  const firebase = {
    apps: [], initializeApp() { firebase.apps.push(app); return app; }, app: () => app,
    auth: Object.assign(() => auth, { GoogleAuthProvider }),
    firestore: Object.assign(() => db, { FieldValue, Timestamp }),
    storage: () => storage, functions: () => functions, messaging: () => messaging
  };
  window.firebase = firebase;
  /* for the test: put documents in, read them, write as someone else */
  window.__fake = {
    STORE, Timestamp,
    seed(docs) { for (const [p, d] of Object.entries(docs)) STORE.set(p, apply(undefined, d)); changed(); },
    set: (p, d) => new DocRef(p).set(d), update: (p, d) => new DocRef(p).update(d), get: p => clone(STORE.get(p)),
    list: prefix => [...STORE.keys()].filter(k => k.startsWith(prefix)),
    ts: ms => new Timestamp(ms), FV: FieldValue
  };
})();
