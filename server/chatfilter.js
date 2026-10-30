// Chat moderation. Masks insults (mild ones like "nul", "bête", "con", "moche" stay allowed),
// racism and skin colour, religion, sex and sexuality. Threats block the whole message.
// French and English, with tricks like accents, leetspeak, stretched letters and spaced letters.

const EXACT = {
  insult: 'fdp ntm tg ptn pd pede pedes nik niq bitch bitches slut whore cunt fag fags faggot twat retard retarded mongol mongole gogol gogole triso trisomique autiste attarde attardee cassos bastard dickhead asshole motherfucker wanker pute putes salope salopes connard connards conard connasse conasse batard batards enfoire enfoiree ordure ordures petasse poufiasse grognasse pouffiasse tapette tarlouze tafiole fiotte merdeux trouduc encule enculee enculer enculé',
  race: 'noir noire noirs noires black blacks blanc blanche blancs blanches white whites renoi renois rebeu rebeus beur beurs beurette arabe arabes negre negres negresse negro negros nigga niggas nigger niggers nigg bamboula youpin youpins youtre chintok chintoks chinetoque bride bridee bridés niakoue toubab bougnoule bougnoul bicot raton feuj race racial raciste',
  religion: 'dieu dieux allah jesus christ islam islamique islamiste musulman musulmane musulmans juif juive juifs juives chretien chretienne chretiens catho cathos catholique protestant bouddha bouddhiste coran bible torah mosquee eglise synagogue religion religieux athee hindou sikh god gods jew jews jewish muslim muslims christian christians church quran imam rabbin pretre pape prophete mahomet mohammed muhammad inshallah wallah wallay',
  sex: 'sexe sex sexy sexuel sexuelle bite bites chatte cul culs seins nichon nichons baise baiser baiseur niquer nique suce sucer sucez porn porno porne gay gays lesbienne lesbiennes lesbian lesbians homo homos homosexuel homosexuelle trans travelo travlo queer hetero heterosexuel fuck fucking fucker dick dicks pussy cock boobs tits nude nudes horny cum penis vagin zizi teub zob bander branleur branlette sodomie bisexuel bi',
  threat: 'tuer tue tuerai tuerais tuera crever creve crevez meurs mourir buter egorger egorge viol violer viole violee violeur suicide suicider suicide kys kill killed killing die dies murder terroriste terrorisme terroristes nazi nazis hitler kkk daech daesh isis'
};
// Stems: any word starting with these (stretched or conjugated forms).
const STEMS = {
  insult: ['connar', 'conar', 'conass', 'salop', 'putain', 'encul', 'batar', 'enfoir', 'petass', 'poufias', 'motherfuck', 'tarlouz', 'tafiol'],
  race: ['nigg', 'negr', 'bougnoul', 'chinetok', 'youpin'],
  sex: ['homosex', 'heterosex', 'sodom', 'branl', 'pornog', 'lesbi', 'fuck'],
  threat: ['egorg', 'suicid', 'terroris', 'decapit']
};
const PHRASES = ['ta mere', 'ta race', 'ta gueule', 'ferme ta gueule', 'nique ta', 'niquer ta', 'fils de', 'pends toi', 'va te pendre', 'va mourir', 'kill yourself', 'kill urself', 'go die', 'je sais ou tu habites', 'i know where you live', 'je vais te tuer', 'je te tue', 'je vais te buter'];
const THREAT_CATS = new Set(['threat']);

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '€': 'e', '!': 'i', '|': 'i' };
const fold = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[013457@$€!|8]/g, c => LEET[c]).replace(/(.)\1{2,}/g, '$1$1');
const word = s => fold(s).replace(/[^a-z]/g, '');

const exact = new Map();
for (const [cat, list] of Object.entries(EXACT)) for (const w of list.split(/\s+/)) { const k = word(w); if (k) exact.set(k, cat); }
function categoryOf(w) {
  if (!w) return null;
  const v2 = w.replace(/([aeiouy])\1/g, '$1'); const variants = [w, v2, w.replace(/s$/, ''), v2.replace(/s$/, '')];
  for (const v of variants) if (exact.has(v)) return exact.get(v);
  for (const [cat, stems] of Object.entries(STEMS)) for (const st of stems) if (w.startsWith(st) || v2.startsWith(st)) return cat;
  return null;
}

// Returns { text, blocked, changed }.
function clean(input) {
  const raw = String(input || '').replace(new RegExp('[\\u0000-\\u001f\\u200b-\\u200f\\u2028-\\u202e]', 'g'), ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  const flat = ' ' + fold(raw).replace(/[^a-z]+/g, ' ').trim() + ' ';
  for (const p of PHRASES) if (flat.includes(' ' + p + ' ') || flat.replace(/ /g, '').includes(p.replace(/ /g, '')) && p.length > 9) return { text: '', blocked: true, changed: true };
  const parts = raw.split(/(\s+)/); const words = parts.map(p => /\s/.test(p) ? null : word(p));
  const mask = new Array(parts.length).fill(false); let threat = false;
  words.forEach((w, i) => { const c = categoryOf(w); if (c) { mask[i] = true; if (THREAT_CATS.has(c)) threat = true; } });
  // Spaced-out letters: "f d p", "n.t.m"
  for (let i = 0; i < parts.length; i++) {
    if (words[i] == null || words[i].length !== 1) continue;
    let j = i, joined = ''; const idx = [];
    while (j < parts.length && (words[j] == null || words[j].length === 1)) { if (words[j] != null) { joined += words[j]; idx.push(j); } j++; }
    if (idx.length >= 2) { const c = categoryOf(joined); if (c) { idx.forEach(k => mask[k] = true); if (THREAT_CATS.has(c)) threat = true; } }
    i = j;
  }
  // Words glued together: "fdpnul", "tamere"
  const glued = flat.replace(/ /g, '');
  if (!threat && /(tamere|tagueule|niquetamere|filsdepute|killyourself)/.test(glued)) return { text: '', blocked: true, changed: true };
  if (threat) return { text: '', blocked: true, changed: true };
  const changed = mask.some(Boolean);
  return { text: parts.map((p, i) => mask[i] ? '•'.repeat(Math.min(6, Math.max(3, p.length))) : p).join(''), blocked: false, changed };
}

const NAME_OK = new Set(['noir', 'noire', 'blanc', 'race', 'black', 'white', 'bride', 'trans', 'homo', 'kill', 'tuer', 'nude']);
// Usernames: stricter, since words are glued ("Connard93", "xX_pute_Xx").
function nameOk(name) {
  const w = word(String(name).replace(/_/g, ' '));
  for (const piece of String(name).split(/[_\d\s]+/)) if (categoryOf(word(piece))) return false;
  for (const [k, cat] of exact) if (k.length >= 4 && w.includes(k) && cat !== 'religion' && !NAME_OK.has(k)) return false;
  for (const stems of Object.values(STEMS)) for (const st of stems) if (w.includes(st)) return false;
  return true;
}
module.exports = { clean, nameOk };
