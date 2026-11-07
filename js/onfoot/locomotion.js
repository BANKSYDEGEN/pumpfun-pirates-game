// V7 locomotion, baked into PRIVATE clip copies once at load. Do not add rotations
// to the live bones: Three's PropertyMixer skips unchanged (notably root) tracks,
// so even a post-mixer += rotation accumulates until the pirate somersaults.
// All poses below are absolute samples of the authored clip; no live mixer,
// positions, scales, hair, face, tattoo, or mesh data is changed.
import * as THREE from 'three';

const canonical = (name) => name.replace(/[^a-zA-Z]/g, '');
const cache = new WeakMap();
export function locomotionClip(source, female = false) {
  let variants = cache.get(source); if (!variants) cache.set(source, variants = []);
  const key = female ? 1 : 0; if (variants[key]) return variants[key];
  const run = source.name === 'run', clip = source.clone();
  const tracks = Object.fromEntries(source.tracks.filter(t => t.name.endsWith('.quaternion')).map(t => [canonical(t.name.split('.')[0]), t]));
  if (!tracks.root || !tracks.thighL || !tracks.thighR) return source;
  const q = new THREE.Quaternion(), delta = new THREE.Quaternion();
  const e = new THREE.Euler(), x = new THREE.Vector3(1, 0, 0);
  const left = tracks.thighL.createInterpolant(), right = tracks.thighR.createInterpolant();
  const swing = (v) => 2 * Math.atan2(v[0], v[3]);
  // V7 male and female retain the same parent-space joint axes (+X sagittal,
  // +Y up). Female has different joint POSITIONS: never rescale or copy them.
  const count = Math.ceil(source.duration * 60), times = new Float32Array(count + 1);
  for (let i = 0; i <= count; i++) times[i] = source.duration * i / count;
  clip.tracks = clip.tracks.map(track => {
    const bone = canonical(track.name.split('.')[0]);
    if (!track.name.endsWith('.quaternion') || !['root', 'spine', 'upperarmL', 'upperarmR', 'thighL', 'thighR'].includes(bone)) return track;
    const sample = tracks[bone].createInterpolant(), values = new Float32Array((count + 1) * 4);
    for (let i = 0; i <= count; i++) {
      const t = times[i], l = swing(left.evaluate(t)), r = swing(right.evaluate(t));
      const stride = THREE.MathUtils.clamp((l - r) / (run ? 1.7 : 1), -1, 1);
      const yaw = stride * (female ? .038 : .03), roll = -stride * (female ? .018 : .012);
      q.fromArray(sample.evaluate(t));
      if (bone === 'root') {
        // No pitch; <= 2.5 degrees TOTAL pelvis offset. Never tilt the group.
        delta.setFromEuler(e.set(0, yaw, roll)); q.premultiply(delta);
      } else if (bone === 'spine') {
        delta.setFromEuler(e.set(0, -yaw * 1.5, -roll * .8)); q.premultiply(delta);
      } else if (bone.startsWith('thigh')) {
        // Modest longer stride; knees, foot height and all authored translations
        // stay intact. No 1.5x stride multiplier or narrower/crossed female legs.
        q.premultiply(delta.setFromAxisAngle(x, (bone === 'thighL' ? l : r) * (run ? .08 : .18)));
      } else {
        // Hands counter the opposite leg; small natural swing, not a windmill.
        q.premultiply(delta.setFromAxisAngle(x, (bone === 'upperarmL' ? r : l) * (run ? .08 : .16)));
      }
      q.normalize().toArray(values, i * 4);
    }
    return new THREE.QuaternionKeyframeTrack(track.name, times, values);
  });
  return (variants[key] = clip);
}

export function playLocomotion(p, name, speed, fall = false) {
  if (p.clip !== name) {
    const old = p.action, moving = n => n === 'walk' || n === 'run';
    const phase = old && moving(p.clip) ? old.time / old.getClip().duration : null;
    p.play(name, { fade: .2 });
    if (phase !== null && moving(name) && p.action) p.action.time = phase * p.action.getClip().duration;
  }
  if (p.action) p.action.setEffectiveTimeScale(name === 'idle' ? 1 : fall ? 1.7 :
    name === 'run' ? Math.max(.7, speed / 6) : Math.max(.6, speed / 2.4));
}
