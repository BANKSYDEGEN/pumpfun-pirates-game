// Board art stays full resolution. Upload only changed snapshots, at most once / 3s.
// Minute buckets refresh the existing age/status labels without a perpetual redraw loop.
export const BOARD_MIN_MS = 3000;
export function boardRefreshDue(previous, revision, drawnAt, now, tickMs = 0) {
  if (now - drawnAt < BOARD_MIN_MS) return false;
  return previous !== revision || Math.floor(now / 60000) !== Math.floor(drawnAt / 60000)
    || !!(tickMs && Math.floor(now / Math.max(BOARD_MIN_MS, tickMs)) !== Math.floor(drawnAt / Math.max(BOARD_MIN_MS, tickMs)));
}
// Independent feeds: a new launch must not re-upload every unrelated wall board.
export function boardDataKey(state, key, logos = 0, now = Date.now()) {
  const listKey = k => `${state.updated?.[k] || 0}/${state.status?.[k] || ''}/${state[k]?.length || 0}/${state[k]?.[0]?.mint || ''}`;
  const own = () => {let s=listKey('prices');for(const sym of ['SUNK','AHOY']){const d=state.details?.[sym]||{},tr=state.trades?.[sym]||[];s+=`/${d.updated||0}/${d.holders||0}/${d.curveProgress??''}/${!!d.bonded}/${tr.length}/${tr[0]?.id||''}/${tr[tr.length-1]?.id||''}`;}return s;};
  let flashing=false;const keys=key==='main'?['prices','bonding','trending','callouts','trades']:key==='ours'||key==='prices'?['prices','trades']:[key];for(const k of keys){const f=state.flashes?.[k];for(const id in f)if(f[id]>now){flashing=true;break;}}
  return (flashing?'F/':'')+logos+'/'+(key==='main'?own()+'/'+listKey('bonding')+'/'+listKey('trending')+'/'+listKey('callouts'):(key==='ours'||key==='prices')?own():listKey(key));
}
