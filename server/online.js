// Live games over WebSocket. The server holds the real game state; browsers only send moves.
const crypto = require('node:crypto');
const G = require('../shared/game');
const C = require('../shared/catalog');

const TURN_MS = 25000, GONE_MS = 60000, INVITE_MS = 60000, ROOM_MS = 30 * 60000;

function Online({ accounts, db, log }) {
  const socks = new Map();       // uid -> Set of sockets
  const inMatch = new Map();     // uid -> match
  const queue = [];              // {uid, elo, since}
  const invites = new Map();     // invite id -> {from, to, stake, at}
  const rooms = new Map();       // code -> {uid, stake, at}
  const matchesIns = db.prepare('INSERT INTO matches(id,a,b,kind,stake,seed,created) VALUES(?,?,?,?,?,?,?)');
  const matchesEnd = db.prepare('UPDATE matches SET sa=?,sb=?,result=?,ended=? WHERE id=?');
  const friendIds = db.prepare('SELECT friend_id FROM friends WHERE user_id=?');

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
    return { id: m.id, kind: m.kind, stake: m.stake, board: st.board, tray: st.tray, scores: st.scores, combo: st.combo, best: st.best, turn: st.turn, over: st.over, stuck: st.stuck, deadline: m.deadline, now: Date.now(), moves: st.log.length };
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
    const m = { id: 'm_' + crypto.randomBytes(8).toString('base64url'), kind, stake, players, cards: players.map(id => card(id === a.id ? a : b)), st: G.newState(seed), seed, timeouts: [0, 0], gone: [0, 0], rematch: [false, false], ended: false, deadline: 0 };
    matchesIns.run(m.id, players[0], players[1], kind, stake, seed, Date.now());
    for (const id of players) inMatch.set(id, m);
    if (!G.moves(m.st.board, m.st.tray).length) { m.st.over = true; m.st.stuck = 0; m.st.scores[1] += G.BLOCK_BONUS; }
    m.deadline = Date.now() + TURN_MS;
    players.forEach((id, i) => { send(id, { t: 'start', you: i, opp: m.cards[1 - i], meCard: m.cards[i], state: view(m) }); presence(id, true); });
    if (m.st.over) finish(m, null);
    return true;
  }

  function move(m, p, ti, r, c, auto) {
    if (m.ended || m.st.over || m.st.turn !== p) return false;
    const mv = G.play(m.st, ti, r, c); if (!mv) return false;
    if (!auto) m.timeouts[p] = 0;
    m.deadline = Date.now() + TURN_MS;
    for (const id of m.players) send(id, { t: 'move', mv, auto: !!auto, state: view(m) });
    if (m.st.over) finish(m, null);
    return true;
  }

  // reason: null (board blocked), 'resign', 'timeout', 'left'. loser: index of the player who gave up.
  function finish(m, reason, loser) {
    if (m.ended) return; m.ended = true; m.st.over = true;
    const st = m.st; const res = [0, 1].map(p => reason ? (p === loser ? 0 : 1) : G.resultFor(st, p));
    const us = m.players.map(id => accounts.get(id));
    const out = [{}, {}];
    if (m.kind === 'ranked') {
      const d = [G.eloDelta(us[0].elo, us[1].elo, res[0]), G.eloDelta(us[1].elo, us[0].elo, res[1])];
      us.forEach((u, i) => { u.elo = Math.max(100, u.elo + d[i]); out[i].elo = d[i]; const c = res[i] === 1 ? C.ONLINE.win : res[i] === 0.5 ? C.ONLINE.draw : C.ONLINE.loss; u.coins += c; out[i].coins = c; });
    } else us.forEach((u, i) => { out[i].elo = 0; out[i].coins = 0; });
    if (m.stake) us.forEach((u, i) => { const back = res[i] === 1 ? 2 * m.stake : res[i] === 0.5 ? m.stake : 0; u.coins += back; out[i].coins += back - m.stake; });
    us.forEach((u, i) => {
      u.st.games++; if (res[i] === 1) u.st.wins++; else if (res[i] === 0) u.st.losses++; else u.st.draws++;
      u.st.bestCombo = Math.max(u.st.bestCombo, st.best[i]);
      accounts.save(u, ['elo', 'coins', 'st']);
    });
    matchesEnd.run(st.scores[0], st.scores[1], res[0], Date.now(), m.id);
    m.players.forEach((id, i) => send(id, { t: 'end', reason, result: res[i], scores: st.scores, elo: out[i].elo, coins: out[i].coins, me: accounts.me(accounts.get(id)) }));
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
      if (t > m.deadline) {
        const p = m.st.turn; m.timeouts[p]++;
        if (m.timeouts[p] >= 2) { finish(m, 'timeout', p); continue; }
        const ms = G.moves(m.st.board, m.st.tray); const pick = ms[Math.floor(Math.random() * ms.length)];
        move(m, p, pick.ti, pick.r, pick.c, true);
      }
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
      case 'move': if (!m || !move(m, p, msg.ti, msg.r, msg.c, false)) send(uid, { t: 'reject', state: m ? view(m) : null }); return;
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
        const k = crypto.randomBytes(6).toString('base64url'); invites.set(k, { from: uid, to, stake, at: Date.now() });
        send(to, { t: 'invited', inv: k, from: card(me), stake }); send(uid, { t: 'invite_sent', inv: k, to }); return;
      }
      case 'accept': case 'decline': {
        const v = invites.get(String(msg.inv || '')); if (!v || v.to !== uid) return err(uid, 'This challenge has expired.');
        invites.delete(msg.inv);
        if (msg.t === 'decline') return send(v.from, { t: 'invite_gone', inv: msg.inv, why: 'declined' });
        for (const id of [v.from, v.to]) { const x = inMatch.get(id); if (x && x.ended) release(x); }
        if (!start(v.from, v.to, 'friend', v.stake)) err(uid, 'Could not start this game.');
        return;
      }
      case 'room_create': {
        const stake = C.STAKES.includes(msg.stake) ? msg.stake : 0; const me = accounts.get(uid);
        if (stake && accounts.earned(me) < stake) return err(uid, 'You need ' + stake + ' earned Blockcoins for this bet.');
        for (const [k, v] of rooms) if (v.uid === uid) rooms.delete(k);
        let code; do code = crypto.randomBytes(4).toString('hex').toUpperCase().slice(0, 6); while (rooms.has(code));
        rooms.set(code, { uid, stake, at: Date.now() }); send(uid, { t: 'room', code, stake }); return;
      }
      case 'room_cancel': for (const [k, v] of rooms) if (v.uid === uid) rooms.delete(k); return;
      case 'room_join': {
        const code = String(msg.code || '').toUpperCase(); const v = rooms.get(code);
        if (!v) return err(uid, 'This game link has expired. Ask your friend for a new one.');
        if (v.uid === uid) return err(uid, 'Send this link to a friend: they join, and the game starts.');
        if (!isOnline(v.uid)) return err(uid, 'Your friend is not on Blockmate any more.');
        for (const id of [v.uid, uid]) { const x = inMatch.get(id); if (x && x.ended) release(x); }
        rooms.delete(code); if (!start(v.uid, uid, 'friend', v.stake)) err(uid, 'Could not start this game.');
        return;
      }
      case 'emote': if (m && typeof msg.k === 'string' && msg.k.length < 12) send(m.players[1 - p], { t: 'emote', k: msg.k }); return;
    }
  }

  function connect(ws, uid) {
    let set = socks.get(uid); const first = !set; if (!set) socks.set(uid, set = new Set()); set.add(ws);
    let count = 0, windowStart = Date.now();
    ws.on('message', msg => {
      const t = Date.now(); if (t - windowStart > 1000) { windowStart = t; count = 0; } if (++count > 30) return; // flood guard
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
module.exports = { Online, TURN_MS };
