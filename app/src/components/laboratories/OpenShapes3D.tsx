import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';


const SHAPE_TYPES = {
  cube:        { name: 'Cube',        emoji: '◼️' },
  sphere:      { name: 'Sphere',      emoji: '⚪' },
  cylinder:    { name: 'Cylinder',    emoji: '🟠' },
  cone:        { name: 'Cone',        emoji: '🔺' },
  torus:       { name: 'Torus',       emoji: '🌀' },
  tetrahedron: { name: 'Tetrahedron', emoji: '🔻' },
  octahedron:  { name: 'Octahedron',  emoji: '⯁' },
  dodecahedron:{ name: 'Dodecahedron',emoji: '⬟' },
  icosahedron: { name: 'Icosahedron', emoji: '⯃' },
} as const;
type ShapeType = keyof typeof SHAPE_TYPES;

export function OpenShapes3D({ onInteractionComplete }: { onInteractionComplete?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedShape, setSelectedShape] = useState<ShapeType>('cube');
  const [placing, setPlacing] = useState(false);
  const [shapes, setShapes] = useState<any[]>([]);
  const [thickness, setThickness] = useState(1);
  const [height, setHeight] = useState(1);

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
        const mesh = createMesh(selectedShape, thickness, height);
        // Y offset so bottom sits on ground
        let y = 0;
        switch (selectedShape) {
          case 'cube':
            y = height / 2;
            break;
          case 'sphere':
            y = thickness / 2;
            break;
          case 'cylinder':
            y = height / 2;
            break;
          case 'cone':
            y = height / 2;
            break;
          default:
            y = 0.5;
        }
        mesh.position.copy(point);
        mesh.position.y = y;
        setShapes(prev => [...prev, { mesh, type: selectedShape, thickness, height }]);
        setPlacing(false);
        if (onInteractionComplete) onInteractionComplete();
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
  }, [shapes, placing, thickness, height, selectedShape]);

  function createMesh(shape: ShapeType, thickness: number, height: number) {
    let geo: THREE.BufferGeometry;
    switch (shape) {
      case 'cube':
        geo = new THREE.BoxGeometry(thickness, height, thickness);
        break;
      case 'sphere':
        geo = new THREE.SphereGeometry(thickness / 2, 32, 32);
        break;
      case 'cylinder':
        geo = new THREE.CylinderGeometry(thickness / 2, thickness / 2, height, 32);
        break;
      case 'cone':
        geo = new THREE.ConeGeometry(thickness / 2, height, 32);
        break;
      case 'torus':
        geo = new THREE.TorusGeometry(thickness / 2, Math.max(0.1, thickness / 6), 24, 48);
        break;
      case 'tetrahedron':
        geo = new THREE.TetrahedronGeometry(thickness / 1.2);
        break;
      case 'octahedron':
        geo = new THREE.OctahedronGeometry(thickness / 1.1);
        break;
      case 'dodecahedron':
        geo = new THREE.DodecahedronGeometry(thickness / 1.1);
        break;
      case 'icosahedron':
        geo = new THREE.IcosahedronGeometry(thickness / 1.1);
        break;
      default:
        geo = new THREE.BoxGeometry(thickness, height, thickness);
    }
    const mat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.65, metalness: 0.1 });
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
    <div className="space-y-4">
      <div className="mb-2 p-4 bg-amber-100/80 border border-amber-300 rounded text-amber-900 text-center font-semibold text-base shadow-sm">
        Create and explore your own 3D world—add cubes, spheres, cones, and custom objects, then rotate, resize, and play with them in a fully responsive interactive space.
      </div>
      <div className="relative bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
        <canvas
          ref={canvasRef}
          className="w-full h-[480px] block cursor-crosshair outline-none"
          tabIndex={0}
        />
        <div className="absolute top-3 right-3 flex gap-2 z-10">
          <Button size="sm" variant="destructive" onClick={handleClear} className="bg-red-800/80 border-red-700 hover:bg-red-700 text-xs px-2 py-1 h-8" title="Clear Canvas">Clear</Button>
        </div>
        <div className="absolute bottom-3 left-3 bg-slate-900/80 border border-slate-600/50 rounded px-3 py-2 text-xs text-slate-300 pointer-events-none">
          <p>🖱️ <strong>Click ground</strong> to place shape &nbsp;|&nbsp; <strong>Drag</strong> to rotate view</p>
          <p>🔍 <strong>Scroll</strong> to zoom &nbsp;|&nbsp; <strong>Right-drag</strong> to pan</p>
        </div>
      </div>
      <Card className="bg-slate-800/60 border-slate-700 p-4">
        <p className="text-xs text-slate-400 mb-3 font-semibold uppercase tracking-wide">Select Shape</p>
        <div className="flex flex-wrap gap-2 mb-4">
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
        <div className="flex items-center gap-4 mb-4">
          <label className="text-xs text-slate-400 font-semibold">Thickness</label>
          <input type="range" min={0.2} max={3} step={0.05} value={thickness} onChange={e => setThickness(Number(e.target.value))} className="w-32" />
          <span className="text-xs text-slate-200">{thickness.toFixed(2)}</span>
        </div>
        {(['cube','cylinder','cone'].includes(selectedShape)) && (
          <div className="flex items-center gap-4 mb-4">
            <label className="text-xs text-slate-400 font-semibold">Height</label>
            <input type="range" min={0.2} max={3} step={0.05} value={height} onChange={e => setHeight(Number(e.target.value))} className="w-32" />
            <span className="text-xs text-slate-200">{height.toFixed(2)}</span>
          </div>
        )}
        <Button onClick={handleAddShape} disabled={placing} className="mt-2">{placing ? 'Click ground to place...' : 'Add Shape'}</Button>
        <p className="text-xs text-slate-500 mt-3">Select a shape and adjust its thickness (and height), then click "Add Shape" and place it on the ground.</p>
      </Card>
    </div>
  );
}
