import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useGLTF } from '@react-three/drei';
import { age } from '../engine/age.js';
import { STOPS } from '../engine/palette.js';

// 1. Preload GLB via useGLTF
useGLTF.preload('/models/astronaut.glb');

const PARTICLE_COUNT = 40000;

/* OKLab interpolation helpers */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}

function rgbToOklab(r, g, b) {
  const lr = r > 0.04045 ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  const lg = g > 0.04045 ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  const lb = b > 0.04045 ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return [
    0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
  ];
}

function oklabToRgb(L, a, b) {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.2914855480 * b;
  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;
  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s;
  const gamma = (c) => (c > 0.0031308 ? 1.055 * Math.pow(Math.max(0, c), 1 / 2.4) - 0.055 : 12.92 * Math.max(0, c));
  return [
    Math.min(1, Math.max(0, gamma(lr))),
    Math.min(1, Math.max(0, gamma(lg))),
    Math.min(1, Math.max(0, gamma(lb)))
  ];
}

const OK_STOPS = STOPS.map((s) => ({
  at: s.at,
  bg: rgbToOklab(...hexToRgb(s.bg)),
  particle: rgbToOklab(...hexToRgb(s.particle))
}));

function getPaletteAtAge(ageVal) {
  const a = Math.max(0, Math.min(1, ageVal));
  let i = 0;
  while (i < OK_STOPS.length - 1 && OK_STOPS[i + 1].at < a) {
    i++;
  }
  const s0 = OK_STOPS[i];
  const s1 = OK_STOPS[Math.min(i + 1, OK_STOPS.length - 1)];
  const range = s1.at - s0.at;
  const t = range > 0.0001 ? (a - s0.at) / range : 0;

  const bgOk = [
    s0.bg[0] + (s1.bg[0] - s0.bg[0]) * t,
    s0.bg[1] + (s1.bg[1] - s0.bg[1]) * t,
    s0.bg[2] + (s1.bg[2] - s0.bg[2]) * t
  ];
  const particleOk = [
    s0.particle[0] + (s1.particle[0] - s0.particle[0]) * t,
    s0.particle[1] + (s1.particle[1] - s0.particle[1]) * t,
    s0.particle[2] + (s1.particle[2] - s0.particle[2]) * t
  ];

  const bgRgb = oklabToRgb(...bgOk);
  const particleRgb = oklabToRgb(...particleOk);

  return {
    bg: bgRgb,
    particle: particleRgb
  };
}

// 2. Module-level cached geometry to ensure computing & sampling runs ONCE
let cachedGeometry = null;
let geometryPromise = null;
let activeInstances = 0;

function getOrSampleGeometry() {
  if (cachedGeometry) {
    return Promise.resolve(cachedGeometry);
  }
  if (geometryPromise) {
    return geometryPromise;
  }

  geometryPromise = new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.load(
      '/models/astronaut.glb',
      (gltf) => {
        const geometries = [];
        gltf.scene.updateMatrixWorld(true);

        gltf.scene.traverse((child) => {
          if (child.isMesh && child.geometry) {
            const cloned = child.geometry.clone();
            cloned.applyMatrix4(child.matrixWorld);
            geometries.push(cloned);
          }
        });

        if (geometries.length === 0) {
          reject(new Error('No meshes found in astronaut.glb'));
          return;
        }

        const mergedGeometry =
          geometries.length > 1
            ? BufferGeometryUtils.mergeGeometries(geometries, false)
            : geometries[0];

        const tempMesh = new THREE.Mesh(mergedGeometry);
        const sampler = new MeshSurfaceSampler(tempMesh).build();

        const positions = new Float32Array(PARTICLE_COUNT * 3);
        const scatterPositions = new Float32Array(PARTICLE_COUNT * 3);
        const normals = new Float32Array(PARTICLE_COUNT * 3);
        const aRandom = new Float32Array(PARTICLE_COUNT * 3);
        const aSizeMult = new Float32Array(PARTICLE_COUNT);
        const aWander = new Float32Array(PARTICLE_COUNT);
        const aBrightness = new Float32Array(PARTICLE_COUNT);

        const tempPos = new THREE.Vector3();
        const tempNormal = new THREE.Vector3();

        for (let i = 0; i < PARTICLE_COUNT; i++) {
          sampler.sample(tempPos, tempNormal);
          tempNormal.normalize();

          positions[i * 3 + 0] = tempPos.x;
          positions[i * 3 + 1] = tempPos.y;
          positions[i * 3 + 2] = tempPos.z;

          // Scattered initial positions before entry
          const u = Math.random();
          const v = Math.random();
          const radius = 1.2 + 4.6 * Math.sqrt(u);
          const angle = v * Math.PI * 2;
          const spreadY = (Math.random() - 0.5) * 5.2;
          const spreadZ = (Math.random() - 0.5) * 3.6;

          scatterPositions[i * 3 + 0] = Math.cos(angle) * radius * 1.35;
          scatterPositions[i * 3 + 1] = spreadY;
          scatterPositions[i * 3 + 2] = spreadZ;

          normals[i * 3 + 0] = tempNormal.x;
          normals[i * 3 + 1] = tempNormal.y;
          normals[i * 3 + 2] = tempNormal.z;

          aRandom[i * 3 + 0] = (Math.random() - 0.5) * 2.0;
          aRandom[i * 3 + 1] = (Math.random() - 0.5) * 2.0;
          aRandom[i * 3 + 2] = (Math.random() - 0.5) * 2.0;

          aSizeMult[i] = 0.6 + Math.random() * 0.8;
          aWander[i] = Math.random() < 0.08 ? 1.9 + Math.random() * 0.5 : 1.0;
          aBrightness[i] = 0.85 + Math.random() * 0.15;
        }

        geometries.forEach((g) => g.dispose());
        if (mergedGeometry && mergedGeometry !== geometries[0]) {
          mergedGeometry.dispose();
        }

        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aScatter', new THREE.BufferAttribute(scatterPositions, 3));
        geo.setAttribute('aNormal', new THREE.BufferAttribute(normals, 3));
        geo.setAttribute('aRandom', new THREE.BufferAttribute(aRandom, 3));
        geo.setAttribute('aSizeMult', new THREE.BufferAttribute(aSizeMult, 1));
        geo.setAttribute('aWander', new THREE.BufferAttribute(aWander, 1));
        geo.setAttribute('aBrightness', new THREE.BufferAttribute(aBrightness, 1));
        geo.center();
        geo.computeBoundingBox();

        cachedGeometry = geo;
        resolve(geo);
      },
      undefined,
      (err) => {
        geometryPromise = null;
        reject(err);
      }
    );
  });

  return geometryPromise;
}

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAge;
  uniform float uPixelRatio;
  uniform float uBaseDistance;
  uniform float uAssemble;
  uniform float uNod;
  uniform vec3 uParticleColor;

  attribute vec3 aScatter;
  attribute vec3 aNormal;
  attribute vec3 aRandom;
  attribute float aSizeMult;
  attribute float aWander;
  attribute float aBrightness;

  varying vec3 vColor;
  varying float vAlpha;

  // Simplex 3D noise
  vec4 permute(vec4 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));

    vec3 ns = 0.142857142857 * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);

    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);

    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  void main() {
    // 1. Assembled model motion (age drift, sag, and nod)
    vec3 noiseCoord = position * 0.40 + vec3(uTime * 0.16) + aRandom * 1.5;
    vec3 noiseVec = vec3(
      snoise(noiseCoord),
      snoise(noiseCoord + vec3(43.12)),
      snoise(noiseCoord + vec3(117.73))
    );

    vec3 driftMotion = noiseVec + vec3(0.0, 0.20, 0.0);

    float age0Amp = 0.201 * aWander;
    float age1Amp = 0.012;
    float currentAmp = mix(age0Amp, age1Amp, uAge);

    vec3 assembledPos = position + driftMotion * currentAmp;

    // Downward sag on lower body at age 1
    float lowerBodySag = smoothstep(0.3, -1.6, position.y);
    float sag = uAge * 0.10 * lowerBodySag;
    assembledPos.y -= sag;

    // Slow nod (pitch forward around neck pivot)
    if (uNod > 0.0001) {
      float nodWeight = smoothstep(0.0, 1.6, assembledPos.y);
      float angle = uNod * nodWeight;
      float cosA = cos(angle);
      float sinA = sin(angle);
      float py = assembledPos.y - 0.7;
      float pz = assembledPos.z;
      assembledPos.y = 0.7 + (py * cosA - pz * sinA);
      assembledPos.z = py * sinA + pz * cosA;
    }

    // 2. Scattered state (before entry, almost still)
    vec3 scatterCoord = aScatter * 0.25 + vec3(uTime * 0.03) + aRandom * 0.5;
    vec3 scatterNoise = vec3(
      snoise(scatterCoord),
      snoise(scatterCoord + vec3(23.4)),
      snoise(scatterCoord + vec3(54.1))
    );
    vec3 scatteredPos = aScatter + scatterNoise * 0.04;

    // Assembly interpolation: 0 to 1 with slight natural particle stagger
    float stagger = aRandom.x * 0.25;
    float assembleT = smoothstep(stagger, stagger + 0.75, uAssemble);
    vec3 finalPos = mix(scatteredPos, assembledPos, assembleT);

    // 3. Shading: directional light (top-left-front) + faint rim term + per-particle brightness
    vec3 normalView = normalize(normalMatrix * aNormal);
    vec3 lightDir = normalize(vec3(-0.45, 0.75, 0.50));
    float diff = max(0.0, dot(normalView, lightDir));
    float vDotN = max(0.0, dot(normalView, vec3(0.0, 0.0, 1.0)));
    float rim = pow(1.0 - vDotN, 2.5);

    float ambient = 0.38;
    float modelLight = (ambient + 0.62 * diff + 0.22 * rim) * aBrightness;
    float lightIntensity = mix(0.85 * aBrightness, modelLight, assembleT);

    // Particle color comes from palette uniform (interpolated in OKLab)
    vColor = uParticleColor * lightIntensity;
    vAlpha = mix(0.93, 0.98, uAge);

    // 4. Projection & size attenuation
    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float basePx = mix(3.0, 2.0, uAge) * aSizeMult;
    gl_PointSize = max(1.0, basePx * (uBaseDistance / -mvPosition.z) * uPixelRatio);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    // Round point with narrow soft edge only (smoothstep between 0.42 and 0.5)
    float edge = 1.0 - smoothstep(0.42, 0.5, dist);
    gl_FragColor = vec4(vColor, edge * vAlpha);
  }
`;

export default function AstronautParticles({ hasEntered = false, onReady }) {
  const mountRef = useRef(null);
  const hasEnteredRef = useRef(hasEntered);
  const assembleStartTimeRef = useRef(null);
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    hasEnteredRef.current = hasEntered;
    if (hasEntered && assembleStartTimeRef.current === null) {
      assembleStartTimeRef.current = performance.now();
    }
  }, [hasEntered]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    activeInstances++;
    let animationFrameId;
    let isDisposed = false;
    let firstFrameFired = false;

    // 1. Scene setup
    const scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    // 5. Cap devicePixelRatio at 1.5
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 2. OrbitControls with slow auto-rotation
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.minDistance = 2.0;
    controls.maxDistance = 14.0;
    controls.target.set(0, 0, 0);
    controls.update();

    // 3. Shader material with uAssemble, uNod, and uParticleColor
    const initialPalette = getPaletteAtAge(age.value);
    const startTime = performance.now();

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uAge: { value: age.value },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 1.5) },
        uBaseDistance: { value: 6.5 },
        uAssemble: { value: hasEnteredRef.current ? 1.0 : 0.0 },
        uNod: { value: 0.0 },
        uParticleColor: {
          value: new THREE.Vector3(
            initialPalette.particle[0],
            initialPalette.particle[1],
            initialPalette.particle[2]
          )
        }
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    let pointsObject = null;
    let geometry = null;

    // Load or retrieve precomputed geometry
    getOrSampleGeometry()
      .then((geo) => {
        if (isDisposed) return;
        geometry = geo;

        // Fit camera distance from bounding box
        const box = geo.boundingBox;
        const boxSize = new THREE.Vector3();
        box.getSize(boxSize);

        const fovRad = (camera.fov * Math.PI) / 180;
        const fovTan = Math.tan(fovRad / 2);
        const aspect = camera.aspect || width / height;
        const marginFactor = 1.35;

        const distVert = (boxSize.y / 2) / fovTan * marginFactor;
        const distHoriz = (boxSize.x / 2) / (fovTan * aspect) * marginFactor;
        const fitDistance = Math.max(distVert, distHoriz);

        camera.position.set(0, 0, fitDistance);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);
        controls.minDistance = fitDistance * 0.4;
        controls.maxDistance = fitDistance * 2.5;
        controls.update();

        material.uniforms.uBaseDistance.value = fitDistance;

        pointsObject = new THREE.Points(geo, material);
        scene.add(pointsObject);
      })
      .catch((err) => {
        console.error('Failed to load astronaut geometry:', err);
      });

    // 4. Handle resizing
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;

      camera.aspect = w / h;
      camera.updateProjectionMatrix();

      renderer.setSize(w, h);
      const pr = Math.min(window.devicePixelRatio, 1.5);
      renderer.setPixelRatio(pr);
      material.uniforms.uPixelRatio.value = pr;

      if (geometry && geometry.boundingBox) {
        const boxSize = new THREE.Vector3();
        geometry.boundingBox.getSize(boxSize);
        const fovRad = (camera.fov * Math.PI) / 180;
        const fovTan = Math.tan(fovRad / 2);
        const dV = (boxSize.y / 2) / fovTan * 1.35;
        const dH = (boxSize.x / 2) / (fovTan * camera.aspect) * 1.35;
        const fitDist = Math.max(dV, dH);
        material.uniforms.uBaseDistance.value = fitDist;
      }
    };

    window.addEventListener('resize', onResize);

    // 5. Animation loop: 60fps, no React state allocations on frame
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      material.uniforms.uTime.value = (currentTime - startTime) * 0.001;
      material.uniforms.uAge.value = age.value;

      // Update particle color from OKLab interpolated palette
      const currentPal = getPaletteAtAge(age.value);
      material.uniforms.uParticleColor.value.set(
        currentPal.particle[0],
        currentPal.particle[1],
        currentPal.particle[2]
      );

      // Handle assembly & slow nod
      if (assembleStartTimeRef.current !== null) {
        const elapsed = (currentTime - assembleStartTimeRef.current) * 0.001;
        const assembleProg = Math.min(1.0, elapsed / 2.5);
        material.uniforms.uAssemble.value = assembleProg;

        // Slow nod from 2.2s to 3.8s
        let nod = 0.0;
        if (elapsed >= 2.2 && elapsed <= 3.8) {
          const nodT = (elapsed - 2.2) / 1.6;
          nod = Math.sin(nodT * Math.PI) * 0.12;
        }
        material.uniforms.uNod.value = nod;
      } else {
        material.uniforms.uAssemble.value = hasEnteredRef.current ? 1.0 : 0.0;
        material.uniforms.uNod.value = 0.0;
      }

      controls.update();
      renderer.render(scene, camera);

      // 3. Notify ready after particle geometry is present and first frame has rendered
      if (!firstFrameFired && pointsObject) {
        firstFrameFired = true;
        if (onReadyRef.current) {
          onReadyRef.current();
        }
      }
    };

    animate();

    // 6. Cleanup on unmount
    return () => {
      isDisposed = true;
      activeInstances--;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);

      controls.dispose();
      material.dispose();

      if (pointsObject) {
        scene.remove(pointsObject);
      }

      // Dispose cached geometry when no active instances remain
      if (activeInstances <= 0 && cachedGeometry) {
        cachedGeometry.dispose();
        cachedGeometry = null;
        geometryPromise = null;
      }

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden select-none bg-[var(--page-bg)]">
      <div ref={mountRef} className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
}
