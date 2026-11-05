#!/usr/bin/env python3
"""Install a full past exam (written per docs/IMPORT-FULL-EXAMS.md) into content/past-exams, in the app's conventions.

usage: python3 tools/install_exam.py <module.json> [...]     (media, if any, in <dir of module>/media/<module id>/)

- subject ids of main: inf->infm, itech->it, ent->entr, ita->itl
- id: dzi12-<subj>-<YYYY-MM-DD>[-<level, no dot>][-oop]-v<n>  (main's importer scheme)
- lang 'bg' (as main's imported exams; the exam language is SUBJECTS[subj].lang), past.profile / past.level / past.source
- an official three-option question (not true/false-type) gets main's 4th option, never right, marked added: [3]
- every task of a non-math subject gets skill = topic() of tools/import_dzi.py (content/subjects.json)
- replaces a module with the same id (the earlier importer's partial ones) and says so
"""
import json, pathlib, shutil, sys, re
sys.dont_write_bytecode = True   # keep tools/__pycache__ in the repo unchanged
REPO = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / 'tools'))
from import_dzi import topic, fourth_option  # noqa: E402

SUBJ = {'inf': 'infm', 'itech': 'it', 'ent': 'entr', 'ita': 'itl'}
TF = re.compile(r'^(true|false|not given|richtig|falsch|vrai|faux|verdadero|falso|vero|верно|неверно|да|не|yes|no|правильно|неправильно|nicht im text|non mentionné|no se dice|non detto)\b', re.I)

def convert(path):
    path = pathlib.Path(path); m = json.loads(path.read_text(encoding='utf-8')); old = m['id']; p = m['past']
    subj = SUBJ.get(p['subj'], p['subj']); p['subj'] = subj
    level = p.get('level')
    track = p.pop('track', None)
    if track == 'oop' and 'profile' not in p: p['profile'] = 'общообразователна'
    if track == 'pp' and 'profile' not in p: p['profile'] = 'профилирана'
    lv = ('-' + level.lower().replace('.', '')) if level else ''
    new = f"dzi12-{subj}-{p['date']}{lv}{'-oop' if track == 'oop' else ''}-v{p.get('variant') or 1}"
    m['id'] = new; m['lang'] = 'bg'
    if isinstance(p.get('source'), list): p['source'] = ' + '.join(p['source'])
    p.pop('pages', None)
    added = tagged = 0
    for part in m['exams'][0]['parts']:
        for t in part['tasks']:
            if t['type'] == 'choice' and len(t['options']) == 3 and not any(TF.match(o.strip()) for o in t['options']) and not t.get('added'):
                extra = fourth_option(t['options'], subj)
                if extra not in t['options']: t['options'].append(extra); t['added'] = [3]; added += 1
            if subj not in ('math', 'bel'):
                t['skill'] = topic(subj, (t.get('prompt') or '') + ' ' + ' '.join(t.get('options') or [])); tagged += 1
    out = REPO / 'content/past-exams' / (new + '.json')
    existed = out.exists()
    tmp = out.with_suffix('.tmp'); tmp.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding='utf-8'); tmp.replace(out)
    src_media = path.parent / 'media' / old
    if src_media.exists():
        dst = REPO / 'content/past-exams/media' / new
        shutil.rmtree(dst, ignore_errors=True); shutil.copytree(src_media, dst)
    n = sum(len(x['tasks']) for x in m['exams'][0]['parts']); pts = sum(t.get('points', 1) for x in m['exams'][0]['parts'] for t in x['tasks'])
    print(f"{'REPLACED' if existed else 'NEW     '} {new}  ({n} tasks, {pts:g} pts, +4th option on {added})  from {old}")

if __name__ == '__main__':
    for f in sys.argv[1:]: convert(f)
