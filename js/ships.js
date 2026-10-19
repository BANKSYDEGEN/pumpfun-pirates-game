import * as THREE from 'three';

// ---------- textures ----------
export function makeSkullTexture(skullImg, { w = 512, h = 340, bg = '#0b0b0b', pad = 0.12, border = null } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  // subtle cloth weave
  g.globalAlpha = 0.06; g.fillStyle = '#fff';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  if (border) { g.strokeStyle = border; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, h - 10); }
  // the REAL childlike skull logo (image file), never redrawn
  const s = Math.min(w, h) * (1 - pad * 2);
  const ar = skullImg.width / skullImg.height;
  const sw = ar >= 1 ? s : s * ar, sh = ar >= 1 ? s / ar : s;
  g.drawImage(skullImg, (w - sw) / 2, (h - sh) / 2, sw, sh);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

// Parody "rug pill" flag: a cracked green/white capsule. Deliberately NOT the real pump.fun logo.
export function makePillTexture() {
  const w = 512, h = 340;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#1d2a22'; g.fillRect(0, 0, w, h);
  g.globalAlpha = 0.07; g.fillStyle = '#fff';
  for (let y = 0; y < h; y += 6) g.fillRect(0, y, w, 1);
  g.globalAlpha = 1;
  g.save();
  g.translate(w / 2, h / 2); g.rotate(-Math.PI / 5.5);
  const L = 330, R = 62;
  const capsule = (x0, x1) => { g.beginPath(); g.moveTo(x0, -R); g.lineTo(x1, -R); g.arc(x1, 0, R, -Math.PI / 2, Math.PI / 2); g.lineTo(x0, R); g.arc(x0, 0, R, Math.PI / 2, -Math.PI / 2); g.closePath(); };
  // two halves pulled slightly apart (it's been rugged)
  g.save(); g.beginPath(); g.rect(-400, -200, 400 - 8, 400); g.clip();
  capsule(-L / 2 + R, L / 2 - R); g.fillStyle = '#f2f2f2'; g.fill(); g.restore();
  g.save(); g.translate(14, 6); g.rotate(0.12); g.beginPath(); g.rect(8, -200, 400, 400); g.clip();
  capsule(-L / 2 + R, L / 2 - R); g.fillStyle = '#4ee37a'; g.fill(); g.restore();
  g.lineWidth = 8; g.strokeStyle = '#0d0d0d';
  g.save(); g.beginPath(); g.rect(-400, -200, 400 - 8, 400); g.clip(); capsule(-L / 2 + R, L / 2 - R); g.stroke(); g.restore();
  g.save(); g.translate(14, 6); g.rotate(0.12); g.beginPath(); g.rect(8, -200, 400, 400); g.clip(); capsule(-L / 2 + R, L / 2 - R); g.stroke(); g.restore();
  // jagged crack
  g.beginPath(); g.moveTo(-4, -R - 4); [[6, -30], [-6, -8], [8, 14], [-4, 36], [6, R + 4]].forEach(([x, y]) => g.lineTo(x, y));
  g.lineWidth = 6; g.stroke();
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- geometry helpers ----------
function hullGeometry(len, beam, depth) {
  const N = 12;
  const sections = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    let w = t < 0.42 ? beam * (0.78 + 0.22 * Math.sin((t / 0.42) * Math.PI / 2)) : beam * Math.pow(Math.max(0, Math.cos(((t - 0.42) / 0.58) * Math.PI / 2)), 0.75);
    w = Math.max(w, 0.08);
    const z = (t - 0.5) * len;
    const yd = depth * 0.55 + depth * 0.55 * Math.pow((t - 0.45) * 2, 2) + (t < 0.15 ? depth * 0.35 * (1 - t / 0.15) : 0);
    const keel = -depth * 0.5 * (1 - 0.65 * Math.max(0, (t - 0.72) / 0.28)) * (t < 0.06 ? 0.75 : 1);
    sections.push([
      [w / 2, yd, z], [w / 2 * 1.02, yd * 0.35, z], [w / 2 * 0.88, 0, z], [w / 2 * 0.5, keel * 0.8, z], [0, keel, z],
      [-w / 2 * 0.5, keel * 0.8, z], [-w / 2 * 0.88, 0, z], [-w / 2 * 1.02, yd * 0.35, z], [-w / 2, yd, z],
    ]);
  }
  const pos = [], idx = [];
  const P = sections[0].length;
  sections.forEach(s => s.forEach(p => pos.push(...p)));
  for (let i = 0; i < N; i++) for (let j = 0; j < P - 1; j++) {
    const a = i * P + j, b = a + 1, c = a + P, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  // stern transom
  const base = 0;
  for (let j = 1; j < P - 1; j++) idx.push(base, base + j, base + j + 1);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return { geo, sections };
}

function deckGeometry(sections, inset = 0.92, drop = 0.35) {
  const pos = [], idx = [];
  sections.forEach(s => {
    const [l, r] = [s[0], s[s.length - 1]];
    pos.push(l[0] * inset, l[1] - drop, l[2], r[0] * inset, r[1] - drop, r[2]);
  });
  for (let i = 0; i < sections.length - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx); geo.computeVertexNormals();
  return geo;
}

function sailGeometry(w, h, billow) {
  const g = new THREE.PlaneGeometry(w, h, 8, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) / (w / 2), y = p.getY(i) / (h / 2);
    p.setZ(i, billow * (1 - x * x) * (1 - 0.35 * y * y) * (0.75 + 0.25 * (1 - y)));
  }
  g.computeVertexNormals();
  return g;
}

// A textured cloth that reads correctly (not mirrored) from both sides.
function twoSidedCloth(geo, map, rough = 0.95) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map, roughness: rough, side: THREE.FrontSide })));
  const m2 = map.clone(); m2.wrapS = THREE.RepeatWrapping; m2.repeat.x = -1; m2.offset.x = 1; m2.needsUpdate = true;
  g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: m2, roughness: rough, side: THREE.BackSide })));
  return g;
}

const cyl = (r1, r2, h, s = 8) => new THREE.CylinderGeometry(r1, r2, h, s);

// ---------- ship builder ----------
/**
 * Ship forward = local +Z, up = +Y, port (left) = +X, starboard (right) = -X.
 */
export function buildShip(opts) {
  const {
    len = 16, beam = 5.2, depth = 3, hullColor = 0x3a2516, trimColor = 0xffcd77, sailColor = 0x1a1a1a,
    mainSailMap = null, flagMap, flagScale = 1, cannonsPerSide = 3, masts = 2, light = false, windowColor = 0xffcd77,
  } = opts;
  const ship = new THREE.Group();
  const body = new THREE.Group(); ship.add(body); // body gets bob/tilt

  const wood = new THREE.MeshStandardMaterial({ color: hullColor, roughness: 0.85, flatShading: true, side: THREE.DoubleSide });
  const deckMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.9, flatShading: true, side: THREE.DoubleSide });
  const trim = new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.6, metalness: 0.2, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.5, metalness: 0.4, flatShading: true });
  const mastMat = new THREE.MeshStandardMaterial({ color: 0x4a3222, roughness: 0.9, flatShading: true });
  const sailMat = new THREE.MeshStandardMaterial({ color: sailColor, roughness: 0.95, side: THREE.DoubleSide, flatShading: true });
  const glow = new THREE.MeshBasicMaterial({ color: windowColor });

  const { geo, sections } = hullGeometry(len, beam, depth);
  const hull = new THREE.Mesh(geo, wood); body.add(hull);
  body.add(new THREE.Mesh(deckGeometry(sections), deckMat));

  // gold trim stripe along each side at the gunwale
  const stripeL = []; const stripeR = [];
  sections.forEach(s => { stripeL.push(new THREE.Vector3(...s[1]).add(new THREE.Vector3(0.03, 0.25, 0))); stripeR.push(new THREE.Vector3(...s[s.length - 2]).add(new THREE.Vector3(-0.03, 0.25, 0))); });
  [stripeL, stripeR].forEach(pts => body.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.09, 4), trim)));

  // stern cabin with glowing windows
  const cabZ = -len * 0.36, cabW = beam * 0.72, cabH = 1.7, deckY = sections[1][0][1] - 0.35;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabW, cabH, len * 0.2), wood);
  cabin.position.set(0, deckY + cabH / 2, cabZ); body.add(cabin);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabW + 0.3, 0.18, len * 0.22), trim);
  roof.position.set(0, deckY + cabH + 0.09, cabZ); body.add(roof);
  const winGeo = new THREE.PlaneGeometry(0.42, 0.55);
  for (let i = 0; i < 3; i++) {
    const wv = new THREE.Mesh(winGeo, glow); wv.position.set((i - 1) * cabW * 0.3, deckY + cabH * 0.55, cabZ - len * 0.1 - 0.02); wv.rotation.y = Math.PI; body.add(wv);
  }
  for (const sx of [1, -1]) for (let i = 0; i < 2; i++) {
    const wv = new THREE.Mesh(winGeo, glow); wv.position.set(sx * (cabW / 2 + 0.02), deckY + cabH * 0.55, cabZ + (i - 0.5) * len * 0.09); wv.rotation.y = sx * Math.PI / 2; body.add(wv);
  }
  // stern lanterns
  for (const sx of [1, -1]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), glow); l.position.set(sx * cabW * 0.45, deckY + cabH + 0.55, cabZ - len * 0.11); body.add(l);
  }
  if (light) { const pl = new THREE.PointLight(0xffb060, 18, 30, 1.6); pl.position.set(0, deckY + cabH + 1, cabZ - len * 0.12); body.add(pl); }

  // cannons (port +X, starboard -X)
  const muzzles = { port: [], star: [] };
  const cGeo = cyl(0.2, 0.26, 1.3, 8); cGeo.rotateZ(Math.PI / 2);
  for (let i = 0; i < cannonsPerSide; i++) {
    const t = 0.3 + (i / Math.max(1, cannonsPerSide - 1)) * 0.32;
    const s = sections[Math.round(t * (sections.length - 1))];
    for (const side of ['port', 'star']) {
      const sx = side === 'port' ? 1 : -1;
      const c = new THREE.Mesh(cGeo, dark);
      const px = sx * (Math.abs(s[1][0]) + 0.35);
      c.position.set(px, s[1][1] + 0.15, s[1][2]); body.add(c);
      const m = new THREE.Object3D(); m.position.set(px + sx * 0.7, s[1][1] + 0.15, s[1][2]); body.add(m);
      muzzles[side].push(m);
    }
  }

  // masts, yards, sails
  const mastDefs = masts >= 3 ? [[0.08, 1.0], [0.3, 0.82], [-0.18, 0.7]] : [[0.05, 1.0], [0.3, 0.8]];
  const sails = []; let flagPole = null;
  mastDefs.forEach(([zf, hf], mi) => {
    const mh = len * 0.95 * hf, mz = zf * len;
    const mast = new THREE.Mesh(cyl(0.16, 0.26, mh), mastMat); mast.position.set(0, deckY + mh / 2, mz); body.add(mast);
    const tiers = mi === 0 ? 2 : 2;
    for (let k = 0; k < tiers; k++) {
      const yw = beam * (k === 0 ? 1.45 : 1.05) * hf, sh = mh * (k === 0 ? 0.36 : 0.26);
      const yy = deckY + mh * (k === 0 ? 0.72 : 0.97);
      const yard = new THREE.Mesh(cyl(0.09, 0.09, yw, 6), mastMat); yard.rotation.z = Math.PI / 2; yard.position.set(0, yy, mz + 0.15); body.add(yard);
      const isMain = k === 0; // skull on every lower course (player only)
      const sg = sailGeometry(yw * 0.94, sh, 0.9 + sh * 0.06);
      const sail = isMain && mainSailMap ? twoSidedCloth(sg, mainSailMap) : new THREE.Mesh(sg, sailMat);
      sail.position.set(0, yy - sh / 2 - 0.1, mz + 0.25); body.add(sail);
      sails.push(sail);
    }
    // crow's nest on main
    if (mi === 0) {
      const nest = new THREE.Mesh(cyl(0.7, 0.55, 0.5, 10), wood); nest.position.set(0, deckY + mh * 0.82, mz); body.add(nest);
      flagPole = new THREE.Object3D(); flagPole.position.set(0, deckY + mh, mz); body.add(flagPole);
    }
  });
  // bowsprit
  const bs = new THREE.Mesh(cyl(0.1, 0.18, len * 0.32, 6), mastMat);
  bs.rotation.x = Math.PI / 2 - 0.35; bs.position.set(0, sections[sections.length - 1][0][1] + 0.4, len * 0.55); body.add(bs);
  // jib
  const jg = new THREE.BufferGeometry();
  const top = new THREE.Vector3(0, deckY + len * 0.95 * 0.8 * 0.95, len * 0.3), tip = new THREE.Vector3(0, sections[12][0][1] + 1.2, len * 0.66), foot = new THREE.Vector3(0, sections[12][0][1] + 0.3, len * 0.36);
  jg.setAttribute('position', new THREE.Float32BufferAttribute([...top.toArray(), ...tip.toArray(), ...foot.toArray()], 3)); jg.computeVertexNormals();
  body.add(new THREE.Mesh(jg, sailMat));

  // flag (animated cloth)
  const fw = len * 0.28 * flagScale, fh = fw * 0.66;
  const fGeo = new THREE.PlaneGeometry(fw, fh, 10, 6);
  fGeo.translate(-fw / 2, fh / 2, 0); // attach edge at x=0
  fGeo.rotateY(-Math.PI / 2);        // stream toward -Z (aft)
  const flag = twoSidedCloth(fGeo, flagMap, 0.9);
  flag.geometry = fGeo;
  flag.position.y = -fh * 0.05; flagPole.add(flag);
  const pole = new THREE.Mesh(cyl(0.06, 0.06, fh + 0.8, 5), mastMat); pole.position.y = fh / 2; flagPole.add(pole);
  const base = fGeo.attributes.position.array.slice();

  body.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });

  ship.userData = { body, muzzles, sails, flag, flagBase: base, len, beam, depth, deckY };
  return ship;
}

export function animateShip(ship, t, sailLevel = 1) {
  const { flag, flagBase, sails } = ship.userData;
  const p = flag.geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const z = flagBase[i * 3 + 2], y = flagBase[i * 3 + 1];
    const d = -z; // distance from pole
    p.setX(i, Math.sin(d * 1.3 - t * 7 + y * 0.4) * 0.18 * d + Math.sin(d * 3 - t * 11) * 0.05 * d);
  }
  p.needsUpdate = true;
  // furl sails with sail level (0..1)
  const s = 0.18 + 0.82 * sailLevel;
  sails.forEach(sl => { sl.scale.y += (s - sl.scale.y) * 0.08; sl.scale.z = 0.4 + 0.6 * sailLevel; });
}
