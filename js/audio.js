// Tiny synthesized sound kit (no audio files). Starts after a user gesture.
let ctx = null, master = null, noiseBuf = null, rainGain = null;
export let muted = localStorage.getItem('pfp_muted') === '1';

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ctx.destination);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // rain bed
  const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
  rainGain = ctx.createGain(); rainGain.gain.value = 0.05;
  src.connect(hp).connect(rainGain).connect(master); src.start();
}

export function setMuted(m) {
  muted = m; localStorage.setItem('pfp_muted', m ? '1' : '0');
  if (master) master.gain.value = m ? 0 : 0.7;
}

function burst({ dur = 0.8, freq = 400, endFreq = 60, vol = 0.8, type = 'lowpass', delay = 0 }) {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f).connect(g).connect(master); src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

export const sfx = {
  cannon: (v = 1) => { burst({ dur: 0.9, freq: 700, endFreq: 50, vol: 0.9 * v }); burst({ dur: 0.15, freq: 3000, endFreq: 800, vol: 0.3 * v, type: 'bandpass' }); },
  splash: (v = 1) => burst({ dur: 0.5, freq: 2500, endFreq: 400, vol: 0.35 * v, type: 'bandpass' }),
  hit: (v = 1) => { burst({ dur: 0.6, freq: 1200, endFreq: 100, vol: 0.8 * v }); burst({ dur: 0.25, freq: 4000, endFreq: 1500, vol: 0.4 * v, type: 'bandpass' }); },
  thunder: (delay = 0) => burst({ dur: 3.2, freq: 260, endFreq: 30, vol: 0.9, delay }),
  coin: () => {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [988, 1319].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t + i * 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
      o.connect(g).connect(master); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.3);
    });
  },
  // [health drops] soft rising heal chime (sine arpeggio + shimmer)
  heal: () => {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    [523, 659, 784, 1047].forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = fr;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.06); g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.06 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.4);
      o.connect(g).connect(master); o.start(t + i * 0.06); o.stop(t + i * 0.06 + 0.45);
    });
    burst({ dur: 0.35, freq: 6000, endFreq: 3000, vol: 0.08, type: 'highpass', delay: 0.1 });
  },
  sink: () => burst({ dur: 2.5, freq: 500, endFreq: 40, vol: 0.6 }),
  // [Raul] upgrade visuals: short rising chime + shimmer when a ship upgrade is bought (≈0.5 s)
  upgrade: (legendary = false) => {
    if (!ctx || muted) return;
    const t = ctx.currentTime, notes = legendary ? [784, 988, 1175, 1568] : [659, 880, 1319];
    notes.forEach((fr, i) => {
      const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = fr;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + i * 0.07); g.gain.exponentialRampToValueAtTime(0.14, t + i * 0.07 + 0.015); g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + 0.35);
      o.connect(g).connect(master); o.start(t + i * 0.07); o.stop(t + i * 0.07 + 0.4);
    });
    burst({ dur: 0.45, freq: 7000, endFreq: 2500, vol: 0.12, type: 'highpass', delay: 0.05 });
  },
};
