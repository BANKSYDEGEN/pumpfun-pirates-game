// One source of truth for displayed rows and pointer hit grids. Never pad sparse feeds.
export const BOARD_ROWS = 10;
export const WALL_ROW_Y0 = 136, WALL_ROW_H = 30;
export const MAIN_ROW_Y0 = 180, MAIN_ROW_H = 15;
// Phone layout (BANKSY: "boards hard to read on mobile"): bigger title, no subtitle, 10 tall rows filling the panel.
export const COMPACT_ROW_Y0 = 92, COMPACT_ROW_H = 38;
export const wallGrid = (compact = false) => compact ? { y0: COMPACT_ROW_Y0, h: COMPACT_ROW_H } : { y0: WALL_ROW_Y0, h: WALL_ROW_H };
export function wallRow(uv, compact = false) { const { y0, h } = wallGrid(compact), i = Math.floor(((1 - uv.y) * 512 - y0) / h); return i >= 0 && i < BOARD_ROWS ? i : -1; }
// Phones / touch screens get the compact layout and tap-to-read overlay.
export function compactBoards() { try { return typeof matchMedia === 'function' && (matchMedia('(pointer: coarse)').matches || matchMedia('(max-width: 900px)').matches); } catch { return false; } }
export function mainBoardRow(uv) {
 const i = Math.floor(((1 - uv.y) * 384 - MAIN_ROW_Y0) / MAIN_ROW_H);
 return i >= 0 && i < BOARD_ROWS ? i : -1;
}
// Both DEX BOOSTED canvases advance one real event at the same cadence.
export const BOOST_STEP_MS = 2500;
export function boardRows(state, key, now = Date.now()) {
 const rows = state[key] || [];
 if (key !== 'callouts' || rows.length <= BOARD_ROWS) return rows.slice(0, BOARD_ROWS);
 const offset = Math.floor(now / BOOST_STEP_MS) % rows.length;
 return Array.from({ length: BOARD_ROWS }, (_, i) => rows[(offset + i) % rows.length]);
}
