import { describe, it, expect } from "vitest";
import { computeExternal, computeMonth, REDIST_CATS } from "./budget.js";
import { computeForecast, simulatePurchase } from "./forecast.js";
import { parseQuickEntry, parseAmount, learn } from "./smartParse.js";
import { computeGoals } from "./goals.js";

const month = (over = {}) => ({ income: 3000, fixedCustom: [], expenses: [], externalRevenues: [], ...over });
const exp = (catId, amount, date) => ({ id: Math.random(), catId, amount, note: "", date });

describe("computeExternal", () => {
  it("redistribue exactement la moitié non épargnée malgré les arrondis", () => {
    const r = computeExternal([{ amount: 333 }], false);
    const redist = REDIST_CATS.reduce((s, c) => s + r.redistMap[c.id], 0);
    expect(r.toEpargne + redist).toBe(r.toEpargne + r.toRedist);
    expect(r.toEpargne).toBe(170);
  });
});

describe("computeMonth", () => {
  it("passe en mode réduit sous le seuil", () => {
    expect(computeMonth(month({ income: 2000 })).isReduced).toBe(true);
    expect(computeMonth(month()).isReduced).toBe(false);
  });
});

describe("computeForecast", () => {
  const today = new Date(2026, 9, 10, 12); // 10 octobre, 31 jours
  it("calcule l'enveloppe du jour en déduisant les dépenses d'aujourd'hui", () => {
    const m = computeMonth(month({ expenses: [exp("food", 50, new Date(2026, 9, 10, 9).toISOString())] }));
    const f = computeForecast({ ...m, expenses: [exp("food", 50, new Date(2026, 9, 10, 9).toISOString())], year: 2026, month: 9, today });
    expect(f.daysLeft).toBe(22);
    expect(f.spentToday).toBe(50);
    expect(f.leftToday).toBeCloseTo(f.dailyAllowance - 50);
    expect(f.dailyAllowance).toBeCloseTo((f.remaining + 50) / 22);
  });

  it("annonce un dépassement quand le rythme est trop élevé", () => {
    const expenses = [exp("sorties", 400, new Date(2026, 9, 2).toISOString())];
    const m = computeMonth(month({ expenses }));
    const f = computeForecast({ ...m, expenses, year: 2026, month: 9, today });
    const s = f.perCat.find(c => c.id === "sorties");
    // budget sorties = round10((3000-720)*0.30) = 680 ; rythme 40/jour → dépassement le 17
    expect(s.status).toBe("risk");
    expect(s.overrunDay).toBe(17);
  });

  it("ne projette rien avant quelques jours de données", () => {
    const m = computeMonth(month());
    const f = computeForecast({ ...m, expenses: [], year: 2026, month: 9, today: new Date(2026, 9, 2) });
    expect(f.paceReliable).toBe(false);
    expect(f.projectedTotal).toBeNull();
  });
});

describe("simulatePurchase", () => {
  const today = new Date(2026, 9, 10);
  const setup = expenses => {
    const m = computeMonth(month({ expenses }));
    const forecast = computeForecast({ ...m, expenses, year: 2026, month: 9, today });
    return { ...m, forecast };
  };

  it("valide un petit achat", () => {
    const s = setup([]);
    expect(simulatePurchase({ amount: 50, catId: "food", ...s }).verdict).toBe("ok");
  });

  it("puise d'abord dans Imprévus quand l'enveloppe déborde", () => {
    const s = setup([]);
    const food = s.allCats.find(c => c.id === "food").budget;
    const r = simulatePurchase({ amount: food + 100, catId: "food", ...s });
    expect(r.verdict).toBe("shift");
    expect(r.donors[0].id).toBe("divers");
    expect(r.donors.reduce((t, d) => t + d.take, 0)).toBe(100);
  });

  it("refuse quand rien ne peut absorber", () => {
    const s = setup([]);
    expect(simulatePurchase({ amount: 100000, catId: "food", ...s }).verdict).toBe("no");
  });
});

describe("parseQuickEntry", () => {
  const cats = ["food", "sorties", "devperso", "divers", "transport", "epargne"];
  it("extrait montant, note et catégorie", () => {
    expect(parseQuickEntry("45 café avec Sara", {}, cats)).toEqual({ amount: 45, note: "café avec Sara", catId: "food", source: "keyword" });
    expect(parseQuickEntry("Cinéma 80dh", {}, cats).catId).toBe("sorties");
  });

  it("gère les décimales et séparateurs de milliers", () => {
    expect(parseAmount("12,5 jus").value).toBe(12.5);
    expect(parseAmount("1 200 loyer").value).toBe(1200);
  });

  it("l'historique personnel l'emporte sur le dictionnaire", () => {
    let l = {};
    l = learn(l, "café Hamid", "sorties");
    l = learn(l, "café Hamid", "sorties");
    const r = parseQuickEntry("30 café Hamid", l, cats);
    expect(r.catId).toBe("sorties");
    expect(r.source).toBe("learned");
  });

  it("ignore les catégories qui n'existent plus", () => {
    const l = learn({}, "netflix", "fx_old");
    expect(parseQuickEntry("60 netflix", l, cats).catId).toBeNull();
  });
});

describe("computeGoals", () => {
  const today = new Date(2026, 9, 15);
  const months = [
    { year: 2026, month: 7, expenses: [exp("epargne", 500)] },
    { year: 2026, month: 8, expenses: [exp("epargne", 700)] },
    { year: 2026, month: 9, expenses: [exp("epargne", 600)] },
  ];
  it("remplit les objectifs par priorité et estime l'échéance", () => {
    const { items, totalSaved, monthlyPace } = computeGoals(
      [{ id: 1, label: "Fonds d'urgence", target: 1000 }, { id: 2, label: "Voyage", target: 3000 }],
      months, today,
    );
    expect(totalSaved).toBe(1800);
    expect(monthlyPace).toBe(600);
    expect(items[0].eta).toBe("done");
    expect(items[1].allocated).toBe(800);
    // reste 2200 à 600/mois → 4 mois → février 2027
    expect(items[1].eta.getFullYear()).toBe(2027);
    expect(items[1].eta.getMonth()).toBe(1);
  });
});

describe("learn", () => {
  it("n'apprend pas les mots outils", () => {
    expect(Object.keys(learn({}, "café avec la team", "food")).sort()).toEqual(["cafe", "team"]);
  });
});

describe("cohérence simulateur / enveloppe du jour", () => {
  it("part du même budget quotidien que la carte d'accueil", () => {
    const today = new Date(2026, 9, 14, 15);
    const expenses = [exp("food", 90, new Date(2026, 9, 14, 10).toISOString())];
    const m = computeMonth(month({ expenses }));
    const forecast = computeForecast({ ...m, expenses, year: 2026, month: 9, today });
    const r = simulatePurchase({ amount: 10, catId: "food", ...m, forecast });
    expect(r.dailyBefore).toBeCloseTo(forecast.dailyAllowance);
  });
});
