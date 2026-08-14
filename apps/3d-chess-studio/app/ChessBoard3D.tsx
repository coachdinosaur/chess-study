import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { BoardPosition, PieceCode, Square } from "./chess";

export type CameraView = "angle" | "top" | "white" | "black" | "left" | "right" | "low";
export type BoardTheme = "classic" | "anime" | "samurai";

export type ChessBoardHandle = {
  setView: (view: CameraView) => void;
  resetCamera: () => void;
  downloadPng: (filename?: string) => void;
};

type Props = {
  position: BoardPosition;
  flipped: boolean;
  theme: BoardTheme;
  activeSquare: Square | null;
  onSquarePress: (square: Square) => void;
  onSquareErase: (square: Square) => void;
};

type CameraGoal = {
  position: THREE.Vector3;
  target: THREE.Vector3;
};

type Materials = {
  white: THREE.Material;
  black: THREE.Material;
  whiteAccent: THREE.Material;
  blackAccent: THREE.Material;
  gold: THREE.Material;
  whiteOutline?: THREE.MeshBasicMaterial;
  blackOutline?: THREE.MeshBasicMaterial;
};

type PieceKind = "K" | "Q" | "R" | "B" | "N" | "P";

type ThemeConfig = {
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
    whiteAccent: string;
    blackAccent: string;
    gold: string;
    style: "physical" | "toon";
    roughness: number;
    clearcoat: number;
    whiteOutline?: string;
    blackOutline?: string;
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

type SceneState = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  board: THREE.Group;
  pieces: THREE.Group;
  selection: THREE.Group;
  hover: THREE.Mesh;
  materials: Materials;
  theme: BoardTheme;
  latestPosition: BoardPosition;
  cameraGoal: CameraGoal | null;
};

const CAMERA_VIEWS: Record<CameraView, [number, number, number]> = {
  angle: [8.8, 9.4, 10.6],
  top: [0.01, 19.5, 0.01],
  white: [0, 7.2, 12.8],
  black: [0, 7.2, -12.8],
  left: [-12.8, 6.5, 0],
  right: [12.8, 6.5, 0],
  low: [9.8, 3.4, 11.4],
};

const TILE_TOP = 0.371;

const THEME_CONFIGS: Record<BoardTheme, ThemeConfig> = {
  classic: {
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
      whiteAccent: "#b79b68",
      blackAccent: "#080605",
      gold: "#b88e48",
      style: "physical",
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
  anime: {
    background: ["#e9faf6", "#c9e9ea", "#aebed8"],
    floor: "#bddad8",
    board: {
      frameBase: "#674d68",
      frameTop: "#d98572",
      bed: "#5e405d",
      light: "#fff0d3",
      dark: "#35a895",
      trim: "#f1c263",
      label: "#65475f",
      grain: "#7d4a59",
      woodGrain: false,
      frameRoughness: 0.48,
      frameClearcoat: 0.12,
      tileRoughness: 0.58,
      tileClearcoat: 0,
    },
    pieces: {
      white: "#ffecd8",
      black: "#1c2d50",
      whiteAccent: "#e9a882",
      blackAccent: "#62beba",
      gold: "#f0bf58",
      style: "toon",
      roughness: 0.5,
      clearcoat: 0,
      whiteOutline: "#9d6e74",
      blackOutline: "#09152b",
    },
    lighting: {
      exposure: 1.1,
      ambient: 0.78,
      hemisphereSky: "#fff9e8",
      hemisphereGround: "#6d91a2",
      hemisphereIntensity: 1.38,
      keyColor: "#fff0cd",
      keyIntensity: 3.45,
      keyPosition: [-6, 12, 8],
      fillColor: "#9fdcff",
      fillIntensity: 1.7,
      fillPosition: [8, 8, -6],
    },
    hover: "#ff766f",
  },
  samurai: {
    background: ["#c9bda9", "#9c8d7c", "#6f625c"],
    floor: "#756e62",
    board: {
      frameBase: "#25151a",
      frameTop: "#651f2d",
      bed: "#171310",
      light: "#e3d4ae",
      dark: "#304f3d",
      trim: "#c69b43",
      label: "#d6b669",
      grain: "#2b1118",
      woodGrain: false,
      frameRoughness: 0.25,
      frameClearcoat: 0.58,
      tileRoughness: 0.46,
      tileClearcoat: 0.14,
    },
    pieces: {
      white: "#e0cda6",
      black: "#4b1520",
      whiteAccent: "#aa8247",
      blackAccent: "#1b0d12",
      gold: "#c69b43",
      style: "physical",
      roughness: 0.23,
      clearcoat: 0.62,
    },
    lighting: {
      exposure: 0.98,
      ambient: 0.5,
      hemisphereSky: "#ffe6bc",
      hemisphereGround: "#403b38",
      hemisphereIntensity: 0.9,
      keyColor: "#ffd39a",
      keyIntensity: 3.05,
      keyPosition: [-6, 11, 7],
      fillColor: "#9ebdc2",
      fillIntensity: 0.95,
      fillPosition: [8, 6, -7],
    },
    hover: "#df4d52",
  },
};

const STAUNTON_TARGET_HEIGHT: Record<PieceKind, number> = {
  P: 0.88,
  R: 1.04,
  N: 1.2,
  B: 1.24,
  Q: 1.36,
  K: 1.48,
};

const PIECE_BASE_RADIUS: Record<PieceKind, number> = {
  P: 0.25,
  R: 0.29,
  N: 0.29,
  B: 0.29,
  Q: 0.31,
  K: 0.32,
};

let sharedAccentRingGeometry: THREE.TorusGeometry | null = null;

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

function createToonGradient() {
  const steps = new Uint8Array([64, 132, 204, 255]);
  const texture = new THREE.DataTexture(steps, 4, 1, THREE.RedFormat);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function createPieceMaterials(theme: BoardTheme): Materials {
  const config = THEME_CONFIGS[theme].pieces;
  if (config.style === "toon") {
    const gradient = createToonGradient();
    const toonMaterial = (color: string) => new THREE.MeshToonMaterial({
      color,
      gradientMap: gradient,
      side: THREE.DoubleSide,
    });
    return {
      white: toonMaterial(config.white),
      black: toonMaterial(config.black),
      whiteAccent: toonMaterial(config.whiteAccent),
      blackAccent: toonMaterial(config.blackAccent),
      gold: toonMaterial(config.gold),
      whiteOutline: new THREE.MeshBasicMaterial({
        color: config.whiteOutline,
        side: THREE.BackSide,
        toneMapped: false,
      }),
      blackOutline: new THREE.MeshBasicMaterial({
        color: config.blackOutline,
        side: THREE.BackSide,
        toneMapped: false,
      }),
    };
  }

  const material = (color: string, roughness = config.roughness) => new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat: config.clearcoat,
    clearcoatRoughness: Math.min(0.5, roughness + 0.08),
    sheen: theme === "classic" ? 0.12 : 0.2,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color("#fff0d2"), 0.12),
    sheenRoughness: 0.55,
    side: THREE.DoubleSide,
  });

  return {
    white: material(config.white),
    black: material(config.black, Math.max(0.2, config.roughness - 0.03)),
    whiteAccent: material(config.whiteAccent, config.roughness + 0.08),
    blackAccent: material(config.blackAccent, config.roughness + 0.08),
    gold: new THREE.MeshPhysicalMaterial({
      color: config.gold,
      roughness: 0.26,
      metalness: 0.58,
      clearcoat: 0.22,
      clearcoatRoughness: 0.25,
      side: THREE.DoubleSide,
    }),
  };
}

function addThemeLighting(scene: THREE.Scene, config: ThemeConfig, shadowMapSize: number) {
  scene.add(new THREE.AmbientLight("#ffffff", config.lighting.ambient));
  scene.add(new THREE.HemisphereLight(
    config.lighting.hemisphereSky,
    config.lighting.hemisphereGround,
    config.lighting.hemisphereIntensity,
  ));

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

function getAccentRingGeometry() {
  sharedAccentRingGeometry ??= new THREE.TorusGeometry(1, 0.055, 10, 40);
  return sharedAccentRingGeometry;
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

function pieceMaterials(code: PieceCode, materials: Materials) {
  return code[0] === "w"
    ? { body: materials.white, accent: materials.whiteAccent }
    : { body: materials.black, accent: materials.blackAccent };
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

function createFallbackPiece(code: PieceCode, square: Square, materials: Materials): THREE.Group {
  const group = new THREE.Group();
  const { body, accent } = pieceMaterials(code, materials);
  const type = code[1];

  if (type === "P") {
    addStauntonBase(group, body, 0.28, 0.16);
    group.add(lathe([
      [0.16, 0.28],
      [0.17, 0.36],
      [0.145, 0.45],
      [0.112, 0.57],
      [0.12, 0.63],
      [0.17, 0.67],
      [0.178, 0.7],
    ], body, 64));
    addMesh(group, new THREE.SphereGeometry(0.145, 48, 32), body, [0, 0.82, 0]);
  }

  if (type === "R") {
    addStauntonBase(group, body, 0.33, 0.21);
    group.add(lathe([
      [0.21, 0.28],
      [0.225, 0.37],
      [0.2, 0.63],
      [0.21, 0.72],
      [0.27, 0.76],
      [0.29, 0.79],
    ], body, 64));
    addMesh(group, new THREE.CylinderGeometry(0.29, 0.28, 0.17, 64), body, [0, 0.86, 0]);
    for (let index = 0; index < 6; index += 1) {
      const angle = (index / 6) * Math.PI * 2;
      addMesh(
        group,
        new RoundedBoxGeometry(0.135, 0.17, 0.18, 4, 0.018),
        body,
        [Math.cos(angle) * 0.225, 1.02, Math.sin(angle) * 0.225],
        undefined,
        [0, -angle, 0],
      );
    }
  }

  if (type === "N") {
    addStauntonBase(group, body, 0.32, 0.2);
    group.add(lathe([
      [0.2, 0.28],
      [0.225, 0.36],
      [0.215, 0.46],
      [0.18, 0.53],
    ], body, 64));

    const horse = new THREE.Shape();
    horse.moveTo(-0.28, 0.01);
    horse.bezierCurveTo(-0.25, 0.26, -0.23, 0.52, -0.1, 0.7);
    horse.bezierCurveTo(-0.04, 0.78, 0.04, 0.82, 0.12, 0.83);
    horse.lineTo(0.1, 0.98);
    horse.lineTo(0.22, 0.9);
    horse.lineTo(0.24, 0.76);
    horse.bezierCurveTo(0.36, 0.7, 0.43, 0.6, 0.4, 0.5);
    horse.bezierCurveTo(0.37, 0.42, 0.3, 0.38, 0.24, 0.34);
    horse.lineTo(0.4, 0.3);
    horse.bezierCurveTo(0.35, 0.2, 0.24, 0.13, 0.13, 0.1);
    horse.lineTo(0.01, 0.02);
    horse.closePath();
    const horseGeometry = new THREE.ExtrudeGeometry(horse, {
      depth: 0.25,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 6,
      curveSegments: 24,
    });
    horseGeometry.center();
    addMesh(
      group,
      horseGeometry,
      body,
      [0, 0.95, 0],
      [0.82, 0.82, 0.82],
      [0, code[0] === "w" ? Math.PI / 2 : -Math.PI / 2, 0],
    );
  }

  if (type === "B") {
    addStauntonBase(group, body, 0.32, 0.19);
    group.add(lathe([
      [0.19, 0.28],
      [0.215, 0.37],
      [0.18, 0.49],
      [0.135, 0.72],
      [0.145, 0.8],
      [0.225, 0.86],
      [0.23, 0.9],
    ], body, 64));
    addMesh(group, createMitredHeadGeometry(), body, [0, 1.055, 0]);
    addMesh(group, new THREE.SphereGeometry(0.055, 36, 24), body, [0, 1.305, 0]);
  }

  if (type === "Q") {
    addStauntonBase(group, body, 0.35, 0.2);
    group.add(lathe([
      [0.2, 0.28],
      [0.23, 0.38],
      [0.185, 0.52],
      [0.14, 0.77],
      [0.15, 0.86],
      [0.24, 0.94],
      [0.265, 1.01],
      [0.25, 1.06],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.25, 0.035, 12, 64), body, [0, 1.045, 0], undefined, [Math.PI / 2, 0, 0]);
    for (let index = 0; index < 8; index += 1) {
      const angle = (index / 8) * Math.PI * 2;
      addMesh(
        group,
        new THREE.ConeGeometry(0.055, 0.19, 24),
        body,
        [Math.cos(angle) * 0.22, 1.19, Math.sin(angle) * 0.22],
      );
    }
    addMesh(group, new THREE.SphereGeometry(0.078, 36, 24), body, [0, 1.35, 0]);
  }

  if (type === "K") {
    addStauntonBase(group, body, 0.36, 0.21);
    group.add(lathe([
      [0.21, 0.28],
      [0.235, 0.39],
      [0.19, 0.56],
      [0.145, 0.86],
      [0.16, 0.95],
      [0.255, 1.03],
      [0.26, 1.09],
      [0.21, 1.13],
    ], body, 64));
    addMesh(group, new THREE.TorusGeometry(0.235, 0.035, 12, 64), body, [0, 1.07, 0], undefined, [Math.PI / 2, 0, 0]);
    addMesh(group, new THREE.SphereGeometry(0.11, 40, 28), body, [0, 1.21, 0]);
    addMesh(group, new RoundedBoxGeometry(0.105, 0.34, 0.09, 5, 0.022), body, [0, 1.43, 0]);
    addMesh(group, new RoundedBoxGeometry(0.32, 0.105, 0.09, 5, 0.022), body, [0, 1.48, 0]);
  }

  configureShadows(group);
  group.position.copy(squarePosition(square));
  group.position.y = TILE_TOP;
  group.userData = { kind: "piece", square, code };
  return group;
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

function createPiece(code: PieceCode, square: Square, state: SceneState): THREE.Group {
  const type = code[1] as PieceKind;
  const group = createFallbackPiece(code, square, state.materials);
  const { body, accent } = pieceMaterials(code, state.materials);
  const pieceMeshes: THREE.Mesh[] = [];
  group.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    if (!child.userData.preserveMaterial) child.material = body;
    child.castShadow = true;
    child.receiveShadow = true;
    pieceMeshes.push(child);
  });

  const outlineMaterial = code[0] === "w" ? state.materials.whiteOutline : state.materials.blackOutline;
  if (outlineMaterial) {
    pieceMeshes.forEach((mesh) => {
      const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
      outline.scale.setScalar(1.032);
      outline.castShadow = false;
      outline.receiveShadow = false;
      outline.renderOrder = -1;
      mesh.add(outline);
    });
  }
  const radius = PIECE_BASE_RADIUS[type];
  if (state.theme === "anime" || state.theme === "samurai") {
    const baseRing = new THREE.Mesh(
      getAccentRingGeometry(),
      state.theme === "samurai" ? state.materials.gold : accent,
    );
    baseRing.rotation.x = Math.PI / 2;
    baseRing.scale.setScalar(radius * (state.theme === "samurai" ? 1 : 0.92));
    baseRing.position.y = state.theme === "samurai" ? 0.085 : 0.07;
    baseRing.castShadow = true;
    baseRing.receiveShadow = true;
    group.add(baseRing);
  }

  if (state.theme === "samurai" && type !== "P") {
    const armorBand = new THREE.Mesh(getAccentRingGeometry(), accent);
    armorBand.rotation.x = Math.PI / 2;
    armorBand.scale.setScalar(radius * 0.5);
    armorBand.position.y = STAUNTON_TARGET_HEIGHT[type] * 0.4;
    armorBand.castShadow = true;
    armorBand.receiveShadow = true;
    group.add(armorBand);
  }

  return group;
}

function rebuildPieces(state: SceneState) {
  disposeObject(state.pieces, { materials: false });
  state.pieces.clear();
  Object.entries(state.latestPosition).forEach(([square, code]) => {
    if (!code) return;
    state.pieces.add(createPiece(code, square as Square, state));
  });
}

function createLabel(text: string, color: string, theme: BoardTheme) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas labels are not available.");
  context.clearRect(0, 0, 96, 96);
  context.fillStyle = color;
  context.font = theme === "anime"
    ? "800 58px Inter, Arial, sans-serif"
    : "700 58px Georgia, serif";
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

function createBoard(theme: BoardTheme, anisotropy: number) {
  const board = new THREE.Group();
  board.name = "board";
  const config = THEME_CONFIGS[theme].board;
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
    clearcoatRoughness: theme === "samurai" ? 0.18 : 0.3,
  });
  const bed = new THREE.MeshStandardMaterial({
    color: config.bed,
    roughness: 0.72,
    metalness: 0,
  });
  const trim = new THREE.MeshPhysicalMaterial({
    color: config.trim,
    roughness: theme === "anime" ? 0.4 : 0.27,
    metalness: theme === "anime" ? 0.28 : 0.62,
    clearcoat: 0.18,
    clearcoatRoughness: 0.24,
  });

  const toonGradient = theme === "anime" ? createToonGradient() : null;
  const createTileMaterial = (color: string) => theme === "anime"
    ? new THREE.MeshToonMaterial({ color, gradientMap: toonGradient })
    : new THREE.MeshPhysicalMaterial({
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
    const near = createLabel(files[index], config.label, theme);
    near.position.set(x, TILE_TOP + 0.01, 4.22);
    board.add(near);
    const far = createLabel(files[index], config.label, theme);
    far.position.set(x, TILE_TOP + 0.01, -4.22);
    far.rotation.z = Math.PI;
    board.add(far);

    const z = 3.5 - index;
    const left = createLabel(String(index + 1), config.label, theme);
    left.position.set(-4.22, TILE_TOP + 0.01, z);
    left.rotation.z = -Math.PI / 2;
    board.add(left);
    const right = createLabel(String(index + 1), config.label, theme);
    right.position.set(4.22, TILE_TOP + 0.01, z);
    right.rotation.z = Math.PI / 2;
    board.add(right);
  }

  return board;
}

function createJapaneseHouseBackdrop() {
  const house = new THREE.Group();
  house.name = "japanese-house-background";

  const timber = new THREE.MeshStandardMaterial({
    color: "#463a35",
    roughness: 0.76,
    transparent: true,
    opacity: 0.74,
  });
  const lacquer = new THREE.MeshStandardMaterial({
    color: "#5b2a34",
    roughness: 0.5,
    transparent: true,
    opacity: 0.72,
  });
  const paper = new THREE.MeshStandardMaterial({
    color: "#d2c6ae",
    roughness: 0.94,
    transparent: true,
    opacity: 0.68,
  });
  const roof = new THREE.MeshStandardMaterial({
    color: "#414746",
    roughness: 0.82,
    transparent: true,
    opacity: 0.7,
  });
  const tatami = new THREE.MeshStandardMaterial({ color: "#817b63", roughness: 0.96 });
  const lanternPaper = new THREE.MeshStandardMaterial({
    color: "#c9a979",
    roughness: 0.84,
    transparent: true,
    opacity: 0.7,
  });

  addMesh(house, new RoundedBoxGeometry(15, 0.24, 4.1, 4, 0.08), tatami, [0, -0.08, -7.25]);
  addMesh(house, new THREE.BoxGeometry(14.2, 4.35, 0.24), paper, [0, 2.05, -9.08]);
  addMesh(house, new RoundedBoxGeometry(15.2, 0.34, 3.25, 5, 0.12), roof, [0, 4.62, -8.72], undefined, [-0.08, 0, 0]);
  addMesh(house, new THREE.CylinderGeometry(0.16, 0.16, 15.2, 24), lacquer, [0, 4.84, -8.98], undefined, [0, 0, Math.PI / 2]);

  for (const y of [0.22, 4.25]) {
    addMesh(house, new THREE.BoxGeometry(14.4, 0.2, 0.3), timber, [0, y, -8.91]);
  }

  const panelWidth = 2.18;
  for (let panel = 0; panel < 6; panel += 1) {
    const centerX = (panel - 2.5) * panelWidth;
    addMesh(house, new THREE.BoxGeometry(2.02, 3.72, 0.055), paper, [centerX, 2.2, -8.86]);

    for (const offsetX of [-1.09, -0.36, 0.36, 1.09]) {
      addMesh(
        house,
        new THREE.BoxGeometry(0.065, 3.82, 0.075),
        timber,
        [centerX + offsetX, 2.2, -8.8],
      );
    }
    for (const y of [0.7, 1.45, 2.2, 2.95, 3.7]) {
      addMesh(house, new THREE.BoxGeometry(2.14, 0.055, 0.075), timber, [centerX, y, -8.8]);
    }
  }

  addMesh(house, new THREE.BoxGeometry(1.18, 2.45, 0.045), lacquer, [0, 2.32, -8.7]);
  addMesh(house, new THREE.BoxGeometry(0.92, 2.18, 0.055), paper, [0, 2.32, -8.66]);
  addMesh(
    house,
    new THREE.CircleGeometry(0.27, 40),
    new THREE.MeshBasicMaterial({ color: "#843842", transparent: true, opacity: 0.7 }),
    [0, 2.66, -8.62],
  );
  addMesh(house, new THREE.BoxGeometry(1.22, 0.1, 0.08), timber, [0, 1.05, -8.62]);

  for (const x of [-5.65, 5.65]) {
    addMesh(house, new THREE.CylinderGeometry(0.24, 0.19, 0.9, 32), lanternPaper, [x, 2.65, -8.36]);
    addMesh(house, new THREE.CylinderGeometry(0.08, 0.08, 0.24, 24), timber, [x, 3.22, -8.36]);
    addMesh(house, new THREE.CylinderGeometry(0.08, 0.08, 0.24, 24), timber, [x, 2.08, -8.36]);
  }

  house.scale.setScalar(0.72);
  house.position.set(0, -0.02, -2.25);
  configureShadows(house, false, true);
  return house;
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
  { position, flipped, theme, activeSquare, onSquarePress, onSquareErase },
  ref,
) {
  const hostRef = useRef<HTMLDivElement>(null);
  const stateRef = useRef<SceneState | null>(null);
  const positionRef = useRef(position);
  const flippedRef = useRef(flipped);
  const cameraSnapshotRef = useRef<CameraGoal>({
    position: new THREE.Vector3(...CAMERA_VIEWS.angle),
    target: new THREE.Vector3(0, 0.15, 0),
  });
  const callbacksRef = useRef({ onSquarePress, onSquareErase });
  positionRef.current = position;
  flippedRef.current = flipped;
  callbacksRef.current = { onSquarePress, onSquareErase };

  useImperativeHandle(ref, () => ({
    setView(view) {
      const state = stateRef.current;
      if (!state) return;
      state.cameraGoal = {
        position: new THREE.Vector3(...CAMERA_VIEWS[view]),
        target: new THREE.Vector3(0, 0.15, 0),
      };
    },
    resetCamera() {
      const state = stateRef.current;
      if (!state) return;
      state.cameraGoal = {
        position: new THREE.Vector3(...CAMERA_VIEWS.angle),
        target: new THREE.Vector3(0, 0.15, 0),
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
  }));

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const config = THEME_CONFIGS[theme];
    const samurai = theme === "samurai";
    const scene = new THREE.Scene();
    const backgroundTexture = createBackgroundTexture(config.background);
    scene.background = backgroundTexture;
    if (samurai) scene.fog = new THREE.Fog(config.background[2], 18, 29);

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

    addThemeLighting(scene, config, window.innerWidth < 820 ? 1024 : 2048);
    scene.add(createThemeFloor(config));
    if (samurai) scene.add(createJapaneseHouseBackdrop());

    const board = createBoard(theme, renderer.capabilities.getMaxAnisotropy());
    const pieces = new THREE.Group();
    pieces.name = "pieces";
    const selection = new THREE.Group();
    selection.name = "selection";
    board.add(pieces, selection);

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

    const materials = createPieceMaterials(theme);

    const state: SceneState = {
      scene,
      camera,
      renderer,
      controls,
      board,
      pieces,
      selection,
      hover,
      materials,
      theme,
      latestPosition: positionRef.current,
      cameraGoal: null,
    };
    stateRef.current = state;
    rebuildPieces(state);

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
      if (pointerDown) return;
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
      pointerDown = true;
      pointerStart.set(event.clientX, event.clientY);
      hover.visible = false;
    };
    const pointerUpHandler = (event: PointerEvent) => {
      const distance = pointerStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY));
      pointerDown = false;
      if (distance > 6 || event.button !== 0) return;
      const interactive = pick(event.clientX, event.clientY);
      const square = interactive?.userData.square as Square | undefined;
      if (square) callbacksRef.current.onSquarePress(square);
    };
    const contextHandler = (event: MouseEvent) => {
      event.preventDefault();
      const interactive = pick(event.clientX, event.clientY);
      const square = interactive?.userData.square as Square | undefined;
      if (square) callbacksRef.current.onSquareErase(square);
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
      const targetRotation = flippedRef.current ? Math.PI : 0;
      board.rotation.y = THREE.MathUtils.lerp(board.rotation.y, targetRotation, 0.12);
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
      disposeObject(pieces, { materials: false });
      pieces.clear();
      disposeObject(scene);
      disposeMaterialSet(materials);
      backgroundTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      stateRef.current = null;
    };
  }, [theme]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    state.latestPosition = position;
    rebuildPieces(state);
  }, [position]);

  useEffect(() => {
    const state = stateRef.current;
    if (!state) return;
    disposeObject(state.selection, { materials: false });
    state.selection.clear();
    if (!activeSquare) return;
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
  }, [activeSquare, theme]);

  return <div className="board-host" ref={hostRef} />;
});
