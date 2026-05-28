
const OPEN_SRC   = require('./assets/mascot.png');
const CLOSED_SRC = require('./assets/mascot-closed.png');

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
  }).current;

  // Reset to identity when variant changes
  useEffect(() => {
    v.a.setValue(0); v.b.setValue(0); v.c.setValue(0);
  }, [variant, v.a, v.b, v.c]);

  // Drive the variant animations
  useEffect(() => {
    const anims = [];

    if (variant === 'alive') {
      // Float (3.4s cycle), breathe (2.9s), occasional sway (every ~5s).
      // Different periods keep them desynced — looks organic.
      anims.push(triangleLoop(v.a, 1700));      // float
      anims.push(triangleLoop(v.b, 1450));      // breathe
      anims.push(Animated.loop(
        Animated.sequence([
          Animated.delay(2200),
          Animated.timing(v.c, { toValue: 1,  duration: 600, easing: quad, useNativeDriver: true }),
          Animated.timing(v.c, { toValue: -1, duration: 700, easing: quad, useNativeDriver: true }),
          Animated.timing(v.c, { toValue: 0,  duration: 500, easing: quad, useNativeDriver: true }),
          Animated.delay(1800),
        ])
      ));
    } else if (variant === 'float') {
      anims.push(triangleLoop(v.a, 1700));
    } else if (variant === 'breathe') {
      anims.push(triangleLoop(v.b, 1800));
    } else if (variant === 'sway') {
      anims.push(triangleLoop(v.c, 2000));
    } else if (variant === 'bounce') {
      // Hop every 3.2s. v.a drives the keyframed bounce 0→1 through one hop.
      anims.push(Animated.loop(
        Animated.sequence([
          Animated.delay(2240),                                            // 0..70%
          Animated.timing(v.a, { toValue: 1, duration: 960, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(v.a, { toValue: 0, duration: 0,   useNativeDriver: true }),
        ])
      ));
    } else if (variant === 'jump') {
      // Bigger airborne hop every 2.8s
      anims.push(Animated.loop(
        Animated.sequence([
          Animated.delay(1680),
          Animated.timing(v.a, { toValue: 1, duration: 1120, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(v.a, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])
      ));
    } else if (variant === 'wiggle') {
      // Continuous side-to-side dance, 1.8s period
      anims.push(triangleLoop(v.a, 450, sin));
    } else if (variant === 'wave') {
      // Wave every 3.6s
      anims.push(Animated.loop(
        Animated.sequence([
          Animated.delay(2160),
          Animated.timing(v.a, { toValue: 1, duration: 1440, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
          Animated.timing(v.a, { toValue: 0, duration: 0,    useNativeDriver: true }),
        ])
      ));
    }
    // 'tap' has no idle loop — only responds to press

    const blinkAnim = blink ? blinkLoop(v.blink) : null;
    anims.push(blinkAnim);

    anims.forEach(a => a && a.start());
    return () => anims.forEach(a => a && a.stop());
  }, [variant, blink, v]);

  // ---------- build transforms per variant ----------

  let translateY = new Animated.Value(0);
  let translateX = new Animated.Value(0);
  let scaleX = new Animated.Value(1);
  let scaleY = new Animated.Value(1);
  let rotate = '0deg';
  let shadowScale = new Animated.Value(1);
  let shadowOpacity = new Animated.Value(0.22);

  if (variant === 'alive') {
    translateY = v.a.interpolate({  inputRange: [0, 1], outputRange: [4, -6] });
    scaleX     = v.b.interpolate({  inputRange: [0, 1], outputRange: [1, 1.04] });
    scaleY     = scaleX;
    rotate     = v.c.interpolate({  inputRange: [-1, 1], outputRange: ['-3deg', '3deg'] });
    shadowScale   = v.a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] });
    shadowOpacity = v.a.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.1] });
  } else if (variant === 'float') {
    translateY = v.a.interpolate({ inputRange: [0, 1], outputRange: [4, -8] });
    shadowScale = v.a.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] });
    shadowOpacity = v.a.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.12] });
  } else if (variant === 'breathe') {
    scaleX = v.b.interpolate({ inputRange: [0, 1], outputRange: [1, 1.045] });
    scaleY = scaleX;
  } else if (variant === 'sway') {
    rotate = v.c.interpolate({ inputRange: [0, 1], outputRange: ['-4deg', '4deg'] });
  } else if (variant === 'bounce') {
    // Squash & stretch hop — keyframed through v.a (0→1 per hop)
    // 0   = idle
    // .25 = squash (1.08, .92)
    // .5  = peak  ( .94, 1.08), -28px
    // .75 = land  (1.06, .94)
    // 1   = back to idle
    translateY = v.a.interpolate({
      inputRange:  [0,   0.25, 0.5,  0.75, 1],
      outputRange: [0,   0,    -28,  0,    0],
    });
    scaleX = v.a.interpolate({
      inputRange:  [0, 0.25,  0.5,  0.75,  1],
      outputRange: [1, 1.08,  0.94, 1.06,  1],
    });
    scaleY = v.a.interpolate({
      inputRange:  [0, 0.25,  0.5,  0.75,  1],
      outputRange: [1, 0.92,  1.08, 0.94,  1],
    });
    shadowScale = v.a.interpolate({
      inputRange:  [0, 0.25, 0.5, 0.75, 1],
      outputRange: [1, 0.85, 0.6, 1.05, 1],
    });
    shadowOpacity = v.a.interpolate({
      inputRange:  [0,   0.5,  0.75, 1],
      outputRange: [0.22, 0.1, 0.25, 0.22],
    });
  } else if (variant === 'jump') {
    // Bigger hop with anticipation & landing
    translateY = v.a.interpolate({
      inputRange:  [0,  0.15, 0.30, 0.55, 0.75, 0.85, 1],
      outputRange: [0,  6,    -30,  -80,  -20,   0,   0],
    });
    scaleX = v.a.interpolate({
      inputRange:  [0,  0.15, 0.30, 0.55, 0.75, 0.85,  1],
      outputRange: [1,  1.15, 0.86, 0.94, 0.92, 1.18,  1],
    });
    scaleY = v.a.interpolate({
      inputRange:  [0,  0.15, 0.30, 0.55, 0.75, 0.85,  1],
      outputRange: [1,  0.78, 1.18, 1.06, 1.08, 0.74,  1],
    });
    rotate = v.a.interpolate({
      inputRange:  [0, 0.55,   0.75,   1],
      outputRange: ['0deg', '-8deg', '2deg', '0deg'],
    });
    shadowScale = v.a.interpolate({
      inputRange:  [0, 0.15, 0.55, 0.85, 1],
      outputRange: [1, 1.1,  0.4,  1.2,  1],
    });
    shadowOpacity = v.a.interpolate({
      inputRange:  [0,   0.55, 0.85, 1],
      outputRange: [0.25, 0.08, 0.32, 0.25],
    });
  } else if (variant === 'wiggle') {
    // Side-to-side dance: v.a is a triangle wave 0..1.
    // Map to a back-and-forth via sin: rotate ±6deg, translateX ±4
    translateX = v.a.interpolate({
      inputRange:  [0,  0.25, 0.5, 0.75, 1],
      outputRange: [0, -4,    0,   4,    0],
    });
    rotate = v.a.interpolate({
      inputRange:  [0,    0.25,    0.5,   0.75,   1],
      outputRange: ['0deg', '-6deg', '0deg', '6deg', '0deg'],
    });
    translateY = v.a.interpolate({
      inputRange:  [0,  0.25, 0.5, 0.75, 1],
      outputRange: [0, -3,    0,  -3,    0],
    });
  } else if (variant === 'wave') {
    // Greeting wave: rotation chain
    rotate = v.a.interpolate({
      inputRange:  [0,    0.5,    0.7,      0.8,    0.9,    1],
      outputRange: ['0deg', '0deg', '-12deg', '10deg', '-6deg', '0deg'],
    });
  } else if (variant === 'tap') {
    // Tap reaction — driven by Pressable, no idle loop
    scaleX = v.pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.92] });
    scaleY = scaleX;
  }

  // ---------- render ----------

  const transforms = [
    { translateY },
    { translateX },
    { scaleX },
    { scaleY },
    { rotate },
  ];

  const mascotBody = (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: transforms,
      }}
    >
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
    </Animated.View>
  );

  const wrapped = variant === 'tap' ? (
    <Pressable
      onPressIn={() => {
        Animated.timing(v.pressed, { toValue: 1, duration: 80, useNativeDriver: true }).start();
      }}
      onPressOut={() => {
        Animated.spring(v.pressed, { toValue: 0, friction: 4, tension: 80, useNativeDriver: true }).start();
        onTap && onTap();
      }}
    >
      {mascotBody}
    </Pressable>
  ) : mascotBody;

  return (
    <View style={[styles.wrap, { width: size, height: size * 1.15 }, style]}>
      <Animated.View
        style={[
          styles.shadow,
          {
            width: size * 0.55,
            opacity: shadowOpacity,
            transform: [{ scaleX: shadowScale }],
          },
        ]}
      />
      {wrapped}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  shadow: {
    position: 'absolute',
    bottom: 6,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#3a2f24',
  },
});