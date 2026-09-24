import {Easing, interpolate, spring, useCurrentFrame, useVideoConfig} from "remotion";
import {Kicker, SceneShell, colors} from "../components/SceneShell";

export const HookScene: React.FC<{duration: number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const rise = spring({frame, fps, config: {damping: 18, stiffness: 95}});
  const count = Math.round(interpolate(frame, [25, 140], [0, 200], {extrapolateLeft: "clamp", extrapolateRight: "clamp"}));
  return <SceneShell duration={duration} section="Product launch" dark>
    <div style={{height: "100%", display: "grid", gridTemplateColumns: "1.05fr .95fr", alignItems: "center", gap: 80}}>
      <div style={{transform: `translateY(${(1-rise)*55}px)`, opacity: rise}}>
        <Kicker light>One inbox. Every opportunity.</Kicker>
        <h1 style={{fontSize: 92, lineHeight: .96, letterSpacing: "-.065em", margin: "26px 0 30px", maxWidth: 920}}>Your job search<br/><span style={{color: "#8fa8ff"}}>finally has a system.</span></h1>
        <p style={{fontSize: 25, lineHeight: 1.5, color: "#c6d0f1", maxWidth: 750, margin: 0}}>From incoming email to a clear next action—automatically.</p>
      </div>
      <div style={{position: "relative", height: 650}}>
        <div style={{position: "absolute", inset: 60, borderRadius: 300, background: "radial-gradient(circle, rgba(72,107,255,.38), transparent 67%)", transform: `scale(${interpolate(frame,[0,180],[.7,1.12],{extrapolateRight:"clamp"})})`}}/>
        {[0,1,2,3,4].map((i) => <div key={i} style={{position:"absolute", left: 40+i*58, right: 70-i*22, top: 98+i*88, height: 76, border:"1px solid rgba(255,255,255,.18)", borderRadius:18, background:"rgba(255,255,255,.09)", backdropFilter:"blur(12px)", transform:`translateX(${interpolate(frame,[i*10,100+i*12],[150,0],{extrapolateLeft:"clamp",extrapolateRight:"clamp",easing:Easing.out(Easing.cubic)})}px)`, opacity:interpolate(frame,[i*10,55+i*12],[0,1],{extrapolateLeft:"clamp",extrapolateRight:"clamp"}), display:"flex",alignItems:"center",padding:"0 24px",gap:18}}>
          <div style={{width:42,height:42,borderRadius:12,background:["#315efb","#16a34a","#f2a93b","#df5b63","#1498b6"][i],display:"grid",placeItems:"center",fontWeight:900}}>✦</div>
          <div><div style={{fontWeight:850,fontSize:17}}>{["Application received","Interview invitation","More information needed","Offer update","Recruiter outreach"][i]}</div><div style={{color:"#aeb9db",fontSize:13,marginTop:5}}>Classified • next action ready</div></div>
        </div>)}
        <div style={{position:"absolute",right:15,bottom:42,width:210,height:210,borderRadius:42,background:"white",color:colors.ink,display:"grid",placeItems:"center",boxShadow:"0 30px 90px rgba(0,0,0,.3)",transform:`rotate(${interpolate(frame,[0,160],[-9,0],{extrapolateRight:"clamp"})}deg)`}}>
          <div style={{textAlign:"center"}}><div style={{fontSize:74,fontWeight:950,letterSpacing:"-.06em",color:colors.blue}}>{count}</div><div style={{fontSize:14,fontWeight:850,color:colors.muted,textTransform:"uppercase",letterSpacing:".1em"}}>applications / day</div></div>
        </div>
      </div>
    </div>
  </SceneShell>;
};
