// child process for tests/adminMenu.test.mjs: node --import ./tests/helpers/adminRegister.mjs tests/helpers/adminScenario.mjs '<json>'
// -> prints one JSON line describing what js/adminMenu.js mounted for that host / URL / server answer.
import { fakeDom } from './fakeDom.mjs';
const o = JSON.parse(process.argv[2] || '{}');
const D = fakeDom({ host: o.host || '127.0.0.1', search: o.search || '' });
globalThis.__ownerHint = !!o.hint;
globalThis.__invApi = async (a) => a === 'admin_status' ? (o.serverOwner ? { ok: true, owner: true } : { ok: false, status: 403, error: 'Owner only.' }) : { ok: false, error: 'offline' };
const M = await import('../../js/adminMenu.js');
const api = M.initAdminMenu({ dock: () => null, pvp: () => null, player: () => null, game: {}, scene: null, camera: null });
await new Promise(r => setTimeout(r, 30));
const out = { owner: !!api?.owner, settingsBtn: !!D.doc.getElementById('btn-set-admin'), inPause: D.panel.children.some(c => c.id === 'btn-set-admin'),
  hudButtons: D.hud.children.length, bodyButtons: D.doc.body.children.filter(c => c.tagName === 'BUTTON').length, panelBefore: !!D.doc.getElementById('pfp-admin'), calls: (globalThis.__calls || []).map(c => c[0]) };
const btn = D.doc.getElementById('btn-set-admin');
if (btn) { D.pause.classList.remove('hidden'); btn.click(); const p = D.doc.getElementById('pfp-admin'); out.openedByClick = !!p && p.classList.contains('on'); out.pauseHidden = D.pause.classList.contains('hidden');
  D.key('F8'); out.f8Closes = !p.classList.contains('on'); D.key('F8'); out.f8Opens = p.classList.contains('on'); }
else { D.key('F8'); out.f8Opens = !!D.doc.getElementById('pfp-admin')?.classList.contains('on'); }
out.adminDomIds = [...D.doc.ids.keys()].filter(k => /admin/.test(k));
console.log(JSON.stringify(out)); process.exit(0);
