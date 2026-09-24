import {AbsoluteFill, Easing, interpolate, useCurrentFrame} from "remotion";

export const colors = {
  ink: "#17202e",
  muted: "#667085",
  blue: "#315efb",
  blueSoft: "#eef2ff",
  green: "#16a34a",
  mint: "#dff8e8",
  amber: "#f2a93b",
  red: "#df5b63",
  cyan: "#1498b6",
  line: "#dfe4ec",
  panel: "#ffffff",
  soft: "#f6f7f9",
};

export const SceneShell: React.FC<{
  duration: number;
  section: string;
  dark?: boolean;
  background?: string;
  children: React.ReactNode;
}> = ({duration, section, dark = false, background, children}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        opacity: interpolate(frame, [0, 14, duration - 18, duration - 1], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
        background: background ?? (dark
          ? "radial-gradient(circle at 72% 28%, #243c82 0%, #111a38 34%, #090e20 76%)"
          : "radial-gradient(circle at 82% 12%, #e5ebff 0%, #f6f7f9 34%, #f2f4f8 100%)"),
        color: dark ? "white" : colors.ink,
        fontFamily: "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
      }}
    >
      <AbsoluteFill
        style={{
          opacity: dark ? 0.12 : 0.38,
          backgroundImage: "linear-gradient(rgba(49,94,251,.10) 1px, transparent 1px), linear-gradient(90deg, rgba(49,94,251,.10) 1px, transparent 1px)",
          backgroundSize: "72px 72px",
          translate: `${interpolate(frame, [0, duration], [0, -36])}px ${interpolate(frame, [0, duration], [0, -20])}px`,
        }}
      />
      <div style={{position: "absolute", top: 42, left: 72, right: 72, display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 4}}>
        <div style={{display: "flex", alignItems: "center", gap: 14}}>
          <div style={{width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 11, background: colors.blue, color: "white", fontWeight: 900, fontSize: 18, boxShadow: "0 10px 26px rgba(49,94,251,.28)"}}>J</div>
          <div style={{fontSize: 19, fontWeight: 900, letterSpacing: "-0.02em"}}>Email Automation Jev</div>
        </div>
        <div style={{fontSize: 14, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: dark ? "#b7c4f6" : colors.blue}}>{section}</div>
      </div>
      <div style={{position: "absolute", inset: "112px 72px 62px", zIndex: 2}}>{children}</div>
      <div style={{position: "absolute", left: 72, right: 72, bottom: 30, height: 3, borderRadius: 999, background: dark ? "rgba(255,255,255,.12)" : "rgba(23,32,46,.08)"}}>
        <div style={{height: "100%", width: `${interpolate(frame, [0, duration - 1], [0, 100], {extrapolateRight: "clamp"})}%`, borderRadius: 999, background: colors.blue}} />
      </div>
    </AbsoluteFill>
  );
};

export const BrowserWindow: React.FC<{children: React.ReactNode; title?: string; style?: React.CSSProperties}> = ({children, title = "email-automation.local", style}) => (
  <div style={{overflow: "hidden", border: `1px solid ${colors.line}`, borderRadius: 24, background: "white", boxShadow: "0 28px 80px rgba(23,32,46,.16)", ...style}}>
    <div style={{height: 58, display: "flex", alignItems: "center", gap: 12, padding: "0 20px", borderBottom: `1px solid ${colors.line}`, background: "#fbfcfe"}}>
      <div style={{display: "flex", gap: 8}}><i style={{width: 11, height: 11, borderRadius: 99, background: "#ff6b6b"}} /><i style={{width: 11, height: 11, borderRadius: 99, background: "#ffc857"}} /><i style={{width: 11, height: 11, borderRadius: 99, background: "#58c978"}} /></div>
      <div style={{margin: "0 auto", minWidth: 360, padding: "9px 24px", borderRadius: 10, background: "#f0f2f6", color: colors.muted, textAlign: "center", fontSize: 14, fontWeight: 650}}>{title}</div>
      <div style={{width: 65}} />
    </div>
    {children}
  </div>
);

export const Kicker: React.FC<{children: React.ReactNode; light?: boolean}> = ({children, light = false}) => (
  <div style={{color: light ? "#9fb3ff" : colors.blue, fontSize: 18, fontWeight: 900, letterSpacing: ".13em", textTransform: "uppercase"}}>{children}</div>
);

export const Stat: React.FC<{value: string; label: string; accent?: string}> = ({value, label, accent = colors.blue}) => (
  <div style={{minWidth: 210, padding: "24px 28px", border: `1px solid ${colors.line}`, borderRadius: 20, background: "rgba(255,255,255,.92)", boxShadow: "0 14px 34px rgba(23,32,46,.07)"}}>
    <div style={{fontSize: 48, fontWeight: 950, letterSpacing: "-.05em", color: accent}}>{value}</div>
    <div style={{marginTop: 5, color: colors.muted, fontSize: 16, fontWeight: 750}}>{label}</div>
  </div>
);

export const Pill: React.FC<{children: React.ReactNode; color?: string}> = ({children, color = colors.blue}) => (
  <span style={{display: "inline-flex", alignItems: "center", padding: "8px 14px", borderRadius: 999, background: `${color}18`, color, fontSize: 14, fontWeight: 850}}>{children}</span>
);
