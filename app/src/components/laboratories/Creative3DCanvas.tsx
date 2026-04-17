import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const BLOCK_TYPES = {
  wall:   { color: 0x94a3b8, name: 'Wall',    emoji: '🧱', transparent: false, opacity: 1.0 },
  glass:  { color: 0x7dd3fc, name: 'Glass',   emoji: '🟦', transparent: true,  opacity: 0.45 },
  wood:   { color: 0x92400e, name: 'Wood',    emoji: '🪵', transparent: false, opacity: 1.0 },
  brick:  { color: 0xdc2626, name: 'Brick',   emoji: '🧱', transparent: false, opacity: 1.0 },
  stone:  { color: 0x57534e, name: 'Stone',   emoji: '🪨', transparent: false, opacity: 1.0 },
  grass:  { color: 0x22c55e, name: 'Grass',   emoji: '🌱', transparent: false, opacity: 1.0 },
  water:  { color: 0x38bdf8, name: 'Water',   emoji: '💧', transparent: true,  opacity: 0.5 },
  sand:   { color: 0xfacc15, name: 'Sand',    emoji: '🏖️', transparent: false, opacity: 1.0 },
  light:  { color: 0xfef08a, name: 'Light',   emoji: '💡', transparent: true,  opacity: 0.7 },
} as const;
type BlockType = keyof typeof BLOCK_TYPES;

const SHAPE_TYPES = {
  cube:    { name: 'Cube',    emoji: '◼️' },
  sphere:  { name: 'Sphere',  emoji: '⚪' },
  cylinder:{ name: 'Cylinder',emoji: '🟠' },
  cone:    { name: 'Cone',    emoji: '🔺' },
} as const;
type ShapeType = keyof typeof SHAPE_TYPES;

interface PlacedShape {
  mesh: THREE.Mesh;
  type: BlockType;
  shape: ShapeType;
}

export function Creative3DCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedType, setSelectedType] = useState<BlockType>('wall');
  const [selectedShape, setSelectedShape] = useState<ShapeType>('cube');
  const [shapes, setShapes] = useState<PlacedShape[]>([]);
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const safeCanvas = canvas;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87ceeb);
    scene.fog = new THREE.FogExp2(0x87ceeb, 0.018);

    const camera = new THREE.PerspectiveCamera(60, safeCanvas.clientWidth / safeCanvas.clientHeight, 0.1, 200);
    camera.position.set(0, 8, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ canvas: safeCanvas, antialias: true });
    renderer.setSize(safeCanvas.clientWidth, safeCanvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const sun = new THREE.DirectionalLight(0xfff4e0, 1.2);
    sun.position.set(8, 16, 8);
    sun.castShadow = true;
    scene.add(sun);

    // Ground
    const groundGeo = new THREE.PlaneGeometry(60, 60);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8 });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = true;
    scene.add(ground);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.minDistance = 4;
    controls.maxDistance = 80;
    controls.maxPolarAngle = Math.PI / 1.7;
    controls.target.set(0, 0, 0);

    // Add all placed shapes
    shapes.forEach(({ mesh }) => scene.add(mesh));

    // Place shape on click
    function onCanvasClick(e: MouseEvent) {
      if (!placing) return;
      const rect = safeCanvas.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(ground);
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const mesh = createMesh(selectedType, selectedShape);
        // Adjust Y so the bottom of the shape sits on the ground
        let y = 0;
        switch (selectedShape) {
          case 'cube':
            y = 0.5;
            break;
          case 'sphere':
            y = 0.5;
            break;
          case 'cylinder':
            y = 0.5;
            break;
          case 'cone':
            y = 0.5;
            break;
          default:
            y = 0.5;
        }
        mesh.position.copy(point);
        mesh.position.y = y;
        setShapes(prev => [...prev, { mesh, type: selectedType, shape: selectedShape }]);
        setPlacing(false);
      }
    }
    safeCanvas.addEventListener('click', onCanvasClick);

    // Animate
    let raf: number;
    function animate() {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    // Resize
    const onResize = () => {
      const w = safeCanvas.clientWidth;
      const h = safeCanvas.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      safeCanvas.removeEventListener('click', onCanvasClick);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
    // eslint-disable-next-line
  }, [shapes, placing]);

  function createMesh(type: BlockType, shape: ShapeType) {
    let geo: THREE.BufferGeometry;
        switch (shape) {
          case 'cube':
            geo = new THREE.BoxGeometry(1, 1, 1);
            break;
          case 'sphere':
            geo = new THREE.SphereGeometry(0.5, 32, 32); // true sphere, radius 0.5
            break;
          case 'cylinder':
            geo = new THREE.CylinderGeometry(0.35, 0.35, 1, 32); // radius 0.35, height 1
            break;
          case 'cone':
            geo = new THREE.ConeGeometry(0.35, 1, 32); // radius 0.35, height 1
            break;
          default:
            geo = new THREE.BoxGeometry(1, 1, 1);
        }
    const bt = BLOCK_TYPES[type];
    const mat = new THREE.MeshStandardMaterial({
      color: bt.color,
      roughness: 0.65,
      metalness: 0.1,
      transparent: bt.transparent,
      opacity: bt.opacity,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  function handleAddShape() {
    setPlacing(true);
  }

  function handleClear() {
    setShapes([]);
  }

  return (
    <Card className="bg-slate-900/60 border-slate-800 p-4">
      <div className="space-y-4">
        <div className="relative bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
          <canvas ref={canvasRef} className="w-full h-[420px] block" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">
              Select Material
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(BLOCK_TYPES) as BlockType[]).map((type) => {
                const bt = BLOCK_TYPES[type];
                const isSelected = selectedType === type;
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-violet-500 bg-violet-500/20 text-violet-200'
                        : 'border-slate-600 bg-slate-800/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60'
                    }`}
                    type="button"
                  >
                    <span className="text-base leading-none">{bt.emoji}</span>
                    <span>{bt.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p className="text-xs text-slate-400 mb-2 font-semibold uppercase tracking-wide">
              Select Shape
            </p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(SHAPE_TYPES) as ShapeType[]).map((shape) => {
                const st = SHAPE_TYPES[shape];
                const isSelected = selectedShape === shape;
                return (
                  <button
                    key={shape}
                    onClick={() => setSelectedShape(shape)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-amber-500 bg-amber-500/20 text-amber-300'
                        : 'border-slate-600 bg-slate-800/40 text-slate-300 hover:border-slate-500 hover:bg-slate-800/60'
                    }`}
                    type="button"
                  >
                    <span className="text-base leading-none">{st.emoji}</span>
                    <span>{st.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleAddShape} disabled={placing}>
            {placing ? 'Click ground to place…' : 'Add Shape'}
          </Button>
          <Button onClick={handleClear} variant="outline" className="border-slate-700 text-slate-200">
            Clear
          </Button>
          <p className="text-xs text-slate-500">
            Choose a material + shape, click “Add Shape”, then click the ground to place it.
          </p>
        </div>
      </div>
    </Card>
  );
}
