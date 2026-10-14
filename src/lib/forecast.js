// Prévisions de fin de mois à partir du rythme de dépense actuel.
// Seules les catégories variables "dépensables" sont projetées : les charges fixes
// sont ponctuelles et l'épargne n'est pas une dépense de consommation.

export const MIN_DAYS_FOR_PACE = 5; // en dessous, une seule grosse dépense fausse tout

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export function periodOf(year, month, today) {
  const cur = today.getFullYear() * 12 + today.getMonth();
  const sel = year * 12 + month;
  return sel < cur ? "past" : sel > cur ? "future" : "current";
}

export function spendableCats(allCats) {
  return allCats.filter(c => c.type === "variable" && c.id !== "epargne");
}

export function computeForecast({ allCats, spentMap, expenses, year, month, today = new Date() }) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const period = periodOf(year, month, today);
  const day = period === "current" ? today.getDate() : period === "past" ? daysInMonth : 0;
  const daysLeft = period === "current" ? daysInMonth - day + 1 : period === "future" ? daysInMonth : 0;

  const cats = spendableCats(allCats);
  const catIds = new Set(cats.map(c => c.id));

  const remaining = cats.reduce((s, c) => s + Math.max(c.budget - (spentMap[c.id] || 0), 0), 0);
  const spentToday = period === "current"
    ? expenses.filter(e => catIds.has(e.catId) && sameDay(new Date(e.date), today)).reduce((s, e) => s + e.amount, 0)
    : 0;

  // Enveloppe du jour calculée comme si aujourd'hui n'avait pas encore commencé,
  // pour que ce qu'on dépense aujourd'hui vienne en déduction.
  const dailyAllowance = daysLeft > 0 ? (remaining + spentToday) / daysLeft : 0;
  const leftToday = dailyAllowance - spentToday;

  const paceReliable = period === "past" || (period === "current" && day >= MIN_DAYS_FOR_PACE);

  const perCat = cats.map(c => {
    const spent = spentMap[c.id] || 0;
    const rate = day > 0 ? spent / day : 0;
    const projected = paceReliable ? rate * daysInMonth : null;
    let status = "ok";
    let overrunDay = null;
    if (spent > c.budget) status = "over";
    else if (paceReliable && projected > c.budget && rate > 0) {
      status = "risk";
      overrunDay = Math.min(Math.ceil(c.budget / rate), daysInMonth);
    }
    return { id: c.id, label: c.label, icon: c.icon, color: c.color, budget: c.budget, spent, projected, status, overrunDay };
  });

  const projectedTotal = paceReliable ? perCat.reduce((s, c) => s + c.projected, 0) : null;
  const budgetTotal = cats.reduce((s, c) => s + c.budget, 0);

  return {
    period, daysInMonth, day, daysLeft, remaining, spentToday,
    dailyAllowance, leftToday, paceReliable, perCat, projectedTotal, budgetTotal,
  };
}

// ─── "Puis-je me le permettre ?" ─────────────────────────────────────────────
// Simule une dépense sans l'enregistrer et décrit ses conséquences.
export function simulatePurchase({ amount, catId, allCats, spentMap, forecast }) {
  const cat = allCats.find(c => c.id === catId);
  if (!cat || !(amount > 0)) return null;

  const spent = spentMap[catId] || 0;
  const leftBefore = cat.budget - spent;
  const leftAfter = leftBefore - amount;
  const usage = cat.budget > 0 ? (spent + amount) / cat.budget : Infinity;

  // Ce qui dépasse l'enveloppe doit être pris ailleurs : on cherche d'abord dans
  // Imprévus (c'est son rôle), puis dans les catégories qui ont le plus de marge.
  const overflow = Math.max(amount - Math.max(leftBefore, 0), 0);
  const donors = [];
  let uncovered = 0;
  if (overflow > 0) {
    let need = overflow;
    const candidates = spendableCats(allCats)
      .filter(c => c.id !== catId)
      .map(c => ({ ...c, slack: c.budget - (spentMap[c.id] || 0) }))
      .filter(c => c.slack > 0)
      .sort((a, b) => (b.id === "divers") - (a.id === "divers") || b.slack - a.slack);
    for (const c of candidates) {
      if (need <= 0) break;
      const take = Math.min(c.slack, need);
      donors.push({ id: c.id, label: c.label, icon: c.icon, color: c.color, take });
      need -= take;
    }
    uncovered = Math.max(need, 0);
  }

  const isSpendable = cat.type === "variable" && cat.id !== "epargne";
  const daysLeft = forecast.daysLeft;
  // Impact sur l'enveloppe quotidienne : seul le montant réellement absorbé par
  // les catégories dépensables réduit ce qui reste pour les jours suivants.
  const absorbed = (isSpendable ? Math.min(amount, Math.max(leftBefore, 0)) : 0) + donors.reduce((s, d) => s + d.take, 0);
  // Même base que l'enveloppe du jour affichée sur l'accueil (dépenses du jour réintégrées)
  const base = forecast.remaining + forecast.spentToday;
  const dailyBefore = forecast.dailyAllowance;
  const dailyAfter = daysLeft > 0 ? Math.max(base - absorbed, 0) / daysLeft : 0;
  const daysOfBudget = dailyBefore > 0 ? amount / dailyBefore : null;

  let verdict;
  if (leftAfter >= 0 && usage <= 0.8) verdict = "ok";
  else if (leftAfter >= 0) verdict = "tight";
  else if (uncovered === 0) verdict = "shift";
  else verdict = "no";

  return {
    cat, amount, leftBefore, leftAfter, usage, overflow, donors,
    uncovered, dailyBefore, dailyAfter, daysOfBudget, verdict,
  };
}
