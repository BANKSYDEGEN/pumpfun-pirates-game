// [Pilly] BANKSY t2222u "Make it a companion that can be leveled up make it decently sized" + t2223u "have a pilly and a parrot equipped
// at same time": the pump.fun pill walks beside you ashore in ITS OWN companion slot (never gear.parrot: your parrot / shoulder pet stays).
// Server = migration 067 (pvp_pilly_op) via the pvp 'pilly_*' actions. Until that is live, pilly_list fails and the store shows COMING SOON.
// Model = assets/pirates/items/v7/pet_pilly.glb (meshopt, ~0.9 m in game, clips Idle / Walk / Run / Wave, morphs Blink / Smile / Open / Cheek).
// Face (BANKSY t2225u/t2226u faces sheet): default = the modelled glossy eyes + smile; laugh (> <, open mouth + tongue) on level up,
// happy (^ ^, open smile) on XP / wave, wink on idle, surprised (o mouth) when you are hit or Pilly teleports, ^ ^ blinks every 2-6 s.
// Local only (other pirates do not see your Pilly yet: no new net message).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { makeTrail, makeMover, followStep } from './followPath.js';
import { newBody, placeBody, stepBody, wadeFactor } from './physics.js';

export const PILLY_PRICE = 5000;
export const pillyLv = (xp) => Math.min(10, Math.floor(Math.sqrt(Math.max(0, +xp || 0) / 100)));
const lvXp = (lv) => lv * lv * 100;
export const pillyTreatCost = (lv) => 250 * (lv + 1) * (lv + 1);
// the ladder: swim speed on foot (stacks with the parrot's gold find + pets' sell bonus: a different stat), size + glow per level
export const pillySwim = (lv) => lv >= 10 ? 0.15 : Math.max(0, lv) * 0.01;
export const PILLY_LADDER = [
  'Starts at waist height. Waves at you.', '+1% swim speed', '+2% swim speed', '+3% swim speed · soft green glow', '+4% swim speed',
  '+5% swim speed · bigger glow', '+6% swim speed', '+7% swim speed · brighter glow', '+8% swim speed', '+9% swim speed',
  '+15% swim speed · GOLDEN glow · biggest Pilly'];
const H_MODEL = 1.08, H_GAME = 0.86;   // ~waist height on the 1.75 m V7 pirate (js/onfoot/pirate.js height)
const scaleOf = (lv) => (H_GAME / H_MODEL) * (1 + 0.012 * lv);

let _ld = null; const loader = () => (_ld ||= new GLTFLoader().setMeshoptDecoder(MeshoptDecoder));
// ---------- face decal (a curved strip over the face, drawn on a canvas) ----------
const FR = 0.338, TH0 = -0.85, TH = 1.7, YT = 0.86, YH = 0.28, CW = 512, CH = 256;
const px = (x) => (Math.asin(Math.max(-1, Math.min(1, x / FR))) - TH0) / TH * CW, py = (y) => (YT - y) / YH * CH;
function drawFace(g, eyes, mouth) {
  g.clearRect(0, 0, CW, CH); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#111'; g.fillStyle = '#111'; g.lineWidth = 14;
  const ey = py(0.725), L = px(0.15), R = px(-0.15);   // L = Pilly's left (+x)
  const round = (x) => { g.fillStyle = '#0c0c0c'; g.beginPath(); g.ellipse(x, ey, 32, 40, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x - 11, ey - 14, 10, 11, 0, 0, 7); g.fill(); g.beginPath(); g.arc(x + 12, ey + 10, 4, 0, 7); g.fill(); };
  const arc = (x) => { g.beginPath(); g.arc(x, ey + 14, 28, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); };
  const chev = (x, d) => { g.beginPath(); g.moveTo(x - 24 * d, ey - 24); g.lineTo(x + 22 * d, ey); g.lineTo(x - 24 * d, ey + 24); g.stroke(); };
  if (eyes === 'arc') { arc(L); arc(R); } else if (eyes === 'squint') { chev(R, 1); chev(L, -1); } else if (eyes === 'wink') { round(L); chev(R, 1); }
  const my = py(0.645), mx = CW / 2;
  if (mouth === 'open' || mouth === 'laugh') { g.fillStyle = '#1a0a0a'; g.beginPath(); g.moveTo(mx - 50, my - 14); g.quadraticCurveTo(mx, my - 4, mx + 50, my - 14); g.quadraticCurveTo(mx + 40, my + 42, mx, my + 44); g.quadraticCurveTo(mx - 40, my + 42, mx - 50, my - 14); g.fill();
    g.fillStyle = '#ff6f91'; g.beginPath(); g.ellipse(mx, my + 28, 24, 13, 0, 0, 7); g.fill(); }
  else if (mouth === 'o') { g.fillStyle = '#1a0a0a'; g.beginPath(); g.ellipse(mx, my + 4, 16, 20, 0, 0, 7); g.fill(); }
  else if (mouth === 'smile') { g.lineWidth = 12; g.beginPath(); g.arc(mx, my - 26, 46, Math.PI * 0.2, Math.PI * 0.8); g.stroke(); }
}
// expression -> [eyes, mouth]; null = the modelled part
const FACES = { idle: [null, null], blink: ['arc', null], laugh: ['squint', 'laugh'], happy: ['arc', 'open'], wink: ['wink', 'smile'], surprised: [null, 'o'] };

export function createPilly({ scene, world, low = false }) {
  let root = null, mixer = null, acts = {}, cur = null, face = null, parts = { eye: [], mouth: [], morph: [] }, badge = null, greenMat = null;
  let active = false, lv = -1, loading = false, faceKey = 'idle', faceT = 0, blinkT = 3, idleT = 0, waveT = 0, wasMoving = 0, quirkT = 8;
  const c = { x: 0, z: 0, y: 0, yaw: 0, speed: 0, stuck: 0, idleT: 0, body: newBody() };
  const TR = makeTrail(0.6, 48), blocked = (x, z, fx, fz) => world.blocked(x, z, fx, fz);
  const env = { trail: TR, move: makeMover(blocked, [0.6, -0.6, 1.2, -1.2]), free: (x, z, fx, fz) => !world.blocked(x, z, fx, fz), i: 4, lost: 24, deflect: true, back: 1.7, side: -0.95,
    place: (q) => { placeBody(q.body, world, q.x, q.z); q.y = q.body.y; }, cap: (q, w) => (q.body.swim ? Math.min(w, 3.4) : w * wadeFactor(q.body)),
    sp: { far: 7, run: 9.5, near: 0.75, walk: 9.5, base: 1.6, k: 2.4 } };
  function load() {
    if (root || loading) return; loading = true;
    loader().loadAsync(new URL('../../assets/pirates/items/v7/pet_pilly.glb', import.meta.url).href).then((gl) => {
      root = gl.scene; root.name = 'pilly'; mixer = new THREE.AnimationMixer(root);
      for (const a of gl.animations) acts[a.name] = mixer.clipAction(a);
      if (acts.Wave) { acts.Wave.setLoop(THREE.LoopOnce, 1); acts.Wave.clampWhenFinished = false; }
      let bodyBone = null;
      root.traverse((o) => { if (o.isBone && o.name === 'body') bodyBone = o;
        if (!o.isMesh) return; o.castShadow = !low; o.frustumCulled = false; const n = (o.material?.name || '').split('.')[0];
        if (n === 'Eye' || n === 'Shine') parts.eye.push(o); if (n === 'Mouth') parts.mouth.push(o); if (o.morphTargetDictionary) parts.morph.push(o);
        if (n === 'Green') { o.material = o.material.clone(); greenMat = o.material; } });
      const cv = document.createElement('canvas'); cv.width = CW; cv.height = CH; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const geo = new THREE.CylinderGeometry(FR, FR, YH, 20, 1, true, TH0, TH);
      const dm = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
      dm.position.y = YT - YH / 2; dm.renderOrder = 2; dm.visible = false; root.add(dm); root.updateMatrixWorld(true); if (bodyBone) bodyBone.attach(dm);
      face = { cv, g: cv.getContext('2d'), tex, mesh: dm };
      const bc = document.createElement('canvas'); bc.width = 128; bc.height = 48; const bt = new THREE.CanvasTexture(bc);
      badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: bt, depthTest: false, transparent: true })); badge.scale.set(0.42, 0.16, 1); badge.position.y = H_MODEL + 0.14; badge.renderOrder = 3; badge.userData.cv = bc; root.add(badge);
      play('Idle'); setLv(Math.max(0, lv)); setFace('idle', 0); root.visible = active; scene.add(root);
    }).catch((e) => console.warn('[pilly]', e)).finally(() => { loading = false; });
  }
  function play(n, fade = 0.25) { const a = acts[n]; if (!a || cur === a) return; a.reset().fadeIn(fade).play(); cur?.fadeOut(fade); cur = a; }
  function setFace(k, dur = 1.6) {
    faceKey = FACES[k] ? k : 'idle'; faceT = dur; if (!face) return; const [e, m] = FACES[faceKey];
    for (const o of parts.eye) o.visible = !e; for (const o of parts.mouth) o.visible = !m; face.mesh.visible = !!(e || m);
    for (const o of parts.morph) { const d = o.morphTargetDictionary, w = o.morphTargetInfluences; if (d.Cheek != null) w[d.Cheek] = k === 'laugh' || k === 'happy' ? 1 : 0; if (d.Smile != null) w[d.Smile] = k === 'wink' ? 1 : 0; }
    if (e || m) { drawFace(face.g, e, m); face.tex.needsUpdate = true; }
  }
  function setLv(n) {
    lv = n; if (!root) return; root.scale.setScalar(scaleOf(lv));
    if (greenMat) { greenMat.emissive = new THREE.Color(lv >= 10 ? 0xffc23a : 0x3dff8a); greenMat.emissiveIntensity = lv >= 10 ? 0.35 : lv >= 3 ? 0.05 + 0.025 * lv : 0; }
    const bc = badge.userData.cv, g = bc.getContext('2d'); g.clearRect(0, 0, 128, 48); g.fillStyle = lv >= 10 ? '#c9901a' : '#1f6b3a'; g.beginPath(); g.roundRect(4, 4, 120, 40, 18); g.fill();
    g.fillStyle = '#fff'; g.font = '800 26px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('LV ' + lv, 64, 25); badge.material.map.needsUpdate = true;
  }
  function enter(o) {
    load(); const bx = -Math.sin(o.yaw), bz = -Math.cos(o.yaw); TR.clear(); c.x = o.x + bx * 1.2 - bz * 0.9; c.z = o.z + bz * 1.2 + bx * 0.9;   // behind you, on your right (the ground pet takes the left)
    if (world.blocked(c.x, c.z, o.x, o.z)) { c.x = o.x; c.z = o.z; }
    Object.assign(c, { yaw: o.yaw, speed: 0, stuck: 0, idleT: 0 }); placeBody(c.body, world, c.x, c.z); c.y = c.body.y; active = true; if (root) root.visible = true;
  }
  function exit() { active = false; if (root) root.visible = false; }
  function update(dt, o, { camera = null, hide = false } = {}) {
    if (!active) enter(o);
    TR.push(o.x, o.z);
    const r = followStep(c, o, dt, env);
    if (r === 'tp') setFace('surprised', 1.4); else { stepBody(c.body, world, c.x, c.z, dt, c.speed); c.y = c.body.y; }
    if (c.body.swim && !o.body?.swim && Math.hypot(c.x - o.x, c.z - o.z) > 6) { const q = TR.at(env.back, o.x, o.z); c.x = q[0]; c.z = q[1]; env.place(c); setFace('surprised', 1.2); }   // keep out of the sea when you are on land
    if (!root) return;
    // Place before distance-culling: a newly loaded model starts at (0,0,0), far
    // from the harbor. Culling first leaves it invisible forever (also after teleport).
    const s = c.body.swim && world.water ? world.water(c.x, c.z) : null;
    root.position.set(c.x, s != null ? s - 0.45 * H_GAME : c.y, c.z); root.rotation.set(0, c.yaw, 0);
    const far = camera ? camera.position.distanceToSquared(root.position) > 4900 : false; root.visible = !hide && !far; if (!root.visible) return;
    const moving = c.speed > 0.35;
    if (moving) { wasMoving += dt; idleT = 0; if (waveT <= 0) play(c.speed > 4.2 ? 'Run' : 'Walk'); if (cur && cur !== acts.Wave) cur.timeScale = Math.min(1.8, Math.max(0.7, c.speed / (cur === acts.Run ? 6 : 2.4))); }
    else { idleT += dt; if (wasMoving > 3 && Math.random() < 0.35) wave(); wasMoving = 0; if (waveT <= 0) play('Idle'); quirkT -= dt; if (quirkT <= 0) { quirkT = 9 + Math.random() * 12; if (Math.random() < 0.4) wave(); else setFace('wink', 1.2); } }
    if (waveT > 0) { waveT -= dt; if (waveT <= 0) play(moving ? 'Walk' : 'Idle'); }
    if (faceT > 0) { faceT -= dt; if (faceT <= 0) setFace('idle', 0); }
    else { blinkT -= dt; if (blinkT <= 0) { blinkT = 2 + Math.random() * 4; setFace('blink', 0.14); } }
    mixer.update(dt);
  }
  function wave() { if (!acts.Wave || waveT > 0) return; acts.Wave.reset().fadeIn(0.2).play(); cur?.fadeOut(0.2); cur = acts.Wave; waveT = acts.Wave.getClip().duration; setFace('happy', waveT); }
  addEventListener('pfp-foot-hit', () => { if (active) setFace('surprised', 1.3); });
  function dispose() { if (root) root.removeFromParent(); root = null; active = false; }
  return { enter, exit, update, dispose, setLv, react: setFace, wave, get active() { return active; }, get mesh() { return root; } };
}

// ---------- state + panel (mirrors js/petsPanel.js / parrotsPanel.js: the server owns gold, ownership + XP) ----------
const CSS = `#pilly-panel{position:fixed;inset:0;z-index:76;display:flex;align-items:center;justify-content:center;background:#0008}#pilly-panel[hidden]{display:none}
#pilly-panel .pl-box{width:min(440px,94vw);max-height:86vh;overflow-y:auto;background:rgba(12,20,28,.97);border:2px solid #4ade80;border-radius:12px;color:#fff;font:600 13px/1.35 system-ui,sans-serif;padding:12px 14px;box-shadow:0 8px 24px #000a}
#pilly-panel h3{margin:0 0 8px;color:#86efac;display:flex;align-items:center}#pilly-panel h3 b{flex:1}#pilly-panel .x{background:none;border:0;color:#fff;font-size:18px;cursor:pointer}
#pilly-panel .bar{height:7px;border-radius:4px;background:#ffffff1a;margin:6px 0;overflow:hidden}#pilly-panel .bar i{display:block;height:100%;background:linear-gradient(90deg,#22c55e,#ffd76a)}
#pilly-panel button.b{min-height:34px;border-radius:7px;border:1px solid #4ade8099;background:#1d2b38;color:#fff;font:700 12px system-ui;cursor:pointer;padding:4px 12px;margin:4px 4px 0 0}#pilly-panel button.go{background:#1f6b3a}
#pilly-panel button:disabled{opacity:.45}#pilly-panel ol{margin:8px 0 0;padding-left:0;list-style:none}#pilly-panel li{padding:3px 6px;border-radius:5px;font-size:12px;opacity:.6}#pilly-panel li.got{opacity:1;background:#22c55e22}#pilly-panel li.now{outline:1px solid #ffd76a}
#pilly-panel input{background:#0b141c;border:1px solid #4ade8088;border-radius:6px;color:#fff;padding:6px 8px;font:600 13px system-ui;width:150px}`;
const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (ch) => `&#${ch.charCodeAt(0)};`);
export function createPillyState(ctx) {
  // ctx: { call(action, body), toast(html, ms), gold(json), follower: createPilly() result, out() -> bool (you are ashore, not in the hull) }
  let st = { avail: null, owned: false, out: false, xp: 0, lv: 0, name: null }, el = null, busy = false, walkT = 0;
  const call = async (a, b = {}) => { try { return (await ctx.call(a, b)) || { ok: false }; } catch { return { ok: false, why: 'offline' }; } };
  const apply = (r) => { if (!r?.ok) return; const prev = st.lv; Object.assign(st, { avail: true, owned: !!r.owned, out: !!r.out, xp: r.xp | 0, lv: r.lv | 0, name: r.name || null });
    globalThis.__pfpPillySwim = st.owned && st.out ? 1 + pillySwim(st.lv) : 1; ctx.follower?.setLv(st.lv); ctx.gold?.(r);
    if (st.lv > prev && prev >= 0 && st.owned) { ctx.follower?.react('laugh', 2.4); ctx.toast?.(`💊 Pilly reached <b>LV ${st.lv}</b>!`, 2400); } draw(); };
  async function refresh() { const r = await call('pilly_list'); if (r?.ok) apply(r); else st.avail = st.avail === true && !r?.error; draw(); return r; }
  function draw() {
    if (!el || el.hidden) return; const box = el.querySelector('.pl-box'), nm = esc(st.name || 'Pilly');
    let h = `<h3><b>💊 ${nm.toUpperCase()} · COMPANION</b><button class="x" aria-label="Close">✕</button></h3>`;
    if (st.avail === false) h += `<p>Pilly the pump.fun pill is <b>COMING SOON</b> to the pet store. A companion that walks beside you (alongside your parrot) and levels up to LV 10.</p>`;
    else if (st.avail == null) h += `<p>Loading…</p>`;
    else if (!st.owned) h += `<p>A waist-high companion that walks beside you ashore. Your parrot or shoulder pet stays equipped too.</p><button class="b go" data-a="buy" ${busy ? 'disabled' : ''}>BUY PILLY · ${PILLY_PRICE.toLocaleString()} 🪙</button>`;
    else { const nx = lvXp(st.lv + 1), pc = st.lv >= 10 ? 100 : Math.round((st.xp - lvXp(st.lv)) / (nx - lvXp(st.lv)) * 100);
      h += `<div><b>LV ${st.lv}</b> · ${st.xp} XP${st.lv < 10 ? ` / ${nx}` : ' · MAX'} · now <b>+${Math.round(pillySwim(st.lv) * 100)}% swim speed</b></div><div class="bar"><i style="width:${pc}%"></i></div>
        <button class="b ${st.out ? '' : 'go'}" data-a="out">${st.out ? 'SEND HOME' : 'BRING PILLY'}</button>${st.lv < 10 ? `<button class="b" data-a="treat" ${busy ? 'disabled' : ''}>TREAT +100 XP · ${pillyTreatCost(st.lv).toLocaleString()} 🪙</button>` : ''}
        <div style="margin-top:6px"><input maxlength="16" placeholder="Name" value="${esc(st.name || '')}"><button class="b" data-a="name">RENAME</button></div>`; }
    h += `<ol>${PILLY_LADDER.map((t, i) => `<li class="${st.owned && i <= st.lv ? 'got' : ''}${st.owned && i === st.lv ? ' now' : ''}">LV ${i}: ${t}</li>`).join('')}</ol>
      <p style="font-size:11px;opacity:.75">Pilly earns XP while out with you on the island, like your parrot. Its swim boost stacks with your parrot's gold find and pets' sell bonus.</p>`;
    box.innerHTML = h; box.querySelector('.x').onclick = close;
    box.querySelectorAll('[data-a]').forEach((b) => b.onclick = () => act(b.dataset.a, box.querySelector('input')?.value));
  }
  async function act(a, v) {
    if (busy) return; busy = true; draw();
    const r = await call('pilly_' + a, a === 'out' ? { out: !st.out } : a === 'name' ? { name: v } : {}); busy = false;
    if (r?.ok) { apply(r); if (a === 'buy') { ctx.toast?.('💊 PILLY JOINED YOUR CREW', 2200); ctx.follower?.wave(); } if (a === 'treat') ctx.follower?.react('happy', 1.6); }
    else { if (r?.error) st.avail = false; ctx.toast?.(esc(r?.why || r?.error || 'Could not do that'), 2200); draw(); }
  }
  function open() { if (!el) { const s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s); el = document.createElement('div'); el.id = 'pilly-panel'; el.innerHTML = '<div class="pl-box" role="dialog" aria-label="Pilly"></div>'; el.onclick = (e) => { if (e.target === el) close(); }; document.body.appendChild(el); }
    el.hidden = false; draw(); refresh(); }
  function close() { if (el) el.hidden = true; }
  async function tick(dt) { // walk XP: one ping a minute while Pilly is out with you (server rate-limits to 1 / 55 s)
    if (!st.owned || !st.out || !ctx.out?.()) return; walkT += dt; if (walkT < 60) return; walkT = 0;
    const r = await call('pilly_walk'); if (r?.ok) { const up = (r.xp | 0) > st.xp; apply(r); if (up) ctx.follower?.react('happy', 1.2); }
  }
  try { document.addEventListener('click', (e) => { if (e.target?.closest?.('[data-pilly-open]')) open(); }); } catch {}
  return { refresh, open, close, tick, get state() { return st; }, get show() { return st.avail && st.owned && st.out; } };
}
