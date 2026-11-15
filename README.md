# InDesign Book Production: typesetting and automated proofing

Scripts I used in 2026 to typeset and proofread a reprint of a 1962 Romanian professional cookbook.
The source was a scan run through OCR, so the text arrived full of recognition errors and the tables
had no consistent formatting.

**The job in numbers**

- 2 volumes, about 600 and 1,300 pages
- more than **8,000 tables** that had to share one style
- more than **4,000 corrections** entered with the help of scripts

Formatting and correcting this by hand would have taken months. The scripts made it a few weeks, and
every change was logged.

## How I worked

This project was built together with an AI coding assistant (Claude). My part was the one that needs
a typesetter: deciding what each tool should do, describing the rules of the book (table profiles,
title behaviour, Romanian sorting and quotation marks), testing on the real documents after every
change and catching the cases where the first version was wrong. The scripts are small, single-purpose
and documented at the top of each file.

## 1. Typesetting (`typesetting/`)

ExtendScript for InDesign. Each script has a dialog, works on the selected story or the whole
document and can be undone with one Ctrl+Z.

| Script | Purpose |
|---|---|
| `fromat tables retetar - v3.jsx` | Recognises table types by column count and applies a profile to each: column widths, strokes, row heights, alignment, header rows. Skips tables that are already correct. |
| `cauta in tabele rand total.jsx` (+ `- fereastra`) | Finds tables missing the "Total" row before the nutrition section and inserts it, one by one or all at once. |
| `change table order.jsx` | Swaps the two tables of every recipe when they follow each other directly. |
| `delte tables retetar - v1.jsx` | Deletes a specific kind of table identified by its first cell. |
| `_increase / _decrease row height 0.1.jsx` | Fine-tunes the row height of selected cells, meant for a keyboard shortcut. |
| `move the title to next page v2.jsx` | Moves recipe titles that fall too low on the page to the next page through a derived paragraph style; reversible. |
| `make a title in sentence case.jsx` | Changes the case of all paragraphs in a style, keeps local formatting, capitalises names inside quotes. |
| `index from table of contents.jsx` | Builds an alphabetical index from the generated TOC, with Romanian alphabet order (ă, â, î, ș, ț). |
| `change number in toc.jsx` | Moves the recipe number in front of the title in the TOC. |
| `1_replace all fonts with one font.jsx` | Replaces fonts by family and maps every style to the closest one in the new family. |
| `reapply style with clearCharacterStyle v2.jsx` | Reapplies a paragraph style across a story and optionally clears character styles. |

## 2. Proofing (`proofing/`)

The proofreader's corrections arrived as spreadsheets with thousands of rows. Three tools process them:

```
corrections CSV ──► python/potrivire2.py      match each correction to the scanned original (two OCR sources)
        │           python/genereaza_*.py     review page + data files for InDesign
        ▼
indesign/aplica_corecturi.jsx    applies the approved corrections automatically, with a dry-run mode,
                                 a backup of each document and a CSV journal of every change
indesign/navigare_*.jsx          palette for what cannot be applied blindly: jumps to the page, selects
                                 the wrong text, shows the correction and opens the same page of the
                                 scanned original in Acrobat for comparison
```

- **Automatic pass** — `aplica_corecturi.jsx` searches each text only near its page, tolerates
  discretionary hyphens and line breaks, refuses ambiguous matches and marks every changed text with
  a condition so it can be highlighted and reviewed.
- **Step-by-step pass** — `navigare_v5.jsx` (documented in `navigare_v5.md`) remembers what has been
  solved, filters by correction type and keeps InDesign and the original PDF side by side.
- **Checks** — `python/verifica_*.py` and `compara_*.py` compare PDF exports before and after, to
  prove that each correction is present and nothing else changed.

Python dependencies: `pymupdf`, `rapidfuzz`, `winocr`, `Pillow`.

## What is not in this repository

The book files, the OCR output and the correction lists belong to the publisher and are not included.
Paths in the scripts point to a placeholder folder.

© Dan Ichimescu
