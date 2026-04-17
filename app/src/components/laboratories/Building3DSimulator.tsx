import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RotateCw, Trash2, Undo2 } from 'lucide-react';

interface Building3DSimulatorProps {
  onInteractionComplete?: () => void;
}


const BLOCK_TYPES = {
  wall:   { color: 0x94a3b8, wire: 0x475569, name: 'Wall',    emoji: '🧱', transparent: false, opacity: 1.0 },
  glass:  { color: 0x7dd3fc, wire: 0x0ea5e9, name: 'Glass',   emoji: '🟦', transparent: true,  opacity: 0.45 },
  wood:   { color: 0x92400e, wire: 0x78350f, name: 'Wood',    emoji: '🪵', transparent: false, opacity: 1.0 },
  brick:  { color: 0xdc2626, wire: 0x991b1b, name: 'Brick',   emoji: '🧱', transparent: false, opacity: 1.0 },
  stone:  { color: 0x57534e, wire: 0x292524, name: 'Stone',   emoji: '🪨', transparent: false, opacity: 1.0 },
  grass:  { color: 0x22c55e, wire: 0x166534, name: 'Grass',   emoji: '🌱', transparent: false, opacity: 1.0 },
  water:  { color: 0x38bdf8, wire: 0x0ea5e9, name: 'Water',   emoji: '💧', transparent: true,  opacity: 0.5 },
  sand:   { color: 0xfacc15, wire: 0xca8a04, name: 'Sand',    emoji: '🏖️', transparent: false, opacity: 1.0 },
  light:  { color: 0xfef08a, wire: 0xfacc15, name: 'Light',   emoji: '💡', transparent: true,  opacity: 0.7 },
} as const;
type BlockType = keyof typeof BLOCK_TYPES;

const SHAPE_TYPES = {
  cube:    { name: 'Cube',    emoji: '◼️' },
  sphere:  { name: 'Sphere',  emoji: '⚪' },
  cylinder:{ name: 'Cylinder',emoji: '🟠' },
  cone:    { name: 'Cone',    emoji: '🔺' },
} as const;
type ShapeType = keyof typeof SHAPE_TYPES;

const GRID = 20;         // 20×20 open world grid
const MAX_HEIGHT = 20;   // allow tall structures
const REQUIRED = 40;     // more blocks to encourage exploration
const BLOCK_SIZE = 1;

export function Building3DSimulator({ onInteractionComplete }: Building3DSimulatorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef  = useRef<{ dispose: () => void } | null>(null);
  const addBlockRef   = useRef<((col: number, row: number, type: BlockType) => boolean) | null>(null);
  const undoLastRef   = useRef<(() => void) | null>(null);
  const resetSceneRef = useRef<(() => void) | null>(null);
  const controlsRef   = useRef<OrbitControls | null>(null);

  const [selectedType, setSelectedType] = useState<BlockType>('wall');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('cube');
  const [blockCount, setBlockCount]     = useState(0);
  const [completed, setCompleted]       = useState(false);
  const [hoveredCell, setHoveredCell]   = useState<{ col: number; row: number } | null>(null);

  // Build the Three.js scene once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── Scene ──────────────────────────────────────────────────
    const scene = new THREE.Scene();

    // Skybox
    scene.background = new THREE.Color(0x87ceeb); // sky blue
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.018);

    // ── Camera ─────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(55, canvas.clientWidth / canvas.clientHeight, 0.1, 200);
    camera.position.set(8, 9, 12);
    camera.lookAt(0, 1, 0);

    // ── Renderer ───────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // ── Lighting ───────────────────────────────────────────────
    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff4e0, 1.4);
    sun.position.set(8, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xb0c4ff, 0.4);
    fill.position.set(-6, 4, -6);
    scene.add(fill);


    // ── Large Ground / Open World ─────────────────────────────
    const groundGeo = new THREE.BoxGeometry(GRID + 10, 0.18, GRID + 10);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.09;
    ground.receiveShadow = true;
    scene.add(ground);

    // Subtle grid lines on ground
    const gridHelper = new THREE.GridHelper(GRID, GRID, 0x22c55e, 0x166534);
    gridHelper.position.y = 0.01;
    scene.add(gridHelper);

    // Simple environmental features (trees)
    for (let i = 0; i < 12; i++) {
      const treeTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.18, 1.1, 8),
        new THREE.MeshStandardMaterial({ color: 0x8b5e3c })
      );
      const treeLeaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x22c55e })
      );
      const x = (Math.random() - 0.5) * (GRID + 6);
      const z = (Math.random() - 0.5) * (GRID + 6);
      treeTrunk.position.set(x, 0.55, z);
      treeLeaves.position.set(x, 1.2, z);
      scene.add(treeTrunk);
      scene.add(treeLeaves);
    }

    // ── Ghost / hover block ────────────────────────────────────
    const ghostGeo = new THREE.BoxGeometry(BLOCK_SIZE * 0.98, BLOCK_SIZE * 0.98, BLOCK_SIZE * 0.98);
    const ghostMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24, transparent: true, opacity: 0.35, depthWrite: false,
    });
    const ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    ghostMesh.visible = false;
    scene.add(ghostMesh);

    // ── OrbitControls ──────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);

    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 6;
    controls.maxDistance = 80;
    controls.maxPolarAngle = Math.PI / 1.8; // allow more vertical look
    controls.target.set(0, 1, 0);
    controlsRef.current = controls;

    // ── Block tracking ─────────────────────────────────────────

    // stack[col][row] = array of placed meshes
    const stack: THREE.Mesh[][][] = Array.from({ length: GRID }, () =>
      Array.from({ length: GRID }, () => [])
    );
    let placedTotal = 0;

    // ── Raycaster ──────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-9999, -9999);

    // Build hit-planes: one invisible plane per cell at y=0 + dynamic ones on top
    // We'll raycast against all  meshes + ground plane
    const hitPlaneGeo = new THREE.PlaneGeometry(BLOCK_SIZE, BLOCK_SIZE);
    const hitPlaneMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.FrontSide });
    const hitPlanes: THREE.Mesh[][] = Array.from({ length: GRID }, (_, col) =>
      Array.from({ length: GRID }, (_, row) => {
        const plane = new THREE.Mesh(hitPlaneGeo, hitPlaneMat.clone());
        plane.rotation.x = -Math.PI / 2;
        plane.position.set(col - (GRID - 1) / 2, 0, row - (GRID - 1) / 2);
        plane.userData = { col, row, isHitPlane: true };
        scene.add(plane);
        return plane;
      })
    );

    function updateHitPlanes() {
      for (let col = 0; col < GRID; col++) {
        for (let row = 0; row < GRID; row++) {
          const h = stack[col][row].length;
          hitPlanes[col][row].position.y = h;
        }
      }
    }


    // ── Add / Remove blocks (open world) ─────────────────────

    function addBlock(col: number, row: number, type: BlockType): boolean {
      const h = stack[col][row].length;
      if (h >= MAX_HEIGHT) return false;

      const bt = BLOCK_TYPES[type];
      let geo: THREE.BufferGeometry;
      switch (selectedShape) {
        case 'cube':
          geo = new THREE.BoxGeometry(BLOCK_SIZE * 0.97, BLOCK_SIZE * 0.97, BLOCK_SIZE * 0.97);
          break;
        case 'sphere':
          geo = new THREE.SphereGeometry(BLOCK_SIZE * 0.5, 18, 18);
          break;
        case 'cylinder':
          geo = new THREE.CylinderGeometry(BLOCK_SIZE * 0.48, BLOCK_SIZE * 0.48, BLOCK_SIZE * 0.97, 18);
          break;
        case 'cone':
          geo = new THREE.ConeGeometry(BLOCK_SIZE * 0.48, BLOCK_SIZE * 0.97, 18);
          break;
        default:
          geo = new THREE.BoxGeometry(BLOCK_SIZE * 0.97, BLOCK_SIZE * 0.97, BLOCK_SIZE * 0.97);
      }
      const mat = new THREE.MeshStandardMaterial({
        color: bt.color,
        roughness: 0.65,
        metalness: 0.1,
        transparent: bt.transparent,
        opacity: bt.opacity,
      });
      const mesh = new THREE.Mesh(geo, mat);

      const x = col - (GRID - 1) / 2;
      const z = row - (GRID - 1) / 2;
      mesh.position.set(x, h + 0.5, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { col, row, type, shape: selectedShape };

      // Wireframe outline
      let edges: THREE.EdgesGeometry | undefined = undefined;
      if (selectedShape === 'cube') {
        edges = new THREE.EdgesGeometry(geo);
      } else if (selectedShape === 'cylinder' || selectedShape === 'cone') {
        edges = new THREE.EdgesGeometry(geo, 10);
      }
      if (edges) {
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: bt.wire }));
        mesh.add(line);
      }

      scene.add(mesh);
      stack[col][row].push(mesh);
      placedTotal++;
      updateHitPlanes();
      return true;
    }

    // Remove block at hovered cell (top block)
    function removeBlock(col: number, row: number): boolean {
      const arr = stack[col][row];
      if (arr.length === 0) return false;
      const mesh = arr.pop()!;
      scene.remove(mesh);
      placedTotal = Math.max(0, placedTotal - 1);
      updateHitPlanes();
      return true;
    }

    // Undo last block anywhere (walk backwards)
    function undoLast() {
      for (let col = GRID - 1; col >= 0; col--) {
        for (let row = GRID - 1; row >= 0; row--) {
          const arr = stack[col][row];
          if (arr.length > 0) {
            const mesh = arr.pop()!;
            scene.remove(mesh);
            placedTotal = Math.max(0, placedTotal - 1);
            updateHitPlanes();
            return;
          }
        }
      }
    }

    function resetAll() {
      for (let col = 0; col < GRID; col++) {
        for (let row = 0; row < GRID; row++) {
          while (stack[col][row].length > 0) {
            const mesh = stack[col][row].pop()!;
            scene.remove(mesh);
          }
        }
      }
      placedTotal = 0;
      updateHitPlanes();
    }

    addBlockRef.current   = addBlock;
    undoLastRef.current   = undoLast;
    resetSceneRef.current = resetAll;

    // ── Mouse move → ghost ─────────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allHitPlanes = hitPlanes.flat();
      const hits = raycaster.intersectObjects(allHitPlanes);
      if (hits.length > 0) {
        const { col, row } = hits[0].object.userData;
        const h = stack[col][row].length;
        if (h < MAX_HEIGHT) {
          const x = col - (GRID - 1) / 2;
          const z = row - (GRID - 1) / 2;
          ghostMesh.position.set(x, h + 0.5, z);
          ghostMesh.visible = true;
          setHoveredCell({ col, row });
        } else {
          ghostMesh.visible = false;
          setHoveredCell(null);
        }
      } else {
        ghostMesh.visible = false;
        setHoveredCell(null);
      }
    };


    // ── Mouse click: left=place, right=remove ────────────────
    const onMouseDown = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const allHitPlanes = hitPlanes.flat();
      const hits = raycaster.intersectObjects(allHitPlanes);
      if (hits.length > 0) {
        const { col, row } = hits[0].object.userData;
        if (e.button === 0) { // Left click: place
          const typeEl = document.getElementById('selected-block-type');
          const type = (typeEl?.dataset.type as BlockType) || 'wall';
          const placed = addBlock(col, row, type);
          if (placed) {
            const total = placedTotal;
            setBlockCount(total);
            if (total >= REQUIRED) {
              setCompleted(true);
              onInteractionComplete?.();
            }
          }
        } else if (e.button === 2) { // Right click: remove
          const removed = removeBlock(col, row);
          if (removed) {
            setBlockCount(placedTotal);
          }
        }
      }
    };

    // Touch support
    const onTouchEnd = (e: TouchEvent) => {
      if (e.changedTouches.length === 0) return;
      const t = e.changedTouches[0];
      const rect = canvas.getBoundingClientRect();
      mouse.x =  ((t.clientX - rect.left) / rect.width)  * 2 - 1;
      mouse.y = -((t.clientY - rect.top)  / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(hitPlanes.flat());
      if (hits.length > 0) {
        const { col, row } = hits[0].object.userData;
        const typeEl = document.getElementById('selected-block-type');
        const type = (typeEl?.dataset.type as BlockType) || 'wall';
        const placed = addBlock(col, row, type);
        if (placed) {
          const total = placedTotal;
          setBlockCount(total);
          if (total >= REQUIRED) {
            setCompleted(true);
            onInteractionComplete?.();
          }
        }
      }
    };


    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault()); // prevent context menu
    canvas.addEventListener('touchend', onTouchEnd);

    // ── Animate ────────────────────────────────────────────────
    let raf: number;
    function animate() {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // ── Resize ────────────────────────────────────────────────
    const onResize = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    sceneRef.current = {
      dispose: () => {
        cancelAnimationFrame(raf);
        canvas.removeEventListener('mousemove', onMouseMove);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('touchend', onTouchEnd);
        window.removeEventListener('resize', onResize);
        renderer.dispose();
      },
    };

    return () => sceneRef.current?.dispose();
  }, []); // run once

  // Handler wrappers that read current state
  const handleUndo = useCallback(() => {
    undoLastRef.current?.();
    setBlockCount(prev => Math.max(0, prev - 1));
  }, []);

  const handleReset = useCallback(() => {
    resetSceneRef.current?.();
    setBlockCount(0);
    setCompleted(false);
  }, []);

  const handleResetCamera = useCallback(() => {
    controlsRef.current?.reset();
  }, []);

  const progress = Math.min((blockCount / REQUIRED) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Canvas */}
      <div className="relative bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        {/* Hidden element so Three.js closures can read selected block type */}
        <span
          id="selected-block-type"
          data-type={selectedType}
          className="hidden"
        />

        <canvas
          ref={canvasRef}
          className="w-full h-[420px] block cursor-crosshair outline-none"
          tabIndex={0}
        />

        {/* Top-right controls */}
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <Button size="sm" variant="outline"
            onClick={handleResetCamera}
            className="bg-slate-800/80 border-slate-600 hover:bg-slate-700 text-xs px-2 py-1 h-8"
            title="Reset camera"
          >
            <RotateCw className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="outline"
            onClick={handleUndo}
            className="bg-slate-800/80 border-slate-600 hover:bg-slate-700 text-xs px-2 py-1 h-8"
            title="Remove last block"
          >
            <Undo2 className="w-3 h-3" />
          </Button>
          <Button size="sm" variant="destructive"
            onClick={handleReset}
            className="bg-red-800/80 border-red-700 hover:bg-red-700 text-xs px-2 py-1 h-8"
            title="Clear building"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* Bottom-left hint */}
        <div className="absolute bottom-3 left-3 bg-slate-900/80 border border-slate-600/50 rounded px-3 py-2 text-xs text-slate-300 pointer-events-none">
          <p>🖱️ <strong>Left-click</strong> to place block &nbsp;|&nbsp; <strong>Right-click</strong> to remove block</p>
          <p>🖱️ <strong>Drag</strong> to rotate view &nbsp;|&nbsp; <strong>Scroll</strong> to zoom &nbsp;|&nbsp; <strong>Right-drag</strong> to pan</p>
        </div>

        {/* Progress badge */}
        <div className="absolute top-3 left-3 bg-slate-900/80 border border-slate-600/50 rounded px-3 py-2 text-xs pointer-events-none">
          <p className="text-slate-300 font-semibold">Blocks: <span className="text-violet-400">{blockCount}</span> / {REQUIRED}</p>
          <div className="mt-1 w-28 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progress}%`,
                background: completed ? '#22c55e' : '#8b5cf6',
              }}
            />
          </div>
        </div>
      </div>

      {/* Block type and shape selector */}
      <Card className="bg-slate-800/60 border-slate-700 p-4">
        <p className="text-xs text-slate-400 mb-3 font-semibold uppercase tracking-wide">Select Material</p>
        <div className="flex flex-wrap gap-2 mb-4">
          {(Object.keys(BLOCK_TYPES) as BlockType[]).map(type => {
            const bt = BLOCK_TYPES[type];
            const isSelected = selectedType === type;
            return (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-violet-500 bg-violet-500/20 text-violet-300'
                    : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                }`}
              >
                <span className="text-base leading-none">{bt.emoji}</span>
                <span>{bt.name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mb-3 font-semibold uppercase tracking-wide">Select Shape</p>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SHAPE_TYPES) as ShapeType[]).map(shape => {
            const st = SHAPE_TYPES[shape];
            const isSelected = selectedShape === shape;
            return (
              <button
                key={shape}
                onClick={() => setSelectedShape(shape)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                  isSelected
                    ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                    : 'border-slate-600 bg-slate-700/50 text-slate-300 hover:border-slate-500 hover:bg-slate-700'
                }`}
              >
                <span className="text-base leading-none">{st.emoji}</span>
                <span>{st.name}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-3">Build anything you can imagine: objects, models, sculptures, and more—using different shapes and materials!</p>
      </Card>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <p className="text-slate-400 mb-1">Blocks Placed</p>
          <p className="text-2xl font-bold text-violet-400">{blockCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <p className="text-slate-400 mb-1">Creative Goal</p>
          <p className="text-2xl font-bold text-slate-200">{REQUIRED}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3 text-center">
          <p className="text-slate-400 mb-1">Max Height</p>
          <p className="text-2xl font-bold text-slate-200">{MAX_HEIGHT}</p>
        </div>
      </div>

      {hoveredCell && (
        <p className="text-xs text-center text-slate-400">
          Hover: Column {hoveredCell.col + 1}, Row {hoveredCell.row + 1}
          {' '}&mdash; Click to place a <span className="text-violet-300">{BLOCK_TYPES[selectedType].name}</span>
        </p>
      )}

      {completed && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
          <p className="text-green-300 font-semibold text-sm">
            🎉 <strong>Creation complete!</strong> You've placed {blockCount} blocks. Show off your unique creation!
          </p>
          <p className="text-green-400/70 text-xs mt-1">Click the button below to earn your XP for creative building.</p>
        </div>
      )}
    </div>
  );
}
