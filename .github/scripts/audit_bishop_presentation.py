from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

from playwright.sync_api import sync_playwright


INDEX = Path("lessons/bishop-index.html")
REPORT = Path(".github/bishop-presentation-audit.json")


def normalized(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip().lower()


def main() -> None:
    index_text = INDEX.read_text(encoding="utf-8")
    filenames = sorted(
        set(re.findall(r"[\"'](bishop-(?:m\d+-)?lesson-[^\"']+\.html)[\"']", index_text))
    )
    report: dict[str, object] = {"lesson_count": len(filenames), "lessons": [], "summary": {}}

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})

        for filename in filenames:
            page_errors: list[str] = []
            errors: list[str] = []
            page.on("pageerror", lambda error, bucket=page_errors: bucket.append(str(error)))
            page.goto(f"http://127.0.0.1:8000/lessons/{filename}", wait_until="networkidle")
            page.wait_for_timeout(350)

            header = page.evaluate(
                """() => {
                  const header = document.querySelector('.index-header');
                  const inner = document.querySelector('.index-header-inner');
                  const icon = document.querySelector('.index-brand-icon');
                  const action = document.querySelector('.index-top-actions .toolbar-link');
                  const style = node => node ? getComputedStyle(node) : null;
                  const rect = node => node ? node.getBoundingClientRect() : null;
                  return {
                    header: header ? {
                      display: style(header).display,
                      position: style(header).position,
                      background: style(header).backgroundColor
                    } : null,
                    inner: inner ? {
                      width: rect(inner).width,
                      maxWidth: style(inner).maxWidth,
                      paddingLeft: style(inner).paddingLeft,
                      minHeight: style(inner).minHeight
                    } : null,
                    icon: icon ? {
                      width: rect(icon).width,
                      height: rect(icon).height,
                      radius: style(icon).borderRadius
                    } : null,
                    action: action ? {
                      radius: style(action).borderRadius,
                      minHeight: style(action).minHeight,
                      padding: style(action).padding
                    } : null,
                    stylesheets: Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
                      .map(link => link.getAttribute('href'))
                  };
                }"""
            )

            launch = page.locator(".lesson-present-launch")
            launch_count = launch.count()
            scenes: list[dict[str, object]] = []
            blank_indices: list[int] = []
            exact_duplicates: list[list[int]] = []
            near_duplicates: list[list[object]] = []
            repeated_titles: list[list[object]] = []

            if launch_count:
                launch.first.click()
                page.wait_for_timeout(250)
                scene_count = page.locator(".presentation-scene").count()
                seen_text: dict[str, int] = {}
                seen_titles: dict[str, int] = {}

                for index in range(scene_count):
                    current = page.locator(".presentation-scene.presentation-current")
                    if current.count() != 1:
                        errors.append(
                            f"Expected one current scene at index {index + 1}, found {current.count()}"
                        )
                        break

                    data = page.evaluate(
                        """() => {
                          const scene = document.querySelector('.presentation-scene.presentation-current');
                          const label = document.querySelector('.lesson-presentation-scene-label');
                          if (!scene) return null;
                          const clone = scene.cloneNode(true);
                          clone.querySelectorAll(
                            '.no-print,.lesson-nav-row,.fen-box,.source-note,.presentation-coach-only,script,style'
                          ).forEach(node => node.remove());
                          const text = (clone.innerText || clone.textContent || '')
                            .replace(/\s+/g, ' ').trim();
                          return {
                            title: label ? label.textContent.trim() : '',
                            text,
                            media: scene.querySelectorAll('[data-fen],img[src],svg,canvas,iframe').length,
                            visibleElementCount: Array.from(scene.querySelectorAll('*')).filter(node => {
                              const s = getComputedStyle(node);
                              const r = node.getBoundingClientRect();
                              return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
                            }).length
                          };
                        }"""
                    )
                    if not data:
                        errors.append(f"Could not read scene {index + 1}")
                        break

                    text_key = normalized(str(data["text"]))
                    title_key = normalized(str(data["title"]))
                    scenes.append(
                        {
                            "index": index + 1,
                            "title": data["title"],
                            "text_length": len(text_key),
                            "media_count": data["media"],
                            "visible_element_count": data["visibleElementCount"],
                            "preview": str(data["text"])[:220],
                        }
                    )

                    if len(text_key) < 24 and int(data["media"]) == 0:
                        blank_indices.append(index + 1)
                    if text_key:
                        if text_key in seen_text:
                            exact_duplicates.append([seen_text[text_key], index + 1])
                        else:
                            for previous_text, previous_index in list(seen_text.items()):
                                if min(len(previous_text), len(text_key)) >= 60:
                                    ratio = difflib.SequenceMatcher(None, previous_text, text_key).ratio()
                                    if ratio >= 0.92:
                                        near_duplicates.append([previous_index, index + 1, round(ratio, 3)])
                            seen_text[text_key] = index + 1
                    if title_key:
                        if title_key in seen_titles:
                            repeated_titles.append([seen_titles[title_key], index + 1, data["title"]])
                        else:
                            seen_titles[title_key] = index + 1

                    if index < scene_count - 1:
                        page.locator('[data-presentation-action="next"]').click()
                        page.wait_for_timeout(80)

                page.locator('[data-presentation-action="exit"]').click()
            else:
                scene_count = 0
                errors.append("Present Lesson button missing")

            report["lessons"].append(
                {
                    "file": filename,
                    "launch_count": launch_count,
                    "scene_count": scene_count,
                    "blank_scenes": blank_indices,
                    "exact_duplicates": exact_duplicates,
                    "near_duplicates": near_duplicates,
                    "repeated_titles": repeated_titles,
                    "header": header,
                    "page_errors": page_errors,
                    "errors": errors,
                    "scenes": scenes,
                }
            )

        browser.close()

    lessons = report["lessons"]
    report["summary"] = {
        "missing_launch_button": [item["file"] for item in lessons if item["launch_count"] == 0],
        "blank_scene_lessons": {item["file"]: item["blank_scenes"] for item in lessons if item["blank_scenes"]},
        "exact_duplicate_lessons": {item["file"]: item["exact_duplicates"] for item in lessons if item["exact_duplicates"]},
        "near_duplicate_lessons": {item["file"]: item["near_duplicates"] for item in lessons if item["near_duplicates"]},
        "repeated_title_lessons": {item["file"]: item["repeated_titles"] for item in lessons if item["repeated_titles"]},
        "page_error_lessons": {item["file"]: item["page_errors"] for item in lessons if item["page_errors"]},
        "module1_without_endgame_css": [
            item["file"]
            for item in lessons
            if item["file"].startswith("bishop-m1-")
            and not any("endgame-lesson.css" in (href or "") for href in item["header"]["stylesheets"])
        ],
    }
    REPORT.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))


if __name__ == "__main__":
    main()
