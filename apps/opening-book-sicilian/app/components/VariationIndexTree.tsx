"use client";

import { memo, useContext } from "react";
import type { VariationIndexData, VariationNode, VariationToken } from "../lib/variation-index-parser";
import type { MoveNavigation } from "../lib/markdown-moves";
import { ActiveNavigationContext } from "./MarkdownRenderer";

type MoveHandler = (navigation: MoveNavigation) => void;

function isActiveStep(candidate: MoveNavigation, active: MoveNavigation | null): boolean {
  if (!active || candidate.index !== active.index) return false;
  for (let i = 0; i <= active.index; i++) {
    const cs = candidate.steps[i];
    const as = active.steps[i];
    if (!cs || !as || cs.fen !== as.fen || cs.label !== as.label) return false;
  }
  return true;
}

function VariationTokenButton({ token, onMove }: { token: VariationToken; onMove: MoveHandler }) {
  const activeNavigation = useContext(ActiveNavigationContext);
  if (!token.navigation) {
    return <span className="vi-token vi-token-unresolved">{token.display}</span>;
  }
  const active = isActiveStep(token.navigation, activeNavigation);
  return (
    <button
      type="button"
      className={`vi-token vi-token-move${active ? " vi-active" : ""}`}
      aria-label={`Show position after ${token.display}`}
      aria-current={active ? "step" : undefined}
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onMove(token.navigation!); }}
    >
      {token.display}
    </button>
  );
}

function VariationBranch({ node, onMove, depth }: { node: VariationNode; onMove: MoveHandler; depth: number }) {
  return (
    <div className="vi-branch" style={{ marginLeft: depth > 0 ? "1.5em" : undefined }}>
      <span className="vi-label">{node.labelDisplay}</span>
      <span className="vi-tokens">
        {node.tokens.map((token, i) => (
          <VariationTokenButton key={`${node.label}-tok-${i}`} token={token} onMove={onMove} />
        ))}
      </span>
      {node.children.map((child) => (
        <VariationBranch key={child.label} node={child} onMove={onMove} depth={depth + 1} />
      ))}
    </div>
  );
}

export const VariationIndexTree = memo(function VariationIndexTree({
  data,
  onMove,
}: {
  data: VariationIndexData;
  onMove: MoveHandler;
}) {
  return (
    <div className="variation-index-tree">
      <div className="vi-shared-line">
        {data.sharedTokens.map((token, i) => (
          <VariationTokenButton key={`shared-${i}`} token={token} onMove={onMove} />
        ))}
      </div>
      {data.rootNodes.map((node) => (
        <VariationBranch key={node.label} node={node} onMove={onMove} depth={0} />
      ))}
    </div>
  );
});
