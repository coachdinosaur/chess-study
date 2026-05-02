# Endgame Knowledge Base

Local SQLite FTS5 knowledge base for the PDFs in `Endgame/`.

## Build

```powershell
.\.venv-endgame-kb\Scripts\python.exe .\tools\endgame_kb\build_endgame_kb.py
```

Build with OCR fallback for image-only/low-text pages:

```powershell
.\.venv-endgame-kb\Scripts\python.exe .\tools\endgame_kb\build_endgame_kb.py --ocr-low-text-pages
```

When both `book.pdf` and `book_readable.pdf` exist, the builder indexes
`book_readable.pdf` and skips `book.pdf` by default. Use
`--include-shadowed-pdfs` only when you intentionally want both copies indexed.

OCR only a scanned book:

```powershell
.\.venv-endgame-kb\Scripts\python.exe .\tools\endgame_kb\build_endgame_kb.py --ocr-low-text-pages --ocr-file-glob "100-endgames-you-must-know.pdf"
```

Generated files are written to `Endgame/_kb/` and ignored by git.

## Search

```powershell
.\.venv-endgame-kb\Scripts\python.exe .\tools\endgame_kb\search_endgame_kb.py "Lucena" --limit 5
```

Search results cite source filenames and physical PDF page numbers.

## Notes

- OCR uses `pypdfium2` page rendering and `rapidocr-onnxruntime`.
- OCR is only attempted for pages below the low-text threshold, so normal embedded text is preferred where available.
- OCR results are cached in `Endgame/_kb/ocr_cache/` for faster rebuilds.
- For answers in chat, query this KB first and use reputable chess websites only for corroboration or gaps.
