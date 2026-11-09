// Canvas "Get the pump.fun app" plaque: brand font + gold/red/dark, referral code + lowercase URL + optional QR.
import * as THREE from 'three';
import { REFERRAL_CODE, REFERRAL_URL } from './links.js';

const GOLD = '#ffcd77', RED = '#fa0d0d', DARK = '#161616', FONT = '"Just Another Hand", cursive';
const DISPLAY_URL = REFERRAL_URL.replace(/^https?:\/\//, ''); // pump.fun/u/pumpfunpirates

let sharedMat = null, qrImg = null, qrTried = false;

function loadQr() {
  if (qrTried) return qrImg;
  qrTried = true;
  try {
    const im = new Image();
    im.decoding = 'async';
    im.src = 'assets/pumpfun/referral_qr.png';
    qrImg = im;
  } catch { qrImg = null; }
  return qrImg;
}

function paint(g, W, H, qr) {
  const wood = g.createLinearGradient(0, 0, 0, H);
  wood.addColorStop(0, '#5a2a1a'); wood.addColorStop(0.5, '#3e1c10'); wood.addColorStop(1, '#2a120a');
  g.fillStyle = wood; g.fillRect(0, 0, W, H);
  g.globalAlpha = 0.12; g.strokeStyle = '#000';
  for (let y = 4; y < H; y += H / 18) { g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(W * 0.3, y + 3, W * 0.6, y - 3, W, y + 1); g.stroke(); }
  g.globalAlpha = 1;
  const m = Math.round(H * 0.045);
  g.strokeStyle = GOLD; g.lineWidth = Math.max(3, H * 0.035); g.strokeRect(m, m, W - m * 2, H - m * 2);
  g.lineWidth = Math.max(1.5, H * 0.012); g.strokeRect(m * 1.7, m * 1.7, W - m * 3.4, H - m * 3.4);
  // corner bolts
  g.fillStyle = GOLD;
  for (const [cx, cy] of [[m * 1.15, m * 1.15], [W - m * 1.15, m * 1.15], [m * 1.15, H - m * 1.15], [W - m * 1.15, H - m * 1.15]]) {
    g.beginPath(); g.arc(cx, cy, Math.max(3, H * 0.028), 0, Math.PI * 2); g.fill();
  }

  const pad = H * 0.1;
  const hasQr = !!(qr && qr.complete && qr.naturalWidth);
  const qrSize = hasQr ? Math.round(H * 0.52) : 0;
  const textLeft = hasQr ? pad + qrSize + H * 0.08 : 0;
  const textW = W - textLeft - pad;
  const cx = textLeft + textW / 2;

  if (hasQr) {
    const qx = pad, qy = (H - qrSize) / 2;
    g.fillStyle = GOLD; g.fillRect(qx - 4, qy - 4, qrSize + 8, qrSize + 8);
    g.drawImage(qr, qx, qy, qrSize, qrSize);
  }

  g.textAlign = 'center'; g.textBaseline = 'middle';
  const title = 'GET THE PUMP.FUN APP';
  let px = Math.round(H * 0.16);
  g.font = `${px}px ${FONT}`;
  while (px > 22 && g.measureText(title).width > textW * 0.95) { px -= 2; g.font = `${px}px ${FONT}`; }
  const y0 = H * 0.22;
  g.fillStyle = '#1a0a05'; g.fillText(title, cx + 2, y0 + 2);
  g.fillStyle = GOLD; g.fillText(title, cx, y0);

  // red accent rule
  g.fillStyle = RED; g.fillRect(cx - textW * 0.28, H * 0.34, textW * 0.56, Math.max(2, H * 0.012));

  let codePx = Math.round(H * 0.22);
  g.font = `${codePx}px ${FONT}`;
  while (codePx > 26 && g.measureText(REFERRAL_CODE).width > textW * 0.95) { codePx -= 2; g.font = `${codePx}px ${FONT}`; }
  const y1 = H * 0.52;
  g.fillStyle = '#1a0a05'; g.fillText(REFERRAL_CODE, cx + 2, y1 + 2);
  g.fillStyle = GOLD; g.fillText(REFERRAL_CODE, cx, y1);

  let urlPx = Math.round(H * 0.13);
  g.font = `${urlPx}px ${FONT}`;
  while (urlPx > 18 && g.measureText(DISPLAY_URL).width > textW * 0.98) { urlPx -= 2; g.font = `${urlPx}px ${FONT}`; }
  const y2 = H * 0.76;
  g.fillStyle = '#1a0a05'; g.fillText(DISPLAY_URL, cx + 1, y2 + 1);
  g.fillStyle = '#f4e2bb'; g.fillText(DISPLAY_URL, cx, y2);
}

/** Shared MeshBasicMaterial for both HQ app plaques. Cheap canvas; QR loads async then repaints. */
export function appSignMaterial(low = false) {
  if (sharedMat) return sharedMat;
  const c = document.createElement('canvas');
  c.width = low ? 512 : 1024;
  c.height = Math.round(c.width * 0.55);
  const g = c.getContext('2d');
  const qr = loadQr();
  paint(g, c.width, c.height, qr);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  sharedMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, side: THREE.DoubleSide, depthWrite: true });
  const repaint = () => { paint(g, c.width, c.height, qr); tex.needsUpdate = true; };
  if (qr && !qr.complete) qr.onload = repaint;
  else if (qr?.complete) repaint();
  document.fonts?.load?.(`64px ${FONT}`).then(repaint).catch(() => {});
  return sharedMat;
}

export const APP_SIGN = Object.freeze({
  // ~65-70% of the old 4.2x1.575 plaque; fits the west-bay recess between the left tower and the gate buttress
  w: 2.55,
  h: 1.4,
  // town-local: front = dock-gate west recess (lx -25.3), just above head height; hill = east-wall recess south of the door
  front: Object.freeze({ lx: -25.9, yOff: 2.75, lz: -29.18, yaw: 0 }),
  hill: Object.freeze({ lxOff: 0.72, yOff: 2.75, lzOff: -6.8, yaw: Math.PI / 2 }),
  promptR: 3.2,
  label: 'GET THE PUMP.FUN APP',
});

export { DISPLAY_URL, GOLD, RED, DARK };
