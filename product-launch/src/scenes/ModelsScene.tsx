import {interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Kicker, SceneShell, colors} from "../components/SceneShell";

const models = [
  {name: "Choice", question: "Which lane fits best?", result: "Interview / Assessment", confidence: "94%", color: "#315efb", symbol: "C"},
  {name: "Score", question: "How urgent is it?", result: "High priority", confidence: "8.7 / 10", color: "#f2a93b", symbol: "S"},
  {name: "Noul", question: "Does this need a reply?", result: "Yes", confidence: "91%", color: "#16a34a", symbol: "N"},
];

export const ModelsScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return <SceneShell duration={duration} section="Jev models">
    <div style={{height: "100%", display: "grid", gridTemplateRows: "auto 1fr", gap: 30}}>
      <div style={{display: "flex", alignItems: "end", justifyContent: "space-between"}}>
        <div><Kicker>Not one generic prompt</Kicker><h2 style={{fontSize: 58, lineHeight: 1, letterSpacing: "-.055em", margin: "14px 0 0"}}>Three focused models. One better decision.</h2></div>
        <div style={{maxWidth: 430, color: colors.muted, fontSize: 18, lineHeight: 1.5}}>Each model answers one narrow question, then code combines the typed results.</div>
      </div>
      <div style={{display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, alignItems: "center"}}>
        {models.map((model, index) => {
          const enter = spring({frame: frame - 12 - index * 16, fps, config: {damping: 17, stiffness: 105}});
          const pulse = interpolate((frame - index * 8) % 60, [0, 30, 59], [0, 1, 0]);
          return <div key={model.name} style={{height: 520, padding: 28, borderRadius: 28, background: "white", border: `1px solid ${colors.line}`, boxShadow: `0 24px 64px rgba(23,32,46,${.08 + pulse * .05})`, opacity: enter, transform: `translateY(${(1 - enter) * 48}px)`}}>
            <div style={{display: "flex", alignItems: "center", justifyContent: "space-between"}}><div style={{width: 64, height: 64, borderRadius: 20, display: "grid", placeItems: "center", background: model.color, color: "white", fontSize: 30, fontWeight: 950, boxShadow: `0 15px 36px ${model.color}55`}}>{model.symbol}</div><span style={{padding: "8px 12px", borderRadius: 99, background: `${model.color}16`, color: model.color, fontSize: 13, fontWeight: 900}}>SYSTEM ONE</span></div>
            <h3 style={{fontSize: 38, margin: "34px 0 8px", letterSpacing: "-.04em"}}>{model.name}</h3>
            <div style={{fontSize: 17, color: colors.muted, lineHeight: 1.45}}>{model.question}</div>
            <div style={{marginTop: 44, padding: 22, borderRadius: 18, background: "#f5f7fa", border: `1px solid ${colors.line}`}}><div style={{fontSize: 12, color: colors.muted, fontWeight: 900, letterSpacing: ".1em"}}>TYPED RESULT</div><div style={{fontSize: 23, fontWeight: 900, marginTop: 13}}>{model.result}</div></div>
            <div style={{marginTop: 22}}><div style={{display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 850}}><span>Confidence</span><span style={{color: model.color}}>{model.confidence}</span></div><div style={{height: 10, borderRadius: 99, background: "#e8ecf2", marginTop: 10, overflow: "hidden"}}><div style={{height: "100%", width: `${interpolate(frame, [36 + index * 16, 115 + index * 16], [0, index === 1 ? 87 : index === 0 ? 94 : 91], {extrapolateLeft: "clamp", extrapolateRight: "clamp"})}%`, borderRadius: 99, background: model.color}}/></div></div>
          </div>;
        })}
      </div>
    </div>
  </SceneShell>;
};
