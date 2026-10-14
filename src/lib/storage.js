import { THRESHOLD } from "./budget.js";

// Tout reste dans le localStorage du navigateur : aucune donnée ne quitte l'appareil.
const PREFIX = "bgt_";
export const monthKey = (y, m) => `bgt_v5_${y}_${m}`;
const MONTH_RE = /^bgt_v5_(\d+)_(\d+)$/;
const LEARN_KEY = "bgt_learn";
const GOALS_KEY = "bgt_goals";

const read = key => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // stockage plein ou désactivé (navigation privée) : l'app reste utilisable en mémoire
  }
};

const normalizeMonth = d => ({
  income: d.income ?? THRESHOLD,
  fixedCustom: d.fixedCustom ?? [],
  expenses: d.expenses ?? [],
  externalRevenues: d.externalRevenues ?? [],
});

/**
 * Charge un mois. Un mois jamais ouvert hérite du revenu et des charges fixes
 * personnalisées du dernier mois renseigné : une charge récurrente n'a pas à
 * être ressaisie chaque mois.
 */
export function loadMonth(y, m) {
  const d = read(monthKey(y, m));
  if (d) return { ...normalizeMonth(d), inherited: false };

  for (let i = 1; i <= 24; i++) {
    const t = y * 12 + m - i;
    const prev = read(monthKey(Math.floor(t / 12), t % 12));
    if (prev) {
      return {
        income: prev.income ?? THRESHOLD,
        fixedCustom: prev.fixedCustom ?? [],
        expenses: [],
        externalRevenues: [],
        inherited: true,
      };
    }
  }
  return { ...normalizeMonth({}), inherited: false };
}

export function saveMonth(y, m, data) {
  write(monthKey(y, m), normalizeMonth(data));
}

/** Tous les mois enregistrés, du plus ancien au plus récent. */
export function listMonths() {
  const out = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    const match = k && k.match(MONTH_RE);
    if (match) {
      const d = read(k);
      if (d) out.push({ year: Number(match[1]), month: Number(match[2]), ...normalizeMonth(d) });
    }
  }
  return out.sort((a, b) => a.year * 12 + a.month - (b.year * 12 + b.month));
}

export const loadLearned = () => read(LEARN_KEY) ?? {};
export const saveLearned = l => write(LEARN_KEY, l);

export const loadGoals = () => read(GOALS_KEY) ?? [];
export const saveGoals = g => write(GOALS_KEY, g);

// ─── Sauvegarde / restauration ───────────────────────────────────────────────
export function exportAll() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(PREFIX)) data[k] = read(k);
  }
  return { app: "budget-tracker", version: 1, exportedAt: new Date().toISOString(), data };
}

/** Restaure une sauvegarde. Retourne le nombre de clés importées. */
export function importAll(payload) {
  if (!payload || payload.app !== "budget-tracker" || typeof payload.data !== "object") {
    throw new Error("Fichier de sauvegarde invalide");
  }
  const entries = Object.entries(payload.data).filter(([k]) => k.startsWith(PREFIX));
  for (const [k, v] of entries) write(k, v);
  return entries.length;
}
