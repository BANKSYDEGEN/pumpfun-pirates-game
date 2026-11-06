// [v335] BANKSY t1785u: "Also remove all the street signs that got added" — the [map-streets] 3D wooden junction signposts are removed.
// Zero meshes: this stays only as a no-op so any old import keeps working (PUMPFUN PIRATES 2D map streets / HUD location are unchanged).
export function createStreetSigns() { return { root: null, clear() {}, tick() {} }; }
