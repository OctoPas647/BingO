# Importing the rest of the ДЗИ past exams (hand-off)

**Goal:** every official ДЗИ (12th grade matura) exam in the Google Drive folder **"dzi and other"**
(folder id `1lLZ_yxWmX5wUb_J7yMlmJTwGD4qkprm-`) becomes a *complete* past exam in BingO:
every question, the official key and points, the official grading criteria, pictures, and for
language exams the listening part. Accuracy matters more than speed: students are scored against these keys.

## Where things stand (5 Nov 2026)
- **Done (49 exams):** full versions are in `content/past-exams/`. Use these as the reference:
  - `dzi12-en-2022-05-20-b1-v1.json` — language exam with listening passages and transcripts
  - `dzi12-phil-2025-08-25-v2.json` — Bulgarian-language subject: choice, multi, ДА/НЕ gaps, open tasks with rubrics
  - `dzi12-geo-2025-05-23-v2.json` + `media/dzi12-geo-2025-05-23-v2/` — pictures (maps, charts)
  - Russian 2022–2026 (almost all levels), philosophy 2020–2021, physics/geography 2025 — more examples.
- **Partial (59 exams):** made earlier by `tools/import_dzi.py`. They keep only some closed questions (no
  open tasks, no pictures, no listening). **Replace each with the full version, same id.**
- **Missing (235 exams):** not in the app yet.
- **Done in the app code:** listening player (`src/js/66c-listen.js`, server route `POST /tts` in `server/index.js`).
  A listening passage needs only `listen: true` and `transcript`; the app speaks it (Gemini TTS through BingO's
  server, else the device voice) and shows the transcript after the answer. Listening questions are kept out of training.
- **One half-done exam:** `dzi12-ru-2026-05-22-b11-v2` (Russian 22 May 2026, B1.1) — redo it; tasks q36/q37 had a wrong `rubric`.

The exact list, with the Drive file id of every PDF, is in **`docs/import-remaining.json`** and at the end of this file.
(`status`: `missing` or `partial`. `key_found` is a text search for „Ключ“/„Отговори“; check each PDF yourself.)
13 exams show `date: "?"` because their PDF text could not be read — take the date, level and variant from the cover page image.

## How to do one exam
1. Download the PDF from Drive by its id. Extract text: `pdftotext -layout file.pdf file.txt`. Whenever text is garbled
   (formulas, fractions, chemistry, tables, code indentation, music) render the page (`pdftoppm -png -r 110 -f N -l N`) and read the image.
2. Write the module as JSON (format below) into a scratch folder, pictures into `<scratch>/media/<module id>/`.
3. Install: `python3 tools/install_exam.py <scratch>/<id>.json` — it converts to the app's conventions (subject ids, id scheme,
   `lang: "bg"`, `past.profile`, a 4th option on official 3-option questions marked `added: [3]`, topic `skill` tags from
   `content/subjects.json`), copies the pictures, and prints `NEW` or `REPLACED <id>`.
4. Validate: `node tools/check.js 2>&1 | grep -E "FAIL|problems"` → must say `0 problems`.
5. Compare by hand: number of tasks = printed; every key answer = the official key, item by item; total points = official maximum
   (usually 100; language B1 is 80, some 2022 ООП exams 90); nothing lost at page breaks.

Skip: БЕЛ (all in the app); math exams already in `content/past-exams/dzi12-math-*.json`; any exam with no official key anywhere
(list it in PROGRESS.md under "Left"). Never write a key yourself.

## Module format (what install_exam.py expects)
```json
{ "format": 1, "id": "any-temporary-id", "version": "1", "lang": "en",
  "title": "ДЗИ · Английски език · ПП, ниво B1 · 20 май 2024 · вариант 1",
  "past": { "exam": "dzi12", "subj": "en", "year": 2024, "date": "2024-05-20", "variant": 1, "session": "май",
            "track": "pp", "level": "B1", "source": ["<Drive file title(s)>"] },
  "passages": { "l1": { "title": "Listening · Task One", "listen": true, "text": "<printed instruction>", "transcript": "<official transcript>" },
                "r1": { "title": "Reading · Task One", "text": "<full reading text>" } },
  "exams": [ { "id": "exam", "title": "20 май 2024 · вариант 1", "minutes": 240,
    "parts": [ { "title": "Част 1", "minutes": 60, "instructions": "...", "tasks": [ ... ] } ] } ] }
```
- `past.subj`: hist, geo, bio, chem, phys, phil, infm (информатика), it (информационни технологии), entr, art, music,
  en, de, fr, es, itl (Italian), ru, math. `track`: `pp` (профилирана) or `oop` (общообразователна); leave out for pre-2022
  exams that print neither. `level`: A2, B1, B1.1, B2, B2.1 (Latin letters). `lang`: the language the tasks are written in.
- Date, variant, track, level come from the **cover page**, not the file name. `session`: май / юни / август.
- Task `id` = `q<printed number>`; `points` = official points.
- Task types (rules: `engine/js/02-module-format.js`):
  - `choice` (`options` without letters, `answer` = 0-based index from the key); True/False/Not given and ДА/НЕ too.
  - `multi` (`answer` = list), with `"partial": true` for "pick N from the list".
  - `match` (`left`, `right` = partner of each left item in order, `extra` = unused); if scored per item, one `choice` per item instead.
  - `gaps` (`text` with [[1]] [[2]]…, `gaps: [{ "options": [...], "answer": i }]`).
  - `text` / `number` for short fixed answers (`answer` = every accepted form in the key).
  - `open` for anything a person grades: `answer` = the official answer/model solution (markdown), `rubric` =
    `[{ "text", "points" }]` from the key's criteria, summing exactly to `points`. If the key has only criteria, `answer` starts
    „Ключът дава само критерии за оценяване:“ and lists them. Short answers scored 0/1/2 by content → `open`, one rubric line per point.
  - ДА/НЕ sets: points per statement in the key → one `choice` per statement (`q24a`, `q24b`…); only a total → one `gaps` task.
- Text: markdown; math in `$…$` LaTeX (KaTeX), decimal comma `$2{,}5$`; chemistry `$\mathrm{H_2SO_4}$`; code in fenced blocks;
  a `$` that is a price → `\$` (but plain `$` inside `transcript`). Fix PDF hyphenation; otherwise keep the wording exact.
- A long text shared by several tasks → a passage (`"passage": "r1"` on each task). A printed part with several sections: the part's
  `instructions` hold the part header, each section's instructions go at the top of its passage `text`.
- **Listening:** one passage per listening text, `listen: true`, `text` = only the printed instruction, `transcript` = the official
  transcript verbatim (usually at the end of the PDF: „Текст за слушане“, Transcripts, Texte…). Never put the transcript in `text`.
  No transcript in the PDF → `"transcript": null` (the app then has Gemini write one from the questions and key).
- **Pictures:** crop from a page render (PIL) to `media/<id>/<name>.png`, ≤1200 px wide, <300 KB, and add
  `"media": [{ "type": "image", "src": "<name>.png", "alt": "<short Bulgarian description>" }]` to the task or passage.
  A picture that is part of the answer goes in `solutionMedia`. Music recordings that aren't available: keep the task and say so in the prompt.

## When a batch is done
- `node tools/check.js` → 0 problems; `python3 tools/build.py web && python3 tests/fixes.py` → all passed.
- Commit (one commit per subject is fine) and push to `main`.
- Update `PROGRESS.md`: move "More of the Drive folder…" to Done with counts; list skipped exams (no key) and listening texts with `transcript: null`.

## Summary of what is left
| Subject | Missing | Partial (replace) |
|---|---|---|
| Английски (`en`) | 42 | 3 |
| Немски (`de`) | 26 | 4 |
| Испански (`es`) | 22 | 4 |
| Френски (`fr`) | 16 | 4 |
| Биология (`bio`) | 14 | 4 |
| История (`hist`) | 14 | 4 |
| Италиански (`itl`) | 14 | 4 |
| Химия (`chem`) | 13 | 4 |
| География (`geo`) | 13 | 3 |
| Физика (`phys`) | 13 | 1 |
| Руски (`ru`) | 12 | 0 |
| Философия (`phil`) | 6 | 5 |
| Изобр. изкуство (`art`) | 6 | 4 |
| Предприемачество (`entr`) | 6 | 4 |
| Информатика (`infm`) | 7 | 3 |
| ИТ (`it`) | 6 | 4 |
| Музика (`music`) | 3 | 4 |
| ? (`?`) | 1 | 0 |
| Математика (`math`) | 1 | 0 |

## The full list

**? (`?`)**

- dzi12-?-2026-05-22-v2 — missing — `2dzi_it_v2otgovori.pdf` (1GmJhi07kYW0fe59uRu1uWEofVTQDl00B)

**Изобр. изкуство (`art`)**

- dzi12-art-2022-05-20-v1 — missing — `2dzi_izobrazitelno_izkustvo_v1.pdf` (1kZ725ageQuIrR037NE4PxdXAzBXUBWeY)
- dzi12-art-2022-08-26-v2 — missing — `2dzi_izobrazitelno izkustvo.pdf` (1W8_ObC95GCoDCLNuulyEYkDbzGDMy-YZ)
- dzi12-art-2023-05-23-v2 — partial — `2dzi_pp_izobrazitelnoizkustvo_v2_23.05.2023.pdf` (11w6fs6IPxk5MAvCC3bn0pdc38FUJ1z0C)
- dzi12-art-2023-08-25-v2 — missing — `2dzi_izbrizk_v2_25082023.pdf` (1FKyNZJUM11f34-ZFW_bztWw3TTTY_zGK)
- dzi12-art-2024-05-20-v1 — partial — `2dzi_izobrazitelnoizkustvo_v1-otgovori_20052024.pdf` (1wGfi4RhDSwigV2PfwZAxuujgXhWynPRD)
- dzi12-art-2024-08-23-v2 — partial — `izobrazitelno-izkustvo-23-avgust-2024-g.pdf` (1M3AzsgKDiYORjc6rZc9pwMzRqHTZ8STB)
- dzi12-art-2025-05-23-v2 — partial — `2dzi25_izobrazitelno_izkustvo_v2.pdf` (11xqTHqapZXDxL6FzdgIb0mEzHVuHcdEG)
- dzi12-art-2025-08-25-v2 — missing — `2dzi_izobrazitelno-izkustvo_v2.pdf` (1p3gBJXh5hsr1BvcYAjra1WNvFNzYlSin)
- dzi12-art-2026-05-22-v2 — missing — `2dzi_izobr_izk_v2otgovori.pdf` (1CEmo51ecbDM3hynIA9Cbu5rlozSvMspO)
- dzi12-art-2026-08-24-v2 — missing — `2dzi_izobrazitelno-izkustvo_v2otgovori.pdf` (1idrMVjMhthGkoSyx4y4mCVItSp3CmUPJ)

**Биология (`bio`)**

- dzi12-bio-2020-06-03-v2 — missing — `2dzi_bio_v2_3-vi-2020.pdf` (1uwF_OxmBuDkk-pYyYFGRb9sekpZ6xYHH)
- dzi12-bio-2020-06-04-v1 — missing — `3dzi_biologia_v1-04062020.pdf` (1Rj8zY24jhDYjCFbjfLly3mUits9VNOha)
- dzi12-bio-2020-08-28-v2 — missing — `2dzi_biologia_ v2-280820.pdf` (1LZFnLG2AxbfDe9OleyT-nqZNOb8RbVlJ)
- dzi12-bio-2021-05-21-v1 — missing — `2dzi_bio_v1_210521.pdf` (1341EnzRpQaNnH6mcnvrsNNtVFgpbpNDc)
- dzi12-bio-2021-05-27-v2 — missing — `3dzi_biologia_v2_03062021.pdf` (1T-xUTh_LMil6F3GmUHW6ZHZZcWBrXMmY)
- dzi12-bio-2021-08-27-v2 — missing — `2dzi_bio_270821.pdf` (1KfGcCzIiRdhLZqtxHPbu742ShVFwlSXL)
- dzi12-bio-2022-05-20-v1 — missing — `2dzi_bzo_v1.pdf` (1RyxqdHwnRnyGu6XFCCSbxq9G7ozaMlY5)
- dzi12-bio-2022-05-30-oop-v1 — missing — `oop_bzo_v1_30.05.2022.pdf` (1fqqCvf9dyUw_imlbQdDGfo0PT-QvVohj)
- dzi12-bio-2022-08-26-v2 — missing — `2dzi_bzo_26.08.2022.pdf` (1Di8iGJZTZr93EL9br8RPj7Fk23ei-YmX)
- dzi12-bio-2022-08-29-oop-v1 — missing — `3dzi_bio_29082022.pdf` (1UHIheYRCNZ5MugQdt4JT7r_2xzJELZMf)
- dzi12-bio-2023-05-23-v2 — partial — `2dzi_pp_bzo_v2_23.05.2023.pdf` (1KUwE7zZZAhYQCFvWKRR2LcbUJyVx1x4P)
- dzi12-bio-2023-08-25-v2 — missing — `2dzi_bio_v2_25082023.pdf` (1pOaFBrpuj0bICwbUoWWIlT2iqtwgGEzG)
- dzi12-bio-2024-05-20-v1 — partial — `2dzi_bzo_v1-otgovori_20052024.pdf` (1PXmFK_lW0JogiCaJuEMYLf4agP8-CF2c)
- dzi12-bio-2024-08-23-v2 — partial — `biologiya-i-zdravno-obrazovanie-23-avgust-2024-g.pdf` (1P26lhHBNOPSuBDyLyolWD1GgTNPGpYR-)
- dzi12-bio-2025-05-23-v2 — partial — `2dzi25_bzo_v2.pdf` (14aRdY73o2531vu9dbvrW2sIxiIxCwt2x)
- dzi12-bio-2025-08-25-v2 — missing — `2dzi_bzo_v2.pdf` (11MBv7VFT1F4bpVTaxgxTS-FvBebGXf3Q)
- dzi12-bio-2026-05-22-v2 — missing — `2dzi_bzo_v2otgovori(1).pdf` (1ac70xroNO__CkJBRwVrF9c3KEeNyEr29)
- dzi12-bio-2026-08-24-v2 — missing — `2dzi_bzo_v2otgovori.pdf` (1dbR2BHi-ZUrC8V7FmmcHIVJHEAcJA3v0)

**Химия (`chem`)**

- dzi12-chem-2020-06-02-v2 — missing — `3dzi_himia_v2-02062020.pdf` (1D2FV0qaB4Xmbokw6f4SrttKQSuko_HJm)
- dzi12-chem-2020-06-03-v2 — missing — `2dzi_himia_v2_3-vi-2020.pdf` (1PCEQoNPQZRx8hFoDKOJjCAk7v_ziwq5a)
- dzi12-chem-2020-08-28-v2 — missing — `2dzi_himia_v2-280820.pdf` (1hBkfCHgPiky-AwlIit9bcmj2Fv7JB0jV)
- dzi12-chem-2021-05-21-v1 — missing — `2dzi_himia_v1_210521.pdf` (1ocBWdcGaO2BWN38ttOidZeJ6JDLWELjF)
- dzi12-chem-2021-05-31-v2 — missing — `3dzi_him_v2_03062021.pdf` (1n2QaY21qEHsiIct_JCQkjTNtrHx4m_wo)
- dzi12-chem-2021-08-27-v2 — missing — `2dzi_himia_270821.pdf` (1QKTAkh8sYN-5yMWgzCnqiD3-TMfQ29Ox)
- dzi12-chem-2022-05-20-v1 — missing — `2dzi_himia_v1.pdf` (12ghe0xxdEdOkuzLjnEmAhppvrrxuq40Y)
- dzi12-chem-2022-08-26-v2 — missing — `2dzi_himia.pdf` (1b2RyVvMEixuJQiBtBHvntzVLbKXq7x2D)
- dzi12-chem-2022-08-29-oop-v1 — missing — `2dzi_himia_29082022.pdf` (1x9tHcEO8pfNFyu0ijMs3JC36iUuzYy-G)
- dzi12-chem-2023-05-23-v2 — partial — `2dzi_pp_himia_v2_23.05.2023.pdf` (1NHnanG-wn9oMbWHaKHnOsbpmIKG0rcsA)
- dzi12-chem-2023-08-25-v2 — missing — `2dzi_himia_v2_25082023.pdf` (1dXChdUAmbi_RRevH697Q21cm5ZLx6pcZ)
- dzi12-chem-2024-05-20-v1 — missing — `2dzi_himia_v1-otgovori_20052024.pdf` (1zZX5Ml8Ej6PLabxLUsxmCVMNzcsbzI-M)
- dzi12-chem-2024-08-23-v2 — missing — `hhhhhhhhhhhhhhhhhhh.pdf` (17jz7u7wFBqG1Nk5iBILm0zE3hK3vm7Ao)
- dzi12-chem-2025-05-23-v2 — partial — `2dzi25_himia_v2.pdf` (1CFB1pL-NS4VrFPrddk2SuXgm61S1Z80i)
- dzi12-chem-2025-08-25-v2 — missing — `2dzi_himia_v2.pdf` (1l4VEy5TIB2O86GZo6_8zVtsmqvFVbnZz)
- dzi12-chem-2026-05-22-v2 — partial — `2dzi_himia_v2otgovori.pdf` (1kll2C9_zLgN17X0o8SbJcJDcCCQALREG)
- dzi12-chem-2026-08-24-v2 — partial — `2dzi_him_v2otgovori.pdf` (1dMQRQb2RCUh5L5MOUEH_uoR4_NW_6jF3)

**Немски (`de`)**

- dzi12-de-2020-06-02-v2 — missing — `3dzi_nemski_v2-02062020.pdf` (1o-X4bn90WuAOP0hwQIa7sy8_qRJry3Na)
- dzi12-de-2020-06-03-v2 — missing — `2dzi_nemski_v2_3-vi-2020.pdf` (18Ro27t4smIsf-FlQVYHFO3Pk32-Kk1Fb)
- dzi12-de-2020-08-28-v2 — missing — `2dzi_nemski_v2-280820.pdf` (18DuobghUi-ltLrQHmztQGhnq38QUvW1q)
- dzi12-de-2021-05-21-v1 — missing — `2dzi_de_v1_210521.pdf` (1N0RRezMubxwgTYEAlkQ6w8pMDSCtfNJ0)
- dzi12-de-2021-05-28-v1 — missing — `3dzi_ne_v1_03062021.pdf` (1RnpyHM6LAK10hCa0AShN-XP77J4omADd)
- dzi12-de-2021-08-27-v2 — missing — `2dzi_nemski_270821.pdf` (1GrxcY4s7Gu6b90KJYLgmCM-7p1kOJpt0)
- dzi12-de-2022-05-20-b11-v1 — missing — `2dzi_pp_nemski_ezik_nivo_b1.1_v1.pdf` (1jys25ep341jpDChIlyWY1NO0eVqsBINI)
- dzi12-de-2022-05-20-b2-v1 — missing — `2dzi_pp_nemski_ezik_nivo_b2_v1.pdf` (11w4VVAQ1GMVDDDWXjExmSPIUApYBZSiK)
- dzi12-de-2022-08-26-b11-v2 — missing — `2dzi_nemski ezik nivo b1.1_26.08.22.pdf` (12GP9YFxuRouKksjYO1igg8zHHEGc06t_)
- dzi12-de-2022-08-26-b2-v2 — missing — `2dzi_nemski ezik nivo b2_26.08.22.pdf` (1OjWzfjNn6jhXcpF_kULELrMDKeavNq3o)
- dzi12-de-2023-05-23-b11-v2 — missing — `2dzi_pp_nemski ezik_nivo_В1.1_v2_23.05.23.pdf` (1XjTDlU5LwlG4onZcSI0neq_9mcPGzMki)
- dzi12-de-2023-05-23-b2-v2 — missing — `2dzi_pp_nemski ezik_nivo_В2_v2_23.05.23.pdf` (1yLLs9h9fjwlnB7wnuonMeO-GT5eiK4PP)
- dzi12-de-2023-08-25-b11-v2 — missing — `2dzi_nemski_nb1.1_v2_25082023.pdf` (10WFPqolFmkgHXBD2zobxDC_CU5_eyckf)
- dzi12-de-2023-08-25-b2-v2 — missing — `2dzi_nemski_nb2_v2_25082023.pdf` (1J7l_VU4yxsE7TOeop5-iAT1xNnlnCCwg)
- dzi12-de-2024-05-20-b11-v1 — missing — `2dzi_nemski-ezik_nivo_b1.1_v1-otgovori_20052024.pdf` (1ooU37oSV6-hswTHj5uKjCE5WVk61j1CN)
- dzi12-de-2024-05-20-b2-v1 — missing — `2dzi_nemski-ezik_nivo_b2_v1-otgovori_20052024.pdf` (1zNTKeAjChVHZCKXqZNuqEUGEgJBLlo7O)
- dzi12-de-2024-08-23-b11-v2 — partial — `nemski-ezik-nivo-v1.1-23-avgust-2024-g-1.pdf` (1Df9R-i60upaZ-v_YifkRITOFSl9V5vlK)
- dzi12-de-2024-08-23-b2-v2 — partial — `nemski-ezik-nivo-v2-23-avgust-2024-g.pdf` (1F8YE2LNCC4-BwuXKbUEebzikW9bH414w)
- dzi12-de-2025-05-23-b11-v2 — partial — `2dzi25_ne_pp_nivo_b1.1_v2.pdf` (1TGkSJYid4642SSpXISIhZUAN6rLXjM7q)
- dzi12-de-2025-05-23-b2-v2 — partial — `2dzi25_ne_pp_nivo_b2_v2.pdf` (1EsJrXIBKwR-wf4_pkAq_2PCUOREJRENj)
- dzi12-de-2025-08-25-b11-v2 — missing — `2dzi_nemski-ezik_nivo-b1.1_v2.pdf` (1Ue5Xk508AmNpa-6YxPOILqzw0tXES9eQ)
- dzi12-de-2025-08-25-b2-v2 — missing — `2dzi_nemski-ezik_nivo-b2_v2.pdf` (1O9vjQRFLTYWL2QqCiRN6u0KMjVGU6I13)
- dzi12-de-2026-05-22-b1-v2 — missing — `2dzi_ne_nivo-b1_v2otgovori.pdf` (1z0VQarHlp0v-AYTRpEFngymTHPWUHsDN)
- dzi12-de-2026-05-22-b11-v2 — missing — `2dzi_ne_nivo-b1.1_v2otgovori.pdf` (1LVpi805rQVwWvbKaQ3zzrLQRhffL9NV_)
- dzi12-de-2026-05-22-b2-v2 — missing — `2dzi_ne_nivo-b2_v2otgovori.pdf` (1-K6W-9x64VYQgt6iaOy96XOPmp6lnWPN)
- dzi12-de-2026-08-24-b1-v2 — missing — `2dzi_pp_nemski-ezik_nivo-b1_v2otgovori.pdf` (1kU1SlvEUSwu5NOtnI4O37zKr5JBMMhn7)
- dzi12-de-2026-08-24-b11-v2 — missing — `2dzi_nemski_-ezik_nivo-b1.1_v2otgovori.pdf` (1TjmEiKFTDOxtl2YrWvL7el4pEI8oMz6G)
- dzi12-de-2026-08-24-b2-v2 — missing — `2dzi_pp_nemski-ezik_nivo-b2_v2otgovori.pdf` (1CNbDSVgTY4a9CSKTuUy9xSsOIPf0A-RW)
- dzi12-de-?-a2-oop-v1 — missing — `3dzi_he-a2_oop_29082022.pdf` (12IEcmnwCXiCL_ca5b-_JYELsdjCEFdm0)
- dzi12-de-?-b1-oop-v1 — missing — `3dzi_he-b1_oop_29082022.pdf` (1yu5bhOeeSYPGMotqYlneMX0YKdGysNWL)

**Английски (`en`)**

- dzi12-en-2020-06-03-v2 — missing — `2dzi-eng_v2_3-vi-2020.pdf` (13Pv4n4Y1_IHZOaoomAADRNNkrI779y16)
- dzi12-en-2020-06-04-v1 — missing — `3dzi_angliiski_v1-04062020.pdf` (1UAQFvTndyLMN94m7AfkmAPOBCb6BCM--)
- dzi12-en-2020-08-28-v2 — missing — `2dzi_english_v2-280820.pdf` (1OrvcBPSS9845xiZXCtKDSoETc9HjB-K1)
- dzi12-en-2021-05-21-v1 — missing — `2dzi_eng_v1_21052021.pdf` (1_vomGwp2rq5cvYdltkvpF2f4il8lKAqq)
- dzi12-en-2021-05-26-v1 — missing — `3dzi_eng_v1_03062021.pdf` (1Nh32hEACeDyKM6yNrqd1V0sdB88_2wix)
- dzi12-en-2021-08-27-v2 — missing — `2dzi_eng_270821.pdf` (1SBsykbqpRxszaUUFrqUb0nYagnUHxvjs)
- dzi12-en-2021-08-30-v2 — missing — `dzi3_english_30082021.pdf` (1KolVUkrOhFp8LYEWNhGJb1ESJ_yvrRWj)
- dzi12-en-2022-05-20-b11-v1 — missing — `2dzi_pp_angliyski_ezik_nivo_b1.1_v1.pdf` (1lSEDHNvP6mF1-oX9YknZaeojHQbcEgoJ)
- dzi12-en-2022-05-20-b2-v1 — missing — `2dzi_pp_angliyski_ezik_nivo_b2_v1.pdf` (1Kne73P_j0RNQjsY12k7qxm8GEc7MBhTa)
- dzi12-en-2022-05-27-a2-oop-v2 — missing — `oop_angliyski ezik_nivo_a2_v2_27.05.22.pdf` (1C2ht1SuRsKeOzUJMyUSwmUKqTOVN-FE3)
- dzi12-en-2022-05-27-b1-oop-v2 — missing — `oop_angliyski ezik_nivo_b1_v2_27.05.22.pdf` (1jKh0nehPRA_bQTtUwCaQKB5nBGKtCBm6)
- dzi12-en-2022-05-27-b11-v1 — missing — `pp_angliyski ezik_nivo b1.1_v1.pdf` (1ZuR0gWk7LWvSXUC9weNH81tMaq3XreIE)
- dzi12-en-2022-05-27-b11-oop-v2 — missing — `oop_angliyski ezik_nivo_b1.1_v2_27.05.22.pdf` (1RUZKlIL91kgWHjs8HVYbCWIGkD14YCnE)
- dzi12-en-2022-05-27-b2-v1 — missing — `pp_angliyski ezik_nivo b2_v1.pdf` (15CkAL18J_IfPiNv_uJQA-1GarriAL2HM)
- dzi12-en-2022-05-27-b21-oop-v2 — missing — `oop_angliyski ezik_nivo_b2.1_v2_27.05.22.pdf` (12mmOI8RkrEQZqwlsSR9P_XYd1YjsBSmP)
- dzi12-en-2022-08-26-b1-v2 — missing — `2dzi_angliyski ezik_nivo b1_26.08.22.pdf` (1d5et_j2neFZ0Fgxb-pBJvs_NAnvy0W4E)
- dzi12-en-2022-08-26-b11-v2 — missing — `2dzi_angliyski ezik_nivo b1.1_26.08.22.pdf` (1P4lkzZjcvlreMx1nyoMEvKEjG-eG2CR2)
- dzi12-en-2022-08-26-b2-v2 — missing — `2dzi_angliyski ezik nivo b2_26.08.22.pdf` (1RWy734HY-0cFfNbpU_9mnQsEA-dTWNKr)
- dzi12-en-2023-05-23-b1-v2 — missing — `2dzi_pp_angliyski ezik_nivo_b1_v2_23.05.2023.pdf` (1cn9vkvuQczQrBRjgPOpMkG6LmMFHueMC)
- dzi12-en-2023-05-23-b11-v2 — missing — `2dzi_pp_angliyski ezik_nivo_b1.1_v2_23.05.2023.pdf` (1bfg_ljK7V9_AkSi7Ub9WAZfEjlP_HKFO)
- dzi12-en-2023-05-23-b2-v2 — missing — `2dzi_pp_angliyski ezik_nivo_b2_v2_23.05.2023.pdf` (1DIf-HqjI_s3lrfkshku8qCCbSgyJuaag)
- dzi12-en-2023-08-25-b1-v2 — missing — `2dzi_eng_nb1_v2_25082023.pdf` (19q1b0EJ3ijwhUH1saV22IeDwfBm_KPAY)
- dzi12-en-2023-08-25-b11-v2 — missing — `2dzi_eng_nb1.1_v2_25082023.pdf` (1xxIaNGdy6TtCH023Lt2kCXJQEMlnHOwr)
- dzi12-en-2023-08-25-b2-v2 — missing — `2dzi_eng_nb2_v2_25082023.pdf` (1JyFyCryWxc11LVK4BHqDIiS7_GTXX1F1)
- dzi12-en-2024-05-20-b1-v1 — missing — `2dzi_angliiski-ezik_nivo_b1_v1-otgovori_20052024.pdf` (14bjggTCdKJWIvipZxzF-uy9MmxY3IsSg)
- dzi12-en-2024-05-20-b11-v1 — missing — `2dzi_angliiski-ezik_nivo_b1.1_v1-otgovori_20052024.pdf` (1KlASDPRlvE6r1r42Y2NdhvdZExsxEfHz)
- dzi12-en-2024-05-20-b2-v1 — missing — `2dzi_angliiski-ezik_nivo_b2_v1-otgovori_20052024.pdf` (17041ToPrIhxHKZ7Kn2MRZ9VVZwq9CrIb)
- dzi12-en-2024-08-23-b1-v2 — missing — `anglijski-ezik-nivo-v1-23-avgust-2024-g.pdf` (1mQiBBtqKQs8OpoImpevjZvnMFRZK7owf)
- dzi12-en-2024-08-23-b11-v2 — missing — `anglijski-ezik-nivo-v1.1-23-avgust-2024-g.pdf` (1FhUS8lZZAW_cqEKO5onoqTSv3E4zXYfB)
- dzi12-en-2025-05-23-b1-v2 — partial — `2dzi25_ae_pp_nivo_b1_v2.pdf` (1kFndNrm3ywWAtWUKfqBqmvdcWiiG3ZOX)
- dzi12-en-2025-05-23-b11-v2 — partial — `2dzi25_ae_pp_nivo_b1.1_v2.pdf` (1-gGNiQALDVanf4j5p_2ae7kHDrK9_X_k)
- dzi12-en-2025-05-23-b2-v2 — partial — `2dzi25_ae_pp_nivo_b2_v2.pdf` (1hxlXgyT3ZwW8HL9V1ix5qj-8PtOTHkDR)
- dzi12-en-2025-08-25-b1-v2 — missing — `2dzi_angliyski-ezik_nivo-b1_v2.pdf` (1ON3vF7OhAkCbl4l_PQUv_RfuB697ttQw)
- dzi12-en-2025-08-25-b11-v2 — missing — `2dzi_angliyski-ezik_nivo-b1.1_v2.pdf` (1QdCTb_fnvMlDGwJ9D9aMNMW_9JM6woOl)
- dzi12-en-2025-08-25-b2-v2 — missing — `2dzi_angliyski-ezik_nivo-b2_v2.pdf` (1jsn6I6XMogRH1VLx5p66_Xf513f9TXNH)
- dzi12-en-2026-05-22-b1-v2 — missing — `2dzi_ae_nivo-b1_v2otgovori.pdf` (1HVWJ8gX9vyZt5-esFuUXul5VP5yCB95N)
- dzi12-en-2026-05-22-b11-v2 — missing — `2dzi_ae_nivo-b1.1_v2otgovori.pdf` (1zeDOPDRjd63ZEzxSgSVYQk-XFjXNDnF3)
- dzi12-en-2026-05-22-b2-v2 — missing — `2dzi_ae_nivo-b2_v2otgovori.pdf` (1woujIxuLdhC7eleGIv6lM5aDtNzgEpn0)
- dzi12-en-2026-08-24-b1-v2 — missing — `2dzi_pp_angliiski-ezik_nivo-b1_v2otgovori.pdf` (1CsANKBAKvTXehIvIoKTHfIu9fgdZGkLN)
- dzi12-en-2026-08-24-b11-v2 — missing — `2dzi_pp_angliyski-ezik_nivo-b1.1_v2otgoovori.pdf` (1r3MeLsucoApTmvrZiYqG5J17_XbtCW68)
- dzi12-en-2026-08-24-b2-v2 — missing — `2dzi_pp_angliiski-ezik_nivo-b2_v2otgovori.pdf` (1PV1w4MKgjB7zsw7GGUpOX71Wz3XRIEvs)
- dzi12-en-?-a2-oop-v1 — missing — `3dzi_ae-a2_oop_29082022.pdf` (1_IrLYvvUEO7HDhfDKx8OVEv4IlTKd7OG)
- dzi12-en-?-b1-oop-v1 — missing — `3dzi_ae-b1_oop_29082022.pdf` (1wxS8ocQ7SdUcrV8dI42lJBj-3Zmo3qN3)
- dzi12-en-?-b11-oop-v1 — missing — `3dzi_ae-b1.1_oop_29082022.pdf` (1jUQ2Mvsw_IuzqIx0m4VL5fvMo05ahSP2)
- dzi12-en-?-b21-oop-v1 — missing — `3dzi_ae-b2.1_oop_29082022.pdf` (1p_DvlNVYDFINdErUkRVemf8X8FvM2y3b)

**Предприемачество (`entr`)**

- dzi12-entr-2022-05-20-v1 — missing — `2dzi_predpriemachestvo_v1.pdf` (1XZyf_O_aB_sdnikr1wLs4-E3FJykGCYW)
- dzi12-entr-2022-08-26-v2 — missing — `2dzi_predpriemachestvo.pdf` (14bjeHF3Wc08lMelm_LonZoBD_nBR6g0G)
- dzi12-entr-2023-05-23-v2 — missing — `2dzi_pp_predpriemachestvo_v2_23.05.2023.pdf` (1G9GSqq9wI_eA1BFjSTqM22d57rNOQ6mg)
- dzi12-entr-2023-08-25-v2 — missing — `2dzi_predpriemachestvo_v2_25082023.pdf` (1tZwHHe-YpL_40fHv3j9SnCeuX-2Rcb0z)
- dzi12-entr-2024-05-20-v1 — partial — `2dzi_predpriemachestvo_v1-otgovori_20052024.pdf` (1hYXjINX0BFe46euFxkBlGubfcgM6lvZa)
- dzi12-entr-2024-08-23-v2 — partial — `predpriemachestvo-23-avgust-2024-g.pdf` (1XB3kfgd2PHGJAhz62QGmzx37lrHweBO2)
- dzi12-entr-2025-05-23-v2 — partial — `2dzi25_predpriemachestvo_v2.pdf` (1djK9D6jq1qqeBSig7PsaYBEtz5QoDO7o)
- dzi12-entr-2025-08-25-v2 — missing — `2dzi_predpriemachestvo_v2.pdf` (18kJGV0FQFjWG49no4qph5ogyych_VYJc)
- dzi12-entr-2026-05-22-v2 — missing — `2dzi_predpriemachestvo_v2otgovori(1).pdf` (1RmGubYUmoLLa1wb8zDUyV1WaRSZ67Guc)
- dzi12-entr-2026-08-24-v2 — partial — `2dzi_predpriemachestvo_v2otgovori.pdf` (1s-q_dwoHPM3VYNsJ-SgKQZRz3xCGYiYJ)

**Испански (`es`)**

- dzi12-es-2020-06-02-v2 — missing — `3dzi-isp_v2-02062020.pdf` (1QhHcwCags896ec86rYHHuZp3juaCerY2)
- dzi12-es-2020-06-03-v2 — missing — `2dzi_ispanski_v2_3-vi-2020.pdf` (15PqXEA5Of76Cxe19yySUapZNrM8RFM50)
- dzi12-es-2020-08-28-v2 — missing — `2dzi-ispanski-v2-280820.pdf` (1JaPgKDVm_qA0tG8uy9UW1f_ijOi_woTA)
- dzi12-es-2021-05-21-v1 — missing — `2dzi_ispanski_v1_210521.pdf` (1s_9XF1ePWZQxELA28jU5tn-UPMChI83T)
- dzi12-es-2021-05-28-v1 — missing — `3dzi_ispanski_vv1_03062021.pdf` (1jfi6QkR-znSozjkvMUWt7dKMrrQEtHca)
- dzi12-es-2021-08-30-v2 — missing — `dzi3_ispanski_30082021.pdf` (1f4xFfAwFEdEXSV6sE_1MDcQaeJYi90Hi)
- dzi12-es-2022-05-20-b11-v1 — missing — `2dzi_pp_ispanski_ezik_nivo_b1.1_v1.pdf` (120VAbsaloeiSNofH1BnWvWsiGuxRn804)
- dzi12-es-2022-05-20-b2-v1 — missing — `2dzi_pp_ispanski_ezik_nivo_b2_v1.pdf` (18W3giZiwoiiy-fI04G48L6bliTjyz7QC)
- dzi12-es-2022-08-26-b11-v2 — missing — `2dzi_ispanski ezik nivo b1.1_26.08.22.pdf` (1c8Ov4R5b7srawCZHS-T2NpI0B1gTK-EF)
- dzi12-es-2022-08-26-b2-v2 — missing — `2dzi_ispanski ezik nivo b2_26.08.22.pdf` (1Xni3WrVVfF6mlX33FtebEboLEG9K5gbA)
- dzi12-es-2023-05-23-b11-v2 — missing — `2dzi_pp_ispanski ezik_nivo b1.1_v2_23.05.2023.pdf` (1Al9lhJyphjitpxVRfAf3EwRqhtPjBO3G)
- dzi12-es-2023-05-23-b2-v2 — missing — `2dzi_pp_ispanski ezik_nivo_b2_v2_23.05.2023.pdf` (1ZnnwYiUKt3jRO_6Scr3_9U76T_8W48Ym)
- dzi12-es-2023-08-25-b11-v2 — missing — `2dzi_ispe_nb1.1_v2_25082023.pdf` (10mW1vYUmY2pBvJSdV7_gJPKsdQPqC4s1)
- dzi12-es-2023-08-25-b2-v2 — missing — `2dzi_ispe_nb2_v2_25082023.pdf` (1aexzSR9D6UD9bRqntlfupp-HxOQ3HwH4)
- dzi12-es-2024-05-20-b11-v1 — missing — `2dzi_ispanski-ezik_nivo_b1.1_v1-otgovori_20052024.pdf` (17USvnxj-oLXkqL1KzYlqvxm1g8BFilv4)
- dzi12-es-2024-05-20-b2-v1 — missing — `2dzi_ispanski-ezik_nivo_b2_v1-otgovori_20052024.pdf` (1lZOjweRWFphwSD3faqApFEMoGFv2GJs-)
- dzi12-es-2024-08-23-b11-v2 — partial — `ispanski-ezik-nivo-v1.1-23-avgust-2024-g.pdf` (1nnP4KPwZgWDRQdCFMclSJMUd9MqV7R0k)
- dzi12-es-2024-08-23-b2-v2 — partial — `ispanski-ezik-nivo-v2-23-avgust-2024-g.pdf` (1lmySlz0Nxu5aYtoVMYs9n4FmGsa_IgSL)
- dzi12-es-2025-05-23-b11-v2 — partial — `2dzi25_isp_e_pp_nivo_b1.1_v2.pdf` (1jftXNuoKhZVogUv1vTiQFZOdRL6QG59v)
- dzi12-es-2025-05-23-b2-v2 — partial — `2dzi25_isp_e_pp_nivo_b2_v2.pdf` (12ytZYCjRQIznzrdNK6DK6FpKXyIJPFaq)
- dzi12-es-2025-08-25-b11-v2 — missing — `2dzi_ispanski-ezik_nivo-b1.1_v2.pdf` (1LvSGbNP9tq1mRDIETLG5mwCRHPx4jLH-)
- dzi12-es-2026-05-22-b1-v2 — missing — `2dzi_ispe_nivo-b1_v2otgovori.pdf` (1GrtFMQrbi3L56U-rDEIo3aDBIDolqlKw)
- dzi12-es-2026-05-22-b11-v2 — missing — `2dzi_ispe_nivo-b1.1_v2otgovori.pdf` (12nhWlz_GZs0I2_XvUBQWhOFE_Ni_t7qj)
- dzi12-es-2026-05-22-b2-v2 — missing — `2dzi_ispe_nivo-b2_v2otgovori.pdf` (1zUPwG5BIt4cDjirmf4DjZDeh5K_bnAe9)
- dzi12-es-2026-08-24-b11-v2 — missing — `2dzi_pp_ispanski-ezik_nivo-b1.1_v2otgovori.pdf` (1su8AflgW48Ox7OPLY5vSW6pnNtmVIAB9)
- dzi12-es-2026-08-24-b2-v2 — missing — `2dzi_pp_ispanski-ezik_nivo_b2_v2otgovori.pdf` (1JO3JIne9Ix26OvUSyGDLh7BlS9iTC_CY)

**Френски (`fr`)**

- dzi12-fr-2020-06-03-v2 — missing — `2dzi_frenski _v2_3-vi-2020.pdf` (19Rm1Kp8WGyeRtuPYOEjKGfK6vsXWOdWX)
- dzi12-fr-2020-08-28-v2 — missing — `2dzi-frenski-v2-280820.pdf` (10S1XChzyW3JeKFBZPG5uV-LSZIzHLrXr)
- dzi12-fr-2021-08-27-v2 — missing — `2dzi_frenski_270821.pdf` (1oPGk-rGxPX7FooJoDGd3ilLUs3UaRo2Z)
- dzi12-fr-2022-05-20-b11-v1 — missing — `2dzi_pp_frenski_ezik_nivo_b1.1_v1.pdf` (1tNanoFihinOtuV0sTfZ4sCZe0LXnNwT0)
- dzi12-fr-2022-05-20-b2-v1 — missing — `2dzi_pp_frenski ezik_nivo_b2_v1.pdf` (1d4fGIt0HOkz77Q06tW7xlsebuT92H6ox)
- dzi12-fr-2022-08-26-b2-v2 — missing — `2dzi_frenski ezik nivo b2_26.08.2022.pdf` (1U1w8F4Le3eVye6uM4MU05JcsSgWOSM_1)
- dzi12-fr-2023-05-23-b11-v2 — missing — `2dzi_pp_frenski ezik_nivo В1.1_v2_23.05.23.pdf` (13ij7qmZycumthznZ0D15-J0nm9nHxeKz)
- dzi12-fr-2023-05-23-b2-v2 — missing — `2dzi_pp_frenski ezik_nivo_В2_v2_23.05.23.pdf` (1sXmIcfSGWkkTwaTEhvzCFzeXYIQWldcl)
- dzi12-fr-2023-08-25-b2-v2 — missing — `2dzi_fre_nb2_v2_25082023.pdf` (1ymzu1up7hdTVqyVhuvewwSX7DEmHLktE)
- dzi12-fr-2024-05-20-b2-v1 — missing — `2dzi_frenski-ezik_nivo_b2_v1-otgovori_20052024.pdf` (1KislkIMUSuCo7vLB9F3GO75z2ljP7uW_)
- dzi12-fr-2024-08-23-b11-v2 — partial — `frenski-ezik-nivo-v1.1-23-avgust-2024-g.pdf` (11GnKIWarPM-3aeWbu9I0xgW4uB1xMWSj)
- dzi12-fr-2024-08-23-b2-v2 — partial — `frenski-ezik-nivo-v2-23-avgust-2024-g.pdf` (1T16978Mhh9RI7LFgsMHGz5PvQxD4IENp)
- dzi12-fr-2025-05-23-b11-v2 — partial — `2dzi25_fe_pp_nivo_b1.1_v2.pdf` (1imzhAnVS2xH1CWjwD_krbL81_6JEEAm5)
- dzi12-fr-2025-05-23-b2-v2 — partial — `2dzi25_fe_pp_nivo_b2_v2.pdf` (1AtOmt7QEOOhbfc7X5pl7AipYLn0Sg962)
- dzi12-fr-2026-05-22-b1-v2 — missing — `2dzi_fe_nivo-b1_v2otgovori.pdf` (1H8zPPwin1yRAh-P41NGxQZWLPzrw6ovf)
- dzi12-fr-2026-05-22-b11-v2 — missing — `2dzi_fe_nivo-b1.1_v2otgovori.pdf` (1yA-yhBMLaj9NbdXz5O0NPi1co1QRRCvV)
- dzi12-fr-2026-05-22-b2-v2 — missing — `2dzi_fe_nivo-b2_v2otgovorite.pdf` (1UoexXAFcJji6r_SgL2u9vpmi354XDpWy)
- dzi12-fr-2026-08-24-b2-v2 — missing — `2dzi_pp_frenski-ezik_nivo-b2_v2otgovori.pdf` (1yUkbH0rllEQPze1tPQL9IH3AvuzI2gmD)
- dzi12-fr-?-v1 — missing — `2dzi-frenski-v1_210521.pdf` (1k_H7U7ZAQTT2OTC6CFiZa-M_aVwxyZIp), `3dzi-frenski-v1_03062021.pdf` (1QGoR2fKFfTQXk1DKfUs7zB409HVdbARh)
- dzi12-fr-?-v2 — missing — `3dzi_frenski_v2-02062020.pdf` (1husWB_SZzN2y7vjqkOuiTOzwowjD37At)

**География (`geo`)**

- dzi12-geo-2020-06-02-v2 — missing — `3dzi_geografia_v2-02062020.pdf` (1P2ATKusw4VjF1V1oz3pOL7rhXjObgpzn)
- dzi12-geo-2020-06-03-v2 — missing — `2dzi_geo_v2_3-vi-2020.pdf` (1ycPOJ5UeyO3w6XZiFMZqFNSBnxo6vXwB)
- dzi12-geo-2020-08-28-v2 — missing — `2dzi_geografia_v2-280820.pdf` (1no-K_CvhtqOgNFPvbIYIaq_WHN2CToB7)
- dzi12-geo-2021-05-21-v1 — missing — `2dzi_geography_v1_210521.pdf` (1Xz1Q-YwH4NsvWhUx1pxeTwxk2qiDO8PT)
- dzi12-geo-2021-05-27-v2 — missing — `3dzi_geo_v2_03062021.pdf` (1P1Wwvh-XQXv8Parl-8cB5WEYjBJMWPfP)
- dzi12-geo-2021-08-27-v2 — missing — `2dzi_geo_270821.pdf` (1DbTH-Kce0KHPsVyi3wiaP-wrtR5_zCRx)
- dzi12-geo-2022-05-20-v1 — missing — `2dzi_geography_v1.pdf` (12EtvQ35knczAKnXpauEwt0s7TJiM9X6J)
- dzi12-geo-2022-05-27-oop-v2 — missing — `oop_geography_27052022.pdf` (1hz_elxZXz6wWegKyy-sKNXkh5O9N3unI)
- dzi12-geo-2022-08-26-v2 — missing — `2dzi_geograpfy.pdf` (1NobNTF82MwjjDJmXLsPHjVY8HSCYlBla)
- dzi12-geo-2022-08-29-oop-v1 — missing — `3dzi_geo_29082022.pdf` (1jUykfr-lCo5RBSpjgAi3Fo8ExMI_Xop4)
- dzi12-geo-2023-05-23-v2 — missing — `2dzi_pp_geograpfy_v2_23.05.2023.pdf` (1vKotMt8Kd0yNAB4UV-RaWrFY3bf8nbqn)
- dzi12-geo-2023-08-25-v2 — missing — `2dzi_geo_v2_25082023.pdf` (1B_qaFSbzYy44y_zqGWwFPTylSzPpDNdm)
- dzi12-geo-2024-05-20-v1 — partial — `2dzi_geograpfy_v1-otgovori_20052024.pdf` (1Oj6UdvN6F_xz1L0fNNCkc7WKSTm62da4)
- dzi12-geo-2024-08-23-v2 — partial — `geografiya-i-ikonomika-23-avgust-2024-g.pdf` (1Zf7wklT6uLBniyy9LgufF3K-dLu34dRE)
- dzi12-geo-2026-05-22-v2 — missing — `2dzi_geography_v2otgovori.pdf` (1xfrBFj-g42W5vwaNmT1a7YUaSVjEtXca)
- dzi12-geo-2026-08-24-v2 — partial — `2dzi_pp_geography_v2otgovori.pdf` (1j3Cvn1JkcVLC88FJsEHWxMf_WZx9G8K5)

**История (`hist`)**

- dzi12-hist-2020-06-03-v2 — missing — `2dzi-istoria_v2_3-vi-2020.pdf` (1OTR-BrnxizhLS8JmaURpAPdWi5O9110J)
- dzi12-hist-2020-06-04-v1 — missing — `3zdi_istoria_v1-04062020.pdf` (12rZbvJtUeHB1QJa0MiFE0v-DlezaDpeM)
- dzi12-hist-2020-08-28-v2 — missing — `2dzi-istoria-v2-280820.pdf` (1EJzJAU647K345dTebYJjqpkzXQBqoMMq)
- dzi12-hist-2021-05-21-v1 — missing — `2dzi_istoria_v1_210521.pdf` (188OTcUUWZAPxjrg42fo4uN07ylkuBsA8)
- dzi12-hist-2021-05-31-v2 — missing — `3dzi-istoria-v2_03062021.pdf` (10GIY6ic5LUizS7riJ2Tr_Yqz36y27nue)
- dzi12-hist-2021-08-27-v2 — missing — `2dzi_istoria_270821.pdf` (1N7BhY8puSu9ybhCQRHOjPV-EYfN6ezeL)
- dzi12-hist-2022-05-20-v1 — missing — `2dzi_history_v1.pdf` (1XwV9MBBAO48pDCKz7Vw5iGp5tinS-xlR)
- dzi12-hist-2022-05-26-oop-v1 — missing — `oop_history_v1_26052022.pdf` (1ZH3iu7jmJWYCkLQiF33X6l5t1RRWKgQ6)
- dzi12-hist-2022-08-26-v2 — missing — `2dzi_history.pdf` (1PxbJFfKcS-_AuZLv23tXXmcY4zkW8I75)
- dzi12-hist-2022-08-29-oop-v1 — missing — `3dzi_istoria_29082022.pdf` (1DdN3X33hMaDP0mi2HTaHemt9ZRXAt9tG)
- dzi12-hist-2023-05-23-v2 — missing — `2dzi_pp_history_v2_23.05.2023.pdf` (1xX4hm6E_jPycS9ue9D1z_igOcWmAodD9)
- dzi12-hist-2023-08-25-v2 — missing — `2dzi_history_v2_25082023.pdf` (1C0zCkuk_oRLTpFpQ3lzL0sB-oV_A8xO8)
- dzi12-hist-2024-05-20-v1 — partial — `2dzi_history_v1-otgovori_20052024.pdf` (1OzUtW2X0ciKNFxb9t4i66BFALKtTTAXy)
- dzi12-hist-2024-08-23-v2 — partial — `istoriya-i-czivilizaczii-23-avgust-2024-g.pdf` (1g_wcjclxBuhJ0IernfzXGFWEOo8gJ4tw)
- dzi12-hist-2025-05-23-v2 — partial — `2dzi25_history_v2.pdf` (1ldGQWzwRvb-l9rZHpYHzGSl-unZ_caoa)
- dzi12-hist-2025-08-25-v2 — missing — `2dzi_history_v2.pdf` (1epsFacxEIEgRdtA1ru2edYAqD38rpZ-F)
- dzi12-hist-2026-05-22-v2 — missing — `2dzi_history_v2otgovori.pdf` (1SYKOeu3RGhA5ggGvFK62Yp27PRHQueFV)
- dzi12-hist-2026-08-24-v2 — partial — `2dzi_pp_history_v2otgovori.pdf` (1NnCosFgrgzAD-DzMsUBZ5A550A5gKPjb)

**Информатика (`infm`)**

- dzi12-infm-2022-05-20-v1 — missing — `2dzi_informatika_v1.pdf` (1QK57zVQPElwKndOuMOLM1WQTp7CIgTXL)
- dzi12-infm-2022-08-26-v2 — missing — `2dzi_informatika.pdf` (1pWPEpXvwv1iqBcBYDVMYEsFkZvjovHx3)
- dzi12-infm-2023-05-23-v2 — missing — `2dzi_pp_informatika_v2_23.05.2023.pdf` (1vQXSm0pzR1J9HhOqF_pudOpRd4prcxQg)
- dzi12-infm-2023-08-25-v2 — missing — `2dzi_informatika_v2_25082023.pdf` (1CZOUyvkcpfJ_M7WGQMAgEn1t0UzAXaLw)
- dzi12-infm-2024-05-20-v1 — missing — `2dzi_informatika_v1_20052024.pdf` (1C7kVpJzAVNMJx6QtI4fL87bcW4IA0zwl)
- dzi12-infm-2024-08-23-v2 — partial — `informatika-23-avgust-2024-g.pdf` (1t1h5_ytvtMi-fhwQfqV3ad_rI_EvtJjm)
- dzi12-infm-2025-05-23-v2 — partial — `2dzi25_informatika_v2.pdf` (1JoKcvsZ7k5FxPeZM5hCNFl39BDGniqgc)
- dzi12-infm-2025-08-25-v2 — missing — `2dzi_informatika_v2.pdf` (162l5UDvjfKnxQSdwYPjlweQFy39UIr8f)
- dzi12-infm-2026-05-22-v2 — missing — `2dzi_informatika_v2otgovori.pdf` (1veOJWTErfDbi5TMP9RuHH_lBAbERBzym)
- dzi12-infm-2026-08-24-v2 — partial — `2dzi_pp_informatika_v2otgovori.pdf` (1ckfqZHkZodMIlbS_XUk7EMcTEzVVE3-R)

**ИТ (`it`)**

- dzi12-it-2022-05-20-v1 — missing — `2dzi_informacionni_tehnologii_v1.pdf` (1HuARNu44AGyT54EqJbq-TfRx0ROEqt-z)
- dzi12-it-2022-06-01-v1 — missing — `pp_inf_tehnologii.pdf` (1z4vcf8-TfFu7Nc1IvHt4mqYFrFd_I72Z)
- dzi12-it-2022-08-26-v2 — missing — `2dzi_informacionnitehnologii.pdf` (1gQGv-ywYDBLOigJjLKImDJWBdh8sWd9-)
- dzi12-it-2023-05-23-v2 — missing — `2dzi_pp_informacionnitehnologii_v2_23.05.2023.pdf` (1AY_9vgEdWt70uAMqbapGt5vJYcpM2tIG)
- dzi12-it-2023-08-25-v2 — missing — `2dzi_it_v2_27082023.pdf` (1_-6AYmgJTfWjTG1bnfsNRdIjCmCqtwAo)
- dzi12-it-2024-05-20-v1 — partial — `2dzi_it_v1-otgovori_20052024-1.pdf` (1z5f26im4VuKpvP9B8MWO-Ksrr_62oRI7)
- dzi12-it-2024-08-23-v2 — partial — `informaczionni-tehnologii-23-avgust-2024-g.pdf` (16exMCRMtQzSGsmYxiA-4wKt8xHcT54X8)
- dzi12-it-2025-05-23-v2 — partial — `2dzi25_it_v2.pdf` (1kylq-iPBlf39tFTQfpoMvAdHubOr4KZL)
- dzi12-it-2025-08-25-v2 — missing — `2dzi_it_v2.pdf` (1iecACU8SOezTAsqx5uizcoy_YxgboAMx)
- dzi12-it-2026-08-24-v2 — partial — `2dzi_pp_it_v2otgovori.pdf` (1MJVKbIP4sU3p-FR6X0W64s8EqBkZxr62)

**Италиански (`itl`)**

- dzi12-itl-2020-08-28-v2 — missing — `2dzi_italianski_v2-280820.pdf` (1ciNItS7AUva3F8GqQ87iaT9_mcPppjNG)
- dzi12-itl-2021-05-21-v1 — missing — `2dzi_italianski_v1_210521.pdf` (18qb1iMD1ozai2RWPtiuk7kGtXh_f0TVA)
- dzi12-itl-2021-05-28-v1 — missing — `3dzi_italianski_v1_03062021.pdf` (1OwTHzFnrfNOEcp-eFW4Om1Sx0Uz9kL30)
- dzi12-itl-2021-08-27-v2 — missing — `2dzi_ital_270821.pdf` (10JaEPcqnqjWcbTUoM3kIIan-W714xaDE)
- dzi12-itl-2022-05-20-b11-v1 — missing — `2dzi_pp_italianski_ezik_nivo_b1.1_v1.pdf` (1j99n06zUUIZGRnRsLZPtdGDsxy2QOs9u)
- dzi12-itl-2022-05-20-b2-v1 — missing — `2dzi_pp_italianski_ezik_nivo_b2_v1.pdf` (14eRdkyikIsnZrjlk-DPSMJrpayyRzpXm)
- dzi12-itl-2023-05-23-b11-v2 — missing — `2dzi_pp_italianski ezik_nivo_b1.1_v2_23.05.2023.pdf` (1Lvf8O0RJ0MV23qlEIKcKz8d9PSX5w_kH)
- dzi12-itl-2023-05-23-b2-v2 — missing — `2dzi_pp_italianski ezik_nivo_b2_v2_23.05.2023.pdf` (1Az-ctjBwoZU9LERYtlzKeWQgTrjJnxxy)
- dzi12-itl-2023-08-25-b2-v2 — missing — `2dzi_itale_nb2_v2_25082023.pdf` (1S1SNd5rGjm5u0vw_lTNdXzBbUjENnNWQ)
- dzi12-itl-2024-05-20-b11-v1 — missing — `2dzi_italianski-ezik_nivo_b1.1_v1-otgovori_20052024.pdf` (1R0WR8J5Mk5rtnaMx1frxXykM38BprVBy)
- dzi12-itl-2024-05-20-b2-v1 — missing — `2dzi_italianski-ezik_nivo_b2_v1-otgovori_20052024.pdf` (1qHawp0503tvo6cbpitAX5SaC9kH2jpPb)
- dzi12-itl-2024-08-23-b2-v2 — partial — `italianski-ezik-nivo-v2-23-avgust-2024-g.pdf` (1q0E6ITp68UXTLmOf-X2mEtXlc-Tsd2sk)
- dzi12-itl-2025-05-23-b11-v2 — partial — `2dzi25_ital_e_pp_nivo_b1.1_v2.pdf` (1e83AVMbCaAjdedcj1dgz710BDykP_T6t)
- dzi12-itl-2025-05-23-b2-v2 — partial — `2dzi25_ital_e_pp_nivo_b2_v2.pdf` (1CBzYoMzCTEdKZ6J0YROM2O1Z6JLIoC7S)
- dzi12-itl-2025-08-25-b2-v2 — missing — `2dzi_italianski-ezik_nivo-b2_v2.pdf` (18f58erT2CsoCMkb0lLPU6lQhuvO7hbxf)
- dzi12-itl-2026-05-22-b11-v2 — missing — `2dzi_ite_nivo-b1.1_v2otgovori.pdf` (1pE-nNByrqsGg9yELPyFgaPrS7shJX6z1)
- dzi12-itl-2026-05-22-b2-v2 — partial — `2dzi_ite_nivo-b2_v2otgovori.pdf` (1Q1i3Q4XZcl5bV439w5Z_dCsACHTDIEZ4)
- dzi12-itl-?-v2 — missing — `2dzi_italianski_v2_3-vi-2020.pdf` (1r6rC4UNFJAkp6Snh67Bjh-67iT6TNqtk), `3dzi-ital_v2-02062020.pdf` (1DNp01wNrNE6_lgjQcnDH1gnnmCv0tP0s)

**Математика (`math`)**

- dzi12-math-2022-08-29-oop-v1 — missing — `3dzi_math_29082022.pdf` (17EkpvJqFtus_12zxt1SjbiX-sLQ83bAn)

**Музика (`music`)**

- dzi12-music-2024-05-20-v1 — partial — `2dzi_muzika_v1-otgovori_20052024.pdf` (1b6703bpYZKsO6GipNNfqlmkM6jxPmLdz)
- dzi12-music-2024-08-23-v2 — partial — `muzika-23-avgust-2024-g.pdf` (1NF1J6w6ff5GbLKXyoPTSpgqgeLJkbEb9)
- dzi12-music-2025-05-23-v2 — partial — `2dzi25_muzika_v2.pdf` (1xqCjzc43RDdJCULw7jc81MqGGJ4JOss9)
- dzi12-music-2026-05-22-v2 — missing — `2dzi_muzika_v2-otgovori.pdf` (1hTse9X5pVSJJptI8WKwM0fQT1LY3W5a9)
- dzi12-music-2026-08-24-v2 — partial — `2dzi_muzika_v2otgovori-1.pdf` (1AEkkKOqRdzs6cM2Yud1A3FQ_Vfmc1lFl)
- dzi12-music-?-v2 — missing — `2dzi_muzika.pdf` (1eLBkdahZLfVcdQR0VVF8HRqAHNEqVCno), `2dzi_muzika_v2.pdf` (1w6VJYDgNeouQ0zg__pO-tWz3-TmxCINh), `2dzi_muzika_v2_25082023.pdf` (1XTvs9qIVA5nSd_pONrJlXPgvmQBwpl-d), `2dzi_pp_muzika_v2_23.05.2023.pdf` (1FiCChccCxSzIGgbvFDFJWOFrh8tjw7xd)
- dzi12-music-?-v1 — missing — `2dzi_muzika_v1.pdf` (1zgM6XxI5bWNtG6JXLU7bm6wL4aearxni)

**Философия (`phil`)**

- dzi12-phil-2022-05-20-v1 — partial — `2dzi_philosophia_v1.pdf` (1cgHNLss3hmifU13WPhTrvszKR_FD_EAA)
- dzi12-phil-2022-05-26-oop-v1 — missing — `oop_philosophia_v1_26052022.pdf` (1sWgf27rkcbadL3zBarMtzrd4lnEUoNYW)
- dzi12-phil-2022-08-26-v2 — missing — `2dzi_philosofia.pdf` (1nXK10KMklH2Pm7bO0GGjIkYpu3eXUCBq)
- dzi12-phil-2022-08-29-oop-v1 — missing — `3dzi_phil_29082022.pdf` (13UOsCHDaowjgA9b5BnjFB-rUCVEsSgTn)
- dzi12-phil-2023-05-23-v2 — missing — `2dzi_pp_philosophia_v2_23.05.2023.pdf` (1mP__j5aJOTDJN5Z8YMPiZJw5lGtZnjb5)
- dzi12-phil-2023-08-25-v2 — missing — `2dzi_philosophia_v2_25082023.pdf` (18EhObWgW7c1YIXyPAcRsnX316mjnyC0Y)
- dzi12-phil-2024-05-20-v1 — partial — `2dzi_philosophia_v1-otgovori_20052024.pdf` (15qagKl_C9hmkqhO6_5HkBRPJlHBxfTIf)
- dzi12-phil-2024-08-23-v2 — partial — `filosofiya-23-avgust-2024-g.pdf` (1QBJizIHfeQjCpDPxYLL-KttcunyxIg_d)
- dzi12-phil-2025-05-23-v2 — partial — `2dzi25_philosophia_v2.pdf` (16YzA4YS6u0gjU7dwbWLzjZvFp6fSgf-x)
- dzi12-phil-2026-05-22-v2 — missing — `2dzi_philosophia_v2otgovori.pdf` (1ckKsTDJq9RmlEp2xHKkQbCzDdSMEolPj)
- dzi12-phil-2026-08-24-v2 — partial — `2dzi_phil_v2otgovori.pdf` (13Z37tO4cW6Pmd7tHrR2kFpKsMpMiRCyx)

**Физика (`phys`)**

- dzi12-phys-2020-06-02-v2 — missing — `3dzi_fizika_v2-02062020.pdf` (1sA3kLroriiBh8LMnu-B1WI74Hub9ZHPF)
- dzi12-phys-2020-06-03-v2 — missing — `2dzi_fizika_v2_3-vi-2020.pdf` (1tPIdC3DZd3JHYdr1EuyJrkAZAwkeu_Qv)
- dzi12-phys-2020-08-28-v2 — missing — `2dzi-fizika-v2-280820.pdf` (10_lKqbbIo43xmW0ZfZVBqfFN72cRpCUv)
- dzi12-phys-2021-05-21-v1 — missing — `2dzi_fizika_v1_210521.pdf` (1jpyXSVVPwxQkTy6vaSbh2P8h8eS-f2Tw)
- dzi12-phys-2021-05-26-v2 — missing — `3dzi_fizika_v2_03062021.pdf` (1jWk3pNFew1J5JWFJkBxTufzPObi26ptk)
- dzi12-phys-2021-08-27-v2 — missing — `2dzi_fizika_270821.pdf` (1A0Nvwlq8y5WY3DPu4MKPhjj73sM61Axb)
- dzi12-phys-2022-05-20-v1 — missing — `2dzi_fizika_i_astronomiya_v1.pdf` (1zGaEPNNrdlGh8hYKeR9kxMTb5a1fhFMk)
- dzi12-phys-2022-05-31-v2 — missing — `pp_fizizka i astronomiya.pdf` (1sPfKgrFIrUp_hzAYBQH_S7ACAYhg-1B1)
- dzi12-phys-2022-08-26-v2 — missing — `2dzi_fa_26.08.2022.pdf` (1rZVGxIb4XS9Sju4en9u8rjDclFxYxyFg)
- dzi12-phys-2023-05-23-v2 — missing — `2dzi_pp_fizika i astronomiya_v2_23.05.2023.pdf` (1WKY8DaqWv2rdWi93octnU_EaLyZ_2ow_)
- dzi12-phys-2023-08-25-v2 — missing — `2dzi_fizika_v2_25082023.pdf` (1gO9SB4KB_zN1FmG3fFj1F-c5uV9GhuYJ)
- dzi12-phys-2024-05-20-v1 — missing — `2dzi_fizika-i-astronomiya_v1-otgovori_20052024.pdf` (1YVQXODNBF6McFzkuxzRIB7oJFogLxgUX)
- dzi12-phys-2024-08-23-v2 — partial — `fizika-i-astronomiya-23-avgust-2024-g.pdf` (1UsRx_ZpJvS_8erIJSGUIHhF5PNEjD22x)
- dzi12-phys-2026-05-22-v2 — missing — `2dzi_fizika_v2otgovori.pdf` (1c42_YQDOsgCtC13bPoj4ts1mG30I7NIK)

**Руски (`ru`)**

- dzi12-ru-2020-06-02-v2 — missing — `3dzi_ruski_v2-02062020.pdf` (10syjOFKNlP48_b0E6LY5CSXWNU5Aehi-)
- dzi12-ru-2020-06-03-v2 — missing — `2dzi_ruski_v2_3-vi-2020.pdf` (1QhFVSIJ2-SZkvOhP5P7413v4EgbGVCQT)
- dzi12-ru-2020-08-28-v2 — missing — `2dzi_ruski-ezk_v2-280820.pdf` (1gyUYwzpuLEPPdmKHDJLni2FtY7q35vGe)
- dzi12-ru-2021-05-21-v1 — missing — `2dzi_ru_v1_210521.pdf` (1TopXfA_oxtAfSZVCXJbQI1J82asSRHVK)
- dzi12-ru-2021-05-26-v1 — missing — `3dzi_re_v1_03062021.pdf` (1z5_pk_-xgEXmAHb62fomSY1CGUmvIRkS)
- dzi12-ru-2021-08-27-v2 — missing — `2dzi_ruski_270821.pdf` (1Tb-iCY2xdoVfye7F_KfM0N0UDpyk8wxF)
- dzi12-ru-2022-08-26-b1-v2 — missing — `2dzi_ruski ezik nivo b1_26.08.22.pdf` (1kl6evHMM2NYep0N0cSH7aYvJh-fvCgR6)
- dzi12-ru-2022-08-26-b11-v2 — missing — `2dzi_ruski ezik nivo b1.1_26.08.22.pdf` (1J4gr5ocT84NTQKzTaRFewaxFH5KYKjnq)
- dzi12-ru-2022-08-26-b2-v2 — missing — `2dzi_ruski ezik nivo b2_26.08.22.pdf` (1Yv3HgcyQKqkMB0n2jej5MHcBn8SRJBry)
- dzi12-ru-2026-05-22-b11-v2 — missing — `2dzi_re_nivo-b1.1_v2otgovori.pdf` (15Y0U-EJZ2kCNtVrWK14Dd3MOc2v9FMn8)
- dzi12-ru-?-b1-oop-v1 — missing — `3dzi_re-b1_oop_29082022.pdf` (1X3Z61qEWkZzppCsKadn3gbwSE2-89vZk)
- dzi12-ru-?-b2-v1 — missing — `3dzi-pp_re_29082022.pdf` (1pr3CN_bUdCVWFCPkH8EvZgYxMyR2-ne4)
