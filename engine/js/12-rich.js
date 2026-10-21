/* ================= Rich text: markdown-lite + math =================
   rich(text)        -> block HTML (paragraphs, lists, headings, quotes, tables, code blocks)
   richInline(text)  -> inline HTML (for options, chips, short labels)
   Everything is escaped first, so a shared module can never inject HTML or scripts. */
const codeBlockHTML = (code, lang) => `<pre class="codeblock"${lang ? ` data-lang="${esc(lang)}"` : ''}><code>${esc(String(code).replace(/\s+$/, ''))}</code></pre>`;
const mathCache = new Map();
function mathHTML(src, display) {
  const k = (display ? 'D' : 'I') + src;
  if (mathCache.has(k)) return mathCache.get(k);
  let html;
  try { html = katex.renderToString(src, { displayMode: display, throwOnError: false, output: 'html', strict: false }); }
  catch (e) { html = `<code class="mathfail">${esc(src)}</code>`; }
  if (mathCache.size > 800) mathCache.clear();
  mathCache.set(k, html); return html;
}

/* Pull code and math out before escaping, put them back at the end.
   Block-level pieces are marked: \u0001 = display math, \u0002 = code block. */
function protect(text) {
  const keep = [];
  const put = html => '\u0000' + (keep.push(html) - 1) + '\u0000';
  let s = String(text ?? '').replace(/\r\n?/g, '\n');
  /* ```lang … ``` first, so nothing inside a code block is read as math or formatting */
  s = s.replace(/(^|\n)[ \t]*```[ \t]*([\w+#.-]*)[ \t]*\n([\s\S]*?)\n[ \t]*```[ \t]*(?=\n|$)/g, (m, pre, lang, code) => pre + '\n\n' + put('\u0002' + codeBlockHTML(code, lang)) + '\n\n');
  s = s.replace(/\\\$/g, () => put('$'));
  s = s.replace(/\$\$([\s\S]+?)\$\$/g, (m, x) => put('\u0001' + mathHTML(x.trim(), true)));
  s = s.replace(/\$([^$\n]+?)\$/g, (m, x) => put(mathHTML(x.trim(), false)));
  s = s.replace(/`([^`\n]+)`/g, (m, x) => put(`<code>${esc(x)}</code>`));
  return { s, restore: h => h.replace(/\u0000(\d+)\u0000/g, (m, i) => keep[i].replace(/^[\u0001\u0002]/, '')), keep };
}

/* Tables: | a | b | rows, the second line is the divider |---|:---:|. Code and math are already protected,
   so a | inside `code` or $math$ never splits a cell. */
const TABLE_DIV = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/;
const tableCells = l => l.trim().replace(/^\|/, '').replace(/(?<!\\)\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
const isTableAt = (lines, i) => /^\s*\|/.test(lines[i] || '') && TABLE_DIV.test(lines[i + 1] || '') && tableCells(lines[i]).length === tableCells(lines[i + 1]).length;
function tableHTML(lines) {
  const align = tableCells(lines[1]).map(c => (/^:-+:$/.test(c) ? 'center' : /-:$/.test(c) ? 'right' : ''));
  const cell = (tag, c, i) => `<${tag}${align[i] ? ` style="text-align:${align[i]}"` : ''}>${inlineMarks(esc(c))}</${tag}>`;
  const row = (l, tag) => `<tr>${align.map((_, i) => cell(tag, tableCells(l)[i] ?? '', i)).join('')}</tr>`;
  return `<div class="tablewrap"><table><thead>${row(lines[0], 'th')}</thead><tbody>${lines.slice(2).map(l => row(l, 'td')).join('')}</tbody></table></div>`;
}
function inlineMarks(h) {
  return h
    .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
    .replace(/__(?=\S)([\s\S]*?\S)__/g, '<u>$1</u>')
    .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<s>$1</s>')
    .replace(/(^|[^*\p{L}\p{N}])\*(?=\S)([^*\n]*?\S)\*(?![\p{L}\p{N}])/gu, '$1<em>$2</em>');
}
function richInline(text) {
  const p = protect(text);
  return p.restore(inlineMarks(esc(p.s)).replace(/\n/g, '<br>'));
}
function rich(text) {
  const p = protect(text), blocks = p.s.replace(/^(#{1,4}[ \t]+.+)$/gm, '\n\n$1\n\n').split(/\n{2,}/), out = [];
  const isItem = l => /^\s*([-•*]|\d+[.)])\s+/.test(l);
  for (let k = 0; k < blocks.length; k++) {
    let b = blocks[k].replace(/^\n+|\n+$/g, ''); if (!b) continue;
    let lines = b.split('\n');
    /* "Some text:" followed straight away by list lines -> a paragraph and then the list */
    const first = lines.findIndex(isItem);
    if (first > 0 && lines.slice(first).every(isItem)) { blocks.splice(k + 1, 0, lines.slice(first).join('\n')); lines = lines.slice(0, first); b = lines.join('\n'); }
    /* "Some text:" followed straight away by a table -> a paragraph and then the table */
    const tStart = lines.findIndex((_, i) => isTableAt(lines, i));
    if (tStart > 0) { blocks.splice(k + 1, 0, lines.slice(tStart).join('\n')); lines = lines.slice(0, tStart); b = lines.join('\n'); }
    if (tStart === 0) {
      let end = 2; while (end < lines.length && /^\s*\|/.test(lines[end])) end++;
      if (end < lines.length) blocks.splice(k + 1, 0, lines.slice(end).join('\n'));
      out.push(tableHTML(lines.slice(0, end))); continue;
    }
    if (/^\u0000\d+\u0000$/.test(b) && p.keep[+b.slice(1, -1)].startsWith('\u0001')) { out.push(`<div class="mathblock">${b}</div>`); continue; }
    if (/^\u0000\d+\u0000$/.test(b) && p.keep[+b.slice(1, -1)].startsWith('\u0002')) { out.push(b); continue; }
    const hm = b.match(/^(#{1,4})\s+(.+)$/);
    if (hm && lines.length === 1) { const n = hm[1].length < 4 ? 3 : 4; out.push(`<h${n}>${inlineMarks(esc(hm[2]))}</h${n}>`); continue; }
    if (lines.every(l => /^\s*[-•*]\s+/.test(l))) { out.push('<ul>' + lines.map(l => `<li>${inlineMarks(esc(l.replace(/^\s*[-•*]\s+/, '')))}</li>`).join('') + '</ul>'); continue; }
    if (lines.every(l => /^\s*\d+[.)]\s+/.test(l))) { const start = parseInt(lines[0], 10); out.push(`<ol${start !== 1 ? ` start="${start}"` : ''}>` + lines.map(l => `<li>${inlineMarks(esc(l.replace(/^\s*\d+[.)]\s+/, '')))}</li>`).join('') + '</ol>'); continue; }
    if (lines.every(l => /^>\s?/.test(l))) { out.push(`<blockquote>${inlineMarks(esc(lines.map(l => l.replace(/^>\s?/, '')).join('\n'))).replace(/\n/g, '<br>')}</blockquote>`); continue; }
    out.push(`<p>${inlineMarks(esc(b)).replace(/\n/g, '<br>')}</p>`);
  }
  return p.restore(out.join(''));
}
