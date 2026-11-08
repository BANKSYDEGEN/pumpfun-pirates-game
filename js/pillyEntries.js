// Companion ownership is server-owned and independent of bag capacity/trading.
export const PILLY_HULL_SPOT = Object.freeze({ x: -4.96, z: 1.15, r: 1.35, label: 'PILLY · NAME & LEVEL UP' });
export function pillyInventoryEntry(pilly, doc = document) {
  if (!pilly?.state?.owned) return null;
  const entry = doc.createElement('button'); entry.type = 'button';
  entry.className = 'iv-slot iv-pilly-companion';
  entry.style.cssText = 'min-height:96px;white-space:normal;color:inherit;font:inherit;cursor:pointer';
  entry.setAttribute('aria-label', 'Pilly companion · level up');
  entry.innerHTML = `<i>💊</i><span>PILLY · LV ${Math.max(0, pilly.state.lv | 0)}</span><b>LEVEL UP</b>`;
  entry.onclick = () => pilly.open();
  return entry;
}
export function installPillyInventory(pilly) {
  let bag = null;
  function sync() {
    if (!bag?.isConnected) return;
    bag.querySelector('.iv-pilly-companion')?.remove();
    const entry = pillyInventoryEntry(pilly);
    if (entry) bag.querySelector('.iv-grid')?.append(entry);
  }
  window.addEventListener('pfp-inv-render', e => {
    bag = e.detail?.mode === 'bag' ? e.detail.el : null;
    sync();
    if (bag && pilly.state.avail == null) pilly.refresh();
  });
  window.addEventListener('pfp-pilly-change', sync);
}
