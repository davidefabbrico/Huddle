// The group's mascot, as vintage pixel art (react-native-svg) and animated (reanimated): it pops in,
// bobs up and down one pixel like an old game sprite, blinks and now and then hops; a tap makes it
// bounce with a pixel heart. Seven quick taps: it dances (easter egg, onSecret). Fed or played with
// (the group's tamagotchi, components/GroupMascotCard.tsx) it hops with a pixel apple or ball; when sad it
// stops hopping.
// Stages: 0 egg, 1 cub (smaller), 2 young (with a scarf in the group's color), 3 legend (crown and
// sparkles). Seasonal hats from lib/mascot.ts.
//
// Sprites are 16x16 text grids, one character per pixel (legend in PIXEL_COLORS); the dark outline is
// added around them automatically, so a sprite only draws its inside.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
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
import Svg, { G, Path, Rect } from 'react-native-svg';
import type { Hat } from '../lib/mascot';
import type { MascotSpecies } from '../lib/types';

interface Look {
  body: string; // B
  light: string; // L: belly, muzzle
  dark: string; // D: ear tips, patches, feet
  inner: string; // I: inside the ears, horns
  lid: 'B' | 'L' | 'D'; // what the eyes turn into while blinking
  neck: number; // the sprite's row where the scarf goes
  hatRow: number; // the sprite's row where a hat's brim sits (the frog's above its eyes)
}

// A slightly faded, warm palette: old cartridge colors rather than bright pastels
const LOOKS: Record<MascotSpecies, Look> = {
  fox: { body: '#E8925A', light: '#FBEBD3', dark: '#7A4128', inner: '#F4C09C', lid: 'B', neck: 11, hatRow: 3 },
  cat: { body: '#E3BE8C', light: '#FBF0DC', dark: '#A87A4E', inner: '#EFA9A6', lid: 'B', neck: 11, hatRow: 3 },
  panda: { body: '#F6F1E7', light: '#F6F1E7', dark: '#3E3A44', inner: '#3E3A44', lid: 'D', neck: 11, hatRow: 3 },
  frog: { body: '#8DBF7A', light: '#DDEDC4', dark: '#4E7A45', inner: '#8DBF7A', lid: 'B', neck: 10, hatRow: 1 },
  penguin: { body: '#56607A', light: '#F6F1E7', dark: '#E6A245', inner: '#56607A', lid: 'L', neck: 10, hatRow: 2 },
  dragon: { body: '#A994DE', light: '#E9E1F7', dark: '#6C58A8', inner: '#E8C46A', lid: 'B', neck: 11, hatRow: 3 },
};

// The mascot moves even with "Riduci movimento" on (iPhone/Android accessibility): its motions are
// small and slow, and without them it's just a picture. Confetti still respects the setting.
const MOVE = ReduceMotion.Never;

const OUTLINE = '#3A2E39'; // the dark plum outline of old sprites
const INK = '#2A2230'; // eyes, nose, mouth
const SHINE = '#FFFDF6'; // the white dot in the eyes
const BLUSH = '#EE9A9A';
const GOLD = '#E9B84A';

// Egg and creatures: '.' empty, B body, L light, D dark, I inner, W eye shine, E eye, e eye bottom,
// P blush, N ink (nose, mouth, crack). The panda's eyes are just a shine in its dark patches.
const EGG = [
  '................',
  '................',
  '......LLLL......',
  '.....LLLLLL.....',
  '....LBBLLLNL....',
  '....LBBLLNLL....',
  '...LLLLLLLNLL...',
  '...LLLLLLNLLL...',
  '...LLLLLLLLBL...',
  '...LLLLLLLLLL...',
  '...LLWELLWELL...',
  '...LLeeLLeeLL...',
  '...LPPLLLLPPL...',
  '....LLLLLLLL....',
  '.....LLLLLL.....',
  '................',
];

const EGG_HAT_ROW = 2;

const SPRITES: Record<MascotSpecies, string[]> = {
  fox: [
    '..D..........D..',
    '..DB........BD..',
    '..BIB......BIB..',
    '..BIIBBBBBBIIB..',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBWEBBBBBBWEBB.',
    '.BBeeBBBBBBeeBB.',
    '.BPPLLLNNLLLPPB.',
    '.BBLLLLLLLLLLBB.',
    '..BBLLLLLLLLBB..',
    '...BBBBBBBBBB...',
    '..BBBLLLLLLBBB..',
    '.BBBLLLLLLLLBBB.',
    '.BBBLLLLLLLLBBB.',
    '..DDD......DDD..',
  ],
  cat: [
    '................',
    '..B..........B..',
    '..BIB......BIB..',
    '..BIBBBDDBBBIB..',
    '..BBBBBDDBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBWEBBBBBBWEBB.',
    '.BBeeBBBBBBeeBB.',
    '.BPPBBBNNBBBPPB.',
    '.BBBBBBLLBBBBBB.',
    '..BBBBBBBBBBBB..',
    '...BBBBBBBBBB...',
    '..BBBLLLLLLBBB..',
    '.BBBLLLLLLLLBBB.',
    '.BBBLLLLLLLLBBB.',
    '..DDD......DDD..',
  ],
  panda: [
    '................',
    '................',
    '..DD........DD..',
    '.DDDBBBBBBBBDDD.',
    '..DBBBBBBBBBBD..',
    '.BBBBBBBBBBBBBB.',
    '.BBDDBBBBBBDDBB.',
    '.BDWDBBBBBBDWDB.',
    '.BDDDBBNNBBDDDB.',
    '.PPBBBBBBBBBBPP.',
    '..BBBBBBBBBBBB..',
    '...DDDDDDDDDD...',
    '..DDBBBBBBBBDD..',
    '.DDBBBBBBBBBBDD.',
    '.DDBBBBBBBBBBDD.',
    '..DDD......DDD..',
  ],
  frog: [
    '................',
    '................',
    '..BBBB....BBBB..',
    '.BBWEBB..BBWEBB.',
    '.BBeeBBBBBBeeBB.',
    '.BBBBBBBBBBBBBB.',
    '.BPPBBBBBBBBPPB.',
    '.BNBBBBBBBBBBNB.',
    '.BBNNNNNNNNNNBB.',
    '..BBBBBBBBBBBB..',
    '...BBBBBBBBBB...',
    '..BBLLLLLLLLBB..',
    '.BBLLLLLLLLLLBB.',
    '.BBLLLLLLLLLLBB.',
    '..BBLLLLLLLLBB..',
    '.DDD........DDD.',
  ],
  penguin: [
    '................',
    '................',
    '....BBBBBBBB....',
    '...BBBBBBBBBB...',
    '..BBBLLBBLLBBB..',
    '.BBLLLLLLLLLLBB.',
    '.BLWELLLLLLWELB.',
    '.BLeeLLLLLLeeLB.',
    '.BLPPLLDDLLPPLB.',
    '.BBLLLLLLLLLLBB.',
    '..BBLLLLLLLLBB..',
    '.BBBLLLLLLLLBBB.',
    'BBBLLLLLLLLLLBBB',
    '.BBLLLLLLLLLLBB.',
    '..BBLLLLLLLLBB..',
    '...DDD....DDD...',
  ],
  dragon: [
    '................',
    '...I........I...',
    '...II......II...',
    '...BBBBBBBBBB...',
    '..BBBBBBBBBBBB..',
    '.BBBBBBBBBBBBBB.',
    '.BBWEBBBBBBWEBB.',
    '.BBeeBBBBBBeeBB.',
    '.BPPBLLLLLLBPPB.',
    '.BBBLLNLLNLLBBB.',
    '..BBBLLLLLLBBB..',
    'D..BBBBBBBBBB..D',
    'DDBBBLLLLLLBBBDD',
    '.DBBLLLLLLLLBBD.',
    '..BBLLLLLLLLBB..',
    '..DDD......DDD..',
  ],
};

// Hats, crown and the pixel heart: their own little grids, with their own colors
const OVERLAYS: Record<NonNullable<Hat> | 'crown', { rows: string[]; colors: Record<string, string> }> = {
  witch: {
    rows: ['.....P....', '....PP....', '...PPPP...', '...OOOO...', 'KKKKKKKKKK'],
    colors: { P: '#7E66C9', O: '#E6A245', K: '#55468F' },
  },
  santa: {
    rows: ['.....RRWW.', '....RRRR..', '...RRRRR..', 'WWWWWWWWWW'],
    colors: { R: '#D45A62', W: '#FFFDF6' },
  },
  party: {
    rows: ['..YY..', '..PP..', '.PYYP.', '.PPPP.', 'PYYYYP'],
    colors: { P: '#8D6EEB', Y: '#F2CF6B' },
  },
  crown: {
    rows: ['Y..YY..Y', 'YY.YY.YY', 'YRYYYYUY', 'YYYYYYYY'],
    colors: { Y: GOLD, R: '#E0708A', U: '#6AA6D8' },
  },
};

const HEART = ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'];

// The treats of the tamagotchi, with the outline like the mascot
const APPLE = ['....G..', '...GG..', '.RRGRR.', 'RRRRRRR', 'RWRRRRR', 'RRRRRRR', '.RRRRR.', '..R.R..'];
const BALL = ['..WWW..', '.WWKWW.', 'WWKKKWW', 'WWWKWWW', 'WKWWWKW', '.WWWWW.', '..WWW..'];

// The canvas: the 16x16 sprite at (3, 4), room above for hats and around for sparkles and the outline
const COLS = 22;
const ROWS = 22;
const SX = 3;
const SY = 4;

interface Pixel {
  x: number;
  y: number;
  w: number; // horizontal run of same-colored pixels, drawn as one rectangle
  color: string;
}

// Builds the picture: sprite (+ scarf, hat or crown), then the outline around it, merged into runs
function drawPixels(species: MascotSpecies, stage: 0 | 1 | 2 | 3, accent: string, hat: Hat, blink: boolean): Pixel[] {
  const look = LOOKS[species];
  const sprite = stage === 0 ? EGG : SPRITES[species];
  const lid = stage === 0 ? 'L' : look.lid;
  const palette: Record<string, string> = {
    B: look.body, L: look.light, D: look.dark, I: look.inner,
    W: SHINE, E: INK, e: INK, P: BLUSH, N: INK, S: accent,
  };
  const grid: (string | null)[][] = Array.from({ length: ROWS }, () => Array<string | null>(COLS).fill(null));

  sprite.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === '.') return;
      // blinking: the top of the eyes takes the color around them, the bottom becomes a closed line
      const key = blink && (ch === 'W' || ch === 'E') ? lid : ch;
      grid[SY + r][SX + c] = palette[key];
    });
  });

  // Young and legend: a scarf in the group's color, with a tail hanging on one side
  if (stage >= 2) {
    const r = SY + look.neck;
    for (let c = SX + 2; c <= SX + 13; c++) if (grid[r][c]) grid[r][c] = accent;
    grid[r + 1][SX + 10] = accent;
    grid[r + 2][SX + 10] = accent;
  }

  // A hat (or the legend's crown) sits on the top of the head
  const overlay = hat ? OVERLAYS[hat] : stage === 3 ? OVERLAYS.crown : null;
  if (overlay) {
    const top = SY + (stage === 0 ? EGG_HAT_ROW : look.hatRow) - overlay.rows.length + 1;
    const left = Math.floor((COLS - overlay.rows[0].length) / 2);
    overlay.rows.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch !== '.' && top + r >= 0) grid[top + r][left + c] = overlay.colors[ch];
      }),
    );
  }

  // The outline: every empty pixel touching the picture (not diagonally)
  const filled = grid.map((row) => row.map((cell) => cell !== null));
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (filled[r][c]) continue;
      const touches = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([y, x]) => filled[y]?.[x]);
      if (touches) grid[r][c] = OUTLINE;
    }
  }

  // Legend: four gold sparkles in the corners
  if (stage === 3) {
    for (const [x, y] of [[1, 3], [19, 6], [1, 14], [20, 16]]) {
      grid[y][x] = GOLD;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) if (!grid[y + dy]?.[x + dx]) grid[y + dy][x + dx] = '#F5DC93';
    }
  }

  return toRuns(grid);
}

function toRuns(grid: (string | null)[][]): Pixel[] {
  const runs: Pixel[] = [];
  grid.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const color = row[x];
      if (!color) {
        x++;
        continue;
      }
      let w = 1;
      while (row[x + w] === color) w++;
      runs.push({ x, y, w, color });
      x += w;
    }
  });
  return runs;
}

// One path per color: pixels of the same color are filled as one shape, so no hairline gaps show
// between them when scaled; each run is a hair wider and taller so different colors don't gap either
function Pixels({ pixels }: { pixels: Pixel[] }) {
  const paths = new Map<string, string>();
  for (const p of pixels) paths.set(p.color, `${paths.get(p.color) ?? ''}M${p.x} ${p.y}h${p.w + 0.05}v1.05h${-(p.w + 0.05)}z`);
  return (
    <G>
      {[...paths].map(([color, d]) => (
        <Path key={color} d={d} fill={color} />
      ))}
    </G>
  );
}

export interface Treat {
  id: number; // a new id = a new treat
  kind: 'feed' | 'play';
}

interface Props {
  species: MascotSpecies;
  stage: 0 | 1 | 2 | 3;
  accent: string; // the group's color (scarf)
  hat?: Hat;
  size?: number;
  animated?: boolean; // false: a still picture (pickers)
  sad?: boolean; // hungry or bored: no hops
  treat?: Treat | null; // just fed or played with
  onSecret?: () => void; // seven quick taps
}

export function Mascot({ species, stage, accent, hat = null, size = 120, animated = true, sad = false, treat = null, onSecret }: Props) {
  const [blink, setBlink] = useState(false);
  const [hearts, setHearts] = useState<number[]>([]);
  const taps = useRef<number[]>([]);
  const pixels = useMemo(() => drawPixels(species, stage, accent, hat, blink), [species, stage, accent, hat, blink]);
  const px = size / COLS; // one pixel on screen

  const scale = useSharedValue(animated ? 0.3 : 1);
  const bob = useSharedValue(0);
  const hop = useSharedValue(0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (!animated) return;
    scale.set(withSpring(1, { damping: 9, stiffness: 140, reduceMotion: MOVE }));
    // the old-game idle: up one pixel, down one pixel, without in-between frames
    const step = { duration: 520, easing: Easing.steps(1), reduceMotion: MOVE };
    bob.set(withRepeat(withSequence(MOVE, withTiming(-px, step), withTiming(0, step)), -1, false, undefined, MOVE));
    // every few seconds it blinks, and now and then it does a little hop
    let blinkTimer: ReturnType<typeof setTimeout>;
    let hopTimer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      blinkTimer = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 160);
        scheduleBlink();
      }, 2500 + Math.random() * 2500);
    };
    const scheduleHop = () => {
      hopTimer = setTimeout(() => {
        hop.set(withSequence(MOVE, withTiming(-3 * px, { duration: 140, reduceMotion: MOVE }), withSpring(0, { damping: 6, reduceMotion: MOVE })));
        scheduleHop();
      }, 4000 + Math.random() * 3000);
    };
    scheduleBlink();
    if (!sad) scheduleHop();
    return () => {
      clearTimeout(blinkTimer);
      clearTimeout(hopTimer);
    };
  }, [animated, sad, scale, bob, hop, px]);

  // A treat: two happy hops
  const treatId = treat?.id;
  useEffect(() => {
    if (!animated || !treatId) return;
    const up = withTiming(-4 * px, { duration: 140, reduceMotion: MOVE });
    const down = withTiming(0, { duration: 140, reduceMotion: MOVE });
    hop.set(withSequence(MOVE, up, down, up, withSpring(0, { damping: 6, reduceMotion: MOVE })));
  }, [animated, treatId, hop, px]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: bob.value + hop.value }, { scale: scale.value }, { rotate: `${tilt.value}deg` }],
  }));

  function tap() {
    if (!animated) return;
    scale.set(withSequence(MOVE, withTiming(1.15, { duration: 120, reduceMotion: MOVE }), withSpring(1, { damping: 6, reduceMotion: MOVE })));
    const id = Date.now();
    setHearts((h) => [...h, id]);
    setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 1100);
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 4000), now];
    if (taps.current.length >= 7) {
      taps.current = [];
      // the dance
      tilt.set(withSequence(MOVE, ...[-12, 12, -12, 12, -8, 8, 0].map((deg) => withTiming(deg, { duration: 160, easing: Easing.steps(2), reduceMotion: MOVE }))));
      onSecret?.();
    }
  }

  // The cub is the same sprite, a bit smaller and standing on the same ground
  const cub = stage === 1 ? 0.82 : 1;

  return (
    <Pressable onPress={tap} accessibilityRole="image" accessibilityLabel="Mascotte del gruppo" disabled={!animated}>
      <Animated.View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size} viewBox={`0 0 ${COLS} ${ROWS}`}>
          {/* the shadow on the ground */}
          <Rect x={6} y={ROWS - 1} width={COLS - 12} height={1} fill="#000000" opacity={0.1} />
          <G transform={cub === 1 ? undefined : `translate(${(COLS * (1 - cub)) / 2} ${(ROWS - 1) * (1 - cub)}) scale(${cub})`}>
            <Pixels pixels={pixels} />
          </G>
        </Svg>
      </Animated.View>
      {hearts.map((id) => (
        <FloatingPixels key={id} size={size} sprite={HEART_SPRITE} />
      ))}
      {treat ? <FloatingPixels key={treat.id} size={size} sprite={treat.kind === 'feed' ? APPLE_SPRITE : BALL_SPRITE} /> : null}
    </Pressable>
  );
}

interface SmallSprite {
  pixels: Pixel[];
  w: number;
  h: number;
}

// A little sprite from its grid, with the dark outline around it (or not, for the heart)
function smallSprite(rows: string[], colors: Record<string, string>, outline = true): SmallSprite {
  const m = outline ? 1 : 0;
  const h = rows.length + 2 * m;
  const w = rows[0].length + 2 * m;
  const grid: (string | null)[][] = Array.from({ length: h }, (_, r) =>
    Array.from({ length: w }, (_, c) => {
      const ch = rows[r - m]?.[c - m];
      return ch && ch !== '.' ? colors[ch] : null;
    }),
  );
  if (outline) {
    const filled = grid.map((row) => row.map((cell) => cell !== null));
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        if (!filled[r][c] && [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]].some(([y, x]) => filled[y]?.[x])) grid[r][c] = OUTLINE;
      }
    }
  }
  return { pixels: toRuns(grid), w, h };
}

const HEART_SPRITE = smallSprite(HEART, { R: '#E0607A' }, false);
const APPLE_SPRITE = smallSprite(APPLE, { R: '#E25C5C', W: '#FFB3A8', G: '#6BAE5A' });
const BALL_SPRITE = smallSprite(BALL, { W: '#FFFDF6', K: INK });

function FloatingPixels({ size, sprite }: { size: number; sprite: SmallSprite }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    // climbs in pixel steps, like the rest
    y.set(withTiming(-size * 0.5, { duration: 1000, easing: Easing.steps(6), reduceMotion: MOVE }));
    opacity.set(withTiming(0, { duration: 1000, reduceMotion: MOVE }));
  }, [y, opacity, size]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }], opacity: opacity.value }));
  // same pixel size as the mascot's
  const px = size / COLS;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: size * 0.12, left: size * 0.66 }, style]}>
      <Svg width={sprite.w * px} height={sprite.h * px} viewBox={`0 0 ${sprite.w} ${sprite.h}`}>
        <Pixels pixels={sprite.pixels} />
      </Svg>
    </Animated.View>
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
