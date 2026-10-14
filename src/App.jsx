import { useState, useEffect, useRef } from "react";
import {
  THRESHOLD, MONTH_NAMES, round10, fmt, DEFAULT_FIXED, REDIST_CATS, PALETTE, SOURCE_ICONS, computeMonth,
} from "./lib/budget.js";
import { computeForecast } from "./lib/forecast.js";
import { parseQuickEntry, learn } from "./lib/smartParse.js";
import {
  loadMonth, saveMonth, listMonths, loadLearned, saveLearned, loadGoals, saveGoals, exportAll, importAll,
} from "./lib/storage.js";
import { g } from "./components/styles.js";
import { ArcGauge, Bar } from "./components/ui.jsx";
import PulseCard from "./components/PulseCard.jsx";
import SimulatorModal from "./components/SimulatorModal.jsx";
import GoalsTab from "./components/GoalsTab.jsx";

const EMPTY_EXP_FORM = { quick:"", amount:"", catId:"food", note:"", guess:null, catTouched:false };

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [data, setData] = useState(() => loadMonth(now.getFullYear(), now.getMonth()));
  const [learned, setLearned] = useState(loadLearned);
  const [goals, setGoals]     = useState(loadGoals);
  const [editingIncome, setEditingIncome] = useState(false);
  const [tempIncome, setTempIncome]       = useState("");
  const [tab, setTab] = useState("budget");
  const [showAddExp,   setShowAddExp]   = useState(false);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [showAddExt,   setShowAddExt]   = useState(false);
  const [showSim,      setShowSim]      = useState(false);
  const [form,   setForm]   = useState(EMPTY_EXP_FORM);
  const [fxForm, setFxForm] = useState({ label:"", amount:"", icon:"💳", color:"#7B8CDE" });
  const [extForm, setExtForm] = useState({ amount:"", source:"inDrive", customSource:"" });
  const [backupMsg, setBackupMsg] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { setData(loadMonth(year, month)); }, [year, month]);

  const { income, fixedCustom, expenses, externalRevenues } = data;
  const update = patch => {
    const next = { ...data, ...patch, inherited:false };
    setData(next);
    saveMonth(year, month, next);
  };

  // ── Budget logic ─────────────────────────────────────────────────────────
  const {
    isReduced, allFixed, totalFixed, available, varBudgets, allCats, spentMap,
    totalBudget, totalSpent, restant, extTotal, toEpargne, toRedist, redistMap,
  } = computeMonth(data);
  const gaugePct = totalBudget > 0 ? Math.min(totalSpent / totalBudget, 1.2) : 0;
  const forecast = computeForecast({ allCats, spentMap, expenses, year, month, today: now });
  const paceMarker = forecast.period === "current" ? forecast.day / forecast.daysInMonth : null;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const confirmIncome = () => {
    const v = Number(tempIncome);
    if (v > 0) update({ income:v });
    setEditingIncome(false);
  };

  // Une dépense saisie sur un autre mois que le mois courant est datée dans ce mois-là
  const entryDate = () => forecast.period === "current"
    ? new Date().toISOString()
    : new Date(year, month, forecast.period === "past" ? forecast.daysInMonth : 1, 12).toISOString();

  const onQuickChange = text => {
    const p = parseQuickEntry(text, learned, allCats.map(c => c.id));
    setForm(f => ({
      ...f,
      quick: text,
      amount: p.amount != null ? String(p.amount) : f.amount,
      note: p.note,
      catId: !f.catTouched && p.catId ? p.catId : f.catId,
      guess: !f.catTouched && p.catId ? p.source : f.catTouched ? f.guess : null,
    }));
  };

  const openExpense = (prefill = {}) => {
    setForm({ ...EMPTY_EXP_FORM, ...prefill });
    setShowAddExp(true);
  };

  const addExpense = () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    const e = { id:Date.now(), amount:Number(form.amount), catId:form.catId, note:form.note.trim(), date:entryDate() };
    update({ expenses:[e, ...expenses] });
    if (e.note) {
      const l = learn(learned, e.note, e.catId);
      setLearned(l);
      saveLearned(l);
    }
    setForm(EMPTY_EXP_FORM);
    setShowAddExp(false);
  };

  const delExpense = id => update({ expenses: expenses.filter(e => e.id !== id) });

  const addFixed = () => {
    if (!fxForm.label || Number(fxForm.amount) <= 0) return;
    const f = { id:`fx_${Date.now()}`, label:fxForm.label, icon:fxForm.icon, amount:Number(fxForm.amount), color:fxForm.color, deletable:true };
    update({ fixedCustom:[...fixedCustom, f] });
    setFxForm({ label:"", amount:"", icon:"💳", color:"#7B8CDE" });
    setShowAddFixed(false);
  };

  const delFixed = id => update({
    fixedCustom: fixedCustom.filter(f => f.id !== id),
    expenses: expenses.filter(e => e.catId !== id),
  });

  const addExternal = () => {
    if (Number(extForm.amount) <= 0) return;
    const label = extForm.source === "Autre" ? extForm.customSource || "Autre" : extForm.source;
    const r = { id:Date.now(), amount:Number(extForm.amount), source:label, date:entryDate() };
    update({ externalRevenues:[...externalRevenues, r] });
    setExtForm({ amount:"", source:"inDrive", customSource:"" });
    setShowAddExt(false);
  };

  const delExternal = id => update({ externalRevenues: externalRevenues.filter(r => r.id !== id) });

  const updateGoals = next => { setGoals(next); saveGoals(next); };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], { type:"application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `budget-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setBackupMsg({ ok:true, text:"Sauvegarde téléchargée." });
  };

  const restoreBackup = async file => {
    try {
      const n = importAll(JSON.parse(await file.text()));
      setData(loadMonth(year, month));
      setLearned(loadLearned());
      setGoals(loadGoals());
      setBackupMsg({ ok:true, text:`${n} élément${n > 1 ? "s" : ""} restauré${n > 1 ? "s" : ""}.` });
    } catch (err) {
      setBackupMsg({ ok:false, text: err instanceof SyntaxError ? "Fichier illisible." : err.message });
    }
  };

  const prevM = () => { if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextM = () => { if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };
  const fmtDate = iso => { const d=new Date(iso); return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`; };

  return (
    <div style={g.app}>

      {/* ── HEADER ─────────────────────────── */}
      <div style={g.hdr}>
        <div style={g.row}>
          <button onClick={prevM} style={{ background:"#131320", border:"none", color:"#6666AA", borderRadius:9, padding:"6px 13px", cursor:"pointer", fontSize:17 }}>‹</button>
          <div style={{ textAlign:"center" }}>
            <div style={{ fontWeight:700, fontSize:15 }}>{MONTH_NAMES[month]} {year}</div>
            {editingIncome ? (
              <div style={{ display:"flex", gap:6, marginTop:5, justifyContent:"center" }}>
                <input style={{ background:"#1A1A28", border:"1px solid #C9A84C", borderRadius:8, padding:"4px 9px", color:"#fff", fontSize:13, width:85, outline:"none" }}
                  type="number" autoFocus value={tempIncome}
                  onChange={e => setTempIncome(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && confirmIncome()}
                  placeholder={income}/>
                <button onClick={confirmIncome} style={{ background:"#C9A84C", border:"none", borderRadius:8, padding:"4px 10px", color:"#08080F", fontWeight:800, cursor:"pointer", fontSize:13 }}>OK</button>
                <button onClick={() => setEditingIncome(false)} style={{ background:"#1A1A28", border:"none", borderRadius:8, padding:"4px 8px", color:"#6666AA", cursor:"pointer", fontSize:13 }}>✕</button>
              </div>
            ) : (
              <div onClick={() => { setEditingIncome(true); setTempIncome(income); }}
                style={{ fontSize:12, color:"#C9A84C", cursor:"pointer", marginTop:3, display:"flex", alignItems:"center", gap:6, justifyContent:"center" }}>
                💰 {income} MAD ✏️
                <span style={g.badge(isReduced ? "#E07B4C" : "#4CAF7D")}>{isReduced ? "RÉDUIT" : "STANDARD"}</span>
              </div>
            )}
          </div>
          <button onClick={nextM} style={{ background:"#131320", border:"none", color:"#6666AA", borderRadius:9, padding:"6px 13px", cursor:"pointer", fontSize:17 }}>›</button>
        </div>
      </div>

      {/* ── REDUCED ALERT ──────────────────── */}
      {isReduced && (
        <div style={{ margin:"12px 14px 0", background:"#E07B4C18", border:"1px solid #E07B4C44", borderRadius:14, padding:"11px 14px", display:"flex", gap:10 }}>
          <span style={{ fontSize:20 }}>⚠️</span>
          <div>
            <div style={{ fontWeight:700, fontSize:13, color:"#E07B4C" }}>Mode réduit activé</div>
            <div style={{ fontSize:11, color:"#8888AA", marginTop:2 }}>Revenu &lt; {fmt(THRESHOLD)} MAD — priorité aux essentiels.</div>
          </div>
        </div>
      )}

      {/* ── EXTERNAL REVENUE BANNER ────────── */}
      {extTotal > 0 && (
        <div style={{ margin:"10px 14px 0", background:"#4CAF7D18", border:"1px solid #4CAF7D44", borderRadius:14, padding:"11px 14px" }}>
          <div style={{ fontWeight:700, fontSize:13, color:"#4CAF7D", marginBottom:6 }}>
            💸 Revenus externes — {round10(extTotal)} MAD
          </div>
          <div style={{ display:"flex", gap:16, flexWrap:"wrap" }}>
            <div style={{ fontSize:12, color:"#8888AA" }}>
              🏦 Épargne <span style={{ color:"#C9A84C", fontWeight:700 }}>+{toEpargne} MAD</span>
            </div>
            <div style={{ fontSize:12, color:"#8888AA" }}>
              📊 Redistribué <span style={{ color:"#4CAF7D", fontWeight:700 }}>+{toRedist} MAD</span>
            </div>
          </div>
        </div>
      )}

      {/* ── HERO ───────────────────────────── */}
      <div style={g.hero}>
        <div style={g.row}>
          <div>
            <div style={{ color:"#6666AA", fontSize:10, textTransform:"uppercase", letterSpacing:1.8, marginBottom:5 }}>Restant ce mois</div>
            <div style={{ fontSize:32, fontWeight:800, color:restant<0?"#E05555":"#fff", fontVariantNumeric:"tabular-nums" }}>
              {round10(restant)} <span style={{ fontSize:15, color:"#6666AA", fontWeight:400 }}>MAD</span>
            </div>
            <div style={{ fontSize:12, color:"#6666AA", marginTop:5, lineHeight:1.8 }}>
              <span style={{ color:"#E05555" }}>{round10(totalSpent)}</span> dépensés<br/>
              <span style={{ color:"#C9A84C" }}>{round10(totalBudget)}</span> MAD alloués
              {extTotal > 0 && <span style={{ color:"#4CAF7D" }}> · +{round10(extTotal)} externe</span>}
            </div>
          </div>
          <div style={{ position:"relative", flexShrink:0 }}>
            <ArcGauge pct={gaugePct}/>
            <div style={{ position:"absolute", top:"50%", left:"50%", transform:"translate(-50%,-45%)", textAlign:"center" }}>
              <div style={{ fontWeight:800, fontSize:17, color:gaugePct>0.9?"#E05555":gaugePct>0.7?"#E07B4C":"#C9A84C" }}>
                {Math.round(gaugePct*100)}%
              </div>
            </div>
          </div>
        </div>
      </div>

      <PulseCard forecast={forecast} month={month} onSimulate={() => setShowSim(true)}/>

      {/* ── TABS ───────────────────────────── */}
      <div className="tabs" style={g.tabBar}>
        {[["budget","Budget"],["history","Dépenses"],["goals","Objectifs"],["external","Revenus +"],["fixed","Charges"],["summary","Bilan"]].map(([k,l]) => (
          <button key={k} style={g.tabBtn(tab===k)} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ════════════════════════════════
          BUDGET TAB
      ════════════════════════════════ */}
      {tab==="budget" && (
        <div style={g.sec}>
          <div style={g.sh}>🔒 Charges fixes — {round10(totalFixed)} MAD</div>
          {data.inherited && fixedCustom.length > 0 && (
            <div style={{ fontSize:11, color:"#6666AA", marginTop:-6, marginBottom:10 }}>↻ Charges et revenu repris du mois précédent.</div>
          )}
          {allFixed.map(f => {
            const s = spentMap[f.id]||0, p = s/f.amount;
            return (
              <div key={f.id} style={g.card}>
                <div style={g.row}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:11, background:f.color+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{f.icon}</div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{f.label}</div>
                      <span style={g.badge(f.color)}>FIXE</span>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:p>1?"#E05555":f.color }}>{round10(s)}</div>
                    <div style={{ fontSize:11, color:"#6666AA" }}>/ {f.amount} MAD</div>
                  </div>
                </div>
                <Bar pct={p} color={f.color}/>
              </div>
            );
          })}

          <div style={{ ...g.sh, marginTop:18 }}>
            📊 Budget variable — {round10(available)} MAD
            {extTotal > 0 && <span style={{ color:"#4CAF7D" }}> +{toRedist} externe</span>}
          </div>
          {allCats.filter(c=>c.type==="variable").map(c => {
            const s = spentMap[c.id]||0, p = s/c.budget;
            const pctLabel = isReduced ? c.red : c.std;
            return (
              <div key={c.id} style={g.card}>
                <div style={g.row}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ width:38, height:38, borderRadius:11, background:c.color+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{c.icon}</div>
                    <div>
                      <div style={{ fontWeight:600, fontSize:13 }}>{c.label}</div>
                      <div style={{ display:"flex", gap:5, marginTop:2, flexWrap:"wrap" }}>
                        <span style={g.badge("#8888AA")}>{Math.round(pctLabel*100)}%</span>
                        {c.bonus > 0 && <span style={g.badge("#4CAF7D")}>+{c.bonus} externe</span>}
                        {isReduced && c.std!==c.red && <span style={g.badge("#E07B4C")}>{c.red>c.std?"↑ priorité":"↓ réduit"}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontWeight:700, fontSize:14, color:p>1?"#E05555":p>0.8?"#E07B4C":c.color }}>{round10(s)}</div>
                    <div style={{ fontSize:11, color:"#6666AA" }}>/ {c.budget} MAD</div>
                  </div>
                </div>
                <Bar pct={p} color={c.color} marker={c.id !== "epargne" ? paceMarker : null}/>
              </div>
            );
          })}
          {paceMarker != null && (
            <div style={{ fontSize:10, color:"#444466", textAlign:"center", margin:"4px 0 2px" }}>
              ▏ repère blanc = où tu devrais être aujourd'hui pour finir le mois pile
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════
          HISTORY TAB
      ════════════════════════════════ */}
      {tab==="history" && (
        <div style={g.sec}>
          {expenses.length===0 ? (
            <div style={{ textAlign:"center", color:"#6666AA", padding:"48px 0", fontSize:13 }}>
              Aucune dépense.<br/><span style={{ color:"#C9A84C" }}>Appuie sur +</span> pour en ajouter.
            </div>
          ) : expenses.map(exp => {
            const cat = allCats.find(c=>c.id===exp.catId);
            return (
              <div key={exp.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 0", borderBottom:"1px solid #1A1A28" }}>
                <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                  <div style={{ width:38, height:38, borderRadius:11, background:(cat?.color||"#888")+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{cat?.icon||"💸"}</div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13 }}>{cat?.label||exp.catId}</div>
                    {exp.note && <div style={{ fontSize:11, color:"#6666AA" }}>{exp.note}</div>}
                    <div style={{ fontSize:10, color:"#444466", marginTop:1 }}>{fmtDate(exp.date)}</div>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <div style={{ fontWeight:700, color:"#E05555", fontSize:14 }}>−{exp.amount}</div>
                  <button onClick={()=>delExpense(exp.id)} style={{ background:"none", border:"none", color:"#333355", cursor:"pointer", fontSize:17 }}>×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab==="goals" && <GoalsTab goals={goals} months={listMonths()} onChange={updateGoals}/>}

      {/* ════════════════════════════════
          REVENUS EXTERNES TAB
      ════════════════════════════════ */}
      {tab==="external" && (
        <div style={g.sec}>

          {/* Explainer */}
          <div style={{ ...g.card, background:"#0D1A12", border:"1px solid #4CAF7D44", marginBottom:14 }}>
            <div style={{ fontWeight:700, fontSize:13, color:"#4CAF7D", marginBottom:8 }}>Comment ça fonctionne</div>
            <div style={{ fontSize:12, color:"#8888AA", lineHeight:1.8 }}>
              Chaque revenu externe est divisé en <span style={{ color:"#fff" }}>deux parts égales :</span>
            </div>
            <div style={{ display:"flex", gap:8, marginTop:10 }}>
              <div style={{ flex:1, background:"#C9A84C18", border:"1px solid #C9A84C44", borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:20 }}>🏦</div>
                <div style={{ fontWeight:800, color:"#C9A84C", fontSize:16 }}>50%</div>
                <div style={{ fontSize:11, color:"#8888AA", marginTop:2 }}>Épargne auto</div>
              </div>
              <div style={{ flex:1, background:"#4CAF7D18", border:"1px solid #4CAF7D44", borderRadius:10, padding:"10px", textAlign:"center" }}>
                <div style={{ fontSize:20 }}>📊</div>
                <div style={{ fontWeight:800, color:"#4CAF7D", fontSize:16 }}>50%</div>
                <div style={{ fontSize:11, color:"#8888AA", marginTop:2 }}>Redistribué</div>
              </div>
            </div>
          </div>

          {/* Total summary */}
          {extTotal > 0 && (
            <div style={{ ...g.card, marginBottom:14 }}>
              <div style={g.row}>
                <span style={{ color:"#6666AA", fontSize:12 }}>Total revenus externes</span>
                <span style={{ fontWeight:700, color:"#4CAF7D" }}>{round10(extTotal)} MAD</span>
              </div>
              <div style={g.row}>
                <span style={{ color:"#6666AA", fontSize:12 }}>→ 🏦 Épargne</span>
                <span style={{ fontWeight:700, color:"#C9A84C" }}>+{toEpargne} MAD</span>
              </div>
              <div style={{ borderTop:"1px solid #1A1A28", marginTop:10, paddingTop:10 }}>
                <div style={{ fontSize:11, color:"#6666AA", marginBottom:6 }}>Redistribution des {toRedist} MAD :</div>
                {REDIST_CATS.map(c => (
                  <div key={c.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0" }}>
                    <span style={{ color:"#8888AA" }}>{c.icon} {c.label}</span>
                    <span style={{ color:c.color, fontWeight:600 }}>+{redistMap[c.id]||0} MAD</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* List */}
          <div style={g.sh}>Entrées ce mois</div>
          {externalRevenues.length===0 ? (
            <div style={{ textAlign:"center", color:"#6666AA", padding:"24px 0", fontSize:13 }}>
              Aucun revenu externe ce mois.
            </div>
          ) : externalRevenues.map(r => (
            <div key={r.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 0", borderBottom:"1px solid #1A1A28" }}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <div style={{ width:38, height:38, borderRadius:11, background:"#4CAF7D20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>
                  {SOURCE_ICONS[r.source] || "💸"}
                </div>
                <div>
                  <div style={{ fontWeight:600, fontSize:13 }}>{r.source}</div>
                  <div style={{ fontSize:10, color:"#444466" }}>{fmtDate(r.date)} · 🏦 {round10(r.amount*0.5)} épargnés</div>
                </div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <div style={{ fontWeight:700, color:"#4CAF7D", fontSize:14 }}>+{r.amount}</div>
                <button onClick={()=>delExternal(r.id)} style={{ background:"none", border:"none", color:"#333355", cursor:"pointer", fontSize:17 }}>×</button>
              </div>
            </div>
          ))}

          <button onClick={()=>setShowAddExt(true)}
            style={{ width:"100%", padding:13, background:"transparent", border:"1px dashed #4CAF7D44", borderRadius:14, color:"#4CAF7D", fontWeight:700, fontSize:13, cursor:"pointer", marginTop:12 }}>
            + Ajouter un revenu externe
          </button>
        </div>
      )}

      {/* ════════════════════════════════
          CHARGES TAB
      ════════════════════════════════ */}
      {tab==="fixed" && (
        <div style={g.sec}>
          <div style={{ fontSize:12, color:"#6666AA", marginBottom:14, textAlign:"center" }}>
            Montants <span style={{ color:"#7B8CDE" }}>constants</span> peu importe le revenu.
          </div>
          <div style={g.sh}>Par défaut</div>
          {DEFAULT_FIXED.map(f => (
            <div key={f.id} style={{ ...g.card, ...g.row }}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <div style={{ width:38, height:38, borderRadius:11, background:f.color+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{f.icon}</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{f.label}</div>
              </div>
              <span style={{ fontWeight:700, color:f.color }}>{f.amount} MAD</span>
            </div>
          ))}
          {fixedCustom.length > 0 && <div style={{ ...g.sh, marginTop:18 }}>Personnalisées</div>}
          {fixedCustom.map(f => (
            <div key={f.id} style={{ ...g.card, ...g.row }}>
              <div style={{ display:"flex", alignItems:"center", gap:11 }}>
                <div style={{ width:38, height:38, borderRadius:11, background:f.color+"20", display:"flex", alignItems:"center", justifyContent:"center", fontSize:19 }}>{f.icon}</div>
                <div style={{ fontWeight:600, fontSize:13 }}>{f.label}</div>
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                <span style={{ fontWeight:700, color:f.color }}>{f.amount} MAD</span>
                <button onClick={()=>delFixed(f.id)} style={{ background:"none", border:"none", color:"#444466", cursor:"pointer", fontSize:17 }}>🗑️</button>
              </div>
            </div>
          ))}
          <button onClick={()=>setShowAddFixed(true)}
            style={{ width:"100%", padding:13, background:"transparent", border:"1px dashed #222238", borderRadius:14, color:"#C9A84C", fontWeight:700, fontSize:13, cursor:"pointer", marginTop:10 }}>
            ⊕ Ajouter une charge fixe
          </button>
        </div>
      )}

      {/* ════════════════════════════════
          BILAN TAB
      ════════════════════════════════ */}
      {tab==="summary" && (
        <div style={g.sec}>
          <div style={g.card}>
            {[
              ["💰 Revenu fixe ce mois", `${income} MAD`, "#fff"],
              ["💸 Revenus externes", `+${round10(extTotal)} MAD`, "#4CAF7D"],
              ["🏦 dont épargné (50%)", `+${toEpargne} MAD`, "#C9A84C"],
              ["🔒 Charges fixes", `−${round10(totalFixed)} MAD`, "#7B8CDE"],
              ["Total dépensé", `−${round10(totalSpent)} MAD`, "#E05555"],
              ["Solde restant", `${round10(restant)} MAD`, restant<0?"#E05555":"#4CAF7D"],
            ].map(([lbl,val,col],i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"9px 0", borderBottom:i<5?"1px solid #1A1A28":"none" }}>
                <span style={{ color:"#6666AA", fontSize:12 }}>{lbl}</span>
                <span style={{ fontWeight:700, color:col, fontSize:i===5?20:14 }}>{val}</span>
              </div>
            ))}
          </div>
          <div style={g.card}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:11 }}>Détail par catégorie</div>
            {allCats.map(c => {
              const s = spentMap[c.id]||0, p = s/c.budget;
              return (
                <div key={c.id} style={{ marginBottom:9 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, marginBottom:3 }}>
                    <span style={{ color:"#8888AA" }}>{c.icon} {c.label}</span>
                    <span style={{ fontWeight:600, color:p>1?"#E05555":c.color }}>{round10(s)} / {c.budget}</span>
                  </div>
                  <Bar pct={p} color={c.color}/>
                </div>
              );
            })}
          </div>
          <div style={g.card}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:4 }}>💾 Sauvegarde</div>
            <div style={{ fontSize:11, color:"#6666AA", marginBottom:11, lineHeight:1.6 }}>
              Tes données restent sur cet appareil uniquement. Vider le navigateur les efface : exporte-les régulièrement.
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <button onClick={downloadBackup} style={{ ...g.btnGhost, color:"#C9A84C" }}>⬇ Exporter</button>
              <button onClick={() => fileRef.current?.click()} style={{ ...g.btnGhost, color:"#7B8CDE" }}>⬆ Restaurer</button>
              <input ref={fileRef} type="file" accept="application/json,.json" style={{ display:"none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) restoreBackup(f); e.target.value = ""; }}/>
            </div>
            {backupMsg && <div style={{ fontSize:12, marginTop:9, color:backupMsg.ok ? "#4CAF7D" : "#E05555" }}>{backupMsg.text}</div>}
          </div>
        </div>
      )}

      {/* ── FABs ───────────────────────────── */}
      <button style={g.fab3} onClick={()=>setShowAddExt(true)}   title="Revenu externe">💸</button>
      <button style={g.fab2} onClick={()=>setShowAddFixed(true)} title="Charge fixe">⊕</button>
      <button style={g.fab}  onClick={()=>openExpense()} title="Dépense">+</button>

      {/* ── MODAL : DÉPENSE ─────────────────── */}
      {showAddExp && (
        <div style={g.overlay} onClick={()=>setShowAddExp(false)}>
          <div style={g.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:18 }}>➕ Nouvelle dépense</div>
            <label style={g.lbl}>⚡ Saisie rapide</label>
            <input style={{ ...g.inp, borderColor:"#C9A84C66" }} type="text" placeholder="ex : 45 café avec Sara"
              value={form.quick} onChange={e=>onQuickChange(e.target.value)}
              onKeyDown={e=>e.key==="Enter" && addExpense()} autoFocus={!form.amount}/>
            <label style={g.lbl}>Montant (MAD)</label>
            <input style={g.inp} type="number" inputMode="decimal" placeholder="0" value={form.amount}
              onChange={e=>setForm({...form,amount:e.target.value})} autoFocus={!!form.amount}/>
            <label style={g.lbl}>
              Catégorie
              {form.guess && !form.catTouched && (
                <span style={{ color:"#C9A84C", textTransform:"none", letterSpacing:0, marginLeft:6 }}>
                  · {form.guess === "learned" ? "🧠 d'après tes habitudes" : "✨ devinée"}
                </span>
              )}
            </label>
            <select style={g.sel} value={form.catId} onChange={e=>setForm({...form,catId:e.target.value,catTouched:true})}>
              <optgroup label="🔒 Charges fixes">
                {allFixed.map(f=><option key={f.id} value={f.id}>{f.icon} {f.label}</option>)}
              </optgroup>
              <optgroup label="📊 Budget variable">
                {varBudgets.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </optgroup>
            </select>
            <label style={g.lbl}>Note (optionnel)</label>
            <input style={g.inp} type="text" placeholder="ex: Lunch, Taxi..." value={form.note}
              onChange={e=>setForm({...form,note:e.target.value})}/>
            <div style={{ fontSize:10, color:"#444466", marginTop:-6, marginBottom:13 }}>
              La note sert à apprendre tes catégories : plus tu notes, mieux la saisie rapide devine.
            </div>
            <div style={{ display:"flex", gap:9 }}>
              <button onClick={()=>setShowAddExp(false)} style={{ flex:1,padding:13,background:"#131320",border:"none",borderRadius:11,color:"#6666AA",fontWeight:700,cursor:"pointer" }}>Annuler</button>
              <button onClick={addExpense} style={{ flex:2,padding:13,background:"#C9A84C",border:"none",borderRadius:11,color:"#08080F",fontWeight:800,cursor:"pointer" }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : REVENU EXTERNE ──────────── */}
      {showAddExt && (
        <div style={g.overlay} onClick={()=>setShowAddExt(false)}>
          <div style={g.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:6 }}>💸 Revenu externe</div>
            <div style={{ fontSize:12, color:"#6666AA", marginBottom:18 }}>50% épargné · 50% redistribué automatiquement</div>
            <label style={g.lbl}>Montant (MAD)</label>
            <input style={g.inp} type="number" placeholder="0" value={extForm.amount}
              onChange={e=>setExtForm({...extForm,amount:e.target.value})} autoFocus/>
            {extForm.amount > 0 && (
              <div style={{ background:"#0D1A12", border:"1px solid #4CAF7D44", borderRadius:11, padding:"10px 13px", marginBottom:13 }}>
                <div style={{ fontSize:12, color:"#8888AA", marginBottom:4 }}>Aperçu arrondi :</div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13 }}>
                  <span style={{ color:"#C9A84C" }}>🏦 Épargne</span>
                  <span style={{ fontWeight:700, color:"#C9A84C" }}>+{round10(Number(extForm.amount)*0.5)} MAD</span>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginTop:3 }}>
                  <span style={{ color:"#4CAF7D" }}>📊 Redistribué</span>
                  <span style={{ fontWeight:700, color:"#4CAF7D" }}>+{round10(Number(extForm.amount)*0.5)} MAD</span>
                </div>
              </div>
            )}
            <label style={g.lbl}>Source</label>
            <select style={g.sel} value={extForm.source} onChange={e=>setExtForm({...extForm,source:e.target.value})}>
              <option value="inDrive">🚗 inDrive</option>
              <option value="Trading">📈 Trading</option>
              <option value="Freelance">💻 Freelance</option>
              <option value="Autre">💸 Autre</option>
            </select>
            {extForm.source==="Autre" && (
              <input style={g.inp} type="text" placeholder="Précise la source..." value={extForm.customSource}
                onChange={e=>setExtForm({...extForm,customSource:e.target.value})}/>
            )}
            <div style={{ display:"flex", gap:9 }}>
              <button onClick={()=>setShowAddExt(false)} style={{ flex:1,padding:13,background:"#131320",border:"none",borderRadius:11,color:"#6666AA",fontWeight:700,cursor:"pointer" }}>Annuler</button>
              <button onClick={addExternal} style={{ flex:2,padding:13,background:"#4CAF7D",border:"none",borderRadius:11,color:"#08080F",fontWeight:800,cursor:"pointer" }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : CHARGE FIXE ─────────────── */}
      {showAddFixed && (
        <div style={g.overlay} onClick={()=>setShowAddFixed(false)}>
          <div style={g.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:18 }}>⊕ Nouvelle charge fixe</div>
            <label style={g.lbl}>Nom</label>
            <input style={g.inp} type="text" placeholder="ex: Coiffure, Netflix..." value={fxForm.label}
              onChange={e=>setFxForm({...fxForm,label:e.target.value})} autoFocus/>
            <label style={g.lbl}>Montant mensuel (MAD)</label>
            <input style={g.inp} type="number" placeholder="0" value={fxForm.amount}
              onChange={e=>setFxForm({...fxForm,amount:e.target.value})}/>
            <label style={g.lbl}>Emoji icône</label>
            <input style={g.inp} type="text" placeholder="💈 🏠 📱 ..." value={fxForm.icon}
              onChange={e=>setFxForm({...fxForm,icon:e.target.value})}/>
            <label style={g.lbl}>Couleur</label>
            <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
              {PALETTE.map(c => (
                <div key={c} onClick={()=>setFxForm({...fxForm,color:c})}
                  style={{ width:28,height:28,borderRadius:"50%",background:c,cursor:"pointer",
                    border:fxForm.color===c?"3px solid #fff":"3px solid transparent",boxSizing:"border-box" }}/>
              ))}
            </div>
            <div style={{ display:"flex", gap:9 }}>
              <button onClick={()=>setShowAddFixed(false)} style={{ flex:1,padding:13,background:"#131320",border:"none",borderRadius:11,color:"#6666AA",fontWeight:700,cursor:"pointer" }}>Annuler</button>
              <button onClick={addFixed} style={{ flex:2,padding:13,background:"#C9A84C",border:"none",borderRadius:11,color:"#08080F",fontWeight:800,cursor:"pointer" }}>Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL : SIMULATEUR ─────────────── */}
      {showSim && (
        <SimulatorModal allCats={allCats} spentMap={spentMap} forecast={forecast}
          onClose={() => setShowSim(false)}
          onCommit={({ amount, catId }) => {
            setShowSim(false);
            openExpense({ amount:String(amount), catId, catTouched:true });
          }}/>
      )}

    </div>
  );
}