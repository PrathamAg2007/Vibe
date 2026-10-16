import { memo, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { useGLTF } from '@react-three/drei';
import { age } from '../engine/age.js';
import { getPalette } from '../engine/palette.js';
import {
  registerControls,
  unregisterControls,
  registerAstronautTester,
  unregisterAstronautTester
} from '../engine/input.js';
import { getLevel } from '../engine/audio.js';

// 1. Preload GLB via useGLTF
useGLTF.preload('/models/astronaut.glb');

const PARTICLE_COUNT = 40000;

// Preallocated color buffer to avoid per-frame allocations in render loop
let lastCalculatedAge = -1;
const preallocatedParticleColor = [0, 0, 0];

function updateParticleColorAtAge(ageVal, targetVec3) {
  if (Math.abs(ageVal - lastCalculatedAge) < 0.0001) {
    targetVec3.set(preallocatedParticleColor[0], preallocatedParticleColor[1], preallocatedParticleColor[2]);
    return;
  }
  lastCalculatedAge = ageVal;
  const p = getPalette(ageVal);
  preallocatedParticleColor[0] = p.particle.r;
  preallocatedParticleColor[1] = p.particle.g;
  preallocatedParticleColor[2] = p.particle.b;
  targetVec3.set(p.particle.r, p.particle.g, p.particle.b);
}

// 2. Module-level cached geometry to ensure computing & sampling runs ONCE across StrictMode
let cachedGeometry = null;
let geometryPromise = null;

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
          if (child.isMesh) {
            if (child.material) {
              const materials = Array.isArray(child.material) ? child.material : [child.material];
              materials.forEach((mat) => {
                [
                  'map', 'roughnessMap', 'metalnessMap', 'normalMap',
                  'bumpMap', 'displacementMap', 'alphaMap', 'aoMap',
                  'emissiveMap', 'lightMap', 'envMap'
                ].forEach((mapProp) => {
                  if (mat[mapProp]) {
                    mat[mapProp].dispose();
                    mat[mapProp] = null;
                  }
                });
                mat.dispose();
              });
            }
            if (child.geometry) {
              const cloned = child.geometry.clone();
              cloned.applyMatrix4(child.matrixWorld);
              geometries.push(cloned);
            }
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
  uniform float uAudio;
  uniform float uModelHeight;

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
    // 1. Assembled model motion (age drift, sag, and nod) - only computed when assembling / assembled
    vec3 assembledPos = position;
    if (uAssemble > 0.0001) {
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

      assembledPos = position + driftMotion * currentAmp;

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
    }

    // 2. Scattered state (before entry, almost still)
    vec3 scatterCoord = aScatter * 0.25 + vec3(uTime * 0.03) + aRandom * 0.5;
    vec3 scatterNoise;
    if (uAssemble == 0.0) {
      // Exactly 2 octaves / noise evaluations while scattered at the gate screen
      float n1 = snoise(scatterCoord);
      float n2 = snoise(scatterCoord + vec3(23.4));
      scatterNoise = vec3(n1, n2, n1 * 0.5 - n2 * 0.5);
    } else {
      scatterNoise = vec3(
        snoise(scatterCoord),
        snoise(scatterCoord + vec3(23.4)),
        snoise(scatterCoord + vec3(54.1))
      );
    }
    vec3 scatteredPos = aScatter + scatterNoise * 0.04;

    // Assembly interpolation: 0 to 1 with slight natural particle stagger
    float stagger = aRandom.x * 0.25;
    float assembleT = smoothstep(stagger, stagger + 0.75, uAssemble);
    vec3 finalPos = mix(scatteredPos, assembledPos, assembleT);

    // Subtle outward pulse: ~1.5% of model height * uAudio when assembled
    finalPos += aNormal * (0.015 * uModelHeight * uAudio * assembleT);

    // 3. Shading: directional light (top-left-front) + faint rim term + per-particle brightness
    vec3 normalView = normalize(normalMatrix * aNormal);
    vec3 lightDir = normalize(vec3(-0.45, 0.75, 0.50));
    float diff = max(0.0, dot(normalView, lightDir));
    float vDotN = max(0.0, dot(normalView, vec3(0.0, 0.0, 1.0)));
    float rim = pow(1.0 - vDotN, 2.5);

    float ambient = 0.38;
    float modelLight = (ambient + 0.62 * diff + 0.22 * rim) * aBrightness;
    float lightIntensity = mix(0.85 * aBrightness, modelLight, assembleT);
    lightIntensity *= (1.0 + 0.22 * uAudio);

    // Particle color comes from palette uniform (interpolated in OKLab)
    vColor = uParticleColor * lightIntensity;
    vAlpha = mix(0.93, 0.98, uAge);

    vec4 mvPosition = modelViewMatrix * vec4(finalPos, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    // 1. Particle size: ~3px at age 0, ~2px at age 1 at 1080p, with per-particle size variation
    float targetPx = mix(3.0, 2.0, uAge) * aSizeMult * (1.0 + 0.35 * uAudio);
    float dist = -mvPosition.z;
    gl_PointSize = (targetPx * (uBaseDistance / dist)) * (uPixelRatio / 1.5);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    // 2. Round point with narrow soft edge only (smoothstep between 0.42 and 0.5 on distance from centre)
    float dist = length(gl_PointCoord - vec2(0.5));
    if (dist > 0.5) {
      discard;
    }
    float edgeAlpha = 1.0 - smoothstep(0.42, 0.5, dist);

    // Opaque-ish, normal blending, NOT additive
    gl_FragColor = vec4(vColor, vAlpha * edgeAlpha);
  }
`;

function AstronautParticles({ hasEntered = false, onReady }) {
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

    let animationFrameId;
    let isDisposed = false;
    let firstFrameFired = false;

    // 1. Scene setup
    const scene = new THREE.Scene();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    // 5. Canvas: gl={{ antialias: false, powerPreference: 'high-performance' }}
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    // dpr={[1, 1.5]}
    const dpr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);
    renderer.setPixelRatio(dpr);
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // 2. OrbitControls with slow auto-rotation, zoom & pan disabled
    // Default enabled = false (enabled ONLY while pointer press owner is 'astronaut')
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minDistance = 2.0;
    controls.maxDistance = 14.0;
    controls.target.set(0, 0, 0);
    controls.enabled = false;
    controls.update();

    registerControls(controls);

    // Astronaut screen-space region tester (projected bounding box shrunk by 10%, ellipse test)
    const corners = [
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(),
      new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()
    ];
    const scratchProj = new THREE.Vector3();

    function isPointInsideAstronaut(px, py) {
      if (isDisposed || !geometry || !geometry.boundingBox || !camera) return false;
      const min = geometry.boundingBox.min;
      const max = geometry.boundingBox.max;

      corners[0].set(min.x, min.y, min.z);
      corners[1].set(max.x, min.y, min.z);
      corners[2].set(min.x, max.y, min.z);
      corners[3].set(max.x, max.y, min.z);
      corners[4].set(min.x, min.y, max.z);
      corners[5].set(max.x, min.y, max.z);
      corners[6].set(min.x, max.y, max.z);
      corners[7].set(max.x, max.y, max.z);

      const w = window.innerWidth;
      const h = window.innerHeight;

      let minX = Infinity, maxX = -Infinity;
      let minY = Infinity, maxY = -Infinity;

      for (let i = 0; i < 8; i++) {
        scratchProj.copy(corners[i]).project(camera);
        const sx = (scratchProj.x * 0.5 + 0.5) * w;
        const sy = (-scratchProj.y * 0.5 + 0.5) * h;
        if (sx < minX) minX = sx;
        if (sx > maxX) maxX = sx;
        if (sy < minY) minY = sy;
        if (sy > maxY) maxY = sy;
      }

      const cx = (minX + maxX) * 0.5;
      const cy = (minY + maxY) * 0.5;
      const rx = (maxX - minX) * 0.5 * 0.90; // shrunk by about 10 percent
      const ry = (maxY - minY) * 0.5 * 0.90;

      if (rx <= 0 || ry <= 0) return false;

      const dx = px - cx;
      const dy = py - cy;
      return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0;
    }

    registerAstronautTester(isPointInsideAstronaut);

    // 3. Shader material with uAssemble, uNod, and uParticleColor
    const startTime = performance.now();
    const initialColor = new THREE.Vector3();
    updateParticleColorAtAge(age.value, initialColor);

    // Points material: depthWrite: false
    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uAge: { value: age.value },
        uPixelRatio: { value: dpr },
        uBaseDistance: { value: 6.5 },
        uAssemble: { value: hasEnteredRef.current ? 1.0 : 0.0 },
        uNod: { value: 0.0 },
        uParticleColor: { value: initialColor },
        uAudio: { value: 0.0 },
        uModelHeight: { value: 2.2 }
      },
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    let pointsObject = null;
    let geometry = null;
    const preallocatedBoxSize = new THREE.Vector3();

    // Load or retrieve precomputed geometry
    getOrSampleGeometry()
      .then((geo) => {
        if (isDisposed) return;
        geometry = geo;

        // Fit camera distance from bounding box
        if (geometry.boundingBox) {
          geometry.boundingBox.getSize(preallocatedBoxSize);
          const fovRad = (camera.fov * Math.PI) / 180;
          const fovTan = Math.tan(fovRad / 2);
          const dV = (preallocatedBoxSize.y / 2) / fovTan * 1.35;
          const dH = (preallocatedBoxSize.x / 2) / (fovTan * camera.aspect) * 1.35;
          const fitDist = Math.max(dV, dH);
          camera.position.set(0, 0, fitDist);
          controls.minDistance = fitDist * 0.5;
          controls.maxDistance = fitDist * 2.5;
          controls.update();
          material.uniforms.uBaseDistance.value = fitDist;
          material.uniforms.uModelHeight.value = preallocatedBoxSize.y;
        }

        pointsObject = new THREE.Points(geometry, material);
        pointsObject.matrixAutoUpdate = false;
        pointsObject.frustumCulled = false;
        scene.add(pointsObject);
      })
      .catch((err) => {
        if (!isDisposed) {
          console.error('Failed to load particle geometry:', err);
        }
      });

    // Handle resize
    const onResize = () => {
      if (isDisposed || !container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      const pr = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);
      renderer.setPixelRatio(pr);
      material.uniforms.uPixelRatio.value = pr;

      if (geometry && geometry.boundingBox) {
        geometry.boundingBox.getSize(preallocatedBoxSize);
        const fovRad = (camera.fov * Math.PI) / 180;
        const fovTan = Math.tan(fovRad / 2);
        const dV = (preallocatedBoxSize.y / 2) / fovTan * 1.35;
        const dH = (preallocatedBoxSize.x / 2) / (fovTan * camera.aspect) * 1.35;
        const fitDist = Math.max(dV, dH);
        material.uniforms.uBaseDistance.value = fitDist;
      }
    };

    window.addEventListener('resize', onResize);

    // 4. Exactly one animation loop: check isDisposed at top, no allocations
    const animate = () => {
      if (isDisposed) return;
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      material.uniforms.uTime.value = (currentTime - startTime) * 0.001;
      material.uniforms.uAge.value = age.value;
      material.uniforms.uAudio.value = getLevel();

      // Update particle color via in-place mutation without allocations
      updateParticleColorAtAge(age.value, material.uniforms.uParticleColor.value);

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

      // Notify ready after particle geometry is present and first frame has rendered
      if (!firstFrameFired && pointsObject) {
        firstFrameFired = true;
        if (onReadyRef.current) {
          onReadyRef.current();
        }
      }
    };

    animate();

    // Cleanup on unmount
    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);

      unregisterControls();
      unregisterAstronautTester();
      controls.dispose();
      material.dispose();

      if (pointsObject) {
        scene.remove(pointsObject);
        pointsObject = null;
      }

      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full min-h-screen overflow-hidden select-none bg-[var(--page-bg)]">
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

export default memo(AstronautParticles);
