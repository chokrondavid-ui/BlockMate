// Builds the game-portal versions of Blockmate (CrazyGames, Poki).
// The portal hosts these files; the game still talks to the live server for accounts, rankings and online play.
// Usage: node scripts/build-portal.js [apiBase]   →  dist/crazygames.zip, dist/poki.zip
'use strict';
const fs = require('node:fs'), path = require('node:path'), zlib = require('node:zlib');
const ROOT = path.join(__dirname, '..');
const API = process.argv[2] || process.env.BM_API || 'https://www.dbcblockmate.com';
const SDK = {
  crazygames: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
  poki: '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>'
};

function html(portal) {
  let s = fs.readFileSync(path.join(ROOT, 'public/index.html'), 'utf8');
  s = s.replace('href="/favicon.svg"', 'href="favicon.svg"')
    .replace(/<footer class="foot" id="foot">[\s\S]*?<\/footer>/, `<footer class="foot pfoot" id="foot"><span>By playing, you accept the</span><a href="${API}/legal/cgv" target="_blank" rel="noopener">Terms</a><span>and</span><a href="${API}/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a></footer>`)
    .replace('<a class="logo" id="home" href="/"', '<a class="logo" id="home" href="#"')
    .replace(/<meta (property="og:|name="twitter:)[^>]*>\s*/g, '').replace(/<link rel="(canonical|alternate|manifest|apple-touch-icon)"[^>]*>\s*/g, '')
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/, '').replace(/<noscript>[\s\S]*?<\/noscript>\s*/, '')
    .replace(/<meta name="google-adsense-account"[^>]*>\s*/, '').replace(/<script async src="https:\/\/pagead2[^>]*><\/script>\s*/, '');
  const boot = `<script>window.BM_PORTAL=${JSON.stringify(portal)};window.BM_API=${JSON.stringify(API)};</script>\n${SDK[portal]}\n`;
  s = s.replace('<script src="/shared/catalog.js"></script>', boot + '<script src="shared/catalog.js"></script>')
    .replace('<script src="/shared/game.js"></script>', '<script src="shared/game.js"></script>')
    .replace('<script src="/app.js"></script>', '<script src="app.js"></script>');
  // Poki blocks external requests (Google Fonts included): the Poki build uses the fallback system fonts.
  if (portal === 'poki') s = s.replace(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com"[^>]*>\s*/g, '').replace(/<link[^>]*fonts\.googleapis\.com\/css2[^>]*>\s*/g, '');
  if (/(src|href)="\/(?!\/)/.test(s)) throw new Error('absolute path left in portal html: ' + s.match(/(src|href)="\/[^"]*"/)[0]);
  return s;
}

// Minimal zip writer (stored + deflate), no dependencies.
const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc32 = b => { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
function zip(files) {
  const parts = [], central = []; let off = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name), z = zlib.deflateRawSync(data, { level: 9 }), crc = crc32(data);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(0, 10); h.writeUInt16LE(0x21, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(z.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(n.length, 26); h.writeUInt16LE(0, 28);
    parts.push(h, n, z);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(0, 12); c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(z.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(n.length, 28); c.writeUInt32LE(off, 42);
    central.push(c, n); off += 30 + n.length + z.length;
  }
  const cd = Buffer.concat(central), e = Buffer.alloc(22); e.writeUInt32LE(0x06054b50, 0); e.writeUInt16LE(files.length, 8); e.writeUInt16LE(files.length, 10); e.writeUInt32LE(cd.length, 12); e.writeUInt32LE(off, 16);
  return Buffer.concat(parts.concat([cd, e]));
}

const out = path.join(ROOT, 'dist'); fs.mkdirSync(out, { recursive: true });
for (const portal of Object.keys(SDK)) {
  const files = [
    ['index.html', Buffer.from(html(portal))],
    ['app.js', fs.readFileSync(path.join(ROOT, 'public/app.js'))],
    ['favicon.svg', fs.readFileSync(path.join(ROOT, 'public/favicon.svg'))],
    ['shared/catalog.js', fs.readFileSync(path.join(ROOT, 'shared/catalog.js'))],
    ['shared/game.js', fs.readFileSync(path.join(ROOT, 'shared/game.js'))]
  ];
  const dir = path.join(out, portal); fs.rmSync(dir, { recursive: true, force: true });
  for (const [n, d] of files) { fs.mkdirSync(path.dirname(path.join(dir, n)), { recursive: true }); fs.writeFileSync(path.join(dir, n), d); }
  fs.writeFileSync(path.join(out, portal + '.zip'), zip(files));
  // Single-file version: some portals (CrazyGames) refuse archives, so everything is inlined in one index.html.
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const inline = html(portal)
    .replace('href="favicon.svg"', 'href="data:image/svg+xml;base64,' + Buffer.from(read('public/favicon.svg')).toString('base64') + '"')
    .replace('<script src="shared/catalog.js"></script>', () => '<script>\n' + read('shared/catalog.js') + '\n</script>')
    .replace('<script src="shared/game.js"></script>', () => '<script>\n' + read('shared/game.js') + '\n</script>')
    .replace('<script src="app.js"></script>', () => '<script>\n' + read('public/app.js') + '\n</script>');
  const one = path.join(out, portal + '-single'); fs.rmSync(one, { recursive: true, force: true }); fs.mkdirSync(one, { recursive: true });
  fs.writeFileSync(path.join(one, 'index.html'), inline);
  console.log('built dist/' + portal + '.zip', '→ API', API);
}
