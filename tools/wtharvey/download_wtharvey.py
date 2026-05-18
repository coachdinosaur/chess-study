#!/usr/bin/env python3
"""Download WTHarvey chess puzzle FENs into raw and app-friendly CSV files.

The WTHarvey pages are public, but no open-data redistribution license is
advertised. Treat the exported files as a personal study dataset unless you
obtain permission or curate a small attributed subset.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import html
import re
import sys
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urldefrag, urljoin, urlparse
from urllib.request import Request, urlopen


BASE_URL = "https://www.wtharvey.com/"
DEFAULT_RAW_OUT = Path("Endgame/wtharvey_puzzles_raw.csv")
DEFAULT_APP_OUT = Path("Endgame/wtharvey_tactics_input.csv")
DEFAULT_ERRORS_OUT = Path("Endgame/wtharvey_download_errors.csv")
USER_AGENT = "Mozilla/5.0 personal-study-script (+https://www.wtharvey.com/)"

FEN_RE = re.compile(
    r"(?P<fen>(?:[pnbrqkPNBRQK1-8]+/){7}[pnbrqkPNBRQK1-8]+"
    r"\s+[wb]\s+(?:K?Q?k?q?|-|[KQkq]+)\s+(?:[a-h][36]|-)\s+\d+\s+\d+)"
)

PUZZLE_LABEL_RE = re.compile(r"^[a-z]{1,2}\)|^\d+\)", re.IGNORECASE)
GENERIC_CONTEXT_RE = re.compile(
    r"(color disk|solutions? are|drag your|click on|come back later|here are|"
    r"puzzles from|puzzles rated|winning moves|print edition|available|"
    r"grandmaster|king-pawn opening|amazon\.com)",
    re.IGNORECASE,
)
TASK_RE = re.compile(r"\b(mates? in \d+|mate in \d+|wins?|winning move|draws?|holds?)\b", re.IGNORECASE)
RATING_RE = re.compile(r"\((?:1[0-9]{3}|2[0-9]{3}|3[0-9]{3})\)")

MOTIF_KEYWORDS = {
    "back-rank mate": ["back rank", "back-rank"],
    "clearance": ["clearance"],
    "decoy": ["decoy"],
    "deflection": ["deflection", "deflect"],
    "discovered attack": ["discovered attack", "discovered check"],
    "double attack": ["double attack"],
    "fork": ["fork"],
    "mate": ["mate in", "mates in", "checkmate"],
    "pin": [" pin ", "pinned", "pinning"],
    "skewer": ["skewer"],
    "undermining": ["undermining", "undermine"],
    "x-ray": ["x-ray", "xray"],
}


@dataclass(frozen=True)
class Link:
    url: str
    label: str


class LinkParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.links: list[Link] = []
        self._href: str | None = None
        self._label_parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() == "a":
            attrs_dict = dict(attrs)
            self._href = attrs_dict.get("href") or ""
            self._label_parts = []

    def handle_data(self, data: str) -> None:
        if self._href is not None:
            self._label_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or self._href is None:
            return

        url = urldefrag(urljoin(self.base_url, self._href))[0]
        label = normalize_space(" ".join(self._label_parts))
        self.links.append(Link(url=url, label=label))
        self._href = None
        self._label_parts = []


class TextParser(HTMLParser):
    BLOCK_TAGS = {
        "br",
        "p",
        "div",
        "center",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "li",
        "a",
        "tr",
        "table",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.title_parts: list[str] = []
        self._in_title = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        tag = tag.lower()
        if tag == "title":
            self._in_title = True
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        if tag == "title":
            self._in_title = False
        if tag in self.BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if self._in_title:
            self.title_parts.append(data)
        self.parts.append(data)

    @property
    def text(self) -> str:
        return html.unescape("".join(self.parts))

    @property
    def title(self) -> str:
        return normalize_space(" ".join(self.title_parts))


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def fetch_html(url: str, timeout: int, retries: int) -> str:
    last_error: Exception | None = None
    for attempt in range(retries + 1):
        try:
            request = Request(url, headers={"User-Agent": USER_AGENT})
            with urlopen(request, timeout=timeout) as response:
                payload = response.read()
                charset = response.headers.get_content_charset() or "utf-8"
                return payload.decode(charset, "replace")
        except (HTTPError, URLError, TimeoutError) as error:
            last_error = error
            if attempt < retries:
                time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{type(last_error).__name__}: {last_error}")


def parse_links(html_text: str, base_url: str) -> list[Link]:
    parser = LinkParser(base_url)
    parser.feed(html_text)
    return parser.links


def parse_page_text(html_text: str) -> tuple[str, str]:
    parser = TextParser()
    parser.feed(html_text)
    text = parser.text.replace("\r", "\n")
    text = re.sub(r"\n\s*\n+", "\n", text)
    return text, parser.title


def same_site_html_links(links: Iterable[Link], base_url: str) -> list[Link]:
    base_host = urlparse(base_url).netloc.lower()
    seen: set[str] = set()
    result: list[Link] = []

    for link in links:
        parsed = urlparse(link.url)
        if parsed.scheme not in {"http", "https"}:
            continue
        if parsed.netloc.lower() != base_host:
            continue
        if not parsed.path.lower().endswith(".html"):
            continue
        if link.url in seen:
            continue
        seen.add(link.url)
        result.append(link)

    return sorted(result, key=lambda item: item.url)


def get_seed_links(base_url: str, timeout: int, retries: int) -> list[Link]:
    html_text = fetch_html(base_url, timeout=timeout, retries=retries)
    return same_site_html_links(parse_links(html_text, base_url), base_url)


def line_window(lines: list[str], index: int, before: int = 10, after: int = 4) -> tuple[list[str], list[str]]:
    start = max(0, index - before)
    end = min(len(lines), index + after + 1)
    return lines[start:index], lines[index + 1 : end]


def useful_context(line: str) -> bool:
    clean = normalize_space(line)
    if not clean:
        return False
    if FEN_RE.search(clean):
        return False
    if clean.startswith("[") and clean.endswith("]"):
        return False
    if PUZZLE_LABEL_RE.search(clean):
        return False
    if GENERIC_CONTEXT_RE.search(clean):
        return False
    return True


def find_title(before_lines: list[str], page_title: str) -> str:
    for line in reversed(before_lines):
        clean = normalize_space(line)
        if not useful_context(clean):
            continue
        if TASK_RE.search(clean) and not ("," in clean or " vs " in clean.lower()):
            continue
        return clean
    return page_title


def find_task(before_lines: list[str], title: str) -> str:
    for line in reversed(before_lines):
        clean = normalize_space(line)
        if not clean or clean == title:
            continue
        if TASK_RE.search(clean) or RATING_RE.search(clean):
            return clean
    if RATING_RE.search(title):
        return RATING_RE.search(title).group(0)
    return ""


def find_solution(after_lines: list[str]) -> str:
    for line in after_lines:
        clean = normalize_space(line)
        if not clean:
            continue
        if clean.startswith("[") and clean.endswith("]"):
            return normalize_space(clean.strip("[]"))
        if clean.startswith("["):
            return normalize_space(clean.lstrip("[").rstrip("]"))
        if FEN_RE.search(clean):
            return ""
    return ""


def infer_motif(page_title: str, before_lines: list[str], task: str, solution: str) -> str:
    haystack = f" {page_title} {' '.join(before_lines[-14:])} {task} {solution} ".lower()
    for motif, keywords in MOTIF_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return motif
    return ""


def normalize_fen_for_app(fen: str) -> tuple[str, str]:
    parts = normalize_space(fen).split()
    if len(parts) != 6:
        return fen, "invalid_field_count"
    if parts[5] == "0":
        parts[5] = "1"
        return " ".join(parts), "fullmove_0_to_1"
    return " ".join(parts), ""


def side_to_move(fen: str) -> str:
    parts = normalize_space(fen).split()
    if len(parts) >= 2:
        return "white" if parts[1] == "w" else "black"
    return ""


def goal_type(task: str, motif: str, solution: str) -> str:
    combined = f"{task} {motif} {solution}".lower()
    if "mate" in combined or "#" in solution:
        return "mate"
    if "draw" in combined or "hold" in combined:
        return "hold_draw"
    return "gain_piece"


def level_tier(task: str, title: str) -> str:
    combined = f"{task} {title}"
    match = RATING_RE.search(combined)
    if not match:
        return "intermediate"
    rating = int(match.group(0).strip("()"))
    if rating < 1600:
        return "beginner"
    if rating < 2100:
        return "intermediate"
    if rating < 2400:
        return "advanced"
    return "expert"


def stable_id(source_url: str, fen: str) -> str:
    digest = hashlib.sha1(f"{source_url}|{fen}".encode("utf-8")).hexdigest()[:12]
    return f"wth-{digest}"


def extract_puzzles(source_url: str, html_text: str, link_label: str) -> list[dict[str, str]]:
    text, page_title = parse_page_text(html_text)
    page_title = page_title or link_label or source_url
    lines = [normalize_space(line) for line in text.splitlines() if normalize_space(line)]
    rows: list[dict[str, str]] = []

    for index, line in enumerate(lines):
        match = FEN_RE.search(line)
        if not match:
            continue

        raw_fen = normalize_space(match.group("fen"))
        app_fen, normalization_note = normalize_fen_for_app(raw_fen)
        before, after = line_window(lines, index)
        title = find_title(before, page_title)
        task = find_task(before, title)
        solution = find_solution(after)
        motif = infer_motif(page_title, before, task, solution)

        rows.append(
            {
                "id": stable_id(source_url, raw_fen),
                "source_name": "WTHarvey",
                "source_url": source_url,
                "page_title": page_title,
                "title": title,
                "task": task,
                "motif": motif,
                "raw_fen": raw_fen,
                "fen": app_fen,
                "fen_normalization": normalization_note,
                "side_to_move": side_to_move(app_fen),
                "solution": solution,
            }
        )

    return rows


def app_plan(row: dict[str, str]) -> str:
    parts = []
    if row["solution"]:
        parts.append(f"Find the forcing move: {row['solution']}.")
    elif row["task"]:
        parts.append(row["task"])
    else:
        parts.append("Find the forcing tactic from the position.")

    if row["motif"]:
        parts.append(f"Theme: {row['motif']}.")
    parts.append(f"Source: WTHarvey, {row['source_url']}")
    return " ".join(parts)


def write_raw_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "id",
        "source_name",
        "source_url",
        "page_title",
        "title",
        "task",
        "motif",
        "raw_fen",
        "fen",
        "fen_normalization",
        "side_to_move",
        "solution",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def write_app_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["title", "fen", "player_color", "plan", "goal_type", "level_tier", "status"]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "title": row["title"],
                    "fen": row["fen"],
                    "player_color": row["side_to_move"],
                    "plan": app_plan(row),
                    "goal_type": goal_type(row["task"], row["motif"], row["solution"]),
                    "level_tier": level_tier(row["task"], row["title"]),
                    "status": "unchecked",
                }
            )


def write_errors_csv(path: Path, errors: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=["source_url", "error"])
        writer.writeheader()
        writer.writerows(errors)


def dedupe_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    seen: set[str] = set()
    unique: list[dict[str, str]] = []
    for row in rows:
        key = row["raw_fen"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)
    return unique


def build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default=BASE_URL)
    parser.add_argument("--raw-out", type=Path, default=DEFAULT_RAW_OUT)
    parser.add_argument("--app-out", type=Path, default=DEFAULT_APP_OUT)
    parser.add_argument("--errors-out", type=Path, default=DEFAULT_ERRORS_OUT)
    parser.add_argument("--delay", type=float, default=1.0, help="Delay in seconds between page requests.")
    parser.add_argument("--timeout", type=int, default=25)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--limit", type=int, default=0, help="Limit pages for a quick test; 0 means no limit.")
    parser.add_argument("--include-duplicates", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    print(f"Fetching index: {args.base_url}")
    links = get_seed_links(args.base_url, timeout=args.timeout, retries=args.retries)
    if args.limit:
        links = links[: args.limit]
    print(f"Found {len(links)} candidate WTHarvey HTML pages.")

    rows: list[dict[str, str]] = []
    errors: list[dict[str, str]] = []

    for number, link in enumerate(links, 1):
        try:
            html_text = fetch_html(link.url, timeout=args.timeout, retries=args.retries)
            extracted = extract_puzzles(link.url, html_text, link.label)
            rows.extend(extracted)
            print(f"{number:4}/{len(links)} {link.url} -> {len(extracted)}")
        except Exception as error:  # noqa: BLE001 - keep crawl going and report at the end.
            errors.append({"source_url": link.url, "error": str(error)})
            print(f"{number:4}/{len(links)} {link.url} -> ERROR: {error}", file=sys.stderr)

        if args.delay > 0 and number < len(links):
            time.sleep(args.delay)

    if not args.include_duplicates:
        before = len(rows)
        rows = dedupe_rows(rows)
        print(f"Removed {before - len(rows)} duplicate FEN rows.")

    write_raw_csv(args.raw_out, rows)
    write_app_csv(args.app_out, rows)
    write_errors_csv(args.errors_out, errors)

    print(f"Saved raw puzzle data: {args.raw_out} ({len(rows)} rows)")
    print(f"Saved app-style tactics CSV: {args.app_out} ({len(rows)} rows)")
    print(f"Saved crawl errors: {args.errors_out} ({len(errors)} rows)")
    return 0 if not errors else 1


if __name__ == "__main__":
    raise SystemExit(main())
