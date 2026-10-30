// Live games over WebSocket. The server holds the real game state; browsers only send moves.
const crypto = require('node:crypto');
const G = require('../shared/game');
const C = require('../shared/catalog');
const { clean } = require('./chatfilter');

const GONE_MS = 60000, INVITE_MS = 60000, ROOM_MS = 30 * 60000;

function Online({ accounts, db, log, track }) {
  track = track || (() => {});
  const socks = new Map();       // uid -> Set of sockets
  const inMatch = new Map();     // uid -> match
  const queue = [];              // {uid, elo, since}
  const invites = new Map();     // invite id -> {from, to, stake, at}
  const rooms = new Map();       // code -> {uid, stake, at}
  const matchesIns = db.prepare('INSERT INTO matches(id,a,b,kind,stake,seed,created) VALUES(?,?,?,?,?,?,?)');
  const matchesEnd = db.prepare('UPDATE matches SET sa=?,sb=?,result=?,ended=? WHERE id=?');
  const friendIds = db.prepare('SELECT friend_id FROM friends WHERE user_id=?');
  const pairGet = db.prepare('SELECT 1 FROM pairs WHERE a=? AND b=?');
  const pairAdd = db.prepare('INSERT OR IGNORE INTO pairs(a,b,created) VALUES(?,?,?)');
  const referralsToday = db.prepare("SELECT COUNT(*) n FROM events WHERE type='referral' AND user_id=? AND created>?");

  const isOnline = uid => socks.has(uid);
  function send(uid, msg) { const s = socks.get(uid); if (s) for (const ws of s) ws.send(msg); }
  const card = u => ({ id: u.id, name: u.name, elo: u.elo, country: u.country, plus: accounts.isPlus(u), eq: u.eq, custom: u.custom });
  function pushMe(uid) { const u = accounts.get(uid); if (u) send(uid, { t: 'me', me: accounts.me(u) }); }
  function friendsOf(uid) { return friendIds.all(uid).map(r => r.friend_id); }
  function presence(uid, on) { for (const f of friendsOf(uid)) send(f, { t: 'presence', id: uid, online: on, playing: inMatch.has(uid) }); }
  const err = (uid, msg) => send(uid, { t: 'error', msg });
  const leaveQueue = uid => { const i = queue.findIndex(q => q.uid === uid); if (i >= 0) queue.splice(i, 1); };

  function view(m) {
    const st = m.st;
    return { id: m.id, kind: m.kind, stake: m.stake, board: st.board, tray: st.tray, next: st.next, scores: st.scores, combo: st.combo, best: st.best, turn: st.turn, over: st.over, stuck: st.stuck, clocks: clocks(m), running: !m.ended && !st.over, now: Date.now(), moves: st.log.length };
  }
  // Chess clocks: each player has 10 minutes for the whole game; only the player to move is counting down.
  function clocks(m) { const c = m.clock.slice(); if (!m.ended && !m.st.over) c[m.st.turn] = Math.max(0, c[m.st.turn] - (Date.now() - m.turnAt)); return c;
  }

  function start(uidA, uidB, kind, stake) {
    const a = accounts.get(uidA), b = accounts.get(uidB);
    if (!a || !b || inMatch.has(a.id) || inMatch.has(b.id)) return false;
    if (stake) {
      if (accounts.earned(a) < stake || accounts.earned(b) < stake) { for (const u of [a, b]) err(u.id, 'Both players need ' + stake + ' earned Blockcoins for this bet.'); return false; }
      for (const u of [a, b]) { u.coins -= stake; accounts.save(u, ['coins']); }
    }
    leaveQueue(a.id); leaveQueue(b.id);
    const players = Math.random() < 0.5 ? [a.id, b.id] : [b.id, a.id];
    const seed = crypto.randomBytes(4).readUInt32BE(0);
    const m = { id: 'm_' + crypto.randomBytes(8).toString('base64url'), kind, stake, players, cards: players.map(id => card(id === a.id ? a : b)), st: G.newState(seed), seed, clock: [C.CLOCK_MS, C.CLOCK_MS], turnAt: Date.now(), gone: [0, 0], rematch: [false, false], ended: false, ref: null, lastChat: [0, 0], chatN: [0, 0], lastPeek: [0, 0] };
    matchesIns.run(m.id, players[0], players[1], kind, stake, seed, Date.now());
    for (const id of players) inMatch.set(id, m);
    if (!G.moves(m.st.board, m.st.tray).length) { m.st.over = true; m.st.stuck = 0; m.st.scores[1] += G.BLOCK_BONUS; }
    players.forEach((id, i) => { send(id, { t: 'start', you: i, opp: m.cards[1 - i], meCard: m.cards[i], state: view(m) }); presence(id, true); });
    if (m.st.over) finish(m, null);
    return true;
  }

  function move(m, p, ti, r, c) {
    if (m.ended || m.st.over || m.st.turn !== p) return false;
    const now = Date.now(); const left = m.clock[p] - (now - m.turnAt);
    if (left <= 0) { m.clock[p] = 0; finish(m, 'time', p); return true; }
    const mv = G.play(m.st, ti, r, c); if (!mv) return false;
    m.clock[p] = left; m.turnAt = now;
    for (const id of m.players) send(id, { t: 'move', mv, state: view(m) });
    if (m.st.over) finish(m, null);
    return true;
  }

  // reason: null (board blocked), 'resign', 'time', 'left'. loser: index of the player who gave up.
  function finish(m, reason, loser) {
    if (m.ended) return; m.ended = true; m.st.over = true;
    const st = m.st; const res = [0, 1].map(p => reason ? (p === loser ? 0 : 1) : G.resultFor(st, p));
    const us = m.players.map(id => accounts.get(id));
    const out = [{}, {}];
    if (m.kind === 'ranked') {
      const d = [G.eloDelta(us[0].elo, us[1].elo, res[0]), G.eloDelta(us[1].elo, us[0].elo, res[1])];
      // Plus boost: double Elo on a win for a few days after subscribing. Losses are unchanged.
      us.forEach((u, i) => { if (d[i] > 0 && accounts.boosted(u)) { d[i] *= 2; out[i].boost = true; } });
      us.forEach((u, i) => { u.elo = Math.max(100, u.elo + d[i]); out[i].elo = d[i]; const c = res[i] === 1 ? C.ONLINE.win : res[i] === 0.5 ? C.ONLINE.draw : C.ONLINE.loss; u.coins += c; out[i].coins = c; });
    } else us.forEach((u, i) => { out[i].elo = 0; out[i].coins = 0; });
    if (m.stake) us.forEach((u, i) => { const back = res[i] === 1 ? 2 * m.stake : res[i] === 0.5 ? m.stake : 0; u.coins += back; out[i].coins += back - m.stake; });
    // Word of mouth: first game ever between two players, and newcomers brought by a game link.
    const played = st.log.length >= 6 && reason !== 'left';
    if (m.kind === 'friend' && played) {
      const [x, y] = m.players.slice().sort();
      if (!pairGet.get(x, y)) { pairAdd.run(x, y, Date.now()); us.forEach((u, i) => { u.coins += C.REFERRAL.firstFriendGame; out[i].bonus = (out[i].bonus || 0) + C.REFERRAL.firstFriendGame; out[i].bonusWhy = 'first'; }); }
    }
    if (m.ref && played) {
      const si = m.players.indexOf(m.ref.sharer), ni = m.players.indexOf(m.ref.newcomer);
      if (si >= 0 && ni >= 0 && referralsToday.get(m.ref.sharer, Date.now() - 864e5).n < C.REFERRAL.perDay) {
        us[si].coins += C.REFERRAL.sharer; out[si].bonus = (out[si].bonus || 0) + C.REFERRAL.sharer; out[si].bonusWhy = 'referral';
        us[ni].coins += C.REFERRAL.newcomer; out[ni].bonus = (out[ni].bonus || 0) + C.REFERRAL.newcomer; out[ni].bonusWhy = 'welcome';
        track('referral', m.ref.sharer, { newcomer: m.ref.newcomer });
      }
      m.ref = null;
    }
    us.forEach((u, i) => {
      u.st.games++; if (res[i] === 1) u.st.wins++; else if (res[i] === 0) u.st.losses++; else u.st.draws++;
      u.st.bestCombo = Math.max(u.st.bestCombo, st.best[i]);
      accounts.save(u, ['elo', 'coins', 'st']);
    });
    matchesEnd.run(st.scores[0], st.scores[1], res[0], Date.now(), m.id);
    for (const id of m.players) track('game_end', id, { mode: 'online', kind: m.kind });
    m.players.forEach((id, i) => send(id, { t: 'end', reason, result: res[i], scores: st.scores, names: m.cards.map(c => c.name), elo: out[i].elo, coins: out[i].coins, boost: !!out[i].boost, bonus: out[i].bonus || 0, bonusWhy: out[i].bonusWhy || null, me: accounts.me(accounts.get(id)) }));
    // The match stays attached for a minute so the players can ask for a rematch.
    m.closeAt = Date.now() + 60000;
  }

  function release(m) { for (const id of m.players) if (inMatch.get(id) === m) { inMatch.delete(id); presence(id, isOnline(id)); } }

  function tick() {
    const t = Date.now();
    for (const m of new Set(inMatch.values())) {
      if (m.ended) { if (t > m.closeAt) { for (const id of m.players) send(id, { t: 'closed', id: m.id }); release(m); } continue; }
      m.players.forEach((id, i) => { if (!isOnline(id)) { if (!m.gone[i]) m.gone[i] = t; } else m.gone[i] = 0; });
      const g = m.gone.findIndex(x => x && t - x > GONE_MS); if (g >= 0) { finish(m, 'left', g); continue; }
      const p = m.st.turn; if (m.clock[p] - (t - m.turnAt) <= 0) { m.clock[p] = 0; finish(m, 'time', p); }
    }
    // Matchmaking: the allowed Elo gap widens the longer people wait.
    queue.sort((x, y) => x.since - y.since);
    for (let i = 0; i < queue.length; i++) for (let j = i + 1; j < queue.length; j++) {
      const A = queue[i], B = queue[j]; const wait = (t - Math.min(A.since, B.since)) / 1000;
      if (Math.abs(A.elo - B.elo) <= 100 + 40 * wait) { if (start(A.uid, B.uid, 'ranked', 0)) { i = -1; break; } }
    }
    for (const [k, v] of invites) if (t - v.at > INVITE_MS) { invites.delete(k); send(v.from, { t: 'invite_gone', inv: k, why: 'expired' }); send(v.to, { t: 'invite_gone', inv: k }); }
    for (const [k, v] of rooms) if (t - v.at > ROOM_MS) rooms.delete(k);
  }
  const timer = setInterval(tick, 500); timer.unref();
  const pinger = setInterval(() => { for (const set of socks.values()) for (const ws of set) { if (!ws.alive) { ws.close(1001); continue; } ws.alive = false; ws.ping(); } }, 25000); pinger.unref();

  function onMessage(uid, msg) {
    if (!msg || typeof msg.t !== 'string') return;
    const m = inMatch.get(uid); const p = m ? m.players.indexOf(uid) : -1;
    switch (msg.t) {
      case 'queue': {
        if (m && !m.ended) return err(uid, 'You are already in a game.');
        if (m) release(m);
        const u = accounts.get(uid); leaveQueue(uid); queue.push({ uid, elo: u.elo, since: Date.now() }); send(uid, { t: 'queued', players: queue.length }); return;
      }
      case 'cancel': leaveQueue(uid); send(uid, { t: 'unqueued' }); return;
      case 'move': if (!m || !move(m, p, msg.ti, msg.r, msg.c)) send(uid, { t: 'reject', state: m ? view(m) : null }); return;
      case 'resign': if (m && !m.ended) finish(m, 'resign', p); return;
      case 'leave': if (m && m.ended) { const o = m.players[1 - p]; send(o, { t: 'rematch_no' }); inMatch.delete(uid); presence(uid, true); } return;
      case 'rematch': {
        if (!m || !m.ended) return; m.rematch[p] = true; const o = m.players[1 - p];
        if (!inMatch.has(o) || inMatch.get(o) !== m) return send(uid, { t: 'rematch_no' });
        if (m.rematch[1 - p]) { release(m); start(m.players[1], m.players[0], m.kind === 'ranked' ? 'ranked' : 'friend', m.stake); }
        else send(o, { t: 'rematch_ask' });
        return;
      }
      case 'invite': {
        const to = String(msg.to || ''); const stake = C.STAKES.includes(msg.stake) ? msg.stake : 0;
        if (to === uid || !friendsOf(uid).includes(to)) return err(uid, 'You can only challenge your friends.');
        if (!isOnline(to)) return err(uid, 'Your friend is offline. Send them a game link instead.');
        if (inMatch.has(to) && !inMatch.get(to).ended) return err(uid, 'Your friend is in a game right now.');
        const me = accounts.get(uid); if (stake && accounts.earned(me) < stake) return err(uid, 'You need ' + stake + ' earned Blockcoins for this bet.');
        const k = crypto.randomBytes(6).toString('base64url'); invites.set(k, { from: uid, to, stake, at: Date.now() }); track('invite_sent', uid, { stake });
        send(to, { t: 'invited', inv: k, from: card(me), stake }); send(uid, { t: 'invite_sent', inv: k, to }); return;
      }
      case 'accept': case 'decline': {
        const v = invites.get(String(msg.inv || '')); if (!v || v.to !== uid) return err(uid, 'This challenge has expired.');
        invites.delete(msg.inv);
        if (msg.t === 'decline') return send(v.from, { t: 'invite_gone', inv: msg.inv, why: 'declined' });
        for (const id of [v.from, v.to]) { const x = inMatch.get(id); if (x && x.ended) release(x); }
        if (!start(v.from, v.to, 'friend', v.stake)) err(uid, 'Could not start this game.'); else track('invite_accepted', uid, { from: v.from });
        return;
      }
      case 'room_create': {
        const stake = C.STAKES.includes(msg.stake) ? msg.stake : 0; const me = accounts.get(uid);
        if (stake && accounts.earned(me) < stake) return err(uid, 'You need ' + stake + ' earned Blockcoins for this bet.');
        for (const [k, v] of rooms) if (v.uid === uid) rooms.delete(k);
        let code; do code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6); while (rooms.has(code));
        rooms.set(code, { uid, stake, at: Date.now() }); track('link_created', uid, { stake }); send(uid, { t: 'room', code, stake }); return;
      }
      case 'room_cancel': for (const [k, v] of rooms) if (v.uid === uid) rooms.delete(k); return;
      case 'room_join': {
        const code = String(msg.code || '').toUpperCase(); const v = rooms.get(code);
        if (!v) return err(uid, 'This game link has expired. Ask your friend for a new one.');
        if (v.uid === uid) return err(uid, 'Send this link to a friend: they join, and the game starts.');
        if (!isOnline(v.uid)) return err(uid, 'Your friend is not on Blockmate any more.');
        for (const id of [v.uid, uid]) { const x = inMatch.get(id); if (x && x.ended) release(x); }
        const joiner = accounts.get(uid), owner = accounts.get(v.uid);
        rooms.delete(code);
        if (!start(v.uid, uid, 'friend', v.stake)) err(uid, 'Could not start this game.');
        else {
          const fresh = !!joiner && joiner.st.games === 0 && Date.now() - joiner.created < 3600e3;
          track('link_join', uid, { by: v.uid, byName: owner && owner.name, fresh });
          if (fresh) inMatch.get(uid).ref = { sharer: v.uid, newcomer: uid };
        }
        return;
      }
      // Live view of the opponent's hand: which piece they hold and where they drag it (not checked, display only).
      case 'peek': {
        if (!m || m.ended || m.st.turn !== p) return; const t = Date.now(); if (t - m.lastPeek[p] < 40) return; m.lastPeek[p] = t;
        const ti = Number.isInteger(msg.ti) && msg.ti >= 0 && msg.ti < 3 ? msg.ti : null;
        const fr = typeof msg.fr === 'number' && isFinite(msg.fr) ? Math.max(-6, Math.min(14, msg.fr)) : null, fc = typeof msg.fc === 'number' && isFinite(msg.fc) ? Math.max(-6, Math.min(14, msg.fc)) : null;
        send(m.players[1 - p], { t: 'peek', ti, fr, fc }); return;
      }
      case 'chat': {
        if (!m) return; const t = Date.now();
        if (t - m.lastChat[p] > 10000) m.chatN[p] = 0; if (++m.chatN[p] > 6 || t - m.lastChat[p] < 700) return send(uid, { t: 'chat_slow' }); m.lastChat[p] = t;
        const r = clean(msg.text); if (r.blocked) return send(uid, { t: 'chat_blocked' }); if (!r.text) return;
        for (const id of m.players) send(id, { t: 'chat', from: p, text: r.text, masked: r.changed }); return;
      }
    }
  }

  function connect(ws, uid) {
    let set = socks.get(uid); const first = !set; if (!set) socks.set(uid, set = new Set()); set.add(ws);
    let count = 0, windowStart = Date.now();
    ws.on('message', msg => {
      const t = Date.now(); if (t - windowStart > 1000) { windowStart = t; count = 0; } if (++count > 60) return; // flood guard
      try { onMessage(uid, msg); } catch (e) { log('ws error', e); }
    });
    ws.on('close', () => { set.delete(ws); if (!set.size) { socks.delete(uid); leaveQueue(uid); presence(uid, false); } });
    const u = accounts.get(uid); accounts.touch(uid);
    ws.send({ t: 'hello', me: accounts.me(u), friendsOnline: friendsOf(uid).filter(isOnline) });
    const m = inMatch.get(uid);
    if (m && !m.ended) { const i = m.players.indexOf(uid); ws.send({ t: 'start', resume: true, you: i, opp: m.cards[1 - i], meCard: m.cards[i], state: view(m) }); }
    if (first) presence(uid, true);
  }

  function stats() { return { online: socks.size, queue: queue.length, matches: new Set(inMatch.values()).size }; }
  return { connect, isOnline, pushMe, stats, send, _tick: tick, _inMatch: inMatch };
}
module.exports = { Online };
