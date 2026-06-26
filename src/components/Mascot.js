// Mascot.js — drop-in React Native component with multiple animation variants
//
// Usage:
//   import Mascot from './Mascot';
//   <Mascot />                          // default — "alive" idle
//   <Mascot variant="jump" />           // periodic big hop
//   <Mascot variant="wiggle" />         // continuous side-to-side dance
//   <Mascot variant="wave" />           // periodic wave
//   <Mascot variant="bounce" />         // periodic happy bounce
//   <Mascot variant="tap" onTap={...}/> // interactive — press to react
//
// Variants:
//   alive   — float + breathe + occasional sway (default, always-on)
//   float   — gentle vertical bob
//   breathe — soft scale pulse
//   sway    — pendulum tilt
//   bounce  — periodic happy hop
//   jump    — bigger airborne hop with anticipation + landing
//   wiggle  — Duolingo-style side-to-side celebration dance
//   wave    — periodic greeting wave
//   tap     — interactive: scales down on press, pops back on release
//   writing — scribble body motion + animated wavy line below
//
// All variants blink every ~5s unless you pass blink={false}.
// Note: 'writing' variant requires react-native-svg (Svg, Path).
// Requires React Native only — no extra libraries.

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, View, Pressable, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const OPEN_SRC   = require('../assets/mascot-rn/assets/mascot.png');
const CLOSED_SRC = require('../assets/mascot-rn/assets/mascot-closed.png');

// ---------- helpers ----------

const sin = Easing.inOut(Easing.sin);
const quad = Easing.inOut(Easing.quad);

// Triangle-wave loop on an Animated.Value: 0 → 1 → 0 → 1 → ...
function triangleLoop(value, halfDur, easing = sin) {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: halfDur, easing, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: halfDur, easing, useNativeDriver: true }),
    ])
  );
}

// Build the periodic double-blink loop
function blinkLoop(value) {
  return Animated.loop(
    Animated.sequence([
      Animated.delay(4400),
      Animated.timing(value, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 50, useNativeDriver: true }),
      Animated.delay(110),
      Animated.timing(value, { toValue: 1, duration: 50, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0, duration: 50, useNativeDriver: true }),
    ])
  );
}

// ---------- main ----------

export default function Mascot({
  size = 140,
  variant = 'alive',
  blink = true,
  eager = false,
  onTap,
  style,
}) {
  // Shared values across variants
  const v = useRef({
    a: new Animated.Value(0),
    b: new Animated.Value(0),
    c: new Animated.Value(0),
    blink: new Animated.Value(0),
    pressed: new Animated.Value(0),
    popScaleX: new Animated.Value(1),
    popScaleY: new Animated.Value(1),
    ringScale: new Animated.Value(0.4),
    ringOpacity: new Animated.Value(0),
    wX: new Animated.Value(0),   // writing translateX (actual px)
    wY: new Animated.Value(0),   // writing translateY (actual px)
    wR: new Animated.Value(0),   // writing rotate (actual deg, 1.0 = 1deg)
    wLine: new Animated.Value(0), // writing line: 0=dashoffset 120, 1=dashoffset 0
  }).current;

  // State-driven SVG props for writing line (Animated.Value can't drive SVG props directly)
  const [lineDashOffset, setLineDashOffset] = useState(120);
  const [lineOpacityVal, setLineOpacityVal] = useState(1);

  // Reset to identity when variant changes
  useEffect(() => {
    v.a.setValue(0); v.b.setValue(0); v.c.setValue(0);
  }, [variant, v.a, v.b, v.c]);

  // Drive the variant animations
  useEffect(() => {
    const anims = [];

    if (variant === 'alive') {
      // Float (3.4s cycle), breathe (2.9s), occasional sway (every ~7.6s).
      // Different periods keep them desynced — looks organic.
      anims.push(triangleLoop(v.a, 1700));      // float
      anims.push(triangleLoop(v.b, 1450));      // breathe
      // Sway: 0%,30%,100% at 0deg → 40% at 3deg → 55% at -3deg → 65% at 0deg
      anims.push(Animated.loop(
        Animated.sequence([
          Animated.delay(2280),                 // 0..30% of 7600ms
          Animated.timing(v.c, { toValue: 1,  duration: 760, easing: quad, useNativeDriver: true }),  // 30→40%
          Animated.timing(v.c, { toValue: -1, duration: 1140, easing: quad, useNativeDriver: true }), // 40→55%
          Animated.timing(v.c, { toValue: 0,  duration: 760, easing: quad, useNativeDriver: true }),  // 55→65%
          Animated.delay(2660),                 // 65..100%
        ])
      ));
    } else if (variant === 'float') {
      anims.push(triangleLoop(v.a, 1700));
    } else if (variant === 'breathe') {
      anims.push(triangleLoop(v.b, 1800));
    } else if (variant === 'sway') {
      anims.push(triangleLoop(v.c, 2000));
    } else if (variant === 'bounce') {
      // Hop every 3.2s. Keyframes: 0-70% idle, 75% squash, 82% peak, 90% land, 95% settle.
      const bounceHop = [
        Animated.timing(v.a, { toValue: 0.25, duration: 160,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0.57, duration: 224,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0.90, duration: 256,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 1,    duration: 160,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0,    duration: 0,    useNativeDriver: true }),
      ];
      const bounceLoop = Animated.loop(Animated.sequence([Animated.delay(2240), ...bounceHop]));
      if (eager) {
        Animated.sequence(bounceHop).start(() => bounceLoop.start());
      } else {
        anims.push(bounceLoop);
      }
    } else if (variant === 'jump') {
      // Bigger airborne hop every 2.8s. Keyframes: 0-60% idle, 65/72/80/88/92/96%.
      const jumpHop = [
        Animated.timing(v.a, { toValue: 0.083, duration: 140,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0.267, duration: 196,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0.50,  duration: 224,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0.733, duration: 224,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0.867, duration: 112,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 1,     duration: 112,  easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
        Animated.timing(v.a, { toValue: 0,     duration: 0,    useNativeDriver: true }),
      ];
      const jumpLoop = Animated.loop(Animated.sequence([Animated.delay(1680), ...jumpHop]));
      if (eager) {
        Animated.sequence(jumpHop).start(() => jumpLoop.start());
      } else {
        anims.push(jumpLoop);
      }
    } else if (variant === 'wiggle') {
      // Continuous side-to-side dance, 1.8s period
      anims.push(triangleLoop(v.a, 450, sin));
    } else if (variant === 'wave') {
      // Wave every 3.6s. CSS keyframes: 0%,60%,100%=0deg  70%=-12deg  80%=10deg  90%=-6deg
      // Drive v.a directly as the rotation value (scaled: 1.0 = 10deg) so there's
      // no interpolation proxy — each segment goes point-to-point with its own easing,
      // exactly like CSS keyframes do. No crossing back through intermediate values.
      const easeIO = Easing.inOut(Easing.sin);
      anims.push(Animated.loop(
        Animated.sequence([
          Animated.delay(2160),                                                                                            // 0..60% idle
          Animated.timing(v.a, { toValue: -1.2, duration: 360, easing: easeIO, useNativeDriver: true }), // 60→70%: 0→-12deg
          Animated.timing(v.a, { toValue:  1.0, duration: 360, easing: easeIO, useNativeDriver: true }), // 70→80%: -12→10deg
          Animated.timing(v.a, { toValue: -0.6, duration: 360, easing: easeIO, useNativeDriver: true }), // 80→90%: 10→-6deg
          Animated.timing(v.a, { toValue:  0,   duration: 360, easing: easeIO, useNativeDriver: true }), // 90→100%: -6→0deg
        ])
      ));
    } else if (variant === 'writing') {
      // Single wLine loop drives everything — body position set each rAF via listener.
      // wLine 0→1 over 1.6s (ease-out), instant reset. JS driver required for SVG props.
      anims.push(Animated.loop(Animated.sequence([
        Animated.timing(v.wLine, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(v.wLine, { toValue: 0, duration: 0, useNativeDriver: false }),
      ])));
    }
    // 'tap' has no idle loop — only responds to press

    const blinkAnim = blink ? blinkLoop(v.blink) : null;
    anims.push(blinkAnim);

    anims.forEach(a => a && a.start());

    // Drive SVG props + body position each rAF tick via wLine listener (writing only).
    // Body sweeps left→right in sync with the line being drawn. Y waves with the line's
    // peaks. At 80%+ the pencil lifts off so the snap-back to start is "in the air".
    let lineListener = null;
    if (variant === 'writing') {
      lineListener = v.wLine.addListener(({ value }) => {
        // SVG line
        setLineDashOffset(120 - value * 120);
        setLineOpacityVal(value >= 0.8 ? 1 - (value - 0.8) / 0.2 : 1);

        // X: leading edge of drawn line goes from viewBox x=10 to x=120.4 over value 0→1.
        // Converted to screen px relative to SVG/mascot center (viewBox x=100):
        //   wX = (leading_x - 100) * (size*1.43/200) = (value*110.4 - 90) * size*0.00715
        v.wX.setValue((value * 110.4 - 90) * size * 0.00715);

        // Y: leading edge follows 1.25 sine cycles (up→down→up) with ~7px amplitude.
        // baseY drops tip to line center; wave tracks actual path y with sub-pixel accuracy.
        const baseY  = size * 0.15 + 4;
        // Period = 87/120 = 0.725 of value range (one full up-down wave = 2 segments of 43.5 arc units)
        const period = 0.725;
        const waveY  = -size * 0.054 * Math.sin(value * 2 * Math.PI / period);
        v.wY.setValue(baseY + waveY);

        // Rotation: tilts with direction of travel
        v.wR.setValue(3 * Math.cos(value * 2 * Math.PI / period));
      });
    }

    return () => {
      anims.forEach(a => a && a.stop());
      if (lineListener !== null) v.wLine.removeListener(lineListener);
    };
  }, [variant, blink, v]);

  // ---------- build transforms per variant ----------
  //
  // Pivot helper: emulates CSS transform-origin by sandwiching the real
  // transform between a pre-translate and its inverse.
  //   pivotY = size * 0.42  →  92% from top  (≈ bottom of feet, from center)
  //   pivotY = size * 0.50  →  100% from top (center-bottom for breathe)
  //   pivotY = size * 0.45  →  95% from top  (wiggle)

  let bodyTransforms   = [];
  let floatTransforms  = [];
  let breatheTransforms = [];
  let swayTransforms   = [];

  let shadowScale   = new Animated.Value(1);
  let shadowOpacity = new Animated.Value(0.22);

  if (variant === 'alive') {
    // --- float layer (outermost): translateY 4px → -6px ---
    const floatY = v.a.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
    floatTransforms = [{ translateY: floatY }];

    // --- breathe layer (middle): scale 1 → 1.04, pivot at bottom (92%) ---
    const breathePivot = size * 0.42;
    const breatheScale = v.b.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] });
    breatheTransforms = [
      { translateY: breathePivot },
      { scaleX: breatheScale },
      { scaleY: breatheScale },
      { translateY: -breathePivot },
    ];

    // --- sway layer (innermost): rotate ±3deg, pivot at 92% ---
    const swayPivot = size * 0.42;
    const swayRotate = v.c.interpolate({ inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] });
    swayTransforms = [
      { translateY: swayPivot },
      { rotate: swayRotate },
      { translateY: -swayPivot },
    ];

    shadowScale   = v.a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
    shadowOpacity = v.a.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.1] });

  } else if (variant === 'float') {
    // translateY 0 → -10px (matches CSS: 0%=0, 50%=-10px)
    const floatY = v.a.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
    bodyTransforms = [{ translateY: floatY }];
    shadowScale   = v.a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
    shadowOpacity = v.a.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.12] });

  } else if (variant === 'breathe') {
    // scale 1 → 1.045, pivot at bottom (center bottom = size*0.5 from center)
    const pivot = size * 0.5;
    const scale = v.b.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
    bodyTransforms = [
      { translateY: pivot },
      { scaleX: scale },
      { scaleY: scale },
      { translateY: -pivot },
    ];

  } else if (variant === 'sway') {
    // rotate -4deg → 4deg, pivot at 92% (size * 0.42 from center)
    const pivot = size * 0.42;
    const rotate = v.c.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });
    bodyTransforms = [
      { translateY: pivot },
      { rotate },
      { translateY: -pivot },
    ];

  } else if (variant === 'bounce') {
    // Squash & stretch from bottom — pivot at 92%.
    // Keyframes match CSS: 0/70/100%=idle, 75%=squash, 82%=peak, 90%=land, 95%=settle
    const pivot = size * 0.42;
    const translateY = v.a.interpolate({
      inputRange:  [0,    0.25,  0.57,  0.90,  1],
      outputRange: [0,    0,     -28,   0,     0],
    });
    const scaleX = v.a.interpolate({
      inputRange:  [0,    0.25,  0.57,  0.90,  1],
      outputRange: [1,    1.08,  0.94,  1.06,  0.98],
    });
    const scaleY = v.a.interpolate({
      inputRange:  [0,    0.25,  0.57,  0.90,  1],
      outputRange: [1,    0.92,  1.08,  0.94,  1.02],
    });
    bodyTransforms = [
      { translateY },
      { translateY: pivot },
      { scaleX },
      { scaleY },
      { translateY: -pivot },
    ];
    shadowScale = v.a.interpolate({
      inputRange:  [0,    0.57,  0.90,  1],
      outputRange: [1,    0.6,   1.05,  1],
    });
    shadowOpacity = v.a.interpolate({
      inputRange:  [0,    0.57,  0.90,  1],
      outputRange: [0.22, 0.1,   0.25,  0.22],
    });

  } else if (variant === 'jump') {
    // Bigger hop — keyframes match CSS big-jump.
    // pivot at 92% (size * 0.42 from center)
    const pivot = size * 0.42;
    const translateY = v.a.interpolate({
      inputRange:  [0,     0.083, 0.267, 0.50,  0.733, 0.867, 1],
      outputRange: [0,     6,     -30,   -80,   -20,   0,     0],
    });
    const scaleX = v.a.interpolate({
      inputRange:  [0,     0.083, 0.267, 0.50,  0.733, 0.867, 1],
      outputRange: [1,     1.15,  0.86,  0.94,  0.92,  1.18,  0.96],
    });
    const scaleY = v.a.interpolate({
      inputRange:  [0,     0.083, 0.267, 0.50,  0.733, 0.867, 1],
      outputRange: [1,     0.78,  1.18,  1.06,  1.08,  0.74,  1.04],
    });
    const rotate = v.a.interpolate({
      inputRange:  [0,     0.50,     0.733,   0.867,   1],
      outputRange: ['0deg', '-8deg', '2deg',  '0deg',  '0deg'],
    });
    bodyTransforms = [
      { translateY },
      { translateY: pivot },
      { scaleX },
      { scaleY },
      { rotate },
      { translateY: -pivot },
    ];
    shadowScale = v.a.interpolate({
      inputRange:  [0,     0.083, 0.50,  0.867, 1],
      outputRange: [1,     1.1,   0.4,   1.2,   1],
    });
    shadowOpacity = v.a.interpolate({
      inputRange:  [0,     0.50,  0.867, 1],
      outputRange: [0.25,  0.08,  0.32,  0.25],
    });

  } else if (variant === 'wiggle') {
    // Side-to-side dance — pivot at 95% (size * 0.45 from center).
    // Includes skewX opposing rotate, matching CSS wiggle-dance keyframes.
    // Plus a separate bob layer via translateY.
    const pivot = size * 0.45;
    // CSS keyframes: 0/100%=0, 15%=-4px/-6deg/+2deg, 30%=+4px/+5deg/-2deg,
    //               45%=-4px/-5deg/+2deg, 60%=+4px/+6deg/-2deg,
    //               75%=-3px/-3deg/+1deg, 90%=+3px/+3deg/-1deg
    const translateX = v.a.interpolate({
      inputRange:  [0,    0.25,  0.5,   0.75,  1],
      outputRange: [0,    -4,    4,     -4,    0],
    });
    const translateY = v.a.interpolate({
      inputRange:  [0,    0.25,  0.5,   0.75,  1],
      outputRange: [0,    -3,    -2,    -3,    0],
    });
    const rotate = v.a.interpolate({
      inputRange:  [0,      0.25,    0.5,     0.75,    1],
      outputRange: ['0deg', '-6deg', '5deg',  '-5deg', '0deg'],
    });
    const skewX = v.a.interpolate({
      inputRange:  [0,      0.25,   0.5,     0.75,    1],
      outputRange: ['0deg', '2deg', '-2deg', '2deg',  '0deg'],
    });
    bodyTransforms = [
      { translateX },
      { translateY },
      { translateY: pivot },
      { rotate },
      { skewX },
      { translateY: -pivot },
    ];

  } else if (variant === 'wave') {
    // Greeting wave - pivot at 92% (size * 0.42 from center).
    // v.a is driven directly to angle values (scaled: 1.0 = 10deg):
    //   idle=0, -1.2=-12deg, 1.0=10deg, -0.6=-6deg, back to 0
    // inputRange must be monotonic so we sort: -1.2, -0.6, 0, 1.0
    const pivot = size * 0.42;
    const rotate = v.a.interpolate({
      inputRange:  [-1.2,     -0.6,    0,      1.0],
      outputRange: ['-12deg', '-6deg', '0deg', '10deg'],
    });
    bodyTransforms = [
      { translateY: pivot },
      { rotate },
      { translateY: -pivot },
    ];

  } else if (variant === 'writing') {
    // Scribble body — pivot at 95% (size * 0.45 from center).
    // wX/wY/wR are driven directly to actual px/deg values, no interpolation proxy.
    const pivot = size * 0.45;
    const rotate = v.wR.interpolate({
      inputRange:  [-3,      0,      3],
      outputRange: ['-3deg', '0deg', '3deg'],
    });
    bodyTransforms = [
      { translateX: v.wX },
      { translateY: v.wY },
      { translateY: pivot },
      { rotate },
      { translateY: -pivot },
    ];

  } else if (variant === 'tap') {
    // Press-down: squeeze to 0.92 uniform
    const pressScale = v.pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });
    // Pop-release: scaleX and scaleY driven independently via popScaleX/popScaleY
    // Combined: multiply press squeeze with pop overshoot via a nested view
    bodyTransforms = [{ scaleX: pressScale }, { scaleY: pressScale }];
  }

  // ---------- render ----------

  const imageStack = (
    <>
      <Animated.Image
        source={OPEN_SRC}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
      {blink ? (
        <Animated.Image
          source={CLOSED_SRC}
          style={{
            position: 'absolute', top: 0, left: 0,
            width: size, height: size, resizeMode: 'contain',
            opacity: v.blink,
          }}
        />
      ) : null}
    </>
  );

  // For the 'alive' variant we need three nested wrappers so each animation
  // layer can have its own transform and pivot, matching the CSS structure:
  //   .a-sway > .a-breathe > .a-bob > <img>
  let mascotBody;

  if (variant === 'alive') {
    mascotBody = (
      // Outer: float (pure translateY, no pivot)
      <Animated.View style={{ width: size, height: size, transform: floatTransforms }}>
        {/* Middle: breathe (pivot at bottom) */}
        <Animated.View style={{ width: size, height: size, transform: breatheTransforms }}>
          {/* Inner: sway (pivot at 92%) */}
          <Animated.View style={{ width: size, height: size, transform: swayTransforms }}>
            {imageStack}
          </Animated.View>
        </Animated.View>
      </Animated.View>
    );
  } else {
    mascotBody = (
      <Animated.View style={{ width: size, height: size, transform: bodyTransforms }}>
        {imageStack}
      </Animated.View>
    );
  }

  // For tap: wrap in pop + ring layers
  const firePop = () => {
    // Reset pop values
    v.popScaleX.setValue(1);
    v.popScaleY.setValue(1);
    v.ringScale.setValue(0.4);
    v.ringOpacity.setValue(0.55);
    // press-pop keyframes: 0%=1,1  30%=1.12,0.88  60%=0.96,1.05  100%=1,1
    // Use cubic-bezier(.34,1.56,.64,1) — approximate with a spring
    Animated.parallel([
      Animated.sequence([
        Animated.timing(v.popScaleX, { toValue: 1.12, duration: 126, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v.popScaleX, { toValue: 0.96, duration: 126, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v.popScaleX, { toValue: 1,    duration: 168, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(v.popScaleY, { toValue: 0.88, duration: 126, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v.popScaleY, { toValue: 1.05, duration: 126, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(v.popScaleY, { toValue: 1,    duration: 168, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]),
      // Ring ripple: scale 0.4→1.6, opacity 0.55→0 over 550ms
      Animated.timing(v.ringScale,   { toValue: 1.6, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v.ringOpacity, { toValue: 0,   duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const ringSize = size * 1.28; // ~180px at size=140, matches CSS
  const tapBody = variant === 'tap' ? (
    // Outer: press squeeze. Inner: pop overshoot (so they multiply correctly)
    <Animated.View style={{ width: size, height: size, transform: bodyTransforms }}>
      <Animated.View style={{
        width: size, height: size,
        transform: [{ scaleX: v.popScaleX }, { scaleY: v.popScaleY }],
      }}>
        {imageStack}
      </Animated.View>
    </Animated.View>
  ) : null;

  const wrapped = variant === 'tap' ? (
    <View style={{ position: 'relative', width: size, height: size }}>
      {/* Ring ripple — centered, behind mascot */}
      <Animated.View style={{
        position: 'absolute',
        width: ringSize,
        height: ringSize,
        borderRadius: ringSize / 2,
        borderWidth: 3,
        borderColor: '#F4B6C4',
        top: (size - ringSize) / 2,
        left: (size - ringSize) / 2,
        opacity: v.ringOpacity,
        transform: [{ scale: v.ringScale }],
        pointerEvents: 'none',
      }} />
      <Pressable
        onPressIn={() => {
          Animated.timing(v.pressed, { toValue: 1, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        }}
        onPressOut={() => {
          Animated.timing(v.pressed, { toValue: 0, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
          firePop();
          onTap && onTap();
        }}
      >
        {tapBody}
      </Pressable>
    </View>
  ) : mascotBody;

  // Writing variant: animated wavy SVG line below the mascot
  // strokeDashoffset and opacity driven via state (listener on v.wLine) because
  // react-native-svg SVG props can't be driven by Animated.Value directly.
  const writingLine = variant === 'writing' ? (() => {
    const lineW = size * 1.43; // ~200px at size=140
    const lineH = size * 0.29; // ~40px
    return (
      <View style={{ opacity: lineOpacityVal, marginTop: 4 }}>
        <Svg width={lineW} height={lineH} viewBox="0 0 200 40">
          <Path
            d="M 10 20 Q 30 5, 50 20 T 90 20 T 130 20 T 170 20 T 190 20"
            fill="none"
            stroke="#3a2f24"
            strokeWidth={3}
            strokeLinecap="round"
            strokeDasharray={120}
            strokeDashoffset={lineDashOffset}
          />
        </Svg>
      </View>
    );
  })() : null;

  return (
    <View style={[styles.wrap, { width: size, height: size * 1.15 + (variant === 'writing' ? size * 0.29 + 4 : 0) }, style]}>
      {/* Soft radial shadow — layered ellipses simulate CSS radial-gradient + blur */}
      <Animated.View style={{
        position: 'absolute',
        bottom: 6,
        width: size * 0.55,
        height: 14,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: shadowOpacity,
        transform: [{ scaleX: shadowScale }],
      }}>
        <View style={{ width: size * 0.55, height: 14, borderRadius: 999, backgroundColor: 'rgba(60,40,20,0.07)' }} />
        <View style={{ position: 'absolute', width: size * 0.42, height: 10, borderRadius: 999, backgroundColor: 'rgba(60,40,20,0.10)' }} />
        <View style={{ position: 'absolute', width: size * 0.30, height: 7,  borderRadius: 999, backgroundColor: 'rgba(60,40,20,0.13)' }} />
        <View style={{ position: 'absolute', width: size * 0.18, height: 5,  borderRadius: 999, backgroundColor: 'rgba(60,40,20,0.15)' }} />
      </Animated.View>
      {wrapped}
      {writingLine}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  // shadow rendered inline with layered Views (see above)
});