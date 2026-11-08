import * as THREE from 'three';
// Desktop gets 2x logical pixels; phones retain 1x even on 3x DPR screens.
// Capped textures keep the six lazy wall canvases within a modest mobile budget.
export function boardScale(low = false) { return low ? 1 : 2; }
export function boardCanvas(w, h, low = false) {
 const cv = document.createElement('canvas'), scale = boardScale(low);
 cv.width = Math.round(w * scale); cv.height = Math.round(h * scale); return cv;
}
export function boardTexture(cv, low = false) {
 const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
 tex.anisotropy = low ? 4 : 8;
 tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
 tex.generateMipmaps = true; return tex;
}
