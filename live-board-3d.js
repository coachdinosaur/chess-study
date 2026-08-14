import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const TILE_TOP = 0.371;
const CAMERA_TARGET_Y = 0.75;

const CAMERA_VIEWS = {
  angle: [8.4, 9.2, 10.2],
  top: [0.01, 17.2, 0.01],
  white: [0, 7.4, 12.0],
  black: [0, 7.4, -12.0],
  left: [-12.0, 7.0, 0],
  right: [12.0, 7.0, 0],
  low: [9.4, 3.8, 11.0],
};

const THEME_CONFIG = {
  background: ['#f6f0e5', '#ded0bb', '#b8a38a'],
  floor: '#c2b094',
  board: {
    frameBase: '#4a291c',
    frameTop: '#985a32',
    bed: '#241b17',
    light: '#eadcbd',
    dark: '#244c3a',
    trim: '#b78b45',
    label: '#4d2f20',
    grain: '#4f2416',
    woodGrain: true,
    frameRoughness: 0.32,
    frameClearcoat: 0.34,
    tileRoughness: 0.5,
    tileClearcoat: 0.08,
  },
  pieces: {
    white: '#ddccaa',
    black: '#211713',
    gold: '#b88e48',
    roughness: 0.27,
    clearcoat: 0.36,
  },
  lighting: {
    exposure: 1.02,
    ambient: 0.58,
    hemisphereSky: '#fff5df',
    hemisphereGround: '#71665b',
    hemisphereIntensity: 1.05,
    keyColor: '#ffe1b8',
    keyIntensity: 3.25,
    keyPosition: [-7, 12, 8],
    fillColor: '#c9dce5',
    fillIntensity: 1.15,
    fillPosition: [8, 7, -6],
  },
  hover: '#e8b552',
};

const STAUNTON_MODEL_NAMES = {
  wK: 'WhiteKing', wQ: 'WhiteQueen', wR: 'RightWhiteRook', wB: 'RightWhiteBishop', wN: 'RightWhiteKnight', wP: 'WhitePawnA',
  bK: 'BlackKing', bQ: 'BlackQueen', bR: 'RightBlackRook', bB: 'RightBlackBishop', bN: 'RightBlackKnight', bP: 'BlackPawnA',
};

const STAUNTON_TARGET_HEIGHT = { P: 0.88, R: 1.04, N: 1.2, B: 1.24, Q: 1.36, K: 1.48 };
const STAUNTON_WIDTH_BOOST = 1.18;

let sharedPieceTemplates = null;
let sharedPieceTemplatesPromise = null;
let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) audioCtx = new AudioCtx();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playSound(type = 'move') {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  if (type === 'capture') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.065);
    gain.gain.setValueAtTime(0.45, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.08);
  } else if (type === 'check') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.24);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.04);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }
}

function squarePosition(square) {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);
  return new THREE.Vector3(file - 3.5, TILE_TOP, 4.5 - rank);
}

function createBackgroundTexture(colors) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  if (!context) return null;

  const gradient = context.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.52, colors[1]);
  gradient.addColorStop(1, colors[2]);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createPieceMaterials() {
  const config = THEME_CONFIG.pieces;
  const material = (color, roughness = config.roughness) => new THREE.MeshPhysicalMaterial({
    color,
    roughness,
    metalness: 0,
    clearcoat: config.clearcoat,
    clearcoatRoughness: Math.min(0.5, roughness + 0.08),
    sheen: 0.12,
    sheenColor: new THREE.Color(color).lerp(new THREE.Color('#fff0d2'), 0.12),
    sheenRoughness: 0.55,
    side: THREE.DoubleSide,
  });

  return {
    white: material(config.white),
    black: material(config.black, Math.max(0.2, config.roughness - 0.03)),
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

function addThemeLighting(scene, config, shadowMapSize) {
  scene.add(new THREE.AmbientLight('#ffffff', config.lighting.ambient));
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
  key.shadow.near = 1;
  key.shadow.far = 32;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.018;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(config.lighting.fillColor, config.lighting.fillIntensity);
  fill.position.set(...config.lighting.fillPosition);
  fill.castShadow = false;
  scene.add(fill);
}

function createThemeFloor(config) {
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

function lathe(profile, material, segments = 48) {
  const points = profile.map(([radius, height]) => new THREE.Vector2(radius, height));
  return new THREE.Mesh(new THREE.LatheGeometry(points, segments), material);
}

function addStauntonBase(parent, material, radius, topRadius) {
  const profile = [
    [0, 0], [radius * 0.82, 0], [radius * 0.95, 0.018], [radius, 0.05], [radius * 0.99, 0.08],
    [radius * 0.94, 0.112], [radius * 0.84, 0.15], [radius * 0.76, 0.19], [radius * 0.69, 0.23],
    [topRadius, 0.28], [topRadius, 0.3],
  ];
  parent.add(lathe(profile, material, 64));
}

function createMitredHeadGeometry() {
  const source = new THREE.SphereGeometry(0.19, 72, 48).toNonIndexed();
  const positions = source.getAttribute('position');
  const keptPositions = [];
  const gapHalfWidth = 0.018;

  for (let index = 0; index < positions.count; index += 3) {
    const triangle = [];
    const signedDistances = [];

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
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(keptPositions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function createMitredBishopModel(code, materials) {
  const model = new THREE.Group();
  const body = code[0] === 'w' ? materials.white : materials.black;

  addStauntonBase(model, body, 0.32, 0.19);
  model.add(lathe([
    [0.19, 0.28], [0.215, 0.37], [0.18, 0.5], [0.13, 0.72], [0.145, 0.8], [0.225, 0.86], [0.23, 0.9],
  ], body, 64));
  const head = new THREE.Mesh(createMitredHeadGeometry(), body);
  head.position.set(0, 1.055, 0);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.055, 36, 24), body);
  finial.position.set(0, 1.305, 0);
  model.add(head, finial);
  return model;
}

function createStauntonTemplates(root) {
  const entries = Object.entries(STAUNTON_MODEL_NAMES).map(([pieceCode, modelName]) => {
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
    const heightScale = STAUNTON_TARGET_HEIGHT[pieceCode[1]] / height;
    template.scale.set(
      heightScale * STAUNTON_WIDTH_BOOST,
      heightScale,
      heightScale * STAUNTON_WIDTH_BOOST,
    );
    template.updateMatrixWorld(true);
    return [pieceCode, template];
  });

  return Object.fromEntries(entries);
}

function loadPieceTemplates() {
  if (sharedPieceTemplates) return Promise.resolve(sharedPieceTemplates);
  if (sharedPieceTemplatesPromise) return sharedPieceTemplatesPromise;

  sharedPieceTemplatesPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      './assets/models/staunton.glb',
      (asset) => {
        try {
          sharedPieceTemplates = createStauntonTemplates(asset.scene);
          resolve(sharedPieceTemplates);
        } catch (error) {
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

function createBoard() {
  const board = new THREE.Group();
  board.name = 'board';
  const config = THEME_CONFIG.board;

  const frameBase = new THREE.MeshPhysicalMaterial({
    color: config.frameBase,
    roughness: config.frameRoughness + 0.12,
    metalness: 0,
    clearcoat: config.frameClearcoat * 0.72,
  });
  const frameTop = new THREE.MeshPhysicalMaterial({
    color: config.frameTop,
    roughness: config.frameRoughness,
    metalness: 0,
    clearcoat: config.frameClearcoat,
  });
  const bed = new THREE.MeshStandardMaterial({
    color: config.bed,
    roughness: 0.72,
    metalness: 0,
  });

  const light = new THREE.MeshPhysicalMaterial({
    color: config.light,
    roughness: config.tileRoughness,
    metalness: 0,
    clearcoat: config.tileClearcoat,
  });
  const dark = new THREE.MeshPhysicalMaterial({
    color: config.dark,
    roughness: config.tileRoughness,
    metalness: 0,
    clearcoat: config.tileClearcoat,
  });

  const base = new THREE.Mesh(new RoundedBoxGeometry(8.9, 0.34, 8.9, 7, 0.16), frameBase);
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
  board.add(boardBed);

  for (let rank = 1; rank <= 8; rank += 1) {
    for (let file = 0; file < 8; file += 1) {
      const square = `${String.fromCharCode(97 + file)}${rank}`;
      const tile = new THREE.Mesh(
        new THREE.PlaneGeometry(0.994, 0.994),
        (file + rank) % 2 === 1 ? dark : light,
      );
      tile.position.copy(squarePosition(square));
      tile.rotation.x = -Math.PI / 2;
      tile.position.y = TILE_TOP;
      tile.receiveShadow = true;
      tile.userData = { kind: 'square', square };
      board.add(tile);
    }
  }

  return board;
}

function parseFenToMap(fen) {
  if (!fen) return {};
  const placement = fen.split(' ')[0];
  const ranks = placement.split('/');
  const map = {};
  ranks.forEach((rankStr, rankIndex) => {
    const rank = 8 - rankIndex;
    let fileIndex = 0;
    for (const char of rankStr) {
      if (/[1-8]/.test(char)) {
        fileIndex += Number(char);
      } else {
        const file = FILES[fileIndex];
        const color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toUpperCase();
        map[`${file}${rank}`] = `${color}${type}`;
        fileIndex += 1;
      }
    }
  });
  return map;
}

export class LiveBoard3D {
  constructor(container, onSquareClick) {
    this.container = container;
    this.onSquareClick = onSquareClick;
    this.latestPosition = {};
    this.orientation = 'white';
    this.lastMove = null;
    this.selectedSquare = null;
    this.legalMoves = [];
    this.canMove = true;
    this.activeAnimations = [];
    this.activeFades = [];
    this.cameraGoal = null;
    this.initialized = false;
    this.init();
  }

  init() {
    const scene = new THREE.Scene();
    const bgTexture = createBackgroundTexture(THEME_CONFIG.background);
    if (bgTexture) scene.background = bgTexture;

    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(...CAMERA_VIEWS.angle);

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = THEME_CONFIG.lighting.exposure;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'live-board-3d-canvas';
    renderer.domElement.setAttribute('aria-label', '3D interactive chess board');
    this.container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, CAMERA_TARGET_Y, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.minDistance = 5.6;
    controls.maxDistance = 28;
    controls.minPolarAngle = 0.015;
    controls.maxPolarAngle = Math.PI / 2 - 0.012;

    addThemeLighting(scene, THEME_CONFIG, 1024);
    scene.add(createThemeFloor(THEME_CONFIG));

    const board = createBoard();
    const pieces = new THREE.Group();
    pieces.name = 'pieces';
    const selection = new THREE.Group();
    selection.name = 'selection';
    const highlights = new THREE.Group();
    highlights.name = 'highlights';
    board.add(pieces, selection, highlights);

    const hoverMat = new THREE.MeshBasicMaterial({
      color: THEME_CONFIG.hover,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const hover = new THREE.Mesh(new THREE.PlaneGeometry(0.88, 0.88), hoverMat);
    hover.rotation.x = -Math.PI / 2;
    hover.position.y = TILE_TOP + 0.004;
    hover.visible = false;
    board.add(hover);
    scene.add(board);

    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.controls = controls;
    this.board = board;
    this.pieces = pieces;
    this.selection = selection;
    this.highlights = highlights;
    this.hover = hover;
    this.materials = createPieceMaterials();

    loadPieceTemplates()
      .then((templates) => {
        this.pieceTemplates = templates;
        this.rebuildPieces();
      })
      .catch((error) => {
        console.warn('Could not load 3D piece templates.', error);
      });

    // Resize handling
    const resize = () => {
      const bounds = this.container.getBoundingClientRect();
      const width = Math.max(1, Math.round(bounds.width));
      const height = Math.max(1, Math.round(bounds.height));
      this.renderer.setSize(width, height, false);
      this.camera.aspect = width / height;
      this.camera.fov = this.camera.aspect < 0.78 ? 52 : this.camera.aspect < 1.05 ? 46 : 38;
      this.camera.updateProjectionMatrix();
    };
    this.resizeObserver = new ResizeObserver(resize);
    this.resizeObserver.observe(this.container);
    resize();

    // Raycasting & Interaction
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerStart = new THREE.Vector2();

    const pick = (clientX, clientY) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
      pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(board, true);
      for (const hit of hits) {
        let cur = hit.object;
        while (cur) {
          if (cur.userData.square) return cur.userData.square;
          cur = cur.parent;
        }
      }
      return null;
    };

    renderer.domElement.addEventListener('pointerdown', (e) => {
      pointerStart.set(e.clientX, e.clientY);
      hover.visible = false;
    });

    renderer.domElement.addEventListener('pointerup', (e) => {
      const dist = pointerStart.distanceTo(new THREE.Vector2(e.clientX, e.clientY));
      if (dist > 6 || e.button !== 0) return;
      const square = pick(e.clientX, e.clientY);
      if (square && typeof this.onSquareClick === 'function') {
        this.onSquareClick(square);
      }
    });

    renderer.domElement.addEventListener('pointermove', (e) => {
      const square = pick(e.clientX, e.clientY);
      if (!square) {
        hover.visible = false;
        renderer.domElement.style.cursor = 'grab';
        return;
      }
      const loc = squarePosition(square);
      hover.position.set(loc.x, TILE_TOP + 0.004, loc.z);
      hover.visible = true;
      renderer.domElement.style.cursor = 'pointer';
    });

    renderer.domElement.addEventListener('pointerleave', () => {
      hover.visible = false;
    });

    // Animation Loop
    const animate = () => {
      this.animationFrame = requestAnimationFrame(animate);
      const now = performance.now();

      if (this.activeAnimations.length > 0) {
        this.activeAnimations = this.activeAnimations.filter((anim) => {
          const progress = Math.min(1, (now - anim.startTime) / anim.duration);
          const ease = 1 - Math.pow(1 - progress, 3);
          anim.mesh.position.x = THREE.MathUtils.lerp(anim.fromPos.x, anim.toPos.x, ease);
          anim.mesh.position.z = THREE.MathUtils.lerp(anim.fromPos.z, anim.toPos.z, ease);
          anim.mesh.position.y = TILE_TOP + Math.sin(progress * Math.PI) * anim.lift;
          return progress < 1;
        });
      }

      if (this.activeFades.length > 0) {
        this.activeFades = this.activeFades.filter((fade) => {
          const progress = Math.min(1, (now - fade.startTime) / fade.duration);
          const scale = Math.max(0.001, 1 - progress);
          fade.mesh.scale.set(scale, scale, scale);
          if (progress >= 1) {
            this.pieces.remove(fade.mesh);
            return false;
          }
          return true;
        });
      }

      if (this.cameraGoal) {
        camera.position.lerp(this.cameraGoal.position, 0.11);
        controls.target.lerp(this.cameraGoal.target, 0.11);
        if (
          camera.position.distanceTo(this.cameraGoal.position) < 0.02 &&
          controls.target.distanceTo(this.cameraGoal.target) < 0.01
        ) {
          camera.position.copy(this.cameraGoal.position);
          controls.target.copy(this.cameraGoal.target);
          this.cameraGoal = null;
        }
      }

      const targetRotation = this.orientation === 'black' ? Math.PI : 0;
      board.rotation.y = THREE.MathUtils.lerp(board.rotation.y, targetRotation, 0.12);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    this.initialized = true;
  }

  createPieceMesh(code, square) {
    const type = code[1];
    const group = new THREE.Group();
    const body = code[0] === 'w' ? this.materials.white : this.materials.black;

    const model = type === 'B'
      ? createMitredBishopModel(code, this.materials)
      : this.pieceTemplates?.[code]?.clone(true);

    if (model) {
      model.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.material = body;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      group.add(model);
    }

    group.position.copy(squarePosition(square));
    group.position.y = TILE_TOP;
    group.userData = { kind: 'piece', square, code };
    return group;
  }

  rebuildPieces() {
    this.pieces.clear();
    Object.entries(this.latestPosition).forEach(([square, code]) => {
      if (code) this.pieces.add(this.createPieceMesh(code, square));
    });
  }

  syncState({ fen, orientation = 'white', lastMove = null, selectedSquare = null, legalMoves = [], canMove = true }) {
    const newPosition = parseFenToMap(fen);
    const prevPosition = this.latestPosition;
    this.latestPosition = newPosition;
    this.orientation = orientation;
    this.lastMove = lastMove;
    this.selectedSquare = selectedSquare;
    this.legalMoves = legalMoves;
    this.canMove = canMove;

    // Check if we should animate single move
    const canAnimate =
      lastMove &&
      prevPosition[lastMove.from] &&
      newPosition[lastMove.to];

    if (canAnimate) {
      const from = lastMove.from;
      const to = lastMove.to;
      const movedCode = newPosition[to];
      const isCapture = Boolean(prevPosition[to]);

      let movedMesh = null;
      this.pieces.children.forEach((child) => {
        if (child.userData.square === from) {
          movedMesh = child;
        } else if (child.userData.square === to) {
          child.userData.square = undefined;
          this.activeFades.push({ mesh: child, startTime: performance.now(), duration: 200 });
        }
      });

      if (movedMesh) {
        movedMesh.userData.square = to;
        movedMesh.userData.code = movedCode;
        const fromPos = squarePosition(from);
        const toPos = squarePosition(to);
        movedMesh.position.set(fromPos.x, TILE_TOP, fromPos.z);
        const isKnight = movedCode[1] === 'N';

        this.activeAnimations.push({
          mesh: movedMesh,
          fromPos: fromPos.clone(),
          toPos: toPos.clone(),
          startTime: performance.now(),
          duration: 220,
          lift: isKnight ? 0.95 : 0.62,
        });

        playSound(isCapture ? 'capture' : 'move');
      } else {
        this.rebuildPieces();
      }
    } else {
      this.rebuildPieces();
    }

    this.updateHighlights();
  }

  updateHighlights() {
    this.selection.clear();
    this.highlights.clear();

    // 1. Last move highlights
    if (this.lastMove) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xdca83a,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      [this.lastMove.from, this.lastMove.to].forEach((sq) => {
        if (!sq) return;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 0.96), mat);
        const loc = squarePosition(sq);
        mesh.position.set(loc.x, TILE_TOP + 0.002, loc.z);
        mesh.rotation.x = -Math.PI / 2;
        mesh.renderOrder = 5;
        this.highlights.add(mesh);
      });
    }

    // 2. Selected square
    if (this.selectedSquare) {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.39, 0.035, 10, 48),
        this.materials.gold,
      );
      const loc = squarePosition(this.selectedSquare);
      ring.position.set(loc.x, TILE_TOP + 0.036, loc.z);
      ring.rotation.x = Math.PI / 2;
      ring.renderOrder = 8;
      this.selection.add(ring);
    }

    // 3. Legal moves
    if (this.canMove && this.legalMoves && this.legalMoves.length > 0) {
      const dotMat = new THREE.MeshBasicMaterial({
        color: 0x245f4b,
        transparent: true,
        opacity: 0.46,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const captureRingMat = new THREE.MeshBasicMaterial({
        color: 0xc99a48,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

      this.legalMoves.forEach((move) => {
        const dest = typeof move === 'string' ? move : move.to;
        const isCapture = Boolean(this.latestPosition[dest]);
        const loc = squarePosition(dest);

        if (isCapture) {
          const ring = new THREE.Mesh(
            new THREE.TorusGeometry(0.38, 0.03, 8, 36),
            captureRingMat,
          );
          ring.position.set(loc.x, TILE_TOP + 0.02, loc.z);
          ring.rotation.x = Math.PI / 2;
          ring.renderOrder = 7;
          this.highlights.add(ring);
        } else {
          const dot = new THREE.Mesh(new THREE.CircleGeometry(0.14, 32), dotMat);
          dot.position.set(loc.x, TILE_TOP + 0.004, loc.z);
          dot.rotation.x = -Math.PI / 2;
          dot.renderOrder = 7;
          this.highlights.add(dot);
        }
      });
    }
  }

  setCameraView(view) {
    if (!CAMERA_VIEWS[view]) return;
    this.cameraGoal = {
      position: new THREE.Vector3(...CAMERA_VIEWS[view]),
      target: new THREE.Vector3(0, CAMERA_TARGET_Y, 0),
    };
  }

  resetCamera() {
    this.setCameraView('angle');
  }

  dispose() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    if (this.resizeObserver) this.resizeObserver.disconnect();
    this.renderer?.dispose();
    this.renderer?.domElement?.remove();
  }
}
