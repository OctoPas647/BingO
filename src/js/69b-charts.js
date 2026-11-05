/* ================= Charts and loading skeletons (0.9.0) =================
   Small animated SVG/HTML charts for the statistics of students and teachers. They work offline (no library),
   follow the light/dark theme through CSS variables (src/css/zzzz-stats.css) and draw themselves in:
   lines are drawn, columns grow from the baseline, rings close, numbers count up. A chart that is drawn again
   with the same data (a teacher screen re-renders on every cloud update) does not animate again.
   Every mark has a tooltip (tap or hover); colour is never the only label: grades carry their number,
   series carry a legend.

   chLine   one or more series over time, with an optional forecast band and reference lines (grade borders)
   chCols   vertical columns with the value on the cap (grade distribution, year by year)
   chHBars  horizontal bars with an optional comparison tick (subject averages vs the class)
   chDonut  parts of a whole with 2px gaps and a big number in the middle
   chRings  Apple-style activity rings
   chHeat   a calendar of active days
   chRange  dots with a likely range on a 2–6 or 0–100 scale (projections)
   skel     Apple-style shimmering placeholders while something loads */

const CH = { seen: new Map(), tipEl: null };
const GRADE_VARS = { 2: 'var(--g2)', 3: 'var(--g3)', 4: 'var(--g4)', 5: 'var(--g5)', 6: 'var(--g6)' };
const gradeColor = v => GRADE_VARS[Math.max(2, Math.min(6, Math.round(v >= 5.5 ? 6 : v >= 4.5 ? 5 : v >= 3.5 ? 4 : v >= 3 ? 3 : 2)))];
const fmtG = v => (v == null || !isFinite(v) ? '–' : (Math.round(v * 100) / 100).toFixed(2).replace('.', appLang() === 'en' ? '.' : ','));
const fmtN = (v, d = 0) => (v == null || !isFinite(v) ? '–' : (Math.round(v * 10 ** d) / 10 ** d).toFixed(d).replace('.', appLang() === 'en' || d === 0 ? '.' : ','));
const chEsc = s => esc(String(s == null ? '' : s));

/* a chart drawn again with the same content keeps still; new content animates */
function chKey(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return 'k' + (h >>> 0).toString(36); }
function chWrap(cls, inner, extra = '') {
  const k = chKey(cls + inner), now = Date.now(), seen = CH.seen.get(k), still = seen && now - seen < 15 * 60e3;
  CH.seen.set(k, now); if (CH.seen.size > 400) CH.seen.delete(CH.seen.keys().next().value);
  return `<div class="chart ${cls}${still ? ' ch-still' : ''}" ${extra}>${inner}</div>`;
}
/* "nice" axis ticks */
function niceTicks(min, max, n = 4) {
  if (!(max > min)) return [min];
  const raw = (max - min) / n, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) || raw;
  const out = []; for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

/* ---------- line chart ----------
   series: [{ name, color, pts: [{ x, y, tip }] , dash, area }]  (x: a number, e.g. time in ms or an index)
   opts: { yMin, yMax, yTicks, yFmt, xLabels: [[x, text]], refs: [{ y, label, color }], band: { color, pts: [{ x, lo, hi }] }, h, legend } */
function chLine(series, o = {}) {
  series = series.filter(s => s && s.pts && s.pts.length);
  if (!series.length) return '';
  const W = 340, H = o.h || 170, L0 = 30, R = 12, T = 12, B = 22;
  const xs = series.flatMap(s => s.pts.map(p => p.x)).concat(o.band ? o.band.pts.map(p => p.x) : []);
  let x0 = Math.min(...xs), x1 = Math.max(...xs); if (x0 === x1) { x0 -= 1; x1 += 1; }
  const ys = series.flatMap(s => s.pts.map(p => p.y)).concat(o.band ? o.band.pts.flatMap(p => [p.lo, p.hi]) : []);
  const y0 = o.yMin ?? Math.min(...ys), y1 = o.yMax ?? Math.max(...ys);
  const X = x => L0 + (x - x0) / (x1 - x0) * (W - L0 - R), Y = y => T + (1 - (y - y0) / ((y1 - y0) || 1)) * (H - T - B);
  const fmt = o.yFmt || (v => fmtN(v));
  const ticks = o.yTicks || niceTicks(y0, y1);
  let svg = ticks.map(v => `<line class="ch-grid" x1="${L0}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ch-ax" x="${L0 - 6}" y="${Y(v) + 3.5}" text-anchor="end">${chEsc(fmt(v))}</text>`).join('');
  (o.refs || []).forEach(r => { svg += `<line class="ch-ref" x1="${L0}" x2="${W - R}" y1="${Y(r.y)}" y2="${Y(r.y)}" style="stroke:${r.color || 'var(--ch-muted)'}"/>${r.label ? `<text class="ch-ref-t" x="${W - R}" y="${Y(r.y) - 3}" text-anchor="end">${chEsc(r.label)}</text>` : ''}`; });
  (o.xLabels || []).forEach(([x, t], i, a) => { const anchor = i === 0 && a.length > 1 ? 'start' : i === a.length - 1 && a.length > 1 ? 'end' : 'middle'; svg += `<text class="ch-ax" x="${X(x)}" y="${H - 6}" text-anchor="${anchor}">${chEsc(t)}</text>`; });
  if (o.band && o.band.pts.length > 1) {
    const b = o.band.pts, d = b.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.hi).toFixed(1)}`).join('') + b.slice().reverse().map(p => `L${X(p.x).toFixed(1)},${Y(p.lo).toFixed(1)}`).join('') + 'Z';
    svg += `<path class="ch-band" d="${d}" style="fill:${o.band.color || 'var(--ch-1)'}"/>`;
  }
  series.forEach((s, si) => {
    const p = s.pts.slice().sort((a, b) => a.x - b.x), c = s.color || `var(--ch-${si + 1})`;
    const d = p.map((q, i) => `${i ? 'L' : 'M'}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join('');
    if (s.area !== false && p.length > 1 && series.length === 1) svg += `<path class="ch-area" d="${d}L${X(p[p.length - 1].x).toFixed(1)},${Y(y0)}L${X(p[0].x).toFixed(1)},${Y(y0)}Z" style="fill:${c}"/>`;
    if (p.length > 1) svg += `<path class="ch-l${s.dash ? ' dash' : ''}" pathLength="1" d="${d}" style="stroke:${c};--d:${si * 120}ms"/>`;
    const last = p[p.length - 1];
    svg += p.map((q, i) => `<circle class="ch-dot${i === p.length - 1 ? ' end' : ''}" cx="${X(q.x).toFixed(1)}" cy="${Y(q.y).toFixed(1)}" r="${i === p.length - 1 ? 4.5 : p.length > 24 ? 0 : 3}" style="fill:${c};--d:${600 + i * 18}ms"/>`).join('');
    if (o.endLabel !== false && series.length <= 3) svg += `<text class="ch-endv" x="${Math.min(W - R, X(last.x)) - 2}" y="${Y(last.y) - 9}" text-anchor="end">${chEsc(s.endText || fmt(last.y))}</text>`;
  });
  /* hover: one strip per x with every series' value there */
  const allX = [...new Set(series.flatMap(s => s.pts.map(p => p.x)))].sort((a, b) => a - b);
  svg += `<line class="ch-cross" x1="0" x2="0" y1="${T}" y2="${H - B}"/>`;
  svg += allX.map((x, i) => {
    const a = i ? (X(allX[i - 1]) + X(x)) / 2 : L0, b = i < allX.length - 1 ? (X(x) + X(allX[i + 1])) / 2 : W - R;
    const tip = series.map(s => { const q = s.pts.find(p => p.x === x); return q ? (q.tip || `${series.length > 1 ? s.name + ': ' : ''}${fmt(q.y)}`) : ''; }).filter(Boolean).join('\n');
    return `<rect class="ch-hit" x="${a.toFixed(1)}" y="${T}" width="${Math.max(1, b - a).toFixed(1)}" height="${H - T - B}" data-tip="${chEsc(tip)}" data-cx="${X(x).toFixed(1)}"/>`;
  }).join('');
  const legend = series.length > 1 || o.legend ? `<div class="ch-legend">${series.map((s, si) => `<span><i style="background:${s.color || `var(--ch-${si + 1})`}"${s.dash ? ' class="dash"' : ''}></i>${chEsc(s.name)}</span>`).join('')}${o.band && o.band.label ? `<span><i class="band" style="background:${o.band.color || 'var(--ch-1)'}"></i>${chEsc(o.band.label)}</span>` : ''}</div>` : '';
  return chWrap('ch-line', `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${chEsc(o.label || series.map(s => s.name).join(', '))}">${svg}</svg>${legend}`);
}

/* ---------- columns ----------
   items: [{ label, value, color, tip, cap }] */
function chCols(items, o = {}) {
  if (!items.length) return '';
  const W = 340, H = o.h || 150, T = 18, B = 22, n = items.length, max = o.max || Math.max(1, ...items.map(i => i.value));
  const slot = (W - 8) / n, bw = Math.min(o.bw || 34, slot * 0.62);
  const Y = v => T + (1 - v / max) * (H - T - B);
  let svg = `<line class="ch-base" x1="4" x2="${W - 4}" y1="${H - B}" y2="${H - B}"/>`;
  items.forEach((it, i) => {
    const cx = 4 + slot * (i + 0.5), y = Y(it.value), h = H - B - y, r = Math.min(5, h / 2, bw / 2);
    const d = h > 0 ? `M${cx - bw / 2},${H - B}V${y + r}Q${cx - bw / 2},${y} ${cx - bw / 2 + r},${y}H${cx + bw / 2 - r}Q${cx + bw / 2},${y} ${cx + bw / 2},${y + r}V${H - B}Z` : '';
    svg += `<g class="ch-col" style="--i:${i}">${d ? `<path d="${d}" style="fill:${it.color || 'var(--ch-1)'}"/>` : ''}<text class="ch-cap" x="${cx}" y="${y - 5}" text-anchor="middle">${chEsc(it.cap ?? fmtN(it.value, o.dec || 0))}</text></g>
      <text class="ch-ax" x="${cx}" y="${H - 6}" text-anchor="middle">${chEsc(it.label)}</text>
      <rect class="ch-hit" x="${cx - slot / 2}" y="${T - 14}" width="${slot}" height="${H - T - B + 14}" data-tip="${chEsc(it.tip || it.label + ': ' + (it.cap ?? fmtN(it.value, o.dec || 0)))}"/>`;
  });
  return chWrap('ch-cols', `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${chEsc(o.label || '')}">${svg}</svg>`);
}

/* ---------- horizontal bars (HTML) ----------
   items: [{ label, sub, value, max, color, right, tip, mark, markLabel }] */
function chHBars(items, o = {}) {
  if (!items.length) return '';
  const max = o.max || Math.max(1, ...items.map(i => i.max || i.value));
  const min = o.min || 0;
  const pos = v => clamp((v - min) / (max - min), 0, 1) * 100;
  return chWrap('ch-hbars', items.map((it, i) => `<div class="ch-hrow" style="--i:${i}" data-tip="${chEsc(it.tip || '')}" tabindex="0">
      <div class="ch-hlab"><b>${it.html ? it.label : chEsc(it.label)}</b>${it.sub ? `<small>${chEsc(it.sub)}</small>` : ''}</div>
      <div class="ch-htrack"><i style="width:${pos(it.value)}%;background:${it.color || 'var(--ch-1)'}"></i>${it.mark != null ? `<em style="left:${pos(it.mark)}%" title="${chEsc(it.markLabel || '')}"></em>` : ''}</div>
      <span class="ch-hval">${it.right != null ? (it.rightHtml ? it.right : chEsc(it.right)) : chEsc(fmtN(it.value, o.dec || 0))}</span></div>`).join('')
    + (o.markLegend ? `<div class="ch-legend"><span><i class="tick"></i>${chEsc(o.markLegend)}</span></div>` : ''));
}

/* ---------- donut ----------
   parts: [{ label, value, color }], center: { big, small } */
function chDonut(parts, center = {}, o = {}) {
  const total = sum(parts.map(p => p.value)); if (!total) return '';
  const R = 52, C = 2 * Math.PI * R, gap = parts.filter(p => p.value > 0).length > 1 ? 2.2 : 0;
  let acc = 0, segs = '';
  parts.forEach((p, i) => {
    if (!p.value) return;
    const len = p.value / total * C;
    segs += `<circle class="ch-seg" r="${R}" cx="64" cy="64" style="stroke:${p.color};--i:${i}" stroke-dasharray="${Math.max(0.1, len - gap)} ${C}" stroke-dashoffset="${-acc}" data-tip="${chEsc(p.tip || `${p.label}: ${p.value} (${Math.round(p.value / total * 100)}%)`)}"/>`;
    acc += len;
  });
  const legend = o.legend === false ? '' : `<div class="ch-legend col">${parts.map(p => `<span><i style="background:${p.color}"></i>${chEsc(p.label)}<b>${p.value}</b></span>`).join('')}</div>`;
  return chWrap('ch-donut', `<div class="ch-donut-fig"><svg viewBox="0 0 128 128" role="img" aria-label="${chEsc(o.label || '')}"><circle class="ch-track" r="${R}" cx="64" cy="64"/><g transform="rotate(-90 64 64)">${segs}</g></svg>
    <div class="ch-donut-c"><b${center.count != null ? ` data-count="${center.count}" data-dec="${center.dec || 0}"` : ''}>${chEsc(center.big ?? '')}</b><small>${chEsc(center.small ?? '')}</small></div></div>${legend}`);
}

/* ---------- activity rings ----------
   rings: [{ p (0..1, may go over), color, label, value }] */
function chRings(rings, o = {}) {
  const size = 128, sw = 13, gap = 3;
  let svg = '';
  rings.forEach((r, i) => {
    const rad = size / 2 - sw / 2 - i * (sw + gap), C = 2 * Math.PI * rad, p = clamp(r.p, 0, 1);
    svg += `<circle class="ch-rtrack" r="${rad}" cx="64" cy="64" style="stroke:${r.color}"/><circle class="ch-ring" r="${rad}" cx="64" cy="64" style="stroke:${r.color};--c:${C};--off:${C * (1 - p)};--i:${i}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p)}" data-tip="${chEsc(r.label + ': ' + r.value)}"/>`;
  });
  const legend = o.legend === false ? '' : `<div class="ch-legend col">${rings.map(r => `<span><i style="background:${r.color}"></i>${chEsc(r.label)}<b>${chEsc(r.value)}</b></span>`).join('')}</div>`;
  return chWrap('ch-rings', `<svg viewBox="0 0 128 128" role="img" aria-label="${chEsc(o.label || '')}"><g transform="rotate(-90 64 64)">${svg}</g></svg>${legend}`);
}

/* ---------- active days: the last `weeks` weeks, Monday on top ----------
   counts: { 'YYYY-MM-DD': n } */
function chHeat(counts, o = {}) {
  const weeks = o.weeks || 18, today = new Date(); today.setHours(12, 0, 0, 0);
  const start = new Date(today); start.setDate(start.getDate() - ((today.getDay() + 6) % 7) - (weeks - 1) * 7);
  const max = Math.max(1, ...Object.values(counts)), cells = [], months = [];
  for (let w = 0; w < weeks; w++) for (let d = 0; d < 7; d++) {
    const day = new Date(start); day.setDate(start.getDate() + w * 7 + d); if (day > today) continue;
    const k = localDay(day.getTime()), n = counts[k] || 0, lvl = n ? Math.min(4, 1 + Math.floor(n / max * 3.999)) : 0;
    cells.push(`<rect class="ch-hc l${lvl}" x="${w * 13}" y="${d * 13}" width="11" height="11" rx="3" style="--i:${w}" data-tip="${chEsc(fmtWhen(day.getTime(), { day: 'numeric', month: 'short' }) + ': ' + n)}"/>`);
    if (d === 0 && day.getDate() <= 7) months.push(`<text class="ch-ax" x="${w * 13}" y="-4">${chEsc(fmtWhen(day.getTime(), { month: 'short' }))}</text>`);
  }
  return chWrap('ch-heat', `<svg viewBox="-2 -14 ${weeks * 13 + 2} ${7 * 13 + 14}" role="img" aria-label="${chEsc(o.label || '')}">${months.join('')}${cells.join('')}</svg>
    <div class="ch-heat-key"><small>${L('по-малко')}</small>${[0, 1, 2, 3, 4].map(l => `<i class="l${l}"></i>`).join('')}<small>${L('повече')}</small></div>`);
}

/* ---------- likely range on a scale (projections) ----------
   rows: [{ label, sub, v, lo, hi, color, right, tip, href }]  scale: { min, max, cuts: [[v, label]] } */
function chRange(rows, scale, o = {}) {
  if (!rows.length) return '';
  const pos = v => clamp((v - scale.min) / (scale.max - scale.min), 0, 1) * 100;
  const cuts = (scale.cuts || []).map(([v, l]) => `<span class="ch-cut" style="left:${pos(v)}%"><small>${chEsc(l)}</small></span>`).join('');
  return chWrap('ch-range', `<div class="ch-rscale">${cuts}</div>` + rows.map((r, i) => `<${r.attr ? 'button' : 'div'} class="ch-rrow" style="--i:${i}" ${r.attr || ''} data-tip="${chEsc(r.tip || '')}">
      <div class="ch-hlab"><b>${chEsc(r.label)}</b>${r.sub ? `<small>${r.subHtml ? r.sub : chEsc(r.sub)}</small>` : ''}</div>
      <div class="ch-rtrack">${(scale.cuts || []).map(([v]) => `<u style="left:${pos(v)}%"></u>`).join('')}<i style="left:${pos(r.lo)}%;width:${Math.max(1, pos(r.hi) - pos(r.lo))}%;background:${r.color}"></i><b style="left:${pos(r.v)}%;background:${r.color}"></b></div>
      <span class="ch-hval">${r.rightHtml ? r.right : chEsc(r.right ?? fmtN(r.v, 1))}</span></${r.attr ? 'button' : 'div'}>`).join(''));
}

/* ---------- a stat tile with a count-up number ---------- */
function chStat(label, value, o = {}) {
  const num = typeof value === 'number' && isFinite(value);
  return `<div class="card ch-stat${o.cls ? ' ' + o.cls : ''}"${o.attr ? ' ' + o.attr : ''}><small>${chEsc(label)}</small><b${num ? ` data-count="${value}" data-dec="${o.dec || 0}"` : ''}${o.color ? ` style="color:${o.color}"` : ''}>${num ? (o.dec ? fmtN(value, o.dec) : fmtN(value)) : chEsc(value ?? '–')}${o.unit ? `<span>${chEsc(o.unit)}</span>` : ''}</b>${o.delta != null && isFinite(o.delta) && o.delta !== 0 ? `<em class="${(o.delta > 0) === (o.upGood !== false) ? 'up' : 'down'}">${o.delta > 0 ? '▲' : '▼'} ${chEsc(o.deltaText || fmtN(Math.abs(o.delta), o.dec || 0))}</em>` : ''}${o.sub ? `<i>${chEsc(o.sub)}</i>` : ''}</div>`;
}

/* ---------- grade chips, as in a school diary ---------- */
const gradeChip = (v, o = {}) => `<span class="gchip${o.small ? ' sm' : ''}${o.term ? ' term' : ''}" style="--gc:${gradeColor(v)}" ${o.attr || ''} title="${chEsc(o.title || '')}">${chEsc(Number.isInteger(v) ? String(v) : fmtG(v))}</span>`;

/* ---------- tooltips: tap or hover any [data-tip] inside a chart ---------- */
function chTip(target, x, y) {
  const tip = target && target.dataset.tip;
  let el = CH.tipEl;
  if (!tip) { if (el) el.classList.remove('in'); document.querySelectorAll('.ch-cross.on').forEach(c => c.classList.remove('on')); return; }
  if (!el) { el = CH.tipEl = document.createElement('div'); el.className = 'ch-tipbox'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.innerHTML = tip.split('\n').map(l => `<div>${chEsc(l)}</div>`).join('');
  el.classList.add('in');
  const w = el.offsetWidth, h = el.offsetHeight;
  el.style.left = clamp(x - w / 2, 8, innerWidth - w - 8) + 'px';
  el.style.top = (y - h - 14 < 8 ? y + 18 : y - h - 14) + 'px';
  const svg = target.closest('svg'), cross = svg && svg.querySelector('.ch-cross');
  document.querySelectorAll('.ch-cross.on').forEach(c => c !== cross && c.classList.remove('on'));
  if (cross && target.dataset.cx) { cross.setAttribute('x1', target.dataset.cx); cross.setAttribute('x2', target.dataset.cx); cross.classList.add('on'); }
}
document.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const t = e.target.closest && e.target.closest('.chart [data-tip]'); chTip(t, e.clientX, e.clientY); }, { passive: true });
document.addEventListener('pointerdown', e => { const t = e.target.closest && e.target.closest('.chart [data-tip]'); chTip(t, e.clientX, e.clientY); }, { passive: true });
document.addEventListener('scroll', () => chTip(null), { passive: true, capture: true });
document.addEventListener('focusin', e => { const t = e.target.closest && e.target.closest('.chart [data-tip]'); if (t) { const r = t.getBoundingClientRect(); chTip(t, r.left + r.width / 2, r.top); } });

/* ---------- numbers count up when they appear ---------- */
function countUp(root) {
  const on = typeof motionOn === 'function' ? motionOn() : true;
  root.querySelectorAll('[data-count]:not([data-counted])').forEach(el => {
    el.dataset.counted = '1';
    if (!on || el.closest('.ch-still')) return;
    const to = +el.dataset.count, dec = +el.dataset.dec || 0, unit = el.querySelector('span'), unitHtml = unit ? unit.outerHTML : '';
    if (!isFinite(to)) return;
    const t0 = performance.now(), dur = 900;
    const step = now => { if (!el.isConnected) return; const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3); el.innerHTML = fmtN(to * e, dec) + unitHtml; if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && (n.matches('[data-count]') || n.querySelector('[data-count]'))) { countUp(n.parentNode || n); } })
  .observe(document.documentElement, { childList: true, subtree: true });

/* ================= Loading skeletons =================
   Grey shapes of what is coming with a soft light sweeping over them, as in Apple's apps. */
function skel(kind = 'page', n = 4) {
  const line = (w, cls = '') => `<i class="sk ${cls}" style="width:${w}%"></i>`;
  const row = () => `<div class="sk-row"><i class="sk sk-av"></i><div class="sk-lines">${line(58 + Math.random() * 30)}${line(30 + Math.random() * 25, 'sm')}</div></div>`;
  const parts = {
    kpis: () => `<div class="sk-kpis">${[0, 1, 2, 3].map(() => `<div class="sk-card">${line(45, 'big')}${line(70, 'sm')}</div>`).join('')}</div>`,
    list: () => `<div class="sk-card">${line(40, 'title')}${Array.from({ length: n }, row).join('')}</div>`,
    chart: () => `<div class="sk-card">${line(36, 'title')}<div class="sk-chart">${[46, 70, 58, 88, 64, 76, 52].map(h => `<i class="sk" style="height:${h}%"></i>`).join('')}</div></div>`,
    text: () => `<div class="sk-text">${[92, 100, 84, 96, 62].slice(0, n + 1).map(w => line(w)).join('')}</div>`,
    hero: () => `<div class="sk-card sk-hero"><i class="sk sk-ring"></i><div class="sk-lines">${line(40, 'sm')}${line(70, 'big')}${line(55)}</div></div>`
  };
  const html = kind === 'page' ? parts.hero() + parts.kpis() + parts.chart() + parts.list()
    : kind === 'teacher' ? parts.kpis() + parts.list() + parts.chart()
    : (parts[kind] || parts.list)();
  return `<div class="skel" aria-busy="true" aria-label="${L('Зареждане…')}">${html}</div>`;
}

/* every new screen: while the cloud or a teacher screen is still loading, its empty body shimmers */
const _decorateSk = decorate;
decorate = function (el) {
  if (el) {
    el.querySelectorAll('.t-body').forEach(tb => { if (!tb.childElementCount && !tb.textContent.trim()) tb.innerHTML = skel('teacher'); });
    if (!el.childElementCount && !el.textContent.trim()) el.innerHTML = `<div class="pad">${skel('page')}</div>`;
  }
  return _decorateSk(el);
};
