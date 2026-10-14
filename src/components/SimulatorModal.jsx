import { useState } from "react";
import { fmt } from "../lib/budget.js";
import { simulatePurchase } from "../lib/forecast.js";
import { g } from "./styles.js";
import { Modal } from "./ui.jsx";

const VERDICTS = {
  ok:    { icon:"✅", title:"Vas-y", color:"#4CAF7D", text:"L'enveloppe absorbe sans problème." },
  tight: { icon:"⚠️", title:"Possible, mais serré", color:"#E07B4C", text:"Tu passes au-dessus de 80 % de l'enveloppe." },
  shift: { icon:"🔁", title:"Possible en rognant ailleurs", color:"#7B8CDE", text:"L'enveloppe déborde ; voici où prendre la différence :" },
  no:    { icon:"❌", title:"Pas ce mois-ci", color:"#E05555", text:"Aucune marge suffisante dans tes enveloppes." },
};

export default function SimulatorModal({ allCats, spentMap, forecast, onClose, onCommit }) {
  const [amount, setAmount] = useState("");
  const [catId, setCatId] = useState("sorties");
  const sim = simulatePurchase({ amount: Number(amount), catId, allCats, spentMap, forecast });
  const v = sim && VERDICTS[sim.verdict];

  return (
    <Modal onClose={onClose}>
      <div style={{ fontWeight:800, fontSize:17, marginBottom:4 }}>🤔 Puis-je me le permettre ?</div>
      <div style={{ fontSize:12, color:"#6666AA", marginBottom:18 }}>Simule un achat avant de le faire. Rien n'est enregistré.</div>

      <label style={g.lbl}>Montant (MAD)</label>
      <input style={g.inp} type="number" inputMode="decimal" placeholder="0" value={amount} autoFocus
        onChange={e => setAmount(e.target.value)}/>
      <label style={g.lbl}>Catégorie</label>
      <select style={g.sel} value={catId} onChange={e => setCatId(e.target.value)}>
        {allCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
      </select>

      {sim && (
        <div style={{ background:v.color+"14", border:`1px solid ${v.color}55`, borderRadius:14, padding:"13px 14px", marginBottom:14 }}>
          <div style={{ fontWeight:800, fontSize:15, color:v.color }}>{v.icon} {v.title}</div>
          <div style={{ fontSize:12, color:"#8888AA", marginTop:3 }}>{v.text}</div>

          {sim.donors.length > 0 && (
            <div style={{ marginTop:8 }}>
              {sim.donors.map(d => (
                <div key={d.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"2px 0" }}>
                  <span style={{ color:"#CCCCDD" }}>{d.icon} {d.label}</span>
                  <span style={{ color:d.color, fontWeight:700 }}>−{fmt(d.take)} MAD</span>
                </div>
              ))}
              {sim.uncovered > 0 && (
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"2px 0" }}>
                  <span style={{ color:"#E05555" }}>Non couvert</span>
                  <span style={{ color:"#E05555", fontWeight:700 }}>{fmt(sim.uncovered)} MAD</span>
                </div>
              )}
            </div>
          )}

          <div style={{ borderTop:"1px solid #ffffff14", marginTop:10, paddingTop:9, fontSize:12, color:"#8888AA", lineHeight:1.9 }}>
            <div style={g.row}>
              <span>{sim.cat.icon} Reste dans {sim.cat.label}</span>
              <span style={{ color:sim.leftAfter < 0 ? "#E05555" : "#fff", fontWeight:700 }}>
                {fmt(Math.max(sim.leftBefore, 0))} → {sim.leftAfter < 0 ? `−${fmt(-sim.leftAfter)}` : fmt(sim.leftAfter)}
              </span>
            </div>
            {forecast.daysLeft > 0 && (
              <div style={g.row}>
                <span>📅 Budget par jour</span>
                <span style={{ color:"#fff", fontWeight:700 }}>{fmt(sim.dailyBefore)} → {fmt(sim.dailyAfter)} MAD</span>
              </div>
            )}
            {sim.daysOfBudget != null && (
              <div style={g.row}>
                <span>⏳ Équivaut à</span>
                <span style={{ color:"#fff", fontWeight:700 }}>{sim.daysOfBudget.toFixed(1).replace(".", ",")} jours de budget</span>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display:"flex", gap:9 }}>
        <button onClick={onClose} style={g.btnGhost}>Fermer</button>
        <button disabled={!sim} onClick={() => onCommit({ amount: Number(amount), catId })}
          style={{ ...g.btnPrimary(), opacity: sim ? 1 : 0.4 }}>
          Je l'achète → enregistrer
        </button>
      </div>
    </Modal>
  );
}
