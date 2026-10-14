import { fmt, round10, MONTH_NAMES } from "../lib/budget.js";
import { MIN_DAYS_FOR_PACE } from "../lib/forecast.js";
import { g } from "./styles.js";

// "Pouls du mois" : ce qu'on peut dépenser aujourd'hui et les catégories
// qui vont déborder si le rythme actuel continue.
export default function PulseCard({ forecast, month, onSimulate }) {
  const { period, leftToday, dailyAllowance, daysLeft, perCat, paceReliable, projectedTotal, budgetTotal, day } = forecast;
  if (period === "future") return null;

  const alerts = perCat.filter(c => c.status !== "ok")
    .sort((a, b) => (b.status === "over") - (a.status === "over") || (a.overrunDay ?? 0) - (b.overrunDay ?? 0));
  const monthShort = MONTH_NAMES[month].toLowerCase();

  if (period === "past") {
    const delta = budgetTotal - perCat.reduce((s, c) => s + c.spent, 0);
    return (
      <div style={{ ...g.card, margin:"10px 14px 0" }}>
        <div style={{ fontSize:12, color:"#8888AA" }}>
          Mois clôturé — dépenses variables {delta >= 0
            ? <span style={{ color:"#4CAF7D", fontWeight:700 }}>{fmt(delta)} MAD sous le budget</span>
            : <span style={{ color:"#E05555", fontWeight:700 }}>{fmt(-delta)} MAD au-dessus du budget</span>}
        </div>
      </div>
    );
  }

  const todayColor = leftToday < 0 ? "#E05555" : leftToday < dailyAllowance * 0.25 ? "#E07B4C" : "#4CAF7D";

  return (
    <div style={{ ...g.card, margin:"10px 14px 0", padding:"14px 15px" }}>
      <div style={g.row}>
        <div>
          <div style={{ color:"#6666AA", fontSize:10, textTransform:"uppercase", letterSpacing:1.5 }}>Aujourd'hui tu peux dépenser</div>
          <div style={{ fontSize:24, fontWeight:800, color:todayColor, marginTop:3, fontVariantNumeric:"tabular-nums" }}>
            {leftToday < 0 ? `−${fmt(-leftToday)}` : fmt(leftToday)} <span style={{ fontSize:12, color:"#6666AA", fontWeight:400 }}>MAD</span>
          </div>
          <div style={{ fontSize:11, color:"#6666AA", marginTop:2 }}>
            ≈ {fmt(dailyAllowance)} MAD/jour · {daysLeft} jour{daysLeft > 1 ? "s" : ""} restant{daysLeft > 1 ? "s" : ""}
          </div>
        </div>
        <button onClick={onSimulate}
          style={{ background:"#C9A84C18", border:"1px solid #C9A84C55", color:"#C9A84C", borderRadius:12, padding:"9px 11px", fontWeight:700, fontSize:11, cursor:"pointer", lineHeight:1.3, maxWidth:120 }}>
          🤔 Puis-je me le permettre ?
        </button>
      </div>

      <div style={{ borderTop:"1px solid #1A1A28", marginTop:12, paddingTop:10 }}>
        {!paceReliable ? (
          <div style={{ fontSize:11, color:"#6666AA" }}>
            🔮 Prévisions disponibles à partir du {MIN_DAYS_FOR_PACE} {monthShort} (jour {day}/{MIN_DAYS_FOR_PACE}).
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ fontSize:12, color:"#4CAF7D" }}>
            🔮 Au rythme actuel, tu finis le mois à ~{fmt(round10(projectedTotal))} / {fmt(budgetTotal)} MAD. Tout tient.
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, color:"#6666AA", marginBottom:6 }}>🔮 Au rythme actuel :</div>
            {alerts.map(a => (
              <div key={a.id} style={{ display:"flex", justifyContent:"space-between", fontSize:12, padding:"3px 0" }}>
                <span style={{ color:"#CCCCDD" }}>{a.icon} {a.label}</span>
                {a.status === "over"
                  ? <span style={{ color:"#E05555", fontWeight:700 }}>dépassé de {fmt(a.spent - a.budget)}</span>
                  : <span style={{ color:"#E07B4C", fontWeight:700 }}>vide le {a.overrunDay} {monthShort}</span>}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
