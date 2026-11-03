// [Timothy] COLOUR pickers for Emerly's island shop. Free, any time, re-dress your on-foot pirate + your captain at once and save
// (setLocalGear); other players see the pick (one digit each in 'gr'). Self-contained: inline styles, no CSS file, phones + mouse + keyboard.
//   kind 'hat'  : HAT COLOUR, 12 swatches + DEFAULT (the hat's own colour) (BANKSY: "they can pick their ... hat color")
//   kind 'cloth': CLOTHES COLOUR (BANKSY: "can change clothes colors"): 12 swatches + SHIP (= match your ship skin, the default)
//   kind 'look' : SKIN + HAIR, the captain creator's colours (BANKSY: "skin color and hair color choice"): curated lists, natural tones first
//
//   import { openGearColorPicker } from './gearColorPicker.js';
//   const close = openGearColorPicker({ kind: 'hat' | 'look', onPick(key, i) {}, onClose() {} });   // i = swatch index (0 = DEFAULT)
import { HAT_SWATCHES, SKIN_SWATCHES, HAIR_SWATCHES, EYE_SWATCHES, CLOTH_SWATCHES, outfitColors, getLocalColors, hatColorHex, getLocalGear, setLocalGear } from './pirateGear.js';

const BASE_SKIN = '#d99b6c', BASE_HAIR = '#2b1b12';   // Raul's baked defaults (js/pirates.js lookColors index 0)
let _open = null;
export function openGearColorPicker({ kind = 'hat', onPick = null, onClose = null, parent = document.body, title = null } = {}) {
  _open?.();
  const g = getLocalGear(), hat = g.hat !== 'none' ? g.hat : 'tricorn';
  const wrap = document.createElement('div'); wrap.className = kind === 'look' ? 'pfp-hatcolor pfp-lookcolor' : 'pfp-hatcolor';
  wrap.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);font:700 13px/1.2 system-ui,sans-serif;color:#fff2c4';
  const box = document.createElement('div');
  box.style.cssText = 'box-sizing:border-box;background:#2a1a0e;border:3px solid #e9b949;border-radius:12px;padding:12px 12px 10px;width:min(92vw,440px);max-height:92vh;overflow-y:auto;box-shadow:0 8px 30px rgba(0,0,0,.6)';
  wrap.appendChild(box);
  const section = (label, key, items) => {
    const h = document.createElement('div'); h.style.cssText = 'letter-spacing:.08em;margin:2px 0 8px;text-align:center'; h.textContent = label;
    const grid = document.createElement('div'); grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(58px,1fr));gap:6px;margin-bottom:10px';
    const btns = items.map(([name, hex], i) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset[key] = String(i); b.title = name;
      b.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;padding:6px 2px;border-radius:8px;cursor:pointer;background:#1a0f08;color:inherit;font:inherit;font-size:10px;border:2px solid transparent;min-height:44px';
      b.innerHTML = `<i style="display:block;width:30px;height:30px;border-radius:50%;background:${hex};box-shadow:inset 0 -4px 0 rgba(0,0,0,.25),0 0 0 2px rgba(255,255,255,.15)"></i>${name}`;
      b.onclick = (e) => { e.stopPropagation(); setLocalGear({ [key]: i }); mark(i); try { onPick?.(key, i); } catch (err) { console.warn(err); } };
      grid.appendChild(b); return b;
    });
    const mark = (i) => btns.forEach((b, k) => { b.style.borderColor = k === i ? '#e9b949' : 'transparent'; b.setAttribute('aria-pressed', String(k === i)); });
    mark(g[key] || 0); box.append(h, grid);
  };
  if (kind === 'cloth') {
    section(title || 'CLOTHES COLOUR', 'outfitColor', [['SHIP', outfitColors(g.outfit !== 'shirtless' ? g.outfit : 'tank', getLocalColors()).cloth], ...CLOTH_SWATCHES]);
    const r = document.createElement('button'); r.type = 'button'; r.className = 'pfp-cloth-reset'; r.textContent = '↺ RESET TO SHIP COLOURS';
    r.style.cssText = 'display:block;margin:0 auto 8px;padding:6px 14px;border-radius:8px;border:2px solid #e9b949;background:transparent;color:#fff2c4;font:inherit;cursor:pointer;min-height:36px';
    r.onclick = (e) => { e.stopPropagation(); setLocalGear({ outfitColor: 0 }); box.querySelectorAll('[data-outfit-color]').forEach((b, k) => { b.style.borderColor = k === 0 ? '#e9b949' : 'transparent'; b.setAttribute('aria-pressed', String(k === 0)); }); try { onPick?.('outfitColor', 0); } catch {} };
    box.append(r);
  } else if (kind === 'look') {
    // [v112] BANKSY: BODY pick, Male / Female (free, any time; your pirate + captain re-bake live, gear stays on; your own voice follows it)
    const h = document.createElement('div'); h.style.cssText = 'letter-spacing:.08em;margin:2px 0 8px;text-align:center'; h.textContent = 'BODY';
    const row = document.createElement('div'); row.className = 'pfp-body-pick'; row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px';
    const bb = [['♂ MALE', 0], ['♀ FEMALE', 1]].map(([name, v]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.body = String(v); b.textContent = name;
      b.style.cssText = 'padding:10px 4px;border-radius:8px;cursor:pointer;background:#1a0f08;color:inherit;font:inherit;font-size:12px;border:2px solid transparent;min-height:44px';
      b.onclick = (e) => { e.stopPropagation(); setLocalGear({ body: v }); markB(v); try { onPick?.('body', v); } catch (err) { console.warn(err); } }; row.appendChild(b); return b; });
    const markB = (v) => bb.forEach((b, k) => { b.style.borderColor = k === v ? '#e9b949' : 'transparent'; b.setAttribute('aria-pressed', String(k === v)); });
    markB(g.body | 0); box.append(h, row);
    section(title || 'SKIN TONE', 'skinColor', [['DEFAULT', BASE_SKIN], ...SKIN_SWATCHES]); section('HAIR + BEARD', 'hairColor', [['DEFAULT', BASE_HAIR], ...HAIR_SWATCHES]); section('EYES', 'eyeColor', [['BROWN', EYE_SWATCHES[0][1]], ...EYE_SWATCHES]); { const gr = box.lastElementChild; const dup = gr?.children?.[1]; if (dup) dup.style.display = 'none'; } } // [v118] 0 = DEFAULT = BROWN (BANKSY: default brown); swatch 1 (BROWN again) is hidden
  else section(title || 'HAT COLOUR', 'hatColor', [['DEFAULT', hatColorHex(hat, 0)], ...HAT_SWATCHES]);
  const done = document.createElement('button'); done.type = 'button'; done.textContent = 'DONE';
  done.style.cssText = 'display:block;margin:4px auto 0;padding:8px 26px;border-radius:8px;border:0;background:#e9b949;color:#2a1a0e;font:inherit;cursor:pointer;min-height:40px';
  box.append(done); parent.appendChild(wrap);
  const key = (e) => { if (e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); close(); } };
  function close() { if (!wrap.isConnected) return; wrap.remove(); removeEventListener('keydown', key, true); _open = null; try { onClose?.(); } catch (err) { console.warn(err); } }
  done.onclick = close; wrap.onclick = (e) => { if (e.target === wrap) close(); }; addEventListener('keydown', key, true);
  return (_open = close);
}
