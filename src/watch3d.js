import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

// Global scene variables
let scene, camera, renderer, composer;
let watchModel = null;
let pmremGenerator;
let bokehPass;

// Watch component groups
let groupGears, groupPlates, groupFace, groupHands, groupCasing, groupStrap, groupGlass;
let gearsList = []; // store references to gears to animate their rotation
let balanceWheel = null;

// Animation settings
let currentProgress = 0;
let targetProgress = 0;

// Mouse interaction (parallax tilt)
let mouseX = 0;
let mouseY = 0;
let targetMouseX = 0;
let targetMouseY = 0;

// Interactive click & drag to rotate
let isDragging = false;
let previousMousePosition = { x: 0, y: 0 };
let dragRotationX = 0;
let dragRotationY = 0;

// Reusable Vector to prevent Garbage Collection allocation lags
const lookAtVector = new THREE.Vector3(0, 0, 0);

// Keyframe configurations for smooth watch position, rotation, and camera paths
const keyframesX = [
  { p: 0.0, val: 0.0 },    // Hero: Center
  { p: 0.125, val: 0.32 }, // Philosophy: Watch on the right (text left)
  { p: 0.25, val: -0.32 }, // Craftsmanship: Watch on the left (text right)
  { p: 0.375, val: 0.0 },  // Collections: Center (grid)
  { p: 0.5, val: -0.32 },  // Materials: Watch on the left (text right)
  { p: 0.625, val: 0.0 },  // Precision: Center (metrics)
  { p: 0.75, val: 0.32 },  // Experience: Watch on the right (timeline left)
  { p: 0.875, val: 0.0 },  // Testimonials: Center
  { p: 1.0, val: 0.0 }     // CTA: Center
];

const keyframesRotY = [
  { p: 0.0, val: 0.0 },    // Hero: Face-front
  { p: 0.125, val: 0.4 },  // Philosophy: Elegant slight angle to see gear depth
  { p: 0.25, val: 0.0 },   // Craftsmanship: Gears flat facing camera
  { p: 0.375, val: -0.4 }, // Collections: Face/hands angled
  { p: 0.5, val: 1.1 },    // Materials: Gold/titanium case side profile view
  { p: 0.625, val: -0.3 }, // Precision: Angled
  { p: 0.75, val: 0.3 },   // Experience: Angled
  { p: 0.875, val: 0.0 },  // Testimonials: Face-front
  { p: 1.0, val: 0.0 }     // CTA: Face-front
];

const keyframesRotX = [
  { p: 0.0, val: 0.08 },   // Hero: Slight tilt forward for reflections
  { p: 0.125, val: 0.12 }, // Philosophy: Tilted
  { p: 0.25, val: 0.02 },  // Craftsmanship: Nearly flat to focus on teeth
  { p: 0.375, val: 0.12 }, // Collections: Tilted
  { p: 0.5, val: 0.05 },   // Materials
  { p: 0.625, val: 0.15 }, // Precision
  { p: 0.75, val: 0.1 },   // Experience
  { p: 0.875, val: 0.08 }, // Testimonials
  { p: 1.0, val: 0.08 }    // CTA
];

const keyframesCamX = [
  { p: 0.0, val: 0.0 },
  { p: 0.125, val: 0.08 },
  { p: 0.25, val: -0.08 },
  { p: 0.375, val: 0.0 },
  { p: 0.5, val: -0.08 },
  { p: 0.625, val: 0.0 },
  { p: 0.75, val: 0.1 },
  { p: 0.875, val: 0.0 },
  { p: 1.0, val: 0.0 }
];

const keyframesCamY = [
  { p: 0.0, val: 0.05 },
  { p: 0.125, val: 0.05 },
  { p: 0.25, val: -0.04 },
  { p: 0.375, val: 0.08 },
  { p: 0.5, val: 0.0 },
  { p: 0.625, val: 0.05 },
  { p: 0.75, val: 0.02 },
  { p: 0.875, val: 0.08 },
  { p: 1.0, val: 0.08 }
];

const keyframesCamZ = [
  { p: 0.0, val: 2.3 },    // Hero: Large watch view
  { p: 0.125, val: 1.95 }, // Philosophy: Closer to layers
  { p: 0.25, val: 1.35 },  // Craftsmanship: Macro gears shot
  { p: 0.375, val: 1.85 }, // Collections: Medium view
  { p: 0.5, val: 2.05 },   // Materials
  { p: 0.625, val: 2.2 },  // Precision
  { p: 0.75, val: 2.05 },  // Experience
  { p: 0.875, val: 2.35 }, // Testimonials
  { p: 1.0, val: 2.45 }    // CTA
];

// Helper to interpolate keyframe values smoothly based on progress
function getInterpolatedValue(keyframes, progress) {
  if (progress <= keyframes[0].p) return keyframes[0].val;
  if (progress >= keyframes[keyframes.length - 1].p) return keyframes[keyframes.length - 1].val;
  
  for (let i = 0; i < keyframes.length - 1; i++) {
    const k1 = keyframes[i];
    const k2 = keyframes[i + 1];
    if (progress >= k1.p && progress <= k2.p) {
      const t = (progress - k1.p) / (k2.p - k1.p);
      const smoothT = t * t * (3 - 2 * t); // cubic ease
      return THREE.MathUtils.lerp(k1.val, k2.val, smoothT);
    }
  }
  return 0;
}

// Initialize 3D Scene
export function init3D(onProgress, onLoadCallback) {
  const container = document.getElementById('canvas-container');
  const canvas = document.getElementById('watch-canvas');

  // 1. Create Scene
  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070b14, 0.05); // Midnight navy fog matching the new dark blue layout

  // 2. Create Camera
  camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.set(0, 0.05, 2.3);

  // 3. Create Renderer (Capped pixel ratio to 1.5 for performance)
  renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance"
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  
  pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  // 4. Post-processing Chain
  const renderPass = new RenderPass(scene, camera);
  
  // Bloom configured for soft, elegant glints
  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.28,
    0.45,
    0.90
  );

  // Bokeh (Depth of Field) Pass
  bokehPass = new BokehPass(scene, camera, {
    focus: 2.3,
    aperture: 0.015,
    maxblur: 0.008,
    width: window.innerWidth,
    height: window.innerHeight
  });

  composer = new EffectComposer(renderer);
  composer.addPass(renderPass);
  composer.addPass(bloomPass);
  composer.addPass(bokehPass);

  // 5. Lighting Setup
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
  scene.add(ambientLight);

  const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.3);
  keyLight.position.set(5, 5, 4);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xe8f0ff, 0.6);
  fillLight.position.set(-5, 3, 2);
  scene.add(fillLight);

  const rimLight = new THREE.DirectionalLight(0xC8A96A, 1.2);
  rimLight.position.set(0, -5, -3);
  scene.add(rimLight);

  // 6. Setup Component Groups
  groupGears = new THREE.Group();
  groupPlates = new THREE.Group();
  groupFace = new THREE.Group();
  groupHands = new THREE.Group();
  groupCasing = new THREE.Group();
  groupStrap = new THREE.Group();
  groupGlass = new THREE.Group();

  scene.add(groupGears);
  scene.add(groupPlates);
  scene.add(groupFace);
  scene.add(groupHands);
  scene.add(groupCasing);
  scene.add(groupStrap);
  scene.add(groupGlass);

  // Initialize procedural gears
  setupProceduralMovement();

  // 7. Load Assets
  let assetsLoaded = 0;
  const totalAssets = 2;

  function checkProgress() {
    assetsLoaded++;
    const percent = Math.round((assetsLoaded / totalAssets) * 100);
    if (onProgress) onProgress(percent);
    
    if (assetsLoaded === totalAssets) {
      updateAssembly(0);
      if (onLoadCallback) onLoadCallback();
      animate();
    }
  }

  // Load HDR Map
  const rgbeLoader = new RGBELoader();
  rgbeLoader.load('/textures/venice_sunset_1k.hdr', (texture) => {
    const envMap = pmremGenerator.fromEquirectangular(texture).texture;
    scene.environment = envMap;
    texture.dispose();
    pmremGenerator.dispose();
    checkProgress();
  }, undefined, (err) => {
    console.error('Failed to load HDR environment map:', err);
    checkProgress();
  });

  // Load GLB Watch Model
  const gltfLoader = new GLTFLoader();
  gltfLoader.load('/models/ChronographWatch.glb', (gltf) => {
    watchModel = gltf.scene;
    watchModel.scale.set(7.5, 7.5, 7.5);

    watchModel.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;

        if (child.material) {
          child.material.roughness = Math.min(child.material.roughness, 0.35);
          child.material.metalness = Math.max(child.material.metalness, 0.7);
        }

        const name = child.name.toLowerCase();

        if (name.includes('glass') || name.includes('crystal')) {
          child.material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.2,
            roughness: 0.05,
            metalness: 0.0,
            transmission: 0.95,
            ior: 1.45,
            thickness: 0.1,
            clearcoat: 1.0,
            clearcoatRoughness: 0.05
          });
          groupGlass.add(child.clone());
        } 
        else if (name.includes('face') || name.includes('dial')) {
          child.material.roughness = 0.5;
          child.material.metalness = 0.1;
          groupFace.add(child.clone());
        } 
        else if (name.includes('hand')) {
          child.material.roughness = 0.1;
          child.material.metalness = 0.9;
          if (child.material.color) child.material.color.setHex(0xC8A96A);
          groupHands.add(child.clone());
        } 
        else if (name.includes('band') || name.includes('strap') || name.includes('clasp')) {
          if (name.includes('clasp')) {
            child.material.metalness = 0.8;
            child.material.roughness = 0.25;
          } else {
            child.material.metalness = 0.2;
            child.material.roughness = 0.85;
            if (child.material.color) child.material.color.setHex(0x131313);
          }
          groupStrap.add(child.clone());
        } 
        else {
          child.material.roughness = 0.15;
          child.material.metalness = 0.95;
          if (name.includes('bezel') || name.includes('button') || name.includes('crown')) {
            if (child.material.color) child.material.color.setHex(0xC8A96A);
          }
          groupCasing.add(child.clone());
        }
      }
    });

    watchModel.visible = false;
    scene.add(watchModel);

    // Apply scaling on groups
    const groups = [groupGlass, groupFace, groupHands, groupStrap, groupCasing];
    groups.forEach(g => {
      g.scale.set(7.5, 7.5, 7.5);
    });

    checkProgress();
  }, undefined, (err) => {
    console.error('Failed to load GLB model:', err);
    checkProgress();
  });

  // 8. Event Listeners
  window.addEventListener('resize', onWindowResize);
  window.addEventListener('mousemove', onMouseMove);
  
  // Drag to rotate listeners
  window.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('touchstart', onTouchStart, { passive: true });
  window.addEventListener('touchend', onTouchEnd, { passive: true });
  window.addEventListener('touchmove', onTouchMove, { passive: true });
}

// Procedural Movement Generation (Gears, Balance Wheel)
function setupProceduralMovement() {
  const metalGold = new THREE.MeshStandardMaterial({
    color: 0xC8A96A,
    metalness: 0.95,
    roughness: 0.18,
    name: 'ProceduralGold'
  });

  const metalSteel = new THREE.MeshStandardMaterial({
    color: 0xcccccc,
    metalness: 0.9,
    roughness: 0.12,
    name: 'ProceduralSteel'
  });

  const rubyMat = new THREE.MeshStandardMaterial({
    color: 0xe6005c,
    roughness: 0.05,
    metalness: 0.1,
    transmission: 0.6,
    transparent: true,
    opacity: 0.8,
    name: 'ProceduralRuby'
  });

  const plateGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.01, 32);
  const plateMesh = new THREE.Mesh(plateGeo, metalSteel);
  plateMesh.rotation.x = Math.PI / 2;
  plateMesh.position.z = -0.05;
  groupPlates.add(plateMesh);

  function createGear(innerR, outerR, thick, teeth, mat, x, y, z, rotSpeed) {
    const shape = new THREE.Shape();
    const angleStep = (Math.PI * 2) / teeth;

    for (let i = 0; i < teeth; i++) {
      const angle = i * angleStep;
      
      let r = innerR;
      let px = Math.cos(angle - angleStep * 0.25) * r;
      let py = Math.sin(angle - angleStep * 0.25) * r;
      if (i === 0) shape.moveTo(px, py);
      else shape.lineTo(px, py);

      r = outerR;
      px = Math.cos(angle - angleStep * 0.1) * r;
      py = Math.sin(angle - angleStep * 0.1) * r;
      shape.lineTo(px, py);

      px = Math.cos(angle + angleStep * 0.1) * r;
      py = Math.sin(angle + angleStep * 0.1) * r;
      shape.lineTo(px, py);

      r = innerR;
      px = Math.cos(angle + angleStep * 0.25) * r;
      py = Math.sin(angle + angleStep * 0.25) * r;
      shape.lineTo(px, py);
    }
    
    const holePath = new THREE.Path();
    holePath.absarc(0, 0, innerR * 0.3, 0, Math.PI * 2, true);
    shape.holes.push(holePath);

    const extrudeSettings = {
      depth: thick,
      bevelEnabled: true,
      bevelSegments: 1,
      steps: 1,
      bevelSize: 0.003,
      bevelThickness: 0.003
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();

    const gearMesh = new THREE.Mesh(geometry, mat);
    gearMesh.position.set(x, y, z);
    groupGears.add(gearMesh);

    gearsList.push({ mesh: gearMesh, speed: rotSpeed });
    return gearMesh;
  }

  createGear(0.12, 0.15, 0.015, 24, metalGold, 0, 0, -0.03, 0.004);
  createGear(0.08, 0.10, 0.015, 16, metalSteel, 0.13, 0.08, -0.03, -0.006);
  createGear(0.04, 0.06, 0.012, 10, metalGold, 0.07, -0.11, -0.025, -0.0096);
  createGear(0.06, 0.08, 0.01, 15, metalGold, -0.08, 0.09, -0.025, 0.008);

  const rubyGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.008, 16);
  const rubyPositions = [
    [0, 0, -0.02],
    [0.13, 0.08, -0.02],
    [0.07, -0.11, -0.018],
    [-0.08, 0.09, -0.018]
  ];

  rubyPositions.forEach(pos => {
    const ruby = new THREE.Mesh(rubyGeo, rubyMat);
    ruby.rotation.x = Math.PI / 2;
    ruby.position.set(pos[0], pos[1], pos[2]);
    groupPlates.add(ruby);
  });

  const balanceGroup = new THREE.Group();
  balanceGroup.position.set(-0.05, -0.07, -0.01);

  const rimGeo = new THREE.TorusGeometry(0.08, 0.008, 12, 32);
  const rimMesh = new THREE.Mesh(rimGeo, metalGold);
  balanceGroup.add(rimMesh);

  const spokeGeo = new THREE.BoxGeometry(0.16, 0.008, 0.004);
  for (let i = 0; i < 3; i++) {
    const spoke = new THREE.Mesh(spokeGeo, metalGold);
    spoke.rotation.z = (Math.PI / 3) * i;
    balanceGroup.add(spoke);
  }

  const staffGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.03, 16);
  const staff = new THREE.Mesh(staffGeo, metalSteel);
  staff.rotation.x = Math.PI / 2;
  staff.position.z = -0.005;
  balanceGroup.add(staff);

  const spiralPoints = [];
  const loops = 4.5;
  const maxR = 0.045;
  const segments = 64;
  
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * (Math.PI * 2 * loops);
    const r = (i / segments) * maxR;
    const px = Math.cos(theta) * r;
    const py = Math.sin(theta) * r;
    spiralPoints.push(new THREE.Vector3(px, py, -0.005));
  }
  
  const spiralGeo = new THREE.BufferGeometry().setFromPoints(spiralPoints);
  const spiralMat = new THREE.LineBasicMaterial({ color: 0xB7BCC4, linewidth: 2 });
  const hairspring = new THREE.Line(spiralGeo, spiralMat);
  balanceGroup.add(hairspring);

  groupGears.add(balanceGroup);
  balanceWheel = balanceGroup;
}

// Update scroll progress
export function updateProgress(val) {
  targetProgress = val;
}

// Interactive Rotation Drag Event Handlers
function onMouseDown(e) {
  if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a') || e.target.closest('button')) {
    return;
  }
  isDragging = true;
  previousMousePosition = { x: e.clientX, y: e.clientY };
}

function onMouseUp() {
  isDragging = false;
}

function onTouchStart(e) {
  if (e.touches.length === 1) {
    const touch = e.touches[0];
    if (touch.target.tagName === 'A' || touch.target.tagName === 'BUTTON' || touch.target.closest('a') || touch.target.closest('button')) {
      return;
    }
    isDragging = true;
    previousMousePosition = { x: touch.clientX, y: touch.clientY };
  }
}

function onTouchEnd() {
  isDragging = false;
}

function onTouchMove(e) {
  if (isDragging && e.touches.length === 1) {
    const touch = e.touches[0];
    const deltaX = touch.clientX - previousMousePosition.x;
    const deltaY = touch.clientY - previousMousePosition.y;

    dragRotationY += deltaX * 0.006;
    dragRotationX += deltaY * 0.006;

    previousMousePosition = { x: touch.clientX, y: touch.clientY };
  }
}

function onMouseMove(e) {
  targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
  targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;

  if (isDragging) {
    const deltaX = e.clientX - previousMousePosition.x;
    const deltaY = e.clientY - previousMousePosition.y;

    dragRotationY += deltaX * 0.005;
    dragRotationX += deltaY * 0.005;

    previousMousePosition = { x: e.clientX, y: e.clientY };
  }
}

// Handle window resizing
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  
  if (bokehPass) {
    bokehPass.setSize(window.innerWidth, window.innerHeight);
  }
}

// Unified Assembly and Camera Path driven by Keyframes
// Now implements the "Zero-Gravity Floating components" scenario: all parts are visible
// from the very beginning, spread out in space, and merge dynamically upon scrolling.
function updateAssembly(val) {
  // Ensure all parts are visible from the start for the "Zero-Gravity" floating look
  groupGears.visible = true;
  groupPlates.visible = true;
  groupFace.visible = true;
  groupHands.visible = true;
  groupCasing.visible = true;
  groupStrap.visible = true;
  groupGlass.visible = true;

  // Assembly slide calculations (Z-depths slide into exactly 0.0 at assembly thresholds)
  // Each part resolves smoothly into position as we scroll down to its threshold.
  const tGlass = Math.min(val / 0.92, 1.0);     // Glass locks last (92%)
  const tHands = Math.min(val / 0.84, 1.0);     // Hands snap next (84%)
  const tFace = Math.min(val / 0.78, 1.0);      // Face/dial slides in (78%)
  const tCasing = Math.min(val / 0.72, 1.0);    // Outer casing snaps (72%)
  const tStrap = Math.min(val / 0.65, 1.0);     // Straps join (65%)
  const tPlates = Math.min(val / 0.58, 1.0);    // Movement plates slide (58%)
  const tGears = Math.min(val / 0.48, 1.0);     // Internal gears align first (48%)

  // Base assembly positions
  const baseZ_Glass = THREE.MathUtils.lerp(2.2, 0.0, tGlass);
  const baseZ_Hands = THREE.MathUtils.lerp(1.5, 0.0, tHands);
  const baseZ_Face = THREE.MathUtils.lerp(0.9, 0.0, tFace);
  const baseZ_Casing = THREE.MathUtils.lerp(1.4, 0.0, tCasing);
  
  const baseY_Strap = THREE.MathUtils.lerp(0.9, 0.0, tStrap);
  const baseZ_Strap = THREE.MathUtils.lerp(-0.4, 0.0, tStrap);
  
  const baseZ_Plates = THREE.MathUtils.lerp(-1.0, 0.0, tPlates);
  const baseZ_Gears = THREE.MathUtils.lerp(-0.3, 0.0, tGears);

  // --- ZERO-GRAVITY ORGANIC DRIFT ---
  // Slow, floating oscillation representing zero-gravity hovering at Hero (val = 0)
  // The drift completely decays to 0.0 by progress = 0.85
  const driftIntensity = 1.0 - Math.min(val / 0.85, 1.0);
  const time = performance.now() * 0.001; // Get time in seconds

  const driftGlassZ = Math.sin(time * 0.6) * 0.06 * driftIntensity;
  const driftGlassY = Math.cos(time * 0.45) * 0.03 * driftIntensity;
  
  const driftHandsZ = Math.sin(time * 0.5 + 1.2) * 0.04 * driftIntensity;
  const driftHandsX = Math.cos(time * 0.4 + 0.8) * 0.03 * driftIntensity;
  
  const driftFaceZ = Math.sin(time * 0.4 + 2.4) * 0.03 * driftIntensity;
  const driftFaceY = Math.cos(time * 0.5 + 1.6) * 0.02 * driftIntensity;
  
  const driftCasingZ = Math.sin(time * 0.3 + 3.6) * 0.04 * driftIntensity;
  const driftCasingX = Math.cos(time * 0.4 + 2.0) * 0.02 * driftIntensity;
  
  const driftStrapY = Math.sin(time * 0.4 + 4.8) * 0.04 * driftIntensity;
  const driftStrapZ = Math.cos(time * 0.35 + 2.4) * 0.03 * driftIntensity;
  
  const driftPlatesZ = Math.sin(time * 0.48 + 6.0) * 0.02 * driftIntensity;
  
  const driftGearsZ = Math.sin(time * 0.55 + 7.2) * 0.015 * driftIntensity;

  // Apply positions: Base assembly position + organic float drift
  groupGlass.position.z = baseZ_Glass + driftGlassZ;
  groupGlass.position.y = driftGlassY;

  groupHands.position.z = baseZ_Hands + driftHandsZ;
  groupHands.position.x = driftHandsX;

  groupFace.position.z = baseZ_Face + driftFaceZ;
  groupFace.position.y = driftFaceY;

  groupCasing.position.z = baseZ_Casing + driftCasingZ;
  groupCasing.position.x = driftCasingX;

  groupStrap.position.y = baseY_Strap + driftStrapY;
  groupStrap.position.z = baseZ_Strap + driftStrapZ;

  groupPlates.position.z = baseZ_Plates + driftPlatesZ;
  
  groupGears.position.z = baseZ_Gears + driftGearsZ;

  // Reset helper scales
  const helperScale = 7.5;
  groupGlass.scale.set(helperScale, helperScale, helperScale);
  groupHands.scale.set(helperScale, helperScale, helperScale);
  groupFace.scale.set(helperScale, helperScale, helperScale);
  groupCasing.scale.set(helperScale, helperScale, helperScale);
  groupStrap.scale.set(helperScale, helperScale, helperScale);
  groupPlates.scale.set(helperScale, helperScale, helperScale);
  groupGears.scale.set(helperScale, helperScale, helperScale);

  // 2. SMOOTH POSITION & ROTATION KEYFRAMING
  const watchPosX = getInterpolatedValue(keyframesX, val);
  const watchRotY = getInterpolatedValue(keyframesRotY, val);
  const watchRotX = getInterpolatedValue(keyframesRotX, val);

  // Apply group positioning and coordinate click-and-drag rotation
  const groups = [groupGears, groupPlates, groupFace, groupHands, groupCasing, groupStrap, groupGlass];
  groups.forEach(g => {
    // Add layout displacement X
    g.position.x += (watchPosX - g.position.x) * 0.1; 
    g.rotation.y = watchRotY + dragRotationY;
    g.rotation.x = watchRotX + dragRotationX;
  });

  // 3. SMOOTH CAMERA KEYFRAMING
  const camX = getInterpolatedValue(keyframesCamX, val);
  const camY = getInterpolatedValue(keyframesCamY, val);
  const camZ = getInterpolatedValue(keyframesCamZ, val);

  camera.position.set(camX, camY, camZ);
  
  // Update depth of field focus to match camera Z distance (keeps center sharp!)
  if (bokehPass) {
    bokehPass.uniforms['focus'].value = camZ;
  }
  
  lookAtVector.set(watchPosX, 0, 0);
  camera.lookAt(lookAtVector);
}

// Frame Animation Loop
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const elapsedTime = clock.getElapsedTime();

  // 1. Continuous mechanical movement (gears ticking)
  gearsList.forEach(item => {
    item.mesh.rotation.z += item.speed;
  });

  if (balanceWheel) {
    balanceWheel.rotation.z = Math.sin(elapsedTime * Math.PI * 4) * 0.75;
  }

  // 2. Interpolate scroll progress smoothly
  currentProgress += (targetProgress - currentProgress) * 0.09;
  updateAssembly(currentProgress);

  // 3. Decay drag rotation back to 0 when user releases touch/mouse
  if (!isDragging) {
    dragRotationX += (0 - dragRotationX) * 0.08;
    dragRotationY += (0 - dragRotationY) * 0.08;
  }

  // 4. Mouse parallax tilt (soft interaction when static on Hero or CTA)
  mouseX += (targetMouseX - mouseX) * 0.06;
  mouseY += (targetMouseY - mouseY) * 0.06;

  const mouseTiltX = mouseY * 0.05;
  const mouseTiltY = mouseX * 0.05;

  if (currentProgress < 0.02 || currentProgress > 0.98) {
    const ambientRot = elapsedTime * 0.015;
    const groups = [groupGears, groupPlates, groupFace, groupHands, groupCasing, groupStrap, groupGlass];
    groups.forEach(g => {
      g.rotation.x += mouseTiltX;
      g.rotation.y += mouseTiltY + ambientRot;
    });
  }

  // 5. Post-processing Render
  composer.render();
}
