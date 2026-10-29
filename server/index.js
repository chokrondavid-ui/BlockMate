// Blockmate server: website, API, live games and payments. Node 22+, no dependencies.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const C = require('../shared/catalog');
const G = require('../shared/game');
const { open } = require('./db');
const { Accounts, id } = require('./accounts');
const { Online } = require('./online');
const { Stripe } = require('./stripe');
const ws = require('./ws');

function createServer(opts = {}) {
  const env = Object.assign({}, process.env, opts.env || {});
  const PROD = env.NODE_ENV === 'production';
  const BASE = (env.PUBLIC_URL || 'http://localhost:' + (env.PORT || 3000)).replace(/\/$/, '');
  const log = opts.quiet ? () => {} : (...a) => console.log(new Date().toISOString(), ...a);
  const db = open(opts.dbFile || env.DB_FILE || path.join(__dirname, '..', 'data', 'blockmate.db'));
  const accounts = Accounts(db);
  const online = Online({ accounts, db, log });
  const stripe = Stripe({ secret: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET, baseUrl: BASE, accounts, db, log });
  const DEMO_PAY = !stripe.enabled && !PROD;
  // The site answers on www.domain and on domain alone.
  const ORIGINS = new Set([BASE, BASE.replace('://www.', '://'), BASE.replace('://', '://www.')].concat((env.EXTRA_ORIGINS || '').split(',').filter(Boolean)));
  const ROOT = path.join(__dirname, '..');

  // ---------- helpers ----------
  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]));
  const tokenOf = req => cookies(req).bm || (req.headers.authorization || '').replace(/^Bearer /, '') || null;
  const setCookie = (res, t) => res.setHeader('Set-Cookie', `bm=${t}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${PROD ? '; Secure' : ''}`);
  const ipOf = req => (env.TRUST_PROXY !== '0' && (req.headers['x-forwarded-for'] || '').split(',')[0].trim()) || req.socket.remoteAddress;
  function json(res, code, obj) { const b = JSON.stringify(obj); res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'Content-Length': Buffer.byteLength(b) }); res.end(b); }
  function body(req, limit = 65536) {
    return new Promise((ok, no) => { const ch = []; let n = 0; req.on('data', d => { n += d.length; if (n > limit) { no(Object.assign(new Error('too big'), { code: 413 })); req.destroy(); } else ch.push(d); }); req.on('end', () => ok(Buffer.concat(ch))); req.on('error', no); });
  }
  const buckets = new Map();
  function limited(key, max, perMs) {
    const t = Date.now(); let b = buckets.get(key); if (!b || t - b.at > perMs) { b = { at: t, n: 0 }; buckets.set(key, b); }
    return ++b.n > max;
  }
  setInterval(() => { const t = Date.now(); for (const [k, b] of buckets) if (t - b.at > 3600e3) buckets.delete(k); }, 600e3).unref();

  // ---------- static files ----------
  const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.mp4': 'audio/mp4', '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.webmanifest': 'application/manifest+json' };
  function serveFile(req, res, file, cache) {
    fs.stat(file, (e, s) => {
      if (e || !s.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
      const etag = '"' + s.size.toString(36) + '-' + s.mtimeMs.toString(36) + '"';
      const h = { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', ETag: etag, 'Cache-Control': cache, 'X-Content-Type-Options': 'nosniff' };
      if (req.headers['if-none-match'] === etag) { res.writeHead(304, h); return res.end(); }
      // Range support so browsers can stream the music.
      const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
      if (range && (range[1] || range[2])) {
        const start = range[1] ? +range[1] : s.size - +range[2]; const end = range[1] && range[2] ? Math.min(+range[2], s.size - 1) : s.size - 1;
        if (start >= s.size || start > end) { res.writeHead(416, { 'Content-Range': 'bytes */' + s.size }); return res.end(); }
        res.writeHead(206, Object.assign(h, { 'Content-Range': `bytes ${start}-${end}/${s.size}`, 'Content-Length': end - start + 1, 'Accept-Ranges': 'bytes' }));
        return fs.createReadStream(file, { start, end }).pipe(res);
      }
      res.writeHead(200, Object.assign(h, { 'Content-Length': s.size, 'Accept-Ranges': 'bytes' }));
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  }
  function staticRoute(req, res, p) {
    if (p === '/' || p === '/index.html' || /^\/(play|join|profile|store)(\/|$)/.test(p)) return serveFile(req, res, path.join(ROOT, 'public', 'index.html'), 'no-cache');
    let rel = decodeURIComponent(p).replace(/\\/g, '/');
    if (rel.includes('..') || rel.includes('\0')) { res.writeHead(400); return res.end(); }
    if (rel.startsWith('/shared/')) return serveFile(req, res, path.join(ROOT, rel), 'no-cache');
    if (/^\/legal\/[a-z-]+$/.test(rel)) rel += '.html';
    const cache = rel.startsWith('/music/') ? 'public, max-age=604800' : 'no-cache';
    serveFile(req, res, path.join(ROOT, 'public', rel), cache);
  }

  // ---------- solo games against bots (verified by replay) ----------
  const soloIns = db.prepare('INSERT INTO solo(id,user_id,level,ranked,seed,created) VALUES(?,?,?,?,?,?)');
  const soloGet = db.prepare('SELECT * FROM solo WHERE id=? AND user_id=?');
  const soloDone = db.prepare('UPDATE solo SET done=1 WHERE id=?');
  const soloOpen = db.prepare('SELECT * FROM solo WHERE user_id=? AND ranked=1 AND done=0');
  function soloReward(u, level, ranked, result, best, score) {
    const L = C.LEVELS[level]; const out = { elo: 0, coins: 0, record: false };
    let coins = result === 1 ? L.win : result === 0.5 ? L.draw : L.loss; if (!ranked) coins = Math.round(coins * C.PRACTICE);
    u.coins += coins; out.coins = coins;
    if (ranked) { out.elo = G.eloDelta(u.elo, L.elo, result); u.elo = Math.max(100, u.elo + out.elo); }
    u.st.games++; if (result === 1) u.st.wins++; else if (result === 0) u.st.losses++; else u.st.draws++;
    u.st.bestCombo = Math.max(u.st.bestCombo, best || 0);
    if (score > (u.rec[level] || 0)) { u.rec[level] = score; out.record = true; }
    accounts.save(u, ['coins', 'elo', 'st', 'rec']); return out;
  }
  // A ranked game left unfinished counts as a loss, so quitting a losing game does not protect your Elo.
  function forfeitOpen(u) { for (const g of soloOpen.all(u.id)) { soloDone.run(g.id); soloReward(u, g.level, true, 0, 0, 0); } }

  // ---------- API ----------
  const lbWorld = db.prepare(`SELECT * FROM users WHERE json_extract(st,'$.games')>0 ORDER BY elo DESC LIMIT 100`);
  const lbCountry = db.prepare(`SELECT * FROM users WHERE json_extract(st,'$.games')>0 AND country=? ORDER BY elo DESC LIMIT 100`);
  const lbFriends = db.prepare(`SELECT u.* FROM users u WHERE u.id=? OR u.id IN (SELECT friend_id FROM friends WHERE user_id=?) ORDER BY elo DESC LIMIT 200`);
  const rankOf = db.prepare(`SELECT COUNT(*) n FROM users WHERE json_extract(st,'$.games')>0 AND elo>?`);
  const rankOfC = db.prepare(`SELECT COUNT(*) n FROM users WHERE json_extract(st,'$.games')>0 AND country=? AND elo>?`);
  const frAdd = db.prepare('INSERT OR IGNORE INTO friends(user_id,friend_id,created) VALUES(?,?,?)');
  const frDel = db.prepare('DELETE FROM friends WHERE (user_id=? AND friend_id=?) OR (user_id=? AND friend_id=?)');
  const frList = db.prepare('SELECT u.* FROM friends f JOIN users u ON u.id=f.friend_id WHERE f.user_id=? ORDER BY u.elo DESC');
  const frCount = db.prepare('SELECT COUNT(*) n FROM friends WHERE user_id=?');
  const total = db.prepare('SELECT COUNT(*) n FROM users');

  async function api(req, res, p, url) {
    if (p === '/api/stripe/webhook' && req.method === 'POST') {
      const raw = (await body(req, 1 << 20)).toString('utf8');
      if (!stripe.verify(raw, req.headers['stripe-signature'])) return json(res, 400, { error: 'bad signature' });
      let ev; try { ev = JSON.parse(raw); } catch (e) { return json(res, 400, { error: 'bad json' }); }
      try { for (const uid of stripe.handle(ev)) online.pushMe(uid); } catch (e) { log('webhook failed', e); return json(res, 500, { error: 'failed' }); }
      return json(res, 200, { received: true });
    }
    if (p === '/api/config') return json(res, 200, { payments: stripe.enabled ? 'stripe' : DEMO_PAY ? 'demo' : 'off', turnMs: 25000 });
    if (p === '/api/stats') return json(res, 200, Object.assign(online.stats(), { players: total.get().n }));

    const ip = ipOf(req);
    if (req.method === 'POST') {
      // Basic protection against other sites posting on behalf of a player.
      const origin = req.headers.origin; if (origin && PROD && !ORIGINS.has(origin)) return json(res, 403, { error: 'Bad origin.' });
      if (limited('post:' + ip, 240, 60e3)) return json(res, 429, { error: 'Slow down a little.' });
    }
    let data = {};
    if (req.method === 'POST') { const b = await body(req); try { data = b.length ? JSON.parse(b.toString('utf8')) : {}; } catch (e) { return json(res, 400, { error: 'Bad request.' }); } }

    // Who is this? Visitors without a session get a guest account straight away.
    let token = tokenOf(req); let uid = accounts.userForToken(token); let u = uid && accounts.get(uid);
    if (p === '/api/login' && req.method === 'POST') {
      if (limited('login:' + ip, 10, 10 * 60e3)) return json(res, 429, { error: 'Too many attempts. Wait 10 minutes.' });
      const v = accounts.login(data.name, data.password); if (!v) return json(res, 401, { error: 'Wrong username or password.' });
      if (token) accounts.endSession(token); const t = accounts.newSession(v.id); setCookie(res, t); return json(res, 200, { me: accounts.me(v) });
    }
    if (!u) {
      if (req.method === 'GET' && p !== '/api/me') return json(res, 401, { error: 'No session.' });
      if (limited('guest:' + ip, 30, 3600e3)) return json(res, 429, { error: 'Too many new players from your network. Try again later.' });
      u = accounts.createGuest(); token = accounts.newSession(u.id); setCookie(res, token);
    }
    accounts.touch(u.id);
    const fail = msg => json(res, 400, { error: msg });
    const ok = extra => json(res, 200, Object.assign({ me: accounts.me(accounts.get(u.id)) }, extra || {}));

    switch (p) {
      case '/api/me': return ok();
      case '/api/logout': accounts.endSession(token); res.setHeader('Set-Cookie', 'bm=; Path=/; Max-Age=0'); return json(res, 200, {});
      case '/api/register': {
        if (limited('reg:' + ip, 10, 3600e3)) return json(res, 429, { error: 'Too many accounts from your network. Try later.' });
        if (!u.guest) return fail('You already have an account.');
        const e = accounts.register(u, data); return e ? fail(e) : ok();
      }
      case '/api/profile': { const e = accounts.updateProfile(u, data); return e ? fail(e) : ok(); }
      case '/api/equip': { const e = accounts.equip(u, data.cat, data.key); return e ? fail(e) : ok(); }
      case '/api/buy': { const e = accounts.buy(u, data.cat, data.key); return e ? fail(e) : ok(); }
      case '/api/daily': { const r = accounts.claimDaily(u); return r.error ? fail(r.error) : ok(r); }
      case '/api/reset': accounts.resetProgress(u); return ok();

      case '/api/solo/start': {
        const level = data.level; if (!C.LEVELS[level]) return fail('Unknown level.');
        const ranked = data.ranked ? 1 : 0; if (ranked) forfeitOpen(u);
        const gid = id('s_'); const seed = crypto.randomBytes(4).readUInt32BE(0);
        soloIns.run(gid, u.id, level, ranked, seed, Date.now()); return ok({ id: gid, seed });
      }
      case '/api/solo/finish': {
        const g = soloGet.get(String(data.id || ''), u.id); if (!g) return fail('Unknown game.'); if (g.done) return fail('This game is already finished.');
        const mv = Array.isArray(data.moves) ? data.moves : null;
        if (!mv || mv.length > 200 || !mv.every(m => m && [m.ti, m.r, m.c].every(Number.isInteger))) return fail('Bad moves.');
        const r = G.replaySolo(g.seed, g.level, mv, !!data.resigned);
        if (!r.ok) { log('solo replay rejected', u.id, r.reason); return fail('This game could not be verified.'); }
        if (r.incomplete && !data.resigned) return fail('This game is not finished.');
        soloDone.run(g.id);
        const fresh = accounts.get(u.id); const out = soloReward(fresh, g.level, !!g.ranked, r.result, r.st.best[0], r.st.scores[0]);
        return ok(Object.assign(out, { result: r.result, scores: r.st.scores }));
      }

      case '/api/leaderboard': {
        const scope = url.searchParams.get('scope') || 'world';
        const rows = scope === 'country' ? lbCountry.all(url.searchParams.get('country') || u.country) : scope === 'friends' ? lbFriends.all(u.id, u.id) : lbWorld.all();
        const me = accounts.get(u.id); const played = me.st.games > 0;
        const rank = scope === 'friends' ? null : played ? (scope === 'country' ? rankOfC.get(me.country, me.elo).n : rankOf.get(me.elo).n) + 1 : null;
        return json(res, 200, { rows: rows.map(x => accounts.publicRow(require('./db').row2user(x))), rank });
      }
      case '/api/friends': return json(res, 200, { rows: frList.all(u.id).map(x => Object.assign(accounts.publicRow(require('./db').row2user(x)), { online: online.isOnline(x.id) })) });
      case '/api/friends/add': {
        const f = accounts.byName(data.name); if (!f) return fail('No player with that username.'); if (f.id === u.id) return fail('That\'s you!');
        if (frCount.get(u.id).n >= 200) return fail('Friend list is full.');
        frAdd.run(u.id, f.id, Date.now()); frAdd.run(f.id, u.id, Date.now());
        online.send(f.id, { t: 'friend_added', by: accounts.publicRow(u) });
        return ok({ friend: Object.assign(accounts.publicRow(f), { online: online.isOnline(f.id) }) });
      }
      case '/api/friends/remove': frDel.run(u.id, String(data.id || ''), String(data.id || ''), u.id); return ok();

      case '/api/checkout': {
        const pid = data.product; if (!C.PRODUCTS[pid]) return fail('Unknown product.');
        if (data.waiver !== true) return fail('Please confirm you want your purchase delivered right away.');
        if (DEMO_PAY) { const r = stripe.demoGrant(u, pid); return r.error ? fail(r.error) : ok(r); }
        try { const r = await stripe.checkout(u, pid); return r.error ? fail(r.error) : json(res, 200, r); }
        catch (e) { log('checkout failed', e.message); return json(res, 502, { error: 'Payment page unavailable. Try again in a minute.' }); }
      }
      case '/api/portal': {
        try { const r = await stripe.portal(u); return r.error ? fail(r.error) : json(res, 200, r); }
        catch (e) { log('portal failed', e.message); return json(res, 502, { error: 'Subscription page unavailable. Try again.' }); }
      }
    }
    return json(res, 404, { error: 'Not found.' });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x'); const p = url.pathname;
    res.setHeader('X-Frame-Options', 'SAMEORIGIN'); res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (PROD && env.FORCE_HTTPS !== '0' && req.headers['x-forwarded-proto'] === 'http') { res.writeHead(301, { Location: BASE + req.url }); return res.end(); }
    try {
      if (p === '/healthz') return json(res, 200, { ok: true });
      if (p.startsWith('/api/')) return await api(req, res, p, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
      staticRoute(req, res, p);
    } catch (e) {
      if (e.code === 413) return json(res, 413, { error: 'Too big.' });
      log('error', p, e); if (!res.headersSent) json(res, 500, { error: 'Something went wrong on our side.' });
    }
  });
  ws.attach(server, '/ws', req => accounts.userForToken(tokenOf(req) || new URL(req.url, 'http://x').searchParams.get('t')), (sock, uid) => online.connect(sock, uid));

  // Housekeeping: remove guests who never played and left a month ago.
  const sweep = () => { try { const cutoff = Date.now() - 30 * 864e5; db.prepare(`DELETE FROM users WHERE guest=1 AND seen<? AND json_extract(st,'$.games')=0 AND paid=0 AND plus_until=0`).run(cutoff); } catch (e) { log('sweep', e.message); } };
  setInterval(sweep, 6 * 3600e3).unref();

  return { server, db, accounts, online, stripe, close: () => new Promise(r => { server.close(() => { db.close(); r(); }); server.closeAllConnections && server.closeAllConnections(); }) };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const app = createServer();
  app.server.listen(port, () => console.log(`Blockmate on :${port} · payments: ${app.stripe.enabled ? 'Stripe' : process.env.NODE_ENV === 'production' ? 'OFF' : 'demo'}`));
  const stop = () => { console.log('shutting down'); app.close().then(() => process.exit(0)); setTimeout(() => process.exit(0), 5000).unref(); };
  process.on('SIGTERM', stop); process.on('SIGINT', stop);
}
module.exports = { createServer };
