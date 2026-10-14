export const THRESHOLD = 2200;
export const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

export const round10 = v => Math.round(v / 10) * 10;
export const fmt = v => Math.round(v).toLocaleString("fr-FR");

export const DEFAULT_FIXED = [
  { id: "spotify",   label: "Spotify",        icon: "🎵", amount: 70,  color: "#1DB954", deletable: false },
  { id: "sport",     label: "Salle de sport", icon: "🥊", amount: 250, color: "#4CAF7D", deletable: false },
  { id: "transport", label: "Transport",      icon: "🚗", amount: 400, color: "#7B8CDE", deletable: false },
];

export const VAR_CATS = [
  { id: "epargne",  label: "Épargne",           icon: "🏦", color: "#C9A84C", std: 0.27, red: 0.18 },
  { id: "food",     label: "Nourriture / Cafés", icon: "🍽️", color: "#E07B4C", std: 0.20, red: 0.32 },
  { id: "divers",   label: "Imprévus",           icon: "🔧", color: "#8888AA", std: 0.13, red: 0.18 },
  { id: "devperso", label: "Dev perso",           icon: "📚", color: "#9B59B6", std: 0.10, red: 0.10 },
  { id: "sorties",  label: "Sorties / Amie",     icon: "🎯", color: "#E05599", std: 0.30, red: 0.22 },
];

// Catégories qui reçoivent la redistribution (hors épargne)
export const REDIST_CATS = VAR_CATS.filter(c => c.id !== "epargne");

export const PALETTE = ["#E05555","#E07B4C","#C9A84C","#4CAF7D","#7B8CDE","#E05599","#9B59B6","#1DB954","#8888AA"];
export const SOURCE_ICONS = { "inDrive":"🚗", "Trading":"📈", "Freelance":"💻", "Autre":"💸" };

// ─── Calcul redistribution revenu externe ────────────────────────────────────
export function computeExternal(externalRevenues, isReduced) {
  const total = externalRevenues.reduce((s, r) => s + r.amount, 0);
  const toEpargne = round10(total * 0.5);
  const toRedist  = round10(total - toEpargne);

  // Poids normalisés des catégories hors épargne
  const weights = REDIST_CATS.map(c => isReduced ? c.red : c.std);
  const sumW    = weights.reduce((s, w) => s + w, 0);

  // La dernière catégorie prend le reste pour que la somme tombe juste malgré les arrondis
  const redistMap = {};
  let given = 0;
  REDIST_CATS.forEach((c, i) => {
    const share = i === REDIST_CATS.length - 1
      ? toRedist - given
      : round10(toRedist * (weights[i] / sumW));
    redistMap[c.id] = share;
    given += share;
  });
  redistMap["epargne"] = toEpargne;

  return { total, toEpargne, toRedist, redistMap };
}

// ─── Toutes les valeurs dérivées d'un mois ───────────────────────────────────
export function computeMonth({ income, fixedCustom, expenses, externalRevenues }) {
  const isReduced  = income < THRESHOLD;
  const allFixed   = [...DEFAULT_FIXED, ...fixedCustom];
  const totalFixed = allFixed.reduce((s, f) => s + f.amount, 0);
  const available  = Math.max(income - totalFixed, 0);

  const varBudgets = VAR_CATS.map(c => ({
    ...c,
    budget: round10(available * (isReduced ? c.red : c.std)),
  }));

  const ext = computeExternal(externalRevenues, isReduced);

  // Budget effectif = budget de base + bonus externe
  const allCats = [
    ...allFixed.map(f => ({ ...f, type:"fixed", budget:f.amount, bonus:0 })),
    ...varBudgets.map(v => ({
      ...v, type:"variable",
      bonus: ext.redistMap[v.id] || 0,
      budget: v.budget + (ext.redistMap[v.id] || 0),
    })),
  ];

  const spentMap = Object.fromEntries(allCats.map(c => [c.id, 0]));
  for (const e of expenses) spentMap[e.catId] = (spentMap[e.catId] || 0) + e.amount;

  const totalBudget = allCats.reduce((s, c) => s + c.budget, 0);
  const totalSpent  = Object.values(spentMap).reduce((s, v) => s + v, 0);
  const totalIncome = income + ext.total;

  return {
    isReduced, allFixed, totalFixed, available, varBudgets, allCats, spentMap,
    totalBudget, totalSpent, totalIncome,
    restant: totalIncome - totalSpent,
    extTotal: ext.total, toEpargne: ext.toEpargne, toRedist: ext.toRedist, redistMap: ext.redistMap,
  };
}
