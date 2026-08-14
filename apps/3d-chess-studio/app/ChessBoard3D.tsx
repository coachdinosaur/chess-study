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

type Props = {
  position: BoardPosition;
  flipped: boolean;
  activeSquare: Square | null;
  legalDestinations?: Square[];
  lastMove?: LastMove | null;
  checkSquare?: Square | null;
  themeId?: ThemeId;
  arrows?: ArrowAnnotation[];
  squareHighlights?: SquareAnnotation[];
  onSquarePress: (square: Square) => void;
  onSquareErase: (square: Square) => void;
  onAddArrow?: (arrow: ArrowAnnotation) => void;
  onToggleSquareHighlight?: (highlight: SquareAnnotation) => void;
};

type CameraGoal = {
  position: THREE.Vector3;
  target: THREE.Vector3;
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
  floorMesh: THREE.Mesh;
  currentThemeId: ThemeId;
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
    position: [0.01, 17.5, 0.01],
    target: [0.00, 0.37, 0.00],
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
      white: "#ddccaa",
      black: "#211713",
      gold: "#b88e48",
      roughness: 0.27,
      clearcoat: 0.36,
    },
    lighting: {
      exposure: 1.02,
      ambient: 0.58,
      hemisphereSky: "#fff5df",
      hemisphereGround: "#71665b",
      hemisphereIntensity: 1.05,
      keyColor: "#ffe1b8",
      keyIntensity: 3.25,
      keyPosition: [-7, 12, 8],
      fillColor: "#c9dce5",
      fillIntensity: 1.15,
      fillPosition: [8, 7, -6],
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
      white: "#f5e8d0",
      black: "#1e1e1e",
      gold: "#c5a059",
      roughness: 0.32,
      clearcoat: 0.25,
    },
    lighting: {
      exposure: 1.05,
      ambient: 0.62,
      hemisphereSky: "#f4f8f4",
      hemisphereGround: "#636d64",
      hemisphereIntensity: 1.1,
      keyColor: "#fff8ee",
      keyIntensity: 3.1,
      keyPosition: [-7, 13, 8],
      fillColor: "#d2e4df",
      fillIntensity: 1.2,
      fillPosition: [8, 7, -6],
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
      white: "#ffffff",
      black: "#1f2429",
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
      keyPosition: [-6, 14, 8],
      fillColor: "#d0e2ff",
      fillIntensity: 1.3,
      fillPosition: [8, 8, -6],
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
      white: "#f5eee2",
      black: "#24272c",
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
      keyPosition: [-6, 13, 8],
      fillColor: "#8ea4c0",
      fillIntensity: 1.35,
      fillPosition: [8, 8, -6],
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
  P: 0.88,
  R: 1.04,
  N: 1.2,
  B: 1.24,
  Q: 1.36,
  K: 1.48,
};

const STAUNTON_WIDTH_BOOST = 1.18;

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

function createPieceMaterials(config: ThemeConfig = THEME_CONFIG): Materials {
  const piecesConfig = config.pieces;
  const material = (color: string, roughness = piecesConfig.roughness) => new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat: piecesConfig.clearcoat,
    clearcoatRoughness: Math.min(0.5, roughness + 0.08),
    sheen: 0.12,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#fff0d2"), 0.12),
    sheenRoughness: 0.55,
    side: THREE.DoubleSide,
  });

  return {
    white: material(piecesConfig.white),
    black: material(piecesConfig.black, Math.max(0.2, piecesConfig.roughness - 0.03)),
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

  return { ambient, hemi, key, fill };
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
  const source = new THREE.SphereGeometry(0.19, 72, 48).toNonIndexed();
  const positions = source.getAttribute("position");
  const keptPositions: number[] = [];
  const gapHalfWidth = 0.018;

  for (let index = 0; index < positions.count; index += 3) {
    const triangle: [number, number, number][] = [];
    const signedDistances: number[] = [];

    for (let vertex = 0; vertex < 3; vertex += 1) {
      const sourceIndex = index + vertex;
      const x = positions.getX(sourceIndex) * 0.84;
      const y = positions.getY(sourceIndex) * 1.22;
      const z = positions.getZ(sourceIndex) * 0.84;
      triangle.push([x, y, z]);
      signedDistances.push((0.825 * x) - (0.565 * y));
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
    addMesh(group, new THREE.SphereGeometry(0.145, 48, 36), body, [0, 0.825, 0]);
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
      [0.19, 0.28],
      [0.215, 0.37],
      [0.18, 0.49],
      [0.132, 0.72],
      [0.145, 0.8],
      [0.225, 0.86],
      [0.23, 0.9],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.145, 0.014, 12, 64), accent, [0, 0.8, 0], undefined, [Math.PI / 2, 0, 0]);
    addMesh(group, createMitredHeadGeometry(), body, [0, 1.055, 0]);
    addMesh(group, new THREE.SphereGeometry(0.058, 40, 28), accent, [0, 1.305, 0]);
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
    [0.19, 0.28],
    [0.215, 0.37],
    [0.18, 0.5],
    [0.13, 0.72],
    [0.145, 0.8],
    [0.225, 0.86],
    [0.23, 0.9],
  ], body, 64));
  addMesh(model, createMitredHeadGeometry(), body, [0, 1.055, 0]);
  addMesh(model, new THREE.SphereGeometry(0.055, 36, 24), body, [0, 1.305, 0]);
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
    const heightScale = STAUNTON_TARGET_HEIGHT[code[1] as PieceKind] / height;
    template.scale.set(
      heightScale * STAUNTON_WIDTH_BOOST,
      heightScale,
      heightScale * STAUNTON_WIDTH_BOOST,
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
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas labels are not available.");
  context.clearRect(0, 0, 96, 96);
  context.fillStyle = color;
  context.font = "700 58px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, 48, 49);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    alphaTest: 0.04,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.235, 0.235), material);
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

function applyThemeToScene(state: SceneState, themeId: ThemeId) {
  state.currentThemeId = themeId;
  const config = THEMES[themeId] || THEMES["classic-walnut"];

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

  disposeMaterialSet(state.materials);
  state.materials = createPieceMaterials(config);

  const anisotropy = state.renderer.capabilities.getMaxAnisotropy();
  const oldBoard = state.board;
  const newBoard = createBoard(anisotropy, config);

  newBoard.add(state.pieces, state.selection, state.highlights, state.annotations, state.hover);
  state.scene.remove(oldBoard);
  disposeObject(oldBoard, { materials: true });
  state.board = newBoard;
  state.scene.add(newBoard);

  rebuildPieces(state);
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

  const upperFrame = new THREE.Mesh(new RoundedBoxGeometry(8.62, 0.2, 8.62, 6, 0.1), frameTop);
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

  const trimGeometryLong = new RoundedBoxGeometry(8.06, 0.028, 0.024, 2, 0.008);
  const trimGeometryShort = new RoundedBoxGeometry(0.024, 0.028, 8.06, 2, 0.008);
  for (const z of [-4.025, 4.025]) {
    const rail = addMesh(board, trimGeometryLong.clone(), trim, [0, TILE_TOP + 0.008, z]);
    rail.castShadow = false;
    rail.receiveShadow = true;
  }
  for (const x of [-4.025, 4.025]) {
    const rail = addMesh(board, trimGeometryShort.clone(), trim, [x, TILE_TOP + 0.008, 0]);
    rail.castShadow = false;
    rail.receiveShadow = true;
  }

  const files = "abcdefgh";
  for (let index = 0; index < 8; index += 1) {
    const x = index - 3.5;
    const near = createLabel(files[index], config.label);
    near.position.set(x, TILE_TOP + 0.01, 4.22);
    board.add(near);
    const far = createLabel(files[index], config.label);
    far.position.set(x, TILE_TOP + 0.01, -4.22);
    far.rotation.z = Math.PI;
    board.add(far);

    const z = 3.5 - index;
    const left = createLabel(String(index + 1), config.label);
    left.position.set(-4.22, TILE_TOP + 0.01, z);
    left.rotation.z = -Math.PI / 2;
    board.add(left);
    const right = createLabel(String(index + 1), config.label);
    right.position.set(4.22, TILE_TOP + 0.01, z);
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

function findInteractive(object: THREE.Object3D | null): THREE.Object3D | null {
  let current = object;
  while (current) {
    if (current.userData.kind === "piece" || current.userData.kind === "square") return current;
    current = current.parent;
  }
  return null;
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
    arrows = [],
    squareHighlights = [],
    onSquarePress,
    onSquareErase,
    onAddArrow,
    onToggleSquareHighlight,
  },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const positionRef = useRef(position);
  const flippedRef = useRef(flipped);
  const cameraSnapshotRef = useRef<CameraGoal>({
    position: new THREE.Vector3(...CAMERA_VIEWS.angle.position),
    target: new THREE.Vector3(...CAMERA_VIEWS.angle.target),
  });
  const callbacksRef = useRef({ onSquarePress, onSquareErase, onAddArrow, onToggleSquareHighlight });
  positionRef.current = position;
  flippedRef.current = flipped;
  callbacksRef.current = { onSquarePress, onSquareErase, onAddArrow, onToggleSquareHighlight };

  useImperativeHandle(ref, () => ({
    setView(view) {
      const state = stateRef.current;
      if (!state) return;
      const preset = CAMERA_VIEWS[view];
      state.cameraGoal = {
        position: new THREE.Vector3(...preset.position),
        target: new THREE.Vector3(...preset.target),
      };
    },
    resetCamera() {
      const state = stateRef.current;
      if (!state) return;
      const preset = CAMERA_VIEWS.angle;
      state.cameraGoal = {
        position: new THREE.Vector3(...preset.position),
        target: new THREE.Vector3(...preset.target),
      };
    },
    flipCamera() {
      const state = stateRef.current;
      if (!state) return;
      const currentPos = state.camera.position;
      const currentTarget = state.controls.target;
      state.cameraGoal = {
        position: new THREE.Vector3(-currentPos.x, currentPos.y, -currentPos.z),
        target: new THREE.Vector3(-currentTarget.x, currentTarget.y, -currentTarget.z),
      };
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
    board.add(pieces, selection, highlights, annotations);

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

    const materials = createPieceMaterials(config);

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
      floorMesh,
      currentThemeId: themeId,
    };
    stateRef.current = state;
    rebuildPieces(state);

    if (!sharedPieceTemplates) {
      loadPieceTemplates()
        .then((templates) => {
          if (stateRef.current !== state) return;
          state.pieceTemplates = templates;
          state.pieceLibraryStatus = "ready";
          rebuildPieces(state);
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
      camera.fov = camera.aspect < 0.78 ? 52 : camera.aspect < 1.05 ? 46 : camera.aspect < 1.25 ? 40 : 38;
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

    const rightPointerStart = new THREE.Vector2();
    let rightPointerDown = false;
    let rightStartSquare: Square | null = null;

    const pick = (clientX: number, clientY: number) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(board, true);
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
      if (!square) {
        hover.visible = false;
        renderer.domElement.style.cursor = "grab";
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
      } else if (event.button === 2) {
        rightPointerDown = true;
        rightPointerStart.set(event.clientX, event.clientY);
        const interactive = pick(event.clientX, event.clientY);
        rightStartSquare = (interactive?.userData.square as Square) || null;
      }
    };

    const pointerUpHandler = (event: PointerEvent) => {
      if (event.button === 0) {
        const distance = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
        pointerDown = false;
        if (distance > 6) return;
        const interactive = pick(event.clientX, event.clientY);
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
      renderer.domElement.style.cursor = "grab";
    };

    renderer.domElement.addEventListener("pointerdown", pointerDownHandler);
    renderer.domElement.addEventListener("pointerup", pointerUpHandler);
    renderer.domElement.addEventListener("pointermove", updateHover);
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
        camera.position.lerp(state.cameraGoal.position, 0.11);
        controls.target.lerp(state.cameraGoal.target, 0.11);
        if (
          camera.position.distanceTo(state.cameraGoal.position) < 0.02 &&
          controls.target.distanceTo(state.cameraGoal.target) < 0.01
        ) {
          camera.position.copy(state.cameraGoal.position);
          controls.target.copy(state.cameraGoal.target);
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
      renderer.domElement.removeEventListener("pointerdown", pointerDownHandler);
      renderer.domElement.removeEventListener("pointerup", pointerUpHandler);
      renderer.domElement.removeEventListener("pointermove", updateHover);
      renderer.domElement.removeEventListener("pointerleave", leaveHandler);
      renderer.domElement.removeEventListener("contextmenu", contextHandler);
      controls.dispose();
      board.remove(pieces);
      if (state.pieceLibraryStatus === "failed") {
        disposeObject(pieces, { materials: false });
      }
      pieces.clear();
      disposeObject(state.highlights, { materials: false });
      state.highlights.clear();
      disposeObject(state.annotations, { materials: true });
      state.annotations.clear();
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
    const isLookingFromWhite = state.camera.position.z > 0;
    if (flipped && isLookingFromWhite) {
      const currentPos = state.camera.position;
      const currentTarget = state.controls.target;
      state.cameraGoal = {
        position: new THREE.Vector3(-currentPos.x, currentPos.y, -currentPos.z),
        target: new THREE.Vector3(-currentTarget.x, currentTarget.y, -currentTarget.z),
      };
    } else if (!flipped && !isLookingFromWhite) {
      const currentPos = state.camera.position;
      const currentTarget = state.controls.target;
      state.cameraGoal = {
        position: new THREE.Vector3(-currentPos.x, currentPos.y, -currentPos.z),
        target: new THREE.Vector3(-currentTarget.x, currentTarget.y, -currentTarget.z),
      };
    }
  }, [flipped]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    if (state.currentThemeId !== themeId) {
      applyThemeToScene(state, themeId);
    }
  }, [themeId]);

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

  return <div className="board-host" ref={hostRef} />;
});

