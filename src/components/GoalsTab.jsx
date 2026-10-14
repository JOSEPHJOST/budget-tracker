import { useState } from "react";
import { fmt, MONTH_NAMES } from "../lib/budget.js";
import { computeGoals } from "../lib/goals.js";
import { g } from "./styles.js";
import { Bar, Modal } from "./ui.jsx";

const GOAL_ICONS = ["🎯","🛟","✈️","💻","🚗","🏠","💍","🎓"];

export default function GoalsTab({ goals, months, onChange }) {
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({ label:"", target:"", icon:"🎯" });
  const { items, totalSaved, monthlyPace } = computeGoals(goals, months);

  const add = () => {
    if (!form.label || !(Number(form.target) > 0)) return;
    onChange([...goals, { id:`goal_${Date.now()}`, label:form.label, target:Number(form.target), icon:form.icon }]);
    setForm({ label:"", target:"", icon:"🎯" });
    setShow(false);
  };
  const remove = id => onChange(goals.filter(x => x.id !== id));
  const move = (i, d) => {
    const next = [...goals];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    onChange(next);
  };

  return (
    <div style={g.sec}>
      <div style={{ ...g.card, background:"#1A1608", border:"1px solid #C9A84C44", marginBottom:14 }}>
        <div style={g.row}>
          <div>
            <div style={{ color:"#8888AA", fontSize:11 }}>Épargne cumulée</div>
            <div style={{ fontWeight:800, fontSize:22, color:"#C9A84C" }}>{fmt(totalSaved)} MAD</div>
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ color:"#8888AA", fontSize:11 }}>Rythme récent</div>
            <div style={{ fontWeight:700, fontSize:15 }}>{monthlyPace > 0 ? `${fmt(monthlyPace)} MAD/mois` : "—"}</div>
          </div>
        </div>
        <div style={{ fontSize:11, color:"#6666AA", marginTop:8, lineHeight:1.6 }}>
          Basé sur les versements enregistrés dans 🏦 Épargne. Les objectifs se remplissent dans l'ordre de priorité.
        </div>
      </div>

      {items.length === 0 && (
        <div style={{ textAlign:"center", color:"#6666AA", padding:"28px 0", fontSize:13 }}>
          Aucun objectif.<br/>Fonds d'urgence, voyage, PC… donne un but à ton épargne.
        </div>
      )}

      {items.map((it, i) => (
        <div key={it.id} style={g.card}>
          <div style={g.row}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <div style={g.icon("#C9A84C")}>{it.icon || "🎯"}</div>
              <div>
                <div style={{ fontWeight:600, fontSize:13 }}>{it.label}</div>
                <div style={{ fontSize:11, color:"#6666AA" }}>
                  {it.eta === "done" ? <span style={{ color:"#4CAF7D" }}>✅ Atteint</span>
                    : it.eta ? <>🗓️ vers <span style={{ color:"#fff" }}>{MONTH_NAMES[it.eta.getMonth()].toLowerCase()} {it.eta.getFullYear()}</span></>
                    : "Commence à épargner pour une estimation"}
                </div>
              </div>
            </div>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontWeight:700, fontSize:14, color:"#C9A84C" }}>{fmt(it.allocated)}</div>
              <div style={{ fontSize:11, color:"#6666AA" }}>/ {fmt(it.target)} MAD</div>
            </div>
          </div>
          <Bar pct={it.pct} color="#C9A84C"/>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:4, marginTop:6 }}>
            {[["↑", i > 0, () => move(i, -1)], ["↓", i < items.length - 1, () => move(i, 1)], ["🗑️", true, () => remove(it.id)]].map(([l, en, fn]) => (
              <button key={l} disabled={!en} onClick={fn} aria-label={l === "🗑️" ? "Supprimer" : l === "↑" ? "Monter" : "Descendre"}
                style={{ background:"#131320", border:"none", color:en ? "#8888AA" : "#2A2A40", borderRadius:7, padding:"3px 9px", cursor:en ? "pointer" : "default", fontSize:12 }}>{l}</button>
            ))}
          </div>
        </div>
      ))}

      <button onClick={() => setShow(true)} style={g.dashed("#C9A84C")}>+ Nouvel objectif</button>

      {show && (
        <Modal onClose={() => setShow(false)}>
          <div style={{ fontWeight:800, fontSize:17, marginBottom:18 }}>🎯 Nouvel objectif</div>
          <label style={g.lbl}>Nom</label>
          <input style={g.inp} type="text" placeholder="ex: Fonds d'urgence, Voyage…" value={form.label} autoFocus
            onChange={e => setForm({ ...form, label:e.target.value })}/>
          <label style={g.lbl}>Montant cible (MAD)</label>
          <input style={g.inp} type="number" inputMode="decimal" placeholder="0" value={form.target}
            onChange={e => setForm({ ...form, target:e.target.value })}/>
          <label style={g.lbl}>Icône</label>
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {GOAL_ICONS.map(ic => (
              <button key={ic} onClick={() => setForm({ ...form, icon:ic })}
                style={{ width:38, height:38, borderRadius:10, fontSize:18, cursor:"pointer", background:"#08080F",
                  border:form.icon === ic ? "2px solid #C9A84C" : "1px solid #222238" }}>{ic}</button>
            ))}
          </div>
          {monthlyPace > 0 && Number(form.target) > 0 && (
            <div style={{ fontSize:12, color:"#8888AA", marginBottom:14 }}>
              À {fmt(monthlyPace)} MAD/mois, il faut ~{Math.ceil(Number(form.target) / monthlyPace)} mois (après les objectifs prioritaires).
            </div>
          )}
          <div style={{ display:"flex", gap:9 }}>
            <button onClick={() => setShow(false)} style={g.btnGhost}>Annuler</button>
            <button onClick={add} style={g.btnPrimary()}>Ajouter</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
