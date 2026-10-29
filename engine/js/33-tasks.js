/* ================= Task views: one per task type =================
   taskView(task, module, { mode: 'practice' | 'exam' | 'review', response, seed, onChange })
     -> { el, get(), ready(), show(result) -> feedback HTML, lock() }
   The same views are used in lesson practice, in exams and when reviewing answers. */
/* Each hint opened in practice lowers what the task is worth (the idea comes from SQL Practice) */
const HINT_FACTORS = [1, 0.75, 0.5, 0.25];
const CYR_LETTERS = 'АБВГДЕЖЗИКЛМНОП', LAT_LETTERS = 'ABCDEFGHIJKLMNOP';
const letterOf = (lang, i) => (/^(bg|ru|uk|sr|mk|be)\b/.test(lang) ? CYR_LETTERS : LAT_LETTERS)[i] || String(i + 1);

function isAnswered(task, r) {
  if (r == null) return false;
  switch (task.type) {
    case 'choice': return r !== null;
    case 'multi': return r.length > 0;
    case 'text': case 'number': return String(r).trim() !== '';
    case 'gaps': return r.some(v => v != null && String(v).trim() !== '');
    case 'order': return !!r.moved;
    case 'match': return r.some(v => v != null);
    case 'open': return !!String(r.text || '').trim();
  }
  return false;
}

function passageHTML(m, task, open) {
  const p = task.passage && m.passages[task.passage]; if (!p) return '';
  return `<details class="passage"${open ? ' open' : ''}><summary>${icon('text')}<span>${esc(p.title || t('task.passage'))}</span>${p.author ? `<small>${esc(p.author)}</small>` : ''}</summary>
    <div class="rt">${rich(p.text)}</div>${blocksHTML(p.media)}${p.source ? `<p class="source">${richInline(p.source)}</p>` : ''}</details>`;
}

function taskView(task, m, opt = {}) {
  const mode = opt.mode || 'practice', lang = m.lang, seed = (opt.seed || 's') + ':' + task.id;
  const B = TASK_BUILDERS[task.type](task, m, opt.response, seed, () => opt.onChange && opt.onChange());
  const hints = arr(task.hint);
  const typeHint = { multi: t('task.pickAll'), order: t('task.order'), match: t('task.match'), gaps: '', open: '' }[task.type];
  const el = h(`<div class="task t-${task.type}" lang="${esc(lang)}">
    ${passageHTML(m, task, mode !== 'review')}
    ${task.media.length ? `<div class="task-media">${blocksHTML(task.media)}</div>` : ''}
    ${task.prompt ? `<div class="prompt rt">${rich(task.prompt)}</div>` : ''}
    ${typeHint ? `<p class="type-hint" lang="${UI_LANG}">${esc(typeHint)}</p>` : ''}
    <div class="answer"></div>
    ${hints.length && mode === 'practice' ? `<div class="hints"></div><button class="hintbtn" lang="${UI_LANG}"></button>` : ''}
    <div class="fb" hidden></div></div>`);
  const area = el.querySelector('.answer');
  let used = 0;
  const hintLabel = () => { const hb = el.querySelector('.hintbtn'); if (!hb) return; if (used >= hints.length) return hb.remove(); hb.innerHTML = icon('bulb') + esc(t(used ? 'task.moreHint' : 'task.hint')) + `<small>${esc(t('task.hintCost', { p: Math.round(HINT_FACTORS[Math.min(3, used + 1)] * 100) }))}</small>`; };
  area.innerHTML = B.html; B.mount(area);
  hintLabel();
  el.querySelector('.hintbtn')?.addEventListener('click', () => { if (locked) return; el.querySelector('.hints').insertAdjacentHTML('beforeend', `<div class="hint rt">${rich(hints[used])}</div>`); used++; hintLabel(); opt.onChange && opt.onChange(); });
  mountMedia(el, m.id);
  let locked = false;
  const api = {
    el, get: B.get, ready: () => isAnswered(task, B.get()), setMarks: v => B.setMarks && B.setMarks(v), hintsUsed: () => used,
    lock() { locked = true; el.classList.add('locked'); el.querySelector('.hintbtn')?.remove(); B.lock && B.lock(); el.querySelectorAll('.answer input,.answer textarea').forEach(i => { i.readOnly = true; }); el.querySelectorAll('.answer .signbtn').forEach(b => { b.disabled = true; }); },
    show(res) {
      api.lock();
      const extra = B.show ? B.show(res) || '' : '';
      const fb = el.querySelector('.fb');
      const html = extra + (task.explain ? `<div class="explain"><b lang="${UI_LANG}">${esc(t('task.explain'))}</b><div class="rt">${rich(task.explain)}</div></div>` : '');
      if (html) { fb.innerHTML = html; fb.hidden = false; }
      return html;
    }
  };
  area.addEventListener('click', e => { if (locked) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
  return api;
}

const solutionLine = (label, html) => `<div class="solution"><b lang="${UI_LANG}">${esc(label)}</b> <span>${html}</span></div>`;

const TASK_BUILDERS = {
  choice(task, m, resp, seed, changed) {
    let sel = resp ?? null, area;
    const paint = () => area.querySelectorAll('.opt').forEach(b => b.classList.toggle('sel', +b.dataset.i === sel));
    return {
      html: `<div class="opts">${task.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="let">${letterOf(m.lang, i)}</span><span class="otext">${richInline(o)}</span></button>`).join('')}</div>`,
      mount(a) { area = a; paint(); a.addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; sel = +b.dataset.i; paint(); changed(); }); },
      get: () => sel,
      show() {
        area.querySelectorAll('.opt').forEach(b => {
          const i = +b.dataset.i;
          if (i === task.answer) b.classList.add('right');
          if (i === sel && sel !== task.answer) { b.classList.add('wrong'); const why = task.why && task.why[i]; if (why) b.insertAdjacentHTML('afterend', `<div class="why rt">${rich(why)}</div>`); }
        });
        return '';
      }
    };
  },
  multi(task, m, resp, seed, changed) {
    const sel = new Set(resp || []); let area;
    const paint = () => area.querySelectorAll('.opt').forEach(b => b.classList.toggle('sel', sel.has(+b.dataset.i)));
    return {
      html: `<div class="opts multi">${task.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="box">${icon('check')}</span><span class="otext">${richInline(o)}</span></button>`).join('')}</div>`,
      mount(a) { area = a; paint(); a.addEventListener('click', e => { const b = e.target.closest('.opt'); if (!b) return; const i = +b.dataset.i; sel.has(i) ? sel.delete(i) : sel.add(i); paint(); changed(); }); },
      get: () => [...sel].sort((a, b) => a - b),
      show() {
        area.querySelectorAll('.opt').forEach(b => {
          const i = +b.dataset.i, want = task.answer.includes(i);
          if (want) b.classList.add(sel.has(i) ? 'right' : 'missed');
          else if (sel.has(i)) b.classList.add('wrong');
        });
        return '';
      }
    };
  },
  text(task, m, resp, seed, changed) { return fieldBuilder(task, m, resp, changed, false); },
  number(task, m, resp, seed, changed) { return fieldBuilder(task, m, resp, changed, true); },
  gaps(task, m, resp, seed, changed) {
    const vals = Array.isArray(resp) ? resp.slice() : task.gaps.map(() => null); let area, active = null;
    const pieces = task.text.split(/\[\[(\d+)\]\]/), useBank = Array.isArray(task.bank);
    /* Word bank (from SQL Practice): the typed blanks are filled by tapping words; decoys are mixed in */
    const chips = useBank ? shuffled([...task.gaps.filter(g => !g.options).map(g => arr(g.answer)[0]), ...task.bank], seed + ':bank') : [];
    const html = pieces.map((s, k) => {
      if (k % 2 === 0) return richInline(s);
      const i = +s - 1, g = task.gaps[i];
      if (g.options) return `<span class="gap pick" data-g="${i}">${g.options.map((o, j) => `<button data-o="${j}">${richInline(o)}</button>`).join('')}</span>`;
      if (useBank) return `<button class="gap slot" data-g="${i}" aria-label="${esc(t('task.blank', { n: i + 1 }))}"></button>`;
      const len = Math.max(...arr(g.answer).map(a => a.length));
      return `<input class="gap-in" data-g="${i}" autocomplete="off" autocapitalize="off" spellcheck="false" style="width:${clamp(len + 2, 3, 24)}ch" value="${esc(vals[i] ?? '')}" aria-label="${esc(t('task.blank', { n: i + 1 }))}">`;
    }).join('');
    const slots = () => [...area.querySelectorAll('.gap.slot')].map(x => +x.dataset.g);
    const paint = () => {
      area.querySelectorAll('.gap.pick').forEach(sp => sp.querySelectorAll('button').forEach(b => b.classList.toggle('sel', vals[+sp.dataset.g] === +b.dataset.o)));
      if (!useBank) return;
      if (active == null || vals[active]) active = slots().find(i => !vals[i]) ?? null;
      area.querySelectorAll('.gap.slot').forEach(b => { const i = +b.dataset.g; b.textContent = vals[i] || ''; b.classList.toggle('filled', !!vals[i]); b.classList.toggle('active', i === active); });
      const taken = slots().map(i => vals[i]).filter(Boolean), left = [...taken];
      area.querySelectorAll('.bank .chip').forEach(c => { const k = left.indexOf(c.dataset.w); c.classList.toggle('used', k >= 0); if (k >= 0) left.splice(k, 1); });
    };
    return {
      html: `<div class="gaptext rt">${html.replace(/\n/g, '<br>')}</div>${useBank ? `<div class="bank">${chips.map(w => `<button class="chip" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>` : ''}`,
      mount(a) {
        area = a; paint();
        a.addEventListener('click', e => {
          const b = e.target.closest('.gap.pick button');
          if (b) { vals[+b.parentNode.dataset.g] = +b.dataset.o; paint(); return changed(); }
          const sl = e.target.closest('.gap.slot');
          if (sl) { const i = +sl.dataset.g; if (vals[i]) { vals[i] = null; changed(); } active = i; return paint(); }
          const c = e.target.closest('.bank .chip');
          if (c && !c.classList.contains('used')) { const i = active ?? slots().find(j => !vals[j]); if (i == null) return; vals[i] = c.dataset.w; active = null; paint(); changed(); }
        });
        a.addEventListener('input', e => { if (e.target.matches('.gap-in')) { vals[+e.target.dataset.g] = e.target.value; changed(); } });
      },
      get: () => vals.slice(),
      lock() { area.querySelector('.bank')?.classList.add('locked'); },
      show(res) {
        res.detail && res.detail.forEach((ok, i) => {
          const g = task.gaps[i], x = area.querySelector(`[data-g="${i}"]`);
          x.classList.add(ok ? 'right' : 'wrong');
          if (g.options) x.querySelectorAll('button').forEach(b => { if (+b.dataset.o === g.answer) b.classList.add('right'); else if (b.classList.contains('sel')) b.classList.add('wrong'); });
          else if (!ok) x.insertAdjacentHTML('afterend', `<span class="gap-fix">${esc(arr(g.answer)[0])}</span>`);
        });
        return '';
      }
    };
  },
  order(task, m, resp, seed, changed) {
    let ord = resp && Array.isArray(resp.order) ? resp.order.slice() : shuffledIdx(task.items.length, seed), moved = !!(resp && resp.moved), area;
    const draw = () => {
      area.querySelector('.orderlist').innerHTML = ord.map((k, pos) => `<li data-pos="${pos}"><span class="oi-n">${pos + 1}</span><span class="oi-text">${richInline(task.items[k])}</span>
        <span class="oi-btns"><button data-mv="-1" aria-label="${esc(t('task.up'))}"${pos === 0 ? ' disabled' : ''}>${icon('up')}</button><button data-mv="1" aria-label="${esc(t('task.down'))}"${pos === ord.length - 1 ? ' disabled' : ''}>${icon('down')}</button></span></li>`).join('');
    };
    return {
      html: '<ol class="orderlist"></ol>',
      mount(a) {
        area = a; draw();
        a.addEventListener('click', e => {
          const b = e.target.closest('[data-mv]'); if (!b) return;
          const pos = +b.closest('li').dataset.pos, to = pos + +b.dataset.mv; if (to < 0 || to >= ord.length) return;
          [ord[pos], ord[to]] = [ord[to], ord[pos]]; moved = true; draw();
          area.querySelector(`li[data-pos="${to}"]`).classList.add('just'); changed();
        });
      },
      get: () => ({ order: ord.slice(), moved }),
      lock() { area.querySelectorAll('.oi-btns').forEach(x => x.remove()); },
      show(res) {
        area.querySelectorAll('li').forEach((li, i) => li.classList.add(res.detail && res.detail[i] ? 'right' : 'wrong'));
        return res.status === 'right' ? '' : solutionLine(t('task.rightOrder'), `<ol class="sol-list">${task.items.map(x => `<li>${richInline(x)}</li>`).join('')}</ol>`);
      }
    };
  },
  match(task, m, resp, seed, changed) {
    const pool = [...task.right, ...arr(task.extra)], order = shuffled([...pool.keys()], seed);
    const pairs = Array.isArray(resp) ? resp.slice() : task.left.map(() => null); let cur = null, area;
    const paint = () => {
      area.querySelectorAll('.mi.l').forEach(b => { const i = +b.dataset.l, k = pairs[i]; b.classList.toggle('cur', cur === i); b.classList.toggle('paired', k != null); b.querySelector('.badge').textContent = k != null ? i + 1 : ''; b.dataset.c = k != null ? i % 6 : ''; });
      area.querySelectorAll('.mi.r').forEach(b => { const k = +b.dataset.r, i = pairs.indexOf(k); b.classList.toggle('paired', i >= 0); b.querySelector('.badge').textContent = i >= 0 ? i + 1 : ''; b.dataset.c = i >= 0 ? i % 6 : ''; });
    };
    return {
      html: `<div class="match"><div class="mcol">${task.left.map((x, i) => `<button class="mi l" data-l="${i}"><span class="badge"></span><span>${richInline(x)}</span></button>`).join('')}</div>
        <div class="mcol">${order.map(k => `<button class="mi r" data-r="${k}"><span class="badge"></span><span>${richInline(pool[k])}</span></button>`).join('')}</div></div>`,
      mount(a) {
        area = a; paint();
        a.addEventListener('click', e => {
          const l = e.target.closest('.mi.l'), r = e.target.closest('.mi.r');
          const nextFree = () => { const i = pairs.findIndex(v => v == null); return i < 0 ? null : i; };
          if (l) { const i = +l.dataset.l; cur = cur === i ? null : i; }
          else if (r) {
            const k = +r.dataset.r, owner = pairs.indexOf(k);
            if (owner >= 0 && (cur == null || cur === owner)) { pairs[owner] = null; cur = owner; changed(); }
            else {
              if (cur == null) cur = nextFree();
              if (cur != null) { if (owner >= 0) pairs[owner] = null; pairs[cur] = k; cur = nextFree(); changed(); }
            }
          }
          paint();
        });
      },
      get: () => pairs.slice(),
      show(res) {
        area.querySelectorAll('.mi.l').forEach(b => b.classList.add(res.detail && res.detail[+b.dataset.l] ? 'right' : 'wrong'));
        return res.status === 'right' ? '' : solutionLine(t('task.rightPairs'), `<ul class="sol-list">${task.left.map((x, i) => `<li>${richInline(x)} → ${richInline(task.right[i])}</li>`).join('')}</ul>`);
      }
    };
  },
  open(task, m, resp, seed, changed) {
    let text = resp && resp.text || '', marks = resp && resp.marks || null, area;
    const wc = () => { const n = wordCount(text), el2 = area.querySelector('.wc'); el2.textContent = tn('n.words', n) + (task.minWords ? ' · ' + t('task.minWords', { n: task.minWords }) : '') + (task.maxWords ? ' · ' + t('task.maxWords', { n: task.maxWords }) : ''); el2.classList.toggle('short', !!task.minWords && n < task.minWords); };
    return {
      html: `<textarea class="essay" rows="${task.points >= 10 ? 14 : 6}" spellcheck="true" placeholder="${esc(t('task.write'))}"></textarea><div class="wc" lang="${UI_LANG}"></div>`,
      mount(a) { area = a; const ta = a.querySelector('textarea'); ta.value = text; wc(); ta.addEventListener('input', () => { text = ta.value; wc(); changed(); }); },
      get: () => ({ text, marks }),
      setMarks(v) { marks = v; },
      show() { return task.answer ? `<div class="model"><b lang="${UI_LANG}">${esc(t('task.model'))}</b><div class="rt">${rich(task.answer)}</div></div>` : ''; }
    };
  }
};

/* Number answers get a "±" button: many Android number keyboards (inputmode=decimal) have no minus key */
function fieldBuilder(task, m, resp, changed, numeric) {
  let val = resp ?? '', area;
  return {
    html: (() => {
      const input = `<input class="field${numeric ? ' num' : ''}" ${numeric ? 'inputmode="decimal"' : ''} autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" placeholder="${esc(numeric ? t('task.numHint') : (task.strict ? 'Напишете цяло изречение.' : t('task.typeHint')))}" value="${esc(val)}">`;
      if (!numeric) return input;
      return `<div class="field-unit"><button type="button" class="signbtn" aria-label="${esc(t('task.sign'))}" title="${esc(t('task.sign'))}">±</button>${input}${task.unit ? `<span class="unit">${esc(task.unit)}</span>` : ''}</div>`;
    })(),
    mount(a) {
      area = a; const f = a.querySelector('input');
      f.addEventListener('input', () => { val = f.value; changed(); });
      f.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); f.dispatchEvent(new CustomEvent('submit-answer', { bubbles: true })); } });
      a.querySelector('.signbtn')?.addEventListener('click', () => {
        if (f.readOnly) return;
        f.value = /^\s*[-−–]/.test(f.value) ? f.value.replace(/^\s*[-−–]\s*/, '') : '-' + f.value.trimStart();
        val = f.value; changed(); f.focus();
      });
    },
    get: () => val,
    show(res) {
      const f = area.querySelector('input'); f.classList.add(res.status === 'right' ? 'right' : 'wrong');
      if (res.status === 'right') return '';
      const fragment = !numeric && task.strict && !isFullSentence(val);
      const feedback = fragment ? `<div class="why rt" lang="${esc(m.lang)}">Отговорът трябва да е цяло изречение.</div>` : '';
      const ans = numeric ? esc(fmtSig(task.answer, m.lang) + (task.unit ? '\u00A0' + task.unit : '') + (task.tolerance > 0 ? ` (± ${fmtSig(task.tolerance, m.lang, 2)})` : '')) : esc(arr(task.answer)[0]);
      return feedback + solutionLine(t('task.correctIs'), ans);
    }
  };
}

/* Self-grading with the task's rubric (open tasks), used in practice and after an exam */
function rubricView(task, marks, onChange) {
  const rub = rubricOf(task), vals = Array.isArray(marks) ? marks.slice() : rub.map(() => 0);
  const stepOf = r => (r.points <= 2 ? 0.5 : 1);
  const el = h(`<div class="rubric" lang="${UI_LANG}"><p class="rub-intro">${esc(t('rub.intro'))}</p>
    ${rub.map((r, k) => `<div class="rub-row"><div class="rub-text rt" lang="${esc(document.documentElement.lang)}">${r.text ? rich(r.text) : esc(t('rub.overall'))}</div>
      <div class="stepper" data-k="${k}"><button data-d="-1" aria-label="−">−</button><output></output><span class="of">/ ${fmtPts(r.points, UI_LANG)}</span><button data-d="1" aria-label="+">+</button></div></div>`).join('')}
    <div class="rub-total"><span>${esc(t('rub.total'))}</span><b></b></div></div>`);
  const paint = () => {
    el.querySelectorAll('.stepper').forEach(s => { const k = +s.dataset.k, r = rub[k]; s.querySelector('output').textContent = fmtPts(vals[k], UI_LANG); s.querySelector('[data-d="-1"]').disabled = vals[k] <= 0; s.querySelector('[data-d="1"]').disabled = vals[k] >= r.points; });
    el.querySelector('.rub-total b').textContent = `${fmtPts(sum(vals), UI_LANG)} / ${fmtPts(task.points, UI_LANG)}`;
  };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const k = +b.parentNode.dataset.k, r = rub[k]; vals[k] = clamp(roundTo(vals[k] + +b.dataset.d * stepOf(r), 2), 0, r.points); paint(); onChange && onChange(vals.slice());
  });
  paint();
  return { el, get: () => vals.slice() };
}
