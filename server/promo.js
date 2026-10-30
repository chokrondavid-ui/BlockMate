// Promo codes typed in the Store. Not sent to browsers. One use per account.
// Add a code: NAME: { coins: 500 } or { coins: 0, items: [['avatar', 'gem']] }, optional until: Date.parse('2026-12-31').
// More codes can be added on the host without touching the code: PROMO_CODES="NOEL:500,AMIS:200".
const codes = {
  PARNASSA: { coins: 1000 }
};
for (const pair of (process.env.PROMO_CODES || '').split(',')) {
  const [k, v] = pair.split(':'); if (k && Number(v) > 0) codes[k.trim().toUpperCase()] = { coins: Math.floor(Number(v)) };
}
module.exports = { codes };
