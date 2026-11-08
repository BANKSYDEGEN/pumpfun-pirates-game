// One source of truth for displayed rows and pointer hit grids. Never pad sparse feeds.
export const BOARD_ROWS = 10;
export const WALL_ROW_Y0 = 136, WALL_ROW_H = 30;
export const MAIN_ROW_Y0 = 180, MAIN_ROW_H = 15;
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
