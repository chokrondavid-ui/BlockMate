// Stripe through its REST API (no SDK needed). Checkout for packs and Plus, webhooks to credit players.
const crypto = require('node:crypto');
const C = require('../shared/catalog');

const API = 'https://api.stripe.com/v1/';

// Stripe expects nested form fields: a[b][0][c]=x
function form(obj, pre, out) {
  out = out || [];
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (typeof v === 'object') form(v, key, out); else out.push(encodeURIComponent(key) + '=' + encodeURIComponent(String(v)));
  }
  return out.join('&');
}

function Stripe({ secret, webhookSecret, baseUrl, accounts, db, log }) {
  const enabled = !!secret;
  async function call(path, params, method) {
    const r = await fetch(API + path, {
      method: method || 'POST',
      headers: { Authorization: 'Bearer ' + secret, 'Content-Type': 'application/x-www-form-urlencoded', 'Stripe-Version': '2024-06-20' },
      body: method === 'GET' ? undefined : form(params || {})
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error((j.error && j.error.message) || 'Stripe error ' + r.status); e.stripe = j; throw e; }
    return j;
  }
  const recorded = db.prepare('SELECT 1 FROM purchases WHERE id=?');
  const record = db.prepare('INSERT INTO purchases(id,user_id,product,cents,created) VALUES(?,?,?,?,?)');
  // Each Stripe object is credited once, however many times Stripe retries the webhook.
  function once(objId, uid, product, cents, fn) {
    if (recorded.get(objId)) return false;
    db.exec('BEGIN'); try { record.run(objId, uid, product, cents, Date.now()); fn(); db.exec('COMMIT'); } catch (e) { db.exec('ROLLBACK'); throw e; }
    return true;
  }

  async function checkout(u, productId) {
    const p = C.PRODUCTS[productId]; if (!p) return { error: 'Unknown product.' };
    if (p.kind === 'starter' && u.starter) return { error: 'You already bought the Starter pack.' };
    if (p.kind === 'plus' && u.stripe_sub) return { error: 'You already have Blockmate Plus. Manage it from your profile.' };
    if (!enabled) return { error: 'Payments are not switched on yet.' };
    const sub = p.kind === 'plus';
    const params = {
      mode: sub ? 'subscription' : 'payment',
      client_reference_id: u.id,
      success_url: baseUrl + '/?paid=' + productId,
      cancel_url: baseUrl + '/?store=1',
      locale: 'auto',
      metadata: { uid: u.id, product: productId },
      line_items: { 0: { quantity: 1, price_data: { currency: 'eur', unit_amount: p.cents, product_data: { name: p.label }, recurring: sub ? { interval: p.interval } : undefined } } },
      // Digital content delivered immediately: the buyer waives the 14-day withdrawal right (checked in our page).
      consent_collection: undefined
    };
    if (u.stripe_customer) params.customer = u.stripe_customer;
    else if (!sub) params.customer_creation = 'always';
    if (u.email && !u.stripe_customer) params.customer_email = u.email;
    if (sub) params.subscription_data = { metadata: { uid: u.id, product: productId } };
    else params.payment_intent_data = { metadata: { uid: u.id, product: productId } };
    const s = await call('checkout/sessions', params);
    return { url: s.url };
  }

  async function portal(u) {
    if (!enabled || !u.stripe_customer) return { error: 'No subscription to manage.' };
    const s = await call('billing_portal/sessions', { customer: u.stripe_customer, return_url: baseUrl + '/?profile=1' });
    return { url: s.url };
  }

  function verify(raw, header) {
    if (!webhookSecret || !header) return false;
    const parts = Object.fromEntries(header.split(',').map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1)]; }));
    const t = parts.t; const sigs = header.split(',').filter(x => x.startsWith('v1=')).map(x => x.slice(3));
    if (!t || !sigs.length || Math.abs(Date.now() / 1000 - Number(t)) > 600) return false;
    const want = crypto.createHmac('sha256', webhookSecret).update(t + '.' + raw).digest('hex');
    return sigs.some(s => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
  }

  // Returns the list of user ids whose profile changed, so the server can push fresh data to them.
  function handle(ev) {
    const o = ev.data && ev.data.object; if (!o) return [];
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
      if (o.payment_status !== 'paid' && o.payment_status !== 'no_payment_required') return [];
      const uid = o.client_reference_id || (o.metadata && o.metadata.uid); const pid = o.metadata && o.metadata.product;
      const u = uid && accounts.get(uid); const p = C.PRODUCTS[pid]; if (!u || !p) { log('webhook: unknown user/product', uid, pid); return []; }
      if (o.customer && !u.stripe_customer) { u.stripe_customer = o.customer; accounts.save(u, ['stripe_customer']); }
      if (p.kind === 'plus') { u.stripe_sub = o.subscription; accounts.save(u, ['stripe_sub']); }
      once(o.id, u.id, pid, o.amount_total || p.cents, () => accounts.grantProduct(u, p));
      return [u.id];
    }
    if (ev.type === 'invoice.paid') {
      // Renewals. The first invoice is already covered by checkout.session.completed.
      if (o.billing_reason !== 'subscription_cycle') return [];
      const u = o.customer && accounts.byCustomer(o.customer); if (!u) return [];
      const line = o.lines && o.lines.data && o.lines.data[0]; const end = line && line.period && line.period.end;
      once(o.id, u.id, 'plusRenewal', o.amount_paid || 0, () => {
        u.plus_until = Math.max(u.plus_until, (end ? end * 1000 : Date.now() + 31 * 864e5) + 864e5); accounts.save(u, ['plus_until']);
      });
      return [u.id];
    }
    if (ev.type === 'customer.subscription.deleted') {
      const u = o.customer && accounts.byCustomer(o.customer); if (!u) return [];
      if (u.stripe_sub === o.id) { u.stripe_sub = null; accounts.save(u, ['stripe_sub']); }
      return [u.id]; // Plus stays active until plus_until, which is the end of the paid period.
    }
    if (ev.type === 'charge.refunded') { log('refund to review manually:', o.id, o.customer, o.amount_refunded); return []; }
    return [];
  }

  // Used when Stripe is not configured and we are not in production, so the store can be tested.
  function demoGrant(u, productId) {
    const p = C.PRODUCTS[productId]; if (!p) return { error: 'Unknown product.' };
    if (p.kind === 'starter' && u.starter) return { error: 'You already bought the Starter pack.' };
    once('demo_' + crypto.randomBytes(8).toString('hex'), u.id, productId, 0, () => accounts.grantProduct(u, p));
    return { demo: true };
  }
  return { enabled, checkout, portal, verify, handle, demoGrant, form };
}
module.exports = { Stripe, form };
