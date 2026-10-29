// Players: guests are created automatically; a guest becomes a full account by choosing a password.
const crypto = require('node:crypto');
const C = require('../shared/catalog');
const { row2user, J } = require('./db');

const now = () => Date.now();
const id = p => p + crypto.randomBytes(9).toString('base64url');
const parisDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;

function hashPass(pw) { const salt = crypto.randomBytes(16); const h = crypto.scryptSync(pw, salt, 32, { N: 16384, r: 8, p: 1 }); return 'scrypt$' + salt.toString('hex') + '$' + h.toString('hex'); }
function checkPass(pw, stored) {
  if (!stored) return false; const [, s, h] = stored.split('$'); if (!s || !h) return false;
  const got = crypto.scryptSync(pw, Buffer.from(s, 'hex'), 32, { N: 16384, r: 8, p: 1 });
  return crypto.timingSafeEqual(got, Buffer.from(h, 'hex'));
}

function Accounts(db) {
  const q = {
    get: db.prepare('SELECT * FROM users WHERE id=?'),
    byName: db.prepare('SELECT * FROM users WHERE name_lc=?'),
    insert: db.prepare(`INSERT INTO users(id,name,name_lc,guest,owned,eq,created,seen) VALUES(?,?,?,1,?,?,?,?)`),
    seen: db.prepare('UPDATE users SET seen=? WHERE id=?'),
    sessGet: db.prepare('SELECT user_id FROM sessions WHERE token=?'),
    sessAdd: db.prepare('INSERT INTO sessions(token,user_id,created) VALUES(?,?,?)'),
    sessDel: db.prepare('DELETE FROM sessions WHERE token=?'),
    byCustomer: db.prepare('SELECT * FROM users WHERE stripe_customer=?')
  };
  const self = {
    isPlus: u => u.plus_until > now(),
    earned: u => Math.max(0, u.coins - u.paid),
    get(uid) { return row2user(q.get.get(uid)); },
    byName(name) { return row2user(q.byName.get(String(name || '').toLowerCase())); },
    byCustomer(c) { return row2user(q.byCustomer.get(c)); },
    createGuest() {
      for (let i = 0; i < 20; i++) {
        const name = 'Player' + Math.floor(1000 + Math.random() * 90000);
        if (q.byName.get(name.toLowerCase())) continue;
        const uid = id('u_'); q.insert.run(uid, name, name.toLowerCase(), JSON.stringify(C.DEFAULT_OWNED), JSON.stringify(C.DEFAULT_EQ), now(), now());
        return self.get(uid);
      }
      throw new Error('could not create guest');
    },
    newSession(uid) { const t = crypto.randomBytes(32).toString('hex'); q.sessAdd.run(t, uid, now()); return t; },
    userForToken(t) { if (!t) return null; const r = q.sessGet.get(t); return r ? r.user_id : null; },
    endSession(t) { if (t) q.sessDel.run(t); },
    touch(uid) { q.seen.run(now(), uid); },
    // Writes the listed fields of a user object back to the database.
    save(u, fields) {
      const cols = [], vals = [];
      for (const f of fields) { cols.push(f + '=?'); const v = u[f]; vals.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v); }
      if (!cols.length) return; vals.push(u.id); db.prepare('UPDATE users SET ' + cols.join(',') + ' WHERE id=?').run(...vals);
    },
    // What the browser receives about its own player.
    me(u, extra) {
      const day = parisDay(); const yest = parisDay(new Date(Date.now() - 864e5));
      const nextDay = u.daily_last === yest ? (u.daily_streak % 7) + 1 : 1;
      return Object.assign({
        id: u.id, name: u.name, guest: !!u.guest, email: u.email || '', country: u.country, elo: u.elo, coins: u.coins, paid: u.paid, earned: self.earned(u),
        plus: self.isPlus(u), plusUntil: u.plus_until, subscribed: !!u.stripe_sub, starter: !!u.starter, custom: u.custom, owned: u.owned, eq: u.eq, rec: u.rec, st: u.st,
        daily: { ready: u.daily_last !== day, streak: u.daily_streak, day: nextDay, amount: C.DAILY[nextDay - 1] * (self.isPlus(u) ? 2 : 1) }
      }, extra || {});
    },
    publicRow: u => ({ id: u.id, name: u.name, elo: u.elo, country: u.country, plus: self.isPlus(u), games: u.st.games }),

    register(u, { name, password, email, country }) {
      name = String(name || '').trim(); email = String(email || '').trim();
      if (!NAME_RE.test(name)) return 'Username: 3 to 16 letters, numbers or _.';
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) return 'Password: at least 8 characters.';
      if (email && !EMAIL_RE.test(email)) return 'That email address looks incomplete.';
      const other = self.byName(name); if (other && other.id !== u.id) return 'That username is taken. Try another one.';
      u.name = name; u.name_lc = name.toLowerCase(); u.pass = hashPass(password); u.email = email || null; u.guest = 0;
      if (country && C.COUNTRIES[country]) u.country = country;
      self.save(u, ['name', 'name_lc', 'pass', 'email', 'guest', 'country']); return null;
    },
    login(name, password) { const u = self.byName(name); if (!u || !u.pass || !checkPass(String(password || ''), u.pass)) return null; return u; },
    updateProfile(u, { name, email, country, custom }) {
      const f = [];
      if (name !== undefined && name !== u.name) {
        name = String(name).trim(); if (!NAME_RE.test(name)) return 'Username: 3 to 16 letters, numbers or _.';
        const o = self.byName(name); if (o && o.id !== u.id) return 'That username is taken. Try another one.';
        u.name = name; u.name_lc = name.toLowerCase(); f.push('name', 'name_lc');
      }
      if (email !== undefined) { email = String(email).trim(); if (email && !EMAIL_RE.test(email)) return 'That email address looks incomplete.'; u.email = email || null; f.push('email'); }
      if (country !== undefined) { if (!C.COUNTRIES[country]) return 'Unknown country.'; u.country = country; f.push('country'); }
      if (custom !== undefined) { if (!/^#[0-9a-fA-F]{6}$/.test(custom)) return 'Invalid color.'; u.custom = custom; f.push('custom'); }
      self.save(u, f); return null;
    },
    equip(u, cat, key) {
      const c = C.CATS[cat]; if (!c || !c.data[key]) return 'Unknown item.';
      const it = c.data[key]; if (it.plus ? !self.isPlus(u) : !u.owned[cat].includes(key)) return it.plus ? 'This is a Plus item.' : 'You don\'t own this item yet.';
      u.eq[cat] = key; self.save(u, ['eq']); return null;
    },
    buy(u, cat, key) {
      const c = C.CATS[cat]; if (!c || !c.data[key]) return 'Unknown item.';
      const it = c.data[key]; if (it.plus) return 'This is a Plus item.';
      if (u.owned[cat].includes(key)) return 'You already own this item.';
      if (u.coins < it.price) return 'Not enough Blockcoins.';
      u.coins -= it.price; u.paid = Math.max(0, Math.min(u.coins, u.paid - it.price));
      u.owned[cat].push(key); u.eq[cat] = key; self.save(u, ['coins', 'paid', 'owned', 'eq']); return null;
    },
    claimDaily(u) {
      const day = parisDay(); if (u.daily_last === day) return { error: 'Already claimed today.' };
      const yest = parisDay(new Date(Date.now() - 864e5)); const d = u.daily_last === yest ? (u.daily_streak % 7) + 1 : 1;
      const amt = C.DAILY[d - 1] * (self.isPlus(u) ? 2 : 1); u.coins += amt; u.daily_last = day; u.daily_streak = d;
      self.save(u, ['coins', 'daily_last', 'daily_streak']); return { amount: amt, day: d };
    },
    // Wipes progress but keeps the login, purchases and subscription.
    resetProgress(u) {
      u.elo = 1200; u.rec = { easy: 0, medium: 0, hard: 0 }; u.st = { games: 0, wins: 0, losses: 0, draws: 0, bestCombo: 0 };
      self.save(u, ['elo', 'rec', 'st']);
    },
    grantProduct(u, p) {
      if (p.kind === 'coins' || p.kind === 'starter') { u.coins += p.coins; u.paid += p.coins; }
      if (p.kind === 'starter') { u.starter = 1; for (const k of p.skins) if (!u.owned.skin.includes(k)) u.owned.skin.push(k); for (const k of p.glows) if (!u.owned.glow.includes(k)) u.owned.glow.push(k); }
      if (p.kind === 'plus') u.plus_until = Math.max(u.plus_until, now()) + (p.interval === 'year' ? 366 : 31) * 864e5;
      self.save(u, ['coins', 'paid', 'starter', 'owned', 'plus_until']);
    }
  };
  return self;
}
module.exports = { Accounts, parisDay, NAME_RE, id, J };
