// [Friends R2] BANKSY t2025u: on the island map, a right-side list of everyone on this server with MUTE / ADD FRIEND / SQUAD,
// squad invites over the harbor room (the squad = the existing party code: green on the map, no friendly fire, its own channel),
// and voice chat with your squad (WebRTC mesh, signalled over the squad's own party channel), OFF until you switch it on in settings.
const MUTE_KEY = 'pfp_muted_v1', VOICE_KEY = 'pfp_voice_v1', MIC_KEY = 'pfp_voice_mic_v1';
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
const esc = (s) => String(s ?? '').replace(/[&<>"'`]/g, (c) => `&#${c.charCodeAt(0)};`);
export const cleanN = (n) => String(n ?? '').replace(/[<>&"'`\\\u0000-\u001f]/g, '').trim().slice(0, 20);
const okId = (s) => typeof s === 'string' && /^[0-9a-z]{6,16}$/.test(s);
const okCode = (s) => typeof s === 'string' && /^[A-Za-z0-9]{5}$/.test(s);
const ls = { get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch {} } };

// ---------- mute list (by name: net ids change every session) ----------
let muted = null;
function loadMuted() { if (muted) return muted; try { muted = new Set(JSON.parse(ls.get(MUTE_KEY, '[]')).map(cleanN).filter(Boolean).slice(0, 300)); } catch { muted = new Set(); } return muted; }
export function isMuted(name) { const n = cleanN(name).toLowerCase(); return !!n && [...loadMuted()].some((m) => m.toLowerCase() === n); }
export function setMuted(name, on) { const n = cleanN(name); if (!n) return; loadMuted(); for (const m of [...muted]) if (m.toLowerCase() === n.toLowerCase()) muted.delete(m); if (on) muted.add(n); ls.set(MUTE_KEY, JSON.stringify([...muted])); }

const CSS = `
#soc-panel{position:fixed;right:calc(8px + var(--safe-r,0px));top:calc(54px + var(--safe-t,0px));bottom:calc(64px + var(--safe-b,0px));width:236px;z-index:61;display:flex;flex-direction:column;background:rgba(12,20,28,.92);border:2px solid #c9a24a;border-radius:10px;color:#fff;font:600 13px/1.25 system-ui,sans-serif;box-shadow:0 6px 18px #0009}
#soc-panel[hidden]{display:none}
#soc-panel .sp-h{display:flex;align-items:center;gap:6px;padding:8px 10px;border-bottom:1px solid #c9a24a66;color:#ffcd77;letter-spacing:.04em}
#soc-panel .sp-h b{flex:1}
#soc-panel .sp-fold{background:none;border:0;color:#ffcd77;font:inherit;cursor:pointer;padding:2px 4px}
#soc-panel .sp-list{overflow-y:auto;flex:1;padding:4px 6px}
#soc-panel .sp-row{display:flex;flex-direction:column;gap:4px;padding:7px 4px;border-bottom:1px solid #ffffff14}
#soc-panel .sp-n{display:flex;align-items:center;gap:5px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#soc-panel .sp-n.mate{color:#2fd866}#soc-panel .sp-n.fr{color:#ffd76a}#soc-panel .sp-n.mut{opacity:.5;text-decoration:line-through}
#soc-panel .sp-tag{font-size:10px;padding:1px 5px;border-radius:6px;background:#2fd86633;color:#2fd866;flex:none}
#soc-panel .sp-tag.fr{background:#ffd76a33;color:#ffd76a}
#soc-panel .sp-b{display:flex;gap:4px}
#soc-panel .sp-b button{flex:1;min-height:28px;border-radius:6px;border:1px solid #c9a24a99;background:#1d2b38;color:#fff;font:700 11px system-ui,sans-serif;cursor:pointer;padding:3px 2px}
#soc-panel .sp-b button:disabled{opacity:.45;cursor:default}
#soc-panel .sp-b button.on{background:#7a2323;border-color:#e05555}
#soc-panel .sp-empty{opacity:.65;padding:14px 6px;text-align:center}
#soc-panel .sp-foot{padding:6px 10px;border-top:1px solid #c9a24a66;font-size:11px;opacity:.85}
#soc-panel.fold{bottom:auto;width:auto}#soc-panel.fold .sp-list,#soc-panel.fold .sp-foot{display:none}
#soc-inv{position:fixed;left:50%;top:calc(70px + var(--safe-t,0px));transform:translateX(-50%);z-index:80;background:rgba(12,20,28,.95);border:2px solid #2fd866;border-radius:10px;padding:10px 14px;color:#fff;font:600 14px system-ui,sans-serif;display:flex;gap:10px;align-items:center;box-shadow:0 6px 18px #0009}
#soc-inv[hidden]{display:none}
#soc-inv button{min-height:32px;padding:4px 12px;border-radius:7px;border:1px solid #c9a24a;background:#1d2b38;color:#fff;font:700 12px system-ui,sans-serif;cursor:pointer}
#soc-inv button.go{background:#1f6b3a;border-color:#2fd866}
#vc-mic{position:fixed;left:calc(10px + var(--safe-l,0px));bottom:calc(150px + var(--safe-b,0px));z-index:40;width:46px;height:46px;border-radius:50%;border:2px solid #2fd866;background:rgba(12,20,28,.85);color:#fff;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center}
#vc-mic[hidden]{display:none}#vc-mic.off{border-color:#e05555;opacity:.8}#vc-mic.talk{box-shadow:0 0 0 4px #2fd86688}
#vc-mic .vc-n{position:absolute;top:-6px;right:-6px;background:#2fd866;color:#000;border-radius:9px;font:700 10px system-ui;padding:1px 5px}
@media (max-width:700px){#soc-panel{width:188px;font-size:12px;top:calc(46px + var(--safe-t,0px))}#soc-panel .sp-b button{font-size:10px}}
`;

export function createSocial(ctx) {
  // ctx: { pvp() -> internal pvp api, friends: { request(n), relationOf(n) }, toast(m, ms) }
  const pv = () => { try { return ctx.pvp?.() || null; } catch { return null; } };
  const toast = (m, ms) => { try { ctx.toast?.(m, ms); } catch {} };
  let panel = null, inv = null, mic = null, fold = ls.get('pfp_soc_fold', '0') === '1', sig = '', invAt = new Map(), sentAt = new Map(), invT = 0;
  const doc = typeof document !== 'undefined' ? document : null;
  function css() { if (doc && !doc.getElementById('soc-css')) { const s = doc.createElement('style'); s.id = 'soc-css'; s.textContent = CSS; doc.head.appendChild(s); } }
  const stop = (n) => { for (const ev of ['pointerdown', 'touchstart', 'mousedown', 'wheel', 'keydown']) n.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); };

  // ---------- who is on this server ----------
  function players() {
    const p = pv(); if (!p || p.where !== 'harbor' || !p.room) return [];
    const now = performance.now(), out = [];
    for (const q of p.peers?.values?.() || []) { if (!okId(q.id) || now - (q.heard || 0) > 6000) continue; const n = cleanN(q.name); if (!n) continue; out.push({ id: q.id, n, mate: !!p.isHarborSquadMate?.(q) }); }
    return out.sort((a, b) => (b.mate - a.mate) || a.n.localeCompare(b.n));
  }
  const rel = (n) => { try { return ctx.friends?.relationOf?.(n) || ''; } catch { return ''; } };

  // ---------- map side panel ----------
  function ensurePanel() {
    if (panel || !doc) return; css();
    panel = doc.createElement('div'); panel.id = 'soc-panel'; panel.hidden = true; panel.classList.toggle('fold', fold);
    panel.innerHTML = `<div class="sp-h"><b>👥 ON THIS SERVER <span class="sp-c"></span></b><button type="button" class="sp-fold" aria-label="Fold player list">▾</button></div><div class="sp-list"></div><div class="sp-foot">Tap ⚓ SQUAD to sail together · 🔇 hides their chat &amp; voice</div>`;
    doc.body.appendChild(panel); stop(panel);
    panel.querySelector('.sp-fold').onclick = (e) => { e.stopPropagation(); fold = !fold; ls.set('pfp_soc_fold', fold ? '1' : '0'); panel.classList.toggle('fold', fold); sig = ''; draw(); };
    panel.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-a]'); if (!b || b.disabled) return; e.stopPropagation();
      const a = b.dataset.a, id = b.dataset.id, n = cleanN(b.dataset.n);
      if (a === 'mute') { setMuted(n, !isMuted(n)); voice.applyMutes(); toast(isMuted(n) ? `🔇 <b>${esc(n)}</b> muted` : `🔊 <b>${esc(n)}</b> unmuted`, 1600); }
      else if (a === 'add') { b.disabled = true; Promise.resolve(ctx.friends?.request?.(n)).finally(() => { sig = ''; draw(); }); }
      else if (a === 'sq') invite(id, n);
      sig = ''; draw();
    });
  }
  function draw() {
    if (!panel || panel.hidden) return;
    const list = players(), my = pv()?.party?.code || '';
    const s = fold + '|' + my + '|' + list.map((p) => `${p.id}${p.n}${p.mate ? 1 : 0}${isMuted(p.n) ? 1 : 0}${rel(p.n)}${sentAt.has(p.id) ? 1 : 0}`).join(',');
    if (s === sig) return; sig = s;
    panel.querySelector('.sp-c').textContent = `(${list.length + 1})`;
    if (fold) return;
    const L = panel.querySelector('.sp-list');
    if (!list.length) { L.innerHTML = `<div class="sp-empty">${pv()?.where === 'harbor' && pv()?.room ? 'Just you on this server right now.' : 'Set sail to the Harbor to see who is on your server.'}</div>`; return; }
    L.innerHTML = list.map((p) => {
      const r = rel(p.n), mu = isMuted(p.n), fr = r === 'friend';
      const tag = p.mate ? '<span class="sp-tag">SQUAD</span>' : fr ? '<span class="sp-tag fr">FRIEND</span>' : '';
      const addTxt = fr ? '✓ FRIEND' : r === 'sent' ? 'SENT' : r === 'incoming' ? '✓ ACCEPT' : '➕ FRIEND';
      return `<div class="sp-row"><div class="sp-n${p.mate ? ' mate' : fr ? ' fr' : ''}${mu ? ' mut' : ''}">${esc(p.n)} ${tag}</div><div class="sp-b">` +
        `<button type="button" data-a="mute" data-id="${p.id}" data-n="${esc(p.n)}" class="${mu ? 'on' : ''}">${mu ? '🔇 MUTED' : '🔊 MUTE'}</button>` +
        `<button type="button" data-a="add" data-id="${p.id}" data-n="${esc(p.n)}"${fr || r === 'sent' ? ' disabled' : ''}>${addTxt}</button>` +
        `<button type="button" data-a="sq" data-id="${p.id}" data-n="${esc(p.n)}"${p.mate || sentAt.has(p.id) ? ' disabled' : ''}>${p.mate ? '⚓ IN SQUAD' : sentAt.has(p.id) ? 'INVITED' : '⚓ SQUAD'}</button></div></div>`;
    }).join('');
  }

  // ---------- squad invites (harbor room 'soc') ----------
  async function invite(id, n) {
    const p = pv(); if (!p?.room || !okId(id)) return;
    let code = p.party?.code || ''; if (!code) { code = p.partyMake?.() || ''; await new Promise((r) => setTimeout(r, 300)); }
    if (!okCode(code)) { toast('could not make a squad, try again', 1800); return; }
    p.room.send('soc', { t: 'si', to: id, i: p.myId, n: cleanN(p.name), c: code }, { now: true });
    sentAt.set(id, performance.now()); toast(`⚓ Squad invite sent to <b>${esc(n)}</b>`, 1800);
  }
  function onNet(m, from) {
    const p = pv(); if (!p || !m || m.to !== p.myId || !okId(m.i) || (from && from !== m.i)) return;
    const n = cleanN(m.n) || 'PIRATE';
    if (m.t === 'si' && okCode(m.c)) {
      if (isMuted(n)) return;
      const now = performance.now(); if (invAt.has(m.i) && now - invAt.get(m.i) < 10000) return; invAt.set(m.i, now);
      if (p.party?.code && p.party.code.toUpperCase() === m.c.toUpperCase()) return;
      showInvite(m.i, n, m.c);
    } else if (m.t === 'sn') { sentAt.delete(m.i); toast(`<b>${esc(n)}</b> passed on the squad`, 1600); sig = ''; }
  }
  function showInvite(id, n, code) {
    if (!doc) return; css();
    if (!inv) { inv = doc.createElement('div'); inv.id = 'soc-inv'; inv.hidden = true; doc.body.appendChild(inv); stop(inv); }
    inv.innerHTML = `<span>⚓ <b>${esc(n)}</b> wants you in their squad</span><button type="button" class="go">JOIN</button><button type="button">NO</button>`;
    inv.hidden = false; clearTimeout(invT); invT = setTimeout(() => { inv.hidden = true; }, 20000);
    const [go, no] = inv.querySelectorAll('button');
    go.onclick = (e) => { e.stopPropagation(); inv.hidden = true; pv()?.partyJoin?.(code); toast(`⚓ Joined <b>${esc(n)}</b>'s squad`, 1800); };
    no.onclick = (e) => { e.stopPropagation(); inv.hidden = true; const p = pv(); p?.room?.send?.('soc', { t: 'sn', to: id, i: p.myId, n: cleanN(p.name) }, { now: true }); };
  }

  // ---------- voice chat with your squad ----------
  const voice = (() => {
    let on = ls.get(VOICE_KEY, '0') === '1', micOn = ls.get(MIC_KEY, '1') !== '0', stream = null, asking = false;
    const pcs = new Map(), heard = new Map();
    const can = () => typeof RTCPeerConnection !== 'undefined' && !!navigator?.mediaDevices?.getUserMedia;
    const room = () => pv()?.party?.room || null;
    const mateName = (id) => cleanN(pv()?.party?.mates?.get?.(id)?.n) || '';
    async function getMic() {
      if (stream || asking) return stream; asking = true;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); applyMic(); }
      catch { toast('🎙 Microphone blocked, so you can listen but not talk', 2600); stream = null; }
      asking = false; return stream;
    }
    function applyMic() { for (const t of stream?.getAudioTracks?.() || []) t.enabled = micOn; drawMic(); }
    function drop(id) { const c = pcs.get(id); if (!c) return; try { c.pc.close(); } catch {} try { c.audio.srcObject = null; c.audio.remove(); } catch {} pcs.delete(id); drawMic(); }
    function dropAll() { for (const id of [...pcs.keys()]) drop(id); heard.clear(); if (stream) { for (const t of stream.getTracks()) t.stop(); stream = null; } drawMic(); }
    const gathered = (pc) => new Promise((r) => { if (pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, 2500); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }); });
    function make(id) {
      drop(id);
      const pc = new RTCPeerConnection({ iceServers: ICE }), audio = new Audio(); audio.autoplay = true; audio.muted = isMuted(mateName(id));
      if (doc) { audio.style.display = 'none'; doc.body.appendChild(audio); }
      for (const t of stream?.getAudioTracks?.() || []) pc.addTrack(t, stream);
      if (!stream) pc.addTransceiver('audio', { direction: 'recvonly' });
      pc.ontrack = (e) => { audio.srcObject = e.streams[0] || new MediaStream([e.track]); audio.play?.().catch(() => {}); };
      pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState)) drop(id); drawMic(); };
      const c = { pc, audio, at: performance.now() }; pcs.set(id, c); drawMic(); return c;
    }
    async function call(id) {
      const c = make(id), me = pv()?.myId;
      try { await c.pc.setLocalDescription(await c.pc.createOffer()); await gathered(c.pc); if (pcs.get(id) !== c) return;
        room()?.send('vc', { k: 'o', f: me, to: id, s: c.pc.localDescription.sdp.slice(0, 12000) }); } catch { drop(id); }
    }
    async function onSig(m) {
      const p = pv(); if (!on || !p || !m || !okId(m.f) || m.f === p.myId) return;
      if (m.to && m.to !== p.myId) return;
      if (!p.party?.mates?.has?.(m.f)) return; // only your live squad
      if (m.k === 'h') { heard.set(m.f, performance.now()); return; }
      if (typeof m.s !== 'string' || m.s.length > 12000) return;
      if (m.k === 'o') {
        heard.set(m.f, performance.now()); await getMic(); const c = make(m.f);
        try { await c.pc.setRemoteDescription({ type: 'offer', sdp: m.s }); await c.pc.setLocalDescription(await c.pc.createAnswer()); await gathered(c.pc); if (pcs.get(m.f) !== c) return;
          room()?.send('vc', { k: 'a', f: p.myId, to: m.f, s: c.pc.localDescription.sdp.slice(0, 12000) }); } catch { drop(m.f); }
      } else if (m.k === 'a') { const c = pcs.get(m.f); if (c && c.pc.signalingState === 'have-local-offer') { try { await c.pc.setRemoteDescription({ type: 'answer', sdp: m.s }); } catch { drop(m.f); } } }
    }
    let lastHello = 0;
    function tick() {
      const p = pv(), r = room(), now = performance.now();
      if (!on || !p || !r || !p.party?.code) { if (pcs.size || stream) dropAll(); drawMic(); return; }
      if (!stream && !asking) getMic();
      if (now - lastHello > 4000) { lastHello = now; r.send('vc', { k: 'h', f: p.myId }); }
      for (const [id, at] of heard) { if (now - at > 14000 || !p.party.mates.has(id)) { heard.delete(id); drop(id); } }
      for (const id of heard.keys()) { const c = pcs.get(id); if (!c && p.myId < id) call(id); else if (c && c.pc.connectionState !== 'connected' && now - c.at > 15000 && p.myId < id) call(id); }
      drawMic();
    }
    function applyMutes() { for (const [id, c] of pcs) c.audio.muted = isMuted(mateName(id)); }
    function drawMic() {
      if (!doc) return;
      const show = on && !!pv()?.party?.code;
      if (!mic && show) { css(); mic = doc.createElement('button'); mic.id = 'vc-mic'; mic.type = 'button'; mic.title = 'Squad voice: tap to mute / unmute your mic'; doc.body.appendChild(mic); stop(mic); mic.onclick = (e) => { e.stopPropagation(); setMic(!micOn); }; }
      if (!mic) return; mic.hidden = !show; if (!show) return;
      const live = [...pcs.values()].filter((c) => c.pc.connectionState === 'connected').length;
      mic.classList.toggle('off', !micOn || !stream); mic.innerHTML = `${micOn && stream ? '🎙' : '🔇'}${live ? `<span class="vc-n">${live}</span>` : ''}`;
    }
    function setMic(v) { micOn = !!v; ls.set(MIC_KEY, micOn ? '1' : '0'); applyMic(); toast(micOn ? '🎙 Mic on' : '🔇 Mic muted', 1200); }
    function setOn(v) {
      if (v && !can()) { toast('Voice chat is not supported in this browser', 2200); v = false; }
      on = !!v; ls.set(VOICE_KEY, on ? '1' : '0'); if (!on) dropAll(); else { if (!pv()?.party?.code) toast('🎙 Voice is on: join a squad to talk with them', 2400); tick(); }
      drawBtn();
    }
    let btn = null;
    function drawBtn() { if (btn) btn.textContent = `🎙 SQUAD VOICE CHAT: ${on ? 'ON' : 'OFF'}`; }
    function mountButton() {
      if (!doc || btn) return; const after = doc.getElementById('btn-friends'); if (!after) return;
      btn = doc.createElement('button'); btn.id = 'btn-voice'; btn.type = 'button'; btn.className = 'ghost';
      btn.onclick = (e) => { e.stopPropagation(); setOn(!on); }; after.insertAdjacentElement('afterend', btn); drawBtn();
    }
    return { onSig, tick, setOn, setMic, applyMutes, mountButton, get on() { return on; }, get links() { return pcs.size; }, _pcs: pcs };
  })();

  // ---------- loop ----------
  let vt = 0;
  function loop() {
    const open = !!doc?.documentElement.classList.contains('isle-map-open');
    if (open) { ensurePanel(); if (panel.hidden) { panel.hidden = false; sig = ''; } draw(); }
    else if (panel && !panel.hidden) panel.hidden = true;
    const now = performance.now(); for (const [id, t] of sentAt) if (now - t > 30000) sentAt.delete(id);
    if (now - vt > 1000) { vt = now; voice.tick(); }
  }
  let iv = 0;
  if (doc) { voice.mountButton(); iv = setInterval(loop, 400); }
  return { onNet, onSig: (m) => voice.onSig(m), isMuted, setMuted, players, voice, invite, destroy: () => clearInterval(iv) };
}
