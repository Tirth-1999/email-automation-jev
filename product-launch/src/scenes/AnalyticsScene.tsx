import {interpolate, useCurrentFrame} from "remotion";
import {Kicker, SceneShell, colors} from "../components/SceneShell";

const outcomes = [
  {n: "Applied", v: 963, c: "#315efb"}, {n: "Reply", v: 187, c: "#ef6b32"},
  {n: "Interview", v: 133, c: "#1498b6"}, {n: "Offer", v: 12, c: "#16a34a"},
  {n: "Rejected", v: 930, c: "#df5b63"}, {n: "Ghosted", v: 2259, c: "#8b95a5"},
];

export const AnalyticsScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const reveal = interpolate(frame, [10, 150], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp"});
  let y = 28;
  return <SceneShell duration={duration} section="Analytics" background="#ffffff">
    <div>
      <div style={{display: "flex", justifyContent: "space-between", alignItems: "end", marginBottom: 22}}>
        <div><Kicker>Know what is moving</Kicker><h2 style={{fontSize: 54, letterSpacing: "-.05em", margin: "10px 0 0"}}>Your search, explained.</h2></div>
        <div style={{display: "flex", gap: 10}}>{["30 days", "90 days", "All time"].map((x, i) => <span key={x} style={{padding: "10px 15px", borderRadius: 11, background: i === 2 ? colors.blue : "white", color: i === 2 ? "white" : colors.muted, border: `1px solid ${i === 2 ? colors.blue : colors.line}`, fontWeight: 800, fontSize: 14}}>{x}</span>)}</div>
      </div>
      <div style={{display: "grid", gridTemplateColumns: "1.25fr .75fr", gap: 20, height: 680}}>
        <div style={{background: "white", border: `1px solid ${colors.line}`, borderRadius: 24, padding: 26, boxShadow: "0 16px 42px rgba(23,32,46,.07)"}}>
          <div style={{display: "flex", justifyContent: "space-between"}}><div><b style={{fontSize: 20}}>Where every application stands</b><div style={{fontSize: 13, color: colors.muted, marginTop: 5}}>Ribbon width equals the current-status pool</div></div><b style={{color: colors.muted}}>4,484 applications</b></div>
          <svg viewBox="0 0 1000 520" style={{width: "100%", height: 540, overflow: "visible"}}><rect x="75" y="180" width="34" height="230" rx="8" fill={colors.ink}/><text x="20" y="165" fill={colors.ink} fontSize="20" fontWeight="800">All applications</text>{outcomes.map((o, i) => {const h = Math.max(8, o.v / 4484 * 230); const start = y; y += h + 17; const targetY = 35 + i * 78; return <g key={o.n} opacity={reveal}><path d={`M109 ${180 + start} C 380 ${180 + start}, 610 ${targetY}, 840 ${targetY} L 840 ${targetY + h} C 610 ${targetY + h}, 380 ${180 + start + h}, 109 ${180 + start + h} Z`} fill={o.c} opacity=".55"/><rect x="840" y={targetY} width="25" height={h} rx="5" fill={o.c} opacity=".22" stroke={o.c}/><text x="885" y={targetY + Math.max(16, h / 2)} fill={colors.ink} fontSize="17" fontWeight="800">{o.n} · {o.v.toLocaleString()}</text></g>;})}</svg>
        </div>
        <div style={{display: "grid", gridTemplateRows: "repeat(2,1fr)", gap: 20}}>
          <div style={{background: "white", color: colors.ink, border: `1px solid ${colors.line}`, borderRadius: 24, padding: 25, overflow: "hidden", boxShadow: "0 16px 42px rgba(23,32,46,.06)"}}><div style={{fontSize: 16, fontWeight: 850}}>Application activity</div><div style={{display: "flex", height: 210, alignItems: "end", gap: 11, marginTop: 24}}>{[32,48,38,70,62,93,76,110,88,124,116,145].map((v, i) => <div key={i} style={{flex: 1, height: `${v * reveal}px`, maxHeight: 180, borderRadius: "6px 6px 2px 2px", background: i > 8 ? colors.blue : "#c8d4ff"}}/>)}</div><div style={{display: "flex", justifyContent: "space-between", fontSize: 11, color: colors.muted, marginTop: 8}}><span>Oct</span><span>Today</span></div></div>
          <div style={{background: "white", border: `1px solid ${colors.line}`, borderRadius: 24, padding: 25, boxShadow: "0 16px 42px rgba(23,32,46,.06)"}}><div style={{fontSize: 16, fontWeight: 850}}>Signal at a glance</div><div style={{display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 20}}>{[["21%","Applied",colors.blue],["4%","Need action","#ef6b32"],["3%","Interview",colors.cyan],["12","Offers",colors.green]].map((x) => <div key={x[1]} style={{padding: 18, borderRadius: 15, background: `${x[2]}12`}}><div style={{fontSize: 32, fontWeight: 950, color: x[2]}}>{x[0]}</div><div style={{fontSize: 12, color: colors.muted, fontWeight: 800}}>{x[1]}</div></div>)}</div></div>
        </div>
      </div>
    </div>
  </SceneShell>;
};
