#!/usr/bin/env python3
"""
Turn МОН's matura PDFs (the "dzi and other" folder on Google Drive) into BingO past-exam modules.

  pdftotext -layout exam.pdf exam.txt            (one .txt per PDF)
  python tools/import_dzi.py <folder with .txt>  -> content/past-exams/dzi12-<subject>-<date>-v<n>.json

What it reads:
  - the header: subject, date, variant, level (B1 / B1.1 / B2 for languages)
  - the closed questions "N. ... А) ... Б) ... В) ... Г) ..." with the official key
    ("КЛЮЧ С ВЕРНИТЕ ОТГОВОРИ", a table "Въпрос № | Верен отговор | Брой точки")
  - open questions with the official answer from the key ("Задача 21. – 3 т. <answer>"),
    which the learner (or Gemini) checks against the official answer, like the other past exams
  - a text before a group of questions ("Прочетете текста…") becomes a passage of those questions
What it leaves out, because the app cannot show it faithfully:
  - questions that need a picture, map, chart, table or diagram (the PDF's drawings are not text)
  - listening tasks of the language maturas (no audio in the PDF)
  - an exam without a readable key
Every closed question gets four options (А–Г); a question with fewer options is left out here
(the importer never invents a distractor for an official exam).
"""
import json, pathlib, re, sys, unicodedata

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'content/past-exams'

SUBJECTS = [  # id, regex on the header subject line, title
    ('hist', r'ИСТОРИЯ', 'История и цивилизации'),
    ('bio', r'БИОЛОГИЯ', 'Биология и здравно образование'),
    ('chem', r'ХИМИЯ', 'Химия и опазване на околната среда'),
    ('phys', r'ФИЗИКА', 'Физика и астрономия'),
    ('geo', r'ГЕОГРАФИЯ', 'География и икономика'),
    ('phil', r'ФИЛОСОФИЯ|ФИЛОСОФ', 'Философия'),
    ('it', r'ИНФОРМАЦИОННИ ТЕХНОЛОГИИ', 'Информационни технологии'),
    ('infm', r'ИНФОРМАТИКА', 'Информатика'),
    ('entr', r'ПРЕДПРИЕМАЧЕСТВО', 'Предприемачество'),
    ('art', r'ИЗОБРАЗИТЕЛНО', 'Изобразително изкуство'),
    ('music', r'МУЗИКА', 'Музика'),
    ('en', r'АНГЛИЙСКИ', 'Английски език'),
    ('de', r'НЕМСКИ', 'Немски език'),
    ('ru', r'РУСКИ', 'Руски език'),
    ('fr', r'ФРЕНСКИ', 'Френски език'),
    ('es', r'ИСПАНСКИ', 'Испански език'),
    ('itl', r'ИТАЛИАНСКИ', 'Италиански език'),
]
MONTHS = {'януари': 1, 'февруари': 2, 'март': 3, 'април': 4, 'май': 5, 'юни': 6, 'юли': 7, 'август': 8, 'септември': 9, 'октомври': 10, 'ноември': 11, 'декември': 12}
LETTERS = 'АБВГ'
# a question that refers to something drawn on the page
VISUAL = re.compile(r'карикатур|марка(та)?\b|монет|герб|знаме|афиш|изображени|снимк|картина|карта(та)?\b|картата|схем|фигур|график|диаграм|таблиц|чертеж|рисун|илюстрац|портрет|плакат|на картинката|посочената на|отбелязан[аио]? с цифр|под номер|репродукц|нотн|нотите|партитур|модел(ът)? на|структурна формула|колажа|скица|прожектир|бутон|екран(а|ът)|прозорец|диалогов|менюто|иконата|клетк(а|ите) [A-Z]\d|Picture|picture|image|Bild|photo|фото', re.I)
LISTENING = re.compile(r'СЛУШАНЕ|LISTENING|HÖRVERSTEHEN|AUDITION|COMPRENSIÓN AUDITIVA|ASCOLTO|АУДИРОВАНИЕ|Hörverstehen|COMPRÉHENSION ORALE', re.I)


def norm(s):
    s = unicodedata.normalize('NFC', s).replace('­', '').replace('\f', '\n')
    # Latin look-alikes used for option letters in some PDFs
    return s


def clean(s):
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\s*\n\s*', ' ', s)
    return s.strip('   ')


def drop_page_numbers(lines):
    return [l for l in lines if not re.fullmatch(r'\s*\d{1,2}\s*', l) and not re.search(r'МИНИСТЕРСТВО НА ОБРАЗОВ|ДЪРЖАВЕН ЗРЕЛОСТЕН ИЗПИТ|ПРОФИЛИРАНА ПОДГОТОВКА|ОБЩООБРАЗОВАТЕЛНА ПОДГОТОВКА|^\s*ВАРИАНТ \d', l)]


def header(text):
    top = text[:1500]
    subj = next(((sid, title) for sid, rx, title in SUBJECTS if re.search(rx, top)), None)
    m = re.search(r'(\d{1,2})\s+(' + '|'.join(MONTHS) + r')\s+(20\d\d)', top)
    date = f'{m.group(3)}-{MONTHS[m.group(2)]:02d}-{int(m.group(1)):02d}' if m else None
    if not date:
        m = re.search(r'(\d{1,2})\.(\d{1,2})\.(20\d\d)', top)
        date = f'{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}' if m else None
    v = re.search(r'ВАРИАНТ\s*№?\s*(\d)', top, re.I)
    lvl = re.search(r'НИВО\s*([BВ]\s*1\.1|[BВ]\s*1|[BВ]\s*2)', top, re.I)
    level = lvl.group(1).replace('В', 'B').replace(' ', '') if lvl else None
    profile = 'профилирана' if re.search(r'ПРОФИЛИРАНА', top) else 'общообразователна' if re.search(r'ОБЩООБРАЗОВАТЕЛНА', top) else None
    return subj, date, int(v.group(1)) if v else None, level, profile


def split_key(text):
    """the key starts at the last 'КЛЮЧ' heading or the first key table header"""
    m = None
    for mm in re.finditer(r'КЛЮЧ С ВЕРНИТЕ ОТГОВОРИ|КЛЮЧ С ОТГОВОРИ|Въпрос\s*№?\s+Верен отговор|ВЕРНИ ОТГОВОРИ|ОТГОВОРИ И КРИТЕРИИ|Задача\s*№\s+Отговор|Въпрос\s*№?\s+Отговор|№\s+отговор\s+точки|КЛЮЧ\s*\n|ANSWER KEY|LÖSUNGS', text, re.I):
        m = m or mm
    if not m: return text, ''
    # go back to the start of a repeated МИНИСТЕРСТВО header before the key, if any
    return text[:m.start()], text[m.start():]


def parse_key(key):
    closed = {}
    # rows "1  В  1" (number, letter, points), also several columns per line and Latin A–D;
    # a number that is already known is an open task's sub-answer ("1.А.") and is ignored
    for mm in re.finditer(r'(?<![\w.])(\d{1,2})\.?[ \t]{1,40}([АБВГабвгABCDabcd])\.?(?=[ \t\n)])(?:[ \t]{1,40}(\d{1,2})(?![\d.,]))?', key):
        n = int(mm.group(1)); a = mm.group(2).upper().translate(str.maketrans('ABCD', 'АБВГ'))
        if 0 < n <= 80 and n not in closed and a in LETTERS: closed[n] = (LETTERS.index(a), int(mm.group(3)) if mm.group(3) else None)
    opens = {}
    parts = re.split(r'(?m)^\s*Задача\s*(?:№\s*)?(\d{1,2})\.?\s*[–-]?\s*', key)
    for i in range(1, len(parts) - 1, 2):
        n, body = int(parts[i]), parts[i + 1]
        pts = re.match(r'\s*(\d{1,2})\s*т', body)
        body = re.sub(r'^\s*\d{1,2}\s*т\.?\s*', '', body)
        body = re.sub(r'^\s*(т|Т)?очки\s*', '', body)
        body = '\n'.join(drop_page_numbers(body.split('\n')))
        body = re.split(r'КРИТЕРИИ ЗА ОЦЕН|МИНИСТЕРСТВО', body)[0]
        txt = re.sub(r'\n{2,}', '\n', body).strip()
        if txt and n not in opens: opens[n] = (re.sub(r'[ \t]+', ' ', txt)[:900], int(pts.group(1)) if pts else None)
    return closed, opens


def find_questions(body, first=1):
    """question blocks in order first, first+1, … : a line starting with the next expected number"""
    lines = drop_page_numbers(body.split('\n'))
    text = '\n'.join(lines)
    starts, want = [], first
    for mm in re.finditer(r'(?m)^\s{0,6}(\d{1,2})\.\s+(?=\S)', text):
        n = int(mm.group(1))
        if n == want: starts.append((n, mm.start(), mm.end())); want += 1
    blocks = []
    for i, (n, s, e) in enumerate(starts):
        end = starts[i + 1][1] if i + 1 < len(starts) else len(text)
        blocks.append((n, text[e:end], s))
    return blocks, text[:starts[0][1]] if starts else text, text


def split_options(block):
    """prompt, [А, Б, В, Г], trailing text (a passage for the next questions) — or None"""
    for letters in (LETTERS, 'ABCD', 'abcd'):
        pos, at = [], 0
        for L in letters:
            mm = re.compile(r'(?:(?<=\s)|^)' + L + r'\)\s*').search(block, at)
            if not mm: break
            pos.append(mm); at = mm.end()
        if len(pos) == 4: break
        if len(pos) == 3: kept = pos
    if len(pos) < 4:
        if len(pos) < 3 and 'kept' not in dir(): return None
        pos = pos if len(pos) == 3 else locals().get('kept')
        if not pos: return None
    prompt = block[:pos[0].start()]
    opts = []
    for i, mm in enumerate(pos):
        end = pos[i + 1].start() if i + 1 < len(pos) else len(block)
        opts.append(block[mm.end():end])
    # the last option ends at the first blank line; what follows is context for the next questions
    last = re.split(r'\n\s*\n', opts[-1], maxsplit=1)
    opts[-1] = last[0]; rest = last[1] if len(last) > 1 else ''
    # options laid out in columns ("А) x   Б) y") are already split by the letter search
    return clean(prompt), [clean(o) for o in opts], rest


LISTEN_HEAD = re.compile(r'(?m)^\s*(PROVA DI COMPRENSIONE DI TESTI ORALI|HÖRVERSTEHEN|LISTENING( COMPREHENSION)?|COMPRÉHENSION (DE L.)?ORALE|COMPRENSIÓN AUDITIVA|COMPRENSIONE (DELL.)?ASCOLTO|ASCOLTO|АУДИРОВАНИЕ|СЛУШАНЕ С РАЗБИРАНЕ)\b', re.I)
READ_HEAD = re.compile(r'(?m)^\s*(LESEVERSTEHEN|READING( COMPREHENSION)?|COMPRENSIÓN DE LECTURA|PROVA DI COMPRENSIONE DI TESTI SCRITTI|COMPRÉHENSION (DES ÉCRITS|ÉCRITE)|COMPRENSIÓN (DE )?LECTORA|COMPRENSIONE (DEL TESTO|SCRITTA)|LETTURA|ЧТЕНИЕ|ЧЕТЕНЕ С РАЗБИРАНЕ)\b', re.I)
PASSAGE_HINT = re.compile(r'Прочетете|текст|откъс|извор|документ|цитат|Read the|Lesen Sie|Lisez|Lea el|Прочитайте|Leggete|Leggi|Text|texte|texto|testo', re.I)


def build(txt_path):
    raw = norm(txt_path.read_text(encoding='utf-8', errors='replace'))
    (subj, date, variant, level, profile) = header(raw)
    if not subj or not date: return None, 'no subject/date in header'
    body, key = split_key(raw)
    closed_key, open_key = parse_key(key)
    if len(closed_key) < 5: return None, f'no readable key ({len(closed_key)} answers)'
    # listening parts of language exams: cut from the listening heading to the next part heading
    if subj[0] in ('en', 'de', 'ru', 'fr', 'es', 'itl'):
        # the listening part comes first and has no audio here: keep only what starts at the first reading heading
        rd = re.search(READ_HEAD, body)
        if not rd: return None, 'no reading part'
        body = body[rd.start():]
        body = re.split(r'Лист за учителя|LISTENING SCRIPT|TRANSKRIPT|TRANSCRIPTION', body)[0]
        li = re.search(LISTEN_HEAD, body)
        if li: body = body[:li.start()]
    sid0 = subj[0]
    nums = [int(x) for x in re.findall(r'(?m)^\s{0,6}(\d{1,2})\.\s+\S', body)]
    first = next((n for n in nums if (n in closed_key or n in open_key) and n + 1 in nums), 1)
    blocks, intro, flat = find_questions(body, first)
    # language exams: a reading text starts at "Text 2" / "Текст 1" / "Testo 3" and runs to its first question
    lang = sid0 in ('en', 'de', 'ru', 'fr', 'es', 'itl')
    sections = [m.start() for m in re.finditer(r'(?m)^\s*(Text|Texte|Текст|TEXT|Testo|Texto|Task|Aufgabe)\s*(№\s*)?\d+\.?\s*$', flat)] if lang else []
    qstarts = [b[2] for b in blocks]
    def section_text(at):
        st = max((x for x in sections if x < at), default=None)
        if st is None: return ''
        q1 = min((q for q in qstarts if q > st), default=at)
        return flat[st:q1]
    tasks, passages, skipped = [], {}, {'visual': 0, 'format': 0, 'nokey': 0}
    # the text right before the first kept question (e.g. the reading text after LESEVERSTEHEN)
    pending = re.split(r'(?i)LESEVERSTEHEN|READING COMPREHENSION|READING|COMPRÉHENSION ÉCRITE|COMPRENSIÓN LECTORA|COMPRENSIONE (DEL TESTO|SCRITTA)|ЧТЕНИЕ', intro)[-1] if first > 1 else ''
    for n, block, bstart in blocks:
        sp = split_options(block)
        if n in closed_key:
            if not sp: skipped['format'] += 1; pending = ''; continue
            prompt, opts, rest = sp
            ans, pts = closed_key[n]
            if (any(o.rstrip().endswith('?') for o in opts) or re.search(r'листа за (свободни )?отговори|запишете|попълнете|допълнете|срещу всяка', prompt, re.I)
                    or all(re.fullmatch(r'\(?\w\)?\.?', o) for o in opts if o) or re.search(r'пример\s*№|прослуша|слушате|звучащ', prompt, re.I)):
                skipped['format'] += 1; continue
            if VISUAL.search(prompt) or any(not o or len(o) > 400 for o in opts) or len(prompt) > 1600 or len(set(opts)) < len(opts):
                skipped['visual' if VISUAL.search(prompt) else 'format'] += 1
                pending = rest if PASSAGE_HINT.search(rest[:200]) else pending; continue
            if len(opts) == 3: opts = opts + [fourth_option(opts, sid0)]
            if ans >= len(opts): skipped['nokey'] += 1; continue
            t = {'id': f'q{n}', 'type': 'choice', 'points': pts or 1, 'prompt': prompt, 'options': opts, 'answer': ans}
            if opts[3] == fourth_option(opts[:3], sid0): t['added'] = [3]
            sec = section_text(bstart) if lang else ''
            if sec and len(clean(sec)) > 150:
                txt = clean_passage(sec)
                if not passages or list(passages.values())[-1]['text'] != txt: passages[f'p{len(passages) + 1}'] = {'title': 'Text', 'text': txt}
                t['passage'] = list(passages)[-1]
            # a long prompt that starts with a quotation is a source text: keep it as the passage
            elif pending and PASSAGE_HINT.search(prompt + ' ' + pending[:120]):
                pid = f'p{len(passages) + 1}'
                if not passages or list(passages.values())[-1]['text'] != clean_passage(pending):
                    passages[pid] = {'title': 'Текст', 'text': clean_passage(pending)}
                t['passage'] = list(passages)[-1]
            tasks.append(t)
            pending = rest if rest.strip() and len(clean(rest)) > 120 else pending if PASSAGE_HINT.search(prompt) else ''
        elif n in open_key:
            prompt = clean(block)
            if VISUAL.search(prompt) or len(prompt) < 12: skipped['visual'] += 1; continue
            if len(prompt) > 2500: prompt = prompt[:2500] + '…'
            ans, pts = open_key[n]
            tasks.append({'id': f'q{n}', 'type': 'open', 'points': pts or 2, 'prompt': prompt, 'answer': ans})
        else:
            skipped['nokey'] += 1
    for t in tasks: t['skill'] = topic(sid0, t['prompt'] + ' ' + ' '.join(t.get('options', [])))
    closed = [t for t in tasks if t['type'] == 'choice']
    if len(closed) < (4 if sid0 in ('en', 'de', 'ru', 'fr', 'es', 'itl') else 5): return None, f'only {len(closed)} closed questions parsed {skipped}'
    sid, title = subj
    y, mo, d = date.split('-')
    session = 'май' if mo in ('05', '06') else 'август' if mo in ('08', '09') else ''
    mid = f'dzi12-{sid}-{date}' + (f'-{level.lower().replace(".", "")}' if level else '') + (f'-v{variant}' if variant else '')
    long_date = f'{int(d)} {[k for k, v in MONTHS.items() if v == int(mo)][0]} {y}'
    ex_title = long_date + (f' · ниво {level}' if level else '') + (f' · вариант {variant}' if variant else '')
    parts = [{'title': 'Част 1 · избираем отговор', 'tasks': closed}]
    opens = [t for t in tasks if t['type'] == 'open']
    if opens: parts.append({'title': 'Част 2 · свободен отговор', 'tasks': opens})
    used = {t.get('passage') for t in tasks}
    mod = {'format': 1, 'id': mid, 'version': '1', 'lang': 'bg', 'title': f'ДЗИ · {title} · {ex_title}',
           'past': {'exam': 'dzi12', 'subj': sid, 'year': int(y), 'date': date, 'variant': variant, 'session': session, 'level': level, 'profile': profile, 'source': txt_path.stem + '.pdf'},
           'exams': [{'id': 'exam', 'title': ex_title, 'minutes': None, 'parts': parts}],
           'passages': {k: v for k, v in passages.items() if k in used}}
    return mod, f'{len(closed)} closed, {len(opens)} open, skipped {skipped}'


NONE_OF = {'en': 'None of the above', 'de': 'Keine der genannten Antworten', 'ru': 'Ни один из ответов', 'fr': 'Aucune de ces réponses',
           'es': 'Ninguna de las respuestas', 'itl': 'Nessuna delle risposte'}


def fourth_option(opts, sid):
    """the 4th option of an official three-option question: a near number when the options are numbers,
    otherwise "none of these" in the exam's language. It is never the right answer."""
    nums = []
    for o in opts:
        m = re.fullmatch(r'\$?\s*(-?\d+(?:[.,{}]+\d+)?)\s*\$?\s*([^\d$]{0,12})', o.strip())
        if not m: break
        nums.append((float(m.group(1).replace('{,}', '.').replace(',', '.')), m.group(2), o))
    if len(nums) == len(opts):
        vals = sorted(v for v, _, _ in nums); step = max(1, round((vals[-1] - vals[0]) / 3)) if vals[-1] != vals[0] else 1
        cand = vals[-1] + step
        if cand == int(cand): cand = int(cand)
        txt = str(cand).replace('.', ',')
        src = nums[0][2]
        return (src.replace(src.strip('$ ').split(' ')[0].strip('$'), txt, 1)) if src.strip() else txt
    return NONE_OF.get(sid, 'Нито един от посочените отговори')


TOPICS = {k: v for k, v in json.loads((ROOT / 'content/subjects.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}


def topic(sid, text):
    """the skill of a question: the first topic of content/subjects.json whose words match, else the last one"""
    skills = TOPICS[sid]['skills']
    best = max(skills, key=lambda sk: len(re.findall(sk['words'], text, re.I)) if sk['words'] not in ('.', '^$') else 0)
    if sid in ('en', 'de', 'ru', 'fr', 'es', 'itl'): return 'read'
    return best['id'] if re.search(best['words'], text, re.I) else skills[-1]['id']


def clean_passage(s):
    lines = [l.strip() for l in drop_page_numbers(s.split('\n'))]
    paras, cur = [], []
    for l in lines:
        if not l:
            if cur: paras.append(' '.join(cur)); cur = []
        else: cur.append(l)
    if cur: paras.append(' '.join(cur))
    return '\n\n'.join(p for p in paras if not re.match(r'^(Отговорите на задачите|Прочетете текста и изпълнете)', p))[:6000]


if __name__ == '__main__':
    src = pathlib.Path(sys.argv[1]); dry = '--dry' in sys.argv
    seen = {}
    for f in sorted(src.glob('*.txt')):
        mod, msg = build(f)
        print(f'{f.name[:58]:58} {mod["id"] if mod else "SKIP":36} {msg}')
        if not mod or dry: continue
        if mod['id'] in seen:  # the same exam twice (a copy with "(1)" in the name): keep the one with more tasks
            if sum(len(p['tasks']) for p in mod['exams'][0]['parts']) <= seen[mod['id']]: continue
        seen[mod['id']] = sum(len(p['tasks']) for p in mod['exams'][0]['parts'])
        (OUT / (mod['id'] + '.json')).write_text(json.dumps(mod, ensure_ascii=False, indent=1), encoding='utf-8')
