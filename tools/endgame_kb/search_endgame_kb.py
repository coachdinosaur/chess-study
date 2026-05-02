from __future__ import annotations

import argparse
import json
import re
import sqlite3
import sys
from pathlib import Path


DEFAULT_DB_PATH = Path("Endgame") / "_kb" / "endgame.sqlite"


def tokenize_query(query: str) -> list[str]:
    return re.findall(r"[A-Za-z0-9]+", query)


def quote_fts_token(token: str) -> str:
    return '"' + token.replace('"', '""') + '"'


def build_match_expressions(query: str, raw: bool) -> list[str]:
    if raw:
        return [query]

    tokens = tokenize_query(query)
    if not tokens:
        return []

    quoted = [quote_fts_token(token) for token in tokens]
    expressions = [" AND ".join(quoted)]
    if len(quoted) > 1:
        expressions.append(" OR ".join(quoted))
    return expressions


def search(
    db_path: Path,
    query: str,
    limit: int,
    snippet_tokens: int,
    raw: bool = False,
) -> tuple[str | None, list[dict]]:
    expressions = build_match_expressions(query, raw)
    if not expressions:
        return None, []

    sql = """
        SELECT
            chunks.id AS chunk_id,
            documents.filename AS filename,
            chunks.page_start AS page_start,
            chunks.page_end AS page_end,
            chunks.word_count AS word_count,
            bm25(chunks_fts) AS rank,
            snippet(chunks_fts, 0, '[', ']', '...', ?) AS snippet
        FROM chunks_fts
        JOIN chunks ON chunks_fts.rowid = chunks.id
        JOIN documents ON chunks.document_id = documents.id
        WHERE chunks_fts MATCH ?
        ORDER BY rank
        LIMIT ?
    """

    con = sqlite3.connect(db_path)
    try:
        con.row_factory = sqlite3.Row
        for expression in expressions:
            rows = con.execute(sql, (snippet_tokens, expression, limit)).fetchall()
            if rows:
                return expression, [dict(row) for row in rows]
    finally:
        con.close()
    return expressions[-1], []


def format_page_range(page_start: int, page_end: int) -> str:
    if page_start == page_end:
        return f"PDF page {page_start}"
    return f"PDF pages {page_start}-{page_end}"


def print_text_results(query: str, expression: str | None, rows: list[dict], db_path: Path) -> None:
    print(f"Query: {query}")
    print(f"Database: {db_path}")
    if expression:
        print(f"FTS expression: {expression}")
    if not rows:
        print("No matches found.")
        return

    for index, row in enumerate(rows, start=1):
        page_label = format_page_range(row["page_start"], row["page_end"])
        print(
            f"\n{index}. {row['filename']} - {page_label} "
            f"(chunk {row['chunk_id']}, rank {row['rank']:.4f})"
        )
        print(f"   {row['snippet']}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Search the Endgame SQLite FTS knowledge base.")
    parser.add_argument("query", help="Search query, for example: Lucena")
    parser.add_argument("--db-path", type=Path, default=DEFAULT_DB_PATH)
    parser.add_argument("--limit", type=int, default=8)
    parser.add_argument("--snippet-tokens", type=int, default=40)
    parser.add_argument(
        "--raw",
        action="store_true",
        help="Treat the query as a raw SQLite FTS5 MATCH expression.",
    )
    parser.add_argument("--json", action="store_true", help="Emit JSON instead of text.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    db_path = args.db_path.resolve()
    if not db_path.exists():
        print(f"Database not found: {db_path}", file=sys.stderr)
        print("Build it first with tools/endgame_kb/build_endgame_kb.py", file=sys.stderr)
        return 1

    try:
        expression, rows = search(
            db_path=db_path,
            query=args.query,
            limit=args.limit,
            snippet_tokens=args.snippet_tokens,
            raw=args.raw,
        )
    except sqlite3.OperationalError as exc:
        print(f"Search failed: {exc}", file=sys.stderr)
        return 1

    if args.json:
        print(
            json.dumps(
                {
                    "query": args.query,
                    "db_path": str(db_path),
                    "fts_expression": expression,
                    "results": rows,
                },
                indent=2,
            )
        )
    else:
        print_text_results(args.query, expression, rows, db_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
