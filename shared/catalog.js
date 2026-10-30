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

  // ---- Legendary (expensive) items: the long road ----
  Object.assign(SKINS, {
    aurora: S('Aurora', '#2FD6A0', 1500, { grp: 'Legendary', cls: 'aurora', rar: 'legendary' }),
    chrome: S('Chrome', '#AEB8CC', 2500, { grp: 'Legendary', cls: 'chrome', rar: 'legendary' }),
    emerald: S('Emerald', '#12B56A', 4000, { grp: 'Legendary', cls: 'emerald', rar: 'legendary' }),
    magma: S('Magma', '#FF4A1C', 6000, { grp: 'Legendary', cls: 'magma', rar: 'legendary' }),
    midas: S('Midas', '#F5C542', 10000, { grp: 'Legendary', cls: 'midas', rar: 'mythic' }),
    phoenix: S('Phoenix', '#FF6A2B', 0, { cls: 'phoenix', pack: 'phoenixPack', rar: 'mythic' }),
    voidk: S('Void', '#1A1030', 0, { cls: 'void', pack: 'voidBundle', rar: 'legendary' })
  });
  Object.assign(GLOWS, {
    aurorag: { name: 'Aurora', price: 1200, c: '#4DFFC3', anim: 'gp', rar: 'legendary' },
    solar: { name: 'Solar flare', price: 2500, c: '#FFB21E', anim: 'gr', rar: 'legendary' },
    phoenixg: { name: 'Phoenix', c: '#FF7A2E', anim: 'gf', pack: 'phoenixPack', rar: 'mythic' },
    voidg: { name: 'Void', c: '#9D5BFF', anim: 'gp', pack: 'voidBundle', rar: 'legendary' }
  });
  Object.assign(BLASTS, {
    meteor: { name: 'Meteor', price: 2000, rar: 'legendary' },
    diamonds: { name: 'Diamond rain', price: 3500, rar: 'legendary' },
    blackhole: { name: 'Black hole', plus: true },
    phoenixb: { name: 'Phoenix', pack: 'phoenixPack', rar: 'mythic' }
  });
  Object.assign(REACTS, {
    boss: { name: 'Boss', price: 1500, words: ['Boss move!', 'Untouchable!', 'Dynasty!', 'Legend status!'], col: 'linear-gradient(180deg,#FFFFFF,#FF9B3D)', rar: 'legendary' },
    phoenixr: { name: 'Phoenix', pack: 'phoenixPack', words: ['Ignite!', 'Blazing!', 'Reborn!', 'Rise from ashes!'], col: 'linear-gradient(180deg,#FFE27A,#FF3D00)', rar: 'mythic' }
  });

  // ---- Profile pictures: 8x8 pixel sprites (letters = palette slots a b c d) ----
  const SPRITES = {
    block: ['........', '.aaa.bb.', '.aaa.bb.', '.aaa....', '....ccc.', '.bb.ccc.', '.bb.ccc.', '........'],
    smile: ['..aaaa..', '.aaaaaa.', 'aabaabaa', 'aaaaaaaa', 'abaaaaba', 'aabbbbaa', '.aaaaaa.', '..aaaa..'],
    star: ['...aa...', '..abba..', 'aaabbaaa', '.aabbaa.', '..abba..', '.aa..aa.', '.a....a.', '........'],
    heart: ['........', '.aa..aa.', 'abaaaaaa', 'aaaaaaaa', '.aaaaaa.', '..aaaa..', '...aa...', '........'],
    crown: ['........', 'a..aa..a', 'aa.aa.aa', 'aaaaaaaa', 'abaacaba', 'aaaaaaaa', '........', '........'],
    skull: ['..aaaa..', '.aaaaaa.', 'abbaabba', 'abbaabba', 'aaaabaaa', '.aaaaaa.', '.a.aa.a.', '........'],
    ghost: ['..aaaa..', '.aaaaaa.', 'aabaabaa', 'aabaabaa', 'aaaaaaaa', 'aaaaaaaa', 'aaaaaaaa', 'a.aa.aa.'],
    cat: ['a......a', 'aa....aa', 'aaaaaaaa', 'abaaaaba', 'aaaccaaa', 'aaaaaaaa', '.aaaaaa.', '........'],
    robot: ['...cc...', '.aaaaaa.', '.abaaba.', '.aaaaaa.', '.acccca.', '.aaaaaa.', '..a..a..', '..a..a..'],
    alien: ['..aaaa..', '.aaaaaa.', 'abbaabba', 'abbaabba', '.aaaaaa.', '..aaaa..', '..a..a..', '.aa..aa.'],
    flame: ['...a....', '...aa...', '..aaa.a.', '.aabaaa.', '.abbbaa.', 'aabcbbaa', 'aabccbaa', '.aaaaaa.'],
    bolt: ['....aa..', '...aa...', '..aa....', '.aaaaaa.', '....aa..', '...aa...', '..aa....', '.a......'],
    gem: ['........', '..aaaa..', '.abbbba.', 'aaaaaaaa', '.aaaaaa.', '..aaaa..', '...aa...', '........'],
    sword: ['......aa', '.....aba', '....aba.', '...aba..', 'c.aba...', '.cba....', '..cc....', '.c..c...'],
    shield: ['.aaaaaa.', 'abbbbbba', 'abbaabba', 'abaaaaba', 'abbaabba', '.abbbba.', '..abba..', '...aa...'],
    rocket: ['...aa...', '..aaaa..', '..abba..', '..aaaa..', '..aaaa..', '.caaaac.', 'c.dddd.c', '...dd...'],
    planet: ['........', '...aa...', '.aaaaab.', 'cccccccc', '.aabaaa.', '..aaaa..', '........', '........'],
    coin: ['..aaaa..', '.abbbba.', 'abbaabba', 'abbaabba', 'abbaabba', 'abbaabba', '.abbbba.', '..aaaa..'],
    moon: ['..aaa...', '.aab....', 'aab.....', 'aa......', 'aa......', 'aab...a.', '.aaaaaa.', '..aaaa..'],
    trophy: ['aaaaaaaa', 'a.abba.a', '.aaaaaa.', '..aaaa..', '...aa...', '...aa...', '..bbbb..', '.bbbbbb.'],
    dice: ['aaaaaaaa', 'abaaaaba', 'aaaaaaaa', 'aaabbaaa', 'aaaaaaaa', 'abaaaaba', 'aaaaaaaa', '........'],
    note: ['...aaaaa', '...aaaaa', '...a...a', '...a...a', '.aaa.aaa', 'aaaaaaaa', '.aa..aa.', '........'],
    eye: ['........', '..aaaa..', '.aabbaa.', 'aabccbaa', 'aabccbaa', '.aabbaa.', '..aaaa..', '........'],
    tree: ['...aa...', '..aaaa..', '.aaaaaa.', '..aaaa..', '.aaaaaa.', 'aaaaaaaa', '...bb...', '...bb...'],
    fish: ['........', '..aaa..a', '.aaaaaaa', 'abaaaaaa', 'aaaaaaaa', '.aaaaa.a', '..aaa...', '........'],
    phoenix: ['a......a', 'aa....aa', 'aab..baa', '.aabbaa.', '..bccb..', '..bccb..', '...bb...', '..b..b..']
  };
  const A = (name, sprite, pal, bg, price, extra) => Object.assign({ name, sprite, pal, bg, price }, extra || {});
  const AVATARS = {
    block: A('Blocks', 'block', ['#3E8BFF', '#F2781C', '#1FCB9C'], '#1B1330', 0, { grp: 'Classic' }),
    smile: A('Smiley', 'smile', ['#FFD93D', '#3A2400'], '#2A1D45', 0, { grp: 'Classic' }),
    heart: A('Heart', 'heart', ['#FF4D6D', '#FFC2CF'], '#2A1530', 100, { grp: 'Classic' }),
    starb: A('Star', 'star', ['#FFD93D', '#FFF6C2'], '#162244', 100, { grp: 'Classic' }),
    cat: A('Cat', 'cat', ['#FF9A1E', '#1C0B00', '#FF5DA2'], '#2B1A10', 150, { grp: 'Classic' }),
    fish: A('Fish', 'fish', ['#5BD8FF', '#0A1A30'], '#0E2A44', 150, { grp: 'Classic' }),
    tree: A('Tree', 'tree', ['#3BCB6A', '#8A5A2B'], '#10261A', 150, { grp: 'Classic' }),
    note: A('Music', 'note', ['#C08BFF'], '#1E1036', 150, { grp: 'Classic' }),
    dice: A('Dice', 'dice', ['#F5EFFF', '#1B1330'], '#3A2462', 200, { grp: 'Classic' }),
    moon: A('Moon', 'moon', ['#FFF0B0', '#D9C46A'], '#0B0F2A', 200, { grp: 'Classic' }),
    ghost: A('Ghost', 'ghost', ['#EDE6FF', '#1B1330'], '#2D1F4C', 300, { grp: 'Rare' }),
    robot: A('Robot', 'robot', ['#9FB2CC', '#5BD8FF', '#FF5A6E'], '#1A2433', 300, { grp: 'Rare' }),
    alien: A('Alien', 'alien', ['#7CFF3C', '#0A1A05'], '#14200E', 300, { grp: 'Rare' }),
    bolt: A('Bolt', 'bolt', ['#FFE24A'], '#2A2140', 350, { grp: 'Rare' }),
    fishg: A('Goldfish', 'fish', ['#FFB21E', '#2A1700'], '#3A1E06', 350, { grp: 'Rare' }),
    cat2: A('Night cat', 'cat', ['#2A2538', '#7CFF3C', '#FF5DA2'], '#3E2B66', 350, { grp: 'Rare' }),
    planet: A('Planet', 'planet', ['#FF8B5A', '#FFD0B0', '#C08BFF'], '#100A2A', 400, { grp: 'Rare' }),
    rocket: A('Rocket', 'rocket', ['#F5EFFF', '#5BD8FF', '#FF4D6D', '#FFB21E'], '#0E1636', 450, { grp: 'Rare' }),
    skull: A('Skull', 'skull', ['#F5EFFF', '#1B1330'], '#3A1020', 600, { grp: 'Epic', rar: 'epic' }),
    flame: A('Flame', 'flame', ['#FF4A1C', '#FF9B3D', '#FFE27A'], '#2A0D06', 600, { grp: 'Epic', rar: 'epic' }),
    sword: A('Sword', 'sword', ['#D6E2F5', '#6F8099', '#8A5A2B'], '#1A1F33', 700, { grp: 'Epic', rar: 'epic' }),
    shield: A('Shield', 'shield', ['#C9D3EA', '#3E8BFF'], '#141C33', 700, { grp: 'Epic', rar: 'epic' }),
    eye: A('Eye', 'eye', ['#F5EFFF', '#B26BFF', '#0B0612'], '#1E0F33', 800, { grp: 'Epic', rar: 'epic' }),
    ghostp: A('Phantom', 'ghost', ['#FF5DA2', '#1B1330'], '#2A0F2A', 900, { grp: 'Epic', rar: 'epic' }),
    gem: A('Gem', 'gem', ['#5FE8D4', '#E0FFFA'], '#0C2A2A', 1500, { grp: 'Legendary', rar: 'legendary' }),
    crown: A('Crown', 'crown', ['#FFC94A', '#FF4D6D', '#3E8BFF'], '#2A1C06', 3000, { grp: 'Legendary', rar: 'legendary' }),
    trophy: A('Trophy', 'trophy', ['#FFC94A', '#B07A1C'], '#241606', 5000, { grp: 'Legendary', rar: 'legendary' }),
    coin: A('Fortune', 'coin', ['#B86A00', '#FFC233'], '#1C1204', 10000, { grp: 'Legendary', rar: 'mythic' }),
    crowng: A('King', 'crown', ['#FFF0B0', '#5FE8D4', '#FF4D6D'], 'linear-gradient(135deg,#6B3FD9,#E2A92E)', 0, { plus: true, anim: true }),
    skullg: A('Golden skull', 'skull', ['#FFC94A', '#2A1700'], 'linear-gradient(135deg,#3A1020,#B07A1C)', 0, { plus: true }),
    gemp: A('Prism', 'gem', ['#FF7AD9', '#FFFFFF'], 'linear-gradient(135deg,#1E6BFF,#B26BFF,#FF4D6D)', 0, { plus: true, anim: true }),
    alieng: A('Galactic', 'alien', ['#B79AFF', '#0B0612'], 'linear-gradient(135deg,#100A2A,#5A3BD9)', 0, { plus: true }),
    phoenix: A('Phoenix', 'phoenix', ['#FF4A1C', '#FFB21E', '#FFF6C2'], 'linear-gradient(160deg,#3A0D06,#FF6A2B)', 0, { pack: 'phoenixPack', rar: 'mythic', anim: true }),
    voidav: A('Void', 'eye', ['#9D5BFF', '#1A1030', '#FFFFFF'], '#07040E', 0, { pack: 'voidBundle', rar: 'legendary' })
  };

  // ---- Lobby themes: recolor the whole home screen ----
  const THEMES = {
    night: { name: 'Night arena', price: 0, bg: '#0E0918', glow: '#F2781C', hex: '#B18CFF' },
    ocean: { name: 'Deep ocean', price: 400, bg: '#06121F', glow: '#2F8BFF', hex: '#5BD8FF' },
    ember: { name: 'Ember', price: 400, bg: '#160806', glow: '#FF4A1C', hex: '#FF9B3D' },
    forest: { name: 'Forest', price: 600, bg: '#07130C', glow: '#2FD67A', hex: '#7CFF3C' },
    candy: { name: 'Candy', price: 600, bg: '#1A0816', glow: '#FF5DA2', hex: '#FF8BD8' },
    arctic: { name: 'Arctic', price: 900, bg: '#0A1420', glow: '#BFF6FF', hex: '#E6FBFF', rar: 'epic' },
    toxic: { name: 'Toxic', price: 900, bg: '#0B1404', glow: '#A6FF00', hex: '#D4FF6B', rar: 'epic' },
    midnight: { name: 'Midnight gold', price: 2500, bg: '#0B0906', glow: '#F5C542', hex: '#FFE6A3', rar: 'legendary' },
    galaxyt: { name: 'Galaxy', plus: true, bg: '#07041A', glow: '#8A4DFF', hex: '#C9A8FF', anim: true },
    royalt: { name: 'Royal', plus: true, bg: '#120626', glow: '#E2A92E', hex: '#F7D57A' },
    phoenixt: { name: 'Phoenix', pack: 'phoenixPack', bg: '#140503', glow: '#FF6A2B', hex: '#FFB21E', rar: 'mythic', anim: true },
    voidt: { name: 'Void', pack: 'voidBundle', bg: '#030206', glow: '#9D5BFF', hex: '#6A4BB0', rar: 'legendary' }
  };

  // Bundles bought with Blockcoins (cheaper than buying items one by one; some items exist only in a bundle).
  const BUNDLES = {
    neonNight: { name: 'Neon night', price: 1000, items: [['skin', 'neoncyan'], ['glow', 'cyan'], ['blast', 'shock']] },
    royalCourt: { name: 'Royal court', price: 2400, items: [['avatar', 'crown'], ['react', 'boss']] },
    voidBundle: { name: 'Void', price: 4500, items: [['skin', 'voidk'], ['glow', 'voidg'], ['avatar', 'voidav'], ['theme', 'voidt']], exclusive: true }
  };

  const CATS = { skin: { label: 'Blocks', data: SKINS }, glow: { label: 'Glow', data: GLOWS }, blast: { label: 'Blast', data: BLASTS }, react: { label: 'Reactions', data: REACTS },
    avatar: { label: 'Avatars', data: AVATARS }, theme: { label: 'Lobby', data: THEMES } };
  const DEFAULT_OWNED = { skin: ['sapphire', 'mint'], glow: ['none'], blast: ['spark'], react: ['classic'], avatar: ['block', 'smile'], theme: ['night'] };
  const DEFAULT_EQ = { skin: 'sapphire', glow: 'none', blast: 'spark', react: 'classic', avatar: 'block', theme: 'night' };

  // Rarity, Fortnite style. Explicit on special items, otherwise from the price.
  const RARITY = { common: { name: 'Common', c: '#9AA5B8' }, rare: { name: 'Rare', c: '#3E8BFF' }, epic: { name: 'Epic', c: '#B26BFF' }, legendary: { name: 'Legendary', c: '#FF9B3D' }, mythic: { name: 'Mythic', c: '#FFD84A' }, plus: { name: 'Plus', c: '#FFC94A' } };
  const rarityOf = it => it.rar || (it.plus ? 'plus' : !it.price ? 'common' : it.price <= 200 ? 'common' : it.price <= 450 ? 'rare' : it.price <= 900 ? 'epic' : 'legendary');

  // Daily item shop: the same picks for everyone on a given Paris day, one of them at -30%.
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function dailyShop(day) {
    const pool = []; for (const [cat, c] of Object.entries(CATS)) for (const [k, it] of Object.entries(c.data)) if (it.price > 0 && !it.pack) pool.push([cat, k]);
    let h = hash('bm' + day); const r = () => { h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x9e3779b9) >>> 0; return h / 4294967296; };
    const out = []; while (out.length < 8 && pool.length) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
    const big = out.filter(([c, k]) => CATS[c].data[k].price >= 400); const deal = (big.length ? big : out)[Math.floor(r() * (big.length || out.length))];
    return { featured: out, deal, off: 30 };
  }
  function priceOf(cat, key, day) {
    const it = CATS[cat] && CATS[cat].data[key]; if (!it || it.plus || it.pack || !it.price) return null;
    const d = dailyShop(day); return d.deal && d.deal[0] === cat && d.deal[1] === key ? Math.round(it.price * (100 - d.off) / 100) : it.price;
  }

  // A prize when a guest creates an account. Weighted draw; an item already owned turns into coins.
  const SIGNUP_PRIZES = [
    { w: 28, coins: 300 }, { w: 14, coins: 600 }, { w: 4, coins: 1500 },
    { w: 12, cat: 'skin', pick: ['candy', 'violet', 'lime', 'sunset', 'lava', 'frost', 'lemon', 'ocean', 'bubble'] },
    { w: 8, cat: 'skin', pick: ['stripes', 'tiger', 'dots', 'check', 'waves', 'carbon', 'camo', 'grid'] },
    { w: 10, cat: 'glow', pick: ['cyan', 'ember', 'toxic', 'pinkg', 'uv', 'ice', 'sun', 'blood'] },
    { w: 8, cat: 'blast', pick: ['confetti', 'embers', 'frost', 'pixels', 'bubbles', 'stars', 'shock'] },
    { w: 10, cat: 'avatar', pick: ['ghost', 'robot', 'alien', 'bolt', 'fishg', 'cat2', 'planet', 'rocket'] },
    { w: 4, cat: 'avatar', pick: ['skull', 'flame', 'sword', 'shield'] },
    { w: 2, cat: 'skin', pick: ['aurora'] }
  ];
  // Word of mouth: a player who brings a newcomer with a game link, and the newcomer, both earn coins.
  const REFERRAL = { sharer: 150, newcomer: 100, perDay: 10, firstFriendGame: 50 };
  // Subscribing to Plus: ranked wins give double Elo for a few days (losses unchanged).
  const BOOST_DAYS = { month: 3, year: 7 };
  const CLOCK_MS = 5 * 60 * 1000;

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
    plusYear: { kind: 'plus', cents: 3999, interval: 'year', label: 'Blockmate Plus · yearly' },
    phoenixPack: { kind: 'bundle', cents: 499, label: 'Phoenix pack', coins: 1000, once: true, items: [['skin', 'phoenix'], ['glow', 'phoenixg'], ['blast', 'phoenixb'], ['react', 'phoenixr'], ['avatar', 'phoenix'], ['theme', 'phoenixt']] }
  };
  const euro = c => (c / 100).toFixed(2).replace('.', ',') + ' €';

  const tierOf = r => { let t = TIERS[0]; for (const x of TIERS) if (r >= x[0]) t = x; return t; };
  return { mix, S, SKINS, RIVAL, GLOWS, BLASTS, REACTS, AVATARS, SPRITES, THEMES, BUNDLES, RARITY, rarityOf, dailyShop, priceOf, SIGNUP_PRIZES, REFERRAL, BOOST_DAYS, CLOCK_MS, CATS, DEFAULT_OWNED, DEFAULT_EQ, LEVELS, PRACTICE, ONLINE, STAKES, TIERS, COUNTRIES, DAILY, PRODUCTS, euro, tierOf };
});
