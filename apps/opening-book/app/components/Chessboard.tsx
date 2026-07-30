"use client";

/* Chess pieces are local SVG sprites sized by their board squares. */
/* eslint-disable @next/next/no-img-element */

import { memo, useMemo, useState } from "react";
import { Chess, Square } from "chess.js";
import type { BoardMoveInput, PromotionPiece } from "../board-analysis";
import { legalTargets } from "../board-analysis";
import { assetUrl } from "../lib/asset-url";

export const Chessboard = memo(function Chessboard({ fen, flipped = false, onMove, lastMove }: { fen: string; flipped?: boolean; onMove?: (move: BoardMoveInput) => void; lastMove?: BoardMoveInput | null }) {
  const chess = useMemo(() => new Chess(fen), [fen]);
  const interactive = Boolean(onMove);
  const boardKey = `${fen}:${flipped ? "flipped" : "normal"}`;
  const [selectionState, setSelectionState] = useState<{ boardKey: string; square: Square | null }>({ boardKey, square: null });
  const [promotionState, setPromotionState] = useState<{ boardKey: string; move: { from: Square; to: Square } | null }>({ boardKey, move: null });
  const selected = selectionState.boardKey === boardKey ? selectionState.square : null;
  const promotion = promotionState.boardKey === boardKey ? promotionState.move : null;
  const setSelected = (square: Square | null) => setSelectionState({ boardKey, square });
  const setPromotion = (move: { from: Square; to: Square } | null) => setPromotionState({ boardKey, move });
  const targets = useMemo(() => selected ? legalTargets(fen, selected) : [], [fen, selected]);
  const files = flipped ? ["h", "g", "f", "e", "d", "c", "b", "a"] : ["a", "b", "c", "d", "e", "f", "g", "h"];
  const ranks = flipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];

  const targetFor = (square: Square) => targets.filter((target) => target.to === square);
  const selectSquare = (square: Square) => {
    if (!interactive || !onMove) return;
    const piece = chess.get(square);
    const options = targetFor(square);
    if (selected) {
      if (square === selected) {
        setSelected(null);
        return;
      }
      if (options.length) {
        if (options.some((target) => target.promotion)) setPromotion({ from: selected, to: square });
        else onMove({ from: selected, to: square });
        setSelected(null);
        return;
      }
      setSelected(piece?.color === chess.turn() ? square : null);
      return;
    }
    if (piece?.color === chess.turn()) setSelected(square);
  };
  const dropMove = (from: Square, to: Square) => {
    if (!interactive || !onMove) return;
    const fromTargets = legalTargets(fen, from);
    const options = fromTargets.filter((target) => target.to === to);
    if (!options.length) {
      setSelected(null);
      return;
    }
    if (options.some((target) => target.promotion)) setPromotion({ from, to });
    else onMove({ from, to });
    setSelected(null);
  };
  const choosePromotion = (piece: PromotionPiece) => {
    if (promotion && onMove) onMove({ from: promotion.from, to: promotion.to, promotion: piece });
    setPromotion(null);
    setSelected(null);
  };
  const boardLabel = interactive ? `Interactive chess position: ${fen}` : `Chess position: ${fen}`;
  return <div className={`board ${interactive ? "interactive" : ""}`} role={interactive ? "grid" : "img"} aria-label={boardLabel}>
    {ranks.flatMap((rank) => files.map((file) => {
      const square = `${file}${rank}` as Square;
      const piece = chess.get(square);
      const light = (file.charCodeAt(0) - 97 + rank) % 2 === 0;
      const options = targetFor(square);
      const isSelected = selected === square;
      const isLastMove = lastMove?.from === square || lastMove?.to === square;
      const classes = `square ${light ? "light" : "dark"} ${interactive ? "interactive" : ""} ${isSelected ? "selected" : ""} ${options.length ? "legal-target" : ""} ${options.some((target) => target.capture) ? "capture-target" : ""} ${isLastMove ? "last-move" : ""}`;
      const content = <>
        {piece && <img data-color={piece.color} data-piece={piece.type} draggable={false} decoding="async" src={assetUrl(`assets/pieces/mpchess/${piece.color}${piece.type.toUpperCase()}.svg`)} alt={`${piece.color === "w" ? "White" : "Black"} ${piece.type}`} />}
        {file === files[0] && <span className="rank-label">{rank}</span>}
        {rank === ranks[ranks.length - 1] && <span className="file-label">{file}</span>}
      </>;
      const description = `${square}, ${piece ? `${piece.color === "w" ? "white" : "black"} ${piece.type}` : "empty"}${isSelected ? ", selected" : ""}${options.length ? ", legal destination" : ""}`;
      if (!interactive) return <div className={classes} key={square}>{content}</div>;
      return <button
        type="button"
        className={classes}
        key={square}
        aria-label={description}
        draggable={Boolean(piece)}
        onClick={() => selectSquare(square)}
        onDragStart={(event) => {
          if (!piece || piece.color !== chess.turn()) { event.preventDefault(); return; }
          setSelected(square);
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", square);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const source = event.dataTransfer.getData("text/plain") as Square;
          if (source && source !== square) {
            setSelected(source);
            dropMove(source, square);
          }
        }}
      >{content}</button>;
    }))}
    {promotion && <div className="promotion-picker" role="dialog" aria-modal="true" aria-label="Choose promotion piece">
      <strong>Promote pawn</strong>
      <div>{(["q", "r", "b", "n"] as const).map((piece) => <button type="button" key={piece} onClick={() => choosePromotion(piece)} aria-label={`Promote to ${piece === "q" ? "queen" : piece === "r" ? "rook" : piece === "b" ? "bishop" : "knight"}`}><img decoding="async" src={assetUrl(`assets/pieces/mpchess/${chess.get(promotion.from)?.color ?? "w"}${piece.toUpperCase()}.svg`)} alt="" /></button>)}</div>
      <button type="button" className="promotion-cancel" onClick={() => setPromotion(null)}>Cancel</button>
    </div>}
  </div>;
});
