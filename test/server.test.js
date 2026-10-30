// End-to-end tests: real HTTP server on a random port, in-memory database.
// Run with: npm test
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { createServer } = require('../server/index.js');
const G = require('../shared/game');
const C = require('../shared/catalog');

let app, base;
test.before(async () => {
  app = createServer({ dbFile: ':memory:', quiet: true, env: { NODE_ENV: 'test', STRIPE_SECRET_KEY: '', STRIPE_WEBHOOK_SECRET: 'whsec_test', ADMIN_KEY: 'adm-secret' } });
  await new Promise(r => app.server.listen(0, r)); base = 'http://localhost:' + app.server.address().port;
});
test.after(() => app.close());

function client() {
  let cookie = '';
  const call = async (path, data) => {
    const r = await fetch(base + path, { method: data === undefined ? 'GET' : 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, cookie ? { cookie } : {}), body: data === undefined ? undefined : JSON.stringify(data) });
    const sc = r.headers.get('set-cookie'); if (sc) cookie = sc.split(';')[0];
    const j = await r.json(); j._status = r.status; return j;
  };
  return { call, token: () => cookie.replace('bm=', '') };
}
function socket(token) {
  const ws = new WebSocket(base.replace('http', 'ws') + '/ws?t=' + token); const inbox = []; const waiters = [];
  ws.onmessage = e => { const m = JSON.parse(e.data); const i = waiters.findIndex(w => w.t === m.t); if (i >= 0) waiters.splice(i, 1)[0].res(m); else inbox.push(m); };
  const next = (t, ms = 3000) => { const i = inbox.findIndex(m => m.t === t); if (i >= 0) return Promise.resolve(inbox.splice(i, 1)[0]); return new Promise((res, rej) => { waiters.push({ t, res }); setTimeout(() => rej(new Error('timeout waiting for ' + t)), ms); }); };
  return { ws, next, send: o => ws.send(JSON.stringify(o)), open: new Promise(r => ws.onopen = r) };
}

test('guest is created and can claim the daily reward once', async () => {
  const a = client(); const me = (await a.call('/api/me')).me;
  assert.match(me.name, /^Player\d+$/); assert.equal(me.coins, 100); assert.equal(me.guest, true); assert.equal(me.daily.ready, true);
  const d = await a.call('/api/daily', {}); assert.equal(d.amount, C.DAILY[0]); assert.equal(d.me.coins, 100 + C.DAILY[0]);
  const again = await a.call('/api/daily', {}); assert.equal(again._status, 400);
});

test('register, log out, log in again', async () => {
  const a = client(); await a.call('/api/me');
  const name = 'Tester' + crypto.randomInt(1e5);
  assert.equal((await a.call('/api/register', { name, password: 'short' }))._status, 400);
  const r = await a.call('/api/register', { name, password: 'correct horse', email: 'a@b.fr', country: 'BE' });
  assert.equal(r.me.name, name); assert.equal(r.me.guest, false); assert.equal(r.me.country, 'BE');
  const b = client(); await b.call('/api/me');
  assert.equal((await b.call('/api/register', { name: name.toLowerCase(), password: 'another one' }))._status, 400, 'name taken, case-insensitive');
  assert.equal((await b.call('/api/login', { name, password: 'wrong pass' }))._status, 401);
  const l = await b.call('/api/login', { name, password: 'correct horse' }); assert.equal(l.me.id, r.me.id);
});

test('shop: buy with coins, equip, refuse Plus items', async () => {
  const a = client(); await a.call('/api/me');
  assert.equal((await a.call('/api/buy', { cat: 'skin', key: 'lemon' }))._status, 400, '200 > 100 coins');
  await a.call('/api/daily', {});
  const ok = await a.call('/api/buy', { cat: 'skin', key: 'candy' }); assert.equal(ok.me.coins, 100 + C.DAILY[0] - C.SKINS.candy.price); assert.equal(ok.me.eq.skin, 'candy');
  assert.equal((await a.call('/api/equip', { cat: 'skin', key: 'gold' }))._status, 400);
  const back = await a.call('/api/equip', { cat: 'skin', key: 'mint' }); assert.equal(back.me.eq.skin, 'mint');
});

// Plays a whole solo game in the browser's place, using the same engine and bot stream.
function playSolo(seed, level, pick) {
  const st = G.newState(seed), br = G.rng(G.botSeed(seed)), hm = [];
  while (!st.over) {
    if (st.turn === 0) { const ms = G.moves(st.board, st.tray); if (!ms.length) break; const m = pick(ms, st); hm.push({ ti: m.ti, r: m.r, c: m.c }); G.play(st, m.ti, m.r, m.c); }
    else { const m = G.botMove(st, level, br); G.play(st, m.ti, m.r, m.c); }
  }
  return { st, hm };
}
test('solo ranked game is verified by replay, rewards applied once', async () => {
  const a = client(); const me0 = (await a.call('/api/me')).me;
  const s = await a.call('/api/solo/start', { level: 'easy', ranked: true });
  const { st, hm } = playSolo(s.seed, 'easy', (ms, s0) => ms.reduce((x, y) => G.apply(s0.board, y.si, y.r, y.c, 1, s0.combo[0]).gain > G.apply(s0.board, x.si, x.r, x.c, 1, s0.combo[0]).gain ? y : x));
  const f = await a.call('/api/solo/finish', { id: s.id, moves: hm });
  assert.equal(f._status, 200, JSON.stringify(f));
  assert.deepEqual(f.scores, st.scores);
  const L = C.LEVELS.easy; const expect = f.result === 1 ? L.win : f.result === .5 ? L.draw : L.loss;
  assert.equal(f.coins, expect); assert.equal(f.me.coins, me0.coins + expect);
  assert.equal(f.me.elo, me0.elo + f.elo); assert.equal(f.me.st.games, 1);
  assert.equal((await a.call('/api/solo/finish', { id: s.id, moves: hm }))._status, 400, 'cannot claim twice');
});

test('solo: tampered moves are rejected', async () => {
  const a = client(); await a.call('/api/me');
  const s = await a.call('/api/solo/start', { level: 'medium', ranked: true });
  const { hm } = playSolo(s.seed, 'medium', ms => ms[0]);
  const bad = hm.slice(); bad[0] = { ti: bad[0].ti, r: 7, c: 7 }; bad[1] = { ti: 0, r: 0, c: 0 };
  const r = await a.call('/api/solo/finish', { id: s.id, moves: bad.concat([{ ti: 0, r: 0, c: 0 }]) });
  assert.equal(r._status, 400);
});

test('solo: an abandoned ranked game counts as a loss', async () => {
  const a = client(); const me0 = (await a.call('/api/me')).me;
  await a.call('/api/solo/start', { level: 'hard', ranked: true });
  const s2 = await a.call('/api/solo/start', { level: 'hard', ranked: true });
  assert.ok(s2.me.elo < me0.elo, 'Elo dropped'); assert.equal(s2.me.st.losses, 1);
});

test('demo store: coin pack, starter once, Plus', async () => {
  const a = client(); const me0 = (await a.call('/api/me')).me;
  assert.equal((await a.call('/api/checkout', { product: 'coins500' }))._status, 400, 'waiver required');
  const p = await a.call('/api/checkout', { product: 'coins500', waiver: true }); assert.equal(p.me.coins, me0.coins + 500); assert.equal(p.me.paid, 500); assert.equal(p.me.earned, me0.coins);
  const s = await a.call('/api/checkout', { product: 'starter', waiver: true }); assert.ok(s.me.owned.skin.includes('stripes')); assert.equal(s.me.starter, true);
  assert.equal((await a.call('/api/checkout', { product: 'starter', waiver: true }))._status, 400);
  const pl = await a.call('/api/checkout', { product: 'plusMonth', waiver: true }); assert.equal(pl.me.plus, true);
  assert.equal((await a.call('/api/equip', { cat: 'skin', key: 'gold' })).me.eq.skin, 'gold');
  // Paid coins are spent first.
  const b = await a.call('/api/buy', { cat: 'skin', key: 'lemon' }); assert.equal(b.me.paid, 1300 - 200);
});

test('stripe webhook: signature checked, payment credited once', async () => {
  const a = client(); const me = (await a.call('/api/me')).me;
  const ev = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_test_1', mode: 'payment', payment_status: 'paid', client_reference_id: me.id, customer: 'cus_1', amount_total: 999, metadata: { uid: me.id, product: 'coins2800' } } } };
  const raw = JSON.stringify(ev); const t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', 'whsec_test').update(t + '.' + raw).digest('hex');
  const post = s => fetch(base + '/api/stripe/webhook', { method: 'POST', headers: { 'stripe-signature': s }, body: raw });
  assert.equal((await post(`t=${t},v1=${'0'.repeat(64)}`)).status, 400);
  assert.equal((await post(`t=${t},v1=${sig}`)).status, 200);
  assert.equal((await post(`t=${t},v1=${sig}`)).status, 200, 'retries are fine');
  const after = (await a.call('/api/me')).me; assert.equal(after.coins, me.coins + 2800); assert.equal(after.paid, 2800);
});

test('friends, leaderboard', async () => {
  const a = client(), b = client(); await a.call('/api/me'); const mb = (await b.call('/api/me')).me;
  const add = await a.call('/api/friends/add', { name: mb.name }); assert.equal(add.friend.id, mb.id);
  const fb = await b.call('/api/friends'); assert.equal(fb.rows.length, 1, 'friendship is mutual');
  const lb = await a.call('/api/leaderboard?scope=world'); assert.ok(Array.isArray(lb.rows));
  const lf = await a.call('/api/leaderboard?scope=friends'); assert.equal(lf.rows.length, 2);
});

test('online: two players matched, server-authoritative game to the end, Elo and coins', async () => {
  const a = client(), b = client(); const ma = (await a.call('/api/me')).me, mb = (await b.call('/api/me')).me;
  const A = socket(a.token()), B = socket(b.token()); await A.open; await B.open; await A.next('hello'); await B.next('hello');
  A.send({ t: 'queue' }); B.send({ t: 'queue' });
  const [sa, sb] = await Promise.all([A.next('start'), B.next('start')]);
  assert.notEqual(sa.you, sb.you); assert.equal(sa.opp.name, mb.name);
  const byIdx = sa.you === 0 ? [A, B] : [B, A];
  let state = sa.state; let n = 0;
  // An illegal move is refused.
  byIdx[state.turn].send({ t: 'move', ti: 0, r: 99, c: 0 }); await byIdx[state.turn].next('reject');
  byIdx[1 - state.turn].send({ t: 'move', ti: 0, r: 0, c: 0 }); await byIdx[1 - state.turn].next('reject');
  while (!state.over && n++ < 300) {
    const ms = G.moves(state.board, state.tray); const m = ms[0];
    byIdx[state.turn].send({ t: 'move', ti: m.ti, r: m.r, c: m.c });
    const [x] = await Promise.all([A.next('move'), B.next('move')]); state = x.state;
  }
  assert.ok(state.over);
  const [ea, eb] = await Promise.all([A.next('end'), B.next('end')]);
  assert.equal(ea.result + eb.result, 1);
  assert.equal(ea.me.elo, ma.elo + ea.elo); assert.equal(eb.me.elo, mb.elo + eb.elo);
  const ca = ea.result === 1 ? C.ONLINE.win : ea.result === .5 ? C.ONLINE.draw : C.ONLINE.loss; assert.equal(ea.coins, ca);
  // Rematch
  A.send({ t: 'rematch' }); await B.next('rematch_ask'); B.send({ t: 'rematch' });
  const [r1] = await Promise.all([A.next('start'), B.next('start')]); assert.equal(r1.state.kind, 'ranked');
  // Resign gives the win to the other player.
  A.send({ t: 'resign' }); const [ra, rb] = await Promise.all([A.next('end'), B.next('end')]); assert.equal(ra.result, 0); assert.equal(rb.result, 1); assert.equal(ra.reason, 'resign');
  A.ws.close(); B.ws.close();
});

test('online: friend challenge with a bet, winner takes the stake', async () => {
  const a = client(), b = client(); await a.call('/api/me'); await b.call('/api/me');
  await a.call('/api/daily', {}); await b.call('/api/daily', {});
  const mb = (await b.call('/api/me')).me; await a.call('/api/friends/add', { name: mb.name });
  const A = socket(a.token()), B = socket(b.token()); await A.open; await B.open; const ha = await A.next('hello'); await B.next('hello');
  // Bought coins cannot be bet: A has 150 earned coins, try 100 (ok).
  A.send({ t: 'invite', to: mb.id, stake: 100 }); const inv = await B.next('invited'); assert.equal(inv.stake, 100);
  B.send({ t: 'accept', inv: inv.inv });
  const [sa] = await Promise.all([A.next('start'), B.next('start')]); assert.equal(sa.state.stake, 100); assert.equal(sa.state.kind, 'friend');
  B.send({ t: 'resign' }); const [ea, eb] = await Promise.all([A.next('end'), B.next('end')]);
  assert.equal(ea.coins, 100); assert.equal(eb.coins, -100); assert.equal(ea.elo, 0, 'friend games keep Elo');
  assert.equal(ea.me.coins, ha.me.coins + 100);
  // Game link
  A.send({ t: 'leave' }); B.send({ t: 'leave' });
  A.send({ t: 'room_create', stake: 0 }); const room = await A.next('room');
  B.send({ t: 'room_join', code: room.code }); const [s2] = await Promise.all([A.next('start'), B.next('start')]); assert.equal(s2.state.kind, 'friend');
  A.ws.close(); B.ws.close();
});

test('static files and legal pages', async () => {
  for (const p of ['/', '/app.js', '/shared/game.js', '/legal/cgv', '/music/music-menu-1.mp4', '/favicon.svg']) assert.equal((await fetch(base + p)).status, 200, p);
  assert.equal((await fetch(base + '/../server/db.js')).status, 404);
  const r = await fetch(base + '/music/music-game-1.mp4', { headers: { range: 'bytes=0-99' } }); assert.equal(r.status, 206); assert.equal((await r.arrayBuffer()).byteLength, 100);
});

test('owner dashboard: key required, counts visits, purchases and link shares', async () => {
  assert.equal((await fetch(base + '/api/admin/stats', { headers: { 'x-admin-key': 'nope' } })).status, 401);
  const a = client(); await a.call('/api/me'); await a.call('/api/hit', { ref: 'www.google.com' }); await a.call('/api/hit', { ref: '' });
  await a.call('/api/track', { e: 'share_copy' });
  const r = await fetch(base + '/api/admin/stats', { headers: { 'x-admin-key': 'adm-secret' } }); assert.equal(r.status, 200);
  const s = await r.json();
  assert.ok(s.periods.today.unique >= 1); assert.ok(s.periods.today.views >= 2); assert.ok(s.periods.today.shares >= 1);
  assert.ok(s.periods.today.linkJoins >= 1, 'link game from the earlier test'); assert.ok(s.periods.today.games >= 1);
  assert.ok(s.revenueAll >= 999, 'webhook purchase counted, demo ones not'); assert.ok(s.subs.active >= 1);
  assert.equal((await fetch(base + '/admin')).status, 200);
});

test('signup prize, promo code once, coin bundle, daily deal price', async () => {
  const a = client(); await a.call('/api/me');
  const r = await a.call('/api/register', { name: 'Prize' + crypto.randomInt(1e5), password: 'longenough1' });
  assert.ok(r.prize && (r.prize.coins > 0 || (r.prize.cat && r.me.owned[r.prize.cat].includes(r.prize.key))), JSON.stringify(r.prize));
  assert.equal((await a.call('/api/register', { name: 'Connard93', password: 'longenough1' }))._status, 400);
  const c0 = r.me.coins; const p = await a.call('/api/promo', { code: 'parnassa' }); assert.equal(p.me.coins, c0 + 1000);
  assert.equal((await a.call('/api/promo', { code: 'PARNASSA' }))._status, 400, 'once per account');
  assert.equal((await a.call('/api/promo', { code: 'NOPE' }))._status, 400);
  const b = await a.call('/api/bundle', { id: 'neonNight' }); assert.equal(b._status, 200); assert.ok(b.me.owned.skin.includes('neoncyan'));
  assert.equal((await a.call('/api/buy', { cat: 'skin', key: 'phoenix' }))._status, 400, 'pack-only item');
  const day = b.me.shopDay; const d = C.dailyShop(day); const [cat, key] = d.deal;
  if (!b.me.owned[cat].includes(key)) { const before = b.me.coins; const bought = await a.call('/api/buy', { cat, key }); if (bought._status === 200) assert.equal(bought.me.coins, before - C.priceOf(cat, key, day)); }
});

test('online: clocks, peek relay, filtered chat, first friend game bonus, referral', async () => {
  const a = client(), b = client(); await a.call('/api/me'); const mb = (await b.call('/api/me')).me;
  const A = socket(a.token()), B = socket(b.token()); await A.open; await B.open; await A.next('hello'); await B.next('hello');
  A.send({ t: 'room_create', stake: 0 }); const room = await A.next('room');
  B.send({ t: 'room_join', code: room.code }); const [sa, sb] = await Promise.all([A.next('start'), B.next('start')]);
  assert.deepEqual(sa.state.clocks.map(x => x > 290000 && x <= 300000), [true, true]); assert.equal(sa.state.next.length, 1);
  const byIdx = sa.you === 0 ? [A, B] : [B, A];
  let state = sa.state;
  byIdx[state.turn].send({ t: 'peek', ti: 1, fr: 2.4, fc: 3.1 }); const pk = await byIdx[1 - state.turn].next('peek'); assert.equal(pk.ti, 1);
  A.send({ t: 'chat', text: 't es nul mais connard' }); const ch = await B.next('chat'); assert.ok(ch.text.startsWith('t es nul mais') && !ch.text.includes('connard') && ch.masked); await A.next('chat');
  await new Promise(r => setTimeout(r, 750));
  A.send({ t: 'chat', text: 'je vais te tuer' }); await A.next('chat_blocked');
  await new Promise(r => setTimeout(r, 750));
  for (let n = 0; n < 8 && !state.over; n++) { const m = G.moves(state.board, state.tray)[0]; byIdx[state.turn].send({ t: 'move', ti: m.ti, r: m.r, c: m.c }); const [x] = await Promise.all([A.next('move'), B.next('move')]); state = x.state; }
  assert.ok(state.clocks[0] <= C.CLOCK_MS);
  A.send({ t: 'resign' }); const [ea, eb] = await Promise.all([A.next('end'), B.next('end')]);
  assert.equal(ea.names.length, 2);
  // B was a brand-new guest brought by A's link: both get the referral bonus on top of the first-game bonus.
  assert.equal(eb.bonus, C.REFERRAL.firstFriendGame + C.REFERRAL.newcomer); assert.equal(ea.bonus, C.REFERRAL.firstFriendGame + C.REFERRAL.sharer);
  A.ws.close(); B.ws.close();
});
