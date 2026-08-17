import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { BoardPosition, PieceCode, Square, ThemeId } from "./chess";

export type CameraView = "angle" | "top" | "white" | "black" | "left" | "right" | "low";

export type LastMove = {
  from: Square;
  to: Square;
};

export type ArrowAnnotation = {
  from: Square;
  to: Square;
  color: string;
};

export type SquareAnnotation = {
  square: Square;
  color: string;
};

export type ChessBoardHandle = {
  setView: (view: CameraView) => void;
  resetCamera: () => void;
  flipCamera: () => void;
  downloadPng: (filename?: string) => void;
  clearAnnotations?: () => void;
};

export type ClockDesignId =
  | "dgt-3000"
  | "quantum-cyber"
  | "chronos-metal"
  | "analog-wood"
  | "analog-vintage"
  | "nordic-birch"
  | "none";

export type ClockDesignConfig = {
  id: ClockDesignId;
  label: string;
  kind: "digital" | "analog" | "quantum" | "chronos" | "none";
  casingColor: number;
  casingRoughness: number;
  casingMetalness: number;
  buttonColor: number;
  buttonActiveColor: number;
  faceColor?: number;
  accentColor?: string;
  dialBackground?: string;
  textColor?: string;
  activeTextColor?: string;
  activeBorderColor?: string;
};

export const CLOCK_DESIGNS: Record<string, ClockDesignConfig> = {
  "dgt-3000": {
    id: "dgt-3000",
    label: "🏆 FIDE DGT 3000 (Official)",
    kind: "digital",
    casingColor: 0x821c27, // official FIDE burgundy/red
    casingRoughness: 0.35,
    casingMetalness: 0.2,
    buttonColor: 0x242d38,
    buttonActiveColor: 0x10b981,
    faceColor: 0x0f172a,
    accentColor: "#10b981",
    textColor: "#f1f5f9",
    activeTextColor: "#10b981",
    activeBorderColor: "#10b981",
  },
  "quantum-cyber": {
    id: "quantum-cyber",
    label: "🛸 Quantum Cyber Titanium",
    kind: "quantum",
    casingColor: 0x0a0f16,
    casingRoughness: 0.15,
    casingMetalness: 0.94,
    buttonColor: 0x111927,
    buttonActiveColor: 0x00f0ff,
    faceColor: 0x020509,
    accentColor: "#00f0ff",
    textColor: "#94a3b8",
    activeTextColor: "#00f0ff",
    activeBorderColor: "#00f0ff",
  },
  "chronos-metal": {
    id: "chronos-metal",
    label: "⚡ Chronos Blitz Metal",
    kind: "chronos",
    casingColor: 0xd0d8e2, // aircraft aluminum
    casingRoughness: 0.2,
    casingMetalness: 0.96,
    buttonColor: 0x94a3b8,
    buttonActiveColor: 0x22c55e,
    faceColor: 0x020617,
    accentColor: "#22c55e",
    textColor: "#ef4444",
    activeTextColor: "#22c55e",
    activeBorderColor: "#22c55e",
  },
  "analog-wood": {
    id: "analog-wood",
    label: "🪵 BHB Vintage Wood Analog",
    kind: "analog",
    casingColor: 0x4a2e1b,
    casingRoughness: 0.45,
    casingMetalness: 0.1,
    buttonColor: 0xd4af37, // brass
    buttonActiveColor: 0xffd700,
    faceColor: 0x382012,
    accentColor: "#dc2626",
    dialBackground: "#fbf6ea",
    textColor: "#1f2937",
    activeTextColor: "#15803d",
    activeBorderColor: "#8c6239",
  },
  "analog-vintage": {
    id: "analog-vintage",
    label: "⚙️ Retro Mechanical Chrome",
    kind: "analog",
    casingColor: 0xdcd6ca,
    casingRoughness: 0.3,
    casingMetalness: 0.35,
    buttonColor: 0xb0b8c0, // chrome
    buttonActiveColor: 0xe0e6ed,
    faceColor: 0x2b3035,
    accentColor: "#ef4444",
    dialBackground: "#ffffff",
    textColor: "#111827",
    activeTextColor: "#2563eb",
    activeBorderColor: "#64748b",
  },
  "nordic-birch": {
    id: "nordic-birch",
    label: "🌿 Nordic Birch Minimalist",
    kind: "digital",
    casingColor: 0xd4c09e,
    casingRoughness: 0.6,
    casingMetalness: 0.05,
    buttonColor: 0xe8ded0,
    buttonActiveColor: 0x245f4b,
    faceColor: 0xf4f1eb,
    accentColor: "#245f4b",
    textColor: "#334155",
    activeTextColor: "#245f4b",
    activeBorderColor: "#245f4b",
  },
  "none": {
    id: "none",
    label: "🚫 Hide 3D Clock",
    kind: "none",
    casingColor: 0x000000,
    casingRoughness: 1,
    casingMetalness: 0,
    buttonColor: 0x000000,
    buttonActiveColor: 0x000000,
  },
  // Backward-compatible aliases
  "digital-tournament": {
    id: "dgt-3000",
    label: "🏆 FIDE DGT 3000 (Official)",
    kind: "digital",
    casingColor: 0x821c27,
    casingRoughness: 0.35,
    casingMetalness: 0.2,
    buttonColor: 0x242d38,
    buttonActiveColor: 0x10b981,
    faceColor: 0x0f172a,
    accentColor: "#10b981",
    textColor: "#f1f5f9",
    activeTextColor: "#10b981",
    activeBorderColor: "#10b981",
  },
  "digital-cyber": {
    id: "quantum-cyber",
    label: "🛸 Quantum Cyber Titanium",
    kind: "quantum",
    casingColor: 0x0a0f16,
    casingRoughness: 0.15,
    casingMetalness: 0.94,
    buttonColor: 0x111927,
    buttonActiveColor: 0x00f0ff,
    faceColor: 0x020509,
    accentColor: "#00f0ff",
    textColor: "#94a3b8",
    activeTextColor: "#00f0ff",
    activeBorderColor: "#00f0ff",
  },
};

export type PiecePaletteId =
  | "theme-default"
  | "boxwood-ebony"
  | "ivory-walnut"
  | "amber-rosewood"
  | "alabaster-graphite";

export const PIECE_PALETTES: Record<
  PiecePaletteId,
  { label: string; white: string; black: string; roughness?: number; clearcoat?: number }
> = {
  "theme-default": { label: "Board Default", white: "", black: "" },
  "boxwood-ebony": {
    label: "Natural Boxwood & Ebony",
    white: "#f5e4c6",
    black: "#2e241f",
    roughness: 0.24,
    clearcoat: 0.42,
  },
  "ivory-walnut": {
    label: "Warm Ivory & Dark Walnut",
    white: "#faf2e2",
    black: "#35241b",
    roughness: 0.22,
    clearcoat: 0.45,
  },
  "amber-rosewood": {
    label: "Golden Honey & Rosewood",
    white: "#f5ddb0",
    black: "#321b16",
    roughness: 0.26,
    clearcoat: 0.40,
  },
  "alabaster-graphite": {
    label: "Alabaster & Graphite",
    white: "#f8f2e6",
    black: "#24272e",
    roughness: 0.18,
    clearcoat: 0.55,
  },
};

type Props = {
  position: BoardPosition;
  flipped: boolean;
  activeSquare: Square | null;
  legalDestinations?: Square[];
  lastMove?: LastMove | null;
  checkSquare?: Square | null;
  themeId?: ThemeId;
  piecePaletteId?: PiecePaletteId;
  clockDesignId?: ClockDesignId;
  arrows?: ArrowAnnotation[];
  squareHighlights?: SquareAnnotation[];
  selectedReservePiece?: PieceCode | null;
  remotePointer?: { square: Square | null; role: "teacher" | "student"; label?: string } | null;
  showReserveTrays?: boolean;
  clockState?: {
    enabled: boolean;
    whiteTimeMs: number;
    blackTimeMs: number;
    activeSide: "w" | "b" | null;
    flagFallenSide: "w" | "b" | null;
  } | null;
  onPressClock?: (side?: "w" | "b") => void;
  onSquarePress: (square: Square) => void;
  onSquareErase: (square: Square) => void;
  onSelectReservePiece?: (code: PieceCode) => void;
  onDropReservePiece?: (code: PieceCode, square: Square) => void;
  onDropMovePiece?: (from: Square, to: Square) => void;
  onHoverSquare?: (square: Square | null) => void;
  onAddArrow?: (arrow: ArrowAnnotation) => void;
  onToggleSquareHighlight?: (highlight: SquareAnnotation) => void;
};

type CameraGoal = {
  startPosition: THREE.Vector3;
  startTarget: THREE.Vector3;
  targetPosition: THREE.Vector3;
  targetTarget: THREE.Vector3;
  startTime: number;
  duration: number;
};

type Materials = {
  white: THREE.Material;
  black: THREE.Material;
  gold: THREE.Material;
};

type PieceKind = "K" | "Q" | "R" | "B" | "N" | "P";

export type ThemeConfig = {
  background: [string, string, string];
  floor: string;
  board: {
    frameBase: string;
    frameTop: string;
    bed: string;
    light: string;
    dark: string;
    trim: string;
    label: string;
    grain: string;
    woodGrain: boolean;
    frameRoughness: number;
    frameClearcoat: number;
    tileRoughness: number;
    tileClearcoat: number;
  };
  pieces: {
    white: string;
    black: string;
    gold: string;
    roughness: number;
    clearcoat: number;
  };
  lighting: {
    exposure: number;
    ambient: number;
    hemisphereSky: string;
    hemisphereGround: string;
    hemisphereIntensity: number;
    keyColor: string;
    keyIntensity: number;
    keyPosition: [number, number, number];
    fillColor: string;
    fillIntensity: number;
    fillPosition: [number, number, number];
  };
  hover: string;
};

type PieceTemplates = Record<PieceCode, THREE.Group>;
type PieceLibraryStatus = "loading" | "ready" | "failed";

type ActivePieceAnimation = {
  mesh: THREE.Group;
  fromPos: THREE.Vector3;
  toPos: THREE.Vector3;
  startTime: number;
  duration: number;
  lift: number;
};

type ActiveFadeAnimation = {
  mesh: THREE.Group;
  startTime: number;
  duration: number;
};

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  board: THREE.Group;
  pieces: THREE.Group;
  selection: THREE.Group;
  highlights: THREE.Group;
  annotations: THREE.Group;
  reserveTrays: THREE.Group;
  reservePieces: THREE.Group;
  remotePointers: THREE.Group;
  hover: THREE.Mesh;
  materials: Materials;
  pieceTemplates: PieceTemplates | null;
  pieceLibraryStatus: PieceLibraryStatus;
  latestPosition: BoardPosition;
  cameraGoal: CameraGoal | null;
  activeAnimations: ActivePieceAnimation[];
  activeFades: ActiveFadeAnimation[];
  ambientLight: THREE.AmbientLight;
  hemiLight: THREE.HemisphereLight;
  keyLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  rimLight?: THREE.DirectionalLight;
  floorMesh: THREE.Mesh;
  currentThemeId: ThemeId;
  currentPaletteId?: PiecePaletteId;
  currentClockDesignId?: ClockDesignId;
  clock3D: ChessClock3D | null;
};

type ViewPreset = {
  position: [number, number, number];
  target: [number, number, number];
};

const CAMERA_VIEWS: Record<CameraView, ViewPreset> = {
  angle: {
    position: [9.48, 5.89, 9.48],
    target: [-0.21, -0.80, -0.21],
  },
  top: {
    position: [0.001, 15.6, 1.25],
    target: [0.00, 0.35, 1.25],
  },
  white: {
    position: [0.00, 7.57, 11.86],
    target: [0.00, 0.35, 0.75],
  },
  black: {
    position: [0.00, 7.57, -11.86],
    target: [0.00, 0.35, -0.75],
  },
  left: {
    position: [-11.86, 7.57, 0.00],
    target: [-0.75, 0.35, 0.00],
  },
  right: {
    position: [11.86, 7.57, 0.00],
    target: [0.75, 0.35, 0.00],
  },
  low: {
    position: [11.29, 4.48, 11.29],
    target: [0.25, 0.00, 0.25],
  },
};

const TILE_TOP = 0.371;

export const THEMES: Record<ThemeId, ThemeConfig> = {
  "classic-walnut": {
    background: ["#f6f0e5", "#ded0bb", "#b8a38a"],
    floor: "#c2b094",
    board: {
      frameBase: "#4a291c",
      frameTop: "#985a32",
      bed: "#241b17",
      light: "#eadcbd",
      dark: "#244c3a",
      trim: "#b78b45",
      label: "#4d2f20",
      grain: "#4f2416",
      woodGrain: true,
      frameRoughness: 0.32,
      frameClearcoat: 0.34,
      tileRoughness: 0.5,
      tileClearcoat: 0.08,
    },
    pieces: {
      white: "#f5e4c6",
      black: "#32251f",
      gold: "#b88e48",
      roughness: 0.25,
      clearcoat: 0.42,
    },
    lighting: {
      exposure: 1.02,
      ambient: 0.58,
      hemisphereSky: "#fff5df",
      hemisphereGround: "#71665b",
      hemisphereIntensity: 1.05,
      keyColor: "#ffe1b8",
      keyIntensity: 3.25,
      keyPosition: [8, 12, -7],
      fillColor: "#c9dce5",
      fillIntensity: 1.15,
      fillPosition: [-6, 7, 8],
    },
    hover: "#e8b552",
  },
  "tournament-vinyl": {
    background: ["#eef2ec", "#d5dfd3", "#a8b9a5"],
    floor: "#a8b9a5",
    board: {
      frameBase: "#2b2f2c",
      frameTop: "#5c4033",
      bed: "#181d19",
      light: "#f0dfbc",
      dark: "#2e5d3c",
      trim: "#c5a059",
      label: "#2f4033",
      grain: "#3c2a20",
      woodGrain: true,
      frameRoughness: 0.42,
      frameClearcoat: 0.22,
      tileRoughness: 0.65,
      tileClearcoat: 0.04,
    },
    pieces: {
      white: "#f5e6cc",
      black: "#2c2d30",
      gold: "#c5a059",
      roughness: 0.28,
      clearcoat: 0.38,
    },
    lighting: {
      exposure: 1.05,
      ambient: 0.62,
      hemisphereSky: "#f4f8f4",
      hemisphereGround: "#636d64",
      hemisphereIntensity: 1.1,
      keyColor: "#fff8ee",
      keyIntensity: 3.1,
      keyPosition: [8, 13, -7],
      fillColor: "#d2e4df",
      fillIntensity: 1.2,
      fillPosition: [-6, 7, 8],
    },
    hover: "#58ea9c",
  },
  "modern-marble": {
    background: ["#f0f3f6", "#d9e2ec", "#bcccdc"],
    floor: "#bcccdc",
    board: {
      frameBase: "#24292e",
      frameTop: "#3e4751",
      bed: "#1b1f23",
      light: "#f8f9fa",
      dark: "#333d47",
      trim: "#9aa5b1",
      label: "#3e4751",
      grain: "#2e3740",
      woodGrain: false,
      frameRoughness: 0.22,
      frameClearcoat: 0.55,
      tileRoughness: 0.18,
      tileClearcoat: 0.65,
    },
    pieces: {
      white: "#f6ede0",
      black: "#2a303a",
      gold: "#8b99a8",
      roughness: 0.16,
      clearcoat: 0.58,
    },
    lighting: {
      exposure: 1.08,
      ambient: 0.65,
      hemisphereSky: "#f0f6ff",
      hemisphereGround: "#5a6878",
      hemisphereIntensity: 1.15,
      keyColor: "#ffffff",
      keyIntensity: 3.4,
      keyPosition: [8, 14, -6],
      fillColor: "#d0e2ff",
      fillIntensity: 1.3,
      fillPosition: [-6, 8, 8],
    },
    hover: "#60a5fa",
  },
  "midnight-obsidian": {
    background: ["#2d3139", "#1c1f26", "#101217"],
    floor: "#181b22",
    board: {
      frameBase: "#131519",
      frameTop: "#252932",
      bed: "#0b0d10",
      light: "#ded2ba",
      dark: "#2b2520",
      trim: "#d4af37",
      label: "#c5a059",
      grain: "#1a1c22",
      woodGrain: false,
      frameRoughness: 0.22,
      frameClearcoat: 0.55,
      tileRoughness: 0.35,
      tileClearcoat: 0.25,
    },
    pieces: {
      white: "#f5e7cf",
      black: "#272a31",
      gold: "#d4af37",
      roughness: 0.18,
      clearcoat: 0.65,
    },
    lighting: {
      exposure: 1.08,
      ambient: 0.6,
      hemisphereSky: "#e2ecf8",
      hemisphereGround: "#222630",
      hemisphereIntensity: 1.05,
      keyColor: "#fff4db",
      keyIntensity: 3.5,
      keyPosition: [8, 13, -6],
      fillColor: "#8ea4c0",
      fillIntensity: 1.35,
      fillPosition: [-6, 8, 8],
    },
    hover: "#f59e0b",
  },
};

const THEME_CONFIG: ThemeConfig = THEMES["classic-walnut"];

const STAUNTON_MODEL_NAMES: Record<PieceCode, string> = {
  wK: "WhiteKing",
  wQ: "WhiteQueen",
  wR: "RightWhiteRook",
  wB: "RightWhiteBishop",
  wN: "RightWhiteKnight",
  wP: "WhitePawnA",
  bK: "BlackKing",
  bQ: "BlackQueen",
  bR: "RightBlackRook",
  bB: "RightBlackBishop",
  bN: "RightBlackKnight",
  bP: "BlackPawnA",
};

const STAUNTON_TARGET_HEIGHT: Record<PieceKind, number> = {
  P: 0.85,
  R: 0.96,
  N: 1.12,
  B: 1.22,
  Q: 1.30,
  K: 1.44,
};

const STAUNTON_WIDTH_BOOST: Record<PieceKind, number> = {
  P: 1.04,
  R: 1.12,
  N: 1.10,
  B: 1.06,
  Q: 1.12,
  K: 1.12,
};

let sharedPieceTemplates: PieceTemplates | null = null;
let sharedPieceTemplatesPromise: Promise<PieceTemplates> | null = null;

function squarePosition(square: Square): THREE.Vector3 {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return new THREE.Vector3(file - 3.5, TILE_TOP, 4.5 - rank);
}

function configureShadows(object: THREE.Object3D, cast = true, receive = true) {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = cast;
      child.receiveShadow = receive;
    }
  });
}


function createBackgroundTexture(colors: ThemeConfig["background"]) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas backgrounds are not available.");

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.52, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const vignette = context.createRadialGradient(128, 210, 24, 128, 250, 320);
  vignette.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  vignette.addColorStop(0.68, "rgba(255, 255, 255, 0)");
  vignette.addColorStop(1, "rgba(34, 30, 27, 0.12)");
  context.fillStyle = vignette;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createWoodGrainTexture(base: string, grain: string, anisotropy: number) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas material textures are not available.");

  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);
  const grainColor = new THREE.Color(grain);
  const red = Math.round(grainColor.r * 255);
  const green = Math.round(grainColor.g * 255);
  const blue = Math.round(grainColor.b * 255);

  for (let line = 0; line < 72; line += 1) {
    const baseline = 2 + line * 3.55;
    context.beginPath();
    for (let x = -8; x <= canvas.width + 8; x += 8) {
      const wave = Math.sin(x * 0.034 + line * 0.72) * (1.1 + (line % 5) * 0.2)
        + Math.sin(x * 0.009 + line * 0.31) * 1.9;
      if (x === -8) context.moveTo(x, baseline + wave);
      else context.lineTo(x, baseline + wave);
    }
    context.strokeStyle = `rgba(${red}, ${green}, ${blue}, ${0.07 + (line % 4) * 0.018})`;
    context.lineWidth = line % 6 === 0 ? 1.4 : 0.7;
    context.stroke();
  }

  for (const [x, y, radius] of [[88, 76, 12], [315, 182, 16], [452, 54, 9]] as const) {
    context.beginPath();
    context.ellipse(x, y, radius * 2.2, radius, -0.08, 0, Math.PI * 2);
    context.strokeStyle = `rgba(${red}, ${green}, ${blue}, 0.11)`;
    context.lineWidth = 1.2;
    context.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1.7, 1.7);
  texture.anisotropy = Math.min(8, anisotropy);
  return texture;
}

function createPieceMaterials(
  config: ThemeConfig = THEME_CONFIG,
  paletteId: PiecePaletteId = "theme-default",
): Materials {
  const piecesConfig = config.pieces;
  const palette = paletteId !== "theme-default" ? PIECE_PALETTES[paletteId] : null;

  const whiteColor = palette && palette.white ? palette.white : piecesConfig.white;
  const blackColor = palette && palette.black ? palette.black : piecesConfig.black;
  const roughness = palette?.roughness ?? piecesConfig.roughness;
  const clearcoat = palette?.clearcoat ?? piecesConfig.clearcoat;

  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: whiteColor,
    roughness: Math.max(0.18, roughness - 0.04),
    metalness: 0,
    clearcoat: Math.max(0.35, clearcoat),
    clearcoatRoughness: 0.26,
    sheen: 0.35,
    sheenColor: new THREE.Color("#fff2d6"),
    sheenRoughness: 0.45,
    side: THREE.DoubleSide,
  });

  const blackMat = new THREE.MeshPhysicalMaterial({
    color: blackColor,
    roughness: Math.max(0.16, roughness - 0.06),
    metalness: 0.04,
    clearcoat: Math.max(0.55, clearcoat + 0.15),
    clearcoatRoughness: 0.18,
    sheen: 0.70,
    sheenColor: new THREE.Color("#b8cbdf"),
    sheenRoughness: 0.28,
    side: THREE.DoubleSide,
  });

  return {
    white: whiteMat,
    black: blackMat,
    gold: new THREE.MeshPhysicalMaterial({
      color: piecesConfig.gold,
      roughness: 0.26,
      metalness: 0.58,
      clearcoat: 0.22,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    }),
  };
}

function addThemeLighting(scene: THREE.Scene, config: ThemeConfig, shadowMapSize: number) {
  const ambient = new THREE.AmbientLight("#ffffff", config.lighting.ambient);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(
    config.lighting.hemisphereSky,
    config.lighting.hemisphereGround,
    config.lighting.hemisphereIntensity,
  );
  scene.add(hemi);

  const key = new THREE.DirectionalLight(config.lighting.keyColor, config.lighting.keyIntensity);
  key.position.set(...config.lighting.keyPosition);
  key.castShadow = true;
  key.shadow.mapSize.set(shadowMapSize, shadowMapSize);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 32;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(config.lighting.fillColor, config.lighting.fillIntensity);
  fill.position.set(...config.lighting.fillPosition);
  fill.castShadow = false;
  scene.add(fill);

  const rim = new THREE.DirectionalLight("#eef4fc", 2.2);
  rim.position.set(-12, 12, 0);
  rim.castShadow = false;
  scene.add(rim);

  return { ambient, hemi, key, fill, rim };
}

function createThemeFloor(config: ThemeConfig) {
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(22, 80),
    new THREE.MeshStandardMaterial({ color: config.floor, roughness: 0.94, metalness: 0 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.185;
  floor.receiveShadow = true;
  floor.castShadow = false;
  return floor;
}

function lathe(
  profile: [number, number][],
  material: THREE.Material,
  segments = 48,
): THREE.Mesh {
  const points = profile.map(([radius, height]) => new THREE.Vector2(radius, height));
  return new THREE.Mesh(new THREE.LatheGeometry(points, segments), material);
}

function addMesh(
  parent: THREE.Group,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  position: [number, number, number],
  scale?: [number, number, number],
  rotation?: [number, number, number],
) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  if (scale) mesh.scale.set(...scale);
  if (rotation) mesh.rotation.set(...rotation);
  parent.add(mesh);
  return mesh;
}

function pieceMaterial(code: PieceCode, materials: Materials) {
  return code[0] === "w" ? materials.white : materials.black;
}

function addNeoClassicBase(
  parent: THREE.Group,
  body: THREE.Material,
  accent: THREE.Material,
  radius: number,
  topRadius: number,
) {
  const profile: [number, number][] = [
    [0, 0],
    [radius * 0.88, 0],
    [radius * 0.98, 0.02],
    [radius, 0.048],
    [radius * 0.98, 0.078],
    [radius * 0.92, 0.11],
    [radius * 0.82, 0.148],
    [radius * 0.74, 0.19],
    [radius * 0.67, 0.23],
    [topRadius, 0.28],
    [topRadius, 0.3],
  ];
  parent.add(lathe(profile, body, 64));

  // Brushed metallic accent collar ring on base fillet
  addMesh(
    parent,
    new THREE.TorusGeometry(radius * 0.81, 0.016, 16, 64),
    accent,
    [0, 0.108, 0],
    undefined,
    [Math.PI / 2, 0, 0],
  );
}

function addStauntonBase(
  parent: THREE.Group,
  material: THREE.Material,
  radius: number,
  topRadius: number,
) {
  const profile: [number, number][] = [
    [0, 0],
    [radius * 0.82, 0],
    [radius * 0.95, 0.018],
    [radius, 0.05],
    [radius * 0.99, 0.08],
    [radius * 0.94, 0.112],
    [radius * 0.84, 0.15],
    [radius * 0.76, 0.19],
    [radius * 0.69, 0.23],
    [topRadius, 0.28],
    [topRadius, 0.3],
  ];
  parent.add(lathe(profile, material, 64));
  addMesh(
    parent,
    new THREE.TorusGeometry(radius * 0.82, 0.022, 12, 64),
    material,
    [0, 0.105, 0],
    undefined,
    [Math.PI / 2, 0, 0],
  );
}

function createMitredHeadGeometry() {
  const source = new THREE.SphereGeometry(0.22, 72, 48).toNonIndexed();
  const positions = source.getAttribute("position");
  const keptPositions: number[] = [];
  const gapHalfWidth = 0.022;

  for (let index = 0; index < positions.count; index += 3) {
    const triangle: [number, number, number][] = [];
    const signedDistances: number[] = [];

    for (let vertex = 0; vertex < 3; vertex += 1) {
      const sourceIndex = index + vertex;
      const x = positions.getX(sourceIndex) * 0.94;
      const y = positions.getY(sourceIndex) * 2.25;
      const z = positions.getZ(sourceIndex) * 0.94;
      triangle.push([x, y, z]);
      signedDistances.push((0.825 * x) - (0.565 * y) + 0.055);
    }

    const entirelyAbove = signedDistances.every((distance) => distance > gapHalfWidth);
    const entirelyBelow = signedDistances.every((distance) => distance < -gapHalfWidth);
    if (!entirelyAbove && !entirelyBelow) continue;

    triangle.forEach((vertex) => keptPositions.push(...vertex));
  }

  source.dispose();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(keptPositions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createNeoClassicPiece(code: PieceCode, square: Square, materials: Materials): THREE.Group {
  const group = new THREE.Group();
  const body = pieceMaterial(code, materials);
  const accent = materials.gold;
  const type = code[1];
  const isWhite = code[0] === "w";

  if (type === "P") {
    addNeoClassicBase(group, body, accent, 0.28, 0.16);
    group.add(lathe([
      [0.16, 0.28],
      [0.17, 0.36],
      [0.142, 0.46],
      [0.11, 0.58],
      [0.118, 0.64],
      [0.168, 0.68],
      [0.176, 0.71],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.168, 0.012, 12, 64), accent, [0, 0.68, 0], undefined, [Math.PI / 2, 0, 0]);
    addMesh(group, new THREE.SphereGeometry(0.15, 48, 36), body, [0, 0.84, 0]);
  }

  if (type === "R") {
    addNeoClassicBase(group, body, accent, 0.33, 0.21);
    group.add(lathe([
      [0.21, 0.28],
      [0.225, 0.37],
      [0.2, 0.63],
      [0.212, 0.72],
      [0.275, 0.76],
      [0.295, 0.79],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.275, 0.014, 12, 64), accent, [0, 0.76, 0], undefined, [Math.PI / 2, 0, 0]);
    addMesh(group, new THREE.CylinderGeometry(0.295, 0.285, 0.16, 64), body, [0, 0.86, 0]);
    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2;
      addMesh(
        group,
        new RoundedBoxGeometry(0.155, 0.18, 0.22, 4, 0.02),
        body,
        [Math.cos(angle) * 0.21, 1.01, Math.sin(angle) * 0.21],
        undefined,
        [0, -angle, 0],
      );
    }
  }

  if (type === "N") {
    addNeoClassicBase(group, body, accent, 0.32, 0.2);
    group.add(lathe([
      [0.2, 0.28],
      [0.225, 0.36],
      [0.212, 0.46],
      [0.178, 0.53],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.19, 0.014, 12, 64), accent, [0, 0.46, 0], undefined, [Math.PI / 2, 0, 0]);

    const horse = new THREE.Shape();
    horse.moveTo(-0.28, 0.01);
    horse.bezierCurveTo(-0.26, 0.28, -0.23, 0.54, -0.09, 0.72);
    horse.bezierCurveTo(-0.03, 0.8, 0.05, 0.84, 0.13, 0.85);
    horse.lineTo(0.11, 1.0);
    horse.lineTo(0.23, 0.91);
    horse.lineTo(0.25, 0.77);
    horse.bezierCurveTo(0.37, 0.71, 0.44, 0.61, 0.41, 0.51);
    horse.bezierCurveTo(0.38, 0.43, 0.31, 0.39, 0.25, 0.35);
    horse.lineTo(0.41, 0.31);
    horse.bezierCurveTo(0.36, 0.21, 0.25, 0.13, 0.14, 0.1);
    horse.lineTo(0.01, 0.02);
    horse.closePath();
    const horseGeometry = new THREE.ExtrudeGeometry(horse, {
      depth: 0.24,
      bevelEnabled: true,
      bevelThickness: 0.036,
      bevelSize: 0.032,
      bevelSegments: 8,
      curveSegments: 32,
    });
    horseGeometry.center();
    addMesh(
      group,
      horseGeometry,
      body,
      [0, 0.95, 0],
      [0.84, 0.84, 0.84],
      [0, isWhite ? Math.PI / 2 : -Math.PI / 2, 0],
    );
  }

  if (type === "B") {
    addNeoClassicBase(group, body, accent, 0.32, 0.19);
    group.add(lathe([
      [0.19, 0.25],
      [0.20, 0.28],
      [0.165, 0.34],
      [0.138, 0.42],
      [0.155, 0.48],
      [0.195, 0.52],
      [0.20, 0.54],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.15, 0.011, 12, 64), accent, [0, 0.53, 0], undefined, [Math.PI / 2, 0, 0]);
    addMesh(group, createMitredHeadGeometry(), body, [0, 0.84, 0]);
    addMesh(group, new THREE.SphereGeometry(0.055, 36, 24), accent, [0, 1.22, 0]);
  }

  if (type === "Q") {
    addNeoClassicBase(group, body, accent, 0.35, 0.2);
    group.add(lathe([
      [0.2, 0.28],
      [0.23, 0.38],
      [0.185, 0.52],
      [0.138, 0.77],
      [0.15, 0.86],
      [0.24, 0.94],
      [0.265, 1.01],
      [0.25, 1.06],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.25, 0.028, 16, 64), accent, [0, 1.045, 0], undefined, [Math.PI / 2, 0, 0]);
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      addMesh(
        group,
        new THREE.ConeGeometry(0.052, 0.18, 24),
        body,
        [Math.cos(angle) * 0.22, 1.19, Math.sin(angle) * 0.22],
      );
      addMesh(
        group,
        new THREE.SphereGeometry(0.024, 16, 12),
        accent,
        [Math.cos(angle) * 0.22, 1.28, Math.sin(angle) * 0.22],
      );
    }
    addMesh(group, new THREE.SphereGeometry(0.082, 40, 28), accent, [0, 1.35, 0]);
  }

  if (type === "K") {
    addNeoClassicBase(group, body, accent, 0.36, 0.21);
    group.add(lathe([
      [0.21, 0.28],
      [0.235, 0.39],
      [0.19, 0.56],
      [0.142, 0.86],
      [0.158, 0.95],
      [0.255, 1.03],
      [0.26, 1.09],
      [0.21, 1.13],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.235, 0.03, 16, 64), accent, [0, 1.07, 0], undefined, [Math.PI / 2, 0, 0]);
    addMesh(group, new THREE.SphereGeometry(0.11, 40, 28), body, [0, 1.21, 0]);
    addMesh(group, new RoundedBoxGeometry(0.095, 0.32, 0.08, 5, 0.018), accent, [0, 1.43, 0]);
    addMesh(group, new RoundedBoxGeometry(0.30, 0.095, 0.08, 5, 0.018), accent, [0, 1.48, 0]);
  }

  configureShadows(group);
  group.position.copy(squarePosition(square));
  group.position.y = TILE_TOP;
  group.userData = { kind: "piece", square, code };
  return group;
}

function createPiece(code: PieceCode, square: Square, state: SceneState): THREE.Group {
  const template = state.pieceTemplates?.[code];
  if (!template) return createNeoClassicPiece(code, square, state.materials);

  const group = new THREE.Group();
  const model = template.clone(true);
  const body = pieceMaterial(code, state.materials);
  model.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.userData.preserveMaterial) child.material = body;
    child.castShadow = true;
    child.receiveShadow = true;
  });
  group.add(model);

  group.position.copy(squarePosition(square));
  group.position.y = TILE_TOP;
  group.userData = { kind: "piece", square, code };
  return group;
}

function createMitredBishopModel(code: PieceCode, materials: Materials) {
  const model = new THREE.Group();
  const body = pieceMaterial(code, materials);

  addStauntonBase(model, body, 0.32, 0.19);
  model.add(lathe([
    [0.19, 0.25],
    [0.20, 0.28],
    [0.165, 0.34],
    [0.138, 0.42],
    [0.155, 0.48],
    [0.195, 0.52],
    [0.20, 0.54],
  ], body, 64));
  addMesh(model, new THREE.TorusGeometry(0.15, 0.011, 12, 64), body, [0, 0.53, 0], undefined, [Math.PI / 2, 0, 0]);
  addMesh(model, createMitredHeadGeometry(), body, [0, 0.84, 0]);
  addMesh(model, new THREE.SphereGeometry(0.055, 36, 24), body, [0, 1.22, 0]);
  configureShadows(model);
  return model;
}

function createStauntonTemplates(root: THREE.Object3D): PieceTemplates {
  const entries = Object.entries(STAUNTON_MODEL_NAMES).map(([pieceCode, modelName]) => {
    const code = pieceCode as PieceCode;
    const source = root.getObjectByName(modelName);
    if (!source) throw new Error(`Missing chess model: ${modelName}`);

    const model = source.clone(true);
    model.position.set(0, 0, 0);
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) child.geometry = child.geometry.clone();
    });

    const pieceKind = code[1] as PieceKind;

    if (pieceKind === "B") {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh && child.geometry?.attributes?.position) {
          const posAttr = child.geometry.attributes.position;
          child.geometry.computeBoundingBox();
          const b = child.geometry.boundingBox;
          if (b) {
            const minY = b.min.y;
            const maxY = b.max.y;
            const h = maxY - minY;
            const collarCutoff = 0.52;
            const baseCutoff = 0.20;
            const targetCollarNormY = 0.42;
            for (let i = 0; i < posAttr.count; i++) {
              const y = posAttr.getY(i);
              const normY = Math.max(0, Math.min(1, (y - minY) / h));
              let newNormY = normY;
              let scaleXZ = 0.94;
              if (normY <= baseCutoff) {
                newNormY = normY;
                scaleXZ = 1.0;
              } else if (normY <= collarCutoff) {
                const neckT = (normY - baseCutoff) / (collarCutoff - baseCutoff);
                newNormY = baseCutoff + neckT * (targetCollarNormY - baseCutoff);
                scaleXZ = 0.98 - neckT * 0.04;
              } else {
                const headT = (normY - collarCutoff) / (1.0 - collarCutoff);
                newNormY = targetCollarNormY + headT * (1.0 - targetCollarNormY);
                scaleXZ = 0.94 - headT * 0.08;
              }
              posAttr.setY(i, minY + newNormY * h);
              posAttr.setX(i, posAttr.getX(i) * scaleXZ);
              posAttr.setZ(i, posAttr.getZ(i) * scaleXZ);
            }
            posAttr.needsUpdate = true;
            child.geometry.computeVertexNormals();
          }
        }
      });
    }

    const template = new THREE.Group();
    template.add(model);
    template.updateMatrixWorld(true);

    const bounds = new THREE.Box3().setFromObject(template);
    const center = bounds.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.y -= bounds.min.y;
    model.position.z -= center.z;
    template.updateMatrixWorld(true);

    const normalizedBounds = new THREE.Box3().setFromObject(template);
    const height = Math.max(0.001, normalizedBounds.max.y - normalizedBounds.min.y);
    const heightScale = STAUNTON_TARGET_HEIGHT[pieceKind] / height;
    const widthScale = heightScale * STAUNTON_WIDTH_BOOST[pieceKind];
    template.scale.set(
      widthScale,
      heightScale,
      widthScale,
    );
    template.updateMatrixWorld(true);
    configureShadows(template, false, false);
    return [code, template] as const;
  });

  return Object.fromEntries(entries) as PieceTemplates;
}

function loadPieceTemplates() {
  if (sharedPieceTemplates) return Promise.resolve(sharedPieceTemplates);
  if (sharedPieceTemplatesPromise) return sharedPieceTemplatesPromise;

  sharedPieceTemplatesPromise = new Promise<PieceTemplates>((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      `${import.meta.env.BASE_URL}models/staunton.glb`,
      (asset) => {
        try {
          sharedPieceTemplates = createStauntonTemplates(asset.scene);
          disposeObject(asset.scene);
          resolve(sharedPieceTemplates);
        } catch (error) {
          disposeObject(asset.scene);
          sharedPieceTemplatesPromise = null;
          reject(error);
        }
      },
      undefined,
      (error) => {
        sharedPieceTemplatesPromise = null;
        reject(error);
      },
    );
  });

  return sharedPieceTemplatesPromise;
}

const RESERVE_CODES_WHITE: PieceCode[] = ["wP", "wR", "wN", "wB", "wQ", "wK"];
const RESERVE_CODES_BLACK: PieceCode[] = ["bP", "bR", "bN", "bB", "bQ", "bK"];
const RESERVE_Z_OFFSETS = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5];

function createReservePiece(code: PieceCode, position: THREE.Vector3, state: SceneState): THREE.Group {
  const template = state.pieceTemplates?.[code];
  const group = new THREE.Group();
  if (template) {
    const model = template.clone(true);
    const body = pieceMaterial(code, state.materials);
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!child.userData.preserveMaterial) child.material = body;
      child.castShadow = true;
      child.receiveShadow = true;
    });
    group.add(model);
  }
  group.scale.setScalar(0.72);
  group.position.copy(position);
  group.userData = { kind: "reserve_piece", code };
  return group;
}

function createReserveSelectionHalo(pos: THREE.Vector3, material: THREE.Material): THREE.Mesh {
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.34, 0.028, 8, 36),
    material,
  );
  halo.position.set(pos.x, pos.y + 0.025, pos.z);
  halo.rotation.x = Math.PI / 2;
  halo.renderOrder = 8;
  return halo;
}

function createReserveTraysGroup(theme: ThemeConfig): THREE.Group {
  const root = new THREE.Group();
  root.name = "reserve_trays";
  const config = theme.board;

  const frameBase = new THREE.MeshPhysicalMaterial({
    color: config.frameBase,
    roughness: Math.min(0.64, config.frameRoughness + 0.12),
    metalness: 0,
    clearcoat: config.frameClearcoat * 0.72,
    clearcoatRoughness: 0.36,
  });
  const bed = new THREE.MeshStandardMaterial({
    color: config.bed,
    roughness: 0.72,
    metalness: 0,
  });

  for (const xOffset of [5.3, -5.3]) {
    const tray = new THREE.Group();
    const baseMesh = new THREE.Mesh(
      new RoundedBoxGeometry(1.24, 0.22, 6.2, 4, 0.08),
      frameBase,
    );
    baseMesh.position.set(xOffset, 0.05, 0);
    baseMesh.receiveShadow = true;
    baseMesh.castShadow = true;
    tray.add(baseMesh);

    const bedMesh = new THREE.Mesh(
      new RoundedBoxGeometry(1.04, 0.06, 5.92, 3, 0.03),
      bed,
    );
    bedMesh.position.set(xOffset, 0.17, 0);
    bedMesh.receiveShadow = true;
    tray.add(bedMesh);

    for (let i = 0; i < 6; i++) {
      const z = RESERVE_Z_OFFSETS[i];
      const dish = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.42, 0.015, 24),
        frameBase,
      );
      dish.position.set(xOffset, 0.195, z);
      dish.receiveShadow = true;
      tray.add(dish);
    }
    root.add(tray);
  }

  return root;
}

function rebuildReservePieces(state: SceneState, selectedCode?: PieceCode | null) {
  disposeObject(state.reservePieces, { materials: false });
  state.reservePieces.clear();
  if (state.pieceLibraryStatus !== "ready") return;

  for (let i = 0; i < 6; i++) {
    const wCode = RESERVE_CODES_WHITE[i];
    const wPos = new THREE.Vector3(5.3, TILE_TOP, RESERVE_Z_OFFSETS[i]);
    const wMesh = createReservePiece(wCode, wPos, state);
    state.reservePieces.add(wMesh);

    const bCode = RESERVE_CODES_BLACK[i];
    const bPos = new THREE.Vector3(-5.3, TILE_TOP, RESERVE_Z_OFFSETS[i]);
    const bMesh = createReservePiece(bCode, bPos, state);
    state.reservePieces.add(bMesh);

    if (selectedCode === wCode) {
      const halo = createReserveSelectionHalo(wPos, state.materials.gold);
      state.reservePieces.add(halo);
    }
    if (selectedCode === bCode) {
      const halo = createReserveSelectionHalo(bPos, state.materials.gold);
      state.reservePieces.add(halo);
    }
  }
}

function updateRemotePointer(
  state: SceneState,
  remotePointer?: { square: Square | null; role: "teacher" | "student"; label?: string } | null,
) {
  disposeObject(state.remotePointers, { materials: true });
  state.remotePointers.clear();
  if (!remotePointer || !remotePointer.square) return;

  const loc = squarePosition(remotePointer.square);
  const color = remotePointer.role === "teacher" ? 0x10b981 : 0x38bdf8;
  const pointerMat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const outerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.44, 0.032, 8, 36),
    pointerMat,
  );
  outerRing.position.set(loc.x, TILE_TOP + 0.028, loc.z);
  outerRing.rotation.x = Math.PI / 2;
  outerRing.renderOrder = 9;
  state.remotePointers.add(outerRing);

  const centerDot = new THREE.Mesh(
    new THREE.CircleGeometry(0.12, 24),
    pointerMat,
  );
  centerDot.position.set(loc.x, TILE_TOP + 0.005, loc.z);
  centerDot.rotation.x = -Math.PI / 2;
  centerDot.renderOrder = 9;
  state.remotePointers.add(centerDot);
}

function rebuildPieces(state: SceneState) {
  if (state.pieceLibraryStatus === "failed") {
    disposeObject(state.pieces, { materials: false });
  }
  state.pieces.clear();
  if (state.pieceLibraryStatus === "loading") return;
  Object.entries(state.latestPosition).forEach(([square, code]) => {
    if (!code) return;
    state.pieces.add(createPiece(code, square as Square, state));
  });
}

function applyPositionUpdate(
  state: SceneState,
  newPosition: BoardPosition,
  lastMove?: LastMove | null,
) {
  const prevPosition = state.latestPosition;
  state.latestPosition = newPosition;

  if (state.pieceLibraryStatus !== "ready") {
    rebuildPieces(state);
    return;
  }

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canAnimate =
    !prefersReducedMotion &&
    lastMove &&
    prevPosition[lastMove.from] &&
    newPosition[lastMove.to];

  if (!canAnimate) {
    state.activeAnimations = [];
    state.activeFades = [];
    rebuildPieces(state);
    return;
  }

  const from = lastMove.from;
  const to = lastMove.to;
  const movedCode = newPosition[to]!;

  let movedMesh: THREE.Group | undefined;

  state.pieces.children.forEach((child) => {
    if (child.userData.square === from) {
      movedMesh = child as THREE.Group;
    } else if (child.userData.square === to) {
      const capturedGroup = child as THREE.Group;
      capturedGroup.userData.square = undefined;
      state.activeFades.push({
        mesh: capturedGroup,
        startTime: performance.now(),
        duration: 200,
      });
    }
  });

  if (movedMesh) {
    movedMesh.userData.square = to;
    movedMesh.userData.code = movedCode;
    const fromPos = squarePosition(from);
    const toPos = squarePosition(to);
    movedMesh.position.set(fromPos.x, TILE_TOP, fromPos.z);

    const isKnight = movedCode[1] === "N";
    const lift = isKnight ? 0.95 : 0.62;

    state.activeAnimations.push({
      mesh: movedMesh,
      fromPos: fromPos.clone(),
      toPos: toPos.clone(),
      startTime: performance.now(),
      duration: 220,
      lift,
    });

    // Handle en-passant capture
    if (movedCode[1] === "P" && from[0] !== to[0] && !prevPosition[to]) {
      const epCapturedSquare = `${to[0]}${from[1]}` as Square;
      const epChild = state.pieces.children.find(
        (c) => c.userData.square === epCapturedSquare,
      ) as THREE.Group | undefined;
      if (epChild) {
        epChild.userData.square = undefined;
        state.activeFades.push({
          mesh: epChild,
          startTime: performance.now(),
          duration: 200,
        });
      }
    }

    // Handle castling rook movement
    if (
      movedCode[1] === "K" &&
      Math.abs(from.charCodeAt(0) - to.charCodeAt(0)) === 2
    ) {
      const rank = from[1];
      const isKingside = to[0] === "g";
      const rookFrom = (isKingside ? `h${rank}` : `a${rank}`) as Square;
      const rookTo = (isKingside ? `f${rank}` : `d${rank}`) as Square;
      const rookCode = `${movedCode[0]}R` as PieceCode;
      const rookMesh = state.pieces.children.find(
        (c) => c.userData.square === rookFrom,
      ) as THREE.Group | undefined;
      if (rookMesh) {
        rookMesh.userData.square = rookTo;
        rookMesh.userData.code = rookCode;
        const rookFromPos = squarePosition(rookFrom);
        const rookToPos = squarePosition(rookTo);
        rookMesh.position.set(rookFromPos.x, TILE_TOP, rookFromPos.z);
        state.activeAnimations.push({
          mesh: rookMesh,
          fromPos: rookFromPos.clone(),
          toPos: rookToPos.clone(),
          startTime: performance.now() + 25,
          duration: 200,
          lift: 0.45,
        });
      }
    }
  } else {
    rebuildPieces(state);
  }
}

function updateHighlights(
  state: SceneState,
  activeSquare: Square | null,
  legalDestinations?: Square[],
  lastMove?: LastMove | null,
  checkSquare?: Square | null,
) {
  disposeObject(state.selection, { materials: false });
  state.selection.clear();
  disposeObject(state.highlights, { materials: false });
  state.highlights.clear();

  // 1. Last move highlights (from and to squares)
  if (lastMove) {
    const lastMoveMat = new THREE.MeshBasicMaterial({
      color: 0xdca83a,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    for (const sq of [lastMove.from, lastMove.to]) {
      if (!sq) continue;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), lastMoveMat);
      const loc = squarePosition(sq);
      mesh.position.set(loc.x, TILE_TOP + 0.002, loc.z);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 5;
      state.highlights.add(mesh);
    }
  }

  // 2. Check highlight on king square
  if (checkSquare) {
    const checkMat = new THREE.MeshBasicMaterial({
      color: 0xd9383a,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), checkMat);
    const loc = squarePosition(checkSquare);
    mesh.position.set(loc.x, TILE_TOP + 0.003, loc.z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.renderOrder = 6;
    state.highlights.add(mesh);
  }

  // 3. Active square ring
  if (activeSquare) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.39, 0.035, 10, 48),
      state.materials.gold,
    );
    const location = squarePosition(activeSquare);
    ring.position.set(location.x, TILE_TOP + 0.036, location.z);
    ring.rotation.x = Math.PI / 2;
    ring.renderOrder = 8;
    ring.castShadow = false;
    ring.receiveShadow = false;
    state.selection.add(ring);
  }

  // 4. Legal destination highlights
  if (legalDestinations && legalDestinations.length > 0) {
    const darkSquareDotMat = new THREE.MeshBasicMaterial({
      color: 0x58ea9c, // bright luminous mint/jade that pops brilliantly against dark green #244c3a
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lightSquareDotMat = new THREE.MeshBasicMaterial({
      color: 0x186b45, // rich contrast emerald that pops crisply against cream #eadcbd
      transparent: true,
      opacity: 0.72,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const captureRingMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    for (const dest of legalDestinations) {
      const isCapture = Boolean(state.latestPosition[dest]);
      const loc = squarePosition(dest);
      const file = dest.charCodeAt(0) - 97;
      const rank = Number(dest[1]);
      const isDark = (file + rank) % 2 === 1;

      if (isCapture) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(0.38, 0.038, 10, 48),
          captureRingMat,
        );
        ring.position.set(loc.x, TILE_TOP + 0.02, loc.z);
        ring.rotation.x = Math.PI / 2;
        ring.renderOrder = 7;
        state.highlights.add(ring);
      } else {
        const dot = new THREE.Mesh(
          new THREE.CircleGeometry(0.16, 36),
          isDark ? darkSquareDotMat : lightSquareDotMat,
        );
        dot.position.set(loc.x, TILE_TOP + 0.004, loc.z);
        dot.rotation.x = -Math.PI / 2;
        dot.renderOrder = 7;
        state.highlights.add(dot);
      }
    }
  }
}

function createLabel(text: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas labels are not available.");
  context.clearRect(0, 0, 128, 128);
  context.fillStyle = color;
  context.font = "bold 72px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    toneMapped: true,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), material);
  plane.rotation.x = -Math.PI / 2;
  plane.renderOrder = 4;
  plane.castShadow = false;
  plane.receiveShadow = false;
  return plane;
}

function create3DArrow(from: Square, to: Square, colorHex: string | number): THREE.Group {
  const group = new THREE.Group();
  const fromPos = squarePosition(from);
  const toPos = squarePosition(to);

  const start = new THREE.Vector3(fromPos.x, TILE_TOP + 0.045, fromPos.z);
  const end = new THREE.Vector3(toPos.x, TILE_TOP + 0.045, toPos.z);
  const dir = new THREE.Vector3().subVectors(end, start);
  const totalLength = dir.length();
  if (totalLength < 0.1) return group;
  dir.normalize();

  const shortenStart = 0.22;
  const headLength = 0.35;
  const headRadius = 0.14;
  const shaftRadius = 0.045;
  const shaftLength = Math.max(0.08, totalLength - shortenStart - headLength);

  const shaftStart = start.clone().add(dir.clone().multiplyScalar(shortenStart));
  const shaftEnd = shaftStart.clone().add(dir.clone().multiplyScalar(shaftLength));
  const shaftCenter = new THREE.Vector3().addVectors(shaftStart, shaftEnd).multiplyScalar(0.5);

  const material = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const shaftGeom = new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 16);
  const shaftMesh = new THREE.Mesh(shaftGeom, material);
  shaftMesh.position.copy(shaftCenter);
  shaftMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  shaftMesh.renderOrder = 9;
  group.add(shaftMesh);

  const headGeom = new THREE.ConeGeometry(headRadius, headLength, 16);
  const headMesh = new THREE.Mesh(headGeom, material);
  const headPos = shaftEnd.clone().add(dir.clone().multiplyScalar(headLength * 0.5));
  headMesh.position.copy(headPos);
  headMesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  headMesh.renderOrder = 9;
  group.add(headMesh);

  return group;
}

function createSquareHighlight(square: Square, colorHex: string | number): THREE.Mesh {
  const material = new THREE.MeshBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), material);
  const loc = squarePosition(square);
  mesh.position.set(loc.x, TILE_TOP + 0.0035, loc.z);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 6;
  return mesh;
}

function updateAnnotations(
  state: SceneState,
  arrows?: ArrowAnnotation[],
  squareHighlights?: SquareAnnotation[],
) {
  disposeObject(state.annotations, { materials: true });
  state.annotations.clear();

  if (squareHighlights && squareHighlights.length > 0) {
    for (const item of squareHighlights) {
      state.annotations.add(createSquareHighlight(item.square, item.color));
    }
  }

  if (arrows && arrows.length > 0) {
    for (const arrow of arrows) {
      state.annotations.add(create3DArrow(arrow.from, arrow.to, arrow.color));
    }
  }
}

function applyThemeToScene(
  state: SceneState,
  themeId: ThemeId,
  paletteId: PiecePaletteId = "theme-default",
) {
  const themeChanged = state.currentThemeId !== themeId;
  const paletteChanged = state.currentPaletteId !== paletteId;
  state.currentThemeId = themeId;
  state.currentPaletteId = paletteId;
  const config = THEMES[themeId] || THEMES["classic-walnut"];

  if (themeChanged) {
    if (state.scene.background instanceof THREE.CanvasTexture) {
      state.scene.background.dispose();
    }
    state.scene.background = createBackgroundTexture(config.background);

    if (state.floorMesh.material instanceof THREE.MeshStandardMaterial) {
      state.floorMesh.material.color.set(config.floor);
    }

    state.ambientLight.intensity = config.lighting.ambient;
    state.hemiLight.color.set(config.lighting.hemisphereSky);
    state.hemiLight.groundColor.set(config.lighting.hemisphereGround);
    state.hemiLight.intensity = config.lighting.hemisphereIntensity;
    state.keyLight.color.set(config.lighting.keyColor);
    state.keyLight.intensity = config.lighting.keyIntensity;
    state.keyLight.position.set(...config.lighting.keyPosition);
    state.fillLight.color.set(config.lighting.fillColor);
    state.fillLight.intensity = config.lighting.fillIntensity;
    state.fillLight.position.set(...config.lighting.fillPosition);
    state.renderer.toneMappingExposure = config.lighting.exposure;

    if (state.hover.material instanceof THREE.MeshBasicMaterial) {
      state.hover.material.color.set(config.hover);
    }

    const anisotropy = state.renderer.capabilities.getMaxAnisotropy();
    const oldBoard = state.board;
    const newBoard = createBoard(anisotropy, config);

    disposeObject(state.reserveTrays, { materials: true });
    state.reserveTrays = createReserveTraysGroup(config);

    newBoard.add(
      state.pieces,
      state.selection,
      state.highlights,
      state.annotations,
      state.remotePointers,
      state.reserveTrays,
      state.reservePieces,
      state.hover,
    );
    state.scene.remove(oldBoard);
    disposeObject(oldBoard, { materials: true });
    state.board = newBoard;
    state.scene.add(newBoard);
  }

  if (themeChanged || paletteChanged) {
    disposeMaterialSet(state.materials);
    state.materials = createPieceMaterials(config, paletteId);
    rebuildPieces(state);
    rebuildReservePieces(state);
  }
}

function createBoard(anisotropy: number, theme: ThemeConfig = THEME_CONFIG) {
  const board = new THREE.Group();
  board.name = "board";
  const config = theme.board;
  const grainTexture = config.woodGrain
    ? createWoodGrainTexture(config.frameTop, config.grain, anisotropy)
    : null;
  const frameBase = new THREE.MeshPhysicalMaterial({
    color: config.frameBase,
    roughness: Math.min(0.64, config.frameRoughness + 0.12),
    metalness: 0,
    clearcoat: config.frameClearcoat * 0.72,
    clearcoatRoughness: 0.36,
  });
  const frameTop = new THREE.MeshPhysicalMaterial({
    color: grainTexture ? "#ffffff" : config.frameTop,
    map: grainTexture,
    roughness: config.frameRoughness,
    metalness: 0,
    clearcoat: config.frameClearcoat,
    clearcoatRoughness: 0.3,
  });
  const bed = new THREE.MeshStandardMaterial({
    color: config.bed,
    roughness: 0.72,
    metalness: 0,
  });
  const trim = new THREE.MeshPhysicalMaterial({
    color: config.trim,
    roughness: 0.27,
    metalness: 0.62,
    clearcoat: 0.18,
    clearcoatRoughness: 0.24,
  });

  const createTileMaterial = (color: string) => new THREE.MeshPhysicalMaterial({
    color,
    roughness: config.tileRoughness,
    metalness: 0,
    clearcoat: config.tileClearcoat,
    clearcoatRoughness: 0.42,
  });
  const light = createTileMaterial(config.light);
  const dark = createTileMaterial(config.dark);

  const base = new THREE.Mesh(new RoundedBoxGeometry(8.9, 0.34, 8.9, 7, 0.16), frameBase);
  base.position.y = 0;
  base.receiveShadow = true;
  base.castShadow = true;
  board.add(base);

  const upperFrame = new THREE.Mesh(new RoundedBoxGeometry(8.62, 0.32, 8.62, 6, 0.08), frameTop);
  upperFrame.position.y = 0.21;
  upperFrame.receiveShadow = true;
  upperFrame.castShadow = true;
  board.add(upperFrame);

  const boardBed = new THREE.Mesh(new RoundedBoxGeometry(8.08, 0.09, 8.08, 4, 0.025), bed);
  boardBed.position.y = 0.322;
  boardBed.receiveShadow = true;
  boardBed.castShadow = false;
  board.add(boardBed);

  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = `${String.fromCharCode(97 + file)}${rank}` as Square;
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(0.994, 0.994),
        (file + rank) % 2 === 1 ? dark : light,
      );
      tile.position.copy(squarePosition(square));
      tile.rotation.x = -Math.PI / 2;
      tile.position.y = TILE_TOP;
      tile.receiveShadow = true;
      tile.castShadow = false;
      tile.userData = { kind: "square", square };
      board.add(tile);
    }
  }

  const trimGeometryLong = new RoundedBoxGeometry(8.06, 0.016, 0.024, 2, 0.006);
  const trimGeometryShort = new RoundedBoxGeometry(0.024, 0.016, 8.06, 2, 0.006);
  for (const z of [-4.025, 4.025]) {
    const rail = addMesh(board, trimGeometryLong.clone(), trim, [0, TILE_TOP + 0.003, z]);
    rail.castShadow = false;
    rail.receiveShadow = true;
  }
  for (const x of [-4.025, 4.025]) {
    const rail = addMesh(board, trimGeometryShort.clone(), trim, [x, TILE_TOP + 0.003, 0]);
    rail.castShadow = false;
    rail.receiveShadow = true;
  }

  const files = "abcdefgh";
  for (let index = 0; index < 8; index += 1) {
    const x = index - 3.5;
    const near = createLabel(files[index], config.label);
    near.position.set(x, TILE_TOP + 0.001, 4.20);
    board.add(near);
    const far = createLabel(files[index], config.label);
    far.position.set(x, TILE_TOP + 0.001, -4.20);
    far.rotation.z = Math.PI;
    board.add(far);

    const z = 3.5 - index;
    const left = createLabel(String(index + 1), config.label);
    left.position.set(-4.20, TILE_TOP + 0.001, z);
    left.rotation.z = -Math.PI / 2;
    board.add(left);
    const right = createLabel(String(index + 1), config.label);
    right.position.set(4.20, TILE_TOP + 0.001, z);
    right.rotation.z = Math.PI / 2;
    board.add(right);
  }

  return board;
}

function disposeMaterial(material: THREE.Material) {
  const mapped = material as THREE.Material & {
    map?: THREE.Texture | null;
    alphaMap?: THREE.Texture | null;
    bumpMap?: THREE.Texture | null;
    roughnessMap?: THREE.Texture | null;
    gradientMap?: THREE.Texture | null;
  };
  const textures = new Set([
    mapped.map,
    mapped.alphaMap,
    mapped.bumpMap,
    mapped.roughnessMap,
    mapped.gradientMap,
  ]);
  textures.forEach((texture) => texture?.dispose());
  material.dispose();
}

function disposeObject(
  object: THREE.Object3D,
  options: { geometries?: boolean; materials?: boolean } = {},
) {
  const { geometries = true, materials = true } = options;
  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (geometries) child.geometry?.dispose();
    if (!materials) return;
    const childMaterials = Array.isArray(child.material) ? child.material : [child.material];
    childMaterials.forEach(disposeMaterial);
  });
}

function disposeMaterialSet(materials: Materials) {
  new Set(Object.values(materials).filter(Boolean)).forEach((material) => {
    disposeMaterial(material as THREE.Material);
  });
}

export type ChessClock3D = {
  group: THREE.Group;
  leftButton: THREE.Mesh;
  rightButton: THREE.Mesh;
  leftTexture: THREE.CanvasTexture;
  rightTexture: THREE.CanvasTexture;
  updateTime: (
    whiteTimeMs: number,
    blackTimeMs: number,
    activeSide: "w" | "b" | null,
    flagFallenSide: "w" | "b" | null,
    formatTime: (ms: number) => string,
  ) => void;
  dispose: () => void;
};

function format3DClockTime(timeMs: number): string {
  if (timeMs <= 0) return "0:00.0";
  const totalSeconds = Math.floor(timeMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalSeconds < 20) {
    const tenths = Math.floor((timeMs % 1000) / 100);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
  }
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function createClockCanvasTexture(size: { width: number; height: number } = { width: 512, height: 256 }): { canvas: HTMLCanvasElement; texture: THREE.CanvasTexture; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d")!;
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, texture, ctx };
}

function renderDigitalClockFace(
  ctx: CanvasRenderingContext2D,
  label: string,
  timeStr: string,
  isActive: boolean,
  isFlag: boolean,
  design: ClockDesignConfig,
) {
  const w = 512;
  const h = 256;

  if (design.id === "nordic-birch") {
    ctx.fillStyle = isActive ? "#e4ede6" : isFlag ? "#fae8e8" : "#f1ede6";
  } else {
    // FIDE DGT 3000 tournament LCD style
    ctx.fillStyle = isActive ? "#091c13" : isFlag ? "#2b0a0a" : "#0d131a";
  }
  ctx.fillRect(0, 0, w, h);

  ctx.lineWidth = 14;
  if (isActive) {
    ctx.strokeStyle = design.activeBorderColor || "#10b981";
  } else if (isFlag) {
    ctx.strokeStyle = "#ef4444";
  } else {
    ctx.strokeStyle = design.id === "nordic-birch" ? "#d2c7b5" : "#1e293b";
  }
  ctx.strokeRect(7, 7, w - 14, h - 14);

  ctx.font = "bold 36px sans-serif";
  if (isActive) {
    ctx.fillStyle = design.activeTextColor || "#10b981";
  } else if (isFlag) {
    ctx.fillStyle = "#fca5a5";
  } else {
    ctx.fillStyle = design.id === "nordic-birch" ? "#475569" : "#64748b";
  }
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 36, 54);

  if (isFlag) {
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 34px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("TIME OUT", w - 36, 54);
  } else if (isActive) {
    ctx.fillStyle = design.accentColor || "#10b981";
    ctx.beginPath();
    ctx.arc(w - 48, 54, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.font = "bold 110px monospace";
  ctx.fillStyle = isActive ? (design.activeTextColor || "#10b981") : isFlag ? "#ef4444" : (design.textColor || "#f1f5f9");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(timeStr, w / 2, 158);
}

function renderQuantumClockFace(
  ctx: CanvasRenderingContext2D,
  label: string,
  timeStr: string,
  isActive: boolean,
  isFlag: boolean,
  design: ClockDesignConfig,
) {
  const w = 512;
  const h = 256;

  // Futuristic deep space OLED glass
  ctx.fillStyle = isActive ? "#030c14" : isFlag ? "#260606" : "#020408";
  ctx.fillRect(0, 0, w, h);

  // Futuristic HUD corner brackets
  ctx.lineWidth = 4;
  ctx.strokeStyle = isActive ? "#00f0ff" : isFlag ? "#ef4444" : "rgba(0, 240, 255, 0.28)";

  const cornerSize = 22;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(12, 12 + cornerSize);
  ctx.lineTo(12, 12);
  ctx.lineTo(12 + cornerSize, 12);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(w - 12 - cornerSize, 12);
  ctx.lineTo(w - 12, 12);
  ctx.lineTo(w - 12, 12 + cornerSize);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(12, h - 12 - cornerSize);
  ctx.lineTo(12, h - 12);
  ctx.lineTo(12 + cornerSize, h - 12);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(w - 12 - cornerSize, h - 12);
  ctx.lineTo(w - 12, h - 12);
  ctx.lineTo(w - 12, h - 12 - cornerSize);
  ctx.stroke();

  // Sci-fi subgrid scan lines
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0, 240, 255, 0.07)";
  for (let y = 32; y < h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(14, y);
    ctx.lineTo(w - 14, y);
    ctx.stroke();
  }

  // Header / Side designation
  ctx.font = "800 28px 'Consolas', 'Courier New', monospace";
  ctx.fillStyle = isActive ? "#00f0ff" : isFlag ? "#fca5a5" : "#64748b";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(`// ${label}`, 34, 46);

  if (isFlag) {
    ctx.fillStyle = "#ef4444";
    ctx.font = "800 28px monospace";
    ctx.textAlign = "right";
    ctx.fillText("[ CRITICAL: FLAG ]", w - 34, 46);
  } else if (isActive) {
    ctx.fillStyle = "#00f0ff";
    ctx.font = "800 24px monospace";
    ctx.textAlign = "right";
    ctx.fillText("● ACTIVE TURN", w - 34, 46);
  }

  // Glowing holographic quantum numbers
  ctx.font = "900 114px 'Consolas', 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (isActive) {
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(timeStr, w / 2, 156);
    ctx.shadowBlur = 0;
  } else if (isFlag) {
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#ef4444";
    ctx.fillText(timeStr, w / 2, 156);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = "#64748b";
    ctx.fillText(timeStr, w / 2, 156);
  }
}

function renderChronosClockFace(
  ctx: CanvasRenderingContext2D,
  label: string,
  timeStr: string,
  isActive: boolean,
  isFlag: boolean,
  design: ClockDesignConfig,
) {
  const w = 512;
  const h = 256;

  // Chronos deep recessed LED window
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, w, h);

  // Recessed inner metallic bezel border
  ctx.lineWidth = 12;
  ctx.strokeStyle = isActive ? "#22c55e" : isFlag ? "#ef4444" : "#1e293b";
  ctx.strokeRect(6, 6, w - 12, h - 12);

  // Small side indicator LED
  ctx.font = "bold 32px monospace";
  ctx.fillStyle = isActive ? "#4ade80" : isFlag ? "#ef4444" : "#64748b";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 32, 48);

  if (isFlag) {
    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 30px monospace";
    ctx.textAlign = "right";
    ctx.fillText("TIME OUT", w - 32, 48);
  } else if (isActive) {
    ctx.fillStyle = "#22c55e";
    ctx.beginPath();
    ctx.arc(w - 44, 48, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  // Classic Chronos 7-Segment style LED glow
  ctx.font = "bold 118px 'Courier New', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (isActive) {
    ctx.shadowColor = "#22c55e";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#4ade80";
    ctx.fillText(timeStr, w / 2, 155);
    ctx.shadowBlur = 0;
  } else if (isFlag) {
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#ef4444";
    ctx.fillText(timeStr, w / 2, 155);
    ctx.shadowBlur = 0;
  } else {
    ctx.shadowColor = "#ef4444";
    ctx.shadowBlur = 6;
    ctx.fillStyle = "#f87171";
    ctx.fillText(timeStr, w / 2, 155);
    ctx.shadowBlur = 0;
  }
}

function renderAnalogClockDial(
  ctx: CanvasRenderingContext2D,
  sideLabel: string,
  timeMs: number,
  isActive: boolean,
  isFlagFallen: boolean,
  design: ClockDesignConfig,
) {
  const w = 512;
  const h = 512;
  const cx = w / 2;
  const cy = h / 2;
  const r = 215;

  ctx.clearRect(0, 0, w, h);

  // Dial background
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  const bgGrad = ctx.createRadialGradient(cx - 30, cy - 30, 20, cx, cy, r);
  if (design.id === "analog-wood") {
    bgGrad.addColorStop(0, "#fffef9");
    bgGrad.addColorStop(0.85, "#f7eedc");
    bgGrad.addColorStop(1, "#ebd7b2");
  } else {
    bgGrad.addColorStop(0, "#ffffff");
    bgGrad.addColorStop(0.9, "#f0f2f5");
    bgGrad.addColorStop(1, "#d9e0e8");
  }
  ctx.fillStyle = bgGrad;
  ctx.fill();

  // Dial outer ring border
  ctx.lineWidth = 10;
  ctx.strokeStyle = isActive ? (design.accentColor || "#dc2626") : (design.id === "analog-wood" ? "#8c6239" : "#64748b");
  ctx.stroke();

  // Sub-ring
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
  ctx.beginPath();
  ctx.arc(cx, cy, r - 16, 0, Math.PI * 2);
  ctx.stroke();

  // Minute / Hour Tick marks & Numerals
  for (let i = 0; i < 60; i++) {
    const angle = (i * Math.PI) / 30 - Math.PI / 2;
    const isHour = i % 5 === 0;
    const tickLen = isHour ? 22 : 10;
    const innerR = r - 16 - tickLen;
    const outerR = r - 16;

    const x1 = cx + Math.cos(angle) * innerR;
    const y1 = cy + Math.sin(angle) * innerR;
    const x2 = cx + Math.cos(angle) * outerR;
    const y2 = cy + Math.sin(angle) * outerR;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineWidth = isHour ? 6 : 2;
    ctx.strokeStyle = isHour ? "#1f2937" : "rgba(31, 41, 55, 0.45)";
    ctx.stroke();

    if (isHour) {
      const num = i === 0 ? 12 : i / 5;
      const numR = r - 58;
      const nx = cx + Math.cos(angle) * numR;
      const ny = cy + Math.sin(angle) * numR;

      ctx.fillStyle = "#111827";
      ctx.font = "bold 34px 'Cinzel', 'Georgia', serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(num.toString(), nx, ny);
    }
  }

  // Side label badge in top quadrant
  ctx.font = "800 24px system-ui, sans-serif";
  ctx.fillStyle = isActive ? (design.activeTextColor || "#15803d") : "#6b7280";
  ctx.textAlign = "center";
  ctx.fillText(sideLabel, cx, cy - 75);

  // Red Flag at 11:30 - 12:00
  ctx.save();
  ctx.fillStyle = isFlagFallen ? "#dc2626" : "rgba(220, 38, 38, 0.85)";
  ctx.beginPath();
  if (isFlagFallen) {
    ctx.moveTo(cx - 8, cy - r + 45);
    ctx.lineTo(cx - 8, cy - r + 90);
    ctx.lineTo(cx + 36, cy - r + 75);
  } else {
    ctx.moveTo(cx - 8, cy - r + 24);
    ctx.lineTo(cx - 8, cy - r + 68);
    ctx.lineTo(cx + 34, cy - r + 46);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Hands calculation based on remaining time
  const totalSeconds = Math.max(0, Math.floor(timeMs / 1000));
  const minutes = (totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;

  // Minute Hand (long hand)
  const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(minAngle) * 25, cy - Math.sin(minAngle) * 25);
  ctx.lineTo(cx + Math.cos(minAngle) * (r - 40), cy + Math.sin(minAngle) * (r - 40));
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#111827";
  ctx.stroke();
  ctx.restore();

  // Hour / Second Hand (shorter hand)
  const hourAngle = ((minutes / 12) / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(hourAngle) * 18, cy - Math.sin(hourAngle) * 18);
  ctx.lineTo(cx + Math.cos(hourAngle) * (r - 95), cy + Math.sin(hourAngle) * (r - 95));
  ctx.lineWidth = 12;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#111827";
  ctx.stroke();
  ctx.restore();

  // Second tick needle
  const secAngle = (seconds / 60) * Math.PI * 2 - Math.PI / 2;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(secAngle) * 35, cy - Math.sin(secAngle) * 35);
  ctx.lineTo(cx + Math.cos(secAngle) * (r - 30), cy + Math.sin(secAngle) * (r - 30));
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#dc2626";
  ctx.stroke();
  ctx.restore();

  // Center cap pin
  ctx.beginPath();
  ctx.arc(cx, cy, 14, 0, Math.PI * 2);
  ctx.fillStyle = design.id === "analog-wood" ? "#d4af37" : "#374151";
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#111827";
  ctx.stroke();

  // Active glow border
  if (isActive) {
    ctx.beginPath();
    ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
    ctx.lineWidth = 4;
    ctx.strokeStyle = design.accentColor || "#4ade80";
    ctx.stroke();
  }
}

function create3DChessClockModel(
  designId: ClockDesignId = "dgt-3000",
  config: ThemeConfig = THEME_CONFIG,
): ChessClock3D | null {
  const design = CLOCK_DESIGNS[designId] || CLOCK_DESIGNS["dgt-3000"];
  if (design.kind === "none") return null;

  const group = new THREE.Group();
  group.name = "chess-clock-3d";
  group.position.set(5.25, 0, 0);
  group.rotation.y = 0;

  if (design.kind === "quantum") {
    // --- 🛸 QUANTUM CYBER TITANIUM TIMER ---
    const bodyGeo = new THREE.BoxGeometry(1.26, 0.64, 2.54);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: design.casingColor,
      roughness: design.casingRoughness,
      metalness: design.casingMetalness,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.32, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = { kind: "clock" };
    group.add(body);

    // Glowing photon edge light strips
    const stripGeo = new THREE.BoxGeometry(0.04, 0.04, 2.46);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const topStrip = new THREE.Mesh(stripGeo, stripMat);
    topStrip.position.set(-0.61, 0.62, 0);
    topStrip.userData = { kind: "clock" };
    group.add(topStrip);

    const botStrip = new THREE.Mesh(stripGeo, stripMat);
    botStrip.position.set(-0.61, 0.04, 0);
    botStrip.userData = { kind: "clock" };
    group.add(botStrip);

    // Twin curved OLED glass screens
    const leftScreen = createClockCanvasTexture();
    const rightScreen = createClockCanvasTexture();

    const screenGeo = new THREE.PlaneGeometry(1.02, 0.44);
    const leftScreenMat = new THREE.MeshBasicMaterial({
      map: leftScreen.texture,
      side: THREE.FrontSide,
    });
    const rightScreenMat = new THREE.MeshBasicMaterial({
      map: rightScreen.texture,
      side: THREE.FrontSide,
    });

    const leftScreenMesh = new THREE.Mesh(screenGeo, leftScreenMat);
    leftScreenMesh.position.set(-0.64, 0.33, -0.58);
    leftScreenMesh.rotation.y = -Math.PI / 2;
    leftScreenMesh.rotation.x = -0.16;
    leftScreenMesh.userData = { kind: "clock" };
    group.add(leftScreenMesh);

    const rightScreenMesh = new THREE.Mesh(screenGeo, rightScreenMat);
    rightScreenMesh.position.set(-0.64, 0.33, 0.58);
    rightScreenMesh.rotation.y = -Math.PI / 2;
    rightScreenMesh.rotation.x = -0.16;
    rightScreenMesh.userData = { kind: "clock" };
    group.add(rightScreenMesh);

    // Low-profile capacitive touch sensor rocker pads
    const padGeo = new THREE.BoxGeometry(0.86, 0.12, 0.94);
    const padMat = new THREE.MeshStandardMaterial({
      color: design.buttonColor,
      roughness: 0.2,
      metalness: 0.88,
    });
    const leftButton = new THREE.Mesh(padGeo, padMat.clone());
    leftButton.position.set(0, 0.66, -0.58);
    leftButton.castShadow = true;
    leftButton.userData = { kind: "clock", side: "w" };
    group.add(leftButton);

    const rightButton = new THREE.Mesh(padGeo, padMat.clone());
    rightButton.position.set(0, 0.66, 0.58);
    rightButton.castShadow = true;
    rightButton.userData = { kind: "clock", side: "b" };
    group.add(rightButton);

    renderQuantumClockFace(leftScreen.ctx, "WHITE", "05:00", false, false, design);
    leftScreen.texture.needsUpdate = true;
    renderQuantumClockFace(rightScreen.ctx, "BLACK", "05:00", false, false, design);
    rightScreen.texture.needsUpdate = true;

    const updateTime = (
      whiteTimeMs: number,
      blackTimeMs: number,
      activeSide: "w" | "b" | null,
      flagFallenSide: "w" | "b" | null,
      formatTime: (ms: number) => string,
    ) => {
      const isWhiteActive = activeSide === "w";
      const isBlackActive = activeSide === "b";
      const isWhiteFlag = flagFallenSide === "w";
      const isBlackFlag = flagFallenSide === "b";

      renderQuantumClockFace(leftScreen.ctx, "WHITE", formatTime(whiteTimeMs), isWhiteActive, isWhiteFlag, design);
      leftScreen.texture.needsUpdate = true;

      renderQuantumClockFace(rightScreen.ctx, "BLACK", formatTime(blackTimeMs), isBlackActive, isBlackFlag, design);
      rightScreen.texture.needsUpdate = true;

      if (isWhiteActive) {
        leftButton.position.y = 0.62;
        rightButton.position.y = 0.70;
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(0x0f172a);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(0x00f0ff);
      } else if (isBlackActive) {
        leftButton.position.y = 0.70;
        rightButton.position.y = 0.62;
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(0x00f0ff);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(0x0f172a);
      } else {
        leftButton.position.y = 0.66;
        rightButton.position.y = 0.66;
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
      }
    };

    const dispose = () => {
      leftScreen.texture.dispose();
      rightScreen.texture.dispose();
      disposeObject(group, { geometries: true, materials: true });
    };

    return {
      group,
      leftButton,
      rightButton,
      leftTexture: leftScreen.texture,
      rightTexture: rightScreen.texture,
      updateTime,
      dispose,
    };
  }

  if (design.kind === "chronos") {
    // --- ⚡ CHRONOS BLITZ METAL TIMER ---
    const bodyGeo = new THREE.BoxGeometry(1.22, 0.62, 2.48);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: design.casingColor,
      roughness: design.casingRoughness,
      metalness: design.casingMetalness,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.31, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = { kind: "clock" };
    group.add(body);

    // Front recessed face panel
    const faceGeo = new THREE.BoxGeometry(0.08, 0.48, 2.32);
    const faceMat = new THREE.MeshStandardMaterial({
      color: 0x020617,
      roughness: 0.3,
      metalness: 0.8,
    });
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(-0.58, 0.31, 0);
    face.userData = { kind: "clock" };
    group.add(face);

    // Screens
    const leftScreen = createClockCanvasTexture();
    const rightScreen = createClockCanvasTexture();

    const screenGeo = new THREE.PlaneGeometry(1.02, 0.42);
    const leftScreenMat = new THREE.MeshBasicMaterial({
      map: leftScreen.texture,
      side: THREE.FrontSide,
    });
    const rightScreenMat = new THREE.MeshBasicMaterial({
      map: rightScreen.texture,
      side: THREE.FrontSide,
    });

    const leftScreenMesh = new THREE.Mesh(screenGeo, leftScreenMat);
    leftScreenMesh.position.set(-0.625, 0.31, -0.58);
    leftScreenMesh.rotation.y = -Math.PI / 2;
    leftScreenMesh.userData = { kind: "clock" };
    group.add(leftScreenMesh);

    const rightScreenMesh = new THREE.Mesh(screenGeo, rightScreenMat);
    rightScreenMesh.position.set(-0.625, 0.31, 0.58);
    rightScreenMesh.rotation.y = -Math.PI / 2;
    rightScreenMesh.userData = { kind: "clock" };
    group.add(rightScreenMesh);

    // Top circular metallic touch sensor buttons
    const touchGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 32);
    const touchMat = new THREE.MeshStandardMaterial({
      color: design.buttonColor,
      roughness: 0.18,
      metalness: 0.95,
    });
    const leftButton = new THREE.Mesh(touchGeo, touchMat.clone());
    leftButton.position.set(0, 0.64, -0.58);
    leftButton.castShadow = true;
    leftButton.userData = { kind: "clock", side: "w" };
    group.add(leftButton);

    const rightButton = new THREE.Mesh(touchGeo, touchMat.clone());
    rightButton.position.set(0, 0.64, 0.58);
    rightButton.castShadow = true;
    rightButton.userData = { kind: "clock", side: "b" };
    group.add(rightButton);

    renderChronosClockFace(leftScreen.ctx, "WHITE", "05:00", false, false, design);
    leftScreen.texture.needsUpdate = true;
    renderChronosClockFace(rightScreen.ctx, "BLACK", "05:00", false, false, design);
    rightScreen.texture.needsUpdate = true;

    const updateTime = (
      whiteTimeMs: number,
      blackTimeMs: number,
      activeSide: "w" | "b" | null,
      flagFallenSide: "w" | "b" | null,
      formatTime: (ms: number) => string,
    ) => {
      const isWhiteActive = activeSide === "w";
      const isBlackActive = activeSide === "b";
      const isWhiteFlag = flagFallenSide === "w";
      const isBlackFlag = flagFallenSide === "b";

      renderChronosClockFace(leftScreen.ctx, "WHITE", formatTime(whiteTimeMs), isWhiteActive, isWhiteFlag, design);
      leftScreen.texture.needsUpdate = true;

      renderChronosClockFace(rightScreen.ctx, "BLACK", formatTime(blackTimeMs), isBlackActive, isBlackFlag, design);
      rightScreen.texture.needsUpdate = true;

      if (isWhiteActive) {
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(0x64748b);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(0x22c55e);
      } else if (isBlackActive) {
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(0x22c55e);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(0x64748b);
      } else {
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
      }
    };

    const dispose = () => {
      leftScreen.texture.dispose();
      rightScreen.texture.dispose();
      disposeObject(group, { geometries: true, materials: true });
    };

    return {
      group,
      leftButton,
      rightButton,
      leftTexture: leftScreen.texture,
      rightTexture: rightScreen.texture,
      updateTime,
      dispose,
    };
  }

  if (design.kind === "analog") {
    // --- 🪵 VINTAGE / WOOD ANALOG CABINET ---
    const bodyGeo = new THREE.BoxGeometry(1.15, 0.78, 2.45);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: design.casingColor,
      roughness: design.casingRoughness,
      metalness: design.casingMetalness,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.39, 0);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData = { kind: "clock" };
    group.add(body);

    // Cornice top & base trim
    const trimGeo = new THREE.BoxGeometry(1.22, 0.06, 2.52);
    const topTrim = new THREE.Mesh(trimGeo, bodyMat);
    topTrim.position.set(0, 0.76, 0);
    topTrim.castShadow = true;
    topTrim.userData = { kind: "clock" };
    group.add(topTrim);

    const baseTrim = new THREE.Mesh(trimGeo, bodyMat);
    baseTrim.position.set(0, 0.03, 0);
    baseTrim.castShadow = true;
    baseTrim.userData = { kind: "clock" };
    group.add(baseTrim);

    // Dual circular dials
    const leftScreen = createClockCanvasTexture({ width: 512, height: 512 });
    const rightScreen = createClockCanvasTexture({ width: 512, height: 512 });

    const dialGeo = new THREE.CircleGeometry(0.46, 32);
    const leftDialMat = new THREE.MeshBasicMaterial({
      map: leftScreen.texture,
      side: THREE.FrontSide,
    });
    const rightDialMat = new THREE.MeshBasicMaterial({
      map: rightScreen.texture,
      side: THREE.FrontSide,
    });

    const leftDialMesh = new THREE.Mesh(dialGeo, leftDialMat);
    leftDialMesh.position.set(-0.58, 0.40, -0.58);
    leftDialMesh.rotation.y = -Math.PI / 2;
    leftDialMesh.userData = { kind: "clock" };
    group.add(leftDialMesh);

    const rightDialMesh = new THREE.Mesh(dialGeo, rightDialMat);
    rightDialMesh.position.set(-0.58, 0.40, 0.58);
    rightDialMesh.rotation.y = -Math.PI / 2;
    rightDialMesh.userData = { kind: "clock" };
    group.add(rightDialMesh);

    // Bezel rings
    const bezelGeo = new THREE.RingGeometry(0.45, 0.49, 32);
    const bezelMat = new THREE.MeshStandardMaterial({
      color: design.buttonColor,
      roughness: 0.25,
      metalness: 0.85,
    });
    const leftBezel = new THREE.Mesh(bezelGeo, bezelMat);
    leftBezel.position.set(-0.582, 0.40, -0.58);
    leftBezel.rotation.y = -Math.PI / 2;
    leftBezel.userData = { kind: "clock" };
    group.add(leftBezel);

    const rightBezel = new THREE.Mesh(bezelGeo, bezelMat);
    rightBezel.position.set(-0.582, 0.40, 0.58);
    rightBezel.rotation.y = -Math.PI / 2;
    rightBezel.userData = { kind: "clock" };
    group.add(rightBezel);

    // Top mechanical plungers
    const plungerGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.26, 24);
    const plungerMat = new THREE.MeshStandardMaterial({
      color: design.buttonColor,
      roughness: 0.22,
      metalness: 0.88,
    });
    const leftButton = new THREE.Mesh(plungerGeo, plungerMat.clone());
    leftButton.position.set(0, 0.86, -0.58);
    leftButton.castShadow = true;
    leftButton.userData = { kind: "clock", side: "w" };
    group.add(leftButton);

    const rightButton = new THREE.Mesh(plungerGeo, plungerMat.clone());
    rightButton.position.set(0, 0.86, 0.58);
    rightButton.castShadow = true;
    rightButton.userData = { kind: "clock", side: "b" };
    group.add(rightButton);

    // Center stopper pin
    const stopPinGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 16);
    const stopPin = new THREE.Mesh(stopPinGeo, plungerMat);
    stopPin.position.set(0, 0.84, 0);
    stopPin.userData = { kind: "clock" };
    group.add(stopPin);

    renderAnalogClockDial(leftScreen.ctx, "WHITE", 300000, false, false, design);
    leftScreen.texture.needsUpdate = true;
    renderAnalogClockDial(rightScreen.ctx, "BLACK", 300000, false, false, design);
    rightScreen.texture.needsUpdate = true;

    const updateTime = (
      whiteTimeMs: number,
      blackTimeMs: number,
      activeSide: "w" | "b" | null,
      flagFallenSide: "w" | "b" | null,
      formatTime: (ms: number) => string,
    ) => {
      const isWhiteActive = activeSide === "w";
      const isBlackActive = activeSide === "b";
      const isWhiteFlag = flagFallenSide === "w";
      const isBlackFlag = flagFallenSide === "b";

      renderAnalogClockDial(leftScreen.ctx, "WHITE", whiteTimeMs, isWhiteActive, isWhiteFlag, design);
      leftScreen.texture.needsUpdate = true;

      renderAnalogClockDial(rightScreen.ctx, "BLACK", blackTimeMs, isBlackActive, isBlackFlag, design);
      rightScreen.texture.needsUpdate = true;

      if (isWhiteActive) {
        leftButton.position.y = 0.80;
        rightButton.position.y = 0.92;
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonActiveColor);
      } else if (isBlackActive) {
        leftButton.position.y = 0.92;
        rightButton.position.y = 0.80;
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonActiveColor);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
      } else {
        leftButton.position.y = 0.86;
        rightButton.position.y = 0.86;
        (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
        (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
      }
    };

    const dispose = () => {
      leftScreen.texture.dispose();
      rightScreen.texture.dispose();
      disposeObject(group, { geometries: true, materials: true });
    };

    return {
      group,
      leftButton,
      rightButton,
      leftTexture: leftScreen.texture,
      rightTexture: rightScreen.texture,
      updateTime,
      dispose,
    };
  }

  // --- 🏆 FIDE DGT / NORDIC BIRCH TOURNAMENT DIGITAL CLOCKS ---
  const bodyGeo = new THREE.BoxGeometry(1.25, 0.65, 2.5);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: design.casingColor,
    roughness: design.casingRoughness,
    metalness: design.casingMetalness,
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.set(0, 0.325, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  body.userData = { kind: "clock" };
  group.add(body);

  const faceGeo = new THREE.BoxGeometry(0.12, 0.52, 2.34);
  const faceMat = new THREE.MeshStandardMaterial({
    color: design.faceColor ?? 0x111c16,
    roughness: 0.5,
    metalness: 0.2,
  });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.set(-0.58, 0.34, 0);
  face.rotation.z = 0.16;
  face.castShadow = true;
  face.receiveShadow = true;
  face.userData = { kind: "clock" };
  group.add(face);

  const leftScreen = createClockCanvasTexture();
  const rightScreen = createClockCanvasTexture();

  const screenGeo = new THREE.PlaneGeometry(1.02, 0.44);
  const leftScreenMat = new THREE.MeshBasicMaterial({
    map: leftScreen.texture,
    side: THREE.FrontSide,
  });
  const rightScreenMat = new THREE.MeshBasicMaterial({
    map: rightScreen.texture,
    side: THREE.FrontSide,
  });

  const leftScreenMesh = new THREE.Mesh(screenGeo, leftScreenMat);
  leftScreenMesh.position.set(-0.645, 0.34, -0.58);
  leftScreenMesh.rotation.y = -Math.PI / 2;
  leftScreenMesh.rotation.x = -0.16;
  leftScreenMesh.userData = { kind: "clock" };
  group.add(leftScreenMesh);

  const rightScreenMesh = new THREE.Mesh(screenGeo, rightScreenMat);
  rightScreenMesh.position.set(-0.645, 0.34, 0.58);
  rightScreenMesh.rotation.y = -Math.PI / 2;
  rightScreenMesh.rotation.x = -0.16;
  rightScreenMesh.userData = { kind: "clock" };
  group.add(rightScreenMesh);

  const buttonGeo = new THREE.BoxGeometry(0.85, 0.14, 0.92);
  const buttonMat = new THREE.MeshStandardMaterial({
    color: design.buttonColor,
    roughness: 0.3,
    metalness: 0.4,
  });
  const leftButton = new THREE.Mesh(buttonGeo, buttonMat.clone());
  leftButton.position.set(0, 0.68, -0.58);
  leftButton.castShadow = true;
  leftButton.userData = { kind: "clock", side: "w" };
  group.add(leftButton);

  const rightButton = new THREE.Mesh(buttonGeo, buttonMat.clone());
  rightButton.position.set(0, 0.68, 0.58);
  rightButton.castShadow = true;
  rightButton.userData = { kind: "clock", side: "b" };
  group.add(rightButton);

  renderDigitalClockFace(leftScreen.ctx, "WHITE", "05:00", false, false, design);
  leftScreen.texture.needsUpdate = true;
  renderDigitalClockFace(rightScreen.ctx, "BLACK", "05:00", false, false, design);
  rightScreen.texture.needsUpdate = true;

  const updateTime = (
    whiteTimeMs: number,
    blackTimeMs: number,
    activeSide: "w" | "b" | null,
    flagFallenSide: "w" | "b" | null,
    formatTime: (ms: number) => string,
  ) => {
    const isWhiteActive = activeSide === "w";
    const isBlackActive = activeSide === "b";
    const isWhiteFlag = flagFallenSide === "w";
    const isBlackFlag = flagFallenSide === "b";

    renderDigitalClockFace(leftScreen.ctx, "WHITE", formatTime(whiteTimeMs), isWhiteActive, isWhiteFlag, design);
    leftScreen.texture.needsUpdate = true;

    renderDigitalClockFace(rightScreen.ctx, "BLACK", formatTime(blackTimeMs), isBlackActive, isBlackFlag, design);
    rightScreen.texture.needsUpdate = true;

    if (isWhiteActive) {
      leftButton.position.y = 0.64;
      rightButton.position.y = 0.72;
      (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
      (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonActiveColor);
    } else if (isBlackActive) {
      leftButton.position.y = 0.72;
      rightButton.position.y = 0.64;
      (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonActiveColor);
      (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
    } else {
      leftButton.position.y = 0.68;
      rightButton.position.y = 0.68;
      (leftButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
      (rightButton.material as THREE.MeshStandardMaterial).color.setHex(design.buttonColor);
    }
  };

  const dispose = () => {
    leftScreen.texture.dispose();
    rightScreen.texture.dispose();
    disposeObject(group, { geometries: true, materials: true });
  };

  return {
    group,
    leftButton,
    rightButton,
    leftTexture: leftScreen.texture,
    rightTexture: rightScreen.texture,
    updateTime,
    dispose,
  };
}

function findInteractive(object: THREE.Object3D | null): THREE.Object3D | null {
  if (!object) return null;
  let check: THREE.Object3D | null = object;
  while (check) {
    if (!check.visible) return null;
    check = check.parent;
  }
  let current: THREE.Object3D | null = object;
  while (current) {
    if (
      current.userData.kind === "piece" ||
      current.userData.kind === "square" ||
      current.userData.kind === "reserve_piece" ||
      current.userData.kind === "clock"
    ) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function transitionCameraTo(
  state: SceneState,
  targetPosition: THREE.Vector3 | [number, number, number],
  targetTarget: THREE.Vector3 | [number, number, number],
  duration = 420,
) {
  const destPos = targetPosition instanceof THREE.Vector3 ? targetPosition : new THREE.Vector3(...targetPosition);
  const destTarget = targetTarget instanceof THREE.Vector3 ? targetTarget : new THREE.Vector3(...targetTarget);
  state.cameraGoal = {
    startPosition: state.camera.position.clone(),
    startTarget: state.controls.target.clone(),
    targetPosition: destPos,
    targetTarget: destTarget,
    startTime: performance.now(),
    duration,
  };
}

export const ChessBoard3D = forwardRef<ChessBoardHandle, Props>(function ChessBoard3D(
  {
    position,
    flipped,
    activeSquare,
    legalDestinations,
    lastMove,
    checkSquare,
    themeId = "classic-walnut",
    piecePaletteId = "theme-default",
    clockDesignId = "dgt-3000",
    arrows = [],
    squareHighlights = [],
    selectedReservePiece = null,
    remotePointer = null,
    showReserveTrays = true,
    onSquarePress,
    onSquareErase,
    onSelectReservePiece,
    onDropReservePiece,
    onDropMovePiece,
    onHoverSquare,
    onAddArrow,
    onToggleSquareHighlight,
    clockState,
    onPressClock,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const positionRef = useRef(position);
  const flippedRef = useRef(flipped);
  const cameraSnapshotRef = useRef<{ position: THREE.Vector3; target: THREE.Vector3 }>({
    position: new THREE.Vector3(...CAMERA_VIEWS.angle.position),
    target: new THREE.Vector3(...CAMERA_VIEWS.angle.target),
  });
  const callbacksRef = useRef({
    onSquarePress,
    onSquareErase,
    onSelectReservePiece,
    onDropReservePiece,
    onDropMovePiece,
    onHoverSquare,
    onAddArrow,
    onToggleSquareHighlight,
    onPressClock,
  });
  positionRef.current = position;
  flippedRef.current = flipped;
  callbacksRef.current = {
    onSquarePress,
    onSquareErase,
    onSelectReservePiece,
    onDropReservePiece,
    onDropMovePiece,
    onHoverSquare,
    onAddArrow,
    onToggleSquareHighlight,
    onPressClock,
  };

  useImperativeHandle(ref, () => ({
    setView(view) {
      const state = stateRef.current;
      if (!state) return;
      const preset = CAMERA_VIEWS[view];
      transitionCameraTo(state, preset.position, preset.target);
    },
    resetCamera() {
      const state = stateRef.current;
      if (!state) return;
      const preset = CAMERA_VIEWS.angle;
      transitionCameraTo(state, preset.position, preset.target);
    },
    flipCamera() {
      const state = stateRef.current;
      if (!state) return;
      const currentPos = state.camera.position;
      const currentTarget = state.controls.target;
      transitionCameraTo(
        state,
        new THREE.Vector3(-currentPos.x, currentPos.y, -currentPos.z),
        new THREE.Vector3(-currentTarget.x, currentTarget.y, -currentTarget.z),
      );
    },
    downloadPng(filename = "chess-position.png") {
      const state = stateRef.current;
      if (!state) return;
      state.renderer.render(state.scene, state.camera);
      const link = document.createElement("a");
      link.download = filename;
      link.href = state.renderer.domElement.toDataURL("image/png");
      link.click();
    },
    clearAnnotations() {
      const state = stateRef.current;
      if (!state) return;
      state.annotations.clear();
    },
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const config = THEMES[themeId] || THEMES["classic-walnut"];
    const scene = new THREE.Scene();
    const backgroundTexture = createBackgroundTexture(config.background);
    scene.background = backgroundTexture;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.copy(cameraSnapshotRef.current.position);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = config.lighting.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 820 ? 1.5 : 2));
    renderer.domElement.className = "board-canvas";
    renderer.domElement.setAttribute("aria-label", "Interactive three-dimensional chessboard");
    renderer.domElement.setAttribute("role", "img");
    host.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.copy(cameraSnapshotRef.current.target);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = true;
    controls.screenSpacePanning = true;
    controls.minDistance = 5.6;
    controls.maxDistance = 28;
    controls.minPolarAngle = 0.015;
    controls.maxPolarAngle = Math.PI / 2 - 0.012;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
    controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;

    const onControlsStart = () => {
      if (stateRef.current) {
        stateRef.current.cameraGoal = null;
      }
    };
    controls.addEventListener("start", onControlsStart);

    const onWheel = () => {
      if (stateRef.current) {
        stateRef.current.cameraGoal = null;
      }
    };
    renderer.domElement.addEventListener("wheel", onWheel, { passive: true });

    const lights = addThemeLighting(scene, config, window.innerWidth < 820 ? 1024 : 2048);
    const floorMesh = createThemeFloor(config);
    scene.add(floorMesh);

    const board = createBoard(renderer.capabilities.getMaxAnisotropy(), config);
    const pieces = new THREE.Group();
    pieces.name = "pieces";
    const selection = new THREE.Group();
    selection.name = "selection";
    const highlights = new THREE.Group();
    highlights.name = "highlights";
    const annotations = new THREE.Group();
    annotations.name = "annotations";
    const remotePointers = new THREE.Group();
    remotePointers.name = "remotePointers";
    const reserveTrays = createReserveTraysGroup(config);
    const reservePieces = new THREE.Group();
    reservePieces.name = "reservePieces";

    board.add(pieces, selection, highlights, annotations, remotePointers, reserveTrays, reservePieces);

    const hoverMaterial = new THREE.MeshBasicMaterial({
      color: config.hover,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const hover = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.88), hoverMaterial);
    hover.rotation.x = -Math.PI / 2;
    hover.position.y = TILE_TOP + 0.004;
    hover.visible = false;
    hover.renderOrder = 7;
    hover.castShadow = false;
    hover.receiveShadow = false;
    board.add(hover);
    scene.add(board);

    const clock3D = create3DChessClockModel(clockDesignId, config);
    if (clock3D) {
      clock3D.group.visible = Boolean(clockState?.enabled);
      scene.add(clock3D.group);
    }

    const materials = createPieceMaterials(config, piecePaletteId);

    const state: SceneState = {
      scene,
      camera,
      renderer,
      controls,
      board,
      pieces,
      selection,
      highlights,
      annotations,
      reserveTrays,
      reservePieces,
      remotePointers,
      hover,
      materials,
      pieceTemplates: sharedPieceTemplates,
      pieceLibraryStatus: sharedPieceTemplates ? "ready" : "loading",
      latestPosition: positionRef.current,
      cameraGoal: null,
      activeAnimations: [],
      activeFades: [],
      ambientLight: lights.ambient,
      hemiLight: lights.hemi,
      keyLight: lights.key,
      fillLight: lights.fill,
      rimLight: lights.rim,
      floorMesh,
      currentThemeId: themeId,
      currentPaletteId: piecePaletteId,
      currentClockDesignId: clockDesignId,
      clock3D,
    };
    stateRef.current = state;
    rebuildPieces(state);
    rebuildReservePieces(state, selectedReservePiece);

    if (!sharedPieceTemplates) {
      loadPieceTemplates()
        .then((templates) => {
          if (stateRef.current !== state) return;
          state.pieceTemplates = templates;
          state.pieceLibraryStatus = "ready";
          rebuildPieces(state);
          rebuildReservePieces(state, selectedReservePiece);
        })
        .catch((error) => {
          if (stateRef.current !== state) return;
          console.error("The smooth chess-piece set could not be loaded.", error);
          state.pieceLibraryStatus = "failed";
          rebuildPieces(state);
        });
    }

    let lastWidth = 0;
    let lastHeight = 0;
    let resizeFrame = 0;
    const resize = () => {
      const bounds = host.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      if (width === lastWidth && height === lastHeight) return;
      lastWidth = width;
      lastHeight = height;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const scheduleResize = () => {
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(resize);
    };
    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(host);
    scheduleResize();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const pointerStart = new THREE.Vector2();
    let pointerDown = false;
    let isClickOnInteractive = false;

    // 3D Drag & Drop state
    const dragPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(TILE_TOP + 0.4));
    let pendingDrag: { type: "reserve"; code: PieceCode } | { type: "board"; square: Square; code: PieceCode } | null = null;
    let activeDragMesh: THREE.Group | null = null;

    const createDragMesh = (code: PieceCode, scale = 0.85): THREE.Group | null => {
      const template = state.pieceTemplates?.[code];
      if (!template) return null;
      const group = new THREE.Group();
      const model = template.clone(true);
      const body = pieceMaterial(code, state.materials);
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          if (!child.userData.preserveMaterial) child.material = body;
          child.castShadow = true;
          child.receiveShadow = false;
        }
      });
      group.add(model);
      group.scale.setScalar(scale);
      group.renderOrder = 999;
      return group;
    };

    const rightPointerStart = new THREE.Vector2();
    let rightPointerDown = false;
    let rightStartSquare: Square | null = null;

    const pick = (clientX: number, clientY: number) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const clockGroup = stateRef.current?.clock3D?.group || clock3D?.group;
      const targets = [board, clockGroup].filter(Boolean) as THREE.Object3D[];
      const hits = raycaster.intersectObjects(targets, true);
      for (const hit of hits) {
        const interactive = findInteractive(hit.object);
        if (interactive) return interactive;
      }
      return null;
    };

    const updateHover = (event: PointerEvent) => {
      if (pointerDown || rightPointerDown) return;
      const interactive = pick(event.clientX, event.clientY);
      const square = interactive?.userData.square as Square | undefined;
      if (callbacksRef.current.onHoverSquare) {
        callbacksRef.current.onHoverSquare(square || null);
      }
      if (!square) {
        hover.visible = false;
        if (interactive?.userData.kind === "reserve_piece" || interactive?.userData.kind === "clock") {
          renderer.domElement.style.cursor = "pointer";
        } else {
          renderer.domElement.style.cursor = "grab";
        }
        return;
      }
      const location = squarePosition(square);
      hover.position.set(location.x, TILE_TOP + 0.004, location.z);
      hover.visible = true;
      renderer.domElement.style.cursor = "pointer";
    };

    const pointerDownHandler = (event: PointerEvent) => {
      if (event.button === 0) {
        pointerDown = true;
        pointerStart.set(event.clientX, event.clientY);
        hover.visible = false;
        const interactive = pick(event.clientX, event.clientY);
        if (interactive) {
          isClickOnInteractive = true;
          controls.enableRotate = false;
          if (interactive.userData.kind === "reserve_piece") {
            pendingDrag = { type: "reserve", code: interactive.userData.code as PieceCode };
          } else if (interactive.userData.kind === "piece" || interactive.userData.square) {
            const sq = interactive.userData.square as Square;
            const code = positionRef.current[sq] || (interactive.userData.code as PieceCode);
            if (code && sq) {
              pendingDrag = { type: "board", square: sq, code };
            } else {
              pendingDrag = null;
            }
          } else if (interactive.userData.kind === "clock") {
            pendingDrag = null;
          }
        } else {
          pendingDrag = null;
          isClickOnInteractive = false;
        }
      } else if (event.button === 2) {
        rightPointerDown = true;
        rightPointerStart.set(event.clientX, event.clientY);
        const interactive = pick(event.clientX, event.clientY);
        rightStartSquare = (interactive?.userData.square as Square) || null;
      }
    };

    const pointerMoveHandler = (event: PointerEvent) => {
      if (pointerDown && pendingDrag) {
        const distance = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        if (distance > 7) {
          // In 3D piece drag mode
          if (!activeDragMesh) {
            activeDragMesh = createDragMesh(pendingDrag.code, pendingDrag.type === "reserve" ? 0.78 : 0.98);
            if (activeDragMesh) {
              scene.add(activeDragMesh);
            }
          }

          if (activeDragMesh) {
            const bounds = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);

            const planeHit = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(dragPlane, planeHit)) {
              activeDragMesh.position.copy(planeHit);
            }

            // Raycast board to highlight square under dragged piece
            const boardHits = raycaster.intersectObjects(board.children, true);
            let hoverSq: Square | null = null;
            for (const hit of boardHits) {
              const inter = findInteractive(hit.object);
              if (inter?.userData.square) {
                hoverSq = inter.userData.square as Square;
                break;
              }
            }

            if (hoverSq) {
              const loc = squarePosition(hoverSq);
              hover.position.set(loc.x, TILE_TOP + 0.004, loc.z);
              hover.visible = true;
            } else {
              hover.visible = false;
            }

            if (callbacksRef.current.onHoverSquare) {
              callbacksRef.current.onHoverSquare(hoverSq);
            }

            renderer.domElement.style.cursor = "grabbing";
            return;
          }
        }
      }

      updateHover(event);
      if (pointerDown && isClickOnInteractive && !pendingDrag) {
        const distance = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        if (distance > 7) {
          isClickOnInteractive = false;
          controls.enableRotate = true;
        }
      }
    };

    const pointerUpHandler = (event: PointerEvent) => {
      if (event.button === 0) {
        const distance = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        pointerDown = false;

        if (activeDragMesh) {
          // Drag drop action
          scene.remove(activeDragMesh);
          disposeObject(activeDragMesh, { materials: false });
          activeDragMesh = null;

          const bounds = renderer.domElement.getBoundingClientRect();
          pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
          pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
          raycaster.setFromCamera(pointer, camera);
          const boardHits = raycaster.intersectObjects(board.children, true);
          let dropSquare: Square | null = null;
          for (const hit of boardHits) {
            const inter = findInteractive(hit.object);
            if (inter?.userData.square) {
              dropSquare = inter.userData.square as Square;
              break;
            }
          }

          if (dropSquare && pendingDrag) {
            if (pendingDrag.type === "reserve") {
              if (callbacksRef.current.onDropReservePiece) {
                callbacksRef.current.onDropReservePiece(pendingDrag.code, dropSquare);
              } else {
                callbacksRef.current.onSelectReservePiece?.(pendingDrag.code);
                callbacksRef.current.onSquarePress(dropSquare);
              }
            } else if (pendingDrag.type === "board") {
              if (callbacksRef.current.onDropMovePiece) {
                callbacksRef.current.onDropMovePiece(pendingDrag.square, dropSquare);
              } else if (pendingDrag.square !== dropSquare) {
                callbacksRef.current.onSquarePress(pendingDrag.square);
                callbacksRef.current.onSquarePress(dropSquare);
              }
            }
          }

          pendingDrag = null;
          isClickOnInteractive = false;
          controls.enableRotate = true;
          hover.visible = false;
          renderer.domElement.style.cursor = "grab";
          return;
        }

        pendingDrag = null;
        if (isClickOnInteractive) {
          isClickOnInteractive = false;
          controls.enableRotate = true;
        }
        if (distance > 7) return;

        // Regular click action
        const interactive = pick(event.clientX, event.clientY);
        if (interactive?.userData.kind === "clock") {
          const side = interactive.userData.side as "w" | "b" | undefined;
          callbacksRef.current.onPressClock?.(side);
          return;
        }
        if (interactive?.userData.kind === "reserve_piece") {
          const code = interactive.userData.code as PieceCode;
          if (code && callbacksRef.current.onSelectReservePiece) {
            callbacksRef.current.onSelectReservePiece(code);
          }
          return;
        }
        const square = interactive?.userData.square as Square | undefined;
        if (square) callbacksRef.current.onSquarePress(square);
      } else if (event.button === 2) {
        const distance = rightPointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        rightPointerDown = false;
        const interactive = pick(event.clientX, event.clientY);
        const endSquare = (interactive?.userData.square as Square) || null;

        const color = event.shiftKey ? "#38bdf8" : (event.ctrlKey || event.altKey) ? "#ef4444" : "#22c55e";

        if (rightStartSquare && endSquare && rightStartSquare !== endSquare && distance > 12) {
          callbacksRef.current.onAddArrow?.({ from: rightStartSquare, to: endSquare, color });
        } else if (rightStartSquare && (!endSquare || rightStartSquare === endSquare) && distance <= 12) {
          if (callbacksRef.current.onToggleSquareHighlight) {
            callbacksRef.current.onToggleSquareHighlight({ square: rightStartSquare, color });
          }
        }
        rightStartSquare = null;
      }
    };

    const contextHandler = (event: MouseEvent) => {
      event.preventDefault();
      // Right click context menu prevented so right-drag / right-click annotations work smoothly
    };

    const leaveHandler = () => {
      hover.visible = false;
      if (callbacksRef.current.onHoverSquare) {
        callbacksRef.current.onHoverSquare(null);
      }
      renderer.domElement.style.cursor = "grab";
    };

    renderer.domElement.addEventListener("pointerdown", pointerDownHandler);
    renderer.domElement.addEventListener("pointerup", pointerUpHandler);
    renderer.domElement.addEventListener("pointermove", pointerMoveHandler);
    renderer.domElement.addEventListener("pointerleave", leaveHandler);
    renderer.domElement.addEventListener("contextmenu", contextHandler);

    let animationFrame = 0;
    const animate = () => {
      animationFrame = requestAnimationFrame(animate);
      const now = performance.now();

      if (state.activeAnimations.length > 0) {
        state.activeAnimations = state.activeAnimations.filter((anim) => {
          const elapsed = now - anim.startTime;
          const progress = Math.min(1, Math.max(0, elapsed / anim.duration));
          const ease = 1 - Math.pow(1 - progress, 3);
          anim.mesh.position.x = THREE.MathUtils.lerp(anim.fromPos.x, anim.toPos.x, ease);
          anim.mesh.position.z = THREE.MathUtils.lerp(anim.fromPos.z, anim.toPos.z, ease);
          anim.mesh.position.y = TILE_TOP + Math.sin(progress * Math.PI) * anim.lift;
          return progress < 1;
        });
      }

      if (state.activeFades.length > 0) {
        state.activeFades = state.activeFades.filter((fade) => {
          const elapsed = now - fade.startTime;
          const progress = Math.min(1, Math.max(0, elapsed / fade.duration));
          const scale = Math.max(0.001, 1 - progress);
          fade.mesh.scale.set(scale, scale, scale);
          if (progress >= 1) {
            state.pieces.remove(fade.mesh);
            return false;
          }
          return true;
        });
      }

      if (state.cameraGoal) {
        const elapsed = performance.now() - state.cameraGoal.startTime;
        const t = Math.min(1, Math.max(0, elapsed / state.cameraGoal.duration));
        const ease = 1 - Math.pow(1 - t, 3);
        camera.position.lerpVectors(state.cameraGoal.startPosition, state.cameraGoal.targetPosition, ease);
        controls.target.lerpVectors(state.cameraGoal.startTarget, state.cameraGoal.targetTarget, ease);
        if (t >= 1) {
          camera.position.copy(state.cameraGoal.targetPosition);
          controls.target.copy(state.cameraGoal.targetTarget);
          state.cameraGoal = null;
        }
      }
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationFrame);
      cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      cameraSnapshotRef.current = {
        position: camera.position.clone(),
        target: controls.target.clone(),
      };
      controls.removeEventListener("start", onControlsStart);
      renderer.domElement.removeEventListener("wheel", onWheel);
      renderer.domElement.removeEventListener("pointerdown", pointerDownHandler);
      renderer.domElement.removeEventListener("pointerup", pointerUpHandler);
      renderer.domElement.removeEventListener("pointermove", pointerMoveHandler);
      renderer.domElement.removeEventListener("pointerleave", leaveHandler);
      renderer.domElement.removeEventListener("contextmenu", contextHandler);
      controls.dispose();
      if (activeDragMesh) {
        scene.remove(activeDragMesh);
        disposeObject(activeDragMesh, { materials: false });
        activeDragMesh = null;
      }
      board.remove(pieces);
      if (state.pieceLibraryStatus === "failed") {
        disposeObject(pieces, { materials: false });
      }
      pieces.clear();
      disposeObject(state.highlights, { materials: false });
      state.highlights.clear();
      disposeObject(state.annotations, { materials: true });
      state.annotations.clear();
      disposeObject(state.remotePointers, { materials: true });
      state.remotePointers.clear();
      if (state.clock3D) {
        state.clock3D.dispose();
        scene.remove(state.clock3D.group);
      }
      disposeObject(scene);
      disposeMaterialSet(materials);
      backgroundTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, []);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.currentClockDesignId !== clockDesignId) {
      state.currentClockDesignId = clockDesignId;
      if (state.clock3D) {
        state.scene.remove(state.clock3D.group);
        state.clock3D.dispose();
        state.clock3D = null;
      }
      const config = THEMES[themeId] || THEMES["classic-walnut"];
      const newClock = create3DChessClockModel(clockDesignId, config);
      if (newClock) {
        newClock.group.visible = Boolean(clockState?.enabled);
        state.scene.add(newClock.group);
        state.clock3D = newClock;
      }
    }

    if (!state.clock3D) return;
    if (!clockState || !clockState.enabled) {
      state.clock3D.group.visible = false;
      return;
    }
    state.clock3D.group.visible = true;
    state.clock3D.updateTime(
      clockState.whiteTimeMs,
      clockState.blackTimeMs,
      clockState.activeSide,
      clockState.flagFallenSide,
      format3DClockTime,
    );
  }, [clockDesignId, clockState, themeId]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.currentThemeId !== themeId || state.currentPaletteId !== piecePaletteId) {
      applyThemeToScene(state, themeId, piecePaletteId);
    }
  }, [themeId, piecePaletteId]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    applyPositionUpdate(state, position, lastMove);
  }, [position, lastMove]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    updateHighlights(state, activeSquare, legalDestinations, lastMove, checkSquare);
  }, [activeSquare, legalDestinations, lastMove, checkSquare]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    updateAnnotations(state, arrows, squareHighlights);
  }, [arrows, squareHighlights]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.reserveTrays.visible = showReserveTrays !== false;
    state.reservePieces.visible = showReserveTrays !== false;
    if (showReserveTrays !== false) {
      rebuildReservePieces(state, selectedReservePiece);
    }
  }, [selectedReservePiece, showReserveTrays]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    updateRemotePointer(state, remotePointer);
  }, [remotePointer]);

  return <div className="board-host" ref={hostRef} />;
});

