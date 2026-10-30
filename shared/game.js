// Blockmate rules engine. Pure and deterministic: the same seed and the same
// moves always give the same game, so the server can replay and verify any
// game a browser reports.
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.BMGame = m;
})(typeof self !== 'undefined' ? self : this, function () {
  const N = 8, BLOCK_BONUS = 25;
  const SHAPES = [
    [[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]],
    [[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]],
    [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]],
    [[0, 0], [0, 1], [1, 0]], [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]], [[0, 1], [1, 0], [1, 1]],
    [[0, 0], [1, 0], [2, 0], [2, 1]], [[0, 1], [1, 1], [2, 1], [2, 0]], [[0, 0], [0, 1], [1, 0], [2, 0]], [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0]], [[0, 0], [0, 1], [0, 2], [1, 2]], [[0, 0], [1, 0], [1, 1], [1, 2]], [[0, 2], [1, 0], [1, 1], [1, 2]],
    [[0, 0], [0, 1], [0, 2], [1, 1]], [[1, 0], [1, 1], [1, 2], [0, 1]], [[0, 1], [0, 2], [1, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [1, 2]],
    [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 2], [1, 2], [2, 0], [2, 1], [2, 2]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2]], [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [2, 1]]
  ];
  const W = SHAPES.map((s, i) => i === 10 ? 0.35 : s.length >= 5 ? 0.7 : 1);
  const WT = W.reduce((a, b) => a + b, 0);
  const DIM = SHAPES.map(s => ({ h: Math.max(...s.map(p => p[0])) + 1, w: Math.max(...s.map(p => p[1])) + 1 }));

  function rng(seed) { let s = seed >>> 0; return function () { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const botSeed = seed => (seed ^ 0x5BD1E995) >>> 0;
  function drawPiece(r) { let x = r() * WT; for (let i = 0; i < W.length; i++) { x -= W[i]; if (x <= 0) return i; } return 0; }
  const lineBase = n => n ? Math.round(10 * n * (1 + 0.5 * (n - 1))) : 0;   // 10, 30, 60, 100
  const comboMult = c => 1 + 0.25 * Math.max(0, c - 1);                      // combo 2 x1.25, 3 x1.5...

  function fits(b, si, r, c) {
    const s = SHAPES[si]; if (!s) return false;
    for (const [dr, dc] of s) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= N || cc >= N || b[rr * N + cc]) return false; }
    return true;
  }
  function apply(b, si, r, c, owner, combo) {
    const placed = b.slice(); for (const [dr, dc] of SHAPES[si]) placed[(r + dr) * N + (c + dc)] = owner;
    const cl = new Set(); let lines = 0;
    for (let i = 0; i < N; i++) {
      let fr = true, fc = true;
      for (let j = 0; j < N; j++) { if (!placed[i * N + j]) fr = false; if (!placed[j * N + i]) fc = false; }
      if (fr) { lines++; for (let j = 0; j < N; j++) cl.add(i * N + j); }
      if (fc) { lines++; for (let j = 0; j < N; j++) cl.add(j * N + i); }
    }
    const after = placed.slice(); cl.forEach(k => after[k] = 0);
    const nc = lines ? (combo || 0) + 1 : 0; const linePts = Math.round(lineBase(lines) * comboMult(nc));
    return { placed, after, cleared: [...cl], lines, linePts, gain: SHAPES[si].length + linePts, combo: nc };
  }
  function moves(b, tray) {
    const out = [];
    tray.forEach((si, ti) => { if (si == null) return; const d = DIM[si]; for (let r = 0; r <= N - d.h; r++) for (let c = 0; c <= N - d.w; c++) if (fits(b, si, r, c)) out.push({ ti, si, r, c }); });
    return out;
  }
  function canPlace(b, si) { const d = DIM[si]; for (let r = 0; r <= N - d.h; r++) for (let c = 0; c <= N - d.w; c++) if (fits(b, si, r, c)) return true; return false; }

  // A new game. `draw` is the shared piece stream; both players see the same tray.
  // `next` holds the one piece that will replace the piece played, so you can see the three choices you leave your rival.
  function newState(seed) {
    const draw = rng(seed); const tray = [drawPiece(draw), drawPiece(draw), drawPiece(draw)]; const next = [drawPiece(draw)];
    return { seed, draw, board: Array(N * N).fill(0), tray, next, scores: [0, 0], combo: [0, 0], best: [0, 0], turn: 0, over: false, stuck: null, log: [] };
  }

  // Plays move {ti,r,c} for the player whose turn it is. Returns the move details or null if illegal.
  function play(st, ti, r, c) {
    if (st.over) return null;
    const si = st.tray[ti]; if (si == null || !Number.isInteger(r) || !Number.isInteger(c) || !fits(st.board, si, r, c)) return null;
    const p = st.turn; const res = apply(st.board, si, r, c, p + 1, st.combo[p]);
    st.scores[p] += res.gain; st.combo[p] = res.combo; st.best[p] = Math.max(st.best[p], res.combo);
    st.board = res.after; st.tray = st.tray.slice(); st.tray[ti] = st.next[0]; st.next = [drawPiece(st.draw)]; st.turn = 1 - p;
    const mv = { p, ti, si, r, c, gain: res.gain, lines: res.lines, combo: res.combo, cleared: res.cleared };
    st.log.push({ ti, r, c });
    if (!moves(st.board, st.tray).length) { st.over = true; st.stuck = st.turn; st.scores[1 - st.turn] += BLOCK_BONUS; }
    return mv;
  }
  const resultFor = (st, p) => st.scores[p] > st.scores[1 - p] ? 1 : st.scores[p] < st.scores[1 - p] ? 0 : 0.5;

  // Bots. `rand` must be the seeded bot stream so a game can be replayed exactly.
  function botMove(st, level, rand) {
    const ms = moves(st.board, st.tray); if (!ms.length) return null;
    const me = st.turn, op = 1 - me, cb = st.combo[me];
    const best = arr => arr.reduce((a, b) => b.v > a.v ? b : a).m;
    if (level === 'easy') {
      if (rand() < 0.7) return ms[Math.floor(rand() * ms.length)];
      return best(ms.map(m => ({ m, v: apply(st.board, m.si, m.r, m.c, me + 1, cb).gain + rand() * 4 })));
    }
    if (level === 'medium') return best(ms.map(m => ({ m, v: apply(st.board, m.si, m.r, m.c, me + 1, cb).gain + rand() * 1.5 })));
    return best(ms.map(m => {
      const res = apply(st.board, m.si, m.r, m.c, me + 1, cb); const left = st.tray.map((x, i) => i === m.ti ? null : x); const rep = moves(res.after, left); let br = 0;
      for (const o of rep) { const g = apply(res.after, o.si, o.r, o.c, op + 1, st.combo[op]).gain; if (g > br) br = g; }
      let v = res.gain - 0.95 * br; if (!rep.length) v += BLOCK_BONUS + 60; if (res.combo > 1) v += 4; if (st.combo[op] > 0 && br < 10) v += 3;
      v += -0.15 * res.after.filter(Boolean).length + rand() * 0.3; return { m, v };
    }));
  }

  // Replays a solo game (human is player 0) from its seed and the human's moves.
  function replaySolo(seed, level, humanMoves, resigned) {
    const st = newState(seed), br = rng(botSeed(seed)); let i = 0;
    if (!moves(st.board, st.tray).length) { st.over = true; st.stuck = 0; st.scores[1] += BLOCK_BONUS; }
    let guard = 0;
    while (!st.over && guard++ < 400) {
      if (st.turn === 0) {
        const m = humanMoves[i++];
        if (!m) return { ok: true, st, result: 0, incomplete: true };
        if (!play(st, m.ti, m.r, m.c)) return { ok: false, reason: 'illegal move ' + (i - 1) };
      } else {
        const m = botMove(st, level, br); if (!play(st, m.ti, m.r, m.c)) return { ok: false, reason: 'bot error' };
      }
    }
    if (i < humanMoves.length) return { ok: false, reason: 'extra moves' };
    return { ok: true, st, result: resigned ? 0 : resultFor(st, 0) };
  }

  const eloDelta = (r, opp, res, k) => Math.round((k || 32) * (res - 1 / (1 + Math.pow(10, (opp - r) / 400))));
  return { N, BLOCK_BONUS, SHAPES, DIM, rng, botSeed, drawPiece, lineBase, comboMult, fits, apply, moves, canPlace, newState, play, resultFor, botMove, replaySolo, eloDelta };
});
