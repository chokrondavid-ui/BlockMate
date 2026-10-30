// Blockmate browser client. Rules come from /shared/game.js, items and prices from /shared/catalog.js.
(function () {
'use strict';
const C = window.BMCatalog, E = window.BMGame;
const { SKINS, RIVAL, GLOWS, REACTS, CATS, LEVELS, TIERS, COUNTRIES, DAILY, PRODUCTS, STAKES, tierOf, mix, euro } = C;
const { N, SHAPES, DIM } = E;
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtMult = m => '×' + (Math.round(m * 100) / 100);
const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
let uid = 0;

// ---------- server ----------
async function api(path, data) {
  const r = await fetch(path, data === undefined ? { credentials: 'same-origin' } : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  let j = {}; try { j = await r.json(); } catch (e) {}
  if (j.me) setMe(j.me);
  if (!r.ok) throw new Error(j.error || 'Connection problem. Try again.');
  return j;
}
let P = null, CONFIG = { payments: 'off', turnMs: 25000 };
function setMe(me) { P = me; if (P.eq.skin === 'custom' && !P.plus) P.eq.skin = 'sapphire'; renderTop(); }

const NET = {
  ws: null, ready: false, wait: 1000, handlers: {},
  connect() {
    try { this.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws'); } catch (e) { return this.retry(); }
    this.ws.onopen = () => { this.ready = true; this.wait = 1000; };
    this.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } const h = this.handlers[m.t]; if (h) try { h(m); } catch (err) { console.error(err); } };
    this.ws.onclose = () => { const was = this.ready; this.ready = false; ONLINE.clear(); if (was && G && G.mode === 'online' && !G.over) status('Connection lost. Reconnecting…'); this.retry(); };
  },
  retry() { setTimeout(() => this.connect(), this.wait); this.wait = Math.min(15000, this.wait * 1.7); },
  send(o) { if (this.ready) { this.ws.send(JSON.stringify(o)); return true; } toast('Not connected to the server yet. Try again in a second.'); return false; },
  on(t, f) { this.handlers[t] = f; }
};
const ONLINE = new Set();

// ---------- small visuals ----------
function coinSvg(sz) { const id = 'cg' + (uid++); return `<svg class="coin" style="width:${sz || 22}px;height:${sz || 22}px" viewBox="0 0 24 24" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="#FFF4C2"/><stop offset=".45" stop-color="#FFC233"/><stop offset="1" stop-color="#B86A00"/></radialGradient></defs><circle cx="12" cy="12" r="11" fill="#7A4300"/><circle cx="12" cy="11.4" r="10.2" fill="url(#${id})"/><circle cx="12" cy="11.4" r="7.4" fill="none" stroke="#A85F00" stroke-width="1.1" opacity=".75"/><rect x="8.3" y="7.6" width="3.4" height="3.4" rx=".8" fill="#8A4C00"/><rect x="12.3" y="7.6" width="3.4" height="3.4" rx=".8" fill="#8A4C00" opacity=".55"/><rect x="8.3" y="11.6" width="3.4" height="3.4" rx=".8" fill="#8A4C00" opacity=".55"/><rect x="12.3" y="11.6" width="3.4" height="3.4" rx=".8" fill="#8A4C00"/><path d="M6.5 6.5a7.6 7.6 0 0 1 5-2.2" stroke="#FFF8DA" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".85"/></svg>`; }
const LOCK = '<svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true"><rect x="2.5" y="7" width="11" height="8" rx="2" fill="#FFC94A"/><path d="M5 7V5a3 3 0 0 1 6 0v2" fill="none" stroke="#FFC94A" stroke-width="1.8"/><circle cx="8" cy="11" r="1.3" fill="#2A1700"/></svg>';
function emblem(r) { const t = tierOf(r), id = 'em' + (uid++); return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${mix(t[2], '#ffffff', .35)}"/><stop offset="1" stop-color="${mix(t[2], '#000000', .35)}"/></linearGradient></defs><path d="M17 1.5l14.5 8.4v18.2L17 36.5 2.5 28.1V9.9z" fill="#0E0918" stroke="${t[2]}" stroke-width="1.6"/><path d="M17 5.6l11 6.4v14L17 32.4 6 26V12z" fill="url(#${id})"/><text x="17" y="24.2" text-anchor="middle" font-family="Chakra Petch,sans-serif" font-weight="700" font-size="13" fill="#140A1E">${t[3]}</text>`; }
const embSvg = (r, w) => `<svg class="emb" style="width:${w}px;height:${Math.round(w * 38 / 34)}px" viewBox="0 0 34 38" aria-hidden="true">${emblem(r)}</svg>`;
const owns = (c, k) => { const it = CATS[c].data[k]; return it.plus ? P.plus : P.owned[c].includes(k); };
function skinOf(k, custom) { const s = SKINS[k] || SKINS.sapphire; if (s.custom) { const b = custom || P.custom || '#00D1B2'; return Object.assign({}, s, { b, h: mix(b, '#ffffff', .55), l: mix(b, '#000000', .45) }); } return s; }
const reward = (lvl, res, ranked) => { const L = LEVELS[lvl]; const b = res === 1 ? L.win : res === .5 ? L.draw : L.loss; return ranked ? b : Math.round(b * C.PRACTICE); };

// ---------- sound and music ----------
const SND = { on: store.get('bm-sound', 'on') !== 'off', ctx: null,
  init() { if (!this.on) return; if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; } } if (this.ctx.state === 'suspended') this.ctx.resume(); },
  tone(f, d, o) { if (!this.on || !this.ctx) return; o = o || {}; const t = this.ctx.currentTime + (o.at || 0); const osc = this.ctx.createOscillator(), g = this.ctx.createGain(); osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(f, t); if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(o.vol || .12, t + .012); g.gain.exponentialRampToValueAtTime(0.0001, t + d); osc.connect(g).connect(this.ctx.destination); osc.start(t); osc.stop(t + d + .05); },
  place() { this.tone(180, .09, { type: 'triangle', vol: .16, to: 120 }); this.tone(900, .04, { type: 'square', vol: .03 }); },
  clear(n, c) { const base = 523 * Math.pow(2, Math.min(c - 1, 6) / 12); [0, 4, 7, 12].slice(0, Math.min(4, 1 + n)).forEach((s, i) => this.tone(base * Math.pow(2, s / 12), .28, { type: 'triangle', vol: .11, at: i * .06 })); if (c > 1) this.tone(base * 2, .4, { type: 'sine', vol: .07, at: .24 }); },
  win() { [0, 4, 7, 12, 16].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), .32, { type: 'triangle', vol: .12, at: i * .09 })); },
  lose() { [7, 3, 0].forEach((s, i) => this.tone(330 * Math.pow(2, s / 12), .35, { type: 'sine', vol: .1, at: i * .14 })); },
  tick() { this.tone(660, .05, { type: 'sine', vol: .05 }); },
  ping() { this.tone(880, .12, { type: 'triangle', vol: .1 }); this.tone(1320, .16, { type: 'triangle', vol: .08, at: .1 }); } };
document.addEventListener('pointerdown', () => SND.init(), { passive: true });
const SND_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const SND_OFF = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 9h4l5-4v14l-5-4H4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function renderSnd() { document.querySelectorAll('.sndbtn').forEach(b => { b.innerHTML = SND.on ? SND_ON : SND_OFF; b.setAttribute('aria-label', SND.on ? 'Sound on' : 'Sound off'); }); }
document.querySelectorAll('.sndbtn').forEach(b => b.addEventListener('click', () => { SND.on = !SND.on; store.set('bm-sound', SND.on ? 'on' : 'off'); if (SND.on) { SND.init(); SND.tick(); } renderSnd(); }));
const TRACKS = { menu: '/music/music-menu.mp4', game: '/music/music-game.mp4' };
const MUS = { on: store.get('bm-music', 'on') !== 'off', want: 'menu', els: {}, started: false,
  el(k) { if (!this.els[k]) { const a = new Audio(TRACKS[k]); a.loop = true; a.preload = 'auto'; a.volume = 0; this.els[k] = a; } return this.els[k]; },
  vol(k) { return k === 'game' ? .32 : .42; },
  fade(a, to, ms, done) { clearInterval(a._f); const from = a.volume, t0 = performance.now(); a._f = setInterval(() => { const k = Math.min(1, (performance.now() - t0) / ms); a.volume = Math.max(0, Math.min(1, from + (to - from) * k)); if (k >= 1) { clearInterval(a._f); if (done) done(); } }, 40); },
  go(k) { if (this.want === k && this.started && this.els[k] && !this.els[k].paused) return; this.want = k; if (!this.on || !this.started) return; for (const o of Object.keys(this.els)) if (o !== k) { const a = this.els[o]; this.fade(a, 0, 600, () => a.pause()); }
    const a = this.el(k); if (a.paused) { if (k === 'game') a.currentTime = 0; a.play().catch(() => {}); } this.fade(a, this.vol(k), 900); },
  start() { if (this.started) return; this.started = true; const k = this.want; this.want = null; this.go(k); },
  stopAll() { for (const a of Object.values(this.els)) this.fade(a, 0, 400, () => a.pause()); } };
document.addEventListener('pointerdown', () => MUS.start(), { passive: true });
const MU_ON = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17.5V5.8l11-2.3v11.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="15.2" r="2.8"/></svg>';
const MU_OFF = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M9 17.5V5.8l11-2.3v11.7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="15.2" r="2.8"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
function renderMu() { document.querySelectorAll('.mubtn').forEach(b => { b.innerHTML = MUS.on ? MU_ON : MU_OFF; b.classList.toggle('off', !MUS.on); b.setAttribute('aria-label', MUS.on ? 'Music on' : 'Music off'); }); }
document.querySelectorAll('.mubtn').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); MUS.on = !MUS.on; store.set('bm-music', MUS.on ? 'on' : 'off');
  if (MUS.on) { MUS.started = true; const k = MUS.want; MUS.want = null; MUS.go(k || 'menu'); } else MUS.stopAll(); renderMu(); }));

// ---------- block painting ----------
const CLS = ['metal', 'diamond', 'holo', 'rainbow', 'galaxy', 'royal', 'inferno', 'neonp', 'dark', 'gl', 'gp', 'gr', 'gf'];
function paint(el, skin, glowKey) { el.classList.add('blk'); el.classList.remove(...CLS);
  el.style.setProperty('--b', skin.b); el.style.setProperty('--h', skin.h); el.style.setProperty('--l', skin.l);
  if (skin.pat) { el.style.setProperty('--pat', skin.pat); el.style.setProperty('--ps', skin.ps || '100% 100%'); } else { el.style.removeProperty('--pat'); el.style.removeProperty('--ps'); }
  if (skin.cls) el.classList.add(skin.cls); const g = glowKey && GLOWS[glowKey]; if (g && g.c) { el.classList.add('gl'); el.style.setProperty('--gc', g.c); if (g.anim) el.classList.add(g.anim); } }
function unpaint(el) { el.classList.remove('blk', ...CLS); }
function blkHtml(skin, size, glowKey) { const g = glowKey && GLOWS[glowKey];
  return `<i class="blk${skin.cls ? ' ' + skin.cls : ''}${g && g.c ? ' gl' + (g.anim ? ' ' + g.anim : '') : ''}" style="--b:${skin.b};--h:${skin.h};--l:${skin.l};${skin.pat ? `--pat:${skin.pat};--ps:${skin.ps || '100% 100%'};` : ''}${g && g.c ? `--gc:${g.c};` : ''}${size ? `width:${size}px;height:${size}px;` : ''}display:block"></i>`; }
function renderTop() { if (!P) return; $('coins').textContent = P.coins; $('rating').textContent = P.elo; $('pillEmb').innerHTML = emblem(P.elo); const cs = document.querySelector('.coinslot'); if (!cs.firstChild) cs.innerHTML = coinSvg(22);
  document.querySelectorAll('[data-dot]').forEach(d => d.hidden = !P.daily.ready); }
let toastT; function toast(t) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => el.hidden = true, 2800); }

let sheetKind = null;
function openSheet(html, bind, kind) { sheetKind = kind || null; $('sheet').innerHTML = html; $('overlay').hidden = false; if (bind) bind($('sheet')); const f = $('sheet').querySelector('button:not([disabled]),input'); if (f) f.focus(); }
function closeSheet() { $('overlay').hidden = true; $('sheet').innerHTML = ''; const k = sheetKind; sheetKind = null; if (k === 'queue') NET.send({ t: 'cancel' }); if (k === 'room') NET.send({ t: 'room_cancel' }); }
$('overlay').addEventListener('click', e => { if (e.target === $('overlay') && !(G && G.over) && sheetKind !== 'invited') closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('overlay').hidden && !(G && G.over)) closeSheet(); });

// ---------- payments ----------
function payNote() { return CONFIG.payments === 'demo' ? '<p class="note" style="text-align:center">Test server: payments are simulated, nothing is charged.</p>' : CONFIG.payments === 'off' ? '<p class="note" style="text-align:center">Payments open very soon.</p>' : '<p class="note" style="text-align:center">Secure payment by Stripe. Card, Apple Pay, Google Pay.</p>'; }
function checkoutSheet(pid, what) {
  const p = PRODUCTS[pid]; const sub = p.kind === 'plus';
  openSheet(`<h3${sub ? ' class="gold"' : ''}>${esc(p.label.replace(' · ', ' '))}</h3><p>${esc(what || '')}</p><div class="big num">${euro(p.cents)}${sub ? ` <span class="muted">/ ${p.interval}</span>` : ''}</div>
    <label class="waiver"><input type="checkbox" id="wv"> <span>I want my purchase delivered right away, and I understand that I then lose my 14-day right of withdrawal. I accept the <a href="/legal/cgv" target="_blank" rel="noopener">terms of sale</a>.</span></label>
    <div class="acts"><button class="btn main" type="button" id="pay" disabled>${sub ? 'Subscribe' : 'Pay'} ${euro(p.cents)}</button><button class="btn" type="button" id="x">Cancel</button></div>${sub ? '<p class="note" style="text-align:center">Renews automatically. Cancel anytime from your profile.</p>' : ''}${payNote()}`,
    s => { const wv = s.querySelector('#wv'), pay = s.querySelector('#pay'); wv.onchange = () => pay.disabled = !wv.checked || CONFIG.payments === 'off'; s.querySelector('#x').onclick = closeSheet;
      pay.onclick = async () => { pay.disabled = true; pay.textContent = 'Opening payment…';
        try { const r = await api('/api/checkout', { product: pid, waiver: true }); if (r.url) { location.href = r.url; return; } closeSheet(); SND.win(); toast(p.label + ' added (test payment)'); renderView(); }
        catch (e) { toast(e.message); pay.disabled = false; pay.textContent = (sub ? 'Subscribe ' : 'Pay ') + euro(p.cents); } }; });
}
function plusSheet(reason) {
  const on = P.plus;
  if (on) {
    const until = new Date(P.plusUntil).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
    return openSheet(`<h3 class="gold">Blockmate Plus</h3><p>${P.subscribed ? 'Your subscription is active. Next renewal around ' + until + '.' : 'Plus is active until ' + until + '.'}</p>
      <div class="acts">${P.subscribed ? '<button class="btn" type="button" id="portal">Manage or cancel my subscription</button>' : ''}<button class="btn main" type="button" id="x">Back</button></div>`,
      s => { s.querySelector('#x').onclick = closeSheet; const pt = s.querySelector('#portal'); if (pt) pt.onclick = async () => { pt.disabled = true; try { const r = await api('/api/portal', {}); location.href = r.url; } catch (e) { toast(e.message); pt.disabled = false; } }; });
  }
  openSheet(`<h3 class="gold">Blockmate Plus</h3><p>${reason ? esc(reason) + ' ' : ''}Unlock every premium item.</p>
    <ul class="perks"><li>7 exclusive skins: Gold, Diamond, Hologram, Galaxy, Royal, Inferno and your own color</li><li>3 animated glows, 4 premium blasts, 3 premium reaction packs</li><li>Double daily reward</li><li>New exclusive items every season</li></ul>
    <div class="subs"><button class="sub" type="button" data-sub="plusMonth"><b>Monthly</b><span class="p">${euro(PRODUCTS.plusMonth.cents)} <small>/ month</small></span><span class="note">Cancel anytime</span></button>
      <button class="sub" type="button" data-sub="plusYear"><em class="badge gd">Save 33%</em><b>Yearly</b><span class="p">${euro(PRODUCTS.plusYear.cents)} <small>/ year</small></span><span class="note">${euro(Math.round(PRODUCTS.plusYear.cents / 12))} a month</span></button></div>
    <div class="acts"><button class="btn" type="button" id="x">Not now</button></div>`,
    s => { s.querySelector('#x').onclick = closeSheet; s.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => checkoutSheet(b.dataset.sub, 'All premium items and double daily reward.')); });
}

// ---------- navigation ----------
let tab = 'play', soloRanked = true, soloLvl = store.get('bm-lvl', 'medium'), rankScope = 'world', shopCat = 'skin';
if (!LEVELS[soloLvl]) soloLvl = 'medium';
function setTab(t) { tab = t; document.querySelectorAll('[data-tab]').forEach(x => { if (x.dataset.tab === t) x.setAttribute('aria-current', 'page'); else x.removeAttribute('aria-current'); }); renderView(); window.scrollTo(0, 0); }
document.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('pillElo').onclick = () => { setTab('profile'); setTimeout(() => { const d = $('g-rank'); if (d) { d.open = true; d.scrollIntoView({ block: 'center' }); } }, 30); };
$('pillCoins').onclick = () => { shopCat = 'store'; setTab('shop'); };
function renderView() { if (!P || G) return; renderTop(); renderSnd(); renderMu(); MUS.go('menu'); ({ play: viewPlay, friends: viewFriends, rank: viewRank, shop: viewShop, profile: viewProfile })[tab]($('view')); }

// Cached lists from the server, refreshed in the background.
const LB = {}, FR = { rows: null, at: 0 };
async function loadLB(scope, force) {
  const c = LB[scope]; if (c && !force && Date.now() - c.at < 30000) return c;
  try { const j = await api('/api/leaderboard?scope=' + scope); LB[scope] = { rows: j.rows, rank: j.rank, at: Date.now() }; if (!G && (tab === 'rank' || tab === 'play')) renderView(); } catch (e) {}
  return LB[scope];
}
async function loadFriends(force) {
  if (FR.rows && !force && Date.now() - FR.at < 20000) return;
  try { const j = await api('/api/friends'); FR.rows = j.rows; FR.at = Date.now(); for (const f of j.rows) if (f.online) ONLINE.add(f.id); else ONLINE.delete(f.id); if (!G && tab === 'friends') renderView(); } catch (e) {}
}

function artHtml(lvl) { const L = LEVELS[lvl]; let s = lvl.length * 97 + 13; const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; const a = C.S('a', L.col, 0); let h = '';
  for (let i = 0; i < 128; i++) { const v = r(); h += v < .26 ? blkHtml(a, 0) : v < .4 ? blkHtml(RIVAL, 0) : '<i style="background:rgba(255,255,255,.035)"></i>'; } return h; }

function viewPlay(v) {
  const d = P.daily, t = tierOf(P.elo), L = LEVELS[soloLvl];
  const lb = LB.world; if (!lb || Date.now() - lb.at > 30000) loadLB('world');
  const top = lb ? lb.rows.slice(0, 5) : [];
  const meIn = top.some(x => x.id === P.id);
  v.innerHTML = `<div class="cols">
  <div class="stack">
    <div class="news"><span class="badge gr">New</span><div class="grow"><b>Season 1 is live</b><span>Climb from Bronze to Master and unlock exclusive Plus skins. <a id="newsShop">Open the Shop →</a></span></div></div>
    <div class="ident">${embSvg(P.elo, 38)}<div class="grow" style="min-width:0"><div class="nm">${esc(P.name)}</div><div class="muted"><span style="color:${t[2]};font-weight:700">${t[1]}</span> · <span class="num">${P.elo}</span> Elo${P.plus ? ' · <span style="color:var(--gold)">Plus</span>' : ''}</div></div><button class="btn sm" type="button" id="editP">${P.guest ? 'Sign up' : 'Edit profile'}</button></div>
    <div class="panel"><div class="ph"><h2>Solo vs bots</h2><div class="seg" role="group" aria-label="Solo mode"><button type="button" data-rk="1" aria-pressed="${soloRanked}">Ranked</button><button type="button" data-rk="0" aria-pressed="${!soloRanked}">Practice</button></div></div>
      <div class="modes">${Object.entries(LEVELS).map(([k, l]) => `<button class="mode" type="button" data-lvl="${k}" aria-pressed="${k === soloLvl}"><span class="art" aria-hidden="true">${artHtml(k)}</span><span class="shade"></span>
        <span class="tl"><span class="badge or num">Win +${reward(k, 1, soloRanked)}</span>${P.rec[k] ? `<span class="badge dk num">Best ${P.rec[k]}</span>` : ''}</span>
        <span class="bt"><b>${l.name}</b><span class="num">${l.elo} Elo bot</span><em>${l.desc}</em></span></button>`).join('')}</div>
      <p class="note" style="margin:0">${soloRanked ? 'Ranked: your Elo moves after every game, and harder bots pay more Blockcoins.' : 'Practice: your Elo never changes, and you earn a quarter of the Ranked reward.'}</p></div>
    <button class="btn main big" type="button" id="playSolo">Play ${soloRanked ? 'ranked' : 'practice'} · ${L.name}</button>
    <div class="actions3"><button class="btn" type="button" id="online">Online ranked<em class="badge or">Live</em></button><button class="btn" type="button" id="toFriends">Challenge a friend</button><button class="btn" type="button" id="localDuel">Duel on this screen</button></div>
  </div>
  <div class="stack">
    ${d.ready ? `<div class="daily"><div class="ph" style="position:relative;z-index:1"><h3>Daily reward</h3><span class="badge or">Day ${d.day}/7</span></div>
      <div class="row" style="position:relative;z-index:1">${coinSvg(44)}<div class="grow"><div class="ui num" style="font-size:28px;letter-spacing:.03em">+${d.amount}</div><div class="muted">Blockcoins${P.plus ? ' · Plus ×2' : ''}</div></div><button class="btn main sm" type="button" id="claim">Claim</button></div>
      <div class="days">${DAILY.map((a, i) => `<i class="${i + 1 < d.day ? 'done' : i + 1 === d.day ? 'now' : ''}">D${i + 1}</i>`).join('')}</div></div>`
      : `<div class="panel"><div class="ph"><h3>Daily reward</h3><span class="badge gr">Claimed</span></div><div class="muted">Day ${d.streak} done. Come back tomorrow for day ${(d.streak % 7) + 1}.</div></div>`}
    <div class="panel"><div class="ph"><h3>Top players</h3><span class="live">Live</span></div>
      <div class="list">${top.length ? top.map((x, i) => `<div class="li${x.id === P.id ? ' me' : ''}"><span class="pos${i < 3 ? ' p' + (i + 1) : ''}">${i + 1}</span><div class="who"><b>${esc(x.name)}${x.id === P.id ? ' (you)' : ''}</b><span>${tierOf(x.elo)[1]}</span></div><span class="elo num">${x.elo}</span></div>`).join('')
        : `<div class="muted">${lb ? 'No ranked games yet. Win one and take the top spot.' : 'Loading…'}</div>`}
      ${lb && !meIn && lb.rank ? `<div class="li me"><span class="pos">${lb.rank}</span><div class="who"><b>${esc(P.name)} (you)</b><span>${t[1]}</span></div><span class="elo num">${P.elo}</span></div>` : ''}</div>
      <button class="btn sm" type="button" id="seeAll">See full ranking</button></div>
    <div class="panel"><div class="ph"><h3>Your season</h3></div><div class="stats"><div class="stat"><b class="num">${P.st.games}</b><span>Games</span></div><div class="stat"><b class="num">${P.st.wins}</b><span>Wins</span></div><div class="stat"><b class="num">${P.st.bestCombo || 0}</b><span>Best combo</span></div></div></div>
  </div></div>`;
  const c = v.querySelector('#claim'); if (c) c.onclick = async () => { c.disabled = true; try { const r = await api('/api/daily', {}); SND.win(); toast('+' + r.amount + ' Blockcoins'); renderView(); } catch (e) { toast(e.message); c.disabled = false; } };
  v.querySelectorAll('[data-rk]').forEach(b => b.onclick = () => { soloRanked = b.dataset.rk === '1'; renderView(); });
  v.querySelectorAll('[data-lvl]').forEach(b => { b.onclick = () => { soloLvl = b.dataset.lvl; store.set('bm-lvl', soloLvl); SND.tick(); renderView(); }; b.ondblclick = () => startSolo(b.dataset.lvl, soloRanked); });
  v.querySelector('#playSolo').onclick = () => startSolo(soloLvl, soloRanked);
  v.querySelector('#localDuel').onclick = () => startLocal();
  v.querySelector('#online').onclick = () => queueSheet();
  v.querySelector('#toFriends').onclick = () => setTab('friends'); v.querySelector('#seeAll').onclick = () => setTab('rank');
  v.querySelector('#editP').onclick = () => setTab('profile'); v.querySelector('#newsShop').onclick = () => setTab('shop');
}

// ---------- online queue and challenges ----------
let queueT = null;
function queueSheet() {
  if (!NET.send({ t: 'queue' })) return;
  const t0 = Date.now();
  openSheet(`<h3>Finding a rival</h3><div class="spin" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p>Matching you with a player near <b class="num">${P.elo}</b> Elo.</p><div class="big num" id="qt">0:00</div>
    <p class="note" id="qhint" style="text-align:center">Ranked online games move your Elo and pay ${C.ONLINE.win} Blockcoins for a win.</p>
    <div class="acts"><button class="btn" type="button" id="x">Cancel</button></div>`,
    s => { s.querySelector('#x').onclick = closeSheet; }, 'queue');
  clearInterval(queueT);
  queueT = setInterval(() => {
    if (sheetKind !== 'queue') { clearInterval(queueT); return; }
    const s = Math.floor((Date.now() - t0) / 1000); const el = $('qt'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    if (s === 30) { const h = $('qhint'); if (h) { h.innerHTML = 'Few players are online right now. Keep waiting, or <a id="qbot">play the Pro bot</a> meanwhile.'; const a = $('qbot'); a.onclick = () => { closeSheet(); startSolo('medium', true); }; } }
  }, 500);
}
function challengeSheet(f) {
  let stake = 0;
  const draw = () => openSheet(`<h3>Challenge ${esc(f.name)}</h3><p>Friendly for fun, or put Blockcoins on the line. The winner takes the stake.</p>
    <div class="seg" role="group" aria-label="Stake" style="width:100%">${STAKES.map(s => `<button type="button" data-st="${s}" aria-pressed="${s === stake}" ${s > P.earned ? 'disabled' : ''}>${s ? s + ' coins' : 'Friendly'}</button>`).join('')}</div>
    <p class="note" style="text-align:center">You can bet <b class="num">${P.earned}</b> Blockcoins: the ones you won by playing. Blockcoins bought in the Store can't be bet, and no Blockcoins can be cashed out.</p>
    <div class="acts"><button class="btn main" type="button" id="go">${stake ? 'Bet ' + stake + ' and challenge' : 'Send challenge'}</button><button class="btn" type="button" id="x">Cancel</button></div>`,
    s => { s.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { stake = +b.dataset.st; draw(); }); s.querySelector('#x').onclick = closeSheet;
      s.querySelector('#go').onclick = () => { if (NET.send({ t: 'invite', to: f.id, stake })) openSheet(`<h3>Challenge sent</h3><div class="spin" aria-hidden="true"><i></i><i></i><i></i><i></i></div><p>Waiting for <b>${esc(f.name)}</b> to accept${stake ? ' your ' + stake + ' coin bet' : ''}…</p><p class="note" id="invMsg" style="text-align:center">The challenge expires after one minute.</p><div class="acts"><button class="btn" type="button" id="x">Close</button></div>`, s2 => s2.querySelector('#x').onclick = closeSheet, 'inviting'); }; });
  draw();
}
function linkSheet() {
  let stake = 0;
  const draw = () => openSheet(`<h3>Game link</h3><p>Create a link, send it to anyone. When they open it, the game starts.</p>
    <div class="seg" role="group" aria-label="Stake" style="width:100%">${STAKES.map(s => `<button type="button" data-st="${s}" aria-pressed="${s === stake}" ${s > P.earned ? 'disabled' : ''}>${s ? s + ' coins' : 'Friendly'}</button>`).join('')}</div>
    <div class="acts"><button class="btn main" type="button" id="go">Create the link</button><button class="btn" type="button" id="x">Cancel</button></div>`,
    s => { s.querySelectorAll('[data-st]').forEach(b => b.onclick = () => { stake = +b.dataset.st; draw(); }); s.querySelector('#x').onclick = closeSheet; s.querySelector('#go').onclick = () => NET.send({ t: 'room_create', stake }); });
  draw();
}
NET.on('room', m => {
  const url = location.origin + '/?join=' + m.code;
  openSheet(`<h3>Send this link</h3><p>Keep this page open. The game starts as soon as your friend opens the link${m.stake ? ' (bet: ' + m.stake + ' coins)' : ''}.</p>
    <div class="row"><input class="f grow" id="lnk" readonly value="${esc(url)}" aria-label="Game link"><button class="btn main sm" type="button" id="cp">Copy</button></div>
    ${navigator.share ? '<button class="btn" type="button" id="sh">Share…</button>' : ''}<div class="spin" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="acts"><button class="btn" type="button" id="x">Cancel</button></div>`,
    s => { s.querySelector('#x').onclick = closeSheet; const inp = s.querySelector('#lnk'); inp.onfocus = () => inp.select();
      s.querySelector('#cp').onclick = () => { api('/api/track', { e: 'share_copy' }).catch(() => {}); (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject()).then(() => toast('Link copied'), () => { inp.select(); document.execCommand('copy'); toast('Link copied'); }); };
      const sh = s.querySelector('#sh'); if (sh) sh.onclick = () => (api('/api/track', { e: 'share_native' }).catch(() => {}), navigator.share({ title: 'Blockmate', text: 'Beat me at Blockmate!', url }).catch(() => {})); }, 'room');
});
NET.on('invited', m => {
  if (G && !G.over) { toast(m.from.name + ' challenged you. Finish this game, then ask them again.'); NET.send({ t: 'decline', inv: m.inv }); return; }
  SND.ping();
  openSheet(`<h3>${esc(m.from.name)} challenges you</h3><div class="row" style="justify-content:center">${embSvg(m.from.elo, 40)}<div><b class="num">${m.from.elo}</b> Elo · ${tierOf(m.from.elo)[1]}</div></div>
    <p>${m.stake ? `Bet: <b class="num">${m.stake}</b> Blockcoins each. The winner takes ${m.stake * 2}.` : 'Friendly game, nothing at stake.'}</p>
    ${m.stake > P.earned ? `<p class="note" style="text-align:center;color:var(--red)">You need ${m.stake} Blockcoins won by playing to accept.</p>` : ''}
    <div class="acts"><button class="btn main" type="button" id="ok" ${m.stake > P.earned ? 'disabled' : ''}>Accept</button><button class="btn" type="button" id="no">Decline</button></div>`,
    s => { s.querySelector('#ok').onclick = () => { NET.send({ t: 'accept', inv: m.inv }); s.querySelector('#ok').disabled = true; }; s.querySelector('#no').onclick = () => { NET.send({ t: 'decline', inv: m.inv }); sheetKind = null; closeSheet(); }; }, 'invited');
});
NET.on('invite_gone', m => { if (sheetKind === 'inviting') { const el = $('invMsg'); if (el) { el.textContent = m.why === 'declined' ? 'They declined this time.' : 'No answer. The challenge expired.'; el.style.color = 'var(--red)'; } } else if (sheetKind === 'invited') { sheetKind = null; closeSheet(); toast('That challenge expired.'); } });
NET.on('queued', () => {});
NET.on('error', m => { if (sheetKind === 'queue' || sheetKind === 'room' || sheetKind === 'inviting') { sheetKind = null; closeSheet(); } toast(m.msg); });
NET.on('presence', m => { if (m.online) ONLINE.add(m.id); else ONLINE.delete(m.id); if (!G && tab === 'friends') renderView(); });
NET.on('friend_added', m => { toast(m.by.name + ' added you as a friend'); FR.at = 0; if (!G && tab === 'friends') loadFriends(true); });
NET.on('me', m => { setMe(m.me); if (!G) renderView(); });

function viewFriends(v) {
  if (!FR.rows || Date.now() - FR.at > 20000) loadFriends();
  const fr = (FR.rows || []).map(f => Object.assign({}, f, { on: ONLINE.has(f.id) })).sort((a, b) => (b.on - a.on) || b.elo - a.elo);
  v.innerHTML = `<h1 class="pt">Friends</h1><div class="cols">
  <div class="panel"><div class="ph"><h2>Your friends</h2><span class="sub">${fr.length}</span></div>
    <div class="list">${fr.length ? fr.map(f => `<div class="li"><div class="av">${esc((f.name || '?')[0].toUpperCase())}<span class="st${f.on ? ' on' : ''}"></span></div>
      <div class="who"><b>${esc(f.name)}<span class="cc">${esc(f.country || '')}</span></b><span class="num">${tierOf(f.elo)[1]} · ${f.elo} Elo · ${f.on ? 'Online' : 'Offline'}</span></div>
      <button class="btn${f.on ? ' main' : ''} sm" type="button" data-ch="${esc(f.id)}" ${f.on ? '' : 'disabled title="Offline: send a game link instead"'}>Challenge</button></div>`).join('')
      : `<div class="muted">${FR.rows ? 'No friends yet. Add one by username, or send a game link to anyone.' : 'Loading…'}</div>`}</div></div>
  <div class="stack"><div class="panel"><div class="ph"><h3>Play with anyone</h3></div><p class="muted" style="margin:0">No account needed for your friend: send a link, the game starts when they open it.</p><button class="btn main" type="button" id="mkLink">Create a game link</button></div>
    <div class="panel"><div class="ph"><h3>Add a friend</h3></div>
    <form class="row" id="addF"><input class="f grow" id="addName" maxlength="16" placeholder="Their username" autocomplete="off" aria-label="Friend's username"><button class="btn main sm" type="submit">Add</button></form>
    <div class="note" id="addMsg">Your username is <b>${esc(P.name)}</b>. Friends can challenge you in one click when you're both online.</div></div>
    <div class="panel"><div class="ph"><h3>How duels work</h3></div><p class="muted" style="margin:0">Play for fun, or bet 25, 50 or 100 Blockcoins you won by playing: the winner takes the stake. Friend duels never change your Elo.</p></div></div></div>`;
  v.querySelector('#mkLink').onclick = linkSheet;
  v.querySelector('#addF').onsubmit = async e => { e.preventDefault(); const n = v.querySelector('#addName').value.trim(); const m = v.querySelector('#addMsg'); const bad = t => { m.textContent = t; m.style.color = 'var(--red)'; };
    if (!/^[A-Za-z0-9_]{3,16}$/.test(n)) return bad('Use 3 to 16 letters, numbers or _.');
    if ((FR.rows || []).some(f => f.name.toLowerCase() === n.toLowerCase())) return bad(n + ' is already your friend.');
    try { const r = await api('/api/friends/add', { name: n }); FR.rows = (FR.rows || []).concat([r.friend]); if (r.friend.online) ONLINE.add(r.friend.id); toast(r.friend.name + ' added'); renderView(); } catch (err) { bad(err.message); } };
  v.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => challengeSheet(fr.find(f => f.id === b.dataset.ch)));
}

function viewRank(v) {
  const lb = LB[rankScope]; if (!lb || Date.now() - lb.at > 30000) loadLB(rankScope);
  const t = tierOf(P.elo); const rows = lb ? lb.rows : [];
  const pos = rankScope === 'friends' ? rows.findIndex(x => x.id === P.id) + 1 : lb && lb.rank;
  const row = (x, i) => `<tr class="${x.id === P.id ? 'me' : ''}"><td><span class="pos${i < 3 ? ' p' + (i + 1) : ''}">${i + 1}</span></td><td><div class="row">${embSvg(x.elo, 24)}<b>${esc(x.name)}${x.id === P.id ? ' (you)' : ''}</b>${x.plus ? '<span class="badge gd" style="margin-left:6px">Plus</span>' : ''}</div></td><td><span class="cc" style="margin:0">${esc(x.country || '')}</span></td><td>${tierOf(x.elo)[1]}</td><td class="r"><span class="elo num">${x.elo}</span></td></tr>`;
  const inTop = rows.slice(0, 50).some(x => x.id === P.id);
  v.innerHTML = `<div class="row" style="justify-content:space-between;flex-wrap:wrap"><h1 class="pt">Ranking</h1>
    <div class="seg" role="group" aria-label="Ranking scope">${[['world', 'World'], ['country', COUNTRIES[P.country] || P.country], ['friends', 'Friends']].map(([k, l]) => `<button type="button" data-sc="${k}" aria-pressed="${rankScope === k}">${esc(l)}</button>`).join('')}</div></div>
  <div class="cols"><div class="panel"><div class="tblwrap"><table class="tbl"><thead><tr><th>#</th><th>Player</th><th>Country</th><th>Tier</th><th class="r">Elo</th></tr></thead><tbody>${rows.slice(0, 50).map(row).join('')}
    ${!inTop && pos ? `<tr><td colspan="5" class="gapline">• • •</td></tr>${row({ id: P.id, name: P.name, elo: P.elo, country: P.country, plus: P.plus }, pos - 1)}` : ''}
    ${!rows.length ? `<tr><td colspan="5" class="muted" style="padding:18px">${lb ? 'Nobody here yet. Play a game to appear.' : 'Loading…'}</td></tr>` : ''}</tbody></table></div>
    <p class="note" style="margin:0">Players appear after their first game. Ranked games against bots and online ranked games move your Elo.</p></div>
  <div class="stack"><div class="panel"><div class="row">${embSvg(P.elo, 60)}<div class="grow"><div class="ui" style="font-size:24px">${pos ? '#' + pos + ' · ' : ''}${t[1]}</div><div class="muted num">${P.elo} Elo${P.st.games ? '' : ' · play a game to get ranked'}</div></div><span class="live">Live</span></div></div>
    <div class="panel"><div class="ph"><h3>Tiers</h3></div><div class="list">${TIERS.map(x => `<div class="li">${embSvg(x[0], 24)}<b style="color:${x[2]}">${x[1]}</b><span class="num muted">${x[0]}+</span></div>`).join('')}</div></div></div></div>`;
  v.querySelectorAll('[data-sc]').forEach(b => b.onclick = () => { rankScope = b.dataset.sc; renderView(); });
}

// ---------- shop ----------
function preview(cat, key, it) {
  if (cat === 'skin') { const s = key === 'custom' ? skinOf('custom') : it; return `<div class="pvb">${blkHtml(s, 26)}${blkHtml(s, 26)}${blkHtml(s, 26)}${blkHtml(s, 26)}</div>`; }
  if (cat === 'glow') return `<div class="pvb">${[0, 1, 2, 3].map(() => blkHtml(skinOf(P.eq.skin), 26, key)).join('')}</div>`;
  if (cat === 'blast') return `<canvas data-blast="${key}" width="150" height="84" style="width:100%;height:84px"></canvas>`;
  return `<span class="word" style="${it.fx === 'neon' ? 'color:#fff;text-shadow:0 0 8px #5BD8FF,0 0 16px #FF4FA3' : `background:${it.col};-webkit-background-clip:text;background-clip:text;color:transparent`}">${esc(it.words[1])}</span>`;
}
const catsBar = () => `<div class="cats" role="group" aria-label="Category"><button type="button" class="money" data-cat="store" aria-pressed="${shopCat === 'store'}">Store<span>€</span></button>${Object.entries(CATS).map(([k, c]) => `<button type="button" data-cat="${k}" aria-pressed="${k === shopCat}">${c.label}<span>${Object.keys(c.data).length}</span></button>`).join('')}</div>`;
function viewShop(v) {
  if (shopCat === 'store') return viewStore(v);
  const cat = CATS[shopCat]; const groups = {}; Object.entries(cat.data).forEach(([k, it]) => { const g = it.plus ? 'Plus exclusive' : (it.grp || 'Standard'); (groups[g] = groups[g] || []).push([k, it]); });
  v.innerHTML = `<h1 class="pt">Shop</h1><div class="shop">${catsBar()}
  <div class="stack">
    <div class="plus"><div style="position:relative;z-index:1"><h3>Blockmate Plus</h3><p>Gold, Diamond, Galaxy, your own color · premium glows, blasts and reactions · double daily reward</p></div>
      <button class="btn main" type="button" id="plusBtn" style="position:relative;z-index:1">${P.plus ? 'Plus is active' : 'See Plus · ' + euro(PRODUCTS.plusMonth.cents) + ' / month'}</button></div>
    ${Object.entries(groups).map(([g, list]) => `<div class="grp">${g === 'Plus exclusive' ? '<span class="badge gd">Plus</span> Exclusive' : esc(g)}</div>
    <div class="items">${list.map(([k, it]) => { const own = owns(shopCat, k), eq = P.eq[shopCat] === k;
      const tag = eq ? '<span class="tg eqt">Equipped</span>' : own ? '<span class="tg own">Owned</span>' : it.plus ? '<span class="tg plt">Plus only</span>' : `<span class="pr">${coinSvg(17)}<span class="num">${it.price}</span></span>`;
      return `<button class="item${eq ? ' eq' : ''}${it.plus ? ' isplus' : ''}" type="button" data-it="${k}">${it.plus && !P.plus ? `<span class="lk">${LOCK}</span>` : ''}<span class="pv">${preview(shopCat, k, it)}</span><span class="nm">${esc(it.name)}</span>${tag}</button>`; }).join('')}</div>`).join('')}
    <p class="note" style="margin:0">Shop items only change how your game looks, never how it plays.</p></div></div>`;
  v.querySelector('#plusBtn').onclick = () => plusSheet();
  v.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { shopCat = b.dataset.cat; renderView(); });
  v.querySelectorAll('[data-it]').forEach(b => b.onclick = async () => { const k = b.dataset.it, it = cat.data[k];
    if (it.plus && !P.plus) { plusSheet(it.name + ' is a Plus item.'); return; }
    if (shopCat === 'skin' && it.custom) { customSheet(); return; }
    if (owns(shopCat, k)) { try { await api('/api/equip', { cat: shopCat, key: k }); SND.tick(); renderView(); toast(it.name + ' equipped'); } catch (e) { toast(e.message); } return; }
    const can = P.coins >= it.price; const c0 = shopCat;
    openSheet(`<h3>${esc(it.name)}</h3><div class="item" style="justify-self:center;width:170px"><span class="pv" style="height:100px">${preview(shopCat, k, it)}</span></div><p>${cat.label} · <b class="num">${it.price}</b> Blockcoins. You have <b class="num">${P.coins}</b>.</p>
      <div class="acts"><button class="btn main" type="button" id="buy" ${can ? '' : 'disabled'}>${can ? 'Buy and equip' : 'Not enough Blockcoins'}</button>${can ? '' : '<button class="btn" type="button" id="toStore">Get Blockcoins</button>'}<button class="btn" type="button" id="x">Cancel</button></div>
      ${can ? '' : '<p class="note" style="text-align:center">Earn Blockcoins with the daily reward and by beating harder bots.</p>'}`,
      s => { const bb = s.querySelector('#buy'); bb.onclick = async () => { bb.disabled = true; try { await api('/api/buy', { cat: c0, key: k }); SND.win(); closeSheet(); renderView(); toast(it.name + ' unlocked'); } catch (e) { toast(e.message); bb.disabled = false; } };
        s.querySelector('#x').onclick = closeSheet; const ts = s.querySelector('#toStore'); if (ts) ts.onclick = () => { closeSheet(); shopCat = 'store'; renderView(); }; s.querySelectorAll('canvas[data-blast]').forEach(demoBlast); }); });
  v.querySelectorAll('canvas[data-blast]').forEach(demoBlast);
}
function pile(n) { const k = n < 1000 ? 1 : n < 2000 ? 2 : n < 5000 ? 3 : n < 10000 ? 4 : 5; let h = ''; for (let i = 0; i < k; i++) h += coinSvg(i === Math.floor(k / 2) ? 46 : 38); return h; }
function viewStore(v) {
  const packs = Object.entries(PRODUCTS).filter(([, p]) => p.kind === 'coins');
  const st = PRODUCTS.starter;
  v.innerHTML = `<h1 class="pt">Shop</h1><div class="shop">${catsBar()}
  <div class="stack">
    <div class="plus"><div style="position:relative;z-index:1"><h3>Blockmate Plus</h3><p>7 exclusive skins, premium glows, blasts and reactions · double daily reward</p></div>${P.plus ? '<button class="btn" type="button" id="plusM" style="position:relative;z-index:1">Plus is active · manage</button>' : ''}</div>
    ${P.plus ? '' : `<div class="subs"><button class="sub" type="button" data-sub="plusMonth"><b>Monthly</b><span class="p">${euro(PRODUCTS.plusMonth.cents)} <small>/ month</small></span><span class="note">Cancel anytime</span></button>
      <button class="sub" type="button" data-sub="plusYear"><em class="badge gd">Save 33%</em><b>Yearly</b><span class="p">${euro(PRODUCTS.plusYear.cents)} <small>/ year</small></span><span class="note">${euro(Math.round(PRODUCTS.plusYear.cents / 12))} a month</span></button></div>`}
    ${P.starter ? '' : `<div class="starter"><div class="row">${coinSvg(46)}${blkHtml(SKINS.stripes, 34)}${blkHtml(skinOf(P.eq.skin), 34, 'cyan')}</div><div class="grow"><b>Starter pack</b><span class="muted">${st.coins} Blockcoins + Racing skin + Neon glow · one time only</span></div><button class="btn main" type="button" id="starter">${euro(st.cents)}</button></div>`}
    <div class="grp">Blockcoins</div>
    <div class="packs">${packs.map(([id, k]) => `<button class="pack${k.tag === 'Popular' ? ' hl' : ''}" type="button" data-pack="${id}">${k.tag ? `<em class="badge ${k.tag === 'Popular' ? 'or' : 'gd'}">${k.tag}</em>` : ''}<span class="art">${pile(k.coins)}</span><span class="amt num">${k.coins.toLocaleString('en-US')}</span><span class="bon">${k.bonus || ''}</span><span class="buy num">${euro(k.cents)}</span></button>`).join('')}</div>
    <p class="note" style="margin:0">Blockcoins you buy are spent in the Shop. Only Blockcoins you win by playing can be bet in friend duels, and no Blockcoins can be cashed out. Prices include all taxes.</p></div></div>`;
  v.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => { shopCat = b.dataset.cat; renderView(); });
  v.querySelectorAll('[data-pack]').forEach(b => b.onclick = () => checkoutSheet(b.dataset.pack, 'Spend them on skins, glows, blasts and reactions.'));
  v.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => checkoutSheet(b.dataset.sub, 'All premium items and double daily reward.'));
  const pm = v.querySelector('#plusM'); if (pm) pm.onclick = () => plusSheet();
  const sb = v.querySelector('#starter'); if (sb) sb.onclick = () => checkoutSheet('starter', st.coins + ' Blockcoins, the Racing skin and the Neon glow. One time only.');
}
function customSheet() {
  let col = P.custom;
  openSheet(`<h3>Your color</h3><p>Pick any color. Every block you place will wear it.</p>
    <div class="item" style="justify-self:center;width:170px"><span class="pv" style="height:100px" id="cpv">${preview('skin', 'custom', SKINS.custom)}</span></div>
    <label class="lb" style="justify-items:center">Color<input type="color" id="cpick" value="${esc(P.custom)}" style="width:120px;height:48px;border:1px solid var(--line-2);border-radius:10px;background:none"></label>
    <div class="acts"><button class="btn main" type="button" id="cok">Equip this color</button><button class="btn" type="button" id="x">Cancel</button></div>`,
    s => { const pk = s.querySelector('#cpick'); pk.oninput = () => { col = pk.value; s.querySelector('#cpv').innerHTML = `<div class="pvb">${[0, 1, 2, 3].map(() => blkHtml(skinOf('custom', col), 26)).join('')}</div>`; };
      s.querySelector('#cok').onclick = async () => { try { await api('/api/profile', { custom: col }); await api('/api/equip', { cat: 'skin', key: 'custom' }); closeSheet(); renderView(); toast('Your color is equipped'); } catch (e) { toast(e.message); } };
      s.querySelector('#x').onclick = closeSheet; });
}
function demoBlast(cv) { const f = new FX(cv, true); const go = () => { if (!cv.isConnected) return; f.burst(cv.dataset.blast, [{ x: cv.width / 2, y: cv.height / 2 }], skinOf(P.eq.skin)); setTimeout(go, 1700); }; go(); }

// ---------- profile and account ----------
function loginSheet() {
  openSheet(`<h3>Log in</h3><form id="lf" style="display:grid;gap:12px"><label class="lb">Username<input class="f" id="lu" maxlength="16" autocomplete="username" required></label>
    <label class="lb">Password<input class="f" id="lp" type="password" autocomplete="current-password" required></label><div class="note" id="lm" style="text-align:center"></div>
    <div class="acts"><button class="btn main" type="submit">Log in</button><button class="btn" type="button" id="x">Cancel</button></div></form>
    <p class="note" style="text-align:center">Logging in replaces the guest progress on this device.</p>`,
    s => { s.querySelector('#x').onclick = closeSheet; s.querySelector('#lf').onsubmit = async e => { e.preventDefault();
      try { await api('/api/login', { name: s.querySelector('#lu').value.trim(), password: s.querySelector('#lp').value }); closeSheet(); reconnect(); toast('Welcome back, ' + P.name); renderView(); }
      catch (err) { const m = s.querySelector('#lm'); m.textContent = err.message; m.style.color = 'var(--red)'; } }; });
}
function reconnect() { LB.world = LB.country = LB.friends = null; FR.rows = null; if (NET.ws) try { NET.ws.close(); } catch (e) {} }
function viewProfile(v) {
  const t = tierOf(P.elo), next = TIERS.find(x => x[0] > P.elo), wr = P.st.games ? Math.round(P.st.wins / P.st.games * 100) : 0;
  const countryOpts = Object.entries(COUNTRIES).map(([k, n]) => `<option value="${k}" ${k === P.country ? 'selected' : ''}>${n}</option>`).join('');
  const account = P.guest ? `<div class="panel hl"><div class="ph"><h3>Save your progress</h3><span class="badge or">Guest</span></div>
    <p class="muted" style="margin:0">You're playing as a guest on this device. Pick a username and a password to keep your Elo, Blockcoins and items, and to play on any device.</p>
    <form id="reg" style="display:grid;gap:12px">
      <label class="lb">Username<input class="f" id="fName" maxlength="16" value="${esc(P.name)}" autocomplete="username" required></label>
      <label class="lb">Password<input class="f" id="fPass" type="password" minlength="8" autocomplete="new-password" placeholder="At least 8 characters" required></label>
      <label class="lb">Email (optional, to recover your account)<input class="f" id="fMail" type="email" placeholder="you@example.com" autocomplete="email"></label>
      <label class="lb">Country<select class="f" id="fCountry">${countryOpts}</select></label>
      <button class="btn main" type="submit">Create my account</button><div class="note" id="accMsg">Your username and Elo appear in the rankings; your email stays private. <a href="/legal/privacy" target="_blank" rel="noopener">Privacy</a></div></form>
    <button class="link" type="button" id="login">I already have an account · Log in</button></div>`
    : `<div class="panel"><div class="ph"><h3>Account</h3></div>
    <form id="acc" style="display:grid;gap:12px">
      <label class="lb">Username<input class="f" id="fName" maxlength="16" value="${esc(P.name)}" autocomplete="nickname"></label>
      <label class="lb">Email<input class="f" id="fMail" type="email" value="${esc(P.email)}" placeholder="you@example.com" autocomplete="email"></label>
      <label class="lb">Country<select class="f" id="fCountry">${countryOpts}</select></label>
      <button class="btn main" type="submit">Save</button><div class="note" id="accMsg">Saved to your account, on every device. Your username and Elo appear in the rankings; your email stays private.</div></form>
    <button class="link" type="button" id="logout">Log out</button></div>`;
  v.innerHTML = `<h1 class="pt">Profile</h1><div class="cols2">
  <div class="stack"><div class="panel"><div class="row" style="gap:16px">${embSvg(P.elo, 64)}
      <div class="grow" style="min-width:0"><div class="ui" style="font-size:26px;letter-spacing:.04em;text-transform:none;overflow:hidden;text-overflow:ellipsis">${esc(P.name)}</div>
      <div class="muted"><span style="color:${t[2]};font-weight:700">${t[1]}</span> · <span class="num">${P.elo}</span> Elo${next ? ' · ' + next[1] + ' at ' + next[0] : ''}${P.plus ? ' · <span style="color:var(--gold)">Plus</span>' : ''}</div></div></div>
    <div class="stats"><div class="stat"><b class="num">${P.st.games}</b><span>Games</span></div><div class="stat"><b class="num">${wr}%</b><span>Win rate</span></div><div class="stat"><b class="num">${P.st.bestCombo || 0}</b><span>Best combo</span></div></div>
    <div class="stats">${Object.entries(LEVELS).map(([k, l]) => `<div class="stat"><b class="num">${P.rec[k] || '–'}</b><span>Best vs ${l.name}</span></div>`).join('')}</div></div>
    <div class="panel"><div class="ph"><h3>Your look</h3><button class="btn sm" type="button" id="toShop">Shop</button></div>
      <div class="row" style="flex-wrap:wrap;gap:8px">${Object.entries(CATS).map(([k, c]) => `<span class="badge dk">${c.label}: ${esc(c.data[P.eq[k]].name)}</span>`).join('')}</div></div>
    <div class="panel"><div class="ph"><h3>Blockmate Plus</h3>${P.plus ? '<span class="badge gd">Active</span>' : ''}</div><p class="muted" style="margin:0">${P.plus ? 'All premium items are unlocked.' : 'Premium skins and effects, double daily reward.'}</p><button class="btn${P.plus ? '' : ' main'}" type="button" id="plusP">${P.plus ? 'Manage Plus' : 'See Plus'}</button></div></div>
  <div class="stack">${account}</div></div>
  <div class="panel"><div class="ph"><h2>How it works</h2></div>
    <details class="g"><summary>The game</summary><div><p>Two players share one 8×8 board and 3 pieces. On your turn, drag a piece onto the board: a white outline shows exactly where it will land, and it snaps to the nearest free spot. Your rival then picks from what's left, plus a new piece.</p><p>Each block you place is worth 1 point. When a player can't place any piece, the game ends and the other player gets a +25 block bonus. Highest score wins. Online, each turn lasts 25 seconds.</p></div></details>
    <details class="g"><summary>Lines & combos</summary><div><p>Fill a full row or column to clear it. Each line is worth 10 points, and clearing several at once pays more:</p>
      <table><tr><td>1 line</td><td>10</td></tr><tr><td>2 lines at once</td><td>30</td></tr><tr><td>3 lines at once</td><td>60</td></tr><tr><td>4 lines at once</td><td>100</td></tr></table>
      <p>Clear lines on your next turns too to build a combo: combo 2 multiplies your line points by 1.25, combo 3 by 1.5, combo 4 by 1.75. Your combo bar sits under your score and drops to 0 when you place a piece that clears nothing.</p></div></details>
    <details class="g"><summary>Bots & rewards</summary><div><p>Rookie plays almost at random, Pro always grabs the most points it can, Master reads your next move and tries to block you. Harder bots pay more Blockcoins:</p>
      <table>${Object.values(LEVELS).map(l => `<tr><td>${l.name} (${l.elo} Elo)</td><td>Win +${l.win} · Draw +${l.draw} · Loss +${l.loss}</td></tr>`).join('')}<tr><td>Online ranked</td><td>Win +${C.ONLINE.win} · Draw +${C.ONLINE.draw} · Loss +${C.ONLINE.loss}</td></tr></table><p>Practice games pay a quarter of that and never change your Elo.</p></div></details>
    <details class="g" id="g-rank"><summary>Elo & tiers</summary><div><p>Everyone starts at 1200 Elo. After each Ranked game your Elo moves based on the result and your opponent's Elo: beating a stronger opponent earns more, losing to a weaker one costs more. Leaving a Ranked game counts as a loss.</p>
      <table>${TIERS.map(x => `<tr><td style="color:${x[2]}">${x[1]}</td><td>${x[0]}+ Elo</td></tr>`).join('')}</table></div></details>
    <details class="g"><summary>Blockcoins</summary><div><p>Earn Blockcoins with the daily reward (up to 150 on day 7 of your streak, doubled with Plus) and by winning games, or buy packs in the Store. Spend them in the Shop. Only Blockcoins you won by playing can be bet in friend duels, and Blockcoins can never be turned back into money.</p></div></details>
  </div>
  <button class="link" type="button" id="resetAll">Reset my Elo, records and stats</button>`;
  const msg = v.querySelector('#accMsg'); const bad = t => { msg.textContent = t; msg.style.color = 'var(--red)'; };
  const reg = v.querySelector('#reg');
  if (reg) reg.onsubmit = async e => { e.preventDefault(); const b = reg.querySelector('button[type=submit]'); b.disabled = true;
    try { await api('/api/register', { name: v.querySelector('#fName').value.trim(), password: v.querySelector('#fPass').value, email: v.querySelector('#fMail').value.trim(), country: v.querySelector('#fCountry').value }); SND.win(); toast('Account created. Welcome, ' + P.name + '!'); renderView(); }
    catch (err) { bad(err.message); b.disabled = false; } };
  const lg = v.querySelector('#login'); if (lg) lg.onclick = loginSheet;
  const acc = v.querySelector('#acc');
  if (acc) acc.onsubmit = async e => { e.preventDefault();
    try { await api('/api/profile', { name: v.querySelector('#fName').value.trim(), email: v.querySelector('#fMail').value.trim(), country: v.querySelector('#fCountry').value }); LB.country = null; renderView(); toast('Profile saved'); } catch (err) { bad(err.message); } };
  const lo = v.querySelector('#logout'); if (lo) lo.onclick = async () => { try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {} await api('/api/me'); reconnect(); renderView(); toast('Logged out'); };
  v.querySelector('#toShop').onclick = () => setTab('shop'); v.querySelector('#plusP').onclick = () => plusSheet();
  let armed = false; v.querySelector('#resetAll').onclick = async e => { if (!armed) { armed = true; e.target.textContent = 'Click again to reset Elo, records and stats'; setTimeout(() => { armed = false; if (e.target.isConnected) e.target.textContent = 'Reset my Elo, records and stats'; }, 3500); return; }
    try { await api('/api/reset', {}); renderView(); toast('Progress reset. Your Blockcoins and items are kept.'); } catch (err) { toast(err.message); } };
}

// ---------- effects ----------
class FX {
  constructor(cv, small) { this.cv = cv; this.ctx = cv.getContext('2d'); this.p = []; this.run = false; this.small = small; this.flash = 0; }
  size() { const r = this.cv.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); this.w = r.width; this.h = r.height; this.cv.width = r.width * dpr; this.cv.height = r.height * dpr; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  burst(type, pts, skin) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !pts.length) return;
    if (this.small) { this.w = this.cv.width; this.h = this.cv.height; }
    const R = (a, b) => a + Math.random() * (b - a), add = o => this.p.push(Object.assign({ life: 0, max: 700, vx: 0, vy: 0, g: 0, rot: 0, vr: 0, size: 4, shape: 'c', drag: .985 }, o));
    const ring = (pt, col, max, grow) => add({ x: pt.x, y: pt.y, shape: 'ring', col, max, grow });
    const cx = pts.reduce((a, p) => a + p.x, 0) / pts.length, cy = pts.reduce((a, p) => a + p.y, 0) / pts.length;
    pts.forEach((pt, i) => { switch (type) {
      case 'confetti': { const cols = ['#FF5DA2', '#FFD84A', '#3E8BFF', '#1FCB9C', '#9C6BFF']; for (let k = 0; k < 5; k++) add({ x: pt.x, y: pt.y, vx: R(-2.4, 2.4), vy: R(-4.5, -1.2), g: .16, size: R(5, 8), shape: 'r', col: cols[k], vr: R(-.3, .3), max: 950 }); } break;
      case 'embers': for (let k = 0; k < 6; k++) add({ x: pt.x + R(-8, 8), y: pt.y, vx: R(-.8, .8), vy: R(-3, -1), g: -.03, col: ['#FFE27A', '#FF8A1E', '#FF3D00'][k % 3], size: R(2, 4), max: 900 }); break;
      case 'frost': for (let k = 0; k < 5; k++) { const a = R(0, 6.28); add({ x: pt.x, y: pt.y, vx: Math.cos(a) * R(1, 3), vy: Math.sin(a) * R(1, 3), col: k % 2 ? '#E6FBFF' : '#7FE4FF', size: R(3, 6), shape: 'shard', rot: a, max: 750 }); } break;
      case 'pixels': for (let k = 0; k < 6; k++) add({ x: pt.x + R(-10, 10), y: pt.y + R(-10, 10), vx: R(-1.6, 1.6), vy: R(-3.2, -.6), g: .2, col: k % 2 ? skin.h : skin.b, size: R(4, 7), shape: 'sq', max: 850 }); break;
      case 'bubbles': for (let k = 0; k < 3; k++) add({ x: pt.x + R(-8, 8), y: pt.y, vx: R(-.5, .5), vy: R(-2.2, -.8), col: skin.h, size: R(4, 8), shape: 'bub', max: 1000 }); break;
      case 'stars': for (let k = 0; k < 4; k++) { const a = R(0, 6.28); add({ x: pt.x, y: pt.y, vx: Math.cos(a) * R(1, 3.5), vy: Math.sin(a) * R(1, 3.5), col: k % 2 ? '#FFFFFF' : '#FFD84A', size: R(4, 7), shape: 'star', vr: R(-.2, .2), max: 850 }); } break;
      case 'shock': if (i % 4 === 0) ring(pt, skin.h, 560, 46); for (let k = 0; k < 3; k++) { const a = R(0, 6.28); add({ x: pt.x, y: pt.y, vx: Math.cos(a) * R(1, 3), vy: Math.sin(a) * R(1, 3), col: '#FFFFFF', size: R(1.5, 3) }); } break;
      case 'goldrain': for (let k = 0; k < 6; k++) add({ x: pt.x + R(-10, 10), y: pt.y - R(0, 10), vx: R(-.8, .8), vy: R(-3.4, -.6), g: .13, col: ['#FFF6CF', '#F2C65A', '#D99E2B'][k % 3], size: R(3, 6), shape: 'star', vr: .15, max: 1100 }); break;
      case 'fireworks': if (i % 3 === 0) { const cols = ['#FF4D6D', '#FFD84A', '#4DFF88', '#5BD8FF', '#C08BFF'], col = cols[Math.floor(R(0, 5))]; for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28; add({ x: pt.x, y: pt.y, vx: Math.cos(a) * R(2.5, 4), vy: Math.sin(a) * R(2.5, 4), g: .05, col, size: 2.6, max: 1000, trail: [] }); } } break;
      case 'lightning': case 'nova': break;
      default: for (let k = 0; k < 6; k++) { const a = R(0, 6.28); add({ x: pt.x, y: pt.y, vx: Math.cos(a) * R(1.5, 4.2), vy: Math.sin(a) * R(1.5, 4.2), col: k % 2 ? '#FFFFFF' : skin.h, size: R(2, 4) }); } } });
    if (type === 'lightning') { for (let k = 0; k < Math.min(5, pts.length); k++) { const a = pts[Math.floor(Math.random() * pts.length)], b = pts[Math.floor(Math.random() * pts.length)]; const path = []; for (let j = 0; j <= 8; j++) path.push({ x: a.x + (b.x - a.x) * j / 8 + (j % 8 ? R(-14, 14) : 0), y: a.y + (b.y - a.y) * j / 8 + (j % 8 ? R(-14, 14) : 0) }); add({ shape: 'bolt', path, col: '#BFE6FF', max: 420, x: 0, y: 0 }); }
      pts.forEach(pt => add({ x: pt.x, y: pt.y, vx: R(-1, 1), vy: R(-1, 1), col: '#E6F6FF', size: R(1.5, 3) })); this.flash = .3; }
    if (type === 'nova') { ring({ x: cx, y: cy }, '#FFFFFF', 700, 140); ring({ x: cx, y: cy }, skin.h, 900, 110); for (let k = 0; k < 26; k++) { const a = k / 26 * 6.28; add({ x: cx, y: cy, vx: Math.cos(a) * R(4, 7), vy: Math.sin(a) * R(4, 7), col: k % 2 ? '#FFFFFF' : skin.h, size: R(2, 4), max: 800 }); } this.flash = .4; }
    if (!this.run) { this.run = true; this.last = performance.now(); requestAnimationFrame(t => this.tick(t)); } }
  tick(t) { const dt = Math.min(40, t - this.last); this.last = t; const c = this.ctx, w = this.w || this.cv.width, h = this.h || this.cv.height; c.clearRect(0, 0, w, h);
    if (this.flash > 0) { c.globalAlpha = this.flash; c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, w, h); this.flash = Math.max(0, this.flash - dt / 300); }
    this.p = this.p.filter(p => (p.life += dt) < p.max); const k = dt / 16;
    for (const p of this.p) { p.vx *= p.drag; p.vy = p.vy * p.drag + p.g * k; p.x += p.vx * k; p.y += p.vy * k; p.rot += p.vr * k; const a = Math.max(0, 1 - p.life / p.max); c.globalAlpha = a; c.fillStyle = p.col; c.strokeStyle = p.col;
      if (p.trail) { p.trail.push([p.x, p.y]); if (p.trail.length > 6) p.trail.shift(); c.lineWidth = 2; c.beginPath(); p.trail.forEach(([x, y], j) => j ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
      switch (p.shape) {
      case 'ring': c.lineWidth = 4 * a; c.beginPath(); c.arc(p.x, p.y, 4 + (1 - a) * p.grow, 0, 6.28); c.stroke(); break;
      case 'r': c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore(); break;
      case 'sq': c.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); break;
      case 'shard': c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.moveTo(0, -p.size); c.lineTo(p.size / 3, 0); c.lineTo(0, p.size); c.lineTo(-p.size / 3, 0); c.closePath(); c.fill(); c.restore(); break;
      case 'bub': c.lineWidth = 1.6; c.beginPath(); c.arc(p.x, p.y, p.size, 0, 6.28); c.stroke(); c.globalAlpha = a * .5; c.beginPath(); c.arc(p.x - p.size / 3, p.y - p.size / 3, p.size / 4, 0, 6.28); c.fill(); break;
      case 'star': c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); for (let j = 0; j < 10; j++) { const rr = j % 2 ? p.size / 2.4 : p.size; const an = j * Math.PI / 5 - Math.PI / 2; c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.restore(); break;
      case 'bolt': c.lineWidth = 3 * a + 1; c.shadowColor = '#7FC8FF'; c.shadowBlur = 12; c.beginPath(); p.path.forEach((q, j) => j ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y)); c.stroke(); c.shadowBlur = 0; break;
      default: c.beginPath(); c.arc(p.x, p.y, p.size * a + .6, 0, 6.28); c.fill(); } }
    c.globalAlpha = 1; if (this.p.length || this.flash > 0) requestAnimationFrame(tt => this.tick(tt)); else { this.run = false; c.clearRect(0, 0, w, h); } }
}
const fx = new FX($('fx'));

// ---------- the game screen ----------
// G.st is the rules state (board, tray, scores, combo, best, turn, over, stuck). Board cells hold player index + 1.
// G.me is the player index this browser controls (always 0 except online). The left panel always shows G.me.
let G = null, cells = [];
const myLook = () => ({ skin: skinOf(P.eq.skin), glow: P.eq.glow, blast: P.eq.blast, react: P.eq.react });
const rivalLook = () => ({ skin: RIVAL, glow: null, blast: 'spark', react: 'classic' });
function lookOf(card, mine) {
  const sk = card.eq && SKINS[card.eq.skin] && (!SKINS[card.eq.skin].plus || card.plus) ? skinOf(card.eq.skin, card.custom) : SKINS.sapphire;
  const clash = sk.b.toLowerCase() === mine.skin.b.toLowerCase();
  const ok = (cat, k, d) => CATS[cat].data[k] && (!CATS[cat].data[k].plus || card.plus) ? k : d;
  return { skin: clash ? RIVAL : sk, glow: clash ? null : ok('glow', card.eq && card.eq.glow, null), blast: ok('blast', card.eq && card.eq.blast, 'spark'), react: ok('react', card.eq && card.eq.react, 'classic') };
}
const panelIdx = k => k === 0 ? G.me : 1 - G.me;
const isHuman = t => G.mode === 'local' || t === G.me;

async function startSolo(level, ranked) {
  SND.init();
  let r; try { r = await api('/api/solo/start', { level, ranked }); } catch (e) { toast(e.message); return; }
  const st = E.newState(r.seed);
  openGame({ mode: 'solo', level, ranked, gid: r.id, st, br: E.rng(E.botSeed(r.seed)), hm: [], me: 0,
    look: [myLook(), rivalLook()], names: [P.name, LEVELS[level].name], sub: [tierOf(P.elo)[1] + ' · ' + P.elo + ' Elo', 'Bot · ' + LEVELS[level].elo + ' Elo'],
    modeHtml: `Solo · <b>${ranked ? 'Ranked' : 'Practice'}</b> · win +${reward(level, 1, ranked)}`, stake: 0 });
}
function startLocal() {
  SND.init();
  openGame({ mode: 'local', st: E.newState((Math.random() * 2 ** 32) >>> 0), me: 0, look: [myLook(), rivalLook()], names: [P.name, 'Player 2'], sub: ['Player 1', 'Player 2'], modeHtml: 'Duel · <b>Same screen</b>', stake: 0 });
}
function startOnline(m) {
  const mine = myLook(); const opp = lookOf(m.opp, mine); const look = []; look[m.you] = mine; look[1 - m.you] = opp;
  const names = [], sub = []; names[m.you] = P.name; names[1 - m.you] = m.opp.name; sub[m.you] = tierOf(P.elo)[1] + ' · ' + P.elo + ' Elo'; sub[1 - m.you] = tierOf(m.opp.elo)[1] + ' · ' + m.opp.elo + ' Elo';
  const s = m.state;
  openGame({ mode: 'online', kind: s.kind, mid: s.id, st: pickState(s), me: m.you, look, names, sub, opp: m.opp, stake: s.stake, deadline: Date.now() + (s.deadline - s.now),
    modeHtml: s.kind === 'ranked' ? 'Online · <b>Ranked</b>' : `Friend duel · <b>${s.stake ? s.stake + ' coins' : 'Friendly'}</b>` });
  if (!m.resume) { SND.ping(); toast(m.you === s.turn ? 'You start. Good luck!' : m.opp.name + ' starts.'); }
}
const pickState = s => ({ board: s.board, tray: s.tray, scores: s.scores, combo: s.combo, best: s.best, turn: s.turn, over: s.over, stuck: s.stuck });
function openGame(o) {
  G = Object.assign({ busy: false, sel: null }, o);
  $('gMode').innerHTML = o.modeHtml;
  $('stakebar').hidden = !o.stake; if (o.stake) $('stakebar').innerHTML = `${coinSvg(18)}${o.stake} Blockcoins each on the line`;
  $('page').hidden = true; $('foot').hidden = true; $('game').hidden = false; sheetKind = null; closeSheet(); resignArmed = false; $('gResign').textContent = 'Resign'; renderSnd(); renderMu(); MUS.go('game');
  buildGrid(); requestAnimationFrame(() => fx.size()); renderAll(); startTurn();
}
function buildGrid() { const g = $('grid'); g.innerHTML = ''; cells = []; for (let i = 0; i < N * N; i++) { const d = document.createElement('div'); d.className = 'cell'; d.dataset.i = i; g.appendChild(d); cells.push(d); } }
function renderBoard(b, ghost) { b = b || G.st.board;
  for (let i = 0; i < N * N; i++) { const el = cells[i]; el.classList.remove('ghost', 'willclear', 'flash'); const o = b[i]; if (o) { const L = G.look[o - 1]; paint(el, L.skin, L.glow); } else unpaint(el); }
  if (ghost) { const L = G.look[G.st.turn]; ghost.cells.forEach(k => { paint(cells[k], L.skin); cells[k].classList.add('ghost'); }); ghost.clear.forEach(k => cells[k].classList.add('willclear')); } }
function comboHtml(p) { const c = G.st.combo[p]; return `<div class="lbl"><span>Combo</span><b>${c ? c + ' · next ' + fmtMult(E.comboMult(c + 1)) : '0'}</b></div><div class="pips">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= c ? 'on' : ''}"></i>`).join('')}</div>`; }
function turnText(p) {
  if (G.st.over || G.st.turn !== p) return '';
  if (G.mode !== 'online') return isHuman(p) ? 'Your turn' : 'Thinking…';
  const s = Math.max(0, Math.ceil((G.deadline - Date.now()) / 1000));
  return (p === G.me ? 'Your turn · ' : 'Their turn · ') + s + 's';
}
function renderPlayers() { for (let k = 0; k < 2; k++) { const p = panelIdx(k); $('n' + k).textContent = G.names[p]; $('e' + k).textContent = G.sub[p]; $('s' + k).textContent = G.st.scores[p]; paint($('d' + k), G.look[p].skin);
  $('p' + k).classList.toggle('on', !G.st.over && G.st.turn === p); const cEl = $('c' + k); cEl.innerHTML = comboHtml(p); cEl.classList.toggle('hot', G.st.combo[p] > 0);
  const tt = $('t' + k); tt.textContent = turnText(p); tt.classList.toggle('urgent', G.mode === 'online' && G.st.turn === p && G.deadline - Date.now() < 6000); } }
function renderTray() { const t = $('tray'); t.innerHTML = ''; const human = isHuman(G.st.turn) && !G.st.over; const L = G.look[G.st.turn];
  G.st.tray.forEach((si, ti) => { const s = document.createElement('button'); s.type = 'button'; s.className = 'slot'; s.dataset.ti = ti; const d = DIM[si];
    const mini = document.createElement('div'); mini.className = 'mini'; mini.style.gridTemplateColumns = `repeat(${d.w},var(--m))`; mini.style.setProperty('--m', Math.min(20, Math.floor(92 / Math.max(d.w, d.h, 3)) - 2) + 'px');
    const set = new Set(SHAPES[si].map(p => p[0] * 10 + p[1]));
    for (let r = 0; r < d.h; r++) for (let c = 0; c < d.w; c++) { const i = document.createElement('i'); if (set.has(r * 10 + c)) paint(i, L.skin); else i.className = 'e'; mini.appendChild(i); }
    s.appendChild(mini); if (!E.canPlace(G.st.board, si)) s.classList.add('dim'); if (!human) s.classList.add('off'); if (G.sel === ti) s.classList.add('sel');
    s.setAttribute('aria-label', 'Piece of ' + SHAPES[si].length + ' blocks'); t.appendChild(s); }); }
function status(h) { $('status').innerHTML = h; }
function renderAll() { renderBoard(); renderPlayers(); renderTray(); }
setInterval(() => { if (G && G.mode === 'online' && !G.st.over) { renderPlayers(); const left = G.deadline - Date.now(); if (G.st.turn === G.me && left < 5500 && left > 0 && Math.floor(left / 1000) !== G._tk) { G._tk = Math.floor(left / 1000); SND.tick(); } } }, 250);
function turnHint() { const c = G.st.combo[G.st.turn]; const who = G.mode === 'local' ? `<b>${esc(G.names[G.st.turn])}</b>, your turn.` : '<b>Your turn.</b>';
  return c ? `${who} <span class="hot">Combo ${c}: clear a line now for ${fmtMult(E.comboMult(c + 1))}.</span>` : `${who} Drag a piece onto the board.`; }
function startTurn() {
  if (!G || G.st.over) return; G.sel = null; renderAll();
  if (G.mode !== 'online' && !E.moves(G.st.board, G.st.tray).length) { G.st.over = true; G.st.stuck = G.st.turn; G.st.scores[1 - G.st.turn] += E.BLOCK_BONUS; return localEnd(); }
  if (isHuman(G.st.turn)) status(turnHint());
  else if (G.mode === 'online') status(`<b>${esc(G.names[G.st.turn])}</b> is playing…`);
  else { status(`<b>${esc(G.names[1])}</b> is thinking…`); G.busy = true; const g = G;
    setTimeout(async () => { if (G !== g || g.st.over) return; const m = E.botMove(g.st, g.level, g.br); if (!m) { g.busy = false; return; }
      const res = E.apply(g.st.board, m.si, m.r, m.c, 2, g.st.combo[1]); renderBoard(null, { cells: shapeCells(m.si, m.r, m.c), clear: res.cleared });
      await sleep(450); if (G !== g || g.st.over) return; g.busy = false; playLocal(m.ti, m.r, m.c); }, g.level === 'hard' ? 700 : g.level === 'medium' ? 560 : 480); }
}
function shapeCells(si, r, c) { return SHAPES[si].map(([dr, dc]) => (r + dr) * N + (c + dc)); }
function cellCenter(k) { const g = $('grid').getBoundingClientRect(), f = $('fx').getBoundingClientRect(); const pitch = (g.width + 4) / N; return { x: g.left - f.left + (k % N + .5) * pitch - 2, y: g.top - f.top + (Math.floor(k / N) + .5) * pitch - 2 }; }

// Shows a move that the rules state already contains. `before` is the board before it.
async function animate(before, mv) {
  const g = G, L = g.look[mv.p]; const placed = before.slice(); shapeCells(mv.si, mv.r, mv.c).forEach(k => placed[k] = mv.p + 1);
  g.busy = true; renderBoard(placed); SND.place(); floatPts(mv.si, mv.r, mv.c, '+' + mv.gain, L.skin); renderPlayers(); renderTray();
  if (mv.cleared.length) { reaction(mv, L); SND.clear(mv.lines, mv.combo); await sleep(90); mv.cleared.forEach(k => cells[k].classList.add('flash')); fx.burst(L.blast, mv.cleared.map(cellCenter), L.skin); await sleep(360); }
  if (G !== g) return false; g.busy = false; renderBoard(); return true;
}
function myMove(ti, r, c) {
  if (G.mode === 'online') {
    if (!NET.send({ t: 'move', ti, r, c })) return;
    G.busy = true; G.sel = null; const si = G.st.tray[ti]; const res = E.apply(G.st.board, si, r, c, G.me + 1, G.st.combo[G.me]); renderBoard(null, { cells: shapeCells(si, r, c), clear: res.cleared }); return;
  }
  playLocal(ti, r, c);
}
async function playLocal(ti, r, c) {
  const g = G, before = g.st.board.slice(); const mv = E.play(g.st, ti, r, c); if (!mv) return;
  if (g.mode === 'solo' && mv.p === 0) g.hm.push({ ti, r, c });
  if (!await animate(before, mv)) return;
  if (g.st.over) localEnd(); else startTurn();
}
function stuckLine() { const s = G.st.stuck, w = 1 - s; return `<b>${esc(G.names[s])}</b> can't place any piece. <span class="hot">+${E.BLOCK_BONUS} block bonus</span> to <b>${esc(G.names[w])}</b>.`; }
function localEnd() { renderPlayers(); renderTray(); status(stuckLine()); const g = G; setTimeout(() => { if (G === g) result(); }, 950); }

async function result(resigned) {
  const g = G; g.over = true; const st = g.st; const a = st.scores[g.me], b = st.scores[1 - g.me];
  let res, title, line, extra = '', cls;
  if (g.mode === 'solo') {
    let r; try { r = await api('/api/solo/finish', { id: g.gid, moves: g.hm, resigned: !!resigned }); } catch (e) { r = null; toast(e.message); }
    if (G !== g) return;
    res = r ? r.result : (resigned ? 0 : E.resultFor(st, 0));
    title = res === 1 ? 'Victory' : res === 0 ? 'Defeat' : 'Draw'; cls = res === 1 ? 'win' : res === 0 ? 'lose' : '';
    line = resigned ? 'You left the game.' : res === 1 ? 'You out-played ' + g.names[1] + '.' : res === 0 ? g.names[1] + ' wins this one.' : 'Nobody pulled ahead.';
    if (r) {
      extra += g.ranked ? `<div class="delta ${r.elo >= 0 ? 'up' : 'down'} num">${r.elo >= 0 ? '+' : ''}${r.elo} Elo · now ${P.elo} (${tierOf(P.elo)[1]})</div>` : '<div class="delta num" style="color:var(--text-3)">Practice: Elo unchanged</div>';
      if (r.coins) extra += `<div class="delta up num coinline">${coinSvg(20)}+${r.coins} Blockcoins</div>`;
      if (r.record) extra += `<div class="delta up">New personal best vs ${g.names[1]}</div>`;
    }
  } else {
    api('/api/track', { e: 'local_end' }).catch(() => {});
    res = resigned != null ? (resigned === 0 ? 0 : 1) : E.resultFor(st, 0);
    title = res === 0.5 ? 'Draw' : esc(res === 1 ? g.names[0] : g.names[1]) + ' wins'; cls = res === 0.5 ? '' : 'win';
    line = resigned != null ? esc(g.names[resigned]) + ' resigned.' : 'Best combo: ' + st.best[0] + ' vs ' + st.best[1];
  }
  if (res === 1 || g.mode === 'local') SND.win(); else if (res === 0) SND.lose();
  openSheet(`<h3 class="${cls}">${title}</h3><p>${line}</p><div class="big num">${a} – ${b}</div>${extra}
    <div class="acts"><button class="btn main" type="button" id="again">Play again</button><button class="btn" type="button" id="home">Back to menu</button></div>`,
    s => { s.querySelector('#again').onclick = () => g.mode === 'solo' ? startSolo(g.level, g.ranked) : startLocal(); s.querySelector('#home').onclick = leave; });
}
function leave() {
  if (G && G.mode === 'online') { if (G.st.over) NET.send({ t: 'leave' }); }
  G = null; sheetKind = null; closeSheet(); $('game').hidden = true; $('page').hidden = false; $('foot').hidden = false; renderView();
}
$('gExit').onclick = () => {
  if (!G) return leave();
  const g = G;
  if (g.st.over) return leave();
  const started = g.st.scores[0] || g.st.scores[1];
  const ranked = (g.mode === 'solo' && g.ranked) || g.mode === 'online';
  if (!started && !ranked) return leave();
  openSheet(`<h3>Leave the game?</h3><p>${g.mode === 'online' ? 'Leaving gives the win to your rival' + (g.stake ? ', with the stake.' : '.') : g.ranked ? 'Leaving a Ranked game counts as a loss.' : 'This game will be lost.'}</p><div class="acts"><button class="btn main" type="button" id="stay">Keep playing</button><button class="btn" type="button" id="go">Leave</button></div>`,
    s => { s.querySelector('#stay').onclick = closeSheet; s.querySelector('#go').onclick = () => { closeSheet();
      if (g.mode === 'online') { NET.send({ t: 'resign' }); g.leaving = true; }
      else if (g.mode === 'solo' && g.ranked) { g.st.over = true; result(true); } else leave(); }; });
};
let resignArmed = false;
$('gResign').onclick = () => { if (!G || G.st.over) return; if (!resignArmed) { resignArmed = true; $('gResign').textContent = 'Click again'; setTimeout(() => { resignArmed = false; $('gResign').textContent = 'Resign'; }, 3000); return; }
  resignArmed = false; $('gResign').textContent = 'Resign';
  if (G.mode === 'online') { NET.send({ t: 'resign' }); return; }
  G.st.over = true; renderPlayers(); result(G.mode === 'solo' ? true : G.st.turn); };
function reaction(res, L) { const R = REACTS[L.react] || REACTS.classic; const lvl = Math.min(3, Math.max(res.lines, res.combo) - 1);
  const el = document.createElement('div'); el.className = 'react go' + (R.fx ? ' ' + R.fx : '');
  const sub = (res.lines > 1 ? res.lines + ' lines' : 'Line clear') + (res.combo > 1 ? ' · combo ' + res.combo + ' ' + fmtMult(E.comboMult(res.combo)) : '');
  el.innerHTML = `<b style="${R.fx === 'neon' ? 'color:#fff' : `background:${R.col};-webkit-background-clip:text;background-clip:text;color:transparent`}">${esc(R.words[lvl])}</b><span>${sub}</span>`;
  $('boardwrap').appendChild(el); setTimeout(() => el.remove(), 1200); }
function floatPts(si, r, c, txt, skin) { const d = DIM[si]; const w = $('boardwrap').getBoundingClientRect(), g = $('grid').getBoundingClientRect(); const pitch = (g.width + 4) / N;
  const el = document.createElement('div'); el.className = 'pts'; el.textContent = txt; el.style.left = (g.left - w.left + (c + d.w / 2) * pitch) + 'px'; el.style.top = (g.top - w.top + (r + d.h / 2) * pitch) + 'px'; el.style.color = skin.h; $('boardwrap').appendChild(el); setTimeout(() => el.remove(), 950); }

// ---------- live game messages ----------
NET.on('hello', m => {
  setMe(m.me); ONLINE.clear(); for (const id of m.friendsOnline) ONLINE.add(id);
  const join = new URLSearchParams(location.search).get('join');
  if (join && !G) { history.replaceState(null, '', '/'); NET.send({ t: 'room_join', code: join }); }
  if (!G) renderView();
});
NET.on('start', m => { if (G && G.mode !== 'online' && !G.st.over && !m.resume) { /* a friend accepted while you play a bot: the live game wins */ } startOnline(m); });
const moveQ = []; let moveBusy = false;
NET.on('move', m => { moveQ.push(m); pumpMoves(); });
async function pumpMoves() {
  if (moveBusy) return; moveBusy = true;
  while (moveQ.length) {
    const m = moveQ.shift(); const g = G; if (!g || g.mode !== 'online') continue;
    const before = g.st.board.slice(); g.st = pickState(m.state); g.deadline = Date.now() + (m.state.deadline - m.state.now);
    if (m.auto && m.mv.p === g.me) toast('Time is up: a random piece was placed for you.');
    if (!await animate(before, m.mv)) continue;
    if (g.st.over) { renderPlayers(); renderTray(); status(stuckLine()); } else startTurn();
  }
  moveBusy = false;
  if (pendingEnd) { const e = pendingEnd; pendingEnd = null; onlineEnd(e); }
}
NET.on('reject', m => { if (!G || G.mode !== 'online') return; if (m.state) { G.st = pickState(m.state); G.deadline = Date.now() + (m.state.deadline - m.state.now); } G.busy = false; renderAll(); status('That move was not accepted. Try again.'); });
let pendingEnd = null;
NET.on('end', m => { if (moveBusy || moveQ.length) { pendingEnd = m; return; } onlineEnd(m); });
function onlineEnd(m) {
  const g = G; if (!g || g.mode !== 'online') { setMe(m.me); return; }
  g.st.over = true; g.st.scores = m.scores; setMe(m.me); renderPlayers(); renderTray();
  if (g.leaving) { leave(); toast(m.elo ? 'You left: ' + m.elo + ' Elo' : 'You left the game.'); return; }
  const res = m.result; const a = m.scores[g.me], b = m.scores[1 - g.me];
  const title = res === 1 ? 'Victory' : res === 0 ? 'Defeat' : 'Draw', cls = res === 1 ? 'win' : res === 0 ? 'lose' : '';
  const why = { resign: res === 1 ? g.opp.name + ' resigned.' : 'You resigned.', timeout: res === 1 ? g.opp.name + ' ran out of time twice.' : 'You ran out of time twice.', left: res === 1 ? g.opp.name + ' left the game.' : 'You were disconnected too long.' }[m.reason]
    || (res === 1 ? 'You out-played ' + g.opp.name + '.' : res === 0 ? g.opp.name + ' wins this one.' : 'Nobody pulled ahead.');
  let extra = '';
  if (g.kind === 'ranked') extra += `<div class="delta ${m.elo >= 0 ? 'up' : 'down'} num">${m.elo >= 0 ? '+' : ''}${m.elo} Elo · now ${P.elo} (${tierOf(P.elo)[1]})</div>`;
  if (m.coins) extra += `<div class="delta ${m.coins > 0 ? 'up' : 'down'} num coinline">${coinSvg(20)}${m.coins > 0 ? '+' : '−'}${Math.abs(m.coins)} Blockcoins</div>`;
  if (res === 1) SND.win(); else if (res === 0) SND.lose();
  openSheet(`<h3 class="${cls}">${title}</h3><p>${esc(why)}</p><div class="big num">${a} – ${b}</div>${extra}<p class="note" id="rmMsg" style="text-align:center"></p>
    <div class="acts"><button class="btn main" type="button" id="again">Rematch</button><button class="btn" type="button" id="home">Back to menu</button></div>`,
    s => { const ag = s.querySelector('#again'); ag.onclick = () => { if (g.stake && P.earned < g.stake) { toast('You need ' + g.stake + ' earned Blockcoins for a rematch with this bet.'); return; } NET.send({ t: 'rematch' }); ag.disabled = true; ag.textContent = 'Waiting for ' + g.opp.name + '…'; };
      s.querySelector('#home').onclick = leave; }, 'result');
}
NET.on('rematch_ask', () => { const el = $('rmMsg'), ag = $('again'); if (el) el.textContent = G && G.opp ? G.opp.name + ' wants a rematch.' : 'Your rival wants a rematch.'; if (ag && !ag.disabled) ag.textContent = 'Accept rematch'; SND.ping(); });
const noRematch = () => { const el = $('rmMsg'), ag = $('again'); if (el) el.textContent = 'Your rival left.'; if (ag) { ag.disabled = true; ag.textContent = 'Rematch'; } };
NET.on('rematch_no', noRematch); NET.on('closed', noRematch);
NET.on('emote', () => {});

// ---------- input: drag with snapping to the nearest valid spot, or click a piece then a cell ----------
let drag = null, lastKey = ''; const floatEl = $('float');
function gm() { const g = $('grid').getBoundingClientRect(); return { g, pitch: (g.width + 4) / N }; }
function buildFloat(si) { const { pitch } = gm(); const sz = pitch - 4, d = DIM[si], L = G.look[G.st.turn]; floatEl.innerHTML = ''; floatEl.style.width = (d.w * pitch - 4) + 'px'; floatEl.style.height = (d.h * pitch - 4) + 'px';
  SHAPES[si].forEach(([r, c]) => { const i = document.createElement('i'); paint(i, L.skin); Object.assign(i.style, { left: c * pitch + 'px', top: r * pitch + 'px', width: sz + 'px', height: sz + 'px', position: 'absolute' }); floatEl.appendChild(i); }); return { w: d.w * pitch - 4, h: d.h * pitch - 4 }; }
function targetFrom(left, top, si) { const { g, pitch } = gm(); const fc = (left - g.left) / pitch, fr = (top - g.top) / pitch; const c0 = Math.round(fc), r0 = Math.round(fr); let best = null, bd = 1e9;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = r0 + dr, c = c0 + dc; if (!E.fits(G.st.board, si, r, c)) continue; const dd = (r - fr) ** 2 + (c - fc) ** 2; if (dd < bd && dd < 1.3) { bd = dd; best = { r, c }; } } return best; }
function previewAt(si, t) { if (!t) { renderBoard(); return; } const res = E.apply(G.st.board, si, t.r, t.c, G.st.turn + 1, G.st.combo[G.st.turn]); renderBoard(null, { cells: shapeCells(si, t.r, t.c), clear: res.cleared }); }
const canAct = () => G && !G.st.over && !G.busy && isHuman(G.st.turn);
$('tray').addEventListener('pointerdown', e => { const s = e.target.closest('.slot'); if (!s || !canAct()) return; const ti = +s.dataset.ti; e.preventDefault(); drag = { ti, si: G.st.tray[ti], x0: e.clientX, y0: e.clientY, moved: false, touch: e.pointerType !== 'mouse', t: null, slot: s }; });
window.addEventListener('pointermove', e => { if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) { drag.moved = true; drag.size = buildFloat(drag.si); floatEl.hidden = false; G.sel = null; document.querySelectorAll('.slot.sel').forEach(x => x.classList.remove('sel')); drag.slot.classList.add('drag'); }
  if (!drag.moved) return; const left = e.clientX - drag.size.w / 2, top = drag.touch ? e.clientY - drag.size.h - 48 : e.clientY - drag.size.h / 2;
  floatEl.style.transform = `translate(${left}px,${top}px)`; const t = targetFrom(left, top, drag.si); const key = t ? t.r + ',' + t.c : ''; drag.t = t; if (key !== lastKey) { lastKey = key; previewAt(drag.si, t); if (t) SND.tone(520, .03, { vol: .025 }); } });
function endDrag(cancel) { if (!drag) return; const d = drag; drag = null; lastKey = ''; floatEl.hidden = true; if (d.slot) d.slot.classList.remove('drag');
  if (d.moved) { if (!cancel && d.t && canAct()) myMove(d.ti, d.t.r, d.t.c); else if (G) renderBoard(); }
  else if (!cancel && G) { G.sel = G.sel === d.ti ? null : d.ti; renderTray(); status(G.sel != null ? 'Now click where to place it.' : turnHint()); } }
window.addEventListener('pointerup', () => endDrag(false)); window.addEventListener('pointercancel', () => endDrag(true));
function centered(k, si) { const d = DIM[si]; const r = Math.floor(k / N) - Math.floor((d.h - 1) / 2), c = k % N - Math.floor((d.w - 1) / 2); if (E.fits(G.st.board, si, r, c)) return { r, c };
  let best = null, bd = 9; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (E.fits(G.st.board, si, r + dr, c + dc) && Math.abs(dr) + Math.abs(dc) < bd) { bd = Math.abs(dr) + Math.abs(dc); best = { r: r + dr, c: c + dc }; } return best; }
$('grid').addEventListener('pointermove', e => { if (drag || !G || G.sel == null || !canAct() || e.pointerType !== 'mouse') return; const el = e.target.closest('.cell'); if (el) previewAt(G.st.tray[G.sel], centered(+el.dataset.i, G.st.tray[G.sel])); });
$('grid').addEventListener('pointerleave', () => { if (G && G.sel != null && !drag) renderBoard(); });
$('grid').addEventListener('click', e => { if (!G || G.sel == null || !canAct()) return; const el = e.target.closest('.cell'); if (!el) return; const si = G.st.tray[G.sel]; const t = centered(+el.dataset.i, si);
  if (t) myMove(G.sel, t.r, t.c); else status("That piece doesn't fit there. Try another spot."); });
window.addEventListener('resize', () => { if (G) fx.size(); });
window.addEventListener('beforeunload', e => { if (G && G.mode === 'online' && !G.st.over) { e.preventDefault(); e.returnValue = ''; } });

// ---------- start ----------
(async function boot() {
  renderSnd(); renderMu();
  try { CONFIG = await (await fetch('/api/config')).json(); } catch (e) {}
  for (let i = 0; i < 5 && !P; i++) { try { await api('/api/me'); } catch (e) { $('view').innerHTML = `<div class="panel"><h2>Can't reach Blockmate</h2><p class="muted">${esc(e.message)} Retrying…</p></div>`; await sleep(1500 * (i + 1)); } }
  if (!P) return;
  const q = new URLSearchParams(location.search);
  if (q.get('store')) { shopCat = 'store'; tab = 'shop'; }
  if (q.get('profile')) tab = 'profile';
  if (!q.get('join')) history.replaceState(null, '', '/');
  setTab(tab);
  NET.connect();
  // Anonymous visit count for the owner dashboard: which site sent the visitor, and whether it came from a game link.
  let ref = ''; try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
  api('/api/hit', { ref, via: q.get('join') ? 'link' : null }).catch(() => {});
  if (q.get('paid')) {
    // Stripe confirms the payment to our server a few seconds after the redirect.
    const p = PRODUCTS[q.get('paid')]; const label = p ? p.label : 'Your purchase'; toast('Thank you! ' + label + ' is being added.');
    const c0 = P.coins, pl0 = P.plus;
    for (let i = 0; i < 10; i++) { await sleep(1500); await api('/api/me').catch(() => {}); if (P.coins !== c0 || P.plus !== pl0) { SND.win(); toast(label + ' added. Enjoy!'); if (!G) renderView(); break; } }
  }
})();
})();
