// Owner dashboard data: audience (for ads), purchases, subscriptions, link sharing.
const C = require('../shared/catalog');
const { parisDay } = require('./accounts');

function Stats(db, online) {
  const q = {
    event: db.prepare('INSERT INTO events(type,user_id,created,data) VALUES(?,?,?,?)'),
    visitGet: db.prepare('SELECT views FROM visits WHERE day=? AND user_id=?'),
    visitAdd: db.prepare('INSERT INTO visits(day,user_id,views,first_at,last_at,device,country,ref,via) VALUES(?,?,1,?,?,?,?,?,?)'),
    visitBump: db.prepare('UPDATE visits SET views=views+1, last_at=? WHERE day=? AND user_id=?'),
    // The dashboard aggregates in SQL: loading every row on each refresh used too much memory.
    visitsByDay: db.prepare('SELECT day, COUNT(*) n, SUM(views) v FROM visits WHERE day>=? GROUP BY day'),
    visitRange: db.prepare("SELECT COUNT(DISTINCT user_id) u, COALESCE(SUM(views),0) v, SUM(CASE WHEN via IS NOT NULL AND via<>'' THEN 1 ELSE 0 END) l FROM visits WHERE day>=?"),
    visitTop: { device: db.prepare('SELECT device k, COUNT(*) n FROM visits WHERE day>=? GROUP BY device ORDER BY n DESC LIMIT 8'),
      country: db.prepare('SELECT country k, COUNT(*) n FROM visits WHERE day>=? GROUP BY country ORDER BY n DESC LIMIT 8'),
      ref: db.prepare('SELECT ref k, COUNT(*) n FROM visits WHERE day>=? GROUP BY ref ORDER BY n DESC LIMIT 8') },
    eventsByHour: db.prepare('SELECT type, created/3600000 h, COUNT(*) n FROM events WHERE created>=? GROUP BY type, h'),
    linkJoins: db.prepare("SELECT data, created FROM events WHERE type='link_join' AND created>=?"),
    shareLog: db.prepare("SELECT e.type, e.created, e.data, u.name FROM events e LEFT JOIN users u ON u.id=e.user_id WHERE e.created>=? AND e.type IN ('link_created','share_copy','share_native','link_visit','link_join','invite_sent','invite_accepted') ORDER BY e.created DESC LIMIT 60"),
    purchasesSince: db.prepare('SELECT p.*, u.name FROM purchases p LEFT JOIN users u ON u.id=p.user_id WHERE p.created>=? ORDER BY p.created DESC'),
    revenueAll: db.prepare("SELECT COALESCE(SUM(cents),0) c, COUNT(*) n FROM purchases WHERE id NOT LIKE 'demo_%'"),
    usersByHour: db.prepare('SELECT created/3600000 h, COUNT(*) n FROM users WHERE created>=? GROUP BY h'),
    userCounts: db.prepare('SELECT COUNT(*) n, SUM(CASE WHEN guest=0 THEN 1 ELSE 0 END) accounts FROM users'),
    plusUsers: db.prepare('SELECT id, name, plus_until, stripe_sub FROM users WHERE plus_until>?'),
    lastPlusBuy: db.prepare("SELECT product, created FROM purchases WHERE user_id=? AND product IN ('plusMonth','plusYear') ORDER BY created DESC LIMIT 1"),
    firstPlusBuy: db.prepare("SELECT MIN(created) c FROM purchases WHERE user_id=? AND product IN ('plusMonth','plusYear')")
  };

  function track(type, uid, data) { try { q.event.run(type, uid || null, Date.now(), data ? JSON.stringify(data) : null); } catch (e) {} }

  function hit(uid, req, body) {
    const day = parisDay(); const t = Date.now();
    if (q.visitGet.get(day, uid)) { q.visitBump.run(t, day, uid); return; }
    const ua = req.headers['user-agent'] || '';
    const device = /iPad|Tablet/i.test(ua) ? 'tablet' : /Mobi|Android|iPhone/i.test(ua) ? 'mobile' : 'desktop';
    // Country from the browser language (fr-FR -> FR). Good enough without a geo-IP database.
    const lang = (req.headers['accept-language'] || '').split(',')[0]; const m = /-([A-Za-z]{2})\b/.exec(lang);
    const country = m ? m[1].toUpperCase() : (lang.slice(0, 2).toUpperCase() || '?');
    let ref = String(body.ref || '').slice(0, 100).toLowerCase().replace(/^www\./, '');
    if (!ref || /dbcblockmate|onrender\.com|localhost/.test(ref)) ref = 'direct';
    const via = body.via === 'link' ? 'link' : null;
    q.visitAdd.run(day, uid, t, t, device, country, ref, via);
  }

  function report() {
    const now = Date.now(); const DAYS = 90;
    const since = now - DAYS * 864e5; const sinceDay = parisDay(new Date(since));
    const dayList = []; for (let i = DAYS - 1; i >= 0; i--) { const d = parisDay(new Date(now - i * 864e5)); if (!dayList.includes(d)) dayList.push(d); }
    const blank = () => ({ visitors: 0, views: 0, newPlayers: 0, signups: 0, games: 0, revenue: 0, purchases: 0, linkCreated: 0, shares: 0, linkVisits: 0, linkJoins: 0, broughtNew: 0, invites: 0 });
    const by = Object.fromEntries(dayList.map(d => [d, blank()]));
    const bucket = ts => by[parisDay(new Date(ts))];

    for (const v of q.visitsByDay.all(sinceDay)) { const b = by[v.day]; if (b) { b.visitors += v.n; b.views += v.v; } }
    for (const u of q.usersByHour.all(since)) { const b = bucket(u.h * 3600000); if (b) b.newPlayers += u.n; }
    const KEY = { game_end: 'games', signup: 'signups', link_created: 'linkCreated', share_copy: 'shares', share_native: 'shares', link_visit: 'linkVisits', link_join: 'linkJoins', invite_sent: 'invites' };
    for (const e of q.eventsByHour.all(since)) { const k = KEY[e.type]; if (!k) continue; const b = bucket(e.h * 3600000); if (b) b[k] += e.n; }
    const joins = q.linkJoins.all(since).map(e => { let d = {}; try { d = JSON.parse(e.data || '{}'); } catch (_) {} return Object.assign(d, { created: e.created }); });
    for (const d of joins) if (d.fresh) { const b = bucket(d.created); if (b) b.broughtNew++; }
    const purchases = q.purchasesSince.all(since);
    for (const p of purchases) { if (p.id.startsWith('demo_')) continue; const b = bucket(p.created); if (b) { b.revenue += p.cents; b.purchases++; } }
    const days = dayList.map(d => Object.assign({ day: d }, by[d]));

    // Unique visitors over a range need the raw rows (a player who comes 5 days counts once).
    const today = parisDay(); const monthStart = today.slice(0, 8) + '01';
    const range = (fromDay) => {
      const r = q.visitRange.get(fromDay);
      const sum = k => days.filter(d => d.day >= fromDay).reduce((a, d) => a + d[k], 0);
      const top = k => q.visitTop[k].all(fromDay).map(x => [x.k, x.n]);
      return { from: fromDay, unique: r.u, visits: sum('visitors'), views: r.v, games: sum('games'), newPlayers: sum('newPlayers'), signups: sum('signups'), revenue: sum('revenue'), purchases: sum('purchases'),
        linkCreated: sum('linkCreated'), shares: sum('shares'), linkVisits: sum('linkVisits'), linkJoins: sum('linkJoins'), broughtNew: sum('broughtNew'), invites: sum('invites'), viaLink: r.l || 0,
        devices: top('device'), countries: top('country'), refs: top('ref') };
    };
    const ago = n => parisDay(new Date(now - (n - 1) * 864e5));
    const periods = { today: range(today), d7: range(ago(7)), d30: range(ago(30)), month: range(monthStart), d90: range(sinceDay) };

    // Subscriptions
    const subs = q.plusUsers.all(now).map(u => {
      const last = q.lastPlusBuy.get(u.id); const first = q.firstPlusBuy.get(u.id);
      return { name: u.name, product: last ? last.product : null, since: first && first.c, until: u.plus_until, renewing: !!u.stripe_sub };
    }).sort((a, b) => (b.since || 0) - (a.since || 0));
    const renewing = subs.filter(s => s.renewing);
    const mrr = renewing.reduce((a, s) => a + (s.product === 'plusYear' ? C.PRODUCTS.plusYear.cents / 12 : C.PRODUCTS.plusMonth.cents), 0);

    // Link sharing leaderboard: who brings players in.
    const sharers = {};
    for (const d of joins) { const k = d.byName || '?'; const x = sharers[k] || (sharers[k] = { name: k, joins: 0, fresh: 0 }); x.joins++; if (d.fresh) x.fresh++; }
    const all = q.revenueAll.get(); const uc = q.userCounts.get();
    return {
      generated: now, live: online.stats(), players: uc.n, accounts: uc.accounts || 0,
      revenueAll: all.c, purchasesAll: all.n,
      days, periods,
      purchases: purchases.slice(0, 200).map(p => ({ at: p.created, name: p.name || '(supprimé)', product: p.product, label: (C.PRODUCTS[p.product] || { label: p.product === 'plusRenewal' ? 'Renouvellement Plus' : p.product }).label, cents: p.cents, demo: p.id.startsWith('demo_') })),
      subs: { active: subs.length, renewing: renewing.length, monthly: renewing.filter(s => s.product !== 'plusYear').length, yearly: renewing.filter(s => s.product === 'plusYear').length, mrr: Math.round(mrr), list: subs },
      sharers: Object.values(sharers).sort((a, b) => b.joins - a.joins).slice(0, 15),
      shareLog: q.shareLog.all(since).map(e => ({ at: e.created, type: e.type, name: e.name || '?', data: e.data ? JSON.parse(e.data) : null }))
    };
  }
  return { track, hit, report };
}
module.exports = { Stats };
