import * as THREE from 'three';

// Shared wave field: identical math on CPU (ship buoyancy) and GPU (ocean mesh).
// [dirX, dirZ, amplitude, wavelength]
export const WAVES = [
  [1.0, 0.35, 1.05, 46],
  [0.55, 1.0, 0.62, 27],
  [-0.45, 0.9, 0.34, 15],
  [0.95, -0.4, 0.2, 9],
];
const W = WAVES.map(([x, z, a, l]) => {
  const n = Math.hypot(x, z), k = (2 * Math.PI) / l;
  return { dx: x / n, dz: z / n, a, k, w: Math.sqrt(9.8 * k) };
});

export function waveHeight(x, z, t) {
  let h = 0;
  for (const v of W) h += v.a * Math.sin(v.k * (v.dx * x + v.dz * z) - v.w * t);
  return h;
}

export const FOG_COLOR = new THREE.Color(0x2c3742);

export function createOcean(quality) {
  const size = quality === 'low' ? 700 : 900;
  const seg = quality === 'low' ? 140 : 260;
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uWaves: { value: W.map(v => new THREE.Vector4(v.dx, v.dz, v.a, v.k)) },
    uSun: { value: new THREE.Vector3(-0.35, 0.55, 0.75).normalize() },
    uFogColor: { value: FOG_COLOR.clone() },
    uFogDensity: { value: 0.0042 },
    uFlash: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      uniform float uTime; uniform vec4 uWaves[4];
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vFogDepth;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = 0.0; vec2 g = vec2(0.0);
        for (int i = 0; i < 4; i++) {
          vec2 d = uWaves[i].xy; float a = uWaves[i].z; float k = uWaves[i].w;
          float ph = k * dot(d, wp.xz) - sqrt(9.8 * k) * uTime;
          h += a * sin(ph); g += a * k * cos(ph) * d;
        }
        wp.y = h; vH = h;
        vNormal = normalize(vec3(-g.x, 1.0, -g.y));
        vWorld = wp.xyz;
        vec4 mv = viewMatrix * wp; vFogDepth = -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uSun; uniform vec3 uFogColor; uniform float uFogDensity; uniform float uFlash;
      varying vec3 vWorld; varying vec3 vNormal; varying float vH; varying float vFogDepth;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      void main() {
        vec3 n = vNormal;
        vec2 p = vWorld.xz;
        // fine ripples
        n.x += (noise(p * 0.35 + uTime * 0.6) - 0.5) * 0.35 + sin(p.x * 1.3 + uTime * 2.1) * 0.05;
        n.z += (noise(p * 0.35 - uTime * 0.5 + 17.0) - 0.5) * 0.35 + sin(p.y * 1.1 - uTime * 1.7) * 0.05;
        n = normalize(n);
        vec3 V = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, V), 0.0), 4.0);
        vec3 deep = vec3(0.012, 0.045, 0.06);
        vec3 shallow = vec3(0.05, 0.16, 0.18);
        vec3 col = mix(deep, shallow, clamp(vH * 0.3 + 0.45, 0.0, 1.0));
        float diff = max(dot(n, uSun), 0.0);
        col *= 0.55 + 0.6 * diff;
        vec3 skyRef = mix(vec3(0.09, 0.12, 0.15), vec3(0.22, 0.27, 0.31), clamp(reflect(-V, n).y * 2.0, 0.0, 1.0));
        col = mix(col, skyRef, 0.15 + fres * 0.7);
        vec3 H = normalize(uSun + V);
        col += vec3(0.9, 0.85, 0.75) * pow(max(dot(n, H), 0.0), 160.0) * 0.6;
        // crest foam
        float fn = noise(p * 0.22 + uTime * 0.2) * 0.8 + noise(p * 0.9) * 0.4;
        float foam = smoothstep(1.45, 2.3, vH + fn * 0.55) + smoothstep(0.82, 0.95, noise(p * 0.6 + uTime * 0.3)) * 0.12;
        col = mix(col, vec3(0.7, 0.76, 0.78), clamp(foam, 0.0, 1.0) * 0.6);
        col += uFlash * vec3(0.35, 0.4, 0.5) * (0.3 + fres);
        float fog = 1.0 - exp(-uFogDensity * uFogDensity * vFogDepth * vFogDepth);
        gl_FragColor = vec4(mix(col, uFogColor * (1.0 + uFlash * 1.5), fog), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.userData.step = size / seg;
  return { mesh, uniforms };
}

export function createSky() {
  const geo = new THREE.SphereGeometry(1000, 32, 16);
  const uniforms = { uTime: { value: 0 }, uFlash: { value: 0 }, uFogColor: { value: FOG_COLOR.clone() } };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform float uFlash; uniform vec3 uFogColor; varying vec3 vDir;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
      void main(){
        vec3 d = normalize(vDir);
        float y = max(d.y, 0.0);
        vec3 top = vec3(0.03, 0.04, 0.055);
        vec3 col = mix(uFogColor, top, pow(y, 0.55));
        vec2 uv = d.xz / (d.y + 0.25) * 1.6 + vec2(uTime * 0.02, uTime * 0.01);
        float c = fbm(uv);
        col = mix(col, col * 1.6 + vec3(0.02), smoothstep(0.45, 0.85, c) * 0.6 * smoothstep(0.0, 0.2, y));
        col = mix(col, col * 0.45, smoothstep(0.55, 0.3, c) * 0.5 * smoothstep(0.0, 0.3, y));
        col += uFlash * vec3(0.55, 0.6, 0.75) * (0.4 + c);
        if (d.y < 0.0) col = uFogColor;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.renderOrder = -1;
  return { mesh, uniforms };
}

// GPU rain: streaks wrap in a box around the camera.
export function createRain(count) {
  const box = new THREE.Vector3(140, 70, 140);
  const pos = new Float32Array(count * 2 * 3), end = new Float32Array(count * 2);
  for (let i = 0; i < count; i++) {
    const x = Math.random() * box.x, y = Math.random() * box.y, z = Math.random() * box.z;
    for (let j = 0; j < 2; j++) { pos.set([x, y, z], (i * 2 + j) * 3); end[i * 2 + j] = j; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aEnd', new THREE.BufferAttribute(end, 1));
  const uniforms = { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uFlash: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthWrite: false,
    vertexShader: `
      uniform float uTime; uniform vec3 uCam; uniform vec3 uBox; attribute float aEnd; varying float vA;
      void main(){
        vec3 vel = vec3(-6.0, -42.0, 3.0);
        vec3 p = position + vel * uTime;
        p = mod(p - uCam + uBox * 0.5, uBox) + uCam - uBox * 0.5;
        p -= vel * 0.035 * aEnd;
        vA = aEnd;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform float uFlash; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.7,0.78,0.85) + uFlash, 0.28 * (1.0 - vA * 0.6)); }`,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.frustumCulled = false;
  return { mesh: lines, uniforms };
}
