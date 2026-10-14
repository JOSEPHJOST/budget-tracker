import { g } from "./styles.js";

// ─── ARC GAUGE ───────────────────────────────────────────────────────────────
export function ArcGauge({ pct }) {
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

/** Barre de progression ; `marker` (0..1) affiche où on "devrait" être aujourd'hui. */
export function Bar({ pct, color, marker }) {
  const c = pct > 1 ? "#E05555" : pct > 0.8 ? "#E07B4C" : color;
  return (
    <div style={{ position:"relative", marginTop:8 }}>
      <div style={{ height:5, background:"#1E1E30", borderRadius:99, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${Math.min(pct*100,100)}%`, background:c, borderRadius:99, transition:"width 0.4s" }}/>
      </div>
      {marker != null && marker > 0 && marker < 1 && (
        <div title="Rythme idéal à ce jour"
          style={{ position:"absolute", top:-2, left:`${marker*100}%`, width:2, height:9, background:"#ffffff88", borderRadius:1 }}/>
      )}
    </div>
  );
}

export function Modal({ onClose, children }) {
  return (
    <div style={g.overlay} onClick={onClose}>
      <div style={g.modal} onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  );
}
