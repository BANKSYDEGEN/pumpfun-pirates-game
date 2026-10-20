// PUMPFUN PIRATES · health drops
// Each enemy sunk has a ~33% chance to leave a floating medic crate where it went down; after 5 sinks in a row
// with no crate the next one always drops (pity rule), and every boss always drops one.
// Sail into it to heal 25% of max HP (capped at max). Crates despawn after 15 s and blink in their last 4 s.
// Shown on the radar in green. Self-contained: main.js only calls the hooks marked [health drops].
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { waveHeight } from './ocean.js';
import { toon, glowMat, outlineFor, woodTexture } from './toon.js';

export const HEALTH_DROP = { chance: 1 / 3, pity: 5, healPct: 0.25, life: 15, blink: 4, radarColor: '#4ee37a' };

// pure drop roll (also used by the tests): state = { dry }, rand = Math.random or the DAILY seeded drop stream
export function rollDrop(state, boss, rand = Math.random) {
  const hit = boss || state.dry >= HEALTH_DROP.pity || rand() < HEALTH_DROP.chance;
  state.dry = hit ? 0 : state.dry + 1;
  return hit;
}

// ---------- medic crate template (cloned per drop; geometry + materials shared) ----------
let _tpl = null;
function crateTemplate() {
  if (_tpl) return _tpl;
  const g = new THREE.Group();
  const white = toon(0xf4efe4);
  const red = toon(0xfa0d0d);
  const wood = toon(0xffffff, woodTexture({ base: 0x6a4024, rows: 3, seed: 41, w: 128, h: 64, nails: false }));
  const S = 1.5, H = S / 2;
  const body = new THREE.Mesh(new RoundedBoxGeometry(S, S, S, 2, 0.14), white); body.position.y = H; g.add(body);
  // dark wood frame on every edge
  const edgeV = new RoundedBoxGeometry(0.2, S + 0.04, 0.2, 1, 0.05), edgeH = new RoundedBoxGeometry(S + 0.04, 0.2, 0.2, 1, 0.05);
  for (const x of [-H, H]) for (const z of [-H, H]) { const m = new THREE.Mesh(edgeV, wood); m.position.set(x, H, z); g.add(m); }
  for (const y of [0, S]) for (const z of [-H, H]) { const m = new THREE.Mesh(edgeH, wood); m.position.set(0, y, z); g.add(m); }
  for (const y of [0, S]) for (const x of [-H, H]) { const m = new THREE.Mesh(edgeH, wood); m.position.set(x, y, 0); m.rotation.y = Math.PI / 2; g.add(m); }
  // bold red cross on all four sides and the lid
  const barA = new RoundedBoxGeometry(0.8, 0.26, 0.08, 1, 0.03), barB = new RoundedBoxGeometry(0.26, 0.8, 0.08, 1, 0.03);
  const face = (p, ry, rx = 0) => { for (const geo of [barA, barB]) { const m = new THREE.Mesh(geo, red); m.position.copy(p); m.rotation.set(rx, ry, 0); g.add(m); } };
  face(new THREE.Vector3(0, H, H + 0.02), 0); face(new THREE.Vector3(0, H, -H - 0.02), Math.PI);
  face(new THREE.Vector3(H + 0.02, H, 0), Math.PI / 2); face(new THREE.Vector3(-H - 0.02, H, 0), -Math.PI / 2);
  face(new THREE.Vector3(0, S + 0.02, 0), 0, -Math.PI / 2);
  // glowing green heart gem hovering over the lid
  const hs = new THREE.Shape(); hs.moveTo(0, -0.32); hs.bezierCurveTo(-0.5, 0.0, -0.3, 0.38, 0, 0.18); hs.bezierCurveTo(0.3, 0.38, 0.5, 0.0, 0, -0.32);
  const heartGeo = new THREE.ExtrudeGeometry(hs, { depth: 0.14, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.04, bevelSegments: 2, curveSegments: 10 }); heartGeo.center();
  const heart = new THREE.Mesh(heartGeo, glowMat(0x4ee37a, 1.3)); heart.position.y = S + 0.75; heart.scale.setScalar(1.2); g.add(heart);
  g.add(outlineFor(body, 0.06));
  // soft green light beam so drops are easy to spot (same style as the gold chests)
  const beamMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; uniform float uFade; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 1.6) * (0.55 + 0.25 * sin(vUv.y * 30.0 - uTime * 6.0)); a *= (0.6 + 0.4 * sin(vUv.x * 6.2831 * 3.0 + uTime * 2.0)) * uFade; gl_FragColor = vec4(vec3(0.45, 1.5, 0.6) * a, a); }',
  });
  const beamGeo = new THREE.CylinderGeometry(0.75, 1.2, 24, 16, 1, true); beamGeo.translate(0, 12, 0);
  const beam = new THREE.Mesh(beamGeo, beamMat); beam.renderOrder = 2; g.add(beam);
  g.userData.beamMat = beamMat; g.userData.heart = heart;
  _tpl = g;
  return g;
}

// heal chime: soft rising sine arpeggio (only if audio.js has no dedicated one)
function healSound(sfx) { if (sfx?.heal) sfx.heal(); else sfx?.coin?.(); }

// popup style for "+HP"
function ensureStyle() {
  if (document.getElementById('health-drops-css')) return;
  const st = document.createElement('style'); st.id = 'health-drops-css';
  st.textContent = '.popup.heal { color: #4ee37a; font-size: 38px; text-shadow: 0 3px 0 #161616, 0 0 16px rgba(78,227,122,0.6); }';
  document.head.appendChild(st);
}

export function createHealthDrops({ scene, fx, sfx, popup, updateHud }) {
  ensureStyle();
  const drops = [];
  let sunkCount = 0;
  const dropState = { dry: 0 }; // non-drop sinks in a row (pity counter, per run)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);

  function spawn(x, z) {
    const mesh = crateTemplate().clone();
    mesh.scale.setScalar(2.0); scene.add(mesh);
    const d = { mesh, x, z, life: HEALTH_DROP.life, ph: Math.random() * 6 };
    drops.push(d);
    fx.ring(V(x, 0, z), 1, 8, 1.4);
    return d;
  }
  function remove(i) { scene.remove(drops[i].mesh); drops.splice(i, 1); }

  return {
    drops,
    get sunkCount() { return sunkCount; },
    // call once for every enemy sunk by the player; rand: seeded drop stream on a DAILY run (never the spawn/loot streams)
    onSink(s, rand = Math.random) {
      sunkCount++;
      const boss = !!(s.boss || s.type === 'boss');
      if (rollDrop(dropState, boss, rand)) return spawn(s.x + (Math.random() - 0.5) * 3, s.z + (Math.random() - 0.5) * 3);
      return null;
    },
    spawn,
    update(dt, t, player) {
      if (_tpl) _tpl.userData.beamMat.uniforms.uTime.value = t;
      for (let i = drops.length - 1; i >= 0; i--) {
        const d = drops[i]; d.life -= dt;
        if (d.life <= 0) { fx.ring(V(d.x, 0, d.z), 0.5, 4, 0.8); remove(i); continue; }
        const y = waveHeight(d.x, d.z, t);
        d.mesh.position.set(d.x, y - 0.35 + Math.sin(t * 2.2 + d.ph) * 0.18, d.z);
        d.mesh.rotation.set(Math.sin(t * 1.3 + d.ph) * 0.12, d.mesh.rotation.y + dt * 0.6, Math.cos(t * 1.1 + d.ph) * 0.12);
        // blink in the last few seconds (faster as it runs out)
        d.blinkPh = d.life > HEALTH_DROP.blink ? 0 : (d.blinkPh || 0) + dt * Math.PI * 2 * (2.5 + (HEALTH_DROP.blink - d.life) * 1.1); // 2.5 Hz → ~8 Hz
        d.mesh.visible = d.life > HEALTH_DROP.blink || Math.sin(d.blinkPh) > -0.35;
        if (Math.random() < 0.25) fx.glow.emit(V(d.x + (Math.random() - 0.5) * 2, y + 1 + Math.random() * 2, d.z + (Math.random() - 0.5) * 2), V(0, 1 + Math.random(), 0), { color: [0.45, 1, 0.55], size: 0.4 + Math.random() * 0.4, life: 0.5 + Math.random() * 0.4 });
        if (!player.alive || player.hp >= player.maxHp) continue; // full hull: leave it floating for later
        const reach = Math.max(10, (player.mesh.userData.len || 17) * 0.45);
        if (Math.hypot(d.x - player.x, d.z - player.z) < reach) {
          const before = player.hp;
          player.hp = Math.min(player.maxHp, player.hp + Math.round(player.maxHp * HEALTH_DROP.healPct));
          const healed = Math.round(player.hp - before);
          const p = d.mesh.position.clone();
          for (let k = 0; k < 40; k++) fx.glow.emit(V(p.x + (Math.random() - 0.5) * 3, p.y + 1 + Math.random() * 2, p.z + (Math.random() - 0.5) * 3), V((Math.random() - 0.5) * 6, 3 + Math.random() * 7, (Math.random() - 0.5) * 6), { color: k % 3 ? [0.45, 1, 0.55] : [1, 1, 1], size: 0.5 + Math.random() * 0.7, life: 0.6 + Math.random() * 0.5 });
          fx.ring(V(d.x, 0, d.z), 1, 9, 1.0);
          popup(p.clone().setY(p.y + 5), `+${healed} HP`, 'heal');
          healSound(sfx);
          remove(i); updateHud?.();
          this.lastPickup = { healed, hp: player.hp, maxHp: player.maxHp };
        }
      }
    },
    radar(dot) { for (const d of drops) if (d.mesh.visible || d.life > HEALTH_DROP.blink) dot(d.x, d.z, HEALTH_DROP.radarColor, 3.5); },
    clear() { while (drops.length) remove(drops.length - 1); sunkCount = 0; dropState.dry = 0; },
  };
}
