import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { age } from '../engine/age.js';
import { getPalette } from '../engine/palette.js';

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform float uAge;
  uniform float uHorizonHeight;
  uniform vec2 uResolution;
  uniform vec3 uColorBg;
  uniform vec3 uColorFog;
  uniform vec3 uColorFog2;

  varying vec2 vUv;

  // 2D gradient noise
  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
  }

  float gnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(
      mix(dot(hash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
          dot(hash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
      mix(dot(hash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
          dot(hash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  // 3-octave FBM for low fragment cost & soft billowy fog
  float fbm3(vec2 p) {
    float v = 0.0;
    float a = 0.55;
    for (int i = 0; i < 3; i++) {
      v += a * (0.5 + 0.5 * gnoise(p));
      p = p * 2.04 + vec2(1.27, 2.61);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uResolution.x / max(uResolution.y, 1.0);
    vec2 aspectUv = vec2(uv.x * aspect, uv.y);

    // Slow drifting vectors for fog bands
    vec2 drift1 = vec2(uTime * 0.015, uTime * 0.007);
    vec2 drift2 = vec2(-uTime * 0.011, uTime * 0.009);

    // 1. Fog Band 1 (mid-lower billow, tinted with stop.fog)
    float n1 = fbm3(aspectUv * 0.85 - drift1);
    float band1Shape = smoothstep(0.04, 0.48, uv.y) * smoothstep(0.96, 0.36, uv.y);
    float fog1 = n1 * band1Shape;

    // 2. Fog Band 2 (upper-mid billow, tinted with stop.fog2)
    float n2 = fbm3(aspectUv * 0.70 + drift2 + vec2(3.4, 1.8));
    float band2Shape = smoothstep(0.20, 0.70, uv.y) * smoothstep(1.0, 0.55, uv.y);
    float fog2 = n2 * band2Shape;

    // 3. Soft Horizon: large curved band near bottom
    // Height is uniform uHorizonHeight (low at age 0, rising to ~35% of screen height at age 1)
    float curve = (sin(uv.x * 3.14159265) - 0.5) * 0.06;
    float horizonY = uHorizonHeight + curve;
    float distH = uv.y - horizonY;

    // Soft radiance around the horizon
    float horizonGlow = 0.0;
    if (distH >= 0.0) {
      horizonGlow = exp(-distH * 4.2);
    } else {
      horizonGlow = exp(distH * 6.5);
    }

    // 4. Color composition
    // Base colour is stop.bg
    vec3 col = uColorBg;

    // Soft fog bands
    col = mix(col, uColorFog, clamp(fog1 * 0.80, 0.0, 1.0));
    col = mix(col, uColorFog2, clamp(fog2 * 0.65, 0.0, 1.0));

    // Horizon light
    vec3 horizonLight = mix(uColorFog, uColorFog2, 0.45);
    col = mix(col, horizonLight, clamp(horizonGlow * 0.85, 0.0, 1.0));

    // Fine dither to eliminate 8-bit banding
    float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * (1.0 / 255.0);
    col += dither;

    gl_FragColor = vec4(col, 1.0);
  }
`;

export default function Background() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    let animationFrameId;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    const startTime = performance.now();
    const initialPalette = getPalette(age.value);

    const material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uAge: { value: age.value },
        uHorizonHeight: { value: 0.08 + 0.27 * age.value },
        uResolution: { value: new THREE.Vector2(width, height) },
        uColorBg: { value: new THREE.Vector3(initialPalette.bg.r, initialPalette.bg.g, initialPalette.bg.b) },
        uColorFog: { value: new THREE.Vector3(initialPalette.fog.r, initialPalette.fog.g, initialPalette.fog.b) },
        uColorFog2: { value: new THREE.Vector3(initialPalette.fog2.r, initialPalette.fog2.g, initialPalette.fog2.b) }
      },
      depthWrite: false,
      depthTest: false
    });

    const geometry = new THREE.PlaneGeometry(2, 2);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;

      renderer.setSize(w, h);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      material.uniforms.uResolution.value.set(w, h);
    };

    window.addEventListener('resize', onResize);

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const currentTime = performance.now();
      material.uniforms.uTime.value = (currentTime - startTime) * 0.001;
      material.uniforms.uAge.value = age.value;

      // Horizon height: ~0.08 at age 0, rising to ~0.35 at age 1
      material.uniforms.uHorizonHeight.value = 0.08 + 0.27 * age.value;

      // Update colors from OKLCH palette lock
      const p = getPalette(age.value);
      material.uniforms.uColorBg.value.set(p.bg.r, p.bg.g, p.bg.b);
      material.uniforms.uColorFog.value.set(p.fog.r, p.fog.g, p.fog.b);
      material.uniforms.uColorFog2.value.set(p.fog2.r, p.fog2.g, p.fog2.b);

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);

      geometry.dispose();
      material.dispose();
      renderer.dispose();

      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none -z-10" />;
}
