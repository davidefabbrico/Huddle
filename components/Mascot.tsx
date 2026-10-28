// The group's mascot, drawn in vector (react-native-svg) and animated (reanimated): it pops in,
// breathes, floats, blinks and now and then hops; a tap makes it bounce with a little heart. Seven quick taps: it dances
// (easter egg, onSecret). Stages: 0 egg, 1 cub, 2 young (with a scarf in the group's color),
// 3 legend (crown and sparkles). Seasonal hats from lib/mascot.ts.

import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { Hat } from '../lib/mascot';
import type { MascotSpecies } from '../lib/types';

interface Look {
  body: string;
  light: string; // belly, muzzle
  dark: string; // ear tips, patches, feet
  inner: string; // inside the ears
}

const LOOKS: Record<MascotSpecies, Look> = {
  fox: { body: '#F5A66D', light: '#FFF3E6', dark: '#8A4B2A', inner: '#FFD1B8' },
  cat: { body: '#F2D2A6', light: '#FFF6EA', dark: '#C99B66', inner: '#FFC9CF' },
  panda: { body: '#FFFFFF', light: '#FFFFFF', dark: '#3B3B45', inner: '#3B3B45' },
  frog: { body: '#9ED69A', light: '#E6F7D9', dark: '#4F8A4B', inner: '#9ED69A' },
  penguin: { body: '#5B6678', light: '#FFFFFF', dark: '#F6B04B', inner: '#5B6678' },
  dragon: { body: '#C3B1F7', light: '#F1ECFF', dark: '#7E66C9', inner: '#F7D58A' },
};

// The mascot moves even with "Riduci movimento" on (iPhone/Android accessibility): its motions are
// small and slow, and without them it's just a picture. Confetti still respects the setting.
const MOVE = ReduceMotion.Never;

const INK = '#2B2B33';
const BLUSH = '#FF9DB0';
const GOLD = '#F7C948';

interface Props {
  species: MascotSpecies;
  stage: 0 | 1 | 2 | 3;
  accent: string; // the group's color (scarf)
  hat?: Hat;
  size?: number;
  animated?: boolean; // false: a still picture (pickers)
  onSecret?: () => void; // seven quick taps
}

export function Mascot({ species, stage, accent, hat = null, size = 120, animated = true, onSecret }: Props) {
  const look = LOOKS[species];
  const [blink, setBlink] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const taps = useRef<number[]>([]);

  const scale = useSharedValue(animated ? 0.3 : 1);
  const breath = useSharedValue(1);
  const float = useSharedValue(0);
  const hop = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    scale.set(withSpring(1, { damping: 9, stiffness: 140, reduceMotion: MOVE }));
    breath.set(
      withRepeat(withSequence(MOVE, withTiming(1.05, { duration: 1200, reduceMotion: MOVE }), withTiming(1, { duration: 1200, reduceMotion: MOVE })), -1, false, undefined, MOVE),
    );
    const smooth = { duration: 1600, easing: Easing.inOut(Easing.quad), reduceMotion: MOVE };
    float.set(withRepeat(withSequence(MOVE, withTiming(-4, smooth), withTiming(0, smooth)), -1, false, undefined, MOVE));
    // every few seconds it blinks, and now and then it does a little hop
    let blinkTimer: ReturnType<typeof setTimeout>;
    let hopTimer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      blinkTimer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 140);
        scheduleBlink();
      }, 2500 + Math.random() * 2500);
    };
    const scheduleHop = () => {
      hopTimer = setTimeout(() => {
        hop.set(withSequence(MOVE, withTiming(-7, { duration: 160, reduceMotion: MOVE }), withSpring(0, { damping: 5, reduceMotion: MOVE })));
        scheduleHop();
      }, 4000 + Math.random() * 3000);
    };
    scheduleBlink();
    scheduleHop();
    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(hopTimer);
    };
  }, [animated, scale, breath, float, hop]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value + hop.value }, { scale: scale.value * breath.value }, { rotate: `${tilt.value}deg` }],
  }));

  function tap() {
    if (!animated) return;
    scale.set(withSequence(MOVE, withTiming(1.18, { duration: 120, reduceMotion: MOVE }), withSpring(1, { damping: 6, reduceMotion: MOVE })));
    const id = Date.now();
    setHearts((h) => [...h, id]);
    setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1100);
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 4000), now];
    if (taps.current.length >= 7) {
      taps.current = [];
      // the dance
      tilt.set(withSequence(MOVE, ...[-14, 14, -14, 14, -10, 10, 0].map((deg) => withTiming(deg, { duration: 160, reduceMotion: MOVE }))));
      onSecret?.();
    }
  }

  return (
    <Pressable onPress={tap} accessibilityRole="image" accessibilityLabel="Mascotte del gruppo" disabled={!animated}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          {stage === 0 ? <Egg look={look} blink={blink} /> : <Creature species={species} look={look} stage={stage} accent={accent} blink={blink} />}
          {hat ? <HatShape hat={hat} top={stage === 0 ? 24 : stage === 1 ? 28 : 24} /> : stage === 3 ? <Crown /> : null}
          {stage === 3 ? <Sparkles /> : null}
        </Svg>
      </Animated.View>
      {hearts.map((id) => (
        <FloatingHeart key={id} size={size} />
      ))}
    </Pressable>
  );
}

function FloatingHeart({ size }: { size: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    y.set(withTiming(-size * 0.5, { duration: 1000, reduceMotion: MOVE }));
    opacity.set(withTiming(0, { duration: 1000, reduceMotion: MOVE }));
  }, [y, opacity, size]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: size * 0.15, left: size * 0.62 }, style]}>
      <Text style={{ fontSize: size * 0.16 }}>💖</Text>
    </Animated.View>
  );
}

function Eyes({ left, right, blink }: { left: [number, number]; right: [number, number]; blink: boolean }) {
  return (
    <G>
      {[left, right].map(([x, y], i) =>
        blink ? (
          <Path key={i} d={`M ${x - 4.5} ${y} Q ${x} ${y + 3} ${x + 4.5} ${y}`} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
        ) : (
          <G key={i}>
            <Ellipse cx={x} cy={y} rx={4.6} ry={5.6} fill={INK} />
            <Circle cx={x + 1.6} cy={y - 2.1} r={1.7} fill="#FFFFFF" />
          </G>
        ),
      )}
    </G>
  );
}

function Blush({ y = 66 }: { y?: number }) {
  return (
    <G opacity={0.6}>
      <Ellipse cx={42} cy={y} rx={5.5} ry={3.2} fill={BLUSH} />
      <Ellipse cx={78} cy={y} rx={5.5} ry={3.2} fill={BLUSH} />
    </G>
  );
}

function Egg({ look, blink }: { look: Look; blink: boolean }) {
  return (
    <G>
      <Ellipse cx={60} cy={108} rx={26} ry={4} fill="#000000" opacity={0.08} />
      <Path d="M 60 22 C 82 22 92 52 92 72 C 92 92 78 104 60 104 C 42 104 28 92 28 72 C 28 52 38 22 60 22 Z" fill={look.light} stroke={look.body} strokeWidth={2} />
      <Circle cx={44} cy={46} r={6} fill={look.body} opacity={0.7} />
      <Circle cx={76} cy={88} r={7} fill={look.body} opacity={0.7} />
      <Circle cx={80} cy={50} r={4} fill={look.body} opacity={0.7} />
      <Path d="M 32 62 L 41 56 L 48 63 L 56 55 L 63 63 L 70 55 L 78 62 L 88 56" stroke={INK} strokeWidth={1.8} fill="none" strokeLinejoin="round" opacity={0.7} />
      <Eyes left={[50, 74]} right={[70, 74]} blink={blink} />
      <Blush y={82} />
    </G>
  );
}

function Creature({ species, look, stage, accent, blink }: { species: MascotSpecies; look: Look; stage: 1 | 2 | 3; accent: string; blink: boolean }) {
  const cub = stage === 1;
  const headY = cub ? 58 : 52;
  const headR = cub ? 30 : 28;
  const bodyRy = cub ? 16 : 20;
  const bodyRx = cub ? 22 : 26;
  const eyeY = headY - 2;
  const frogEyes = species === 'frog';

  return (
    <G>
      <Ellipse cx={60} cy={110} rx={28} ry={4} fill="#000000" opacity={0.08} />

      {/* Behind: tail, wings, ears */}
      {species === 'fox' ? (
        <G>
          <Path d="M 80 96 C 104 92 108 66 96 58 C 98 74 90 84 76 88 Z" fill={look.body} />
          <Path d="M 96 58 C 104 64 104 72 100 78 C 98 70 96 64 96 58 Z" fill={look.light} />
        </G>
      ) : null}
      {species === 'cat' ? <Path d="M 80 98 C 100 98 104 80 96 70" stroke={look.body} strokeWidth={6} fill="none" strokeLinecap="round" /> : null}
      {species === 'dragon' ? (
        <G>
          <Path d="M 36 82 C 18 70 14 86 22 92 C 26 88 30 88 36 90 Z" fill={look.dark} opacity={0.75} />
          <Path d="M 84 82 C 102 70 106 86 98 92 C 94 88 90 88 84 90 Z" fill={look.dark} opacity={0.75} />
          <Path d="M 82 100 C 98 102 104 96 104 88 L 110 92 L 104 84 C 102 94 94 98 82 96 Z" fill={look.body} />
        </G>
      ) : null}
      {species === 'fox' || species === 'cat' ? (
        <G>
          <Path d={species === 'fox' ? `M 36 ${headY - 14} L 30 ${headY - 46} L 54 ${headY - 26} Z` : `M 38 ${headY - 16} L 34 ${headY - 40} L 54 ${headY - 26} Z`} fill={look.body} />
          <Path d={species === 'fox' ? `M 84 ${headY - 14} L 90 ${headY - 46} L 66 ${headY - 26} Z` : `M 82 ${headY - 16} L 86 ${headY - 40} L 66 ${headY - 26} Z`} fill={look.body} />
          <Path d={species === 'fox' ? `M 39 ${headY - 20} L 34 ${headY - 40} L 49 ${headY - 27} Z` : `M 40 ${headY - 20} L 37 ${headY - 35} L 50 ${headY - 26} Z`} fill={look.inner} />
          <Path d={species === 'fox' ? `M 81 ${headY - 20} L 86 ${headY - 40} L 71 ${headY - 27} Z` : `M 80 ${headY - 20} L 83 ${headY - 35} L 70 ${headY - 26} Z`} fill={look.inner} />
          {species === 'fox' ? (
            <G>
              <Path d={`M 31 ${headY - 42} L 30 ${headY - 46} L 35 ${headY - 43} Z`} fill={look.dark} />
              <Path d={`M 89 ${headY - 42} L 90 ${headY - 46} L 85 ${headY - 43} Z`} fill={look.dark} />
            </G>
          ) : null}
        </G>
      ) : null}
      {species === 'panda' ? (
        <G>
          <Circle cx={36} cy={headY - 24} r={10} fill={look.dark} />
          <Circle cx={84} cy={headY - 24} r={10} fill={look.dark} />
        </G>
      ) : null}
      {species === 'dragon' ? (
        <G>
          <Path d={`M 44 ${headY - 22} L 40 ${headY - 40} L 52 ${headY - 26} Z`} fill={look.inner} />
          <Path d={`M 76 ${headY - 22} L 80 ${headY - 40} L 68 ${headY - 26} Z`} fill={look.inner} />
        </G>
      ) : null}

      {/* Body, arms, feet */}
      <Ellipse cx={47} cy={107} rx={8} ry={4.5} fill={species === 'penguin' ? look.dark : look.dark} opacity={species === 'panda' || species === 'penguin' ? 1 : 0.55} />
      <Ellipse cx={73} cy={107} rx={8} ry={4.5} fill={look.dark} opacity={species === 'panda' || species === 'penguin' ? 1 : 0.55} />
      <Ellipse cx={60} cy={headY + headR + bodyRy - 8} rx={bodyRx} ry={bodyRy} fill={look.body} />
      <Ellipse cx={60} cy={headY + headR + bodyRy - 5} rx={bodyRx * 0.62} ry={bodyRy * 0.7} fill={look.light} />
      <Ellipse cx={38} cy={headY + headR + 4} rx={6} ry={9} fill={species === 'panda' ? look.dark : look.body} />
      <Ellipse cx={82} cy={headY + headR + 4} rx={6} ry={9} fill={species === 'panda' ? look.dark : look.body} />

      {/* Head */}
      {frogEyes ? (
        <G>
          <Circle cx={44} cy={headY - 22} r={12} fill={look.body} />
          <Circle cx={76} cy={headY - 22} r={12} fill={look.body} />
          <Circle cx={44} cy={headY - 22} r={8} fill="#FFFFFF" />
          <Circle cx={76} cy={headY - 22} r={8} fill="#FFFFFF" />
        </G>
      ) : null}
      <Circle cx={60} cy={headY} r={headR} fill={look.body} />
      {species === 'fox' ? <Ellipse cx={60} cy={headY + 12} rx={20} ry={13} fill={look.light} /> : null}
      {species === 'cat' ? (
        <G stroke={look.dark} strokeWidth={2.2} strokeLinecap="round">
          <Path d={`M 54 ${headY - 24} L 55 ${headY - 17}`} />
          <Path d={`M 60 ${headY - 26} L 60 ${headY - 18}`} />
          <Path d={`M 66 ${headY - 24} L 65 ${headY - 17}`} />
        </G>
      ) : null}
      {species === 'panda' ? (
        <G>
          <Ellipse cx={49} cy={eyeY + 1} rx={8} ry={10} fill={look.dark} transform={`rotate(-20 49 ${eyeY + 1})`} />
          <Ellipse cx={71} cy={eyeY + 1} rx={8} ry={10} fill={look.dark} transform={`rotate(20 71 ${eyeY + 1})`} />
        </G>
      ) : null}
      {species === 'penguin' ? (
        <G>
          <Circle cx={51} cy={headY + 2} r={13} fill={look.light} />
          <Circle cx={69} cy={headY + 2} r={13} fill={look.light} />
          <Ellipse cx={60} cy={headY + 12} rx={19} ry={12} fill={look.light} />
        </G>
      ) : null}
      {species === 'dragon' ? <Ellipse cx={60} cy={headY + 13} rx={17} ry={10} fill={look.light} /> : null}

      {/* Face */}
      {frogEyes ? (
        <Eyes left={[44, headY - 22]} right={[76, headY - 22]} blink={blink} />
      ) : species === 'panda' ? (
        <G>
          {blink ? (
            <Eyes left={[50, eyeY]} right={[70, eyeY]} blink />
          ) : (
            <G>
              <Circle cx={50} cy={eyeY} r={4.4} fill="#FFFFFF" />
              <Circle cx={70} cy={eyeY} r={4.4} fill="#FFFFFF" />
              <Circle cx={50.8} cy={eyeY + 0.5} r={2.6} fill={INK} />
              <Circle cx={70.8} cy={eyeY + 0.5} r={2.6} fill={INK} />
            </G>
          )}
        </G>
      ) : (
        <Eyes left={[50, eyeY]} right={[70, eyeY]} blink={blink} />
      )}
      <Blush y={headY + 8} />
      {species === 'penguin' ? (
        <Path d={`M 55 ${headY + 7} L 65 ${headY + 7} L 60 ${headY + 13} Z`} fill={look.dark} />
      ) : species === 'frog' ? (
        <Path d={`M 46 ${headY + 6} Q 60 ${headY + 16} 74 ${headY + 6}`} stroke={INK} strokeWidth={2} fill="none" strokeLinecap="round" />
      ) : (
        <G>
          {species === 'fox' || species === 'cat' || species === 'panda' ? <Ellipse cx={60} cy={headY + 5} rx={2.6} ry={2} fill={INK} /> : null}
          <Path
            d={`M 55 ${headY + 9} Q 57.5 ${headY + 12} 60 ${headY + 9} Q 62.5 ${headY + 12} 65 ${headY + 9}`}
            stroke={INK}
            strokeWidth={1.8}
            fill="none"
            strokeLinecap="round"
          />
        </G>
      )}

      {/* Young and legend: a scarf in the group's color */}
      {stage >= 2 ? (
        <G>
          <Path d={`M 38 ${headY + 24} Q 60 ${headY + 32} 82 ${headY + 24} L 82 ${headY + 31} Q 60 ${headY + 39} 38 ${headY + 31} Z`} fill={accent} />
          <Path d={`M 70 ${headY + 32} L 76 ${headY + 46} L 68 ${headY + 46} L 64 ${headY + 34} Z`} fill={accent} />
        </G>
      ) : null}
    </G>
  );
}

function Crown() {
  return (
    <G>
      <Path d="M 46 26 L 47 12 L 54 20 L 60 8 L 66 20 L 73 12 L 74 26 Z" fill={GOLD} />
      <Circle cx={60} cy={20} r={2.2} fill="#F07F99" />
      <Circle cx={51} cy={22} r={1.6} fill="#6AB4EC" />
      <Circle cx={69} cy={22} r={1.6} fill="#62C385" />
    </G>
  );
}

function Sparkles() {
  const star = (x: number, y: number, r: number) =>
    `M ${x} ${y - r} Q ${x + r * 0.2} ${y - r * 0.2} ${x + r} ${y} Q ${x + r * 0.2} ${y + r * 0.2} ${x} ${y + r} Q ${x - r * 0.2} ${y + r * 0.2} ${x - r} ${y} Q ${x - r * 0.2} ${y - r * 0.2} ${x} ${y - r} Z`;
  return (
    <G fill={GOLD}>
      <Path d={star(16, 30, 6)} />
      <Path d={star(104, 40, 5)} />
      <Path d={star(12, 82, 4)} />
      <Path d={star(108, 88, 6)} />
    </G>
  );
}

function HatShape({ hat, top }: { hat: NonNullable<Hat>; top: number }) {
  if (hat === 'witch') {
    return (
      <G>
        <Path d={`M 60 ${top - 26} L 46 ${top + 2} L 74 ${top + 2} Z`} fill="#7E66C9" />
        <Ellipse cx={60} cy={top + 3} rx={22} ry={4} fill="#5B4A99" />
        <Path d={`M 51 ${top - 2} L 69 ${top - 2} L 70 ${top + 1} L 50 ${top + 1} Z`} fill="#F6B04B" />
      </G>
    );
  }
  if (hat === 'santa') {
    return (
      <G>
        <Path d={`M 44 ${top + 2} Q 56 ${top - 26} 82 ${top - 14} L 76 ${top + 2} Z`} fill="#E25C6A" />
        <Ellipse cx={60} cy={top + 3} rx={18} ry={4.5} fill="#FFFFFF" />
        <Circle cx={83} cy={top - 14} r={4.5} fill="#FFFFFF" />
      </G>
    );
  }
  return (
    <G>
      <Path d={`M 60 ${top - 24} L 50 ${top + 2} L 70 ${top + 2} Z`} fill="#8D6EEB" />
      <Path d={`M 56 ${top - 14} L 64 ${top - 14} L 66 ${top - 8} L 54 ${top - 8} Z`} fill="#FDD474" />
      <Path d={`M 52 ${top - 4} L 68 ${top - 4} L 69 ${top} L 51 ${top} Z`} fill="#F0869F" />
      <Circle cx={60} cy={top - 25} r={3.5} fill="#FDD474" />
    </G>
  );
}

// A still preview of each species, for the picker in the group form
export function MascotPreview({ species, accent, selected }: { species: MascotSpecies; accent: string; selected: boolean }) {
  return (
    <View className={`items-center rounded-2xl p-1 ${selected ? 'bg-brand-200' : 'bg-white'}`}>
      <Mascot species={species} stage={2} accent={accent} size={64} animated={false} />
    </View>
  );
}
