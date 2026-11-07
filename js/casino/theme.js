// Golden Doubloon presentation layer. CSS/SVG only: no texture allocations or WebGL work.
export const CASINO_THEME = `
.cas-ov{--brass:#d6b16b;--ivory:#fff0ce;--ink:#081c1b;background:radial-gradient(ellipse at 50% 35%,#12332dcc,#030b0cf5);color:var(--ivory);font-family:system-ui,-apple-system,'Segoe UI',sans-serif}
.cas-box{width:min(1060px,95vw);padding:22px 26px 18px;border:1px solid #e0bf7b;border-radius:16px;
 background:repeating-linear-gradient(94deg,#ffffff02 0 2px,#00000003 2px 7px),linear-gradient(135deg,#30251c,#191b19 48%,#292018);
 box-shadow:0 0 0 4px #1a110c,0 0 0 5px #896b3d,0 30px 100px #000c,inset 0 0 0 5px #d6b16b12}
.cas-box:before,.cas-box:after{width:28px;height:28px;top:9px;border-radius:0;background:none;border-top:2px solid var(--brass);box-shadow:none;pointer-events:none}
.cas-box:before{left:9px;border-left:2px solid var(--brass)}.cas-box:after{right:9px;border-right:2px solid var(--brass)}
.cas-head{gap:18px;padding:0 8px 17px;border-bottom:1px solid #d6b16b4d}
.cas-brand{gap:7px}.cas-brand small{font:700 10px/1.1 system-ui,sans-serif;letter-spacing:.28em;color:#dfc694;opacity:1}
.cas-brand b{font:700 clamp(19px,2.6vw,30px)/1.12 Georgia,serif;letter-spacing:.035em;color:#ffe9b4;background:none;text-shadow:0 2px 3px #0009}
.cas-mode{font:700 9px/1.2 system-ui,sans-serif;letter-spacing:.12em;border-color:#76bfa667;color:#b7ead3;background:#13392e;padding:7px 9px}
.cas-mode.prac{color:#ffdca5;background:#49351c;border-color:#b6965b}
.cas-pill{border:1px solid #b99859;border-radius:9px;padding:8px 13px 8px 9px;gap:9px;background:linear-gradient(160deg,#162b28,#0b1716);box-shadow:inset 0 1px #ffedbd20;color:#ffe3a0;font:700 19px/1.1 Georgia,serif;white-space:nowrap}
.cas-pill small{display:block;font:700 9px/1.3 system-ui,sans-serif;color:#c4d0c8;letter-spacing:.2em;margin-bottom:3px}.cas-pill svg{width:34px;height:34px}
.cas-x{width:42px;height:42px;border:1px solid #b9985980;background:#0b1716;border-radius:9px;font:400 25px/1 system-ui,sans-serif;color:#edd2a2}
.cas-table-label{display:flex;align-items:center;gap:8px;margin:12px 4px 10px;font:600 9px/1.3 system-ui,sans-serif;letter-spacing:.19em;color:#d2bd97}
.cas-table-label>span:first-child{width:23px;height:23px;display:grid;place-items:center}.cas-table-label svg{width:23px;height:23px}.cas-table-no{margin-left:auto;color:#b5c4bc}
.cas-felt{isolation:isolate;padding:20px 22px 14px;border:5px solid #0b211d;border-radius:16px;
 background:repeating-linear-gradient(0deg,#ffffff02 0 1px,transparent 1px 3px),radial-gradient(ellipse at 50% 20%,#1f5b49,#103b32 65%,#082a25);
 box-shadow:0 0 0 1px #d6b16b99,0 4px 0 #0b100e,inset 0 0 50px #00110b88;min-height:300px}
.cas-felt:after{inset:9px;border:1px solid #d6b16b35;border-radius:9px;z-index:-1}
.cas-gname{font:700 12px/1.4 system-ui,sans-serif;letter-spacing:.24em;color:#d9bf8a;margin:0 0 14px;text-shadow:none}
.cas-hand{gap:9px;margin:9px 0}.cas-hand h4{font:600 10px/1.2 system-ui,sans-serif;letter-spacing:.2em;color:#cfdfd6;opacity:1}
.cas-tot{font:700 13px/1.1 system-ui,sans-serif;border-color:#b99c60;background:#082a25;padding:4px 10px}
.cas-cards{gap:3px;min-height:118px;padding:0 12px}
.cas-card{width:78px;height:110px;margin:0 -6px;border-radius:7px;background:radial-gradient(ellipse at 30% 20%,#fffef7,#f3e9d1);border:1px solid #d1bd89;
 box-shadow:0 8px 11px #00140c66,inset 0 0 0 3px #fffdf7,inset 0 0 0 4px #c5af7d60;color:#172c30}
.cas-card.red{color:#aa2434}.cas-card b{top:7px;left:7px;font-size:18px}.cas-card b i{font-size:13px}.cas-card em{font-size:37px}
.cas-card b.cas-card-bottom{top:auto;left:auto;right:7px;bottom:7px;transform:rotate(180deg)}
.cas-card.back{border:1px solid #d2b579;background:repeating-linear-gradient(45deg,transparent 0 5px,#e4ca8722 5px 6px),repeating-linear-gradient(-45deg,#163c3c 0 5px,#e4ca8722 5px 6px);box-shadow:inset 0 0 0 4px #0d2729,inset 0 0 0 5px #d2b579,0 8px 11px #00140c66}
.cas-card.back em{inset:20px 13px;border:1px solid #d6b16b88;border-radius:50%;font-size:29px;color:#e2c78d}
.cas-bets{gap:9px;padding:16px 0 11px;margin:5px 0 0;border-bottom:1px solid #d6b16b30}
.cas-chip{width:52px;height:52px;min-width:44px;min-height:44px;font:800 12px/1 system-ui,sans-serif;
 background:radial-gradient(circle at 35% 25%,#ffffff26,transparent 60%),radial-gradient(circle,var(--c) 0 53%,#f2dfb6 54% 58%,var(--c) 59%);box-shadow:0 3px 0 #080e10,inset 0 0 0 1px #ead5a291;transition:transform .14s,box-shadow .14s}
.cas-chip:before{inset:3px;border-width:4px;opacity:.8}.cas-chip:after{content:'';position:absolute;inset:10px;border:1px dotted #fff8;border-radius:50%;pointer-events:none}
.cas-chip.on{transform:translateY(-4px);box-shadow:0 6px 0 #080e10,0 0 0 2px #efd08d,0 0 17px #efc46d45}
.cas-adj{padding:9px 12px;border:1px solid #9a855e80;background:linear-gradient(#26332d,#15211e);border-radius:7px;font:700 12px/1 system-ui,sans-serif;color:#f1dfb9}
.cas-betv{min-width:110px;padding:9px 14px;border-color:#d4b37188;border-radius:8px;background:#0a1715;font:700 20px/1.1 Georgia,serif;color:#ffe9b6}
.cas-betv small{font:700 9px/1.2 system-ui,sans-serif;letter-spacing:.17em;color:#c5cbbd;margin-bottom:4px}
.cas-acts{gap:10px;margin-top:15px}.cas-btn{min-width:150px;min-height:48px;border:1px solid #eacb87;border-radius:7px;padding:13px 22px;
 font:800 12px/1.2 system-ui,sans-serif;letter-spacing:.14em;background:linear-gradient(#ffe7ac,#d5ae62 55%,#b8873c);color:#282116;box-shadow:0 3px 0 #775022,inset 0 1px #fff7d2,0 6px 12px #0004;transition:filter .12s,transform .12s}
.cas-btn.red{background:linear-gradient(#a94e46,#702e2e);border-color:#cf8d76;color:#ffedcf;box-shadow:0 3px 0 #431c1a,inset 0 1px #ffd2b933}
.cas-ov button:hover:not(:disabled){filter:brightness(1.14)}.cas-ov button:active:not(:disabled){transform:translateY(2px)}
.cas-ov button:focus-visible,.cas-ov .pad-focus{outline:3px solid #fff2ba;outline-offset:3px}
.cas-btn:disabled{box-shadow:none}.cas-ticket{font:500 12px/1.5 system-ui,sans-serif;letter-spacing:.02em;color:#e0d1b4;margin:10px 0}
.cas-receipt-label{text-align:center;font:600 8px/1.4 system-ui,sans-serif;letter-spacing:.14em;color:#c9bd9f;margin:0 0 6px}
.cas-receipt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#b2975a44;border:1px solid #b2975a44;border-radius:9px;overflow:hidden;margin:0 auto 10px;max-width:660px}
.cas-receipt>div{background:#0c1d1c;padding:10px 14px;text-align:center;min-width:0}.cas-receipt small{display:block;font:600 9px/1.4 system-ui,sans-serif;letter-spacing:.12em;color:#bfc8bb;margin-bottom:4px}.cas-receipt small span{letter-spacing:0}
.cas-receipt b{font:700 18px/1.2 Georgia,serif;color:#f7e5bd;white-space:nowrap}.cas-receipt[data-outcome=win]>div:last-child{background:#153c2c}.cas-receipt[data-outcome=win]>div:last-child b{color:#ffe2a1}.cas-receipt[data-outcome=lose]>div:last-child b{color:#ffb6a4}
.cas-res{min-height:31px;margin:11px 0 0;font:700 23px/1.35 Georgia,serif;letter-spacing:.035em}.cas-res.win{text-shadow:0 0 22px #f7d48690;color:#ffe4a2}.cas-res.lose{color:#ffc1ad;animation:casLoss .4s ease-out}.cas-res.push{color:#d0dfd6}
@keyframes casLoss{0%,100%{transform:translateX(0)}25%{transform:translateX(-4px)}65%{transform:translateX(3px)}}
.cas-hist{gap:5px;margin-top:8px;min-height:0}.cas-hist:not(:empty):before{content:'RECENT';align-self:center;font:600 8px/1 system-ui,sans-serif;letter-spacing:.15em;color:#c4b496;margin-right:3px}.cas-hist span{font:600 10px/1 system-ui,sans-serif;background:#101e1b;border-color:#baa16a44;padding:5px 8px}
.cas-foot{font:400 11px/1.6 system-ui,sans-serif;color:#c9c1aa;letter-spacing:.01em;opacity:1;margin:12px auto 0;max-width:840px}.cas-err{font:600 12px/1.4 system-ui,sans-serif;min-height:0}.cas-err:not(:empty){padding:9px;border:1px solid #ffae8670;background:#702e2e44;border-radius:6px}
.cas-board-hint{display:none;text-align:center;font:500 10px/1.4 system-ui,sans-serif;color:#d9cfb5;margin-bottom:6px}.cas-board-hint>span:last-child{display:none}html.pfp-pad .cas-board-hint>span:first-child{display:none}html.pfp-pad .cas-board-hint>span:last-child{display:inline}
.cas-wheel{width:260px;height:260px}.cas-wheel svg{filter:drop-shadow(0 10px 9px #001a1399)}.cas-board{grid-template-columns:repeat(13,34px);grid-auto-rows:38px;gap:3px}
.cas-pick{border:1px solid #bda16c80;border-radius:4px;background:#102323;font:700 12px/1.2 system-ui,sans-serif;box-shadow:inset 0 1px #fff1;color:#fff4dd}.cas-pick.r{background:linear-gradient(#a23a3d,#77252d)}.cas-pick.g{background:#25644a}.cas-pick.o{font:700 10px/1.2 system-ui,sans-serif;background:#0c2e26}.cas-pick.o.r{background:#882e35}
.cas-pick.on{outline:2px solid #ffe4a2;outline-offset:-3px;box-shadow:inset 0 0 14px #f0c87533;transform:none}.cas-pocket{font:700 25px/1.1 Georgia,serif}.cas-rl .cas-row{font:500 11px/1.3 system-ui,sans-serif;color:#e0d5bb}
.cas-dice{margin:22px 0 18px;gap:30px}.cas-die{border:1px solid #d6c493;background:linear-gradient(140deg,#fffdf2,#ecdcbb);box-shadow:0 12px 14px #00170f77,inset 0 2px #fff,inset 0 -5px #bba77b66}.cas-die i{background:radial-gradient(circle at 55% 60%,#354846,#0b1a1b);box-shadow:inset 0 2px 2px #0009}
.cas-dbets{gap:10px;margin-top:18px}.cas-dbets .cas-pick{height:60px;font:700 13px/1.2 system-ui,sans-serif;letter-spacing:.08em;background:#0a2b24}.cas-dbets .cas-pick small{font:500 10px/1.3 system-ui,sans-serif;color:#cfc399;margin-top:6px}
.cas-cab{border:2px solid #d6b16b;border-radius:18px 18px 10px 10px;background:linear-gradient(145deg,#715037,#2b201a 60%,#433324);padding:16px;box-shadow:0 0 0 3px #15241e,0 10px 18px #00150e88,inset 0 1px #fff3}
.cas-cab:before{background:linear-gradient(#f5da9c,#c69a4e);border:2px solid #e6c685;height:26px;top:-20px;box-shadow:0 0 18px #e7ba5d22}
.cas-reels{gap:8px;border:1px solid #bba16a66;padding:8px;background:#091715;box-shadow:inset 0 0 16px #0009}.cas-reel{background:linear-gradient(#98896a,#fff5dc 26% 74%,#98896a);border-radius:4px}.cas-reel:after{height:96px;top:50%;transform:translateY(-50%);background:#f9da7020;border-block:1px solid #b5533b88;pointer-events:none;box-sizing:border-box}
.cas-pay{font:600 11px/1.3 system-ui,sans-serif;gap:6px 14px;padding:12px;border:1px solid #d6b16b44;border-radius:8px;background:#0a2721}.cas-pay b{font:700 15px/1 Georgia,serif}
.cas-coins{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:5;border-radius:inherit}.cas-coins i{position:absolute;left:calc(50% - 13px);top:65%;width:26px;height:26px;animation:casCoinArc 1s cubic-bezier(.15,.55,.5,1) both}.cas-coins svg{width:100%;height:100%;filter:drop-shadow(0 2px 2px #0005)}
@keyframes casCoinArc{0%{transform:translate(0,0) scale(.5);opacity:0}15%{opacity:1}60%{transform:translate(var(--dx),var(--dy)) rotate(var(--rot));opacity:1}100%{transform:translate(var(--dx),60px) rotate(var(--rot)) scale(.7);opacity:0}}
.cas-sr{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media(max-width:900px){.cas-head{gap:10px}.cas-mode{max-width:125px;text-align:center}.cas-wheel{width:210px;height:210px}.cas-board{grid-template-columns:repeat(13,30px)}}
@media(max-width:600px){
 .cas-box{width:100vw;max-height:100dvh;height:100dvh;border-radius:0;padding:calc(12px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) calc(14px + env(safe-area-inset-bottom)) calc(12px + env(safe-area-inset-left));border-width:1px}
 .cas-head{gap:8px;padding:0 0 10px}.cas-brand{flex:1 1 45%;gap:4px}.cas-brand b{font-size:17px;white-space:normal}.cas-brand small{font-size:8px;letter-spacing:.14em}.cas-mode.prac{max-width:none;padding:5px;font-size:9px}.cas-pill{font-size:14px;padding:6px;gap:5px}.cas-pill small{font-size:8px;letter-spacing:.12em}.cas-pill svg{width:24px;height:24px}.cas-x{width:40px;height:40px}
 .cas-table-label{font-size:8px;letter-spacing:.08em;margin:9px 0}.cas-table-label>span:first-child,.cas-table-label svg{width:20px;height:20px}
 .cas-felt{padding:13px 10px 10px;min-height:0;border-width:4px}.cas-gname{font-size:10px;letter-spacing:.2em;margin-bottom:9px}
 .cas-cards{min-height:88px;gap:2px}.cas-card{width:56px;height:80px;margin:0 -5px}.cas-card b{font-size:14px;top:5px;left:5px}.cas-card b i{font-size:10px}.cas-card b.cas-card-bottom{right:5px;bottom:5px}.cas-card em{font-size:27px}.cas-card.back em{inset:15px 10px;font-size:23px}.cas-hand{gap:7px;margin:7px 0}
 .cas-bets{gap:7px;padding:13px 0 10px}.cas-chip{width:44px;height:44px;font-size:10px}.cas-adj{padding:8px 10px;min-height:44px;min-width:44px}.cas-betv{padding:7px 11px;font-size:18px;min-width:97px}
 .cas-acts{margin-top:12px;gap:6px;flex-wrap:wrap}.cas-btn{min-width:0;flex:1;padding:13px 9px;font-size:11px;letter-spacing:.08em;min-height:48px}.cas-res{font-size:19px;min-height:26px;margin-top:8px}
 .cas-ticket{font-size:11px;margin:10px 2px}.cas-receipt{margin-bottom:8px}.cas-receipt>div{padding:9px 4px}.cas-receipt small{font-size:8px;letter-spacing:.04em;min-height:23px}.cas-receipt small span{display:block}.cas-receipt b{font-size:clamp(11px,3.4vw,14px)}.cas-board-hint{display:block}.cas-foot{font-size:10px;margin-top:10px}
 .cas-rl{gap:12px}.cas-wheel{width:180px;height:180px}.cas-board{grid-template-columns:repeat(13,minmax(36px,1fr));min-width:510px;grid-auto-rows:44px}.cas-board-wrap{margin:0 -2px}.cas-rl>div:last-child{padding:2px}.cas-pocket{font-size:22px}
 .cas-dice{margin:19px 0 16px}.cas-die{width:72px;height:72px;padding:9px}.cas-die i{width:12px;height:12px}.cas-dbets{margin-top:13px;gap:7px}.cas-dbets .cas-pick{height:55px;font-size:12px}
 .cas-cab{padding:10px;border-radius:12px}.cas-reels{padding:6px;gap:6px}.cas-reel{width:min(21vw,80px);height:180px}.cas-strip div{height:60px}.cas-reel:after{height:60px}.cas-strip svg{width:46px;height:46px}.cas-cab:before{display:none}
}
@media(max-height:540px) and (min-width:560px){
 .cas-box{width:100vw;height:100dvh;border-radius:0;padding:10px 18px;overflow-y:auto;display:block}.cas-head{padding-bottom:9px}.cas-brand{display:flex}.cas-brand b{font-size:20px}.cas-mode.prac{max-width:none}.cas-table-label{margin:7px 0}.cas-felt{padding:12px;min-height:0;display:block;overflow:visible}.cas-gname{margin-bottom:6px}.cas-hand{display:inline-flex;width:48%!important;margin:5px 0;vertical-align:middle}.cas-card{width:58px;height:82px}.cas-cards{min-height:90px}.cas-acts{margin-top:8px}.cas-bets{padding:11px 0}.cas-wheel{width:180px;height:180px}.cas-board{grid-auto-rows:38px}.cas-rl{flex-wrap:nowrap}.cas-receipt{max-width:660px}.cas-reel{width:76px;height:150px}.cas-strip div{height:50px}.cas-reel:after{height:50px}.cas-strip svg{width:40px;height:40px}
}
@media(prefers-reduced-motion:reduce){.cas-ov *{animation:none!important;transition:none!important}.cas-coins{display:none}}
`;
