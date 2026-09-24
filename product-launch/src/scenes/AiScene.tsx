import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Kicker, SceneShell, colors} from "../components/SceneShell";

export const AiScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const final = spring({frame: frame - 120, fps, config: {damping: 18, stiffness: 90}});
  const typed = "You have 14 applications needing attention. Three recruiter replies are highest priority.";
  const chars = Math.floor(interpolate(frame, [25, 90], [0, typed.length], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}));
  return <SceneShell duration={duration} section="AI Space" dark>
    <div style={{height: "100%", position: "relative"}}>
      <div style={{display: "grid", gridTemplateColumns: ".72fr 1.28fr", gap: 42, opacity: interpolate(frame, [92, 122], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}), filter: `blur(${interpolate(frame, [95, 122], [0, 13], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}px)`}}>
        <div><Kicker light>Grounded intelligence</Kicker><h2 style={{fontSize: 64, lineHeight: 1.02, letterSpacing: "-.055em", margin: "20px 0 24px"}}>Ask your pipeline.<br/>Draft the reply.</h2><p style={{fontSize: 20, lineHeight: 1.5, color: "#bdc8e9"}}>AI uses your structured application data—while Jev remains the fast decision layer.</p><div style={{display: "flex", gap: 12, marginTop: 32}}><span style={{padding: "12px 16px", borderRadius: 12, background: "rgba(255,255,255,.1)", fontWeight: 800}}>AI Brain</span><span style={{padding: "12px 16px", borderRadius: 12, background: colors.blue, fontWeight: 800}}>AI Chat</span></div></div>
        <div style={{height: 590, borderRadius: 28, background: "rgba(255,255,255,.96)", color: colors.ink, overflow: "hidden", boxShadow: "0 30px 100px rgba(0,0,0,.25)"}}>
          <div style={{height: 70, padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${colors.line}`}}><b>Mailbox copilot</b><span style={{fontSize: 12, fontWeight: 900, color: colors.green}}>● READY</span></div>
          <div style={{padding: 28}}><div style={{marginLeft: "auto", width: "fit-content", padding: "16px 20px", borderRadius: "20px 20px 5px 20px", background: colors.blue, color: "white", fontSize: 17}}>What needs my attention today?</div><div style={{marginTop: 22, width: "82%", minHeight: 110, padding: "18px 20px", borderRadius: "20px 20px 20px 5px", background: "#eef2f7", fontSize: 17, lineHeight: 1.55}}>{typed.slice(0, chars)}<span style={{opacity: frame % 20 < 10 ? 1 : 0, color: colors.blue}}>▌</span></div><div style={{display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 26}}>{[["14","need attention"],["3","priority replies"],["2","interviews"]].map((x) => <div key={x[1]} style={{padding: 18, borderRadius: 16, border: `1px solid ${colors.line}`, background: "white"}}><b style={{fontSize: 29, color: colors.blue}}>{x[0]}</b><div style={{fontSize: 12, color: colors.muted, marginTop: 4}}>{x[1]}</div></div>)}</div></div>
        </div>
      </div>
      <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", opacity: final, transform: `scale(${interpolate(final, [0, 1], [.86, 1])})`}}><div><div style={{width: 86, height: 86, margin: "0 auto 28px", borderRadius: 25, display: "grid", placeItems: "center", background: colors.blue, boxShadow: "0 24px 65px rgba(49,94,251,.42)", fontSize: 44, fontWeight: 950}}>J</div><Kicker light>Email Automation Jev</Kicker><h2 style={{fontSize: 82, lineHeight: .98, letterSpacing: "-.06em", margin: "20px 0 26px"}}>Turn inbox noise<br/><span style={{color: "#9fb3ff"}}>into momentum.</span></h2><p style={{fontSize: 23, color: "#c7d1ef"}}>One inbox. One pipeline. Every opportunity in focus.</p><div style={{marginTop: 34, display: "inline-flex", gap: 12, alignItems: "center", padding: "15px 22px", borderRadius: 15, background: "white", color: colors.ink, fontWeight: 900, fontSize: 17}}>Built with Jev <span style={{color: colors.blue}}>→</span></div></div></div>
    </div>
  </SceneShell>;
};
