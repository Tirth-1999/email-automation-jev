import {interpolate, useCurrentFrame} from "remotion";
import {Kicker, SceneShell, colors} from "../components/SceneShell";

const mails = ["Thanks for applying","Action required","Interview schedule","Complete this assessment","Application update","Following up","Your offer letter","New role for you","We received your application","One more step"];
export const ChaosScene: React.FC<{duration:number}> = ({duration}) => {
  const frame=useCurrentFrame();
  const chaos=interpolate(frame,[0,190,360],[0,1,.3],{extrapolateRight:"clamp"});
  return <SceneShell duration={duration} section="The problem">
    <div style={{height:"100%",display:"grid",gridTemplateColumns:".86fr 1.14fr",alignItems:"center",gap:70}}>
      <div><Kicker>Inbox overload</Kicker><h2 style={{fontSize:75,lineHeight:1.02,letterSpacing:"-.055em",margin:"22px 0 28px"}}>Opportunity is hiding in plain sight.</h2><p style={{fontSize:24,lineHeight:1.5,color:colors.muted}}>Applications, interviews, requests, and rejections arrive in the same endless stream.</p>
        <div style={{display:"flex",gap:16,marginTop:38}}>{["Missed replies","Scattered context","No clear pipeline"].map((x,i)=><div key={x} style={{padding:"15px 18px",borderRadius:14,background:["#fff0f1","#fff7e6","#eef2ff"][i],fontSize:15,fontWeight:850,color:[colors.red,"#b56d00",colors.blue][i]}}>{x}</div>)}</div>
      </div>
      <div style={{height:720,position:"relative",perspective:1000}}>
        {Array.from({length:22},(_,i)=>{const y=(i*69+frame*(1.4+i%3*.3))%760-45;const x=(i%4)*125+Math.sin((frame+i*17)/22)*36;return <div key={i} style={{position:"absolute",left:x,right:20+(i%3)*34,top:y,height:72,borderRadius:16,border:`1px solid ${colors.line}`,background:"rgba(255,255,255,.94)",boxShadow:`0 ${8+chaos*10}px ${22+chaos*22}px rgba(23,32,46,.10)`,padding:"15px 18px",transform:`rotate(${Math.sin(i*4.2)*chaos*3}deg) translateZ(${(i%5)*4}px)`,display:"flex",alignItems:"center",gap:14}}><div style={{width:38,height:38,borderRadius:12,background:i%5===0?"#ffe8e9":"#eef2ff",color:i%5===0?colors.red:colors.blue,display:"grid",placeItems:"center",fontWeight:950}}>M</div><div><div style={{fontWeight:850,fontSize:16}}>{mails[i%mails.length]}</div><div style={{fontSize:12,color:colors.muted,marginTop:5}}>unread • just now</div></div></div>})}
        <div style={{position:"absolute",inset:0,background:"linear-gradient(transparent 74%, #f3f5f8 98%)"}}/>
      </div>
    </div>
  </SceneShell>;
};
