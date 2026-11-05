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
    faq: [['Combien de temps dure une partie ?', 'Entre 3 et 15 minutes selon la cadence choisie (2 min 30, 5 min ou 7 min 30 par joueur).'], ['Peut-on jouer seul ?', 'Oui, contre trois bots de niveaux différents, ou au défi du jour.']] },
  { slug: 'advanced-strategy', lang: 'en', alt: 'fr/strategie', title: 'Blockmate advanced strategy: how to beat stronger players', h1: 'Advanced Blockmate strategy',
    desc: 'Go beyond the basics: tempo, board parity, hand control, combo management and endgame blocking. A practical guide to winning more Blockmate duels.',
    lead: 'Once you know the rules, Blockmate becomes a game of planning. Strong players don\'t just look for the biggest clear: they think about what their move leaves for the opponent. Here are the ideas that separate a Gold player from a Master.',
    body: `<h2>1. Every move is also a gift</h2><p>The two pieces you don't play become your rival's hand. Before you place, ask two questions: which of my three pieces scores best for me, and which two pieces are worst for my opponent on the board I'm about to leave? Often the second question matters more. Keeping an awkward 3×3 square or an L for your rival on a crowded board can win the game on its own.</p>
<h2>2. Read the next choices</h2><p>The "next choices" row shows exactly what your opponent will hold. If they will get a long 1×5 bar and you leave a row with five free cells in a line, you have just handed them a clear. Close those gaps, or leave them only when the piece they get can't fill them.</p>
<h2>3. Two-line setups</h2><p>One line scores 10, two lines at once score 30, three score 60. The jump is huge, so it often pays to build two almost-full lines that cross the same empty cells, then finish both with one piece. The danger: a half-built double is a gift if your rival can finish it first. Build doubles where only shapes you hold can complete them.</p>
<h2>4. Protect the combo</h2><p>Clearing on consecutive turns raises your multiplier: ×1.25, then ×1.5, then ×1.75. A small single clear that keeps the combo alive is worth more than it looks, because it boosts the big clear you are preparing. When your combo is high, keep at least one "easy" line ready for the next turn.</p>
<h2>5. Keep the centre open</h2><p>Big pieces (3×3 squares, long bars, large L shapes) need open space. Fill the edges and corners first with small pieces, and keep the middle of the board breathing. A board with a clean centre gives you options; a fragmented one gives you none.</p>
<h2>6. Play for the block in the endgame</h2><p>When the board is nearly full, scoring gets hard and blocking becomes the real game. If your rival can't place any of their pieces, the game ends and you get +25. Look at their next choices and leave a board where none of them fit. Count it out: when you are ahead, a block wins; when you are behind, you need the clears more than the block.</p>
<h2>7. Manage the clock</h2><p>In timed games, don't spend your time on easy moves. Play the obvious opening placements quickly and save your minutes for the crowded middle game and the endgame, where one mistake decides the result.</p>`,
    faq: [['What is the most common mistake?', 'Leaving a line one piece away from being cleared, with that exact piece in the rival\'s next choices.'], ['How do I train?', 'Play the Master bot in Practice with a score target of 200, and play the daily challenge every day to learn which shapes fit together.']] },
  { slug: 'elo-rating', lang: 'en', alt: null, title: 'How the Blockmate Elo rating works: ranks, points and tiers', h1: 'How the Elo rating works',
    desc: 'Blockmate uses the Elo rating system from chess. How many points you win or lose, why beating a stronger player is worth more, and the tiers from Bronze to Master.',
    lead: 'Every ranked game in Blockmate changes your Elo rating, the same system chess has used for decades to rank players. It measures your level against everyone else\'s, and it rewards upsets.',
    body: `<h2>Where Elo comes from</h2><p>The system was designed by Arpad Elo, a physics professor and chess master, and adopted by the United States Chess Federation in 1960 and by the World Chess Federation (FIDE) in 1970. Today it is used in chess, in many online games and even in sports rankings.</p>
<h2>The idea in one sentence</h2><p>Before each game, the system predicts how likely you are to win from the difference between the two ratings. If you do better than predicted, you gain points; if you do worse, you lose them.</p>
<h2>The formula</h2><p>Your expected score against an opponent is <b>E = 1 / (1 + 10<sup>(R<sub>opponent</sub> − R<sub>you</sub>) / 400</sup>)</b>. After the game, your new rating is your old rating plus <b>K × (result − E)</b>, where the result is 1 for a win, 0.5 for a draw and 0 for a loss. Blockmate uses K = 32.</p>
<table><tr><th>Situation</th><th>Win</th><th>Loss</th></tr><tr><td>Same rating</td><td>+16</td><td>−16</td></tr><tr><td>Opponent 200 points higher</td><td>about +24</td><td>about −8</td></tr><tr><td>Opponent 200 points lower</td><td>about +8</td><td>about −24</td></tr></table>
<p>That is why beating a stronger player is worth a lot, and losing to a weaker one costs a lot.</p>
<h2>Blockmate tiers</h2><table><tr><th>Tier</th><th>Elo</th></tr><tr><td>Bronze</td><td>below 1000</td></tr><tr><td>Silver</td><td>1000 to 1199</td></tr><tr><td>Gold</td><td>1200 to 1399</td></tr><tr><td>Platinum</td><td>1400 to 1599</td></tr><tr><td>Diamond</td><td>1600 to 1799</td></tr><tr><td>Master</td><td>1800 and above</td></tr></table>
<p>Every player starts at 1200, in Gold. Ranked games against the bots also count: the Rookie bot is rated 800, Pro 1200 and Master 1600.</p>
<h2>What does not change your Elo</h2><p>Practice games, games against a friend and the daily challenge never change your rating. Only ranked games against bots and online ranked matches do.</p>`,
    faq: [['Why did I lose more points than I won?', 'Because your opponent was rated lower than you: the system expected you to win, so a loss costs more.'], ['Can my rating go below zero?', 'No. Blockmate keeps every rating at 100 or more.']] },
  { slug: 'history-of-block-puzzles', lang: 'en', alt: null, title: 'A short history of block puzzle games, from pentominoes to duels', h1: 'A short history of block puzzles',
    desc: 'From the pentominoes of the 1950s to Tetris and the modern grid puzzles on phones: how block puzzle games evolved, and why Blockmate turns them into a duel.',
    lead: 'Fitting shapes into a grid is one of the oldest puzzle ideas there is. Here is how it went from a mathematician\'s notebook to one of the most played game genres in the world.',
    body: `<h2>Polyominoes, 1950s</h2><p>In 1953 the American mathematician Solomon Golomb named and studied "polyominoes": shapes made of squares joined edge to edge. The twelve pentominoes, made of five squares each, became a classic recreational puzzle, popularised in the 1950s and 1960s through puzzle columns and books. Almost every piece you place in a modern block puzzle is a polyomino.</p>
<h2>Tetris, 1984</h2><p>Soviet engineer Alexey Pajitnov created Tetris in 1984, using four-square pieces (tetrominoes) that fall into a well. Clearing full rows to make room became one of the most recognisable mechanics in video game history.</p>
<h2>Grid puzzles without gravity, 2010s</h2><p>On smartphones, a new family appeared: no falling pieces, no timer, just a square grid and a few shapes to place wherever they fit. Full rows and columns disappear, and the game ends when nothing fits. 1010!, released in 2014, made the format hugely popular, and many games followed with wooden boards, sudoku-style regions or bigger grids.</p>
<h2>Why these games work</h2><p>They are easy to learn in seconds, they reward planning without demanding fast reflexes, and every clear gives a small, satisfying reward. A game can last one minute or thirty, which makes them perfect for a break.</p>
<h2>The next step: playing against someone</h2><p>Almost all of these games are solo: you against the board. Blockmate asks a different question: what if two players shared the same grid? Suddenly each piece you place also shapes your opponent's options, the pieces you skip become their hand, and you can win by leaving them no room. The puzzle becomes a strategy duel, closer to chess than to a high-score chase.</p>`,
    faq: [['What is a polyomino?', 'A shape made of squares joined edge to edge, like the pieces of a block puzzle.'], ['Is Blockmate like Tetris?', 'Not quite: pieces don\'t fall and there is no rush. You place them freely on a shared 8×8 board, turn by turn, against an opponent.']] },
  { slug: 'game-modes', lang: 'en', alt: null, title: 'Blockmate game modes: bots, ranked, friends, same screen and daily', h1: 'All Blockmate game modes',
    desc: 'Every way to play Blockmate: solo against three bots, online ranked, friend duels with a link, two players on one screen, and the daily challenge.',
    lead: 'Blockmate has five ways to play. Here is what each one is for, how long a game lasts, and what it changes for your rating and your Blockcoins.',
    body: `<h2>Solo vs bots</h2><p>Three bots with different styles: <b>Rookie</b> (rated 800) plays almost at random and is perfect to learn; <b>Pro</b> (1200) always takes the most points it can; <b>Master</b> (1600) reads your next move and tries to block you. In <b>Ranked</b>, your Elo moves and you can win or lose Blockcoins earned by playing. In <b>Practice</b>, nothing is at risk and you can set a score target (first to 100, 200 or 500 points) or a clock.</p>
<h2>Online ranked</h2><p>Matchmaking finds a real player near your rating. Choose the speed: 2:30, 5:00 or 7:30 on each player's clock. Classic rules apply: the game ends when someone is stuck, and the highest score wins. A win gives Elo and Blockcoins; a loss costs some.</p>
<h2>Play a friend</h2><p>Create a game link and send it, or challenge a friend who is online. You choose the speed, the win condition and an optional bet of Blockcoins earned by playing. Friend games never change your Elo.</p>
<h2>Same screen</h2><p>Two players take turns on one phone or computer. Perfect for a break, a party or teaching a friend.</p>
<h2>Daily challenge</h2><p>A solo run with the same pieces for everyone in the world, renewed every day at midnight (Paris time). One attempt, one leaderboard, and up to 60 Blockcoins.</p>
<h2>Rewards for everyone</h2><p>A daily login reward grows over a 7-day streak. Blockcoins unlock skins, glows, avatars and lobby themes. These items only change how the game looks, never how it plays.</p>`,
    faq: [['Which mode should I start with?', 'Practice against the Rookie bot, then the Pro bot, before trying ranked.'], ['How long is a game?', 'Between 3 and 15 minutes depending on the speed you choose.']] },
  { slug: 'fr/strategie', lang: 'fr', alt: 'advanced-strategy', title: 'Stratégie avancée Blockmate : comment battre des joueurs plus forts', h1: 'Stratégie avancée',
    desc: 'Au-delà des bases : contrôler la main de l\'adversaire, préparer les doubles lignes, protéger son combo et bloquer en fin de partie. Le guide pour gagner plus de duels.',
    lead: 'Une fois les règles comprises, Blockmate devient un jeu de planification. Les bons joueurs ne cherchent pas seulement la plus grosse ligne : ils pensent à ce que leur coup laisse à l\'adversaire.',
    body: `<h2>1. Chaque coup est aussi un cadeau</h2><p>Les deux pièces que vous ne jouez pas deviennent la main de votre adversaire. Avant de poser, demandez-vous quelle pièce vous rapporte le plus, mais aussi quelles deux pièces seront les pires pour lui sur la grille que vous lui laissez.</p>
<h2>2. Lisez ses prochains choix</h2><p>La rangée « prochains choix » montre exactement ce qu'il aura en main. S'il reçoit une barre de 5 et que vous laissez une ligne avec 5 cases libres alignées, vous lui offrez des points.</p>
<h2>3. Préparez les doubles lignes</h2><p>Une ligne rapporte 10 points, deux lignes d'un coup 30, trois 60. Construisez deux lignes presque pleines qui se croisent sur les mêmes cases vides, puis finissez-les avec une seule pièce. Attention : une double à moitié construite est un cadeau si l'adversaire peut la finir avant vous.</p>
<h2>4. Protégez votre combo</h2><p>Faire des lignes plusieurs tours de suite fait monter le multiplicateur (×1,25, ×1,5, ×1,75). Une petite ligne qui garde le combo vaut souvent plus qu'elle n'en a l'air.</p>
<h2>5. Gardez le centre libre</h2><p>Les grosses pièces ont besoin d'espace. Remplissez d'abord les bords et les coins avec les petites pièces.</p>
<h2>6. Pensez au blocage en fin de partie</h2><p>Quand la grille est presque pleine, le vrai jeu devient le blocage : si l'adversaire ne peut plus rien poser, la partie s'arrête et vous gagnez 25 points de bonus. Quand vous menez, un blocage suffit à gagner.</p>`,
    faq: [['Quelle est l\'erreur la plus fréquente ?', 'Laisser une ligne à une pièce de la fin, alors que cette pièce est justement dans les prochains choix de l\'adversaire.'], ['Comment progresser ?', 'Jouez contre le bot Master en entraînement avec un objectif de 200 points, et faites le défi du jour chaque jour.']] },
  { slug: 'about', lang: 'en', alt: null, title: 'About Blockmate: who makes the block puzzle duel', h1: 'About Blockmate',
    desc: 'Blockmate is an independent block puzzle duel made in France by David Chokron, a business student and independent web developer.',
    lead: 'Blockmate is an independent game, designed and developed in France. It started with a simple question: block puzzles are fun alone, so what happens when two people share the same board?',
    body: `<h2>Who makes it</h2><p>Blockmate is made by David Chokron, a business student at EDHEC Business School and an independent web developer based in Nice, France. It is developed and run as a small independent business, with no publisher and no investors.</p>
<h2>What we care about</h2><ul><li><b>Fair play</b>: every ranked game is checked on the server, so results can't be faked.</li><li><b>Free for everyone</b>: every mode is free. Optional cosmetic items never change how the game plays.</li><li><b>Respect</b>: the in-game chat filters insults and threats, and players can mute anyone.</li><li><b>Privacy</b>: no account is needed to play, and we collect only what the game needs. See our <a href="/legal/privacy">privacy policy</a>.</li></ul>
<h2>How the game is built</h2><p>Blockmate runs entirely in the browser, with no download. The game rules run both on your device and on our server, which replays every ranked game to make sure it is valid. Online matches are played live over a secure connection.</p>
<h2>Get in touch</h2><p>Ideas, bug reports, partnership requests: see the <a href="/guide/contact">contact page</a>.</p>`,
    faq: [['Is Blockmate made by a big studio?', 'No. It is an independent game made by one developer in France.'], ['How is Blockmate funded?', 'By optional cosmetic purchases and, in the future, advertising. The game itself stays free.']] },
  { slug: 'contact', lang: 'en', alt: null, title: 'Contact Blockmate', h1: 'Contact',
    desc: 'Contact the Blockmate team: questions, bug reports, account help, partnerships and press.',
    lead: 'We read every message. Write to us in English or French.',
    body: `<h2>Email</h2><p><b>contact@dbcblockmate.com</b></p>
<h2>What to include</h2><ul><li><b>Bug report</b>: what you were doing, what happened, and your device and browser (for example "iPhone 14, Safari").</li><li><b>Account help</b>: your Blockmate username. Never send your password.</li><li><b>Partnerships and press</b>: who you are and what you have in mind.</li></ul>
<h2>Response time</h2><p>We usually answer within a few days.</p>
<h2>Legal information</h2><p>Blockmate is published by David Chokron, entrepreneur individuel, Nice, France. Full details are in the <a href="/legal/mentions">legal notice</a>.</p>`,
    faq: [['I lost access to my account, what can I do?', 'Write to contact@dbcblockmate.com from the email address linked to your account, with your username.'], ['Can I suggest a feature?', 'Yes, we love ideas. Send them by email.']] },
  { slug: 'index', lang: 'en', alt: null, title: 'Blockmate guides: rules, strategy, modes and more', h1: 'Blockmate guides',
    desc: 'Every Blockmate guide in one place: how to play, advanced strategy, Elo rating, game modes, daily challenge and the history of block puzzles.',
    lead: 'Everything you need to learn Blockmate, improve and climb the ranking.',
    body: '%%INDEX%%',
    faq: [['Where do I start?', 'Read "How to play", then try a Practice game against the Rookie bot.']] }
];

const NAV = { en: [['/', 'Play now'], ['/guide/how-to-play', 'How to play'], ['/guide/advanced-strategy', 'Strategy'], ['/guide', 'All guides'], ['/guide/fr', 'Français']],
  fr: [['/', 'Jouer'], ['/guide/fr', 'Le jeu'], ['/guide/fr/regles', 'Règles'], ['/guide/fr/strategie', 'Stratégie'], ['/guide', 'English']] };

function indexBody() {
  const groups = [['Learn', ['how-to-play', 'game-modes', 'daily-challenge']], ['Improve', ['advanced-strategy', 'elo-rating']], ['Discover', ['2-player-block-puzzle', 'history-of-block-puzzles', 'about', 'contact']], ['En français', ['fr', 'fr/regles', 'fr/strategie']]];
  return groups.map(([g, list]) => `<h2>${g}</h2><ul>${list.map(sl => { const q = PAGES.find(x => x.slug === sl); return `<li><a href="/guide/${sl}"><b>${q.h1}</b></a><br>${q.desc}</li>`; }).join('')}</ul>`).join('');
}
function page(p) {
  const url = p.slug === 'index' ? `${SITE}/guide` : `${SITE}/guide/${p.slug}`, altUrl = p.alt ? `${SITE}/guide/${p.alt}` : null;
  const ld = [{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Blockmate', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: p.h1, item: url }] },
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: p.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }];
  const cta = p.lang === 'fr' ? 'Jouer gratuitement' : 'Play free now';
  return `<!doctype html><html lang="${p.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(p.title)}</title><meta name="description" content="${esc(p.desc)}"><link rel="canonical" href="${url}">
${altUrl ? `<link rel="alternate" hreflang="${p.lang}" href="${url}"><link rel="alternate" hreflang="${p.lang === 'fr' ? 'en' : 'fr'}" href="${altUrl}">` : ''}
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
${p.body === '%%INDEX%%' ? indexBody() : p.body}
<section class="faq"><h2>${p.lang === 'fr' ? 'Questions fréquentes' : 'FAQ'}</h2>${p.faq.map(([q, a]) => `<h3>${q}</h3><p>${a}</p>`).join('')}</section>
<a class="cta" href="/">${cta} →</a></main>
<footer><a href="/guide/about">${p.lang === 'fr' ? 'À propos' : 'About'}</a><a href="/guide/contact">Contact</a><a href="/guide">${p.lang === 'fr' ? 'Tous les guides' : 'All guides'}</a><a href="/legal/mentions">${p.lang === 'fr' ? 'Mentions légales' : 'Legal notice'}</a><a href="/legal/privacy">${p.lang === 'fr' ? 'Confidentialité' : 'Privacy'}</a><a href="/legal/cgv">${p.lang === 'fr' ? 'CGV' : 'Terms'}</a></footer></body></html>
`;
}
for (const p of PAGES) { const f = path.join(ROOT, 'public/guide', p.slug + '.html'); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, page(p)); }
const today = new Date().toISOString().slice(0, 10);
const urls = [['/', '1.0', 'daily']].concat(PAGES.map(p => [p.slug === 'index' ? '/guide' : '/guide/' + p.slug, p.slug === 'index' ? '0.9' : '0.8', 'monthly']));
fs.writeFileSync(path.join(ROOT, 'public/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(([u, pr, f]) => `  <url><loc>${SITE}${u}</loc><lastmod>${today}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join('\n')}\n</urlset>\n`);
console.log('built', PAGES.length, 'guide pages + sitemap.xml');
