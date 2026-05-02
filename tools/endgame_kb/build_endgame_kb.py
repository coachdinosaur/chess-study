from __future__ import annotations

import argparse
import datetime as dt
import fnmatch
import hashlib
import json
import re
import sqlite3
import sys
from pathlib import Path
from typing import Any, Iterable

try:
    from pypdf import PdfReader
except ImportError:  # pragma: no cover - exercised by users without the venv
    PdfReader = None

try:
    import numpy as np
    import pypdfium2 as pdfium
    from rapidocr_onnxruntime import RapidOCR
except ImportError:  # pragma: no cover - OCR is optional
    np = None
    pdfium = None
    RapidOCR = None


DEFAULT_PDF_DIR = Path("Endgame")
DEFAULT_KB_DIR = DEFAULT_PDF_DIR / "_kb"
DEFAULT_DB_PATH = DEFAULT_KB_DIR / "endgame.sqlite"
DEFAULT_REPORT_PATH = DEFAULT_KB_DIR / "build_report.json"
DEFAULT_OCR_CACHE_DIR = DEFAULT_KB_DIR / "ocr_cache"

READABLE_COPY_SUFFIX = "_readable"
LOW_TEXT_CHARS = 80
CHUNK_WORDS = 420
OVERLAP_WORDS = 60
OCR_SCALE = 1.2
OCR_MIN_CONFIDENCE = 0.45


def utc_now() -> str:
    return dt.datetime.now(dt.UTC).replace(microsecond=0).isoformat()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t\f\v]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" *\n *", "\n", text)
    return text.strip()


def canonical_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().casefold()


def text_hash(text: str) -> str:
    return hashlib.sha256(canonical_text(text).encode("utf-8")).hexdigest()


def ensure_ocr_available() -> None:
    missing = []
    if np is None:
        missing.append("numpy")
    if pdfium is None:
        missing.append("pypdfium2")
    if RapidOCR is None:
        missing.append("rapidocr-onnxruntime")
    if missing:
        raise RuntimeError(
            "OCR dependencies are missing: "
            + ", ".join(missing)
            + ". Install them with .\\.venv-endgame-kb\\Scripts\\python.exe -m pip install -r tools/endgame_kb/requirements.txt"
        )


def ocr_page_text(
    pdfium_doc: Any,
    page_index: int,
    ocr_engine: Any,
    scale: float,
    min_confidence: float,
) -> tuple[str, float | None]:
    page = pdfium_doc[page_index]
    image = page.render(scale=scale).to_pil().convert("RGB")
    result, _elapsed = ocr_engine(np.array(image))
    if not result:
        return "", None

    lines = []
    confidences = []
    for _box, line_text, confidence in result:
        if confidence < min_confidence:
            continue
        clean_line = normalize_text(str(line_text))
        if not clean_line:
            continue
        lines.append(clean_line)
        confidences.append(float(confidence))

    if not lines:
        return "", None

    average_confidence = sum(confidences) / len(confidences)
    return normalize_text("\n".join(lines)), average_confidence


def should_ocr_document(filename: str, patterns: list[str]) -> bool:
    return any(fnmatch.fnmatchcase(filename.casefold(), pattern.casefold()) for pattern in patterns)


def discover_pdf_files(
    pdf_dir: Path,
    include_shadowed_pdfs: bool,
) -> tuple[list[Path], list[dict[str, str]]]:
    pdf_files = sorted(pdf_dir.glob("*.pdf"), key=lambda path: path.name.casefold())
    if include_shadowed_pdfs:
        return pdf_files, []

    readable_replacements: dict[str, str] = {}
    suffix_length = len(READABLE_COPY_SUFFIX)
    for pdf_path in pdf_files:
        if not pdf_path.stem.casefold().endswith(READABLE_COPY_SUFFIX):
            continue
        original_name = f"{pdf_path.stem[:-suffix_length]}{pdf_path.suffix}"
        readable_replacements[original_name.casefold()] = pdf_path.name

    selected_files = []
    skipped_files = []
    for pdf_path in pdf_files:
        replacement = readable_replacements.get(pdf_path.name.casefold())
        if replacement is not None:
            skipped_files.append(
                {
                    "filename": pdf_path.name,
                    "replacement": replacement,
                    "reason": f"Sibling {READABLE_COPY_SUFFIX}.pdf copy exists",
                }
            )
            continue
        selected_files.append(pdf_path)

    return selected_files, skipped_files


def ocr_cache_path(
    cache_dir: Path,
    document_hash: str,
    page_number: int,
    scale: float,
    min_confidence: float,
) -> Path:
    scale_key = str(scale).replace(".", "p")
    confidence_key = str(min_confidence).replace(".", "p")
    return cache_dir / f"{document_hash[:16]}_p{page_number:04d}_s{scale_key}_c{confidence_key}.json"


def read_ocr_cache(path: Path) -> tuple[str, float | None] | None:
    if not path.exists():
        return None
    cached = json.loads(path.read_text(encoding="utf-8"))
    return cached.get("text", ""), cached.get("confidence")


def write_ocr_cache(path: Path, text: str, confidence: float | None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({"text": text, "confidence": confidence}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def chunk_page_text(text: str, chunk_words: int, overlap_words: int) -> Iterable[str]:
    words = text.split()
    if not words:
        return
    if len(words) <= chunk_words:
        yield " ".join(words)
        return

    step = max(1, chunk_words - overlap_words)
    for start in range(0, len(words), step):
        chunk = words[start : start + chunk_words]
        if len(chunk) < max(40, overlap_words // 2) and start > 0:
            break
        yield " ".join(chunk)
        if start + chunk_words >= len(words):
            break


def create_schema(con: sqlite3.Connection) -> None:
    con.executescript(
        """
        PRAGMA foreign_keys = ON;

        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE documents (
            id INTEGER PRIMARY KEY,
            filename TEXT NOT NULL UNIQUE,
            path TEXT NOT NULL,
            sha256 TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            page_count INTEGER NOT NULL,
            indexed_pages INTEGER NOT NULL,
            low_text_pages INTEGER NOT NULL,
            extraction_errors INTEGER NOT NULL,
            unique_chunks INTEGER NOT NULL,
            duplicate_chunks INTEGER NOT NULL
        );

        CREATE TABLE pages (
            id INTEGER PRIMARY KEY,
            document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            page_number INTEGER NOT NULL,
            char_count INTEGER NOT NULL,
            is_low_text INTEGER NOT NULL,
            ocr_attempted INTEGER NOT NULL,
            used_ocr INTEGER NOT NULL,
            ocr_confidence REAL,
            extraction_error TEXT,
            UNIQUE(document_id, page_number)
        );

        CREATE TABLE chunks (
            id INTEGER PRIMARY KEY,
            document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            page_start INTEGER NOT NULL,
            page_end INTEGER NOT NULL,
            text_hash TEXT NOT NULL UNIQUE,
            char_count INTEGER NOT NULL,
            word_count INTEGER NOT NULL,
            text TEXT NOT NULL
        );

        CREATE TABLE duplicate_chunks (
            id INTEGER PRIMARY KEY,
            document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
            chunk_index INTEGER NOT NULL,
            page_start INTEGER NOT NULL,
            page_end INTEGER NOT NULL,
            text_hash TEXT NOT NULL,
            kept_chunk_id INTEGER NOT NULL REFERENCES chunks(id) ON DELETE CASCADE,
            char_count INTEGER NOT NULL,
            word_count INTEGER NOT NULL
        );

        CREATE VIRTUAL TABLE chunks_fts USING fts5(
            text,
            content='chunks',
            content_rowid='id',
            tokenize='unicode61'
        );

        CREATE INDEX idx_pages_document_page ON pages(document_id, page_number);
        CREATE INDEX idx_chunks_document_page ON chunks(document_id, page_start);
        CREATE INDEX idx_duplicate_chunks_hash ON duplicate_chunks(text_hash);
        """
    )


def insert_metadata(con: sqlite3.Connection, args: argparse.Namespace) -> None:
    rows = {
        "created_at": utc_now(),
        "pdf_dir": str(args.pdf_dir),
        "db_path": str(args.db_path),
        "chunk_words": str(args.chunk_words),
        "overlap_words": str(args.overlap_words),
        "low_text_chars": str(args.low_text_chars),
        "ocr_low_text_pages": str(args.ocr_low_text_pages),
        "ocr_file_glob": ",".join(args.ocr_file_glob),
        "ocr_cache_dir": str(args.ocr_cache_dir),
        "ocr_scale": str(args.ocr_scale),
        "ocr_min_confidence": str(args.ocr_min_confidence),
        "include_shadowed_pdfs": str(args.include_shadowed_pdfs),
        "extractor": "pypdf",
        "ocr_engine": "rapidocr-onnxruntime" if args.ocr_low_text_pages else "none",
    }
    con.executemany(
        "INSERT INTO metadata(key, value) VALUES (?, ?)",
        sorted(rows.items()),
    )


def build_database(args: argparse.Namespace) -> dict:
    if PdfReader is None:
        raise RuntimeError(
            "pypdf is not installed. Run .\\.venv-endgame-kb\\Scripts\\python.exe -m pip install -r tools/endgame_kb/requirements.txt"
        )
    if args.ocr_low_text_pages:
        ensure_ocr_available()
        args.ocr_cache_dir.mkdir(parents=True, exist_ok=True)

    pdf_files, skipped_pdf_files = discover_pdf_files(
        args.pdf_dir,
        include_shadowed_pdfs=args.include_shadowed_pdfs,
    )
    if not pdf_files:
        raise RuntimeError(f"No PDF files found in {args.pdf_dir}")
    for skipped_pdf in skipped_pdf_files:
        print(
            "Skipping {filename}; using {replacement} instead.".format(**skipped_pdf),
            flush=True,
        )

    args.kb_dir.mkdir(parents=True, exist_ok=True)
    tmp_db_path = args.db_path.with_suffix(args.db_path.suffix + ".tmp")
    if tmp_db_path.exists():
        tmp_db_path.unlink()

    report = {
        "generated_at": utc_now(),
        "pdf_dir": str(args.pdf_dir),
        "db_path": str(args.db_path),
        "settings": {
            "chunk_words": args.chunk_words,
            "overlap_words": args.overlap_words,
            "low_text_chars": args.low_text_chars,
            "ocr_low_text_pages": args.ocr_low_text_pages,
            "ocr_file_glob": args.ocr_file_glob,
            "ocr_cache_dir": str(args.ocr_cache_dir),
            "ocr_scale": args.ocr_scale,
            "ocr_min_confidence": args.ocr_min_confidence,
            "include_shadowed_pdfs": args.include_shadowed_pdfs,
        },
        "totals": {
            "pdf_files": len(pdf_files),
            "pages": 0,
            "indexed_pages": 0,
            "low_text_pages": 0,
            "extraction_errors": 0,
            "unique_chunks": 0,
            "duplicate_chunks": 0,
            "blank_chunks": 0,
            "ocr_attempted_pages": 0,
            "ocr_pages": 0,
            "ocr_failed_pages": 0,
            "ocr_cache_hits": 0,
        },
        "documents": [],
        "skipped_pdf_files": skipped_pdf_files,
        "warnings": [],
    }

    kept_hashes: dict[str, int] = {}
    ocr_engine = RapidOCR() if args.ocr_low_text_pages else None

    con = sqlite3.connect(tmp_db_path)
    try:
        create_schema(con)
        insert_metadata(con, args)

        for pdf_path in pdf_files:
            print(f"Indexing {pdf_path.name}...", flush=True)
            doc_stats = {
                "filename": pdf_path.name,
                "path": str(pdf_path),
                "sha256": sha256_file(pdf_path),
                "file_size": pdf_path.stat().st_size,
                "page_count": 0,
                "indexed_pages": 0,
                "low_text_pages": 0,
                "extraction_errors": 0,
                "unique_chunks": 0,
                "duplicate_chunks": 0,
                "ocr_attempted_pages": 0,
                "ocr_pages": 0,
                "ocr_failed_pages": 0,
                "ocr_cache_hits": 0,
            }

            reader = PdfReader(str(pdf_path), strict=False)
            if reader.is_encrypted:
                try:
                    reader.decrypt("")
                except Exception as exc:  # noqa: BLE001
                    raise RuntimeError(f"Could not decrypt {pdf_path.name}: {exc}") from exc
            ocr_enabled_for_document = args.ocr_low_text_pages and should_ocr_document(
                pdf_path.name, args.ocr_file_glob
            )
            pdfium_doc = pdfium.PdfDocument(str(pdf_path)) if ocr_enabled_for_document else None

            doc_stats["page_count"] = len(reader.pages)
            cur = con.execute(
                """
                INSERT INTO documents(
                    filename, path, sha256, file_size, page_count, indexed_pages,
                    low_text_pages, extraction_errors, unique_chunks, duplicate_chunks
                )
                VALUES (?, ?, ?, ?, ?, 0, 0, 0, 0, 0)
                """,
                (
                    doc_stats["filename"],
                    doc_stats["path"],
                    doc_stats["sha256"],
                    doc_stats["file_size"],
                    doc_stats["page_count"],
                ),
            )
            document_id = int(cur.lastrowid)

            chunk_index = 0
            for zero_based_page, page in enumerate(reader.pages):
                page_number = zero_based_page + 1
                error_message = None
                try:
                    page_text = normalize_text(page.extract_text() or "")
                except Exception as exc:  # noqa: BLE001
                    page_text = ""
                    error_message = f"{type(exc).__name__}: {exc}"
                    doc_stats["extraction_errors"] += 1
                    if len(report["warnings"]) < 100:
                        report["warnings"].append(
                            {
                                "filename": pdf_path.name,
                                "page": page_number,
                                "warning": error_message,
                            }
                        )

                char_count = len(page_text)
                ocr_attempted = False
                used_ocr = False
                ocr_confidence = None
                if ocr_enabled_for_document and char_count < args.low_text_chars:
                    ocr_attempted = True
                    doc_stats["ocr_attempted_pages"] += 1
                    if (
                        doc_stats["ocr_attempted_pages"] == 1
                        or doc_stats["ocr_attempted_pages"] % args.progress_every == 0
                    ):
                        print(
                            f"  OCR {pdf_path.name}: page {page_number}/{doc_stats['page_count']} "
                            f"({doc_stats['ocr_attempted_pages']} attempted)",
                            flush=True,
                        )
                    cache_path = ocr_cache_path(
                        cache_dir=args.ocr_cache_dir,
                        document_hash=doc_stats["sha256"],
                        page_number=page_number,
                        scale=args.ocr_scale,
                        min_confidence=args.ocr_min_confidence,
                    )
                    try:
                        cached = read_ocr_cache(cache_path)
                        if cached is not None:
                            ocr_text, ocr_confidence = cached
                            doc_stats["ocr_cache_hits"] += 1
                        else:
                            ocr_text, ocr_confidence = ocr_page_text(
                                pdfium_doc=pdfium_doc,
                                page_index=zero_based_page,
                                ocr_engine=ocr_engine,
                                scale=args.ocr_scale,
                                min_confidence=args.ocr_min_confidence,
                            )
                            write_ocr_cache(cache_path, ocr_text, ocr_confidence)
                    except Exception as exc:  # noqa: BLE001
                        doc_stats["ocr_failed_pages"] += 1
                        if error_message:
                            error_message = f"{error_message}; OCR {type(exc).__name__}: {exc}"
                        else:
                            error_message = f"OCR {type(exc).__name__}: {exc}"
                        if len(report["warnings"]) < 100:
                            report["warnings"].append(
                                {
                                    "filename": pdf_path.name,
                                    "page": page_number,
                                    "warning": error_message,
                                }
                            )
                    else:
                        if len(ocr_text) > char_count:
                            page_text = ocr_text
                            char_count = len(page_text)
                            used_ocr = True
                            doc_stats["ocr_pages"] += 1

                is_low_text = char_count < args.low_text_chars
                if is_low_text:
                    doc_stats["low_text_pages"] += 1

                con.execute(
                    """
                    INSERT INTO pages(
                        document_id, page_number, char_count, is_low_text,
                        ocr_attempted, used_ocr, ocr_confidence, extraction_error
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        document_id,
                        page_number,
                        char_count,
                        int(is_low_text),
                        int(ocr_attempted),
                        int(used_ocr),
                        ocr_confidence,
                        error_message,
                    ),
                )

                page_chunks = list(
                    chunk_page_text(page_text, args.chunk_words, args.overlap_words)
                )
                if page_chunks:
                    doc_stats["indexed_pages"] += 1
                else:
                    report["totals"]["blank_chunks"] += 1

                for chunk_text in page_chunks:
                    chunk_index += 1
                    digest = text_hash(chunk_text)
                    word_count = len(chunk_text.split())
                    char_count = len(chunk_text)
                    kept_chunk_id = kept_hashes.get(digest)

                    if kept_chunk_id is not None:
                        doc_stats["duplicate_chunks"] += 1
                        con.execute(
                            """
                            INSERT INTO duplicate_chunks(
                                document_id, chunk_index, page_start, page_end, text_hash,
                                kept_chunk_id, char_count, word_count
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                            (
                                document_id,
                                chunk_index,
                                page_number,
                                page_number,
                                digest,
                                kept_chunk_id,
                                char_count,
                                word_count,
                            ),
                        )
                        continue

                    cur = con.execute(
                        """
                        INSERT INTO chunks(
                            document_id, chunk_index, page_start, page_end, text_hash,
                            char_count, word_count, text
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        (
                            document_id,
                            chunk_index,
                            page_number,
                            page_number,
                            digest,
                            char_count,
                            word_count,
                            chunk_text,
                        ),
                    )
                    chunk_id = int(cur.lastrowid)
                    kept_hashes[digest] = chunk_id
                    con.execute(
                        "INSERT INTO chunks_fts(rowid, text) VALUES (?, ?)",
                        (chunk_id, chunk_text),
                    )
                    doc_stats["unique_chunks"] += 1

            con.execute(
                """
                UPDATE documents
                SET indexed_pages = ?,
                    low_text_pages = ?,
                    extraction_errors = ?,
                    unique_chunks = ?,
                    duplicate_chunks = ?
                WHERE id = ?
                """,
                (
                    doc_stats["indexed_pages"],
                    doc_stats["low_text_pages"],
                    doc_stats["extraction_errors"],
                    doc_stats["unique_chunks"],
                    doc_stats["duplicate_chunks"],
                    document_id,
                ),
            )
            report["documents"].append(doc_stats)

            report["totals"]["pages"] += doc_stats["page_count"]
            report["totals"]["indexed_pages"] += doc_stats["indexed_pages"]
            report["totals"]["low_text_pages"] += doc_stats["low_text_pages"]
            report["totals"]["extraction_errors"] += doc_stats["extraction_errors"]
            report["totals"]["unique_chunks"] += doc_stats["unique_chunks"]
            report["totals"]["duplicate_chunks"] += doc_stats["duplicate_chunks"]
            report["totals"]["ocr_attempted_pages"] += doc_stats["ocr_attempted_pages"]
            report["totals"]["ocr_pages"] += doc_stats["ocr_pages"]
            report["totals"]["ocr_failed_pages"] += doc_stats["ocr_failed_pages"]
            report["totals"]["ocr_cache_hits"] += doc_stats["ocr_cache_hits"]

        con.execute("INSERT INTO chunks_fts(chunks_fts) VALUES ('optimize')")
        con.commit()
    finally:
        con.close()

    if args.db_path.exists():
        args.db_path.unlink()
    tmp_db_path.replace(args.db_path)
    args.report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    return report


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build a SQLite FTS5 knowledge base from Endgame PDFs."
    )
    parser.add_argument("--pdf-dir", type=Path, default=DEFAULT_PDF_DIR)
    parser.add_argument("--kb-dir", type=Path, default=DEFAULT_KB_DIR)
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--report-path", type=Path, default=DEFAULT_REPORT_PATH)
    parser.add_argument("--chunk-words", type=int, default=CHUNK_WORDS)
    parser.add_argument("--overlap-words", type=int, default=OVERLAP_WORDS)
    parser.add_argument("--low-text-chars", type=int, default=LOW_TEXT_CHARS)
    parser.add_argument(
        "--ocr-low-text-pages",
        action="store_true",
        help="Render and OCR pages whose extracted text is below --low-text-chars.",
    )
    parser.add_argument(
        "--ocr-file-glob",
        action="append",
        default=None,
        help="Only OCR files matching this filename glob. May be repeated. Default: *",
    )
    parser.add_argument("--ocr-cache-dir", type=Path, default=DEFAULT_OCR_CACHE_DIR)
    parser.add_argument("--ocr-scale", type=float, default=OCR_SCALE)
    parser.add_argument("--ocr-min-confidence", type=float, default=OCR_MIN_CONFIDENCE)
    parser.add_argument(
        "--include-shadowed-pdfs",
        action="store_true",
        help="Also index original PDFs when a sibling *_readable.pdf copy exists.",
    )
    parser.add_argument(
        "--progress-every",
        type=int,
        default=10,
        help="Print OCR progress after this many attempted OCR pages.",
    )
    args = parser.parse_args()
    args.ocr_file_glob = args.ocr_file_glob or ["*"]
    return args


def main() -> int:
    args = parse_args()
    args.pdf_dir = args.pdf_dir.resolve()
    args.kb_dir = args.kb_dir.resolve()
    args.db_path = args.db_path.resolve()
    args.report_path = args.report_path.resolve()
    args.ocr_cache_dir = args.ocr_cache_dir.resolve()

    try:
        report = build_database(args)
    except Exception as exc:  # noqa: BLE001
        print(f"Build failed: {exc}", file=sys.stderr)
        return 1

    totals = report["totals"]
    print(
        "Built {db} from {pdfs} PDFs: {chunks} unique chunks, "
        "{duplicates} duplicate chunks, {pages} pages, {ocr_pages} OCR pages.".format(
            db=args.db_path,
            pdfs=totals["pdf_files"],
            chunks=totals["unique_chunks"],
            duplicates=totals["duplicate_chunks"],
            pages=totals["pages"],
            ocr_pages=totals["ocr_pages"],
        )
    )
    print(f"Report written to {args.report_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
