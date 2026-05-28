/* global React */
const { useState } = React;

const MASCOT_OPEN   = "assets/mascot.png";
const MASCOT_CLOSED = "assets/mascot-closed.png";

// ---------- Shared bits ----------

function Stage({ children, bg = "transparent" }) {
  return (
    <div style={{
      width: "100%", height: "100%", background: bg,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      position: "relative", overflow: "hidden",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      {children}
    </div>
  );
}

function Caption({ title, sub }) {
  return (
    <div style={{
      position: "absolute", bottom: 18, left: 0, right: 0,
      textAlign: "center", color: "#7a6a55", fontSize: 12,
      letterSpacing: 0.4, textTransform: "uppercase", fontWeight: 600,
    }}>
      <div style={{ color: "#3a2f24", letterSpacing: 0.6 }}>{title}</div>
      {sub ? (
        <div style={{ fontSize: 10.5, marginTop: 3, opacity: 0.7,
                      textTransform: "none", letterSpacing: 0 }}>
          {sub}
        </div>
      ) : null}
    </div>
  );
}

function Shadow({ animation, size = 110, opacity = 0.18, bottom = 80 }) {
  return (
    <div style={{
      position: "absolute", bottom, width: size, height: 14,
      borderRadius: "50%",
      background: "radial-gradient(closest-side, rgba(60,40,20,0.55), rgba(60,40,20,0))",
      opacity, filter: "blur(2px)", animation, transformOrigin: "center",
    }} />
  );
}

// Mascot image with optional blink. Drop into any animation in place of <img>.
// `blinkDelay` lets sibling mascots blink out of phase.
function MascotImg({
  size = 200, blink = true, blinkDelay = 0,
  style, animationName, transformOrigin, ...rest
}) {
  const id = String(blinkDelay).replace('.', '_');
  return (
    <div
      {...rest}
      style={{
        position: "relative",
        width: size, height: size,
        display: "inline-block",
        animation: animationName,
        transformOrigin,
        ...style,
      }}
    >
      <style>{`
        @keyframes mascot-blink-${id} {
          0%, 84%, 88%, 92%, 100% { opacity: 0; }
          86%, 90%                { opacity: 1; }
        }
      `}</style>
      <img src={MASCOT_OPEN} alt=""
        style={{ width: "100%", height: "100%", objectFit: "contain",
                 display: "block", pointerEvents: "none" }} />
      {blink ? (
        <img src={MASCOT_CLOSED} alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%", objectFit: "contain", display: "block",
            opacity: 0, pointerEvents: "none",
            animation: `mascot-blink-${id} 5.2s steps(1, end) ${blinkDelay}s infinite`,
          }} />
      ) : null}
    </div>
  );
}

// ============================================================
//                       ANIMATIONS
// ============================================================

// ---------- 0a. Alive (no blink) ----------
function Alive() {
  return (
    <Stage>
      <style>{`
        @keyframes a-bob     { 0%,100% { transform: translateY(4px); }  50% { transform: translateY(-6px); } }
        @keyframes a-breathe { 0%,100% { transform: scale(1); }         50% { transform: scale(1.04); } }
        @keyframes a-sway    { 0%,30%,100% { transform: rotate(0deg); } 40% { transform: rotate(3deg); } 55% { transform: rotate(-3deg); } 65% { transform: rotate(0deg); } }
        @keyframes a-shadow  { 0%,100% { transform: scaleX(1); opacity: .22; } 50% { transform: scaleX(.78); opacity: .1; } }
        .a-sway    { animation: a-sway 7.6s ease-in-out infinite; transform-origin: 50% 92%; }
        .a-breathe { animation: a-breathe 2.9s ease-in-out infinite; transform-origin: 50% 92%; }
        .a-bob     { animation: a-bob 3.4s ease-in-out infinite; }
      `}</style>
      <Shadow animation="a-shadow 3.4s ease-in-out infinite" opacity={1} />
      <div className="a-sway"><div className="a-breathe"><div className="a-bob">
        <MascotImg blink={false} />
      </div></div></div>
      <Caption title="Alive" sub="float · breathe · sway · no blink" />
    </Stage>
  );
}

// ---------- 0b. Alive + Blink ----------
function AliveBlink() {
  return (
    <Stage>
      <style>{`
        @keyframes ab-bob     { 0%,100% { transform: translateY(4px); }  50% { transform: translateY(-6px); } }
        @keyframes ab-breathe { 0%,100% { transform: scale(1); }         50% { transform: scale(1.04); } }
        @keyframes ab-sway    { 0%,30%,100% { transform: rotate(0deg); } 40% { transform: rotate(3deg); } 55% { transform: rotate(-3deg); } 65% { transform: rotate(0deg); } }
        @keyframes ab-shadow  { 0%,100% { transform: scaleX(1); opacity: .22; } 50% { transform: scaleX(.78); opacity: .1; } }
        .ab-sway    { animation: ab-sway 7.6s ease-in-out infinite; transform-origin: 50% 92%; }
        .ab-breathe { animation: ab-breathe 2.9s ease-in-out infinite; transform-origin: 50% 92%; }
        .ab-bob     { animation: ab-bob 3.4s ease-in-out infinite; }
      `}</style>
      <Shadow animation="ab-shadow 3.4s ease-in-out infinite" opacity={1} />
      <div className="ab-sway"><div className="ab-breathe"><div className="ab-bob">
        <MascotImg />
      </div></div></div>
      <Caption title="Alive + Blink" sub="float · breathe · sway · double-blink ~5s" />
    </Stage>
  );
}

// ---------- 1. Idle Float ----------
function Float() {
  return (
    <Stage>
      <style>{`
        @keyframes float-bob { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @keyframes float-shadow { 0%,100% { transform: scale(1); opacity: .22; } 50% { transform: scale(.82); opacity: .12; } }
      `}</style>
      <Shadow animation="float-shadow 3.4s ease-in-out infinite" opacity={1} />
      <MascotImg animationName="float-bob 3.4s ease-in-out infinite" blinkDelay={0.3} />
      <Caption title="Idle Float" sub="gentle bob · always-on" />
    </Stage>
  );
}

// ---------- 2. Breathe ----------
function Breathe() {
  return (
    <Stage>
      <style>{`@keyframes breathe-k { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }`}</style>
      <Shadow animation="" />
      <MascotImg
        animationName="breathe-k 3.6s ease-in-out infinite"
        transformOrigin="center bottom"
        blinkDelay={0.6}
      />
      <Caption title="Breathe" sub="soft scale pulse · feels alive" />
    </Stage>
  );
}

// ---------- 3. Sway ----------
function Sway() {
  return (
    <Stage>
      <style>{`@keyframes sway-k { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }`}</style>
      <Shadow animation="" />
      <MascotImg
        animationName="sway-k 4s ease-in-out infinite"
        transformOrigin="50% 92%"
        blinkDelay={0.9}
      />
      <Caption title="Sway" sub="pendulum tilt · pivot at the tip" />
    </Stage>
  );
}

// ---------- 4. Happy Bounce ----------
function Bounce() {
  return (
    <Stage>
      <style>{`
        @keyframes happy-bounce {
          0%, 70%, 100% { transform: translateY(0) scale(1, 1); }
          75%  { transform: translateY(0) scale(1.08, 0.92); }
          82%  { transform: translateY(-28px) scale(0.94, 1.08); }
          90%  { transform: translateY(0) scale(1.06, 0.94); }
          95%  { transform: translateY(0) scale(0.98, 1.02); }
        }
        @keyframes happy-shadow {
          0%, 70%, 100% { transform: scale(1); opacity: .22; }
          82%           { transform: scale(.6);  opacity: .1; }
          90%           { transform: scale(1.05);opacity: .25; }
        }
      `}</style>
      <Shadow animation="happy-shadow 3.2s ease-in-out infinite" opacity={1} />
      <MascotImg
        animationName="happy-bounce 3.2s ease-in-out infinite"
        transformOrigin="50% 92%"
        blinkDelay={1.2}
      />
      <Caption title="Happy Bounce" sub="periodic hop · loading / success" />
    </Stage>
  );
}

// ---------- 5. Jump (big airborne hop) ----------
function Jump() {
  return (
    <Stage>
      <style>{`
        @keyframes big-jump {
          0%, 60%, 100% { transform: translateY(0) scale(1, 1); }
          65%  { transform: translateY(6px)   scale(1.15, 0.78); }
          72%  { transform: translateY(-30px) scale(0.86, 1.18); }
          80%  { transform: translateY(-80px) scale(0.94, 1.06) rotate(-8deg); }
          88%  { transform: translateY(-20px) scale(0.92, 1.08) rotate(2deg); }
          92%  { transform: translateY(0)     scale(1.18, 0.74); }
          96%  { transform: translateY(0)     scale(0.96, 1.04); }
        }
        @keyframes jump-shadow {
          0%, 60%, 100% { transform: scaleX(1);   opacity: .25; }
          65%           { transform: scaleX(1.1); opacity: .3; }
          80%           { transform: scaleX(.4);  opacity: .08; }
          92%           { transform: scaleX(1.2); opacity: .32; }
        }
      `}</style>
      <Shadow animation="jump-shadow 2.8s ease-in-out infinite" opacity={1} />
      <MascotImg
        animationName="big-jump 2.8s ease-in-out infinite"
        transformOrigin="50% 92%"
        blinkDelay={1.5}
      />
      <Caption title="Jump" sub="anticipate · launch · land · success / unlock" />
    </Stage>
  );
}

// ---------- 6. Wiggle Dance (celebration — Duolingo-style side-to-side) ----------
function Wiggle() {
  return (
    <Stage>
      <style>{`
        /* Side-to-side hip wiggle, alternating skew + slight horizontal nudge.
           Anchored at the tip so the eraser end leans like dancing. */
        @keyframes wiggle-dance {
          0%, 100% { transform: translateX(0)    rotate(0deg)  skewX(0deg); }
          15%      { transform: translateX(-4px) rotate(-6deg) skewX(2deg); }
          30%      { transform: translateX(4px)  rotate(5deg)  skewX(-2deg); }
          45%      { transform: translateX(-4px) rotate(-5deg) skewX(2deg); }
          60%      { transform: translateX(4px)  rotate(6deg)  skewX(-2deg); }
          75%      { transform: translateX(-3px) rotate(-3deg) skewX(1deg); }
          90%      { transform: translateX(3px)  rotate(3deg)  skewX(-1deg); }
        }
        /* Tiny bob synced to the dance */
        @keyframes wiggle-bob {
          0%, 100% { transform: translateY(0); }
          15%, 45%, 75% { transform: translateY(-3px); }
          30%, 60%, 90% { transform: translateY(-2px); }
        }
        @keyframes wiggle-shadow {
          0%, 100% { transform: scaleX(1);    opacity: .22; }
          15%, 45%, 75% { transform: scaleX(.85); opacity: .15; }
        }
      `}</style>
      <Shadow animation="wiggle-shadow 1.8s ease-in-out infinite" opacity={1} />
      <div style={{ animation: "wiggle-bob 1.8s ease-in-out infinite" }}>
        <MascotImg
          animationName="wiggle-dance 1.8s ease-in-out infinite"
          transformOrigin="50% 95%"
          blinkDelay={1.8}
        />
      </div>
      <Caption title="Wiggle Dance" sub="happy dance · celebrate / streak / level-up" />
    </Stage>
  );
}

// ---------- 7. Sparkle ----------
function Sparkle() {
  const Star = ({ size, x, y, delay, dur, color = "#F4C73F" }) => (
    <svg width={size} height={size} viewBox="0 0 24 24"
      style={{ position: "absolute", left: x, top: y,
               animation: `twinkle ${dur}s ease-in-out ${delay}s infinite`,
               transformOrigin: "center" }}>
      <path d="M12 1.5 C 13 8, 16 11, 22.5 12 C 16 13, 13 16, 12 22.5 C 11 16, 8 13, 1.5 12 C 8 11, 11 8, 12 1.5 Z"
        fill={color} stroke="#3a2f24" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
  return (
    <Stage>
      <style>{`
        @keyframes twinkle {
          0%, 100% { transform: scale(0) rotate(0deg); opacity: 0; }
          40%      { transform: scale(1) rotate(15deg); opacity: 1; }
          70%      { transform: scale(.9) rotate(-10deg); opacity: .9; }
        }
        @keyframes float-bob-2 { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
      `}</style>
      <Shadow animation="" />
      <div style={{ position: "relative", width: 240, height: 240 }}>
        <MascotImg
          size={200}
          style={{ position: "absolute", left: 20, top: 20 }}
          animationName="float-bob-2 3.4s ease-in-out infinite"
          blinkDelay={2.1}
        />
        <Star size={22} x={6}   y={40}  delay={0}    dur={2.4} />
        <Star size={14} x={210} y={70}  delay={0.6}  dur={2.4} />
        <Star size={10} x={30}  y={170} delay={1.1}  dur={2.4} />
        <Star size={18} x={196} y={170} delay={1.7}  dur={2.4} />
        <Star size={9}  x={120} y={8}   delay={2.0}  dur={2.4} />
      </div>
      <Caption title="Sparkle" sub="float + twinkling sparkles · hero / celebration" />
    </Stage>
  );
}

// ---------- 8. Tap / Press ----------
function Tap() {
  const [pressed, setPressed] = useState(false);
  const [pop, setPop] = useState(0);
  return (
    <Stage>
      <style>{`
        @keyframes press-pop {
          0%   { transform: scale(1, 1); }
          30%  { transform: scale(1.12, 0.88); }
          60%  { transform: scale(0.96, 1.05); }
          100% { transform: scale(1, 1); }
        }
        @keyframes ring-out {
          0%   { transform: scale(.4); opacity: .55; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
      <Shadow animation="" />
      <div style={{ position: "relative" }}>
        <div
          key={pop}
          style={{
            position: "absolute", inset: 0, margin: "auto",
            width: 180, height: 180, borderRadius: "50%",
            border: "3px solid #F4B6C4",
            animation: pop ? "ring-out .55s ease-out forwards" : "none",
            pointerEvents: "none", top: 10,
          }}
        />
        <MascotImg
          onMouseDown={() => setPressed(true)}
          onMouseUp={() => { setPressed(false); setPop(p => p + 1); }}
          onMouseLeave={() => setPressed(false)}
          onTouchStart={() => setPressed(true)}
          onTouchEnd={() => { setPressed(false); setPop(p => p + 1); }}
          style={{
            cursor: "pointer",
            transform: pressed ? "scale(0.92)" : "scale(1)",
            transition: "transform .12s ease-out",
            userSelect: "none",
          }}
          animationName={pop && !pressed ? "press-pop .42s cubic-bezier(.34,1.56,.64,1)" : undefined}
          transformOrigin="50% 92%"
          blinkDelay={2.4}
        />
      </div>
      <Caption title="Tap Reaction" sub="click me · button / FAB" />
    </Stage>
  );
}

// ---------- 9. Wave Hello ----------
function Wave() {
  return (
    <Stage>
      <style>{`
        @keyframes wave-hello {
          0%, 60%, 100% { transform: rotate(0deg); }
          70%           { transform: rotate(-12deg); }
          80%           { transform: rotate(10deg); }
          90%           { transform: rotate(-6deg); }
        }
      `}</style>
      <Shadow animation="" />
      <MascotImg
        animationName="wave-hello 3.6s ease-in-out infinite"
        transformOrigin="50% 92%"
        blinkDelay={2.7}
      />
      <Caption title="Wave Hello" sub="greeting · onboarding splash" />
    </Stage>
  );
}

// ---------- 10. Writing ----------
function Writing() {
  return (
    <Stage>
      <style>{`
        @keyframes scribble {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          20%      { transform: translate(-2px, 1px) rotate(-3deg); }
          40%      { transform: translate(2px, 1px)  rotate(3deg); }
          60%      { transform: translate(-2px, 1px) rotate(-2deg); }
          80%      { transform: translate(2px, 1px)  rotate(2deg); }
        }
        @keyframes line-grow { 0% { stroke-dashoffset: 120; } 100% { stroke-dashoffset: 0; } }
        @keyframes line-fade { 0%, 80% { opacity: 1; } 100% { opacity: 0; } }
      `}</style>
      <Shadow animation="" />
      <div style={{ position: "relative", width: 240, height: 240 }}>
        <MascotImg
          size={200}
          style={{ position: "absolute", left: 20, top: 10 }}
          animationName="scribble 1.6s ease-in-out infinite"
          transformOrigin="50% 95%"
          blinkDelay={3.0}
        />
        <svg width="200" height="40" viewBox="0 0 200 40"
          style={{ position: "absolute", left: 20, top: 200 }}>
          <path
            d="M 10 20 Q 30 5, 50 20 T 90 20 T 130 20 T 170 20 T 190 20"
            fill="none" stroke="#3a2f24" strokeWidth="3" strokeLinecap="round"
            strokeDasharray="120"
            style={{ animation: "line-grow 1.6s ease-out infinite, line-fade 1.6s ease-out infinite" }}
          />
        </svg>
      </div>
      <Caption title="Writing" sub="scribbles a line · empty state / loading" />
    </Stage>
  );
}

// ---------- Mount ----------
window.MascotAlive      = Alive;
window.MascotAliveBlink = AliveBlink;
window.MascotFloat      = Float;
window.MascotBreathe    = Breathe;
window.MascotSway       = Sway;
window.MascotBounce     = Bounce;
window.MascotJump       = Jump;
window.MascotTwirl      = Wiggle;
window.MascotSparkle    = Sparkle;
window.MascotTap        = Tap;
window.MascotWave       = Wave;
window.MascotWriting    = Writing;
