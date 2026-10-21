/* ================= Lessons: text, pictures, audio and video, then the lesson's own test ================= */
function blockHTML(b) {
  switch (b.type) {
    case 'text': return `<div class="rt">${rich(b.text)}</div>`;
    case 'note': return `<aside class="note ${esc(b.style || 'tip')}"><span class="note-ic">${icon(b.style === 'warn' ? 'info' : b.style === 'key' ? 'target' : 'bulb')}</span><div class="rt">${rich(b.text)}</div></aside>`;
    case 'image': return `<figure class="media-img"><img data-media="${esc(b.src)}" alt="${esc(b.alt || '')}" data-zoom>${b.caption ? `<figcaption>${richInline(b.caption)}</figcaption>` : ''}</figure>`;
    case 'audio': return `<figure class="media-audio"><div class="player" data-player><audio preload="metadata" data-media="${esc(b.src)}"></audio>
        <button class="pl-play" aria-label="${esc(t('media.play'))}">${icon('play')}</button>
        <div class="pl-mid"><input type="range" min="0" max="1000" value="0" aria-label="${esc(t('media.seek'))}"><span class="pl-time">0:00</span></div>
        <button class="pl-speed" aria-label="${esc(t('media.speed'))}">1×</button></div>
        ${b.caption ? `<figcaption>${richInline(b.caption)}</figcaption>` : ''}
        ${b.transcript ? `<details class="transcript"><summary>${esc(t('media.transcript'))}</summary><div class="rt">${rich(b.transcript)}</div></details>` : ''}</figure>`;
    case 'video': return `<figure class="media-video"><video controls playsinline preload="metadata" data-media="${esc(b.src)}"${b.poster ? ` data-poster="${esc(b.poster)}"` : ''}></video>${b.caption ? `<figcaption>${richInline(b.caption)}</figcaption>` : ''}</figure>`;
    case 'code': {
      const lines = String(b.code).replace(/\s+$/, '').split('\n').length;
      return `<figure class="codefig"><div class="code-head" lang="${UI_LANG}"><span class="code-title">${icon('file')}<b>${esc(b.title || b.lang || t('code.code'))}</b><small>${esc(tn('n.lines', lines))}</small></span>
        <span class="code-btns">${b.file ? `<button class="code-btn" data-code-save="${esc(b.file)}" aria-label="${esc(t('code.save'))}">${icon('download')}</button>` : ''}<button class="code-btn" data-code-copy>${icon('copy')}<span>${esc(t('code.copy'))}</span></button></span></div>
        ${codeBlockHTML(b.code, b.lang)}${b.caption ? `<figcaption>${richInline(b.caption)}</figcaption>` : ''}</figure>`;
    }
  }
  return '';
}

/* Copy text: the Clipboard API where the page may use it, otherwise the old select-and-copy way (works in the Android WebView) */
async function copyText(text) {
  try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; } } catch (e) { }
  const ta = h('<textarea readonly style="position:fixed;top:-1000px;opacity:0"></textarea>'); ta.value = text; document.body.appendChild(ta);
  ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { }
  ta.remove(); return ok;
}
function mountCode(el) {
  el.addEventListener('click', async e => {
    const c = e.target.closest('[data-code-copy]'), s = e.target.closest('[data-code-save]'); if (!c && !s) return;
    const code = e.target.closest('.codefig').querySelector('pre code').textContent;
    if (c) { const ok = await copyText(code); return toast(t(ok ? 'code.copied' : 'code.copyFail'), ok ? 'good' : ''); }
    Native.saveFile(new Blob([code + '\n'], { type: 'text/plain' }), s.dataset.codeSave, 'save');
  });
}
const blocksHTML = list => list.map(blockHTML).join('');

/* Make media inside `el` work: load sources, wire audio players, tap a picture to see it full size */
function mountMedia(el, modId) {
  hydrateMedia(el, modId);
  mountCode(el);
  el.querySelectorAll('[data-player]').forEach(p => {
    const a = p.querySelector('audio'), btn = p.querySelector('.pl-play'), rng = p.querySelector('input'), time = p.querySelector('.pl-time'), sp = p.querySelector('.pl-speed');
    const speeds = [1, 1.25, 1.5, 0.75]; let si = 0, seeking = false;
    const upd = () => { if (!seeking && a.duration) rng.value = a.currentTime / a.duration * 1000; time.textContent = fmtClock(a.currentTime) + (a.duration ? ' / ' + fmtClock(a.duration) : ''); };
    btn.onclick = () => { if (a.paused) { document.querySelectorAll('audio,video').forEach(o => o !== a && o.pause()); a.play(); } else a.pause(); };
    a.onplay = () => { btn.innerHTML = icon('pause'); p.classList.add('playing'); };
    a.onpause = a.onended = () => { btn.innerHTML = icon('play'); p.classList.remove('playing'); };
    a.ontimeupdate = a.onloadedmetadata = upd;
    rng.oninput = () => { seeking = true; if (a.duration) time.textContent = fmtClock(rng.value / 1000 * a.duration) + ' / ' + fmtClock(a.duration); };
    rng.onchange = () => { if (a.duration) a.currentTime = rng.value / 1000 * a.duration; seeking = false; };
    sp.onclick = () => { si = (si + 1) % speeds.length; a.playbackRate = speeds[si]; sp.textContent = fmtNum(speeds[si], UI_LANG) + '×'; };
  });
  el.addEventListener('click', e => {
    const img = e.target.closest('img[data-zoom]'); if (!img || !img.src) return;
    sheet({ body: `<img class="zoomed" src="${img.src}" alt="${esc(img.alt)}">`, wide: true, actions: [{ id: 'x', label: t('btn.close') }] });
  });
}
const stopMedia = () => document.querySelectorAll('audio,video').forEach(a => a.pause());

SCREENS.lesson = async (el, { id, lesson }, nav) => {
  const m = await loadModule(id), l = m && m.lessonList.find(x => x.id === lesson);
  if (!l) return back();
  const p = await loadProgress(id), s = lessonState(p, l), u = m.units.find(x => x.id === l.unit), pr = l.practice;
  moduleLook(el, m); el.setAttribute('lang', m.lang);
  el.innerHTML = `${topbar(`<small>${esc(u.title)}</small>${esc(l.title)}`)}
    <article class="pad lesson-body">
      <h1 class="l-title">${esc(l.title)}</h1>${l.summary ? `<p class="lead">${richInline(l.summary)}</p>` : ''}
      ${blocksHTML(l.content)}
      ${pr && pr.tasks.length ? `<div class="practice-card" lang="${UI_LANG}"><div><b>${esc(t('les.practice'))}</b><small>${esc(tn('n.tasks', pr.tasks.length))} · ${esc(t('ex.points', { n: fmtPts(sum(pr.tasks.map(x => x.points)), UI_LANG) }))}${s.runs ? ' · ' + esc(t('les.best', { p: Math.round(s.best * 100) })) : ''}</small></div>
        <button class="btn accent" data-start>${esc(s.runs ? t('les.again') : t('les.start'))}</button></div>` : ''}
    </article>`;
  mountMedia(el, m.id);
  nav.onLeave = stopMedia;
  el.querySelector('[data-start]')?.addEventListener('click', () => go('practice', { id, lesson }));
};
