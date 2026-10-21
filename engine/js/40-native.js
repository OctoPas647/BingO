/* ================= Files in and out: Android bridge, or the browser when testing on a PC =================
   Android (platforms/android) exposes window.AndroidFiles:
     begin(name, mime) · chunk(base64) · finish(mode)  mode: 'save' (choose a place on the phone) | 'share' (send to an app)
   and answers through window.__fileDone(ok). Files are sent in pieces so a module with video does not need one huge string. */
const Native = {
  android: () => !!window.AndroidFiles,
  canSend: () => Native.android() || !!(navigator.canShare && navigator.share),
  async saveFile(blob, name, mode) {
    if (Native.android()) {
      const A = window.AndroidFiles, CH = 786432;
      A.begin(name, blob.type || 'application/zip');
      for (let o = 0; o < blob.size; o += CH) A.chunk(await b64(blob.slice(o, o + CH)));
      const done = new Promise(r => { window.__fileDone = ok => r(ok); });
      A.finish(mode);
      const ok = await done;
      if (ok === true && mode === 'save') toast(t('share.saved'), 'good');
      if (ok === false) toast(t('share.fail'));
      return;
    }
    const file = new File([blob], name, { type: blob.type || 'application/zip' });
    if (mode === 'share' && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    const a = h(`<a download="${esc(name)}"></a>`); a.href = URL.createObjectURL(file); document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    toast(t('share.downloaded'), 'good');
  },
  pickFile() {
    return new Promise(res => {
      const i = h('<input type="file" accept=".zip,application/zip,application/x-zip-compressed,application/octet-stream" hidden>');
      i.addEventListener('change', () => { res(i.files[0] || null); i.remove(); });
      document.body.appendChild(i); i.click();
    });
  }
};
const b64 = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] || ''); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
