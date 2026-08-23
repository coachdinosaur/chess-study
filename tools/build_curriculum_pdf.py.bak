import os
import subprocess
import fitz

# Mobile smartphone reading format (108mm x 168mm ~9:14 ratio)
# Single-column cards with responsive flex-distribution and rich overview screens

HTML_CONTENT = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Bishop Plus & Rook Master Curriculum - Mobile Edition</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

@page {
  size: 108mm 168mm;
  margin: 0;
}

*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  color: #0f172a;
  background: #f8fafc;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  font-size: 8.5pt;
  line-height: 1.35;
}

.mobile-page {
  width: 108mm;
  height: 168mm;
  max-height: 168mm;
  padding: 6mm 6.5mm 5mm 6.5mm;
  page-break-after: always;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  background: #f8fafc;
  overflow: hidden;
}

/* Header Cards */
.hero-card {
  border-radius: 7px;
  padding: 8.5px 11px;
  color: #ffffff;
  margin-bottom: 4px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.08);
}

.bishop-hero {
  background: linear-gradient(145deg, #0f766e 0%, #064e3b 100%);
  border: 1px solid #042f2e;
}

.rook-hero {
  background: linear-gradient(145deg, #1e3a8a 0%, #0f172a 100%);
  border: 1px solid #020617;
}

.hero-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
}

.eyebrow {
  font-size: 6.6pt;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: rgba(255, 255, 255, 0.2);
  padding: 2px 6px;
  border-radius: 3px;
}

.scope-pill {
  font-size: 7.2pt;
  font-weight: 700;
  background: rgba(255, 255, 255, 0.25);
  padding: 2px 7px;
  border-radius: 12px;
}

.hero-title {
  font-size: 14.5pt;
  font-weight: 900;
  letter-spacing: -0.02em;
  margin: 1.5px 0 1px 0;
}

.hero-subtitle {
  font-size: 8.4pt;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  margin-bottom: 2.5px;
}

.hero-meta {
  font-size: 7.1pt;
  color: rgba(255, 255, 255, 0.85);
  margin-bottom: 3.5px;
}

.hero-quote {
  background: rgba(0, 0, 0, 0.25);
  border-left: 3px solid #34d399;
  padding: 2.5px 6px;
  border-radius: 0 4px 4px 0;
  font-size: 7pt;
  font-style: italic;
  color: #f0fdf4;
  line-height: 1.25;
}

.hero-quote.rook-quote {
  border-left-color: #60a5fa;
  color: #eff6ff;
}

/* Framework Box */
.framework-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 5.5px 8px;
  margin-bottom: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
}

.framework-header {
  font-size: 6.9pt;
  font-weight: 800;
  text-transform: uppercase;
  color: #0f172a;
  letter-spacing: 0.04em;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 2px;
  margin-bottom: 3.5px;
  display: flex;
  justify-content: space-between;
}

.framework-grid-mobile {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2.5px 6px;
  font-size: 6.8pt;
  color: #334155;
}

.framework-grid-mobile div strong {
  color: #0f172a;
}

/* Phase Header */
.phase-banner {
  color: #ffffff;
  padding: 3.8px 8px;
  border-radius: 4px;
  font-size: 8pt;
  font-weight: 800;
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.phase-bishop {
  background: #115e59;
}

.phase-rook {
  background: #0f172a;
}

.phase-tag {
  font-size: 6.8pt;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.2);
  padding: 1px 5px;
  border-radius: 3px;
}

/* Module Container & Box with Auto Flex-Filling */
.module-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.module-box {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 5.5px 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  flex: 1;
  display: flex;
  flex-direction: column;
}

.module-title {
  font-size: 8.2pt;
  font-weight: 800;
  color: #0f172a;
  border-bottom: 1.5px solid #e2e8f0;
  padding-bottom: 2px;
  margin-bottom: 3.5px;
}

.mobile-lesson-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  flex: 1;
}

.mobile-lesson-item {
  font-size: 7.3pt;
  line-height: 1.25;
  color: #1e293b;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.lesson-title-text {
  flex: 1;
  padding-right: 4px;
}

.stars-badge {
  flex-shrink: 0;
  color: #475569;
  font-weight: 700;
  font-size: 6.4pt;
}

/* Roadmap Grid */
.roadmap-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
}

.roadmap-card {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 5px;
  padding: 5px 6.5px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  gap: 2px;
}

.roadmap-card h4 {
  margin: 0;
  font-size: 7.3pt;
  font-weight: 800;
  color: #0f172a;
  border-bottom: 1px solid #e2e8f0;
  padding-bottom: 1.5px;
}

.roadmap-card p {
  margin: 0;
  font-size: 6.6pt;
  color: #334155;
  line-height: 1.24;
}

.roadmap-desc {
  font-style: italic;
  color: #64748b;
  font-size: 6.2pt;
  margin-bottom: 1px;
  display: block;
}

/* Overview Standards Banner */
.overview-standards-card {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-left: 3.5px solid #0f766e;
  border-radius: 4px;
  padding: 4.5px 7px;
  font-size: 6.7pt;
  line-height: 1.25;
  color: #1e293b;
}

.overview-standards-card.rook-standards {
  border-left-color: #1e3a8a;
}

.overview-standards-card strong {
  color: #0f172a;
  font-size: 7pt;
}

/* Laboratory and Simulator Cards */
.lab-card-mobile {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.lab-title-mobile {
  font-size: 8pt;
  font-weight: 800;
  color: #0f172a;
  border-bottom: 1.5px solid #e2e8f0;
  padding-bottom: 2px;
  margin-bottom: 3.5px;
}

.lab-grid-mobile {
  display: grid;
  grid-template-columns: 1fr;
  gap: 3.5px;
  flex: 1;
}

.lab-set-item {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 4px;
  padding: 3.5px 5.5px;
  font-size: 6.9pt;
  line-height: 1.25;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.lab-set-item strong {
  color: #0f172a;
  display: block;
  font-size: 7.2pt;
  margin-bottom: 1px;
}

.simulator-card-mobile {
  background: #f0fdf4;
  border: 1.5px solid #86efac;
  border-radius: 6px;
  padding: 6px 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  margin-bottom: 4px;
}

.simulator-card-mobile h4 {
  margin: 0 0 2px 0;
  font-size: 8.2pt;
  font-weight: 800;
  color: #14532d;
}

.simulator-card-mobile p {
  margin: 0;
  font-size: 7pt;
  color: #166534;
  line-height: 1.26;
}

/* Footer */
.mobile-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 1px solid #cbd5e1;
  padding-top: 2.5px;
  font-size: 6.6pt;
  color: #64748b;
  font-weight: 500;
  margin-top: 2.5px;
}
</style>
</head>
<body>

<!-- BISHOP PLUS - SCREEN 1: LEVEL OVERVIEW & 9-STEP FRAMEWORK -->
<div class="mobile-page">
  <div class="module-container">
    <div class="hero-card bishop-hero">
      <div class="hero-top">
        <span class="eyebrow">Curriculum Blueprint</span>
        <span class="scope-pill">9 Modules • 90 Lessons</span>
      </div>
      <div class="hero-title">Level: Bishop Plus</div>
      <div class="hero-subtitle">Calculation, Conversion & Positional Technique</div>
      <div class="hero-meta">After: <strong>Bishop</strong> • Before: <strong>Rook</strong> • ★ to ★★★★</div>
      <div class="hero-quote">"I understand positions, calculate precisely, and can convert advantages into a win."</div>
    </div>

    <div class="framework-card">
      <div class="framework-header">
        <span>9-Step Lesson Training Framework</span>
        <span style="color:#0f766e; font-weight:700;">Bishop Plus</span>
      </div>
      <div class="framework-grid-mobile">
        <div><strong>1. Goal:</strong> Target capability</div>
        <div><strong>2. Core Idea:</strong> Rationale</div>
        <div><strong>3. Recognition:</strong> Triggers</div>
        <div><strong>4. Demo:</strong> Model position</div>
        <div><strong>5. Guided:</strong> Step walk</div>
        <div><strong>6. Practice:</strong> Graded FENs</div>
        <div><strong>7. Mistakes:</strong> Error fixes</div>
        <div><strong>8. Mastery:</strong> Unassisted</div>
        <div><strong>9. Transfer:</strong> Shift</div>
        <div style="color:#0f766e; font-weight:700;">★ Foundation to ★★★★ Mastery</div>
      </div>
    </div>

    <div class="roadmap-grid">
      <div class="roadmap-card">
        <h4>Phase 1: Endgames</h4>
        <span class="roadmap-desc">Pawn & minor piece precision</span>
        <p>• M1. Advanced King & Pawn<br>• M2. Minor Pieces & Fortresses</p>
      </div>
      <div class="roadmap-card">
        <h4>Phase 2: Tactics</h4>
        <span class="roadmap-desc">Coordination & cage nets</span>
        <p>• M3. Combinative Circuit<br>• M4. Trapping & Restricting</p>
      </div>
      <div class="roadmap-card">
        <h4>Phase 3: Strategy</h4>
        <span class="roadmap-desc">Weak squares & structure timing</span>
        <p>• M5. Outposts & Quality<br>• M6. Pawn Structures & Breaks</p>
      </div>
      <div class="roadmap-card">
        <h4>Phase 4: Calculation</h4>
        <span class="roadmap-desc">Tree search & conversion lab</span>
        <p>• M7. Candidate Calculation<br>• M8. Converting Advantages<br>• M9. 35-FEN Diagnostic Lab</p>
      </div>
    </div>

    <div class="overview-standards-card">
      <strong>Progression Benchmark Standard:</strong>
      Students must score ≥80% unassisted accuracy across all 7 diagnostic sets in Module 9 to qualify for graduation into <strong>Level: Rook</strong>.
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Bishop Plus • Overview (1/6)</span>
  </div>
</div>

<!-- BISHOP PLUS - SCREEN 2: PHASE 1 (M1 & M2) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-bishop">
      <span>Phase 1 — Advanced Endgame Control</span>
      <span class="phase-tag">Modules 1–2</span>
    </div>

    <div class="module-box">
      <div class="module-title">M1. Advanced King & Pawn Endgames</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.1 Direct Opposition Revisited</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.2 Distant & Lateral Opposition Mechanics</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.3 Diagonal Opposition & Stepping-In</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.4 The Art of Outflanking & Shouldering</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.5 Saving Pawn Tempi & Triangulation</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.6 Creating Zugzwang & Mined Squares</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.7 Key Squares and Pawn Escorts</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.8 Corner Traps & Rook/Knight-Pawn Rules</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.9 Pawn Races, Breakthroughs & Geometry</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.10 Endgame Conversion Test & Benchmark</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M2. Minor-Piece Endgames & Imbalances</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.1 Bishop vs. Pawns: Building a Barrier</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.2 Knight vs. Pawns: Stopping Passed Pawns</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.3 Bishop vs. Knight in Open vs. Closed</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.4 Opposite-Color Bishops: Fortresses</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.5 Same-Color Bishops: Fixed Pawns</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.6 Good vs. Bad Bishop: Active Outside Chain</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.7 Dominating with Central Knight Outpost</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.8 Two Bishops Working Together in Open</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.9 Bishop + Knight: W-Maneuver & Nets</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.10 Minor-Piece Endgame Benchmark</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Bishop Plus • Phase 1 (2/6)</span>
  </div>
</div>

<!-- BISHOP PLUS - SCREEN 3: PHASE 2 (M3 & M4) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-bishop">
      <span>Phase 2 — Tactical Coordination & Restriction</span>
      <span class="phase-tag">Modules 3–4</span>
    </div>

    <div class="module-box">
      <div class="module-title">M3. Deflection, Attraction & Circuit-Breaking</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.1 Defensive Targets & Loose Pieces</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.2 Deflecting Key Defenders</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.3 Attraction & Decoy onto Bad Squares</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.4 Removing Guard & Overloaded Pieces</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.5 Clearance Sacrifices: Lines vs. Squares</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.6 Breaking the Defensive Circuit</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.7 Interferences, Line Blocking & Blockades</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.8 X-Ray Attacks, Cross-Pins & Unpinning</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.9 Combining Pins, Forks & Discovered Hits</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.10 Mixed Advanced Tactical Benchmark</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M4. Piece Trapping & Restricted Mobility</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.1 Escape Squares & Geometric Bottlenecks</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.2 Building Pawn Nets & Domination Cages</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.3 Trapping Pieces on the Board Edge</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.4 How to Trap an Active Bishop</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.5 Fencing in an Edge Knight (Bishop Barrier)</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.6 Cutting Off and Trapping Rooks</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.7 Trapping and Restricting the Queen</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.8 Noah's Ark Trap & Classic Structure Traps</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.9 Stopping Escapes in Advance (Prophylaxis)</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.10 Piece-Trapping & Domination Lab</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Bishop Plus • Phase 2 (3/6)</span>
  </div>
</div>

<!-- BISHOP PLUS - SCREEN 4: PHASE 3 (M5 & M6) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-bishop">
      <span>Phase 3 — Positional Foundations & Breaks</span>
      <span class="phase-tag">Modules 5–6</span>
    </div>

    <div class="module-box">
      <div class="module-title">M5. Outposts, Weak Squares & Piece Quality</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.1 What Makes a True Outpost? (Anchor)</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.2 Permanent vs. Temporary Weaknesses</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.3 Color Complexes: Light vs. Dark Holes</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.4 Anchoring Pieces on Infiltration Outposts</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.5 Eliminating & Neutralizing Outposts</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.6 Fixing and Relocating Bad Bishops</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.7 Evaluating Bishop vs. Knight Imbalances</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.8 Improving Your Worst-Placed Piece</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.9 Planning Around Piece Activity & Cohesion</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.10 Positional Quality & Outpost Diagnostic</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M6. Pawn Structures & Strategic Breaks</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.1 Pawn Chains: Base vs. Head Dynamics</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.2 Attacking the Base of the Chain</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.3 Striking at the Head of the Chain</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.4 Pawn Tension: Maintain, Advance, or Trade</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.5 Pawn Hooks: Exploiting h3/h6 & g3/g6</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.6 Creating Weak Squares & Fixing Targets</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.7 Finding and Timing the Right Break</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.8 Open vs. Closed Centers: Re-Routing</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.9 Kingside vs. Queenside Flank Play</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.10 Choosing the Winning Strategic Plan</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Bishop Plus • Phase 3 (4/6)</span>
  </div>
</div>

<!-- BISHOP PLUS - SCREEN 5: PHASE 4 (M7 & M8) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-bishop">
      <span>Phase 4 — Calculation & Conversion</span>
      <span class="phase-tag">Modules 7–8</span>
    </div>

    <div class="module-box">
      <div class="module-title">M7. Candidate Moves & Blindfold Calculation</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.1 Checks, Captures, Threats (CCT) Filter</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.2 Blindfold Coordinate Parity & Geometry</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.3 Candidate Selection: 3-Candidate Rule</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.4 Falsification: Disproving First Ideas</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.5 Short Calculation Trees (2–3 Moves)</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.6 Blindfold Pawn Race & Queening Paths</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.7 Calculating Quiet Moves & Zwischenzug</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.8 Blindfold Minor-Piece Coordination</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.9 3-Move Deep Blindfold Tactical Tests</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.10 5-Move Calculation Mastery Test</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M8. Converting an Advantage</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.1 Extra Material: Simplification Rules</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.2 Converting Space: Clamping vs. Opening</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.3 Converting Superior Piece Activity</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.4 Exploiting Structural Holes & Weaknesses</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.5 Attacking Weakened King Safety</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.6 Simplifying without Relinquishing Edge</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.7 Principle of Two Weaknesses</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.8 Neutralizing Desperation Counterplay</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.9 Winning Without Overpressing</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.10 Full Advantage Conversion Benchmark</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Bishop Plus • Phase 4 (5/6)</span>
  </div>
</div>

<!-- BISHOP PLUS - SCREEN 6: M9 (Diagnostic Lab) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-bishop">
      <span>Phase 4 — Diagnostic Laboratory</span>
      <span class="phase-tag">Module 9</span>
    </div>

    <div class="lab-card-mobile">
      <div class="lab-title-mobile">M9. Practical Diagnostic Laboratory (35 Graded FENs)</div>
      <div class="lab-grid-mobile">
        <div class="lab-set-item"><strong>Set A (5 FENs): King & Pawn</strong>Opposition, Key Squares, Reserves, Queening</div>
        <div class="lab-set-item"><strong>Set B (5 FENs): Minor-Piece</strong>Fortresses, Outposts, Two Bishops, W-Maneuver</div>
        <div class="lab-set-item"><strong>Set C (5 FENs): Tactical Motifs</strong>Clearance, Deflection, Decoy, Circuit-Breaking</div>
        <div class="lab-set-item"><strong>Set D (5 FENs): Piece Trapping</strong>Noah's Ark, Edge Dominance, Knight Fencing</div>
        <div class="lab-set-item"><strong>Set E (5 FENs): Positional Decisions</strong>Pawn Levers, Outposts, Color Complexes, Breaks</div>
        <div class="lab-set-item"><strong>Set F (5 FENs): Blindfold Calculation</strong>Multi-Move Navigation, Coordinates, Pawn Races</div>
        <div class="lab-set-item"><strong>Set G (5 FENs): Full Conversion</strong>Converting Dynamic Initiative into Static Won Endgames</div>
      </div>
    </div>

    <div class="simulator-card-mobile">
      <h4>Mastery Verification Standard</h4>
      <p>Students must score ≥80% unassisted accuracy across all 7 diagnostic sets to qualify for promotion to <strong>Level: Rook</strong>.</p>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Bishop Plus • Laboratory (6/6)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 1: LEVEL OVERVIEW & 9-STEP FRAMEWORK -->
<div class="mobile-page">
  <div class="module-container">
    <div class="hero-card rook-hero">
      <div class="hero-top">
        <span class="eyebrow">Curriculum Blueprint</span>
        <span class="scope-pill">14 Modules • 140 Lessons</span>
      </div>
      <div class="hero-title">Level: Rook</div>
      <div class="hero-subtitle">Strategy, Endgames & Complete Position Play</div>
      <div class="hero-meta">After: <strong>Bishop Plus</strong> • Before: <strong>Queen / Master</strong> • ★ to ★★★★</div>
      <div class="hero-quote rook-quote">"I formulate holistic plans, anticipate opponent counterplay, and calculate deeply from middlegame to endgame."</div>
    </div>

    <div class="framework-card">
      <div class="framework-header">
        <span>9-Step Lesson Training Framework</span>
        <span style="color:#1e3a8a; font-weight:700;">Rook Level</span>
      </div>
      <div class="framework-grid-mobile">
        <div><strong>1. Goal:</strong> Strategic target</div>
        <div><strong>2. Core Idea:</strong> GM Principle</div>
        <div><strong>3. Recognition:</strong> Pattern cues</div>
        <div><strong>4. Demo:</strong> Model master game</div>
        <div><strong>5. Guided:</strong> Step-by-step tree</div>
        <div><strong>6. Practice:</strong> Graded FENs</div>
        <div><strong>7. Mistakes:</strong> Anti-blunder fixes</div>
        <div><strong>8. Mastery:</strong> Blindfold/Timer</div>
        <div><strong>9. Transfer:</strong> Carryover simulator</div>
        <div style="color:#1e3a8a; font-weight:700;">★ Intermediate to ★★★★ Master</div>
      </div>
    </div>

    <div class="roadmap-grid">
      <div class="roadmap-card">
        <h4>Phase 1: Endgames</h4>
        <span class="roadmap-desc">Rook dynamics & defense</span>
        <p>• M1. Rook Activity & Tarrasch<br>• M2. Lucena & Philidor Holds<br>• M3. Minor Pieces & Fortresses</p>
      </div>
      <div class="roadmap-card">
        <h4>Phase 2: Strategy</h4>
        <span class="roadmap-desc">Structures & heavy batteries</span>
        <p>• M4. IQP & Carlsbad Structures<br>• M5. Asymmetric Imbalances<br>• M6. Infiltration & Alekhine Gun</p>
      </div>
      <div class="roadmap-card">
        <h4>Phase 3: Prophylaxis</h4>
        <span class="roadmap-desc">Restraint & 5-move calculation</span>
        <p>• M7. Restraint & King Safety<br>• M8. Visualization & Trees<br>• M9. Dynamic to Static Edges</p>
      </div>
      <div class="roadmap-card">
        <h4>Phase 4: Simulator</h4>
        <span class="roadmap-desc">Decision labs & GM games</span>
        <p>• M10–M11 Conversion & Structure<br>• M12–M13 Prophylaxis & Blindfold<br>• M14 5-Stage GM Simulator</p>
      </div>
    </div>

    <div class="overview-standards-card rook-standards">
      <strong>Master Level Graduation Standard:</strong>
      Students must score ≥80% accuracy in M10–M13 decision labs and successfully complete all 5 phases of the M14 Grandmaster Carryover Simulator suite.
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Overview (1/8)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 2: PHASE 1 (M1 & M2) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-rook">
      <span>Phase 1 — Complete Endgame Mastery</span>
      <span class="phase-tag">Modules 1–2</span>
    </div>

    <div class="module-box">
      <div class="module-title">M1. Rook Activity & Dynamics</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.1 Active vs. Passive Rook Play</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.2 3-Square Checking Distance</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.3 Cutting Off King: Horizontal & Vertical</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.4 Checking from Behind (Rear Checks)</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.5 Side Checking from Maximum Distance</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.6 Tarrasch Rule: Behind Passed Pawns</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.7 Defending in Front of Passed Pawn</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.8 Creating Outside Passed Pawns</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.9 King Containment & 4-Rook Mating Nets</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 1.10 Rook Activity Benchmark Test</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M2. Theoretical Rook Endgames</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.1 Lucena: Fundamental Bridge</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.2 Bridge Building: 4th vs. 5th Rank</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.3 King Escapes & Path Geometry</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.4 Common Mistakes in Lucena Position</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.5 Philidor: 3rd-Rank Defensive Barrier</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.6 Philidor: Dropping Back for Rear Checks</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.7 Short-Side Defense vs. Long-Side Checks</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.8 Vancura: Lateral Checks on Rook Pawn</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.9 Selection Matrix: Lucena vs. Philidor</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 2.10 K+Q vs. K+R Cross-Check Conversion</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Phase 1 (2/8)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 3: PHASE 1 & 2 (M3 & M4) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-rook">
      <span>Phase 1 & 2 — Fortresses & Structures</span>
      <span class="phase-tag">Modules 3–4</span>
    </div>

    <div class="module-box">
      <div class="module-title">M3. Complex Minor Pieces & Fortresses</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.1 Opposite-Bishops: 2 Passed Pawns</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.2 Same-Color: Fixing Dual Flank Targets</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.3 Bishop vs. Knight on Both Flanks</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.4 Knight Triangulation & Outposts</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.5 Outside Passed Pawns as Decoys</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.6 Building Unbreakable Fortresses</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.7 Active Kings & Rule of Shouldering</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.8 Trading into Won Pawn Endgames</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.9 Dismantling Defensive Fortresses</span><span class="stars-badge">(★★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 3.10 Minor-Piece Conversion Benchmark</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M4. Foundational Pawn Structures & Breaks</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.1 Isolated Queen's Pawn (IQP) Play</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.2 IQP Attack: Dynamic d4-d5 Breaks</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.3 Playing Against IQP: Blockades & Trades</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.4 Hanging Pawns: Space vs. Targets</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.5 Carlsbad: Queenside Minority Attack</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.6 Carlsbad: Central Attacks with e4</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.7 Maróczy Bind & Hedgehog Formations</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.8 Locked Chains: French & KID Wedges</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.9 Backward Pawns & Half-Open Files</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 4.10 Strategic Structure Mastery Test</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Phase 1 & 2 (3/8)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 4: PHASE 2 (M5 & M6) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-rook">
      <span>Phase 2 — Imbalances & Heavy Pieces</span>
      <span class="phase-tag">Modules 5–6</span>
    </div>

    <div class="module-box">
      <div class="module-title">M5. Piece Imbalances & Relative Dominance</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.1 Bishop Pair: Opening Diagonals</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.2 Bishop vs. Knight Asymmetry</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.3 Exploiting Good vs. Bad Bishops</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.4 Closed Center Octopus Knights</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.5 Positional Exchange Sacrifices</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.6 Space Advantages & Board Clamping</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.7 Two Bishops vs. Two Knights</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.8 Evaluating Imbalanced Exchanges</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.9 When to Trade: The 4 Trade Rules</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 5.10 Piece-Quality Strategic Diagnostic</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M6. Rook & Heavy-Piece Infiltration</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.1 Seizing Open Files & Infiltration</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.2 Pressure on Semi-Open Files</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.3 7th Rank Penetration (Blind Swine)</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.4 Doubling Rooks on Open Files</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.5 Alekhine's Gun: Triple Battery</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.6 Heavy Pieces Behind Passed Pawns</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.7 King Cut-Offs & 7th-Rank Nets</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.8 Queen and Rook Tandem Invasions</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.9 Major Piece Endgames (Q+R vs Q+R)</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 6.10 Heavy-Piece Conversion Benchmark</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Phase 2 (4/8)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 5: PHASE 3 (M7 & M8) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-rook">
      <span>Phase 3 — Prophylaxis & Deep Calculation</span>
      <span class="phase-tag">Modules 7–8</span>
    </div>

    <div class="module-box">
      <div class="module-title">M7. Prophylaxis & Defensive Restraint</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.1 Asking "What Does Opponent Want?"</span><span class="stars-badge">(★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.2 Identifying Opponent's Main Plan</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.3 Stopping Counterplay Before Attacking</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.4 Preventing Opponent Pawn Breaks</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.5 Restricting Active Enemy Pieces</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.6 Overprotection of Critical Squares</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.7 Prophylactic King Moves (Kh1/Kh8)</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.8 Defensive Re-Routing & Preventive Trades</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.9 Quiet Preventive Moves (h3/a3/g3)</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 7.10 Prophylactic Mastery Test</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="module-box">
      <div class="module-title">M8. Tactical Calculation & Visualization</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.1 Building a Candidate-Move Tree</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.2 Blindfold Heavy-Piece Geometry</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.3 Calculating 3–4 Move Forcing Lines</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.4 Stepping-Stone Quiet Moves</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.5 Blindfold Rook Line Navigation</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.6 Visualizing 5-Move Variations</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.7 Anticipating Toughest Defense</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.8 Advanced Zwischenzug & Interference</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.9 Desperado Piece Sacrifices</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 8.10 Blindfold Tactical Mastery</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Phase 3 (5/8)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 6: PHASE 3 (M9) & LABS (M10, M11) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-rook">
      <span>Phase 3 & 4 — Dynamics & Conversion Labs</span>
      <span class="phase-tag">Modules 9–11</span>
    </div>

    <div class="module-box">
      <div class="module-title">M9. Dynamic vs. Static Advantages</div>
      <ul class="mobile-lesson-list">
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.1 Seizing & Keeping the Initiative</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.2 Turning Development into Attack</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.3 Measuring Initiative Duration</span><span class="stars-badge">(★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.4 Space Advantages vs. Weak Holes</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.5 Attacking Weakened King Positions</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.6 Dynamic Material Compensation</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.7 Positional Exchange Sacrifices</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.8 Pawn Sacrifices for Open Lines</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.9 Transforming Dynamic to Static Edges</span><span class="stars-badge">(★★★)</span></li>
        <li class="mobile-lesson-item"><span class="lesson-title-text">• 9.10 When to Simplify into Won Endgame</span><span class="stars-badge">(★★★★)</span></li>
      </ul>
    </div>

    <div class="lab-card-mobile">
      <div class="lab-title-mobile">M10. Endgame Conversion Lab</div>
      <p style="margin:0; font-size:6.9pt; color:#334155; line-height:1.24;">Live engine defense drills: Lucena bridge under 60s timer, Philidor hold positions, Vančura side-checks, and active vs. passive king cutoffs.</p>
    </div>

    <div class="lab-card-mobile">
      <div class="lab-title-mobile">M11. Strategic Structure Lab</div>
      <p style="margin:0; font-size:6.9pt; color:#334155; line-height:1.24;">Practical FEN setups: IQP d4-d5 breakouts & blockades, Carlsbad minority advances, Maróczy clamp defense, and locked-chain breaks.</p>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Phase 3 & 4 (6/8)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 7: LABS (M12, M13) -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-rook">
      <span>Phase 4 — Practical Decision Labs</span>
      <span class="phase-tag">Modules 12–13</span>
    </div>

    <div class="lab-card-mobile">
      <div class="lab-title-mobile">M12. Prophylaxis Threat-Detection Lab</div>
      <p style="margin:0 0 3px 0; font-size:7pt; color:#334155; line-height:1.25;">Defensive master scenarios: the student must identify and articulate the engine's hidden tactical/strategic plan 2-3 moves ahead before making their own move.</p>
      <div class="lab-grid-mobile">
        <div class="lab-set-item"><strong>Drill 12.1:</strong> Spotting 2-move hidden tactical threats</div>
        <div class="lab-set-item"><strong>Drill 12.2:</strong> Neutralizing incoming pawn breaks in advance</div>
        <div class="lab-set-item"><strong>Drill 12.3:</strong> Prophylactic king safety retreats (Kh1 vs Kf1)</div>
        <div class="lab-set-item"><strong>Drill 12.4:</strong> Anti-desperation defense against sacrifices</div>
      </div>
    </div>

    <div class="lab-card-mobile">
      <div class="lab-title-mobile">M13. Deep Calculation & Blindfold Lab</div>
      <p style="margin:0 0 3px 0; font-size:7pt; color:#334155; line-height:1.25;">Complex multi-branching tactical positions and off-board line visualization requiring calculation of 3–5 candidate moves down to quiet evaluations.</p>
      <div class="lab-grid-mobile">
        <div class="lab-set-item"><strong>Drill 13.1:</strong> 3-Candidate Move Comparison & Evaluation</div>
        <div class="lab-set-item"><strong>Drill 13.2:</strong> 6-Move Blindfold King+Pawn Race Reconstruction</div>
        <div class="lab-set-item"><strong>Drill 13.3:</strong> Finding move-4 quiet stepping-stone moves</div>
        <div class="lab-set-item"><strong>Drill 13.4:</strong> 5-Move Full Tree Verification & Submission</div>
      </div>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Decision Labs (7/8)</span>
  </div>
</div>

<!-- ROOK LEVEL - SCREEN 8: M14 FULL GAME SIMULATOR -->
<div class="mobile-page">
  <div class="module-container">
    <div class="phase-banner phase-rook">
      <span>Phase 4 — Grandmaster Simulation</span>
      <span class="phase-tag">Module 14</span>
    </div>

    <div class="simulator-card-mobile" style="margin-bottom: 4px;">
      <h4>M14. Full-Game Carryover Simulator</h4>
      <p>A multi-stage grandmaster game simulation suite where the student carries decisions across all 5 game phases:</p>
      <p style="margin-top: 2px; font-weight: 700; color: #0f172a; font-size:6.7pt;">Opening Transition → Structure Selection → Strategic Prophylaxis → Dynamic Break → Technical Endgame Conversion</p>
    </div>

    <div class="lab-card-mobile">
      <div class="lab-title-mobile">5 Grandmaster Simulator Archetypes</div>
      <div class="lab-grid-mobile">
        <div class="lab-set-item"><strong>Sim 1 (QGD Carlsbad):</strong> Minority attack b4-b5, stopping e5 break, 7th-rank rook conversion.</div>
        <div class="lab-set-item"><strong>Sim 2 (Nimzo IQP):</strong> Dynamic d4-d5 piece sacrifice break into queen mating net.</div>
        <div class="lab-set-item"><strong>Sim 3 (Sicilian Najdorf):</strong> Flank attack vs center counter, Two Bishops endgame conversion.</div>
        <div class="lab-set-item"><strong>Sim 4 (KID Locked):</strong> Stopping queenside infiltration, f4-f5 dynamic king attack.</div>
        <div class="lab-set-item"><strong>Sim 5 (English Hedgehog):</strong> Maróczy clamp, positional exchange sacrifice on c6.</div>
      </div>
    </div>
  </div>

  <div class="mobile-footer">
    <span>Coach Dinosaur • Mobile Syllabus</span>
    <span>Rook Level • Simulator (8/8)</span>
  </div>
</div>

</body>
</html>
"""

def main():
    temp_html = os.path.join(os.environ.get("TEMP", "."), "curriculum_mobile_v6.html")
    output_pdf = r"C:\Users\Ronaldo\Downloads\Bishop_Plus_and_Rook_Master_Curriculum_Complete.pdf"
    out_dir = r"C:\Users\Ronaldo\.gemini\antigravity\brain\5569c036-cd2a-43d5-a7a5-0357cdbe84a7"

    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(HTML_CONTENT)

    print("HTML written to:", temp_html)

    edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if not os.path.exists(edge_path):
        edge_path = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"

    cmd = [
        edge_path,
        "--headless=new",
        "--disable-gpu",
        "--no-pdf-header-footer",
        f"--print-to-pdf={output_pdf}",
        temp_html
    ]

    print("Running Edge PDF compilation...")
    res = subprocess.run(cmd, capture_output=True, text=True)
    print("Exit code:", res.returncode)

    if os.path.exists(output_pdf):
        doc = fitz.open(output_pdf)
        print(f"Total Mobile Screens: {len(doc)}")
        for i, page in enumerate(doc):
            pix = page.get_pixmap(dpi=150)
            png_path = os.path.join(out_dir, f"screen_{i+1}.png")
            pix.save(png_path)
        print("Screens exported to:", out_dir)
        print("Done!")

if __name__ == "__main__":
    main()
