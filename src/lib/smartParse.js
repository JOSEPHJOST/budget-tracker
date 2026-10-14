// Saisie rapide en langage naturel : "45 café avec Sara" → { amount: 45, note: "café avec Sara", catId: "food" }
// La catégorie est devinée d'abord depuis ce que l'utilisateur a déjà saisi
// (apprentissage local), puis depuis un dictionnaire de mots-clés.

const KEYWORDS = {
  food: ["cafe","café","coffee","resto","restaurant","tacos","pizza","burger","sandwich","dejeuner","déjeuner",
    "diner","dîner","lunch","petit-dej","courses","marjane","carrefour","bim","acima","supermarche","supermarché",
    "glovo","snack","boulangerie","patisserie","pâtisserie","sushi","kfc","mcdo","starbucks","jus"],
  sorties: ["cinema","cinéma","ciné","bar","sortie","soiree","soirée","concert","bowling","cadeau","fleurs",
    "amie","date","match","stade","plage","club","karting","escape","jeu","jeux","voyage"],
  devperso: ["livre","livres","cours","formation","udemy","coursera","bootcamp","certif","certification",
    "atelier","conference","conférence","abonnement","kindle","ebook","domaine","hebergement","hébergement"],
  divers: ["pharmacie","medecin","médecin","docteur","dentiste","reparation","réparation","telephone","téléphone",
    "recharge","coiffeur","coiffure","vetement","vêtement","vetements","vêtements","chaussures","pressing",
    "facture","amende","imprevu","imprévu","banque","lessive","menage","ménage"],
  transport: ["taxi","indrive","careem","uber","essence","carburant","gasoil","tram","tramway","bus","train",
    "oncf","parking","peage","péage","vidange","autoroute"],
  sport: ["salle","gym","fitness","boxe","proteine","protéine","whey","creatine","créatine","coach"],
  spotify: ["spotify","musique"],
  epargne: ["epargne","épargne","economie","économie","virement","livret","placement","investissement"],
};

const strip = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Mots outils ignorés : ils ne disent rien de la catégorie et pollueraient l'apprentissage
const STOPWORDS = new Set(["le","la","les","un","une","des","du","de","et","ou","avec","pour","chez","au","aux",
  "en","sur","par","mon","ma","mes","ton","ta","son","sa","ce","cette","the","and","for","with"]);

export const tokenize = text =>
  strip(text).split(/[^a-z0-9-]+/).filter(w => w.length >= 2 && !/^\d+$/.test(w) && !STOPWORDS.has(w));

// Dictionnaire normalisé (sans accents) construit une fois
const KEYWORD_INDEX = Object.entries(KEYWORDS).reduce((acc, [catId, words]) => {
  for (const w of words) acc[strip(w)] = catId;
  return acc;
}, {});

/** Extrait le premier nombre du texte (accepte 12,5 / 12.5 / 1 200). */
export function parseAmount(text) {
  const m = text.match(/(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,](\d{1,2}))?/);
  if (!m) return null;
  const whole = m[1].replace(/[ \u00a0]/g, "");
  const value = Number(m[2] ? `${whole}.${m[2]}` : whole);
  return value > 0 ? { value, match: m[0] } : null;
}

/**
 * @param {string} text
 * @param {Record<string, Record<string, number>>} learned  mot → { catId: nombre d'occurrences }
 * @param {string[]} validCatIds  catégories existantes ce mois-ci
 */
export function parseQuickEntry(text, learned = {}, validCatIds = []) {
  const amount = parseAmount(text);
  const note = (amount ? text.replace(amount.match, " ") : text)
    .replace(/\b(mad|dh|dhs|dirhams?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const valid = new Set(validCatIds);
  const scores = {};
  const fromHistory = {};

  for (const w of tokenize(note)) {
    for (const [catId, n] of Object.entries(learned[w] || {})) {
      if (!valid.has(catId)) continue;
      // L'historique personnel pèse plus lourd que le dictionnaire générique
      scores[catId] = (scores[catId] || 0) + 3 * n;
      fromHistory[catId] = true;
    }
    const kw = KEYWORD_INDEX[w];
    if (kw && valid.has(kw)) {
      scores[kw] = (scores[kw] || 0) + 2;
    }
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return {
    amount: amount?.value ?? null,
    note,
    catId: best ? best[0] : null,
    source: best ? (fromHistory[best[0]] ? "learned" : "keyword") : null,
  };
}

/** Retourne une nouvelle table d'apprentissage enrichie d'une dépense confirmée. */
export function learn(learned, note, catId) {
  const next = { ...learned };
  for (const w of new Set(tokenize(note || ""))) {
    next[w] = { ...(next[w] || {}), [catId]: ((next[w] || {})[catId] || 0) + 1 };
  }
  return next;
}
