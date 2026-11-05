// Builds the static SEO pages (public/guide/*.html, public/sitemap.xml) from the content below.
// They are plain HTML that search engines can read without running the game's JavaScript.
// Usage: node scripts/build-seo.js
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), SITE = 'https://www.dbcblockmate.com';
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const PAGES = [
  { slug: 'how-to-play', lang: 'en', alt: 'fr/regles', title: 'How to play Blockmate: rules, scoring and tips', h1: 'How to play Blockmate',
    desc: 'Blockmate rules in 2 minutes: share one 8x8 board with your rival, place pieces, clear lines, chain combos and leave your opponent with no move. Scoring table and 10 tips.',
    lead: 'Blockmate is a block puzzle for two. You and your rival share the same 8×8 board and take turns placing pieces. Every line you clear scores points, and every piece you place also changes what your opponent can do next.',
    body: `<h2>The rules in 30 seconds</h2><ol>
<li>Each turn you get <b>three pieces</b> and place <b>one</b> of them anywhere it fits on the shared board.</li>
<li>Fill a full <b>row or column</b> to clear it and score points. Clearing several lines with one piece scores much more.</li>
<li>Clear lines on consecutive turns to build a <b>combo multiplier</b>.</li>
<li>The two pieces you didn't use go to your rival, with one new piece. You always see your rival's next choices.</li>
<li>The game ends when someone can't place any piece. That player's rival gets a <b>+25 block bonus</b>, and the highest score wins.</li></ol>
<h2>Scoring</h2><table><tr><th>Move</th><th>Points</th></tr><tr><td>1 line</td><td>10</td></tr><tr><td>2 lines at once</td><td>30</td></tr><tr><td>3 lines at once</td><td>60</td></tr><tr><td>Combo 2 · 3 · 4</td><td>×1.25 · ×1.5 · ×1.75</td></tr><tr><td>Rival can't play</td><td>+25</td></tr></table>
<h2>Game modes</h2><ul><li><b>Solo vs bots</b>: Rookie, Pro and Master. Ranked games move your Elo; Practice games are risk-free and can use a score target (first to 100, 200 or 500 points).</li>
<li><b>Online ranked</b>: play a real player near your level, with 2:30, 5:00 or 7:30 on each clock.</li>
<li><b>Play a friend</b>: send a link or challenge an online friend, with or without a Blockcoin bet.</li>
<li><b>Same screen</b>: two players on one phone or computer.</li>
<li><b>Daily challenge</b>: the same pieces for everyone, one attempt per day, one leaderboard.</li></ul>
<h2>10 tips to win more</h2><ol>
<li>Keep the centre of the board open: it is where big pieces fit.</li>
<li>Before you place, look at <b>your rival's next choices</b>. Don't leave a line one piece away from being cleared by them.</li>
<li>Set up two lines at once rather than one: 30 points beats two times 10.</li>
<li>Protect your combo. A small clear that keeps the multiplier alive is often worth more than a big piece.</li>
<li>Give your rival the pieces that fit worst. The two you don't play are their next hand.</li>
<li>Late in the game, think about blocking: if your rival can't place anything, you get +25.</li>
<li>Long 1×5 bars are rescue pieces. Keep a free row or column for them.</li>
<li>Watch the clock in online games: running out of time loses the game.</li>
<li>Practice against the Pro bot with a score target before trying ranked.</li>
<li>Play the daily challenge every day: it's the fastest way to learn which shapes fit together.</li></ol>`,
    faq: [['Is Blockmate free?', 'Yes. Blockmate is free to play in any browser, on phone or computer, with no download.'], ['Can I play with a friend?', 'Yes. Open "Play a friend", create a link and send it, or play on the same screen.'], ['Do I need an account?', 'No. You start as a guest right away. Create an account to keep your progress on every device.']] },
  { slug: '2-player-block-puzzle', lang: 'en', alt: 'fr', title: '2 player block puzzle online, free in your browser · Blockmate', h1: 'The 2 player block puzzle',
    desc: 'Play a free 2 player block puzzle online: same board, turn by turn, against a friend, a real player or a bot. No download, works on phone and computer.',
    lead: 'Block puzzles are usually a solo game. Blockmate turns them into a duel: two players share one board, and each piece you place can open or ruin your opponent\'s next move.',
    body: `<h2>Why a duel changes everything</h2><p>In a classic block puzzle you only fight the board. In Blockmate you also fight a person. The pieces you don't use become your rival's hand, you see their next options, and you can block them to end the game. It plays like chess with blocks: easy to learn, hard to master.</p>
<h2>Ways to play with two players</h2><ul><li><b>Against a friend online</b>: create a game link in one click and send it on WhatsApp, Messenger or Discord. Your friend plays in their browser, no account needed.</li>
<li><b>On the same screen</b>: hand the phone back and forth, perfect for a break or a bus ride.</li>
<li><b>Against a stranger</b>: ranked matchmaking finds someone near your level in seconds.</li>
<li><b>Against a bot</b>: three levels when nobody is around.</li></ul>
<h2>Short, fair games</h2><p>Each player has a chess-style clock: 2:30, 5:00 or 7:30. You can also play to a score target: first to 100, 200 or 500 points wins. Games last between 3 and 15 minutes.</p>
<h2>Climb the ranking</h2><p>Ranked games use an Elo rating, like chess. Start in Bronze and climb to Master, and see where you stand in your country and worldwide.</p>`,
    faq: [['Is it really free?', 'Yes, every mode is free. Optional cosmetic items never change how the game plays.'], ['Does it work on mobile?', 'Yes. Blockmate runs in the browser on iPhone, Android, tablets and computers.']] },
  { slug: 'daily-challenge', lang: 'en', alt: 'fr', title: 'Daily block puzzle challenge: same pieces for everyone · Blockmate', h1: 'The daily block puzzle challenge',
    desc: 'One free block puzzle a day, with the same pieces for every player. One attempt, a daily leaderboard and a score to share with your friends.',
    lead: 'Every day at midnight (Paris time), Blockmate generates a new run of pieces. Everyone in the world gets exactly the same ones. You have one attempt to score as many points as possible before nothing fits.',
    body: `<h2>How it works</h2><ol><li>Open Blockmate and tap <b>Daily challenge</b>.</li><li>Place pieces on an empty 8×8 board and clear lines to score. Combos multiply your points.</li><li>When no piece fits, your run is over. Your score goes on today's leaderboard.</li><li>Share your result and see if your friends can beat it.</li></ol>
<h2>Rewards</h2><p>You earn 1 Blockcoin for every 10 points, up to 60 per day. Spend them on skins, glows, avatars and lobby themes.</p>
<h2>Why play every day</h2><p>Because everyone has the same pieces, the daily challenge is the purest test of skill: no luck in the draw, only your choices. It is also the best training for duels, as you learn which shapes leave the board open.</p>`,
    faq: [['When does the challenge reset?', 'Every day at midnight, Paris time.'], ['Can I retry?', 'No, you get one attempt per day. That keeps the leaderboard fair.']] },
  { slug: 'fr', lang: 'fr', alt: '2-player-block-puzzle', title: 'Jeu de blocs à deux en ligne, gratuit · Blockmate', h1: 'Le jeu de blocs en duel',
    desc: 'Blockmate : jeu de blocs gratuit à deux, en ligne ou sur le même écran. Partagez la grille avec votre adversaire, faites des lignes et des combos. Sans téléchargement.',
    lead: 'Vous aimez les jeux de blocs où l\'on remplit des lignes ? Blockmate en fait un duel : deux joueurs partagent la même grille et jouent chacun leur tour. Chaque pièce que vous posez vous rapporte des points… et change les options de votre adversaire.',
    body: `<h2>Comment jouer</h2><ol><li>À chaque tour, vous avez <b>trois pièces</b> et vous en posez <b>une</b> sur la grille commune de 8×8.</li><li>Une <b>ligne ou une colonne</b> complète disparaît et vous rapporte des points.</li><li>Les deux pièces que vous n'avez pas jouées partent chez votre adversaire.</li><li>La partie s'arrête quand quelqu'un ne peut plus rien poser. Le meilleur score gagne.</li></ol>
<p><a href="/guide/fr/regles">Voir toutes les règles et les astuces →</a></p>
<h2>Jouer avec un ami</h2><p>Créez un lien de partie en un clic et envoyez-le sur WhatsApp, Snapchat ou Discord. Votre ami joue directement dans son navigateur, sans compte ni téléchargement. Vous pouvez aussi jouer à deux sur le même téléphone.</p>
<h2>Classé comme aux échecs</h2><p>Les parties classées utilisent un classement Elo, comme aux échecs. Partez de Bronze et montez jusqu'à Master. Choisissez votre cadence : 2 min 30, 5 min ou 7 min 30 par joueur.</p>
<h2>Le défi du jour</h2><p>Chaque jour à minuit, une nouvelle série de pièces, la même pour tout le monde. Un seul essai, un classement du jour, et un score à partager.</p>`,
    faq: [['Blockmate est-il gratuit ?', 'Oui, tous les modes sont gratuits, sur téléphone comme sur ordinateur.'], ['Faut-il créer un compte ?', 'Non, vous jouez tout de suite en invité. Un compte permet de garder votre progression sur tous vos appareils.']] },
  { slug: 'fr/regles', lang: 'fr', alt: 'how-to-play', title: 'Règles de Blockmate : points, combos et astuces', h1: 'Les règles de Blockmate',
    desc: 'Les règles du jeu de blocs Blockmate en 2 minutes : grille partagée, lignes, combos, bonus de blocage, modes de jeu et 8 astuces pour gagner.',
    lead: 'Blockmate se joue à deux sur une seule grille de 8×8. Le but : marquer plus de points que votre adversaire en complétant des lignes, sans lui laisser la partie facile.',
    body: `<h2>Les règles</h2><ol><li>Chaque joueur reçoit <b>trois pièces</b> et en pose <b>une</b> où il veut, si elle rentre.</li><li>Une ligne ou une colonne pleine disparaît et rapporte des points. Plusieurs lignes d'un coup rapportent beaucoup plus.</li><li>Faire des lignes plusieurs tours d'affilée crée un <b>multiplicateur de combo</b>.</li><li>Les deux pièces non jouées vont à l'adversaire, avec une nouvelle pièce. Vous voyez toujours ses prochains choix.</li><li>Quand un joueur ne peut plus rien poser, la partie s'arrête : son adversaire gagne <b>+25 points de bonus</b>, et le meilleur score l'emporte.</li></ol>
<h2>Les points</h2><table><tr><th>Coup</th><th>Points</th></tr><tr><td>1 ligne</td><td>10</td></tr><tr><td>2 lignes d'un coup</td><td>30</td></tr><tr><td>3 lignes d'un coup</td><td>60</td></tr><tr><td>Combo 2 · 3 · 4</td><td>×1,25 · ×1,5 · ×1,75</td></tr><tr><td>L'adversaire ne peut plus jouer</td><td>+25</td></tr></table>
<h2>8 astuces pour gagner</h2><ol><li>Gardez le centre de la grille libre : c'est là que rentrent les grosses pièces.</li><li>Regardez les prochains choix de l'adversaire avant de poser.</li><li>Ne laissez pas une ligne à une pièce de la fin : il la finira à votre place.</li><li>Préparez deux lignes à la fois : 30 points valent mieux que deux fois 10.</li><li>Protégez votre combo, même avec une petite ligne.</li><li>Laissez-lui les pièces qui rentrent le moins bien.</li><li>En fin de partie, pensez au blocage : +25 points.</li><li>Entraînez-vous contre le bot Pro avant de jouer en classé.</li></ol>`,
    faq: [['Combien de temps dure une partie ?', 'Entre 3 et 15 minutes selon la cadence choisie (2 min 30, 5 min ou 7 min 30 par joueur).'], ['Peut-on jouer seul ?', 'Oui, contre trois bots de niveaux différents, ou au défi du jour.']] }
];

const NAV = { en: [['/', 'Play now'], ['/guide/how-to-play', 'How to play'], ['/guide/2-player-block-puzzle', '2 player'], ['/guide/daily-challenge', 'Daily challenge'], ['/guide/fr', 'Français']],
  fr: [['/', 'Jouer'], ['/guide/fr', 'Le jeu'], ['/guide/fr/regles', 'Règles'], ['/guide/how-to-play', 'English']] };

function page(p) {
  const url = `${SITE}/guide/${p.slug}`, altUrl = `${SITE}/guide/${p.alt}`;
  const ld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Blockmate', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: p.h1, item: url }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }];
  const cta = p.lang === 'fr' ? 'Jouer gratuitement' : 'Play free now';
  return `<!doctype html><html lang="${p.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.desc)}"><link rel="canonical" href="${url}">
<link rel="alternate" hreflang="${p.lang}" href="${url}"><link rel="alternate" hreflang="${p.lang === 'fr' ? 'en' : 'fr'}" href="${altUrl}">
<meta property="og:type" content="article"><meta property="og:title" content="${esc(p.title)}"><meta property="og:description" content="${esc(p.desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${SITE}/img/og.jpg"><meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#0E0918">
<meta name="google-adsense-account" content="ca-pub-6150811156400498">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6150811156400498" crossorigin="anonymous"></script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#0E0918;color:#E9E0FA;font:17px/1.65 system-ui,-apple-system,"Segoe UI",sans-serif}
header{display:flex;gap:6px 18px;flex-wrap:wrap;align-items:center;justify-content:center;padding:14px 16px;border-bottom:1px solid #2E2246}header a{color:#B9A9D6;text-decoration:none;font-size:15px}header a.logo{color:#fff;font-weight:800;letter-spacing:.04em;margin-right:auto}header a.logo b{color:#F2781C}
main{max-width:760px;margin:0 auto;padding:28px 16px 64px}h1{font-size:clamp(30px,6vw,42px);line-height:1.1;margin:8px 0 12px;color:#fff}h2{font-size:22px;margin:34px 0 8px;color:#fff}a{color:#FF9B3D}
.lead{font-size:19px;color:#D6CBEE}.cta{display:inline-block;margin:18px 0 6px;padding:14px 26px;border-radius:12px;background:linear-gradient(180deg,#FF9B3D,#F2781C);color:#1C0B00;font-weight:800;text-decoration:none;font-size:18px}
img{max-width:100%;height:auto;border-radius:12px;border:1px solid #2E2246;margin:18px 0}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #2E2246}th{color:#9C8DBB;font-size:14px}
li{margin:6px 0}.faq h3{font-size:17px;margin:18px 0 2px;color:#fff}footer{text-align:center;color:#7F70A1;font-size:14px;padding:24px 16px;border-top:1px solid #2E2246}footer a{color:#9C8DBB;margin:0 8px}</style></head>
<body><header><a class="logo" href="/">BLOCK<b>MATE</b></a>${NAV[p.lang].map(([h, l]) => `<a href="${h}">${l}</a>`).join('')}</header>
<main><h1>${p.h1}</h1><p class="lead">${p.lead}</p><a class="cta" href="/">${cta} →</a>
<img src="/img/shot-${(PAGES.indexOf(p) % 3) + 1}.jpg" width="1280" height="720" alt="${p.lang === 'fr' ? 'Une partie de Blockmate en cours : deux joueurs sur la même grille' : 'A Blockmate game in progress: two players on the same board'}" loading="lazy">
${p.body}
<section class="faq"><h2>${p.lang === 'fr' ? 'Questions fréquentes' : 'FAQ'}</h2>${p.faq.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join('')}</section>
<a class="cta" href="/">${cta} →</a></main>
<footer><a href="/legal/mentions">${p.lang === 'fr' ? 'Mentions légales' : 'Legal notice'}</a><a href="/legal/privacy">${p.lang === 'fr' ? 'Confidentialité' : 'Privacy'}</a><a href="/legal/cgv">${p.lang === 'fr' ? 'CGV' : 'Terms'}</a></footer></body></html>
`;
}
for (const p of PAGES) { const f = path.join(ROOT, 'public/guide', p.slug + '.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, page(p)); }
const today = new Date().toISOString().slice(0, 10);
const urls = [['/', '1.0', 'daily']].concat(PAGES.map(p => ['/guide/' + p.slug, '0.8', 'monthly']));
fs.writeFileSync(path.join(ROOT, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr, f]) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
console.log('built', PAGES.length, 'guide pages + sitemap.xml');
