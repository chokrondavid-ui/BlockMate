// Owner dashboard data: audience (for ads), purchases, subscriptions, link sharing.
const C = require('../shared/catalog');
const { parisDay } = require('./accounts');

function Stats(db, online) {
  const q = {
    event: db.prepare('INSERT INTO events(type,user_id,created,data) VALUES(?,?,?,?)'),
    visitGet: db.prepare('SELECT views FROM visits WHERE day=? AND user_id=?'),
    visitAdd: db.prepare('INSERT INTO visits(day,user_id,views,first_at,last_at,device,country,ref,via) VALUES(?,?,1,?,?,?,?,?,?)'),
    visitBump: db.prepare('UPDATE visits SET views=views+1, last_at=? WHERE day=? AND user_id=?'),
    visitsSince: db.prepare('SELECT * FROM visits WHERE day>=?'),
    eventsSince: db.prepare('SELECT e.*, u.name FROM events e LEFT JOIN users u ON u.id=e.user_id WHERE e.created>=? ORDER BY e.created DESC'),
    purchasesSince: db.prepare('SELECT p.*, u.name FROM purchases p LEFT JOIN users u ON u.id=p.user_id WHERE p.created>=? ORDER BY p.created DESC'),
    revenueAll: db.prepare("SELECT COALESCE(SUM(cents),0) c, COUNT(*) n FROM purchases WHERE id NOT LIKE 'demo_%'"),
    usersSince: db.prepare('SELECT created, guest FROM users WHERE created>=?'),
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

    const visits = q.visitsSince.all(sinceDay);
    for (const v of visits) { const b = by[v.day]; if (b) { b.visitors++; b.views += v.views; } }
    for (const u of q.usersSince.all(since)) { const b = bucket(u.created); if (b) b.newPlayers++; }
    const events = q.eventsSince.all(since);
    for (const e of events) {
      const b = bucket(e.created); if (!b) continue;
      if (e.type === 'game_end') b.games++;
      else if (e.type === 'signup') b.signups++;
      else if (e.type === 'link_created') b.linkCreated++;
      else if (e.type === 'share_copy' || e.type === 'share_native') b.shares++;
      else if (e.type === 'link_visit') b.linkVisits++;
      else if (e.type === 'link_join') { b.linkJoins++; try { if (JSON.parse(e.data || '{}').fresh) b.broughtNew++; } catch (_) {} }
      else if (e.type === 'invite_sent') b.invites++;
    }
    const purchases = q.purchasesSince.all(since);
    for (const p of purchases) { if (p.id.startsWith('demo_')) continue; const b = bucket(p.created); if (b) { b.revenue += p.cents; b.purchases++; } }
    const days = dayList.map(d => Object.assign({ day: d }, by[d]));

    // Unique visitors over a range need the raw rows (a player who comes 5 days counts once).
    const today = parisDay(); const monthStart = today.slice(0, 8) + '01';
    const range = (fromDay) => {
      const ids = new Set(); let views = 0; const devices = {}, countries = {}, refs = {}; let viaLink = 0;
      for (const v of visits) if (v.day >= fromDay) { ids.add(v.user_id); views += v.views; devices[v.device] = (devices[v.device] || 0) + 1; countries[v.country] = (countries[v.country] || 0) + 1; refs[v.ref] = (refs[v.ref] || 0) + 1; if (v.via) viaLink++; }
      const sum = k => days.filter(d => d.day >= fromDay).reduce((a, d) => a + d[k], 0);
      const top = o => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8);
      return { from: fromDay, unique: ids.size, visits: days.filter(d => d.day >= fromDay).reduce((a, d) => a + d.visitors, 0), views, games: sum('games'), newPlayers: sum('newPlayers'), signups: sum('signups'), revenue: sum('revenue'), purchases: sum('purchases'),
        linkCreated: sum('linkCreated'), shares: sum('shares'), linkVisits: sum('linkVisits'), linkJoins: sum('linkJoins'), broughtNew: sum('broughtNew'), invites: sum('invites'), viaLink,
        devices: top(devices), countries: top(countries), refs: top(refs) };
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
    for (const e of events) {
      if (e.type !== 'link_join') continue; let d = {}; try { d = JSON.parse(e.data || '{}'); } catch (_) {}
      const k = d.byName || '?'; const s = sharers[k] || (sharers[k] = { name: k, joins: 0, fresh: 0 }); s.joins++; if (d.fresh) s.fresh++;
    }
    const shareTypes = new Set(['link_created', 'share_copy', 'share_native', 'link_visit', 'link_join', 'invite_sent', 'invite_accepted']);
    const all = q.revenueAll.get(); const uc = q.userCounts.get();
    return {
      generated: now, live: online.stats(), players: uc.n, accounts: uc.accounts || 0,
      revenueAll: all.c, purchasesAll: all.n,
      days, periods,
      purchases: purchases.slice(0, 200).map(p => ({ at: p.created, name: p.name || '(supprimé)', product: p.product, label: (C.PRODUCTS[p.product] || { label: p.product === 'plusRenewal' ? 'Renouvellement Plus' : p.product }).label, cents: p.cents, demo: p.id.startsWith('demo_') })),
      subs: { active: subs.length, renewing: renewing.length, monthly: renewing.filter(s => s.product !== 'plusYear').length, yearly: renewing.filter(s => s.product === 'plusYear').length, mrr: Math.round(mrr), list: subs },
      sharers: Object.values(sharers).sort((a, b) => b.joins - a.joins).slice(0, 15),
      shareLog: events.filter(e => shareTypes.has(e.type)).slice(0, 60).map(e => ({ at: e.created, type: e.type, name: e.name || '?', data: e.data ? JSON.parse(e.data) : null }))
    };
  }
  return { track, hit, report };
}
module.exports = { Stats };
