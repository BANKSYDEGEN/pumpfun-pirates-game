// [Timothy] THE GOLDEN DOUBLOON CASINO: the table UI (BANKSY via Emerly). One mahogany + brass modal, four tables:
// PIRATE BLACKJACK, BUCCANEER ROULETTE, DEAD MAN'S DICE, TREASURE SLOTS. Opened from the E points inside the hall (js/island/casino.js):
// js/dock/index.js (the game) and js/island/main.js (island.html). Wagers are GOLD only (100 GOLD / 100g); the server decides every result
// (pvp.inv.call('casino_play', ...), js/casino/engine.js createCasinoClient); ?casinoqa=1 or no server casino = the practice table (own purse).
// Styles are injected once (#cas-css). Esc / x closes.
import { CHIPS, MIN_BET, MAX_BET, SLOT_SYMBOLS, SLOT_PAYS, SLOT_PAIR, DICE_BETS, WHEEL, REDS, pocketColor, fmtGold, fmtG, readCard, handTotal, SUIT_GLYPH,
  parseRouletteChoice, rouletteLabel, createCasinoClient } from './engine.js';

export const CASINO_QA = typeof location !== 'undefined' && new URLSearchParams(location.search || '').get('casinoqa') === '1';
const SHORT = { blackjack: 'BLACKJACK', roulette: 'ROULETTE', dice: 'DICE', slots: 'SLOTS' }; // [v339] phone tab labels
const TITLES = { blackjack: 'PIRATE BLACKJACK', roulette: 'BUCCANEER ROULETTE', dice: "DEAD MAN'S DICE", slots: 'TREASURE SLOTS' };
const RULES = { blackjack: 'Blackjack pays 3 to 2 · dealer stands on 17 · double on your first two cards',
  roulette: 'Red / Black · Odd / Even · 1-18 / 19-36 pay 2× · a dozen pays 3× · a single number pays 36×',
  dice: 'Two bones: under 7 pays 2× · a lucky 7 pays 4× · over 7 pays 2× · any doubles pay 5×',
  slots: 'Three 7s 25× · chests 15× · crowns 10× · doubloons 8× · rubies 6× · anchors 4× · skulls 3× · any pair 2×' };

// ---- pirate symbols (inline SVG, no currency marks) ----
const SVG = (inner, vb = '0 0 64 64') => `<svg viewBox="${vb}" aria-hidden="true">${inner}</svg>`;
export const SYM = {
  doubloon: SVG('<circle cx="32" cy="32" r="27" fill="#e0a526" stroke="#8a5a12" stroke-width="3"/><circle cx="32" cy="32" r="21" fill="none" stroke="#ffe08a" stroke-width="2" stroke-dasharray="3 3"/><path d="M19 39h26l3-14-8 6-8-11-8 11-8-6z" fill="#ffd34d" stroke="#8a5a12" stroke-width="2" stroke-linejoin="round"/><circle cx="32" cy="34" r="2.6" fill="#c0262d"/>'),
  anchor: SVG('<circle cx="32" cy="11" r="5" fill="none" stroke="#1f4e8a" stroke-width="4"/><path d="M32 16v38M20 24h24M12 38c2 10 11 16 20 16s18-6 20-16" fill="none" stroke="#1f4e8a" stroke-width="5" stroke-linecap="round"/><path d="M7 42l5-8 6 6zM57 42l-5-8-6 6z" fill="#1f4e8a"/>'),
  skull: SVG('<path d="M32 7c-13 0-21 9-21 21 0 7 3 11 7 14v9h28v-9c4-3 7-7 7-14 0-12-8-21-21-21z" fill="#f2efe6" stroke="#5a4a3a" stroke-width="2"/><circle cx="24" cy="29" r="6" fill="#1c1410"/><circle cx="40" cy="29" r="6" fill="#1c1410"/><path d="M32 35l-3 6h6z" fill="#1c1410"/><path d="M24 51v-5M29 51v-5M35 51v-5M40 51v-5" stroke="#5a4a3a" stroke-width="2"/>'),
  crown: SVG('<path d="M9 46l-3-28 14 12 12-18 12 18 14-12-3 28z" fill="#ffc93c" stroke="#8a5a12" stroke-width="2.5" stroke-linejoin="round"/><rect x="9" y="46" width="46" height="8" rx="2" fill="#e0a526" stroke="#8a5a12" stroke-width="2"/><circle cx="32" cy="38" r="4" fill="#d0103a"/><circle cx="19" cy="40" r="3" fill="#1fa060"/><circle cx="45" cy="40" r="3" fill="#2a5bd0"/>'),
  ruby: SVG('<path d="M32 58L6 24l10-14h32l10 14z" fill="#d0103a" stroke="#6a0820" stroke-width="2.5" stroke-linejoin="round"/><path d="M6 24h52M16 10l8 14 8-14 8 14 8-14M24 24l8 34 8-34" fill="none" stroke="#ff8aa6" stroke-width="1.6" stroke-linejoin="round"/>'),
  chest: SVG('<path d="M8 30c0-12 10-19 24-19s24 7 24 19z" fill="#8a5225" stroke="#3a2414" stroke-width="2.5"/><rect x="8" y="30" width="48" height="24" rx="2" fill="#7a4a26" stroke="#3a2414" stroke-width="2.5"/><path d="M18 13v41M46 13v41" stroke="#2b2f36" stroke-width="4"/><rect x="27" y="27" width="10" height="11" rx="2" fill="#ffc93c" stroke="#8a5a12" stroke-width="1.5"/><circle cx="32" cy="34" r="1.6" fill="#3a2414"/>'),
  seven: SVG('<text x="32" y="54" text-anchor="middle" font-family="Georgia, serif" font-weight="900" font-size="58" fill="#c0262d" stroke="#ffc93c" stroke-width="2.5" paint-order="stroke">7</text>'),
};
const COIN = SYM.doubloon;
const GAME_ICON = { blackjack: '<span class="cas-mini-card">A<i>♠</i></span>', roulette: SVG('<circle cx="32" cy="32" r="26" fill="#3e170f" stroke="#ffc93c" stroke-width="3"/><circle cx="32" cy="32" r="18" fill="none" stroke="#c0262d" stroke-width="7" stroke-dasharray="7 7"/><circle cx="32" cy="32" r="6" fill="#ffc93c"/>'), dice: SVG('<rect x="8" y="14" width="34" height="34" rx="7" fill="#f2efe6" stroke="#5a4a3a" stroke-width="2"/><circle cx="17" cy="23" r="3.4" fill="#1c1c22"/><circle cx="25" cy="31" r="3.4" fill="#1c1c22"/><circle cx="33" cy="39" r="3.4" fill="#1c1c22"/><rect x="30" y="24" width="26" height="26" rx="6" fill="#e9e2d0" stroke="#5a4a3a" stroke-width="2" transform="rotate(14 43 37)"/>'), slots: SYM.seven };

const CSS = `
.cas-ov{position:fixed;inset:0;z-index:80;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(20,8,4,.55),rgba(6,2,1,.86));backdrop-filter:blur(3px);font-family:Georgia,'Times New Roman',serif;color:#f6e7c1;-webkit-user-select:none;user-select:none}
.cas-ov.on{display:flex;animation:casFade .18s ease-out}
@keyframes casFade{from{opacity:0}to{opacity:1}}
.cas-box{position:relative;width:min(1000px,96vw);max-height:95vh;overflow:auto;border-radius:20px;padding:16px 20px 14px;box-sizing:border-box;
 background:repeating-linear-gradient(92deg,rgba(255,255,255,.025) 0 3px,rgba(0,0,0,.035) 3px 9px),linear-gradient(160deg,#5c2414 0%,#3e170c 48%,#2a0e07 100%);
 border:3px solid #c8961e;box-shadow:0 0 0 2px #3a1a08,0 0 0 6px #8a5a12,0 24px 70px rgba(0,0,0,.75),inset 0 0 0 1px rgba(255,214,120,.35),inset 0 0 60px rgba(0,0,0,.55)}
.cas-box:before,.cas-box:after{content:'';position:absolute;width:14px;height:14px;border-radius:50%;top:10px;background:radial-gradient(circle at 35% 35%,#fff3c4,#d4a537 45%,#6a4510);box-shadow:0 1px 2px #000}
.cas-box:before{left:10px}.cas-box:after{right:10px}
.cas-head{display:flex;align-items:center;gap:14px;padding:2px 30px 10px;border-bottom:2px solid rgba(200,150,30,.55);position:relative}
.cas-brand{display:flex;flex-direction:column;line-height:1}
.cas-brand small{font-size:12px;letter-spacing:.32em;color:#e8c46a;opacity:.9}
.cas-brand b{font-size:30px;letter-spacing:.06em;background:linear-gradient(180deg,#fff2b8,#ffc93c 45%,#b9801a);-webkit-background-clip:text;background-clip:text;color:transparent;text-shadow:0 2px 0 rgba(0,0,0,.25);font-weight:900}
.cas-mode{font:700 11px/1 Georgia,serif;letter-spacing:.14em;padding:5px 9px;border-radius:999px;border:1px solid #c8961e;color:#ffe9a8;background:rgba(0,0,0,.35)}
.cas-mode.prac{border-color:#8a1c1c;color:#ffb3a8;background:rgba(110,20,32,.45)}
.cas-sp{flex:1}
.cas-pill{display:flex;align-items:center;gap:8px;padding:6px 16px 6px 7px;border-radius:999px;background:linear-gradient(180deg,#2a1206,#170903);border:2px solid #ffc93c;box-shadow:0 0 14px rgba(255,201,60,.35),inset 0 1px 0 rgba(255,255,255,.15);font:900 20px/1 Georgia,serif;color:#ffe08a;letter-spacing:.04em;transition:transform .2s}
.cas-pill svg{width:28px;height:28px}
.cas-pill.up{animation:casUp .7s}.cas-pill.dn{animation:casDn .7s}
@keyframes casUp{30%{transform:scale(1.12);box-shadow:0 0 26px #ffd34d}}@keyframes casDn{30%{transform:scale(.94);border-color:#c0262d}}
.cas-x{width:38px;height:38px;border-radius:50%;border:2px solid #c8961e;background:radial-gradient(circle at 35% 30%,#7a3322,#3e170f);color:#ffe08a;font:900 22px/1 Georgia,serif;cursor:pointer}
.cas-x:hover{filter:brightness(1.25)}
.cas-tabs{display:flex;gap:8px;margin:10px 0 8px;flex-wrap:wrap}
.cas-tab{flex:1;min-width:150px;display:flex;align-items:center;gap:8px;justify-content:center;padding:8px 10px;border-radius:12px;border:1px solid rgba(200,150,30,.6);background:linear-gradient(180deg,rgba(0,0,0,.25),rgba(0,0,0,.45));color:#e8d3a0;font:700 13px/1 Georgia,serif;letter-spacing:.08em;cursor:pointer}
.cas-tab svg{width:22px;height:22px}.cas-tab.on{background:linear-gradient(180deg,#8a1c1c,#5a1010);border-color:#ffc93c;color:#fff2c4;box-shadow:0 0 12px rgba(255,201,60,.3)}
.cas-mini-card{display:inline-flex;align-items:center;justify-content:center;width:17px;height:22px;border-radius:3px;background:#fff;color:#1c1c22;font:900 11px/1 Georgia,serif}.cas-mini-card i{font-style:normal;font-size:10px}
.cas-felt{position:relative;border-radius:22px;padding:16px;min-height:300px;background:radial-gradient(ellipse at 50% 35%,#2a8a4c 0%,#1f6b3a 45%,#134a28 100%);border:10px solid transparent;
 box-shadow:inset 0 0 0 3px #ffc93c,inset 0 0 40px rgba(0,0,0,.45),0 0 0 3px #3e170f,0 0 0 6px #c8961e;outline:0}
.cas-felt:after{content:'';position:absolute;inset:8px;border:1px dashed rgba(255,214,120,.35);border-radius:14px;pointer-events:none}
.cas-gname{text-align:center;font-weight:900;font-size:22px;letter-spacing:.16em;color:#ffe08a;text-shadow:0 2px 0 #0b2a16;margin:-4px 0 8px}
.cas-row{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap}
.cas-bets{display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:center;margin:12px 0 4px}
.cas-chip{width:54px;height:54px;border-radius:50%;cursor:pointer;border:0;font:900 13px/1 Georgia,serif;color:#fff;position:relative;
 background:radial-gradient(circle,var(--c) 0 52%,#fff 53% 57%,var(--c) 58% 100%);box-shadow:0 3px 0 rgba(0,0,0,.45),inset 0 0 0 3px rgba(255,255,255,.25);text-shadow:0 1px 1px #000}
.cas-chip:before{content:'';position:absolute;inset:2px;border-radius:50%;border:5px dashed rgba(255,255,255,.85);opacity:.75}
.cas-chip.on{transform:translateY(-5px);box-shadow:0 8px 0 rgba(0,0,0,.4),0 0 14px #ffd34d}
.cas-chip:disabled,.cas-adj:disabled,.cas-btn:disabled,.cas-pick:disabled{opacity:.42;cursor:not-allowed;filter:grayscale(.4)}
.cas-adj{padding:9px 13px;border-radius:999px;border:2px solid #c8961e;background:rgba(0,0,0,.4);color:#ffe08a;font:900 14px/1 Georgia,serif;cursor:pointer}
.cas-betv{min-width:120px;text-align:center;padding:8px 14px;border-radius:10px;background:#120703;border:1px solid #8a5a12;font:900 18px/1 Georgia,serif;color:#fff2c4}
.cas-betv small{display:block;font-size:10px;letter-spacing:.2em;color:#c8a560;margin-bottom:3px}
.cas-acts{display:flex;gap:10px;justify-content:center;margin-top:10px;flex-wrap:wrap}
.cas-btn{min-width:130px;padding:12px 20px;border-radius:12px;cursor:pointer;font:900 17px/1 Georgia,serif;letter-spacing:.12em;color:#2a1206;border:2px solid #6a4510;
 background:linear-gradient(180deg,#fff0b0 0%,#ffcf4a 40%,#c8961e 100%);box-shadow:0 4px 0 #6a4510,0 8px 18px rgba(0,0,0,.45),inset 0 1px 0 #fff}
.cas-btn:active:not(:disabled){transform:translateY(3px);box-shadow:0 1px 0 #6a4510}
.cas-btn.red{background:linear-gradient(180deg,#ff8a7a,#c0262d 55%,#7a1018);color:#fff;border-color:#4a0a10;box-shadow:0 4px 0 #4a0a10,0 8px 18px rgba(0,0,0,.45)}
.cas-res{min-height:36px;text-align:center;font:900 26px/1.3 Georgia,serif;letter-spacing:.06em;margin-top:8px}
.cas-res.win{color:#ffe08a;text-shadow:0 0 18px rgba(255,211,77,.8);animation:casPop .5s}.cas-res.lose{color:#ff9a8a}.cas-res.push{color:#e8d3a0}
@keyframes casPop{0%{transform:scale(.6);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
.cas-hist{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;margin-top:6px;min-height:20px}
.cas-hist span{font:700 11px/1 Georgia,serif;padding:4px 7px;border-radius:999px;background:rgba(0,0,0,.35);border:1px solid rgba(200,150,30,.4)}
.cas-hist .w{color:#ffe08a}.cas-hist .l{color:#ff9a8a}
.cas-foot{margin-top:10px;text-align:center;font-size:12px;letter-spacing:.06em;color:#d9c08a;opacity:.9}
.cas-err{color:#ffb3a8;font-size:14px;text-align:center;min-height:18px;margin-top:4px}
/* blackjack */
.cas-hand{display:flex;flex-direction:column;align-items:center;gap:6px;margin:4px 0}
.cas-hand h4{margin:0;font:700 12px/1 Georgia,serif;letter-spacing:.24em;color:#d6f0d0;opacity:.85}
.cas-tot{display:inline-block;min-width:34px;padding:3px 9px;border-radius:999px;background:#0e3a1e;border:1px solid #ffc93c;color:#ffe08a;font:900 14px/1 Georgia,serif;margin-left:6px}
.cas-cards{display:flex;min-height:112px;align-items:center}
.cas-card{width:74px;height:104px;margin:0 -9px;border-radius:9px;background:linear-gradient(160deg,#fffdf6,#efe6d0);border:1px solid #b9a77a;box-shadow:0 6px 14px rgba(0,0,0,.45);position:relative;color:#1c1c22;animation:casDeal .38s cubic-bezier(.2,.8,.3,1.2) both}
.cas-card.red{color:#b3141f}
.cas-card b{position:absolute;top:6px;left:8px;font:900 20px/1 Georgia,serif}.cas-card b i{display:block;font-style:normal;font-size:16px}
.cas-card em{position:absolute;inset:0;display:grid;place-items:center;font:400 40px/1 Georgia,serif;font-style:normal}
.cas-card.back{background:repeating-linear-gradient(45deg,#7a1018 0 6px,#8a1c1c 6px 12px);border:3px solid #ffc93c}
.cas-card.back em{color:#ffc93c;font-size:34px}
@keyframes casDeal{from{transform:translate(160px,-90px) rotate(25deg) scale(.6);opacity:0}to{transform:none;opacity:1}}
/* roulette */
.cas-rl{display:flex;gap:16px;align-items:center;justify-content:center;flex-wrap:wrap}
.cas-wheel{position:relative;width:250px;height:250px;flex:none}
.cas-wheel svg{width:100%;height:100%;filter:drop-shadow(0 8px 14px rgba(0,0,0,.55))}
.cas-wheel .wg{transition:transform 4.2s cubic-bezier(.12,.62,.1,1)}
.cas-wheel .bg{transition:transform 4.2s cubic-bezier(.2,.55,.15,1)}
.cas-ptr{position:absolute;left:50%;top:-6px;width:0;height:0;transform:translateX(-50%);border-left:10px solid transparent;border-right:10px solid transparent;border-top:18px solid #ffc93c;filter:drop-shadow(0 2px 2px #000);z-index:2}
.cas-board{display:grid;grid-template-columns:repeat(13,32px);grid-auto-rows:34px;gap:3px}
.cas-pick{border:1px solid rgba(255,214,120,.55);border-radius:5px;color:#fff;font:900 13px/1 Georgia,serif;cursor:pointer;background:#1c1c22;padding:0}
.cas-pick.r{background:#b3141f}.cas-pick.g{background:#1f9a4a}.cas-pick.o{background:rgba(0,0,0,.3);font-size:11px;letter-spacing:.04em}
.cas-pick.on{outline:3px solid #ffd34d;outline-offset:-1px;box-shadow:0 0 12px #ffd34d;transform:scale(1.06)}
.cas-pick.hit{animation:casHit 1s 3}
@keyframes casHit{50%{box-shadow:0 0 22px #fff,0 0 8px #ffd34d;filter:brightness(1.6)}}
.cas-pocket{font:900 34px/1 Georgia,serif}
/* dice */
.cas-dice{display:flex;gap:26px;justify-content:center;margin:14px 0 6px;perspective:600px}
.cas-die{width:84px;height:84px;border-radius:16px;background:linear-gradient(145deg,#fffdf4,#e3d9c2);box-shadow:0 10px 18px rgba(0,0,0,.5),inset 0 -4px 0 rgba(0,0,0,.12);display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:10px;box-sizing:border-box}
.cas-die i{width:15px;height:15px;border-radius:50%;margin:auto;background:radial-gradient(circle at 35% 35%,#555,#0c0c10);visibility:hidden}
.cas-die.roll{animation:casRoll .9s cubic-bezier(.3,.7,.4,1)}
@keyframes casRoll{0%{transform:translate(-120px,-40px) rotateX(0) rotateZ(0)}40%{transform:translate(30px,10px) rotateX(540deg) rotateZ(200deg)}70%{transform:translate(-8px,-6px) rotateX(700deg) rotateZ(330deg)}100%{transform:none}}
.cas-dbets{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:8px;margin-top:10px}
.cas-dbets .cas-pick{height:54px;font-size:15px;letter-spacing:.06em;background:rgba(0,0,0,.35)}
.cas-dbets .cas-pick small{display:block;font-size:11px;color:#ffe08a;margin-top:3px}
/* slots */
.cas-slot{display:flex;align-items:center;justify-content:center;gap:16px}
.cas-cab{position:relative;padding:18px 18px 16px;border-radius:26px 26px 14px 14px;background:linear-gradient(180deg,#7a3322,#3e170f);border:4px solid #ffc93c;box-shadow:0 0 0 3px #3e170f,0 12px 30px rgba(0,0,0,.6),inset 0 0 22px rgba(0,0,0,.5)}
.cas-cab:before{content:'';position:absolute;left:50%;top:-30px;width:140px;height:44px;transform:translateX(-50%);border-radius:70px 70px 0 0;background:radial-gradient(ellipse at 50% 100%,#ffe9a0,#ffb347 55%,#c8961e);border:4px solid #ffc93c;border-bottom:0;box-shadow:0 0 22px rgba(255,180,70,.7)}
.cas-reels{display:flex;gap:10px;padding:10px;border-radius:12px;background:#120703;box-shadow:inset 0 0 18px #000}
.cas-reel{width:96px;height:288px;overflow:hidden;border-radius:8px;background:linear-gradient(180deg,#bfb39a 0%,#fffdf4 20% 80%,#bfb39a 100%);position:relative}
.cas-reel:after{content:'';position:absolute;left:0;right:0;top:50%;height:2px;background:rgba(192,38,45,.75);transform:translateY(-1px)}
.cas-strip{display:flex;flex-direction:column}
.cas-strip div{height:96px;display:grid;place-items:center}.cas-strip svg{width:70px;height:70px}
.cas-reel.win{box-shadow:0 0 0 3px #ffd34d,0 0 20px #ffd34d}
.cas-lever{width:30px;height:200px;position:relative;cursor:pointer}
.cas-lever:before{content:'';position:absolute;left:12px;top:30px;width:7px;height:150px;border-radius:4px;background:linear-gradient(90deg,#8a6a20,#ffe08a,#8a6a20);transform-origin:50% 100%;transition:transform .25s}
.cas-lever:after{content:'';position:absolute;left:2px;top:6px;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#ff9a8a,#c0262d 60%,#5a0a10);transition:transform .25s}
.cas-lever.pull:before{transform:scaleY(-.35)}.cas-lever.pull:after{transform:translateY(150px)}
.cas-pay{display:grid;grid-template-columns:auto auto;gap:3px 10px;font:700 13px/1.1 Georgia,serif;align-items:center;color:#f6e7c1}
.cas-pay svg{width:22px;height:22px;vertical-align:middle}.cas-pay b{color:#ffe08a}
@media (max-width:720px){.cas-box{padding:10px}.cas-brand b{font-size:21px}.cas-pill{font-size:15px}.cas-board{grid-template-columns:repeat(13,minmax(0,1fr));grid-auto-rows:28px;width:100%;max-width:100%}.cas-pick{font-size:10px;min-width:0}.cas-wheel{width:190px;height:190px}.cas-reel{width:70px;height:210px}.cas-strip div{height:70px}.cas-strip svg{width:52px;height:52px}.cas-card{width:56px;height:80px}.cas-dbets{grid-template-columns:repeat(2,1fr)}.cas-tab{min-width:0;flex:1;font-size:11px;padding:6px 4px}.cas-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;flex-wrap:nowrap}.cas-pay{display:none}.cas-head{flex-wrap:wrap;gap:6px;padding:2px 8px 8px}.cas-brand b{font-size:18px}.cas-x{width:32px;height:32px}}
/* [v339] BANKSY t1793u "optimize ... casino on mobile": touch-native table. No full-screen backdrop blur on phones (the WebGL frame stays
   un-blurred behind it), no double-tap zoom / rubber-band, a merged one-row top bar + side bet rail on landscape phones, a 4-up tab strip and a
   fluid 13-column roulette felt on portrait phones (scrollWidth <= clientWidth at 360 px). */
.cas-ov,.cas-ov button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.cas-ov,.cas-box{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.cas-tab .cas-ts{display:none}
.cas-rl>div:last-child{min-width:0}
@media (pointer:coarse),(max-width:720px),(max-height:540px){.cas-ov{backdrop-filter:none;-webkit-backdrop-filter:none;background:radial-gradient(ellipse at center,rgba(24,9,4,.86),rgba(6,2,1,.96))}
 .cas-box{box-shadow:0 0 0 2px #3a1a08,0 0 0 5px #8a5a12,0 12px 30px rgba(0,0,0,.7)}}
@media (max-width:600px){
 .cas-ov{align-items:stretch}
 .cas-box{width:100vw;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;border-width:2px;padding:calc(6px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(10px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));overflow-x:hidden;overflow-y:auto}
 .cas-box:before,.cas-box:after{display:none}
 .cas-head{gap:8px;padding:2px 0 6px}
 .cas-brand{min-width:0;flex:1}.cas-brand small{font-size:9px;letter-spacing:.2em}
 .cas-brand b{font-size:17px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .cas-mode,.cas-sp{display:none}
 .cas-pill{font-size:14px;padding:4px 10px 4px 4px;white-space:nowrap;flex:none}.cas-pill svg{width:20px;height:20px}
 .cas-x{width:40px;height:40px;flex:none}
 .cas-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:6px 0}
 .cas-tab{min-width:0;flex-direction:column;gap:3px;padding:6px 2px;font-size:10px;letter-spacing:.04em}
 .cas-tab .cas-tl{display:none}.cas-tab .cas-ts{display:inline}
 .cas-felt{padding:10px 8px;border-width:6px;min-height:0;border-radius:16px}
 .cas-gname{font-size:15px;margin:-2px 0 6px;letter-spacing:.1em}
 .cas-rl{flex-direction:column;gap:8px;flex-wrap:nowrap}.cas-rl>div:last-child{width:100%}
 .cas-wheel{width:156px;height:156px}
 .cas-board{grid-template-columns:repeat(13,minmax(0,1fr));grid-auto-rows:34px;gap:2px;width:100%}
 .cas-pick{font-size:11px}.cas-pick.o{font-size:9px;letter-spacing:0;line-height:1.05}
 .cas-reel{width:min(25vw,96px);height:180px}.cas-strip div{height:60px}.cas-strip svg{width:46px;height:46px}
 .cas-cab{padding:12px 10px 10px}.cas-cab:before{display:none}
 .cas-lever,.cas-pay{display:none}
 .cas-card{width:54px;height:78px;margin:0 -6px}.cas-card b{font-size:15px}.cas-card b i{font-size:12px}.cas-card em{font-size:28px}.cas-cards{min-height:84px}
 .cas-die{width:64px;height:64px;padding:7px}.cas-die i{width:11px;height:11px}
 .cas-dbets{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.cas-dbets .cas-pick{height:46px;font-size:13px}
 .cas-bets{gap:5px;margin:8px 0 2px}.cas-chip{width:42px;height:42px;font-size:11px}
 .cas-adj{padding:9px 10px;font-size:12px}.cas-betv{min-width:86px;padding:6px 8px;font-size:15px}
 .cas-acts{gap:6px;flex-wrap:nowrap}.cas-btn{min-width:0;flex:1;padding:13px 6px;font-size:14px;letter-spacing:.05em}
 .cas-res{font-size:18px;min-height:24px;margin-top:4px}.cas-foot{font-size:10px}
}
@media (max-height:540px) and (min-width:560px){
 .cas-ov{align-items:stretch}
 .cas-box{width:100vw;height:100vh;height:100dvh;max-height:100dvh;border-radius:0;border-width:2px;overflow:hidden;
  padding:calc(4px + env(safe-area-inset-top)) calc(8px + env(safe-area-inset-right)) calc(4px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));
  display:grid;grid-template-columns:minmax(0,1fr) 214px;grid-template-rows:40px auto auto minmax(0,1fr) auto;grid-template-areas:"tabs head" "felt bets" "felt err" "felt hist" "felt foot";column-gap:8px}
 .cas-box:before,.cas-box:after{display:none}
 .cas-head{grid-area:head;padding:0;border:0;gap:6px;min-width:0}
 .cas-brand,.cas-mode,.cas-sp{display:none}
 .cas-pill{flex:1;justify-content:center;font-size:14px;padding:3px 8px 3px 3px;white-space:nowrap;min-width:0}.cas-pill svg{width:20px;height:20px}
 .cas-x{width:36px;height:36px;flex:none;font-size:20px}
 .cas-tabs{grid-area:tabs;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px;margin:0;align-self:stretch}
 .cas-tab{min-width:0;padding:3px 4px;font-size:11px;gap:5px;border-radius:9px}.cas-tab svg{width:18px;height:18px}
 .cas-tab .cas-tl{display:none}.cas-tab .cas-ts{display:inline}
 .cas-felt{grid-area:felt;min-height:0;margin-top:4px;padding:6px 8px;border-width:5px;border-radius:14px;overflow:hidden;display:flex;flex-wrap:wrap;align-content:center;justify-content:center;column-gap:6px}
 .cas-felt>*{width:100%}.cas-felt>.cas-hand{width:calc(50% - 6px);margin:0}
 .cas-gname{font-size:13px;margin:0 0 2px;letter-spacing:.12em}
 .cas-bets{grid-area:bets;margin:4px 0 0;gap:4px;align-content:flex-start}
 .cas-chip{width:38px;height:38px;font-size:10px}.cas-chip:before{border-width:4px}
 .cas-adj{padding:7px 9px;font-size:11px}.cas-betv{min-width:0;width:100%;padding:5px 6px;font-size:14px}.cas-betv small{font-size:9px}
 .cas-err{grid-area:err;font-size:11px;min-height:0}.cas-hist{grid-area:hist;align-content:flex-start;overflow:hidden;margin:2px 0 0}.cas-foot{grid-area:foot;font-size:9px;margin:2px 0 0;line-height:1.2}
 .cas-acts{margin-top:4px;gap:6px;flex-wrap:nowrap}.cas-btn{min-width:0;flex:1;max-width:170px;padding:10px 6px;font-size:13px;letter-spacing:.05em}
 .cas-res{font-size:16px;min-height:20px;margin-top:2px}
 .cas-card{width:52px;height:74px;margin:0 -6px}.cas-card b{font-size:14px}.cas-card b i{font-size:11px}.cas-card em{font-size:26px}.cas-cards{min-height:78px}.cas-hand h4{font-size:10px}
 .cas-rl{flex-wrap:nowrap;gap:10px;align-items:center}.cas-wheel{width:140px;height:140px}.cas-rl>div:last-child{flex:1}
 .cas-board{grid-template-columns:repeat(13,minmax(0,1fr));grid-auto-rows:26px;gap:2px;width:100%}.cas-pick{font-size:11px}.cas-pick.o{font-size:9px;letter-spacing:0}
 .cas-rl .cas-row{margin-top:4px!important;font-size:12px}.cas-pocket{font-size:18px}
 .cas-dice{margin:4px 0 2px;gap:18px}.cas-die{width:58px;height:58px;padding:6px;border-radius:12px}.cas-die i{width:10px;height:10px}
 .cas-dbets{grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:4px}.cas-dbets .cas-pick{height:42px;font-size:12px}
 .cas-slot{gap:10px}.cas-cab{padding:8px 8px 7px;border-radius:16px 16px 10px 10px}.cas-cab:before{display:none}
 .cas-reels{gap:6px;padding:6px}.cas-reel{width:76px;height:150px}.cas-strip div{height:50px}.cas-strip svg{width:40px;height:40px}
 .cas-lever{width:24px;height:120px}.cas-lever:before{top:24px;height:90px}.cas-lever:after{width:22px;height:22px}.cas-lever.pull:after{transform:translateY(90px)}
 .cas-pay{display:none}
}
`;
function injectCss() { if (typeof document === 'undefined' || document.getElementById('cas-css')) return; const st = document.createElement('style'); st.id = 'cas-css'; st.textContent = CSS; document.head.appendChild(st); }

const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function createCasinoUi({ pvp = () => null, getGold = () => 0, setGold = () => {}, qa = CASINO_QA, sfx = null, onClose = null, ownKeys = false } = {}) {
  injectCss();
  const client = createCasinoClient({ pvp, getGold, setGold, qa });
  const S = { game: 'blackjack', open: false, busy: false, bet: { blackjack: 50, roulette: 50, dice: 50, slots: 25 }, rl: { kind: 'color', value: 'red' }, dice: 'under7', bj: null, hist: [], wheelDeg: 0, ballDeg: 0, lastGold: null };
  const ov = document.createElement('div'); ov.className = 'cas-ov'; ov.id = 'casino-ui';
  ov.innerHTML = `<div class="cas-box" role="dialog" aria-label="The Golden Doubloon casino">
    <div class="cas-head"><div class="cas-brand"><small>THE GOLDEN DOUBLOON</small><b data-k="title">PIRATE BLACKJACK</b></div>
      <span class="cas-mode" data-k="mode"></span><span class="cas-sp"></span>
      <div class="cas-pill" data-k="pill">${COIN}<span data-k="gold">0 GOLD</span></div>
      <button class="cas-x" data-k="x" title="Close (Esc)">×</button></div>
    <div class="cas-tabs" data-k="tabs"${/[?&]castabs=1(&|$)/.test(location.search) ? '' : ' hidden style="display:none"'}>${Object.keys(TITLES).map(g => `<button class="cas-tab" data-g="${g}">${GAME_ICON[g]}<span class="cas-tl">${esc(TITLES[g])}</span><span class="cas-ts">${esc(SHORT[g])}</span></button>`).join('')}</div>
    <div class="cas-felt" data-k="felt"></div>
    <div class="cas-bets" data-k="bets"></div>
    <div class="cas-err" data-k="err"></div>
    <div class="cas-hist" data-k="hist"></div>
    <div class="cas-foot" data-k="foot"></div></div>`;
  (document.body || document.documentElement).appendChild(ov);
  const q = (k, root = ov) => root.querySelector(`[data-k="${k}"]`);
  ov.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === ov) close(); });
  ov.addEventListener('wheel', (e) => e.stopPropagation(), { passive: true });
  q('x').onclick = () => close();
  q('tabs').querySelectorAll('.cas-tab').forEach(b => { b.onclick = () => { if (!S.busy && !S.bj) show(b.dataset.g); }; });
  const play = (name) => { try { sfx?.(name); } catch { /* sound is optional */ } };

  function gold() { return client.gold(); }
  function paintGold(flash = 0) { const g = gold(); q('gold').textContent = fmtGold(g); const p = q('pill'); p.classList.remove('up', 'dn'); if (flash) { void p.offsetWidth; p.classList.add(flash > 0 ? 'up' : 'dn'); } S.lastGold = g;
    const m = q('mode'); const live = client.mode === 'live'; m.textContent = live ? 'LIVE TABLE' : qa ? 'PRACTICE TABLE · QA PURSE' : 'PRACTICE TABLE · NO GOLD MOVES'; m.classList.toggle('prac', !live); }
  function err(t) { q('err').textContent = t || ''; }
  function result(text, kind) { const r = q('res', q('felt')); if (!r) return; r.className = 'cas-res ' + (kind || ''); r.textContent = text; }
  function hist(delta) { S.hist.unshift(delta); S.hist.length = Math.min(S.hist.length, 10);
    q('hist').innerHTML = S.hist.map(d => `<span class="${d > 0 ? 'w' : d < 0 ? 'l' : ''}">${d > 0 ? '+' : ''}${fmtG(d)}</span>`).join(''); }
  function settleText(res, bet) { const d = res.delta || 0;
    if (res.outcome === 'blackjack') return ['BLACKJACK! +' + fmtGold(d), 'win'];
    if (d > 0) return ['YOU WIN +' + fmtGold(d), 'win']; if (d < 0) return [(res.outcome === 'bust' ? 'BUST · ' : 'THE HOUSE TAKES ') + fmtGold(-d), 'lose']; return ['PUSH · ' + fmtGold(bet) + ' BACK', 'push']; }

  // ---- bet controls ----
  function bets(disabled = false) {
    const b = S.bet[S.game], el = q('bets');
    el.innerHTML = CHIPS.map((c, i) => `<button class="cas-chip${b === c ? ' on' : ''}" data-c="${c}" style="--c:${['#6b7580', '#1f6b3a', '#1f4e8a', '#1c1c22', '#6a1fa0', '#c0262d'][i]}">${c}g</button>`).join('') +
      `<button class="cas-adj" data-a="half">1/2</button><button class="cas-adj" data-a="dbl">2×</button><button class="cas-adj" data-a="max">MAX</button><div class="cas-betv"><small>YOUR BET</small>${fmtG(b)}</div>`;
    el.querySelectorAll('button').forEach(x => { x.disabled = disabled; x.onclick = () => {
      const g = Math.max(MIN_BET, gold()), cap = Math.min(MAX_BET, g); let v = S.bet[S.game];
      if (x.dataset.c) v = +x.dataset.c; else if (x.dataset.a === 'half') v = Math.floor(v / 2); else if (x.dataset.a === 'dbl') v = v * 2; else v = cap;
      S.bet[S.game] = Math.max(MIN_BET, Math.min(cap, v)); play('click'); bets(); }; });
  }
  const betOk = () => { const b = S.bet[S.game]; if (b > gold()) { err('Not enough gold for that bet: lower it with 1/2 or a smaller chip.'); return false; } err(''); return true; };
  async function call(game, body) { const res = await client.play(game, body); paintGold(res.ok ? Math.sign(res.delta || 0) : 0); if (!res.ok) err(res.error ? res.error.toUpperCase() : 'THE TABLE IS CLOSED'); return res; }

  // ---- PIRATE BLACKJACK ----
  function cardHtml(c0, i) { const c = readCard(c0); if (!c) return `<div class="cas-card back" style="animation-delay:${i * 0.12}s"><em>☠</em></div>`;
    const red = c.s === 'H' || c.s === 'D'; return `<div class="cas-card${red ? ' red' : ''}" style="animation-delay:${i * 0.12}s"><b>${c.r}<i>${SUIT_GLYPH[c.s]}</i></b><em>${SUIT_GLYPH[c.s]}</em></div>`; }
  function bjView(st) {
    const f = q('felt'), P = st ? st.player : [], D = st ? st.dealer : [], live = !!(st && !st.finished);
    f.innerHTML = `<div class="cas-gname">PIRATE BLACKJACK</div>
      <div class="cas-hand"><h4>THE DEALER ${D.length ? `<span class="cas-tot">${live ? handTotal(D.filter(Boolean)) + '+' : handTotal(D)}</span>` : ''}</h4><div class="cas-cards">${D.map(cardHtml).join('') || '<div class="cas-card back" style="opacity:.25"><em>☠</em></div>'}</div></div>
      <div class="cas-hand"><div class="cas-cards">${P.map(cardHtml).join('') || '<div class="cas-card back" style="opacity:.25"><em>⚓</em></div>'}</div><h4>YOUR HAND ${P.length ? `<span class="cas-tot">${handTotal(P)}</span>` : ''}</h4></div>
      <div class="cas-acts"><button class="cas-btn" data-a="deal">DEAL</button><button class="cas-btn" data-a="hit">HIT</button><button class="cas-btn" data-a="stand">STAND</button><button class="cas-btn red" data-a="double">DOUBLE</button></div>
      <div class="cas-res" data-k="res"></div>`;
    const btn = (a) => f.querySelector(`[data-a="${a}"]`);
    btn('deal').disabled = live || S.busy; btn('hit').disabled = btn('stand').disabled = !live || S.busy; btn('double').disabled = !live || S.busy || !st.canDouble || (st.bet || S.bet.blackjack) * 2 > gold();
    for (const a of ['deal', 'hit', 'stand', 'double']) btn(a).onclick = () => bjAct(a);
    bets(live || S.busy);
  }
  async function bjAct(a) {
    if (S.busy) return; if (a === 'deal' && !betOk()) return; S.busy = true; err('');
    const bet = S.bet.blackjack, res = await call('blackjack', a === 'deal' ? { bet, action: 'deal' } : { action: a, stateId: S.bj?.stateId, bet: S.bj?.bet || bet });
    S.busy = false;
    if (!res.ok) { if (a !== 'deal') S.bj = null; bjView(S.bj); return; }
    play(a === 'deal' ? 'card' : 'card');
    S.bj = res.finished ? null : { ...res, bet: res.bet || (a === 'double' ? bet * 2 : S.bj?.bet || bet) };
    bjView(res);
    if (res.finished) { const [t, k] = settleText(res, res.bet || bet); result(t, k); hist(res.delta || 0); play(k === 'win' ? 'win' : 'lose'); }
  }

  // ---- BUCCANEER ROULETTE ----
  const STEP = 360 / 37;
  function wheelSvg() {
    const seg = WHEEL.map((n, i) => { const a0 = (i - 0.5) * STEP, a1 = (i + 0.5) * STEP, p = (r, a) => [r * Math.sin(a * Math.PI / 180), -r * Math.cos(a * Math.PI / 180)].map(v => v.toFixed(2)).join(' ');
      const col = n === 0 ? '#1f9a4a' : REDS.has(n) ? '#b3141f' : '#1c1c22';
      return `<path d="M${p(80, a0)} L${p(114, a0)} A114 114 0 0 1 ${p(114, a1)} L${p(80, a1)} A80 80 0 0 0 ${p(80, a0)}Z" fill="${col}" stroke="#c8961e" stroke-width=".8"/>` +
        `<text x="0" y="-100" transform="rotate(${(i * STEP).toFixed(2)})" text-anchor="middle" font-family="Georgia,serif" font-weight="900" font-size="10" fill="#fff">${n}</text>`; }).join('');
    return `<svg viewBox="-130 -130 260 260"><circle r="128" fill="#3e170f" stroke="#c8961e" stroke-width="4"/><circle r="120" fill="#5a2418"/>
      <g class="wg" data-k="wg" style="transform:rotate(${S.wheelDeg}deg)">${seg}<circle r="80" fill="#7a3322" stroke="#c8961e" stroke-width="2"/><circle r="56" fill="url(#casg)"/>
      ${[0, 1, 2, 3].map(k => `<rect x="-4" y="-52" width="8" height="104" rx="4" fill="#ffd34d" transform="rotate(${k * 45})"/>`).join('')}<circle r="12" fill="#ffe9a0" stroke="#8a5a12" stroke-width="2"/></g>
      <g class="bg" data-k="bg" style="transform:rotate(${S.ballDeg}deg)"><circle cx="0" cy="-90" r="6.5" fill="#fffdf6" stroke="#9a8f7a" stroke-width="1"/></g>
      <defs><radialGradient id="casg"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#8a5a12"/></radialGradient></defs></svg>`;
  }
  function rlView() {
    const f = q('felt'), sel = S.rl, on = (c) => { const p = parseRouletteChoice(c); return p && sel && p.kind === sel.kind && String(p.value) === String(sel.value) ? ' on' : ''; };
    let board = `<button class="cas-pick g${on({ kind: 'straight', value: 0 })}" data-c="n:0" style="grid-row:span 3">0</button>`;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 12; c++) { const n = 3 * c + (3 - r); board += `<button class="cas-pick ${REDS.has(n) ? 'r' : ''}${on(n)}" data-c="n:${n}" style="grid-row:${r + 1};grid-column:${c + 2}">${n}</button>`; }
    board += ['1st12', '2nd12', '3rd12'].map((d, i) => `<button class="cas-pick o${on(d)}" data-c="${d}" style="grid-row:4;grid-column:${2 + i * 4} / span 4">${['1ST', '2ND', '3RD'][i]} 12 · 3×</button>`).join('');
    board += [['low', '1-18'], ['even', 'EVEN'], ['red', 'RED'], ['black', 'BLACK'], ['odd', 'ODD'], ['high', '19-36']].map(([c, t], i) => `<button class="cas-pick o${c === 'red' ? ' r' : ''}${on(c)}" data-c="${c}" style="grid-row:5;grid-column:${2 + i * 2} / span 2">${t}</button>`).join('');
    f.innerHTML = `<div class="cas-gname">BUCCANEER ROULETTE</div><div class="cas-rl"><div class="cas-wheel"><div class="cas-ptr"></div>${wheelSvg()}</div>
      <div><div class="cas-board" data-k="board">${board}</div><div class="cas-row" style="margin-top:10px;gap:14px"><span>BET ON: <b data-k="pickl" style="color:#ffe08a">${esc(rouletteLabel(sel))}</b></span><span class="cas-pocket" data-k="pocket"></span></div>
      <div class="cas-acts"><button class="cas-btn" data-a="spin">SPIN THE WHEEL</button></div></div></div><div class="cas-res" data-k="res"></div>`;
    f.querySelectorAll('[data-c]').forEach(b => { b.disabled = S.busy; b.onclick = () => { S.rl = parseRouletteChoice(b.dataset.c); play('click'); rlView(); }; });
    f.querySelector('[data-a="spin"]').disabled = S.busy; f.querySelector('[data-a="spin"]').onclick = rlSpin;
    bets(S.busy);
  }
  async function rlSpin() {
    if (S.busy || !betOk()) return; if (!S.rl) { err('Pick a bet on the table first.'); return; }
    S.busy = true; rlView(); const bet = S.bet.roulette, res = await call('roulette', { bet, choice: S.rl });
    if (!res.ok || res.number === undefined) { S.busy = false; rlView(); return; }
    play('spin'); const i = WHEEL.indexOf(res.number), f = q('felt');
    S.wheelDeg = S.wheelDeg - (S.wheelDeg % 360) + 360 * 5 - i * STEP; S.ballDeg = S.ballDeg - (S.ballDeg % 360) - 360 * 7;   // the pocket ends under the pointer, the ball lands on it
    const wg = q('wg', f), bg = q('bg', f); requestAnimationFrame(() => { wg.style.transform = `rotate(${S.wheelDeg}deg)`; bg.style.transform = `rotate(${S.ballDeg}deg)`; });
    await sleep(4300);
    S.busy = false; rlView(); const col = pocketColor(res.number), pk = q('pocket', q('felt'));
    pk.innerHTML = `<span style="color:${col === 'red' ? '#ff6a5a' : col === 'green' ? '#5fe08a' : '#f6e7c1'}">${res.number} ${col.toUpperCase()}</span>`;
    q('felt').querySelectorAll(`[data-c="n:${res.number}"]`).forEach(b => b.classList.add('hit'));
    const [t, k] = settleText(res, bet); result(t, k); hist(res.delta || 0); play(k === 'win' ? 'win' : 'lose');
  }

  // ---- DEAD MAN'S DICE ----
  const dieHtml = (n) => `<div class="cas-die" data-face="${n}">${Array.from({ length: 9 }, (_, k) => `<i style="visibility:${PIPS[n].includes(k) ? 'visible' : 'hidden'}"></i>`).join('')}</div>`;
  function face(el, n) { el.dataset.face = n; el.querySelectorAll('i').forEach((p, k) => { p.style.visibility = PIPS[n].includes(k) ? 'visible' : 'hidden'; }); }
  function dcView(dice = S.lastDice || [6, 1]) {
    const f = q('felt'), opt = [['under7', 'UNDER 7'], ['seven', 'LUCKY 7'], ['over7', 'OVER 7'], ['doubles', 'DOUBLES']];
    f.innerHTML = `<div class="cas-gname">DEAD MAN'S DICE</div><div class="cas-dice" data-k="dice">${dieHtml(dice[0])}${dieHtml(dice[1])}</div>
      <div class="cas-row"><span class="cas-pocket" data-k="sum"></span></div>
      <div class="cas-dbets">${opt.map(([c, t]) => `<button class="cas-pick${S.dice === c ? ' on' : ''}" data-c="${c}">${t}<small>PAYS ${DICE_BETS[c]}×</small></button>`).join('')}</div>
      <div class="cas-acts"><button class="cas-btn" data-a="roll">ROLL THE BONES</button></div><div class="cas-res" data-k="res"></div>`;
    f.querySelectorAll('[data-c]').forEach(b => { b.disabled = S.busy; b.onclick = () => { S.dice = b.dataset.c; play('click'); dcView(); }; });
    const rb = f.querySelector('[data-a="roll"]'); rb.disabled = S.busy; rb.onclick = dcRoll; bets(S.busy);
  }
  async function dcRoll() {
    if (S.busy || !betOk()) return; S.busy = true; dcView(); const bet = S.bet.dice, res = await call('dice', { bet, choice: S.dice });
    if (!res.ok || !res.dice) { S.busy = false; dcView(); return; }
    play('dice'); const ds = [...q('dice', q('felt')).children]; ds.forEach(d => d.classList.add('roll'));
    const tick = setInterval(() => ds.forEach(d => face(d, 1 + Math.floor(Math.random() * 6))), 70);   // tumbling faces (visual only)
    await sleep(900); clearInterval(tick); ds.forEach((d, k) => { d.classList.remove('roll'); face(d, res.dice[k]); });
    S.lastDice = res.dice; S.busy = false; dcView(res.dice);
    q('sum', q('felt')).textContent = `${res.dice[0]} + ${res.dice[1]} = ${res.sum}${res.dice[0] === res.dice[1] ? ' · DOUBLES' : res.sum === 7 ? ' · LUCKY 7' : ''}`;
    const [t, k] = settleText(res, bet); result(t, k); hist(res.delta || 0); play(k === 'win' ? 'win' : 'lose');
  }

  // ---- TREASURE SLOTS ----
  const randSym = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];   // filler symbols on the moving strip (visual only)
  function slView(reels = S.lastReels || ['seven', 'crown', 'chest']) {
    const f = q('felt'), pays = [...Object.entries(SLOT_PAYS)].map(([s, m]) => `<span>${SYM[s]}${SYM[s]}${SYM[s]}</span><b>${m}×</b>`).join('') + `<span>ANY PAIR</span><b>${SLOT_PAIR}×</b>`;
    f.innerHTML = `<div class="cas-gname">TREASURE SLOTS</div><div class="cas-slot"><div class="cas-cab"><div class="cas-reels" data-k="reels">${reels.map(s => `<div class="cas-reel"><div class="cas-strip"><div>${SYM[randSym()]}</div><div>${SYM[s]}</div><div>${SYM[randSym()]}</div></div></div>`).join('')}</div></div>
      <div class="cas-lever" data-k="lever" title="Pull"></div><div class="cas-pay">${pays}</div></div>
      <div class="cas-acts"><button class="cas-btn" data-a="spin">PULL THE LEVER</button></div><div class="cas-res" data-k="res"></div>`;
    const sb = f.querySelector('[data-a="spin"]'); sb.disabled = S.busy; sb.onclick = slSpin; q('lever', f).onclick = slSpin; bets(S.busy);
  }
  async function slSpin() {
    if (S.busy || !betOk()) return; S.busy = true; const lever = q('lever', q('felt')); lever.classList.add('pull'); setTimeout(() => lever.classList.remove('pull'), 380);
    q('felt').querySelectorAll('button').forEach(b => { b.disabled = true; }); bets(true);
    const bet = S.bet.slots, res = await call('slots', { bet, choice: null });
    if (!res.ok || !res.reels) { S.busy = false; slView(); return; }
    play('spin'); const reels = [...q('reels', q('felt')).children], cell = reels[0].clientHeight / 3 || 96, N = 22;
    const prev = S.lastReels || ['seven', 'crown', 'chest'];
    reels.forEach((r, k) => { const strip = r.firstElementChild, syms = [randSym(), prev[k], ...Array.from({ length: N }, randSym), res.reels[k], randSym()], fi = syms.length - 2;   // starts on what is showing, stops with the result on the pay line
      strip.innerHTML = syms.map(s => `<div>${SYM[s]}</div>`).join(''); strip.style.transition = 'none'; strip.style.transform = 'translateY(0)';
      void strip.offsetWidth; strip.style.transition = `transform ${900 + k * 450}ms cubic-bezier(.25,.1,.25,1.08)`; strip.style.transform = `translateY(${-(fi - 1) * cell}px)`; });
    await sleep(900 + 2 * 450 + 120);
    S.lastReels = res.reels; S.busy = false; slView(res.reels);
    if (res.delta > 0) { const R = [...q('reels', q('felt')).children], [a, b, c] = res.reels; R.forEach((r, k) => { if ((k === 0 && (a === b || a === c)) || (k === 1 && (b === a || b === c)) || (k === 2 && (c === a || c === b))) r.classList.add('win'); }); }
    const [t, k] = settleText(res, bet); result(t, k); hist(res.delta || 0); play(k === 'win' ? 'win' : 'lose');
  }

  // ---- open / close / keys ----
  const VIEWS = { blackjack: () => bjView(S.bj), roulette: rlView, dice: () => dcView(), slots: () => slView() };
  function show(game) { if (!VIEWS[game]) game = 'blackjack'; S.game = game; q('title').textContent = TITLES[game]; q('foot').textContent = RULES[game] + ' · Wagers are in-game GOLD only.';
    q('tabs').querySelectorAll('.cas-tab').forEach(b => b.classList.toggle('on', b.dataset.g === game)); err(''); VIEWS[game](); paintGold(); }
  function open(game = 'blackjack') { S.open = true; ov.classList.add('on'); try { document.exitPointerLock?.(); } catch { /* none */ } show(game); }
  function close() { if (!S.open) return; S.open = false; ov.classList.remove('on'); onClose?.(); }
  function onKey(e) { if (!S.open) return false; const k = e.code || e.key;
    if (e.type === 'keydown') {
      if (k === 'Escape') { close(); return true; }
      if (k === 'Space' || k === 'Enter') { const b = q('felt').querySelector('.cas-btn:not(:disabled)'); b?.click(); return true; }
      if (S.game === 'blackjack') { const m = { KeyH: 'hit', KeyS: 'stand', KeyD: 'double' }[k]; if (m) { q('felt').querySelector(`[data-a="${m}"]:not(:disabled)`)?.click(); return true; } }
    }
    return true; }   // the casino has the keyboard while it is open (no walking, no E)
  if (ownKeys) { const h = (e) => { if (!S.open) return; onKey(e); e.stopImmediatePropagation(); if (e.code !== 'Tab') e.preventDefault(); }; addEventListener('keydown', h, true); addEventListener('keyup', h, true); }
  return { open, close, show, onKey, get isOpen() { return S.open; }, get game() { return S.game; }, client, el: ov, state: S };
}
