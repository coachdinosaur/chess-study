import os
import subprocess
import sys
import tempfile

import fitz

DEFAULT_PDF = r"C:\Users\Ronaldo\Documents\dev\open\Bishop_Plus_and_Rook_Master_Curriculum_v2.pdf"

CSS = """
@page { size: 108mm 168mm; margin: 0; }
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Segoe UI', system-ui, Roboto, 'Helvetica Neue', Arial, sans-serif;
  color: #0f172a; background: #f8fafc; -webkit-print-color-adjust: exact; print-color-adjust: exact;
  font-size: 8.5pt; line-height: 1.35; }
.mobile-page { width: 108mm; height: 168mm; padding: 5.5mm 6.5mm 4.5mm; page-break-after: always;
  display: flex; flex-direction: column; position: relative; background: #f8fafc; overflow: hidden; }
.mobile-page:last-child { page-break-after: auto; }
.content { flex: 1; display: flex; flex-direction: column; gap: 4px; min-height: 0; }
.mobile-footer { flex-shrink: 0; display: flex; justify-content: space-between; align-items: center;
  border-top: 1px solid #cbd5e1; padding-top: 2.5px; margin-top: 3px; font-size: 6.6pt; color: #64748b; font-weight: 600; }

.hero-card { border-radius: 7px; padding: 8px 11px; color: #ffffff; box-shadow: 0 2px 5px rgba(0,0,0,0.08); }
.bishop-hero { background: linear-gradient(145deg, #0f766e 0%, #064e3b 100%); border: 1px solid #042f2e; }
.rook-hero { background: linear-gradient(145deg, #1e3a8a 0%, #0f172a 100%); border: 1px solid #020617; }
.hero-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2px; }
.eyebrow { font-size: 6.6pt; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
  background: rgba(255,255,255,0.2); padding: 2px 6px; border-radius: 3px; }
.scope-pill { font-size: 7pt; font-weight: 700; background: rgba(255,255,255,0.25); padding: 2px 7px; border-radius: 12px; }
.hero-title { font-size: 14pt; font-weight: 900; letter-spacing: -0.02em; margin: 1.5px 0 1px; }
.hero-subtitle { font-size: 8.2pt; font-weight: 600; color: rgba(255,255,255,0.95); margin-bottom: 2.5px; }
.hero-meta { font-size: 7pt; color: rgba(255,255,255,0.85); margin-bottom: 3.5px; }
.hero-quote { background: rgba(0,0,0,0.25); border-left: 3px solid #34d399; padding: 2.5px 6px;
  border-radius: 0 4px 4px 0; font-size: 7pt; font-style: italic; color: #f0fdf4; line-height: 1.25; }
.rook-quote { border-left-color: #60a5fa; color: #eff6ff; }

.framework-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.framework-header { font-size: 6.9pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 3px; display: flex; justify-content: space-between; }
.framework-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 6px; font-size: 6.8pt; color: #334155; }
.framework-grid strong { color: #0f172a; }
.fw-note { grid-column: 1 / -1; margin-top: 1px; padding-top: 2px; border-top: 1px dashed #e2e8f0; font-weight: 700; font-size: 6.4pt; }
.bishop .fw-note { color: #0f766e; }
.rook .fw-note { color: #1e3a8a; }

.phase-banner { color: #ffffff; padding: 4px 8px; border-radius: 4px; font-size: 8pt; font-weight: 800;
  display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
.phase-banner.bishop { background: #115e59; }
.phase-banner.rook { background: #0f172a; }
.phase-tag { font-size: 6.8pt; font-weight: 600; background: rgba(255,255,255,0.2); padding: 1px 5px; border-radius: 3px; white-space: nowrap; }

.module-box { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5px 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03); flex: 1; display: flex; flex-direction: column; min-height: 0; }
.module-title { font-size: 8.2pt; font-weight: 800; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 3px; }
.mchip { display: inline-block; color: #ffffff; font-size: 6.2pt; font-weight: 800; border-radius: 3px;
  padding: 0.5px 4px; margin-right: 4px; vertical-align: 1.2px; }
.bishop .mchip { background: #0f766e; }
.rook .mchip { background: #1e3a8a; }
.lessons { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column;
  justify-content: space-between; flex: 1; min-height: 0; }
.lesson { display: flex; justify-content: space-between; align-items: baseline; font-size: 7.2pt; line-height: 1.22; color: #1e293b; }
.lt { flex: 1; padding-right: 4px; }
.lt::before { content: ""; display: inline-block; width: 3px; height: 3px; border-radius: 50%;
  background: #94a3b8; margin-right: 4px; vertical-align: 1.6px; }
.dots { flex-shrink: 0; white-space: nowrap; }
.dots i { display: inline-block; width: 2.6px; height: 2.6px; border-radius: 50%; margin-left: 1.7px; vertical-align: 1px; }
.dots i.on { background: #475569; }
.dots i.off { background: #cbd5e1; }
.lesson.bench .lt { font-weight: 700; }
.bishop .lesson.bench .lt { color: #0f766e; }
.rook .lesson.bench .lt { color: #1e3a8a; }
.bishop .lesson.bench .dots i.on { background: #0f766e; }
.rook .lesson.bench .dots i.on { background: #1e3a8a; }

.roadmap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.overview .roadmap-grid { flex: 1; }
.overview .roadmap-card { display: flex; flex-direction: column; }
.roadmap-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 5px; padding: 4.5px 6.5px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03); }
.roadmap-card h4 { margin: 0; font-size: 7.3pt; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 1.5px; }
.rd { display: block; font-style: italic; color: #64748b; font-size: 6.2pt; margin: 1px 0; }
.roadmap-card p { margin: 0; font-size: 6.6pt; color: #334155; line-height: 1.3; }

.standards-card { border: 1px solid #cbd5e1; border-left: 3.5px solid #0f766e; border-radius: 4px;
  background: #ffffff; padding: 4.5px 7px; font-size: 6.7pt; line-height: 1.28; color: #1e293b; }
.rook .standards-card { border-left-color: #1e3a8a; }
.standards-card strong { color: #0f172a; font-size: 7pt; }

.lab-card { background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 5.5px 8px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03); flex: 1; display: flex; flex-direction: column; min-height: 0; }
.lab-title { font-size: 8pt; font-weight: 800; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 2px; margin-bottom: 3px; }
.lab-desc { margin: 0 0 3px; font-size: 6.9pt; color: #334155; line-height: 1.26; }
.lab-grid { display: grid; grid-template-columns: 1fr; gap: 3px; flex: 1; }
.lab-item { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 3px 5.5px;
  font-size: 6.9pt; line-height: 1.24; color: #334155; display: flex; flex-direction: column; justify-content: center; }
.lab-item strong { color: #0f172a; font-size: 7.1pt; }

.sim-card { background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 6px; padding: 5.5px 8px; }
.sim-card h4 { margin: 0 0 2px; font-size: 8.2pt; font-weight: 800; color: #14532d; }
.sim-card p { margin: 0; font-size: 7pt; color: #166534; line-height: 1.28; }
.stage-chips { display: flex; flex-wrap: wrap; gap: 2.5px; margin-top: 3px; }
.stage-chips span { font-size: 6.3pt; font-weight: 700; color: #14532d; background: #dcfce7;
  border: 1px solid #86efac; border-radius: 8px; padding: 1px 5px; }

.cover { background: linear-gradient(165deg, #0f172a 0%, #113b36 55%, #0f172a 100%); color: #ffffff; }
.cover .content { gap: 5px; justify-content: space-evenly; }
.cover .content > div { margin: 2px 0; }
.cover-brand { display: flex; justify-content: space-between; align-items: center; }
.brand-name { font-size: 8.5pt; font-weight: 900; letter-spacing: 0.14em; }
.brand-tag { font-size: 6.4pt; font-weight: 700; background: rgba(255,255,255,0.15); padding: 2px 7px; border-radius: 10px; }
.cover-eyebrow { font-size: 6.6pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: #5eead4; margin-bottom: 2px; }
.cover-title { font-size: 19pt; font-weight: 900; line-height: 1.06; letter-spacing: -0.02em; }
.cover-sub { font-size: 7.6pt; color: rgba(255,255,255,0.85); line-height: 1.35; margin-top: 3px; }
.path-card { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.16); border-radius: 6px; padding: 5px 8px; }
.path-label { font-size: 6.4pt; font-weight: 800; text-transform: uppercase; letter-spacing: 0.08em;
  color: rgba(255,255,255,0.7); margin-bottom: 3px; }
.path-chips { display: flex; flex-wrap: wrap; gap: 2.5px; }
.chip { font-size: 6.5pt; font-weight: 600; background: rgba(255,255,255,0.12); border-radius: 9px;
  padding: 1.5px 6px; color: rgba(255,255,255,0.85); }
.chip.hot-b { background: #0f766e; color: #ffffff; font-weight: 800; }
.chip.hot-r { background: #1d4ed8; color: #ffffff; font-weight: 800; }
.cover-levels { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
.cov-level { background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.16);
  border-top: 2.5px solid #0f766e; border-radius: 6px; padding: 5px 7px; }
.cov-level.rook-l { border-top-color: #3b82f6; }
.cov-level h4 { margin: 0 0 1.5px; font-size: 8pt; font-weight: 800; }
.cov-level p { margin: 0; font-size: 6.4pt; color: rgba(255,255,255,0.8); line-height: 1.32; }
.cover-note { background: rgba(255,255,255,0.07); border-left: 3px solid #34d399; border-radius: 0 4px 4px 0;
  padding: 4px 7px; font-size: 6.6pt; line-height: 1.3; color: rgba(255,255,255,0.88); }
.cover .mobile-footer { border-top-color: rgba(255,255,255,0.25); color: rgba(255,255,255,0.75); }
"""

B_M1 = ("M1", "Advanced King & Pawn Endgames", [
    ("1.1 Direct Opposition Revisited", 1),
    ("1.2 Distant & Lateral Opposition Mechanics", 2),
    ("1.3 Diagonal Opposition & Stepping-In", 2),
    ("1.4 Outflanking & Shouldering", 2),
    ("1.5 Triangulation & Gaining Tempi", 3),
    ("1.6 Zugzwang & Mined Squares", 3),
    ("1.7 Key Squares & Pawn Escorts", 3),
    ("1.8 Rook-Pawn Corners & Knight-Pawn Rules", 3),
    ("1.9 Pawn Races, Breakthroughs & Geometry", 3),
    ("1.10 Endgame Conversion Benchmark", 4),
])

B_M2 = ("M2", "Minor-Piece Endgames & Imbalances", [
    ("2.1 Bishop vs. Pawns: Building a Barrier", 1),
    ("2.2 Knight vs. Pawns: Stopping Passed Pawns", 1),
    ("2.3 Bishop vs. Knight: Open vs. Closed Positions", 2),
    ("2.4 Opposite-Color Bishops: Fortresses", 2),
    ("2.5 Same-Color Bishops: Fixed Pawns", 2),
    ("2.6 Good vs. Bad Bishop: The Outside Chain", 2),
    ("2.7 Dominating with a Central Knight Outpost", 3),
    ("2.8 Two Bishops in Open Positions", 3),
    ("2.9 Bishop + Knight: W-Maneuver & Mating Nets", 3),
    ("2.10 Minor-Piece Endgame Benchmark", 4),
])

B_M3 = ("M3", "Deflection, Attraction & Circuit-Breaking", [
    ("3.1 Defensive Targets & Loose Pieces", 1),
    ("3.2 Deflecting Key Defenders", 2),
    ("3.3 Attraction & Decoy onto Bad Squares", 2),
    ("3.4 Removing the Guard & Overloaded Pieces", 2),
    ("3.5 Clearance Sacrifices: Lines vs. Squares", 2),
    ("3.6 Breaking the Defensive Circuit", 3),
    ("3.7 Interference, Line Blocking & Blockades", 3),
    ("3.8 X-Ray Attacks, Cross-Pins & Unpinning", 3),
    ("3.9 Combining Pins, Forks & Discovered Attacks", 3),
    ("3.10 Mixed Advanced Tactics Benchmark", 4),
])

B_M4 = ("M4", "Piece Trapping & Restricted Mobility", [
    ("4.1 Escape Squares & Geometric Bottlenecks", 1),
    ("4.2 Pawn Nets & Domination Cages", 2),
    ("4.3 Trapping Pieces on the Edge", 2),
    ("4.4 Trapping an Active Bishop", 2),
    ("4.5 Fencing In an Edge Knight", 2),
    ("4.6 Cutting Off & Trapping Rooks", 3),
    ("4.7 Trapping & Restricting the Queen", 3),
    ("4.8 Noah's Ark Trap & Structure Traps", 3),
    ("4.9 Stopping Escapes in Advance (Prophylaxis)", 3),
    ("4.10 Piece-Trapping & Domination Lab", 4),
])

B_M5 = ("M5", "Outposts, Weak Squares & Piece Quality", [
    ("5.1 What Makes a True Outpost?", 1),
    ("5.2 Permanent vs. Temporary Weaknesses", 2),
    ("5.3 Color Complexes: Light vs. Dark Holes", 2),
    ("5.4 Anchoring Pieces on Infiltration Squares", 2),
    ("5.5 Neutralizing Enemy Outposts", 2),
    ("5.6 Fixing & Relocating Bad Bishops", 3),
    ("5.7 Bishop vs. Knight Imbalances", 3),
    ("5.8 Improving Your Worst-Placed Piece", 3),
    ("5.9 Plans Around Piece Activity & Cohesion", 3),
    ("5.10 Positional Quality & Outpost Diagnostic", 4),
])

B_M6 = ("M6", "Pawn Structures & Strategic Breaks", [
    ("6.1 Pawn Chains: Base vs. Head Dynamics", 1),
    ("6.2 Attacking the Base of the Chain", 2),
    ("6.3 Striking at the Head of the Chain", 2),
    ("6.4 Pawn Tension: Maintain, Advance, or Trade", 2),
    ("6.5 Pawn Hooks: The h3/h6 & g3/g6 Levers", 2),
    ("6.6 Creating Weak Squares & Fixing Targets", 3),
    ("6.7 Finding & Timing the Right Break", 3),
    ("6.8 Open vs. Closed Centers & Re-Routing", 3),
    ("6.9 Kingside vs. Queenside Flank Play", 3),
    ("6.10 Choosing the Winning Strategic Plan", 4),
])

B_M7 = ("M7", "Candidate Moves & Blindfold Calculation", [
    ("7.1 Checks, Captures & Threats: The CCT Filter", 1),
    ("7.2 Blindfold Coordinates & Board Geometry", 1),
    ("7.3 Candidate Selection: The 3-Candidate Rule", 2),
    ("7.4 Falsification: Disproving First Ideas", 2),
    ("7.5 Short Calculation Trees (2-3 Moves)", 2),
    ("7.6 Blindfold Pawn Races & Queening Paths", 3),
    ("7.7 Quiet Moves & the Zwischenzug", 3),
    ("7.8 Blindfold Minor-Piece Coordination", 3),
    ("7.9 3-Move Deep Blindfold Tactical Tests", 3),
    ("7.10 5-Move Calculation Mastery Test", 4),
])

B_M8 = ("M8", "Converting an Advantage", [
    ("8.1 Extra Material: Simplification Rules", 1),
    ("8.2 Converting Space: Clamping vs. Opening", 2),
    ("8.3 Converting Superior Piece Activity", 2),
    ("8.4 Exploiting Structural Holes & Weaknesses", 2),
    ("8.5 Attacking Weakened King Safety", 2),
    ("8.6 Simplifying Without Relinquishing the Edge", 3),
    ("8.7 The Principle of Two Weaknesses", 3),
    ("8.8 Neutralizing Desperation Counterplay", 3),
    ("8.9 Winning Without Overpressing", 3),
    ("8.10 Full Advantage Conversion Benchmark", 4),
])

R_M1 = ("M1", "Rook Activity & Dynamics", [
    ("1.1 Active vs. Passive Rook Play", 1),
    ("1.2 The 3-Square Checking Distance", 1),
    ("1.3 Cutting Off the King: Horizontal & Vertical", 2),
    ("1.4 Rear Checks: Checking from Behind", 2),
    ("1.5 Side Checks from Maximum Distance", 2),
    ("1.6 Tarrasch Rule: Rooks Behind Passed Pawns", 2),
    ("1.7 Defending In Front of a Passed Pawn", 3),
    ("1.8 Creating Outside Passed Pawns", 3),
    ("1.9 King Containment & Two-Rook Mating Nets", 3),
    ("1.10 Rook Activity Benchmark", 4),
])

R_M2 = ("M2", "Theoretical Rook Endgames", [
    ("2.1 Lucena: The Fundamental Bridge", 1),
    ("2.2 Building the Bridge: 4th vs. 5th Rank", 2),
    ("2.3 King Escapes & Path Geometry", 2),
    ("2.4 Common Mistakes in Lucena Positions", 2),
    ("2.5 Philidor: The 3rd-Rank Barrier", 2),
    ("2.6 Philidor: Dropping Back for Rear Checks", 2),
    ("2.7 Short-Side Defense vs. Long-Side Checks", 3),
    ("2.8 Vancura: Lateral Checks vs. the Rook Pawn", 3),
    ("2.9 Selection Matrix: Lucena vs. Philidor", 3),
    ("2.10 K+Q vs. K+R: Cross-Checks & Conversion", 4),
])

R_M3 = ("M3", "Complex Minor Pieces & Fortresses", [
    ("3.1 Opposite Bishops: Two Passed Pawns", 2),
    ("3.2 Same-Color Bishops: Dual Flank Targets", 2),
    ("3.3 Bishop vs. Knight on Both Flanks", 2),
    ("3.4 Knight Triangulation & Outposts", 3),
    ("3.5 Outside Passed Pawns as Decoys", 3),
    ("3.6 Building Unbreakable Fortresses", 3),
    ("3.7 Active Kings & Shouldering", 3),
    ("3.8 Trading into Won Pawn Endgames", 3),
    ("3.9 Dismantling Defensive Fortresses", 4),
    ("3.10 Minor-Piece Conversion Benchmark", 4),
])

R_M4 = ("M4", "Foundational Pawn Structures & Breaks", [
    ("4.1 Isolated Queen's Pawn (IQP) Play", 1),
    ("4.2 IQP Attack: The Dynamic d4-d5 Break", 2),
    ("4.3 Against the IQP: Blockades & Trades", 2),
    ("4.4 Hanging Pawns: Space vs. Targets", 2),
    ("4.5 Carlsbad: The Queenside Minority Attack", 3),
    ("4.6 Carlsbad: The Central e4 Strike", 3),
    ("4.7 The Maróczy Bind & Hedgehog Formations", 3),
    ("4.8 Locked Chains: French & KID Wedges", 3),
    ("4.9 Backward Pawns & Half-Open Files", 3),
    ("4.10 Strategic Structure Mastery Test", 4),
])

R_M5 = ("M5", "Piece Imbalances & Relative Dominance", [
    ("5.1 The Bishop Pair: Opening Diagonals", 1),
    ("5.2 Bishop vs. Knight Asymmetry", 2),
    ("5.3 Exploiting Good vs. Bad Bishops", 2),
    ("5.4 Octopus Knights in Closed Centers", 2),
    ("5.5 Positional Exchange Sacrifices", 3),
    ("5.6 Space Advantage & Board Clamping", 3),
    ("5.7 Two Bishops vs. Two Knights", 3),
    ("5.8 Evaluating Imbalanced Exchanges", 3),
    ("5.9 When to Trade: The 4 Trade Rules", 3),
    ("5.10 Piece-Quality Strategic Diagnostic", 4),
])

R_M6 = ("M6", "Rook & Heavy-Piece Infiltration", [
    ("6.1 Seizing Open Files", 1),
    ("6.2 Pressure on Semi-Open Files", 2),
    ("6.3 7th-Rank Penetration: Blind Swine", 2),
    ("6.4 Doubling Rooks on the Open File", 2),
    ("6.5 Alekhine's Gun: The Triple Battery", 3),
    ("6.6 Heavy Pieces Behind Passed Pawns", 3),
    ("6.7 King Cut-Offs & 7th-Rank Nets", 3),
    ("6.8 Queen + Rook Tandem Invasions", 3),
    ("6.9 Major-Piece Endgames (Q+R vs. Q+R)", 3),
    ("6.10 Heavy-Piece Conversion Benchmark", 4),
])

R_M7 = ("M7", "Prophylaxis & Defensive Restraint", [
    ("7.1 Asking: What Does My Opponent Want?", 1),
    ("7.2 Identifying the Opponent's Main Plan", 2),
    ("7.3 Stopping Counterplay Before Attacking", 2),
    ("7.4 Preventing Opponent Pawn Breaks", 2),
    ("7.5 Restricting Active Enemy Pieces", 2),
    ("7.6 Overprotecting Critical Squares", 3),
    ("7.7 Prophylactic King Moves (Kh1/Kh8)", 3),
    ("7.8 Defensive Re-Routing & Preventive Trades", 3),
    ("7.9 Quiet Preventive Moves (h3, a3, g3)", 3),
    ("7.10 Prophylactic Mastery Test", 4),
])

R_M8 = ("M8", "Tactical Calculation & Visualization", [
    ("8.1 Building the Candidate-Move Tree", 2),
    ("8.2 Blindfold Heavy-Piece Geometry", 2),
    ("8.3 Calculating 3-4 Move Forcing Lines", 2),
    ("8.4 Stepping-Stone Quiet Moves", 3),
    ("8.5 Blindfold Rook Line Navigation", 3),
    ("8.6 Visualizing 5-Move Variations", 3),
    ("8.7 Anticipating the Toughest Defense", 3),
    ("8.8 Advanced Zwischenzug & Interference", 3),
    ("8.9 Desperado Piece Sacrifices", 3),
    ("8.10 Blindfold Tactical Mastery", 4),
])

R_M9 = ("M9", "Dynamic vs. Static Advantages", [
    ("9.1 Seizing & Keeping the Initiative", 2),
    ("9.2 Turning Development into Attack", 2),
    ("9.3 Measuring Initiative Duration", 2),
    ("9.4 Space Advantages vs. Weak Holes", 3),
    ("9.5 Attacking Weakened King Positions", 3),
    ("9.6 Dynamic Material Compensation", 3),
    ("9.7 Exchange Sacrifices for the Initiative", 3),
    ("9.8 Pawn Sacrifices for Open Lines", 3),
    ("9.9 Transforming Dynamic into Static Edges", 3),
    ("9.10 When to Simplify into a Won Endgame", 4),
])

BISHOP_LAB_SETS = [
    ("Set A (5 FENs) | King & Pawn", "Opposition, key squares, reserve tempi, promotion races"),
    ("Set B (5 FENs) | Minor-Piece", "Fortresses, outposts, two bishops, W-maneuver"),
    ("Set C (5 FENs) | Tactical Motifs", "Clearance, deflection, decoy, circuit-breaking"),
    ("Set D (5 FENs) | Piece Trapping", "Noah's Ark, edge dominance, knight fencing"),
    ("Set E (5 FENs) | Positional Decisions", "Pawn levers, outposts, color complexes, breaks"),
    ("Set F (5 FENs) | Blindfold Calculation", "Multi-move navigation, coordinates, pawn races"),
    ("Set G (5 FENs) | Full Conversion", "Dynamic initiative into static won endgames"),
]

ROOK_LABS = {
    "M10": ("Endgame Conversion Lab",
            "Live engine defense drills: Lucena bridge building against a 60-second clock, Philidor hold positions, Vancura lateral side-checks, and active vs. passive king cut-off drills."),
    "M11": ("Strategic Structure Lab",
            "Practical FEN setups: IQP d4-d5 breakouts & blockades, Carlsbad minority advances, Maróczy clamp defense, and locked-chain break timing."),
    "M12": ("Prophylaxis Threat-Detection Lab",
            "Defensive master scenarios: identify and articulate the engine's hidden plan 2-3 moves ahead before making your own move."),
    "M13": ("Deep Calculation & Blindfold Lab",
            "Multi-branching tactical positions and off-board visualization: calculate 3-5 candidate moves down to quiet evaluations."),
}

ROOK_DRILLS = {
    "M12": [
        ("Drill 12.1", "Spotting 2-move hidden tactical threats"),
        ("Drill 12.2", "Neutralizing incoming pawn breaks in advance"),
        ("Drill 12.3", "Prophylactic king safety retreats (Kh1 vs Kf1)"),
        ("Drill 12.4", "Anti-desperation defense against sacrifices"),
    ],
    "M13": [
        ("Drill 13.1", "3-Candidate Move Comparison & Evaluation"),
        ("Drill 13.2", "6-Move Blindfold King+Pawn Race Reconstruction"),
        ("Drill 13.3", "Finding move-4 quiet stepping-stone moves"),
        ("Drill 13.4", "5-Move Full Tree Verification & Submission"),
    ],
}

SIM_STAGES = ["1. Opening Transition", "2. Structure Selection", "3. Strategic Prophylaxis",
              "4. Dynamic Break", "5. Technical Conversion"]

GM_SIMS = [
    ("Sim 1 | QGD Carlsbad", "Minority attack b4-b5, stopping the e5 break, 7th-rank rook conversion."),
    ("Sim 2 | Nimzo IQP", "Dynamic d4-d5 piece-sacrifice break into a mating net."),
    ("Sim 3 | Sicilian Najdorf", "Flank attack vs. central counter, two-bishops endgame conversion."),
    ("Sim 4 | KID Locked", "Stopping queenside infiltration, f4-f5 dynamic king attack."),
    ("Sim 5 | English Hedgehog", "Maróczy clamp play, positional exchange sacrifice on c6."),
]

BISHOP_CFG = {
    "id": "bishop",
    "label": "Bishop Plus",
    "scope": "9 Modules | 90 Lessons",
    "title": "Level: Bishop Plus",
    "subtitle": "Calculation, Conversion & Positional Technique",
    "after": "Bishop",
    "before": "Rook",
    "quote": '"I understand positions, calculate precisely, and can convert advantages into a win."',
    "steps": [("1", "Goal", "Target capability"), ("2", "Core Idea", "Rationale"),
              ("3", "Recognition", "Triggers"), ("4", "Demo", "Model position"),
              ("5", "Guided", "Step walk"), ("6", "Practice", "Graded FENs"),
              ("7", "Mistakes", "Error fixes"), ("8", "Mastery", "Unassisted"),
              ("9", "Transfer", "Skill shift")],
    "roadmap": [
        ("Phase 1: Endgames", "Pawn & minor piece precision", "M1 Advanced King & Pawn<br>M2 Minor Pieces & Fortresses"),
        ("Phase 2: Tactics", "Coordination & cage nets", "M3 Deflection & Circuit-Breaking<br>M4 Trapping & Restricting"),
        ("Phase 3: Strategy", "Weak squares & structure timing", "M5 Outposts & Piece Quality<br>M6 Structures & Breaks"),
        ("Phase 4: Calculation", "Tree search & conversion lab", "M7 Candidate Calculation<br>M8 Converting Advantages<br>M9 35-FEN Diagnostic Lab"),
    ],
}

ROOK_CFG = {
    "id": "rook",
    "label": "Rook Level",
    "scope": "14 Modules | 90 Lessons + 5 Labs",
    "title": "Level: Rook",
    "subtitle": "Strategy, Endgames & Complete Position Play",
    "after": "Bishop Plus",
    "before": "Queen / Master",
    "quote": '"I formulate holistic plans, anticipate counterplay, and calculate deeply from middlegame to endgame."',
    "steps": [("1", "Goal", "Strategic target"), ("2", "Core Idea", "GM principle"),
              ("3", "Recognition", "Pattern cues"), ("4", "Demo", "Model master game"),
              ("5", "Guided", "Step-by-step tree"), ("6", "Practice", "Graded FENs"),
              ("7", "Mistakes", "Anti-blunder fixes"), ("8", "Mastery", "Blindfold + timer"),
              ("9", "Transfer", "Carryover simulator")],
    "roadmap": [
        ("Phase 1: Endgames", "Rook dynamics & defense", "M1 Rook Activity & Tarrasch<br>M2 Lucena & Philidor Holds<br>M3 Minor Pieces & Fortresses"),
        ("Phase 2: Strategy", "Structures & heavy batteries", "M4 IQP & Carlsbad Structures<br>M5 Asymmetric Imbalances<br>M6 Infiltration & Alekhine Gun"),
        ("Phase 3: Prophylaxis", "Restraint & 5-move calculation", "M7 Restraint & King Safety<br>M8 Visualization & Trees<br>M9 Dynamic to Static Edges"),
        ("Phase 4: Simulator", "Decision labs & GM games", "M10-M11 Conversion & Structure Labs<br>M12-M13 Prophylaxis & Blindfold Labs<br>M14 5-Stage GM Simulator"),
    ],
}


def dots_html(stars):
    parts = []
    for k in range(4):
        cls = "on" if k < stars else "off"
        parts.append(f'<i class="{cls}"></i>')
    return "".join(parts)


def lesson_li(title, stars):
    bench = " bench" if stars >= 4 else ""
    return (f'<li class="lesson{bench}"><span class="lt">{title}</span>'
            f'<span class="dots">{dots_html(stars)}</span></li>')


def module_box(module):
    code, title, lessons = module
    rows = "".join(lesson_li(t, s) for t, s in lessons)
    return (f'<div class="module-box"><div class="module-title">'
            f'<span class="mchip">{code}</span>{title}</div>'
            f'<ul class="lessons">{rows}</ul></div>')


def lab_card(title, desc=None, items=None):
    body = ""
    if desc:
        body += f'<p class="lab-desc">{desc}</p>'
    if items:
        rows = "".join(f'<div class="lab-item"><strong>{n}</strong>{d}</div>' for n, d in items)
        body += f'<div class="lab-grid">{rows}</div>'
    return f'<div class="lab-card"><div class="lab-title">{title}</div>{body}</div>'


def page(level_id, inner, footer_right):
    return (f'<div class="mobile-page {level_id}"><div class="content">{inner}</div>'
            f'<div class="mobile-footer"><span>Coach Dinosaur | Mobile Syllabus</span>'
            f'<span>{footer_right}</span></div></div>')


def phase_page(cfg, banner, tag, inner, footer_right):
    b = (f'<div class="phase-banner {cfg["id"]}"><span>{banner}</span>'
         f'<span class="phase-tag">{tag}</span></div>')
    return page(cfg["id"], b + inner, footer_right)


def overview_page(cfg, footer_right):
    hero_cls = f'{cfg["id"]}-hero'
    quote_cls = "" if cfg["id"] == "bishop" else " rook-quote"
    steps = "".join(f'<div><strong>{n} {l}:</strong> {d}</div>' for n, l, d in cfg["steps"])
    note = '<div class="fw-note">Rating scale: 1 Core | 2 Developing | 3 Advanced | 4 Benchmark</div>'
    framework = (f'<div class="framework-card"><div class="framework-header">'
                 f'<span>9-Step Lesson Training Framework</span><span>{cfg["label"]}</span></div>'
                 f'<div class="framework-grid">{steps}{note}</div></div>')
    cards = "".join(
        f'<div class="roadmap-card"><h4>{h}</h4><span class="rd">{d}</span><p>{p}</p></div>'
        for h, d, p in cfg["roadmap"])
    roadmap = f'<div class="roadmap-grid">{cards}</div>'
    if cfg["id"] == "bishop":
        standards = ('<div class="standards-card"><strong>Progression Benchmark:</strong> Students must score '
                     '80%+ unassisted accuracy across all 7 diagnostic sets in Module 9 to graduate into '
                     '<strong>Level: Rook</strong>.</div>')
    else:
        standards = ('<div class="standards-card"><strong>Master Graduation Standard:</strong> Students must score '
                     '80%+ accuracy in the M10-M13 decision labs and complete all 5 stages of the M14 '
                     'Grandmaster Carryover Simulator.</div>')
    hero = (f'<div class="hero-card {hero_cls}"><div class="hero-top">'
            f'<span class="eyebrow">Curriculum Blueprint</span>'
            f'<span class="scope-pill">{cfg["scope"]}</span></div>'
            f'<div class="hero-title">{cfg["title"]}</div>'
            f'<div class="hero-subtitle">{cfg["subtitle"]}</div>'
            f'<div class="hero-meta">After: <strong>{cfg["after"]}</strong> | Before: <strong>{cfg["before"]}</strong> '
            f'| Lessons rated 1-4</div>'
            f'<div class="hero-quote{quote_cls}">{cfg["quote"]}</div></div>')
    return page(cfg["id"] + " overview", hero + framework + roadmap + standards, footer_right)


def cover_page():
    chips = ('<span class="chip">Pawn</span><span class="chip">Knight</span><span class="chip">Bishop</span>'
             '<span class="chip hot-b">Bishop Plus</span><span class="chip hot-r">Rook</span>'
             '<span class="chip">Queen / Master</span>')
    path = f'<div class="path-card"><div class="path-label">Progression Path</div><div class="path-chips">{chips}</div></div>'
    levels = ('<div class="cover-levels">'
              '<div class="cov-level"><h4>Bishop Plus</h4><p>9 modules | 90 lessons<br>'
              'Calculation, Conversion &amp; Positional Technique</p></div>'
              '<div class="cov-level rook-l"><h4>Rook</h4><p>14 modules | 90 lessons + 5 labs<br>'
              'Strategy, Endgames &amp; Complete Position Play</p></div></div>')
    note = ('<div class="cover-note"><strong>In this edition:</strong> 15 screens. Bishop Plus screens 1-6, '
            'Rook screens 1-8. Every lesson carries a 4-tier difficulty rating and every module ends with a benchmark.</div>')
    head = ('<div class="cover-brand"><span class="brand-name">COACH DINOSAUR</span>'
            '<span class="brand-tag">Mobile Syllabus</span></div>'
            '<div><div class="cover-eyebrow">Chess Mastery Curriculum</div>'
            '<div class="cover-title">Bishop Plus<br>&amp; Rook Master</div>'
            '<div class="cover-sub">The complete two-level training blueprint: endgame precision, tactical '
            'coordination, positional strategy, deep calculation and advantage conversion.</div></div>')
    return page("cover", head + path + levels + note, "Mobile Edition v2 | 2026")


def build_html():
    parts = ['<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
             '<title>Bishop Plus &amp; Rook Master Curriculum | Mobile Syllabus</title>'
             f'<style>{CSS}</style></head><body>']
    parts.append(cover_page())

    b = BISHOP_CFG
    parts.append(overview_page(b, "Bishop Plus | Overview (1/6)"))
    parts.append(phase_page(b, "Phase 1 - Advanced Endgame Control", "Modules 1-2",
                            module_box(B_M1) + module_box(B_M2), "Bishop Plus | Phase 1 (2/6)"))
    parts.append(phase_page(b, "Phase 2 - Tactical Coordination & Restriction", "Modules 3-4",
                            module_box(B_M3) + module_box(B_M4), "Bishop Plus | Phase 2 (3/6)"))
    parts.append(phase_page(b, "Phase 3 - Positional Foundations & Breaks", "Modules 5-6",
                            module_box(B_M5) + module_box(B_M6), "Bishop Plus | Phase 3 (4/6)"))
    parts.append(phase_page(b, "Phase 4 - Calculation & Conversion", "Modules 7-8",
                            module_box(B_M7) + module_box(B_M8), "Bishop Plus | Phase 4 (5/6)"))

    lab_title = "M9. Practical Diagnostic Laboratory (35 Graded FENs)"
    sets_html = "".join(f'<div class="lab-item"><strong>{n}</strong>{t}</div>' for n, t in BISHOP_LAB_SETS)
    verify = ('<div class="sim-card"><h4>Mastery Verification Standard</h4>'
              '<p>Students must score 80%+ unassisted accuracy across all 7 diagnostic sets to qualify for '
              'promotion to <strong>Level: Rook</strong>.</p></div>')
    parts.append(phase_page(b, "Phase 4 - Diagnostic Laboratory", "Module 9",
                            f'<div class="lab-card"><div class="lab-title">{lab_title}</div>'
                            f'<div class="lab-grid">{sets_html}</div></div>' + verify,
                            "Bishop Plus | Laboratory (6/6)"))

    r = ROOK_CFG
    parts.append(overview_page(r, "Rook Level | Overview (1/8)"))
    parts.append(phase_page(r, "Phase 1 - Complete Endgame Mastery", "Modules 1-2",
                            module_box(R_M1) + module_box(R_M2), "Rook Level | Phase 1 (2/8)"))
    parts.append(phase_page(r, "Phase 1 & 2 - Fortresses & Structures", "Modules 3-4",
                            module_box(R_M3) + module_box(R_M4), "Rook Level | Phase 1 & 2 (3/8)"))
    parts.append(phase_page(r, "Phase 2 - Imbalances & Heavy Pieces", "Modules 5-6",
                            module_box(R_M5) + module_box(R_M6), "Rook Level | Phase 2 (4/8)"))
    parts.append(phase_page(r, "Phase 3 - Prophylaxis & Deep Calculation", "Modules 7-8",
                            module_box(R_M7) + module_box(R_M8), "Rook Level | Phase 3 (5/8)"))

    m10_t, m10_d = ROOK_LABS["M10"]
    m11_t, m11_d = ROOK_LABS["M11"]
    parts.append(phase_page(r, "Phase 3 & 4 - Dynamics & Conversion Labs", "Modules 9-11",
                            module_box(R_M9)
                            + lab_card(f'M10. {m10_t}', m10_d)
                            + lab_card(f'M11. {m11_t}', m11_d),
                            "Rook Level | Phase 3 & 4 (6/8)"))

    m12_t, m12_d = ROOK_LABS["M12"]
    m13_t, m13_d = ROOK_LABS["M13"]
    parts.append(phase_page(r, "Phase 4 - Practical Decision Labs", "Modules 12-13",
                            lab_card(f'M12. {m12_t}', m12_d, ROOK_DRILLS["M12"])
                            + lab_card(f'M13. {m13_t}', m13_d, ROOK_DRILLS["M13"]),
                            "Rook Level | Decision Labs (7/8)"))

    stages = "".join(f"<span>{s}</span>" for s in SIM_STAGES)
    sim_intro = (f'<div class="sim-card" style="flex-shrink:0;"><h4>M14. Full-Game Carryover Simulator</h4>'
                 f'<p>A multi-stage grandmaster game simulation where the student carries decisions across all '
                 f'5 game phases.</p><div class="stage-chips">{stages}</div></div>')
    archetypes = lab_card("5 Grandmaster Simulator Archetypes", None, GM_SIMS)
    parts.append(phase_page(r, "Phase 4 - Grandmaster Simulation", "Module 14",
                            sim_intro + archetypes, "Rook Level | Simulator (8/8)"))

    parts.append("</body></html>")
    return "".join(parts)


def run_edge(html_path, out_pdf):
    edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    if not os.path.exists(edge):
        edge = r"C:\Program Files\Microsoft\Edge\Application\msedge.exe"
    if not os.path.exists(edge):
        raise FileNotFoundError("msedge.exe not found")

    def cmd(extra):
        return ([edge, "--headless=new", "--disable-gpu", "--no-pdf-header-footer"]
                + extra + [f"--print-to-pdf={out_pdf}", html_path])

    res = subprocess.run(cmd([]), capture_output=True, text=True)
    if not os.path.exists(out_pdf):
        profile = os.path.join(tempfile.gettempdir(), "edge_pdf_profile")
        res = subprocess.run(cmd([f"--user-data-dir={profile}"]), capture_output=True, text=True)
    return os.path.exists(out_pdf)


def main():
    out_pdf = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF
    html_path = os.path.join(tempfile.gettempdir(), "curriculum_mobile_v2.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(build_html())
    print("HTML written:", html_path)

    ok = run_edge(html_path, out_pdf)
    if not ok:
        print("PDF generation failed")
        sys.exit(1)
    print("PDF written:", out_pdf)

    doc = fitz.open(out_pdf)
    print("Pages:", len(doc))
    preview_dir = os.path.join(tempfile.gettempdir(), "curriculum_preview")
    os.makedirs(preview_dir, exist_ok=True)
    for i, pg in enumerate(doc):
        pg.get_pixmap(dpi=150).save(os.path.join(preview_dir, f"screen_{i + 1:02d}.png"))
    print("Previews:", preview_dir)


if __name__ == "__main__":
    main()
