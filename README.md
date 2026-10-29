# Blockmate

Turn-based block puzzle duel: one 8×8 board, two players, three shared pieces. Solo vs 3 bots, ranked online matchmaking, friend challenges (with Blockcoin bets), game links, shop, Blockmate Plus and a Stripe store.

**Zero dependencies.** Node 22.13+ only: `node:http`, `node:sqlite`, `node:crypto`, a built-in WebSocket server and Stripe's REST API via `fetch`.

```
npm start         # http://localhost:3000 (payments simulated when no Stripe key and not in production)
npm test          # 12 end-to-end tests: accounts, shop, solo replay, anti-cheat, Stripe webhook, online games
```

## How it fits together

| Path | What |
|---|---|
| `shared/game.js` | Rules engine, deterministic from a seed. Used by the browser, the bots and the server. |
| `shared/catalog.js` | Skins, glows, blasts, reactions, prices, levels, tiers, Store products. |
| `server/index.js` | HTTP: static files, JSON API, solo verification, Stripe routes. |
| `server/online.js` | Live games over WebSocket: matchmaking, friend invites, game links, turn timer, Elo, stakes. |
| `server/accounts.js` | Guests, register/login (scrypt), profile, shop, daily reward. |
| `server/stripe.js` | Checkout, customer portal, webhook verification, idempotent crediting. |
| `server/db.js`, `server/ws.js` | SQLite schema; minimal RFC 6455 WebSocket. |
| `public/` | The site: `index.html`, `app.js`, music, legal pages. |

**Anti-cheat**

- Solo games get their seed from the server.
- The bot uses a stream seeded from that seed, so the server replays the whole game from the player's moves before paying any reward.
- Online games are fully server-authoritative.
- A ranked solo game left unfinished counts as a loss.

**Money rules**

- Blockcoins bought in the Store are tracked separately (`paid`) and are spent first.
- Only Blockcoins earned by playing can be bet.
- Nothing can be cashed out.

**One instance only**: live games live in memory.

Deployment: see [DEPLOY.md](DEPLOY.md).
