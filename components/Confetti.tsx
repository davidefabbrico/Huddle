// A burst of pastel confetti over the screen (easter eggs, unlocked achievements). Show it by
// changing `burst` (a counter): every new value throws a new round, which falls in about 2.5 seconds.

import { useEffect, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';

const COLORS = ['#FBBB9A', '#F9AEC0', '#C7B8FC', '#9DD0F6', '#8AD9CC', '#94DAAC', '#FDD474'];
const PIECES = 36;

export function Confetti({ burst }: { burst: number }) {
  const [finished, setFinished] = useState(0); // the last round that already fell
  useEffect(() => {
    if (!burst) return;
    const timeout = setTimeout(() => setFinished(burst), 2800);
    return () => clearTimeout(timeout);
  }, [burst]);
  const round = burst !== finished ? burst : 0;
  if (!round) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: PIECES }, (_, i) => (
        <Piece key={`${round}-${i}`} index={i} />
      ))}
    </View>
  );
}

function Piece({ index }: { index: number }) {
  const { width, height } = useWindowDimensions();
  const [start] = useState(() => ({
    x: Math.random() * width,
    drift: (Math.random() - 0.5) * 120,
    delay: Math.random() * 400,
    spin: (Math.random() - 0.5) * 720,
    size: 6 + Math.random() * 6,
    round: index % 3 === 0,
  }));
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(start.delay, withTiming(1, { duration: 2200, easing: Easing.in(Easing.quad) })));
  }, [progress, start.delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value * 0.6,
    transform: [
      { translateX: start.x + start.drift * progress.value },
      { translateY: -20 + (height + 40) * progress.value },
      { rotate: `${start.spin * progress.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: start.size,
          height: start.round ? start.size : start.size * 1.6,
          borderRadius: 0, // square bits, like pixels
          backgroundColor: COLORS[index % COLORS.length],
        },
        style,
      ]}
    />
  );
}
