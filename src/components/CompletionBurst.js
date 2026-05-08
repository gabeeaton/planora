import React, { useRef, useImperativeHandle, forwardRef, useState } from "react";
import { Animated, View, StyleSheet, Dimensions } from "react-native";

const { width: SW, height: SH } = Dimensions.get("window");

const COUNT      = 10;
const BASE_SIZES = [7, 10, 6, 9, 8, 7, 10, 6, 9, 8];

// Randomize each trigger so it never feels mechanical
const buildConfig = () =>
  Array.from({ length: COUNT }, (_, i) => {
    const baseAngle = (i * 360) / COUNT;
    const jitter    = (Math.random() - 0.5) * 22; // ±11° angle jitter
    const angle     = ((baseAngle + jitter) * Math.PI) / 180;
    const radius    = 52 + Math.random() * 34;     // 52–86px
    return {
      angle,
      tx: Math.cos(angle) * radius,
      ty: Math.sin(angle) * radius,
      speed: 20 + Math.random() * 10,              // 20–30 spring speed
    };
  });

const CompletionBurst = forwardRef(function CompletionBurst(_, ref) {
  const [color, setColor] = useState("#9060E8");
  const [cy, setCy]       = useState(SH * 0.44);

  const particles = useRef(
    Array.from({ length: COUNT }, () => ({
      x:       new Animated.Value(0),
      y:       new Animated.Value(0),
      opacity: new Animated.Value(0),
      scale:   new Animated.Value(0.1),
    }))
  ).current;

  useImperativeHandle(ref, () => ({
    trigger(newColor, yPos) {
      setColor(newColor);
      if (yPos != null) setCy(yPos);

      requestAnimationFrame(() => {
        particles.forEach((p) => {
          p.x.setValue(0);
          p.y.setValue(0);
          p.opacity.setValue(0);
          p.scale.setValue(0.1);
        });

        const config = buildConfig();

        const anims = particles.map((p, i) => {
          const { tx, ty, speed } = config[i];
          return Animated.parallel([
            Animated.spring(p.x,     { toValue: tx, useNativeDriver: true, speed, bounciness: 5 }),
            Animated.spring(p.y,     { toValue: ty, useNativeDriver: true, speed, bounciness: 5 }),
            Animated.spring(p.scale, { toValue: 1,  useNativeDriver: true, speed: 55, bounciness: 0 }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1,   duration: 55,  useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0,   duration: 300, useNativeDriver: true }),
            ]),
          ]);
        });

        Animated.parallel(anims).start();
      });
    },
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const size = BASE_SIZES[i];
        return (
          <Animated.View
            key={i}
            style={{
              position:        "absolute",
              left:            SW / 2 - size / 2,
              top:             cy   - size / 2,
              width:           size,
              height:          size,
              borderRadius:    size / 2,
              backgroundColor: color,
              opacity:         p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { scale:      p.scale },
              ],
            }}
          />
        );
      })}
    </View>
  );
});

export default CompletionBurst;
