// Objectifs d'épargne : l'épargne cumulée (versements enregistrés dans la catégorie
// Épargne, tous mois confondus) remplit les objectifs dans l'ordre de priorité.
// La date d'atteinte est extrapolée depuis le rythme d'épargne récent.

export const PACE_WINDOW = 3; // mois pris en compte pour le rythme

export function savingsHistory(months) {
  return months.map(m => ({
    year: m.year,
    month: m.month,
    saved: m.expenses.filter(e => e.catId === "epargne").reduce((s, e) => s + e.amount, 0),
  }));
}

export function computeGoals(goals, months, today = new Date()) {
  const history = savingsHistory(months);
  const totalSaved = history.reduce((s, h) => s + h.saved, 0);

  // On ne compte que les mois écoulés ou en cours, et seulement ceux où on a épargné :
  // un mois ouvert par curiosité sans saisie ne doit pas écraser la moyenne.
  const nowIdx = today.getFullYear() * 12 + today.getMonth();
  const recent = history
    .filter(h => h.year * 12 + h.month <= nowIdx && h.saved > 0)
    .slice(-PACE_WINDOW);
  const monthlyPace = recent.length ? recent.reduce((s, h) => s + h.saved, 0) / recent.length : 0;

  let pool = totalSaved;
  let cumulativeNeed = 0;
  const items = goals.map(g => {
    const allocated = Math.min(Math.max(pool, 0), g.target);
    pool -= allocated;
    const missing = g.target - allocated;
    // Un objectif n'est servi qu'après ceux qui le précèdent : son échéance tient compte de leur reste.
    cumulativeNeed += missing;
    let eta = null;
    if (missing <= 0) eta = "done";
    else if (monthlyPace > 0) {
      const monthsNeeded = Math.ceil(cumulativeNeed / monthlyPace);
      eta = new Date(today.getFullYear(), today.getMonth() + monthsNeeded, 1);
    }
    return { ...g, allocated, missing, pct: g.target > 0 ? allocated / g.target : 0, eta };
  });

  return { items, totalSaved, monthlyPace };
}
