import { useEffect, useRef, useState } from 'react';
import { Loader2, AlertCircle, RotateCw, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

interface ThreeJsLearningProps {
  sceneType?: string;
  onInteractionComplete?: () => void;
}

/**
 * Three.js Learning Component
 * Interactive 3D visualizations for hands-on learning
 * Supports: Geometric shapes, molecular models, 3D data visualization
 */
export function ThreeJsLearning({ sceneType = 'default', onInteractionComplete }: ThreeJsLearningProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactionCount, setInteractionCount] = useState(0);
  const sceneRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    const loadThreeJS = async () => {
      try {
        setIsLoading(true);
        setError(null);

        if (canvasRef.current) {
          const sceneData = initializeScene(canvasRef.current, sceneType, () => {
            setInteractionCount(prev => prev + 1);
            if (interactionCount >= 5) {
              onInteractionComplete?.();
            }
          });
          sceneRef.current = sceneData.sceneObject;
          controlsRef.current = sceneData.controls;
        }

        setIsLoading(false);
      } catch (err) {
        console.error('Failed to initialize 3D scene:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize 3D scene');
        setIsLoading(false);
      }
    };

    loadThreeJS();

    return () => {
      // Cleanup
      if (sceneRef.current) {
        sceneRef.current.dispose?.();
      }
    };
  }, [sceneType, onInteractionComplete, interactionCount]);

  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
        <span className="ml-3 text-slate-300">Initializing 3D scene...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="bg-red-500/10 border border-red-500/30 p-6">
        <div className="flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-red-400 mt-1 flex-shrink-0" />
          <div>
            <h4 className="font-semibold text-red-300 mb-1">Error Loading 3D Scene</h4>
            <p className="text-sm text-red-200 mb-2">{error}</p>
            <p className="text-xs text-red-300 font-mono bg-red-950/50 p-2 rounded">
              Scene Type: {sceneType || 'default'}
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative bg-slate-900 border border-slate-700 rounded-lg overflow-hidden group">
        <canvas 
          ref={canvasRef} 
          className="w-full h-96 block relative z-0 cursor-grab active:cursor-grabbing outline-none focus:outline-none hover:shadow-lg transition-shadow"
          tabIndex={0}
        />
        
        {/* Controls Overlay */}
        <div className="absolute top-4 right-4 flex gap-2 z-20 pointer-events-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleReset}
            className="bg-slate-800/80 border-slate-600 hover:bg-slate-700"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Instructions - Non-interactive overlay */}
        <div className="absolute bottom-4 left-4 bg-slate-900/80 border border-slate-600 rounded px-3 py-2 text-xs text-slate-300 pointer-events-none max-w-xs">
          <p className="mb-1">🖱️ <strong>Left click + drag:</strong> Rotate</p>
          <p className="mb-1">🖱️ <strong>Right click + drag:</strong> Pan</p>
          <p>🔍 <strong>Scroll:</strong> Zoom | Interactions: {interactionCount}/5</p>
        </div>
      </div>

      {/* Learning Panel */}
      <Card className="bg-slate-800/50 border border-slate-700 p-4">
        <div className="space-y-3">
          <h3 className="font-semibold text-slate-200">Learning Insights</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 mb-1">Rotation</p>
              <p className="text-slate-200 font-semibold">Explore 360°</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 mb-1">Zoom Level</p>
              <p className="text-slate-200 font-semibold">Adjust View</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 mb-1">Properties</p>
              <p className="text-slate-200 font-semibold">Dimensions</p>
            </div>
            <div className="bg-slate-700/50 p-3 rounded">
              <p className="text-slate-400 mb-1">Interactions</p>
              <p className="text-slate-200 font-semibold">{interactionCount}/5</p>
            </div>
          </div>

          {interactionCount >= 5 && (
            <div className="bg-green-500/10 border border-green-500/30 rounded p-3">
              <p className="text-sm text-green-300">
                ✓ Great exploration! You've interacted with the 3D scene enough. You can move to the next phase.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}


/**
 * Initialize Three.js scene with interactive 3D objects
 */
function initializeScene(
  canvas: HTMLCanvasElement,
  sceneType: string,
  onInteraction: () => void
) {
  try {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 50, 100);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      canvas.clientWidth / canvas.clientHeight,
      0.1,
      1000
    );
    camera.position.z = 5;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;

    console.log('✅ Three.js scene initialized successfully');

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    scene.add(directionalLight);

    // Create interactive objects based on scene type
    createSceneObjects(scene, sceneType, THREE);

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 2;

    // Track interactions
    let interactionTracker = 0;
    
    const onMouseDown = () => {
      console.log('🖱️ Mouse down detected');
      interactionTracker++;
      console.log(`Interaction count: ${interactionTracker}`);
      if (interactionTracker % 5 === 0) {
        console.log('✅ Interaction milestone reached!');
        onInteraction();
      }
    };

    const onWheel = (e: WheelEvent) => {
      console.log('🔍 Scroll detected');
      e.preventDefault();
      interactionTracker++;
      console.log(`Interaction count: ${interactionTracker}`);
      if (interactionTracker % 5 === 0) {
        console.log('✅ Interaction milestone reached!');
        onInteraction();
      }
    };

    const onTouchStart = () => {
      console.log('👆 Touch detected');
      interactionTracker++;
      if (interactionTracker % 5 === 0) {
        onInteraction();
      }
    };

    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('touchstart', onTouchStart);

    // Animation loop
    let animationId: number;
    function animate() {
      animationId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    }

    animate();

    // Window resize handler
    const handleResize = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }

    window.addEventListener('resize', handleResize);

    // Store references for cleanup
    const sceneObject = { 
      dispose: () => {
        console.log('🧹 Cleaning up Three.js scene');
        cancelAnimationFrame(animationId);
        window.removeEventListener('resize', handleResize);
        canvas.removeEventListener('mousedown', onMouseDown);
        canvas.removeEventListener('wheel', onWheel);
        canvas.removeEventListener('touchstart', onTouchStart);
        renderer.dispose();
      }
    };

    return { scene, camera, renderer, controls, sceneObject };
  } catch (error) {
    console.error('❌ Error initializing Three.js scene:', error);
    throw error;
  }
}

/**
 * Create interactive 3D objects based on scene type
 */
function createSceneObjects(scene: any, sceneType: string, THREE: any) {
  switch (sceneType) {
    case 'geometry-explorer':
      createGeometryScene(scene, THREE);
      break;
    case 'molecule':
      createMoleculeScene(scene, THREE);
      break;
    case 'architecture':
      createArchitectureScene(scene, THREE);
      break;
    default:
      createDefaultScene(scene, THREE);
  }
}

/**
 * Create interactive geometry shapes
 */
function createGeometryScene(scene: any, THREE: any) {
  // Cube
  const cubeGeometry = new THREE.BoxGeometry(1.5, 1.5, 1.5);
  const cubeMaterial = new THREE.MeshPhongMaterial({ color: 0x6366f1, shininess: 100 });
  const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
  cube.position.x = -2;
  cube.castShadow = true;
  scene.add(cube);

  // Sphere
  const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);
  const sphereMaterial = new THREE.MeshPhongMaterial({ color: 0x06b6d4, shininess: 100 });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  sphere.position.x = 0;
  sphere.castShadow = true;
  scene.add(sphere);

  // Cone
  const coneGeometry = new THREE.ConeGeometry(1, 2, 32);
  const coneMaterial = new THREE.MeshPhongMaterial({ color: 0x8b5cf6, shininess: 100 });
  const cone = new THREE.Mesh(coneGeometry, coneMaterial);
  cone.position.x = 2;
  cone.castShadow = true;
  scene.add(cone);

  // Ground plane
  const planeGeometry = new THREE.PlaneGeometry(10, 10);
  const planeMaterial = new THREE.MeshPhongMaterial({ color: 0x1e293b });
  const plane = new THREE.Mesh(planeGeometry, planeMaterial);
  plane.rotation.x = -Math.PI / 2;
  plane.position.y = -2;
  plane.receiveShadow = true;
  scene.add(plane);
}

/**
 * Create molecule-like structure
 */
function createMoleculeScene(scene: any, THREE: any) {
  const atoms: any[] = [];
  const bonds: any[] = [];

  // Create atoms
  for (let i = 0; i < 5; i++) {
    const geometry = new THREE.SphereGeometry(0.4, 32, 32);
    const material = new THREE.MeshPhongMaterial({
      color: new THREE.Color().setHSL(Math.random(), 0.7, 0.5)
    });
    const atom = new THREE.Mesh(geometry, material);
    atom.position.set(
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5,
      (Math.random() - 0.5) * 5
    );
    atom.castShadow = true;
    scene.add(atom);
    atoms.push(atom);
  }

  // Create bonds between atoms
  for (let i = 0; i < atoms.length - 1; i++) {
    const points = [atoms[i].position, atoms[i + 1].position];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: 0x64748b, linewidth: 2 });
    const bond = new THREE.Line(geometry, material);
    scene.add(bond);
    bonds.push(bond);
  }
}

/**
 * Create architectural structure
 */
function createArchitectureScene(scene: any, THREE: any) {
  // Building blocks
  const materials = [
    new THREE.MeshPhongMaterial({ color: 0xef4444 }),
    new THREE.MeshPhongMaterial({ color: 0x3b82f6 }),
    new THREE.MeshPhongMaterial({ color: 0x10b981 })
  ];

  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 5; j++) {
      const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const material = materials[Math.floor(Math.random() * materials.length)];
      const block = new THREE.Mesh(geometry, material);
      block.position.set(i * 1 - 2, j * 1 - 2, 0);
      block.castShadow = true;
      scene.add(block);
    }
  }
}

/**
 * Create default interactive scene
 */
function createDefaultScene(scene: any, THREE: any) {
  // Create a simple rotating torus knot
  const geometry = new THREE.TorusKnotGeometry(1, 0.4, 100, 16);
  const material = new THREE.MeshPhongMaterial({
    color: 0x9333ea,
    shininess: 100
  });
  const torusKnot = new THREE.Mesh(geometry, material);
  torusKnot.castShadow = true;
  scene.add(torusKnot);

  // Add wireframe overlay
  const wireframeGeometry = new THREE.TorusKnotGeometry(1, 0.4, 100, 16);
  const wireframeMaterial = new THREE.LineBasicMaterial({
    color: 0x64748b,
    opacity: 0.2
  });
  const wireframe = new THREE.LineSegments(
    new THREE.EdgesGeometry(wireframeGeometry),
    wireframeMaterial
  );
  scene.add(wireframe);
}
