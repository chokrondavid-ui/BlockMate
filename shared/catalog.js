// Blockmate catalog: cosmetics, bots, tiers, rewards and Store products.
// Shared by the server (prices, ownership rules) and the browser (rendering).
(function (root, factory) {
  const m = factory();
  if (typeof module === 'object' && module.exports) module.exports = m;
  else root.BMCatalog = m;
})(typeof self !== 'undefined' ? self : this, function () {
  function hex2rgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
  function rgb2hex(a) { return '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join(''); }
  function mix(h, t, k) { const a = hex2rgb(h), b = hex2rgb(t); return rgb2hex(a.map((v, i) => v + (b[i] - v) * k)); }
  const S = (name, b, price, extra) => Object.assign({ name, b, h: mix(b, '#ffffff', .55), l: mix(b, '#000000', .45), price }, extra || {});

  const SKINS = {
    sapphire: S('Sapphire', '#3E8BFF', 0, { grp: 'Solid' }), mint: S('Mint', '#1FCB9C', 0, { grp: 'Solid' }),
    candy: S('Candy', '#FF5DA2', 120, { grp: 'Solid' }), violet: S('Violet', '#9C6BFF', 120, { grp: 'Solid' }),
    lime: S('Lime', '#8BE11D', 150, { grp: 'Solid' }), sunset: S('Sunset', '#FF7A45', 150, { grp: 'Solid' }),
    lava: S('Lava', '#FF3D3D', 150, { grp: 'Solid' }), frost: S('Frost', '#6FE0FF', 150, { grp: 'Solid' }),
    lemon: S('Lemon', '#FFD93D', 200, { grp: 'Solid' }), ocean: S('Ocean', '#1E6BFF', 200, { grp: 'Solid' }),
    bubble: S('Bubblegum', '#FF8BD8', 200, { grp: 'Solid' }), slate: S('Slate', '#7C8AA8', 200, { grp: 'Solid' }),
    stripes: S('Racing', '#3E8BFF', 300, { grp: 'Patterns', pat: 'repeating-linear-gradient(45deg,rgba(255,255,255,.22) 0 3px,transparent 3px 8px)' }),
    tiger: S('Tiger', '#FF9A1E', 350, { grp: 'Patterns', pat: 'repeating-linear-gradient(115deg,rgba(30,10,0,.55) 0 3px,transparent 3px 9px)' }),
    dots: S('Polka', '#FF5DA2', 300, { grp: 'Patterns', pat: 'radial-gradient(circle,rgba(255,255,255,.45) 22%,transparent 25%)', ps: '34% 34%' }),
    check: S('Checker', '#1FCB9C', 300, { grp: 'Patterns', pat: 'conic-gradient(rgba(255,255,255,.22) 25%,transparent 0 50%,rgba(255,255,255,.22) 0 75%,transparent 0)', ps: '50% 50%' }),
    waves: S('Waves', '#1E6BFF', 350, { grp: 'Patterns', pat: 'radial-gradient(circle at 50% 120%,transparent 38%,rgba(255,255,255,.28) 40% 48%,transparent 50%)', ps: '50% 40%' }),
    carbon: S('Carbon', '#2C3140', 400, { grp: 'Patterns', pat: 'repeating-linear-gradient(45deg,rgba(255,255,255,.08) 0 2px,transparent 2px 4px),repeating-linear-gradient(-45deg,rgba(0,0,0,.25) 0 2px,transparent 2px 4px)' }),
    camo: S('Camo', '#5E7A2E', 400, { grp: 'Patterns', pat: 'radial-gradient(30% 25% at 30% 30%,rgba(30,40,10,.6) 98%,transparent),radial-gradient(28% 22% at 72% 65%,rgba(150,170,80,.55) 98%,transparent),radial-gradient(22% 30% at 25% 78%,rgba(70,50,20,.55) 98%,transparent)' }),
    grid: S('Cyber grid', '#14204F', 450, { grp: 'Patterns', pat: 'linear-gradient(rgba(91,216,255,.55) 1.5px,transparent 1.5px),linear-gradient(90deg,rgba(91,216,255,.55) 1.5px,transparent 1.5px)', ps: '33% 33%' }),
    obsidian: S('Obsidian', '#2A2538', 500, { grp: 'Patterns', cls: 'dark' }),
    rainbow: S('Rainbow', '#FF4D4D', 700, { grp: 'Animated', cls: 'rainbow' }),
    neoncyan: S('Neon cyan', '#5BD8FF', 600, { grp: 'Animated', cls: 'neonp' }),
    neonpink: S('Neon pink', '#FF4FA3', 600, { grp: 'Animated', cls: 'neonp' }),
    gold: S('Gold', '#D9A02E', 0, { cls: 'metal', plus: true }),
    diamond: S('Diamond', '#4CC9F0', 0, { cls: 'diamond', plus: true }),
    holo: S('Hologram', '#B79AFF', 0, { cls: 'holo', plus: true }),
    galaxy: S('Galaxy', '#5A3BD9', 0, { cls: 'galaxy', plus: true }),
    royal: S('Royal', '#7A22E0', 0, { cls: 'royal', plus: true }),
    inferno: S('Inferno', '#FF5A00', 0, { cls: 'inferno', plus: true }),
    custom: S('Your color', '#00D1B2', 0, { plus: true, custom: true })
  };
  const RIVAL = S('Rival', '#E8457A', 0);
  const GLOWS = {
    none: { name: 'None', price: 0 }, cyan: { name: 'Neon', price: 150, c: '#5BD8FF' }, ember: { name: 'Ember', price: 150, c: '#FF7A2E' }, toxic: { name: 'Toxic', price: 150, c: '#7CFF3C' },
    pinkg: { name: 'Bubblegum', price: 150, c: '#FF5DD0' }, uv: { name: 'Ultraviolet', price: 200, c: '#A15CFF' }, ice: { name: 'Ice', price: 200, c: '#BFF6FF' }, sun: { name: 'Sun', price: 200, c: '#FFD84A' }, blood: { name: 'Crimson', price: 200, c: '#FF2E4C' },
    halo: { name: 'Halo', plus: true, c: '#FFF0B0', anim: 'gp' }, prism: { name: 'Prism', plus: true, c: '#FF4D6D', anim: 'gr' }, volt: { name: 'Volt', plus: true, c: '#6FB8FF', anim: 'gf' }
  };
  const BLASTS = {
    spark: { name: 'Spark', price: 0 }, confetti: { name: 'Confetti', price: 150 }, embers: { name: 'Embers', price: 150 }, frost: { name: 'Frost', price: 150 }, pixels: { name: 'Pixels', price: 200 }, bubbles: { name: 'Bubbles', price: 200 }, stars: { name: 'Stars', price: 250 }, shock: { name: 'Shockwave', price: 250 },
    goldrain: { name: 'Gold rain', plus: true }, fireworks: { name: 'Fireworks', plus: true }, lightning: { name: 'Lightning', plus: true }, nova: { name: 'Supernova', plus: true }
  };
  const REACTS = {
    classic: { name: 'Classic', price: 0, words: ['Nice!', 'Great!', 'Amazing!', 'Unreal!'], col: 'linear-gradient(180deg,#FFFFFF,#D8C9FF)' },
    hype: { name: 'Hype', price: 150, words: ['Fire!', 'Insane!', 'Cooking!', 'Unstoppable!'], col: 'linear-gradient(180deg,#FFE27A,#FF5A1F)' },
    money: { name: 'Money', price: 200, words: ['Cha-ching!', 'Big money!', 'Jackpot!', 'Stupidly rich!'], col: 'linear-gradient(180deg,#C8FFE2,#1FCB7C)' },
    gamer: { name: 'Gamer', price: 200, words: ['GG!', 'Clutch!', 'Cracked!', 'Goated!'], col: 'linear-gradient(180deg,#9DF7FF,#3C8BFF)' },
    space: { name: 'Space', price: 200, words: ['Liftoff!', 'Orbit!', 'Supernova!', 'Galactic!'], col: 'linear-gradient(180deg,#E2C8FF,#8A4DFF)' },
    chef: { name: 'Chef', price: 200, words: ['Tasty!', 'Spicy!', 'Delicious!', "Chef's kiss!"], col: 'linear-gradient(180deg,#FFD0B0,#FF6A3D)' },
    sport: { name: 'Stadium', price: 200, words: ['Goal!', 'Golazo!', 'Hat-trick!', 'Champions!'], col: 'linear-gradient(180deg,#E9FF9A,#47C63A)' },
    royalr: { name: 'Royal', plus: true, words: ['Royal!', 'Majestic!', 'Legendary!', 'Godlike!'], col: 'linear-gradient(180deg,#FFF6CF,#E2A92E)' },
    glitch: { name: 'Glitch', plus: true, words: ['Hacked!', 'Overclocked!', 'System crash!', '404 skill!'], col: 'linear-gradient(180deg,#FFFFFF,#9DF7FF)', fx: 'glitch' },
    neon: { name: 'Neon', plus: true, words: ['Lit!', 'Electric!', 'Voltage!', 'Blackout!'], col: '#fff', fx: 'neon' }
  };
  const CATS = { skin: { label: 'Blocks', data: SKINS }, glow: { label: 'Glow', data: GLOWS }, blast: { label: 'Blast', data: BLASTS }, react: { label: 'Reactions', data: REACTS } };
  const DEFAULT_OWNED = { skin: ['sapphire', 'mint'], glow: ['none'], blast: ['spark'], react: ['classic'] };
  const DEFAULT_EQ = { skin: 'sapphire', glow: 'none', blast: 'spark', react: 'classic' };

  const LEVELS = {
    easy: { name: 'Rookie', elo: 800, win: 10, draw: 4, loss: 1, desc: 'Plays almost at random. Learn the rules.', col: '#1FCB9C' },
    medium: { name: 'Pro', elo: 1200, win: 25, draw: 10, loss: 2, desc: 'Always grabs the most points it can.', col: '#3E8BFF' },
    hard: { name: 'Master', elo: 1600, win: 50, draw: 20, loss: 5, desc: 'Reads your next move and blocks you.', col: '#B26BFF' }
  };
  const PRACTICE = 0.25;
  const ONLINE = { win: 30, draw: 10, loss: 3 };
  const STAKES = [0, 25, 50, 100];
  const TIERS = [[0, 'Bronze', '#D38A4E', 'B'], [1000, 'Silver', '#CBD3EA', 'S'], [1200, 'Gold', '#FFC94A', 'G'], [1400, 'Platinum', '#5FE8D4', 'P'], [1600, 'Diamond', '#7FB7FF', 'D'], [1800, 'Master', '#C98BFF', 'M']];
  const COUNTRIES = { FR: 'France', BE: 'Belgium', CH: 'Switzerland', CA: 'Canada', US: 'United States', GB: 'United Kingdom', ES: 'Spain', IT: 'Italy', DE: 'Germany', MA: 'Morocco', DZ: 'Algeria', TN: 'Tunisia', SN: 'Senegal', BR: 'Brazil', IN: 'India', JP: 'Japan' };
  const DAILY = [50, 60, 70, 80, 90, 100, 150];

  // Store products (real money). Amounts in euro cents.
  const PRODUCTS = {
    coins500: { kind: 'coins', coins: 500, cents: 199, label: '500 Blockcoins' },
    coins1300: { kind: 'coins', coins: 1300, cents: 499, label: '1,300 Blockcoins', bonus: '+30% bonus' },
    coins2800: { kind: 'coins', coins: 2800, cents: 999, label: '2,800 Blockcoins', bonus: '+40% bonus', tag: 'Popular' },
    coins6000: { kind: 'coins', coins: 6000, cents: 1999, label: '6,000 Blockcoins', bonus: '+50% bonus' },
    coins16000: { kind: 'coins', coins: 16000, cents: 4999, label: '16,000 Blockcoins', bonus: '+60% bonus', tag: 'Best value' },
    starter: { kind: 'starter', coins: 800, cents: 299, label: 'Starter pack', once: true, skins: ['stripes'], glows: ['cyan'] },
    plusMonth: { kind: 'plus', cents: 499, interval: 'month', label: 'Blockmate Plus · monthly' },
    plusYear: { kind: 'plus', cents: 3999, interval: 'year', label: 'Blockmate Plus · yearly' }
  };
  const euro = c => (c / 100).toFixed(2).replace('.', ',') + ' €';

  const tierOf = r => { let t = TIERS[0]; for (const x of TIERS) if (r >= x[0]) t = x; return t; };
  return { mix, S, SKINS, RIVAL, GLOWS, BLASTS, REACTS, CATS, DEFAULT_OWNED, DEFAULT_EQ, LEVELS, PRACTICE, ONLINE, STAKES, TIERS, COUNTRIES, DAILY, PRODUCTS, euro, tierOf };
});
