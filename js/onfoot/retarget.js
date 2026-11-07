// Share V7 male body animation, retaining the female's proportions and locked
// hair/face tracks. Her Meshy shoulders are narrower and her bind arms slope
// down: copying the raw T-pose keys folds the arms through the waist.
import * as THREE from 'three';
const body = /^(root|spine|head|upperarm[LR]|forearm[LR]|thigh[LR]|shin[LR])$/;
const key = n => n.replace(/[^a-zA-Z]/g, '');
export function sharedBodyClips(female, male) {
  const bones = scene => { const b = {}; scene.traverse(o => { if (o.isBone) b[key(o.name)] = o; }); return b; };
  const f = bones(female.scene), m = bones(male.scene), z = new THREE.Vector3(0,0,1);
  return female.animations.map(clip => {
    const source = male.animations.find(a => a.name === clip.name); if (!source) return clip;
    const out = clip.clone();
    out.duration = source.duration;
    out.tracks = out.tracks.map(track => {
      const name = key(track.name.split('.')[0]);
      if (!body.test(name) || !track.name.endsWith('.quaternion')) return track;
      const ref = source.tracks.find(t => key(t.name.split('.')[0]) === name && t.name.endsWith('.quaternion'));
      if (!ref || !f[name] || !m[name]) return track;
      const t = ref.clone(); t.name = track.name;
      const correction = m[name].quaternion.clone().invert().multiply(f[name].quaternion);
      if (name.startsWith('upperarm')) {
        const side = name.endsWith('L') ? 1 : -1;
        const fd = f['forearm'+name.slice(-1)].position, md = m['forearm'+name.slice(-1)].position;
        // Match the male arm direction, with anatomical clearance for the
        // female hip/shoulder ratio (not a different swing or animation).
        correction.premultiply(new THREE.Quaternion().setFromAxisAngle(z,
          Math.atan2(md.y, Math.abs(md.x))*side - Math.atan2(fd.y, Math.abs(fd.x))*side + side*.18));
      }
      const q = new THREE.Quaternion();
      for (let i=0;i<t.values.length;i+=4) q.fromArray(t.values,i).multiply(correction).normalize().toArray(t.values,i);
      return t;
    });
    return out;
  });
}
