// a tiny fake DOM for tests/adminMenu.test.mjs: just enough of document / elements for js/adminMenu.js to mount (or not) its buttons.
class CL { constructor() { this.s = new Set(); } add(...c) { c.forEach(x => this.s.add(x)); } remove(...c) { c.forEach(x => this.s.delete(x)); } contains(c) { return this.s.has(c); } toggle(c, v) { if (v === undefined) v = !this.s.has(c); v ? this.s.add(c) : this.s.delete(c); return v; } }
export class El {
  constructor(tag, doc) { this.tagName = String(tag).toUpperCase(); this.doc = doc; this.children = []; this.parent = null; this.classList = new CL(); this.style = {}; this.dataset = {}; this.ls = {}; this._id = ''; this.innerHTML = ''; this.textContent = ''; this.subs = new Map(); }
  set id(v) { this._id = v; if (v) this.doc.ids.set(v, this); } get id() { return this._id; }
  set className(v) { this.classList = new CL(); String(v).split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c)); } get className() { return [...this.classList.s].join(' '); }
  appendChild(c) { c.parent = this; this.children.push(c); if (c._id) this.doc.ids.set(c._id, c); return c; }
  insertBefore(c, ref) { c.parent = this; const i = ref ? this.children.indexOf(ref) : -1; i < 0 ? this.children.push(c) : this.children.splice(i, 0, c); if (c._id) this.doc.ids.set(c._id, c); return c; }
  remove() { if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1); }
  addEventListener(t, f) { (this.ls[t] ||= []).push(f); } removeEventListener() {}
  dispatch(t, e = {}) { for (const f of this.ls[t] || []) f({ target: this, preventDefault() {}, stopPropagation() {}, ...e }); }
  click() { this.dispatch('click'); }
  querySelector(sel) { if (!this.subs.has(sel)) this.subs.set(sel, new El('div', this.doc)); return this.subs.get(sel); }
  querySelectorAll() { return []; } getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 400 }; } setPointerCapture() {} contains() { return false; } closest() { return null; } focus() {} setSelectionRange() {}
  all() { return [this, ...this.children.flatMap(c => c.all())]; }
}
export function fakeDom({ host = '127.0.0.1', search = '' } = {}) {
  const doc = { ids: new Map() }; doc.documentElement = new El('html', doc); doc.head = new El('head', doc); doc.body = new El('body', doc);
  doc.createElement = (t) => new El(t, doc); doc.getElementById = (id) => doc.ids.get(id) || null;
  const pause = new El('div', doc); pause.id = 'pause'; pause.classList.add('overlay', 'hidden'); const panel = new El('div', doc); panel.classList.add('panel'); pause.appendChild(panel);
  const resume = new El('button', doc); resume.id = 'btn-resume'; panel.appendChild(resume); doc.body.appendChild(pause);
  const hud = new El('div', doc); hud.id = 'hud'; doc.body.appendChild(hud);
  doc.querySelector = (sel) => sel === '#pause .panel' ? panel : null; doc.activeElement = null;
  const win = { ls: {} };
  Object.assign(globalThis, { document: doc, location: { hostname: host, search, protocol: 'http:' }, innerWidth: 1280, innerHeight: 720,
    requestAnimationFrame: () => 0, addEventListener: (t, f) => { (win.ls[t] ||= []).push(f); }, dispatchEvent: () => true, window: globalThis });
  return { doc, pause, panel, resume, hud, win, key: (code) => (win.ls.keydown || []).forEach(f => f({ code, target: {}, preventDefault() {}, repeat: false })) };
}
