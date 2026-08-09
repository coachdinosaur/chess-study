"use client";

/* Static lesson diagrams use the same local piece sprites as the main board. */
/* eslint-disable @next/next/no-img-element */

import { createContext, memo, ReactNode, useContext, useMemo } from "react";
import { Chess, type Square } from "chess.js";
import { MarkdownMoveResolver, type MarkdownMoveToken, type MoveNavigation } from "../lib/markdown-moves";
import { extractFenBlocks } from "../lib/markdown-chapter";
import { loadAllChapters } from "../lib/chapter-markdown-loader";
import { sharedOpeningAssetUrl } from "../lib/asset-url";
type MoveHandler = (navigation: MoveNavigation) => void;

export const ActiveNavigationContext = createContext<MoveNavigation | null>(null);

function isActiveNavigationStep(candidate: MoveNavigation, active: MoveNavigation | null): boolean {
  if (!active || candidate.index !== active.index) return false;
  for (let index = 0; index <= active.index; index++) {
    const candidateStep = candidate.steps[index];
    const activeStep = active.steps[index];
    if (!candidateStep || !activeStep || candidateStep.fen !== activeStep.fen || candidateStep.label !== activeStep.label) return false;
  }
  return true;
}

const InteractiveMove = memo(function InteractiveMove({ display, navigation, onMove }: { display: string; navigation: MoveNavigation; onMove: MoveHandler }) {
  const activeNavigation = useContext(ActiveNavigationContext);
  const active = isActiveNavigationStep(navigation, activeNavigation);
  return <button
    type="button"
    className={`inline-move interactive-move${active ? " active" : ""}`}
    aria-label={`Show position after ${display}`}
    aria-current={active ? "step" : undefined}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onMove(navigation);
    }}
  >{display}</button>;
});

function StaticChessboard({ fen }: { fen: string }) {
  const chess = new Chess(fen);
  const pieces: ReactNode[] = [];
  for (let rank = 8; rank >= 1; rank--) {
    for (let file = 0; file < 8; file++) {
      const square = `${String.fromCharCode(97 + file)}${rank}` as Square;
      const piece = chess.get(square);
      if (!piece) continue;
      pieces.push(<img
        alt=""
        aria-hidden="true"
        className="static-board-piece"
        data-color={piece.color}
        data-piece={piece.type}
        decoding="async"
        key={square}
        src={sharedOpeningAssetUrl(`assets/pieces/mpchess/${piece.color}${piece.type.toUpperCase()}.svg`)}
        style={{ left: `${file * 12.5}%`, top: `${(8 - rank) * 12.5}%` }}
      />);
    }
  }
  return <div className="static-board" role="img" aria-label={`Chess position: ${fen}`}>{pieces}</div>;
}

function FenBoard({ fen, label, navigation, onMove }: { fen: string; label: string; navigation: MoveNavigation; onMove: MoveHandler }) {
  try { new Chess(fen); }
  catch { return <div className="fen-invalid" role="alert">Invalid FEN position</div>; }
  return <div className="fen-block">
    <div className="fen-heading">
      <strong>{label}</strong>
      <button type="button" onClick={() => onMove(navigation)}>Show on main board</button>
    </div>
    <div className="fen-board-container"><StaticChessboard fen={fen} /></div>
    <code className="fen-string">{fen}</code>
  </div>;
}

function renderPlaceholders(template: string, tokens: MarkdownMoveToken[], onMove: MoveHandler, key: string): ReactNode[] {
  const placeholder = /\uE000(\d+)\uE001/g;
  const result: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = placeholder.exec(template)) !== null) {
    if (match.index > cursor) result.push(template.slice(cursor, match.index));
    const token = tokens[Number(match[1])];
    if (token.navigation) {
      result.push(<InteractiveMove
        display={token.display}
        navigation={token.navigation}
        onMove={onMove}
        key={`${key}-move-${match[1]}`}
      />);
    } else {
      result.push(<span key={`${key}-plain-${match[1]}`}>{token.display}</span>);
    }
    cursor = placeholder.lastIndex;
  }
  if (cursor < template.length) result.push(template.slice(cursor));
  return result;
}

function renderFormatted(template: string, tokens: MarkdownMoveToken[], onMove: MoveHandler, key: string): ReactNode[] {
  const inline = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  const output: ReactNode[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = inline.exec(template)) !== null) {
    if (match.index > cursor) output.push(...renderPlaceholders(template.slice(cursor, match.index), tokens, onMove, `${key}-${cursor}`));
    const content = match[2] ?? match[3] ?? match[4] ?? match[5] ?? "";
    const children = renderPlaceholders(content, tokens, onMove, `${key}-${match.index}`);
    if (match[2] !== undefined) output.push(<strong key={`${key}-bolditalic-${match.index}`}><em>{children}</em></strong>);
    else if (match[3] !== undefined) output.push(<strong key={`${key}-bold-${match.index}`}>{children}</strong>);
    else if (match[4] !== undefined) output.push(<em key={`${key}-italic-${match.index}`}>{children}</em>);
    else output.push(<code key={`${key}-code-${match.index}`}>{children}</code>);
    cursor = inline.lastIndex;
  }
  if (cursor < template.length) output.push(...renderPlaceholders(template.slice(cursor), tokens, onMove, `${key}-${cursor}`));
  return output;
}

function renderInline(text: string, resolver: MarkdownMoveResolver, onMove: MoveHandler, key: string): ReactNode[] {
  const commentRanges = [...text.matchAll(/<!--[\s\S]*?-->/g)].map((match) => ({
    start: match.index ?? 0,
    end: (match.index ?? 0) + match[0].length,
  }));
  const visibleText = text.replace(/<!--[\s\S]*?-->/g, "");
  const tokens = resolver.resolveText(text).map((token) => ({
    ...token,
    index: token.index - commentRanges
      .filter((range) => range.end <= token.index)
      .reduce((removed, range) => removed + range.end - range.start, 0),
  }));
  if (tokens.length === 0) return renderFormatted(visibleText, tokens, onMove, key);
  let template = visibleText;
  for (let index = tokens.length - 1; index >= 0; index--) {
    const token = tokens[index];
    template = `${template.slice(0, token.index)}\uE000${index}\uE001${template.slice(token.index + token.display.length)}`;
  }
  return renderFormatted(template, tokens, onMove, key);
}

function parseMarkdown(markdown: string, onMove: MoveHandler, resolver = new MarkdownMoveResolver()): ReactNode[] {
  const lines = markdown.split(/\r?\n/);
  const nodes: ReactNode[] = [];
  extractFenBlocks(markdown).forEach(({ fen }, fenIndex) => resolver.addRoot(fen, `Chapter position ${fenIndex + 1}`));
  let index = 0;
  let currentHeading = "Diagram position";

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed) { index++; continue; }

    const hiddenFen = /^<!--\s*FEN:\s*([^>]+?)\s*-->$/.exec(trimmed);
    if (hiddenFen) {
      try { resolver.setAnchor(hiddenFen[1].trim(), "Variation start"); } catch { /* surfaced by chapter checks */ }
      index++;
      continue;
    }

    if (trimmed.startsWith("**FEN:**")) {
      const next = lines[index + 1]?.trim() ?? "";
      const fenMatch = /^`([^`]+)`$/.exec(next);
      if (fenMatch) {
        const fen = fenMatch[1].trim();
        try {
          const label = currentHeading === "Diagram position" ? currentHeading : `${currentHeading} position`;
          const navigation = resolver.setAnchor(fen, label);
          nodes.push(<FenBoard fen={fen} label={label} navigation={navigation} onMove={onMove} key={`fen-${index}`} />);
        } catch {
          nodes.push(<div className="fen-invalid" role="alert" key={`fen-${index}`}>Invalid FEN position</div>);
        }
        index += 2;
        continue;
      }
    }

    if (/^---+\s*$/.test(trimmed)) {
      nodes.push(<hr key={`hr-${index}`} />);
      index++;
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      currentHeading = heading[2].replace(/[*_`]/g, "").trim();
      const content = renderInline(heading[2], resolver, onMove, `heading-${index}`);
      if (level === 1) nodes.push(<h1 key={`h1-${index}`}>{content}</h1>);
      else if (level === 2) nodes.push(<h2 className="page-heading-markdown" key={`h2-${index}`}>{content}</h2>);
      else if (level === 3) nodes.push(<h3 key={`h3-${index}`}>{content}</h3>);
      else if (level === 4) nodes.push(<h4 key={`h4-${index}`}>{content}</h4>);
      else if (level === 5) nodes.push(<h5 key={`h5-${index}`}>{content}</h5>);
      else nodes.push(<h6 key={`h6-${index}`}>{content}</h6>);
      index++;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items: ReactNode[] = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        const item = lines[index].replace(/^\s*[-*]\s+/, "");
        items.push(<li key={`item-${index}`}>{renderInline(item, resolver, onMove, `item-${index}`)}</li>);
        index++;
      }
      nodes.push(<ul key={`list-${index}`}>{items}</ul>);
      continue;
    }

    const paragraph = [line];
    index++;
    while (index < lines.length) {
      const next = lines[index];
      const nextTrimmed = next.trim();
      if (!nextTrimmed || /^#{1,6}\s/.test(next) || /^---+\s*$/.test(nextTrimmed) || /^\s*[-*]\s+/.test(next) || nextTrimmed.startsWith("**FEN:**") || /^<!--\s*FEN:/.test(nextTrimmed)) break;
      paragraph.push(next);
      index++;
    }
    const text = paragraph.join("\n");
    const isVi = paragraph.some((l) => /^[A-Z]\d*\)/.test(l.trim()));
    nodes.push(<p key={`paragraph-${index}`} className={isVi ? "variation-index-p" : undefined}>{renderInline(text, resolver, onMove, `paragraph-${index}`)}</p>);
  }
  return nodes;
}

const ignoreMove: MoveHandler = () => {};

function precedingMarkdown(markdown: string): string {
  for (const chapter of loadAllChapters()) {
    const pageIndex = chapter.pages.findIndex((page) => page.markdown === markdown);
    if (pageIndex > 0) return chapter.pages.slice(0, pageIndex).map((page) => page.markdown).join("\n\n");
  }
  return "";
}

export const MarkdownChapterView = memo(function MarkdownChapterView({ markdown, onMove, activeNavigation = null }: { markdown: string; onMove: MoveHandler; activeNavigation?: MoveNavigation | null }) {
  const elements = useMemo(() => {
    const resolver = new MarkdownMoveResolver();
    const priorMarkdown = precedingMarkdown(markdown);
    if (priorMarkdown) parseMarkdown(priorMarkdown, ignoreMove, resolver);
    return parseMarkdown(markdown, onMove, resolver);
  }, [markdown, onMove]);
  return <ActiveNavigationContext value={activeNavigation}>
    <article className="narrative markdown-narrative" aria-label="Chapter lesson">{elements}</article>
  </ActiveNavigationContext>;
});
