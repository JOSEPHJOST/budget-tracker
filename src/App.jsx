import { useState, useEffect } from "react";

const THRESHOLD = 2200;
const MONTH_NAMES = ["Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre"];

const round10 = v => Math.round(v / 10) * 10;
const KEY = (y, m) => `bgt_v5_${y}_${m}`;

const DEFAULT_FIXED = [
  { id: "spotify",   label: "Spotify",        icon: "🎵", amount: 70,  color: "#1DB954", deletable: false },
  { id: "sport",     label: "Salle de sport", icon: "🥊", amount: 250, color: "#4CAF7D", deletable: false },
  { id: "transport", label: "Transport",      icon: "🚗", amount: 400, color: "#7B8CDE", deletable: false },
];

const VAR_CATS = [
  { id: "epargne",  label: "Épargne",           icon: "🏦", color: "#C9A84C", std: 0.27, red: 0.18 },
  { id: "food",     label: "Nourriture / Cafés", icon: "🍽️", color: "#E07B4C", std: 0.20, red: 0.32 },
  { id: "divers",   label: "Imprévus",           icon: "🔧", color: "#8888AA", std: 0.13, red: 0.18 },
  { id: "devperso", label: "Dev perso",           icon: "📚", color: "#9B59B6", std: 0.10, red: 0.10 },
  { id: "sorties",  label: "Sorties / Amie",     icon: "🎯", color: "#E05599", std: 0.30, red: 0.22 },
];

// Catégories qui reçoivent la redistribution (hors épargne)
const REDIST_CATS = VAR_CATS.filter(c => c.id !== "epargne");

const PALETTE = ["#E05555","#E07B4C","#C9A84C","#4CAF7D","#7B8CDE","#E05599","#9B59B6","#1DB954","#8888AA"];
const SOURCE_ICONS = { "inDrive":"🚗", "Trading":"📈", "Freelance":"💻", "Autre":"💸" };

// ─── Calcul redistribution revenu externe ────────────────────────────────────
function computeExternal(externalRevenues, isReduced) {
  const total = externalRevenues.reduce((s, r) => s + r.amount, 0);
  const toEpargne = round10(total * 0.5);
  const toRedist  = total * 0.5;

  // Poids normalisés des catégories hors épargne
  const weights = REDIST_CATS.map(c => isReduced ? c.red : c.std);
  const sumW    = weights.reduce((s, w) => s + w, 0);

  const redistMap = {};
  REDIST_CATS.forEach((c, i) => {
    redistMap[c.id] = round10(toRedist * (weights[i] / sumW));
  });
  redistMap["epargne"] = toEpargne;

  return { total, toEpargne, toRedist: round10(toRedist), redistMap };
}

// ─── ARC GAUGE ───────────────────────────────────────────────────────────────
function ArcGauge({ pct }) {
  const r = 52, cx = 64, cy = 64, sa = -210, sw = 240;
  const rad = d => d * Math.PI / 180;
  const pt  = a => ({ x: cx + r * Math.cos(rad(a)), y: cy + r * Math.sin(rad(a)) });
  const ep  = Math.min(pct, 1);
  const e   = pt(sa + sw * ep);
  const col = pct > 0.9 ? "#E05555" : pct > 0.7 ? "#E07B4C" : "#C9A84C";
  return (
    <svg width="120" height="96" viewBox="0 0 128 90">
      <path d={`M ${pt(sa).x} ${pt(sa).y} A ${r} ${r} 0 1 1 ${pt(sa+sw).x} ${pt(sa+sw).y}`}
        fill="none" stroke="#1E1E30" strokeWidth="9" strokeLinecap="round"/>
      {ep > 0 && <path d={`M ${pt(sa).x} ${pt(sa).y} A ${r} ${r} 0 ${sw*ep>180?1:0} 1 ${e.x} ${e.y}`}
        fill="none" stroke={col} strokeWidth="9" strokeLinecap="round"/>}
    </svg>
  );
}

function Bar({ pct, color }) {
  const c = pct > 1 ? "#E05555" : pct > 0.8 ? "#E07B4C" : color;
  return (
    <div style={{ height:5, background:"#1E1E30", borderRadius:99, overflow:"hidden", marginTop:8 }}>
      <div style={{ height:"100%", width:`${Math.min(pct*100,100)}%`, background:c, borderRadius:99, transition:"width 0.4s" }}/>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [income, setIncome]       = useState(THRESHOLD);
  const [editingIncome, setEditingIncome] = useState(false);
  const [tempIncome, setTempIncome]       = useState("");
  const [fixedCustom, setFixedCustom]     = useState([]);
  const [expenses, setExpenses]           = useState([]);
  const [externalRevenues, setExternalRevenues] = useState([]);
  const [tab, setTab] = useState("budget");
  const [showAddExp,   setShowAddExp]   = useState(false);
  const [showAddFixed, setShowAddFixed] = useState(false);
  const [showAddExt,   setShowAddExt]   = useState(false);
  const [form,   setForm]   = useState({ amount:"", catId:"food", note:"" });
  const [fxForm, setFxForm] = useState({ label:"", amount:"", icon:"💳", color:"#7B8CDE" });
  const [extForm, setExtForm] = useState({ amount:"", source:"inDrive", customSource:"" });

  const storageKey = KEY(year, month);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const d = JSON.parse(raw);
        setIncome(d.income ?? THRESHOLD);
        setFixedCustom(d.fixedCustom ?? []);
        setExpenses(d.expenses ?? []);
        setExternalRevenues(d.externalRevenues ?? []);
      } else {
        setIncome(THRESHOLD); setFixedCustom([]); setExpenses([]); setExternalRevenues([]);
      }
    } catch {
      setIncome(THRESHOLD); setFixedCustom([]); setExpenses([]); setExternalRevenues([]);
    }
  }, [storageKey]);

  const persist = (inc, fc, exp, ext) =>
    localStorage.setItem(storageKey, JSON.stringify({ income:inc, fixedCustom:fc, expenses:exp, externalRevenues:ext }));

  // ── Budget logic ─────────────────────────────────────────────────────────
  const isReduced   = income < THRESHOLD;
  const allFixed    = [...DEFAULT_FIXED, ...fixedCustom];
  const totalFixed  = allFixed.reduce((s, f) => s + f.amount, 0);
  const available   = Math.max(income - totalFixed, 0);

  const varBudgets = VAR_CATS.map(c => ({
    ...c,
    budget: round10(available * (isReduced ? c.red : c.std)),
  }));

  const { total: extTotal, toEpargne, toRedist, redistMap } =
    computeExternal(externalRevenues, isReduced);

  // Budget effectif = budget de base + bonus externe
  const allCats = [
    ...allFixed.map(f => ({ ...f, type:"fixed", budget:f.amount, bonus:0 })),
    ...varBudgets.map(v => ({
      ...v, type:"variable",
      bonus: redistMap[v.id] || 0,
      budget: v.budget + (redistMap[v.id] || 0),
    })),
  ];

  const spentMap = allCats.reduce((acc, c) => {
    acc[c.id] = expenses.filter(e => e.catId === c.id).reduce((s, e) => s + e.amount, 0);
    return acc;
  }, {});

  const totalBudget = allCats.reduce((s, c) => s + c.budget, 0);
  const totalSpent  = Object.values(spentMap).reduce((s, v) => s + v, 0);
  const totalIncome = income + extTotal;
  const restant     = totalIncome - totalSpent;
  const gaugePct    = totalBudget > 0 ? Math.min(totalSpent / totalBudget, 1.2) : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────
  const confirmIncome = () => {
    const v = Number(tempIncome);
    if (v > 0) { setIncome(v); persist(v, fixedCustom, expenses, externalRevenues); }
    setEditingIncome(false);
  };

  const addExpense = () => {
    if (!form.amount || Number(form.amount) <= 0) return;
    const e = { id:Date.now(), amount:Number(form.amount), catId:form.catId, note:form.note, date:new Date().toISOString() };
    const updated = [e, ...expenses];
    setExpenses(updated);
    persist(income, fixedCustom, updated, externalRevenues);
    setForm({ amount:"", catId:"food", note:"" });
    setShowAddExp(false);
  };

  const delExpense = id => {
    const updated = expenses.filter(e => e.id !== id);
    setExpenses(updated);
    persist(income, fixedCustom, updated, externalRevenues);
  };

  const addFixed = () => {
    if (!fxForm.label || Number(fxForm.amount) <= 0) return;
    const f = { id:`fx_${Date.now()}`, label:fxForm.label, icon:fxForm.icon, amount:Number(fxForm.amount), color:fxForm.color, deletable:true };
    const updated = [...fixedCustom, f];
    setFixedCustom(updated);
    persist(income, updated, expenses, externalRevenues);
    setFxForm({ label:"", amount:"", icon:"💳", color:"#7B8CDE" });
    setShowAddFixed(false);
  };

  const delFixed = id => {
    const upFC  = fixedCustom.filter(f => f.id !== id);
    const upExp = expenses.filter(e => e.catId !== id);
    setFixedCustom(upFC); setExpenses(upExp);
    persist(income, upFC, upExp, externalRevenues);
  };

  const addExternal = () => {
    if (Number(extForm.amount) <= 0) return;
    const label = extForm.source === "Autre" ? extForm.customSource || "Autre" : extForm.source;
    const r = { id:Date.now(), amount:Number(extForm.amount), source:label, date:new Date().toISOString() };
    const updated = [...externalRevenues, r];
    setExternalRevenues(updated);
    persist(income, fixedCustom, expenses, updated);
    setExtForm({ amount:"", source:"inDrive", customSource:"" });
    setShowAddExt(false);
  };

  const delExternal = id => {
    const updated = externalRevenues.filter(r => r.id !== id);
    setExternalRevenues(updated);
    persist(income, fixedCustom, expenses, updated);
  };

  const prevM = () => { if(month===0){setYear(y=>y-1);setMonth(11);}else setMonth(m=>m-1); };
  const nextM = () => { if(month===11){setYear(y=>y+1);setMonth(0);}else setMonth(m=>m+1); };
  const fmtDate = iso => { const d=new Date(iso); return `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0,3)}`; };

  // ── Styles ────────────────────────────────────────────────────────────────
  const g = {
    app:    { background:"#08080F", minHeight:"100vh", fontFamily:"'Inter',system-ui,sans-serif", color:"#fff", maxWidth:430, margin:"0 auto", paddingBottom:110 },
    hdr:    { background:"#08080F", padding:"14px 18px 10px", position:"sticky", top:0, zIndex:20, borderBottom:"1px solid #1A1A28" },
    hero:   { margin:"14px 14px 0", background:"linear-gradient(135deg,#101020,#181830)", borderRadius:22, padding:"18px 20px", border:"1px solid #222238" },
    card:   { background:"#101020", borderRadius:16, padding:"13px 15px", marginBottom:9, border:"1px solid #1A1A28" },
    sec:    { padding:"14px 14px 0" },
    tabBar: { display:"flex", margin:"14px 14px 0", gap:7 },
    tabBtn: a => ({ flex:1, padding:"9px 4px", border:"none", borderRadius:10, cursor:"pointer", fontWeight:600, fontSize:11, background:a?"#C9A84C":"#131320", color:a?"#08080F":"#6666AA", letterSpacing:0.3 }),
    overlay:{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:200, display:"flex", alignItems:"flex-end" },
    modal:  { background:"#101020", borderRadius:"22px 22px 0 0", padding:"24px 20px", width:"100%", maxWidth:430, margin:"0 auto", border:"1px solid #222238", boxSizing:"border-box" },
    inp:    { width:"100%", background:"#08080F", border:"1px solid #222238", borderRadius:11, padding:"11px 13px", color:"#fff", fontSize:15, marginBottom:13, boxSizing:"border-box", outline:"none" },
    sel:    { width:"100%", background:"#08080F", border:"1px solid #222238", borderRadius:11, padding:"11px 13px", color:"#fff", fontSize:14, marginBottom:13, boxSizing:"border-box", outline:"none" },
    lbl:    { color:"#6666AA", fontSize:10, marginBottom:5, display:"block", textTransform:"uppercase", letterSpacing:1.2 },
    fab:    { position:"fixed", bottom:24, right:18, width:54, height:54, borderRadius:"50%", background:"#C9A84C", border:"none", color:"#08080F", fontSize:26, cursor:"pointer", boxShadow:"0 4px 24px rgba(201,168,76,0.45)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 },
    fab2:   { position:"fixed", bottom:24, right:84,  width:54, height:54, borderRadius:"50%", background:"#131320", border:"1px solid #222238", color:"#C9A84C", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 },
    fab3:   { position:"fixed", bottom:24, right:150, width:54, height:54, borderRadius:"50%", background:"#131320", border:"1px solid #222238", color:"#4CAF7D", fontSize:20, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 },
    badge:  bg => ({ fontSize:9, fontWeight:700, letterSpacing:1, padding:"2px 7px", borderRadius:99, background:bg+"22", color:bg, border:`1px solid ${bg}44`, display:"inline-block" }),
    row:    { display:"flex", alignItems:"center", justifyContent:"space-between" },
    sh:     { fontSize:10, fontWeight:700, letterSpacing:1.5, color:"#6666AA", textTransform:"uppercase", marginBottom:10, marginTop:4 },
  };

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
            <div style={{ fontSize:11, color:"#8888AA", marginTop:2 }}>Revenu &lt; 2 200 MAD — priorité aux essentiels.</div>
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

      {/* ── TABS ───────────────────────────── */}
      <div style={g.tabBar}>
        {[["budget","Budget"],["history","Dépenses"],["external","Revenus +"],["fixed","Charges"],["summary","Bilan"]].map(([k,l]) => (
          <button key={k} style={g.tabBtn(tab===k)} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {/* ════════════════════════════════
          BUDGET TAB
      ════════════════════════════════ */}
      {tab==="budget" && (
        <div style={g.sec}>
          <div style={g.sh}>🔒 Charges fixes — {round10(totalFixed)} MAD</div>
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
                <Bar pct={p} color={c.color}/>
              </div>
            );
          })}
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
        </div>
      )}

      {/* ── FABs ───────────────────────────── */}
      <button style={g.fab3} onClick={()=>setShowAddExt(true)}   title="Revenu externe">💸</button>
      <button style={g.fab2} onClick={()=>setShowAddFixed(true)} title="Charge fixe">⊕</button>
      <button style={g.fab}  onClick={()=>setShowAddExp(true)}>+</button>

      {/* ── MODAL : DÉPENSE ─────────────────── */}
      {showAddExp && (
        <div style={g.overlay} onClick={()=>setShowAddExp(false)}>
          <div style={g.modal} onClick={e=>e.stopPropagation()}>
            <div style={{ fontWeight:800, fontSize:17, marginBottom:18 }}>➕ Nouvelle dépense</div>
            <label style={g.lbl}>Montant (MAD)</label>
            <input style={g.inp} type="number" placeholder="0" value={form.amount}
              onChange={e=>setForm({...form,amount:e.target.value})} autoFocus/>
            <label style={g.lbl}>Catégorie</label>
            <select style={g.sel} value={form.catId} onChange={e=>setForm({...form,catId:e.target.value})}>
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

    </div>
  );
}