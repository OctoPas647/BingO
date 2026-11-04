/* Test security: the shared rules (src/js/70-edu-core.js via functions/shared/edu.js) and the server helpers
   (functions/proctor.js) without the emulators.   Run: node tests/proctor_rules.test.js */
const path = require('path');
const EDU = require(path.join(__dirname, '../functions/shared/edu.js'));
const P = require(path.join(__dirname, '../functions/proctor.js'));

let fails = 0, passes = 0;
const ok = (c, what) => { if (c) passes++; else { fails++; console.log('FAIL', what); } };

(async () => {
  /* defaults: a test is protected, homework only logs, the projector quiz is not protected */
  const t = EDU.eduAcDefaults('test');
  ok(t.onLeave === 'lock' && t.allowedLeaves === 1 && t.secure && t.lockApp && t.noOverlays && t.watermark && t.deviceCheck && t.blockA11y && !t.appOnly && !t.integrity, 'test defaults');
  const hw = EDU.eduAcDefaults('homework');
  ok(hw.onLeave === 'log' && hw.detectLeave && !hw.secure && !hw.lockApp, 'homework defaults');
  ok(EDU.eduAcDefaults('live', 'quiz').onLeave === 'log', 'quiz defaults');

  /* old tests: "lock after N alerts" becomes lock with N-1 warnings */
  const old = EDU.eduAcClean({ detectLeave: true, autoLockAfter: 3 }, 'test');
  ok(old.onLeave === 'lock' && old.allowedLeaves === 2, 'old autoLockAfter ' + JSON.stringify(old));
  ok(EDU.eduAcClean({ onLeave: 'submit', allowedLeaves: 99 }, 'test').allowedLeaves === 10, 'warnings capped at 10');
  ok(EDU.eduAcClean({ onLeave: 'lock', detectLeave: false }, 'test').onLeave === 'log', 'no detection, no locking');
  ok(EDU.eduAcClean({ onLeave: 'explode' }, 'test').onLeave === 'lock', 'unknown action falls back');
  ok(EDU.eduAcClean({ allowedLeaves: 0 }, 'test').allowedLeaves === 0, 'zero warnings kept');

  /* what counts as leaving */
  ok(EDU.eduAcStrike({ type: 'left' }) && EDU.eduAcStrike({ type: 'split' }) && EDU.eduAcStrike({ type: 'unpin' }) && EDU.eduAcStrike({ type: 'device' }), 'strikes');
  ok(!EDU.eduAcStrike({ type: 'blur', secs: 2 }) && EDU.eduAcStrike({ type: 'blur', secs: 3 }), 'blur threshold');
  ok(!EDU.eduAcStrike({ type: 'gap', secs: 40 }) && EDU.eduAcStrike({ type: 'gap', secs: 60 }), 'gap threshold');
  ok(!EDU.eduAcStrike({ type: 'screenshot', blocked: true }) && EDU.eduAcStrike({ type: 'screenshot', blocked: false }), 'screenshot blocked vs taken');
  ok(!EDU.eduAcStrike({ type: 'copy' }) && EDU.eduAcFlagged({ type: 'copy' }) && !EDU.eduAcFlagged({ type: 'back' }), 'flags vs strikes');

  /* warn, then act */
  const lock1 = EDU.eduAcClean({ onLeave: 'lock', allowedLeaves: 1 }, 'test');
  ok(EDU.eduAcVerdict(lock1, 1, 0) === 'warn' && EDU.eduAcVerdict(lock1, 2, 0) === 'lock', 'warn then lock');
  ok(EDU.eduAcVerdict(lock1, 3, 2) === 'warn', 'forgiven strikes start over');
  ok(EDU.eduAcVerdict(EDU.eduAcClean({ onLeave: 'submit', allowedLeaves: 0 }, 'test'), 1, 0) === 'submit', 'no warnings: hand in at once');
  ok(EDU.eduAcVerdict(EDU.eduAcDefaults('homework'), 5, 0) === null, 'homework never acts');

  /* events from the device are cleaned */
  const now = Date.now();
  ok(P.cleanEvent({ type: 'rm -rf' }, now) === null, 'unknown event dropped');
  const e = P.cleanEvent({ type: 'left', t: 1, q: 3, secs: 5, info: 'x'.repeat(500), id: 'abc', evil: 1 }, now);
  ok(e.t === now && e.q === 3 && e.secs === 5 && e.info.length === 120 && !('evil' in e), 'event fields ' + JSON.stringify(e).slice(0, 80));

  /* the device check (server side) */
  const strict = EDU.eduAcClean({ appOnly: true }, 'test');
  ok(P.deviceProblem(strict, P.cleanDevice({ platform: 'web' })) !== '', 'web refused when app-only');
  ok(P.deviceProblem(strict, P.cleanDevice({ platform: 'android', checks: { hook: true } })) !== '', 'hooking tools refused');
  ok(P.deviceProblem(strict, P.cleanDevice({ platform: 'android', checks: {} })) === '', 'clean phone allowed');
  ok(P.deviceProblem(EDU.eduAcDefaults('homework'), P.cleanDevice({ platform: 'android', checks: { root: true } })) === '', 'homework does not check the phone');

  /* Play Integrity verdicts (with a fake decoder) */
  process.env.PLAY_INTEGRITY_PACKAGE = 'app.bingo';
  const good = { requestDetails: { nonce: 'N', requestPackageName: 'app.bingo', timestampMillis: String(Date.now()) }, appIntegrity: { appRecognitionVerdict: 'PLAY_RECOGNIZED' }, deviceIntegrity: { deviceRecognitionVerdict: ['MEETS_DEVICE_INTEGRITY'] } };
  const dec = p => async () => p;
  ok((await P.checkIntegrity('tok', 'N', dec(good))).verdict === 'ok', 'integrity ok');
  ok((await P.checkIntegrity('tok', 'other', dec(good))).verdict === 'bad-nonce', 'integrity nonce');
  ok((await P.checkIntegrity('tok', 'N', dec({ ...good, appIntegrity: { appRecognitionVerdict: 'UNRECOGNIZED_VERSION' } }))).verdict === 'app-unrecognized_version', 'integrity sideloaded');
  ok((await P.checkIntegrity('tok', 'N', dec({ ...good, deviceIntegrity: { deviceRecognitionVerdict: [] } }))).verdict === 'device', 'integrity device');
  ok((await P.checkIntegrity('', 'N', dec(good))).verdict === 'no-token', 'integrity no token');
  delete process.env.PLAY_INTEGRITY_PACKAGE;
  ok((await P.checkIntegrity('', 'N', dec(good))).verdict === 'skipped', 'integrity not configured');

  console.log(`${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})();
