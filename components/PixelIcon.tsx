// Pixel icons for the arcade look, drawn like the mascots (components/Mascot.tsx): small text grids,
// '#' = a pixel. Used where icons are most visible: the bottom bar, the side menu, the top buttons.
// Color from `color` or from a text-* className (cssInterop, like Ionicons in components/iconColors.ts).

import { cssInterop } from 'nativewind';
import type { StyleProp, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const ICONS = {
  people: [
    '.............',
    '..###...###..',
    '.#####.#####.',
    '.#####.#####.',
    '..###...###..',
    '.............',
    '..###...###..',
    '.#####.#####.',
    '.#####.#####.',
    '.#####.#####.',
  ],
  calendar: [
    '..#.....#..',
    '###########',
    '###########',
    '#.........#',
    '#.#.#.#.#.#',
    '#.........#',
    '#.#.#.#.#.#',
    '#.........#',
    '###########',
  ],
  plus: [
    '...###...',
    '...###...',
    '...###...',
    '#########',
    '#########',
    '#########',
    '...###...',
    '...###...',
    '...###...',
  ],
  chat: [
    '.##########.',
    '#..........#',
    '#..........#',
    '#.##.##.##.#',
    '#..........#',
    '.##########.',
    '..##........',
    '..#.........',
  ],
  bell: [
    '.....#.....',
    '....###....',
    '...#####...',
    '..#######..',
    '..#######..',
    '..#######..',
    '.#########.',
    '###########',
    '...........',
    '....###....',
  ],
  search: [
    '..####....',
    '.#....#...',
    '#......#..',
    '#......#..',
    '#......#..',
    '#......#..',
    '.#....##..',
    '..####.##.',
    '.......###',
    '........##',
  ],
  back: [
    '....#......',
    '...##......',
    '..#########',
    '.##########',
    '..#########',
    '...##......',
    '....#......',
  ],
  send: [
    '##.......',
    '####.....',
    '.#####...',
    '..#######',
    '.#####...',
    '####.....',
    '##.......',
  ],
} as const;

export type PixelIconName = keyof typeof ICONS;

// One path for all the pixels (no hairline gaps), each run of '#' a rectangle
const PATHS = Object.fromEntries(
  Object.entries(ICONS).map(([name, rows]) => {
    let d = '';
    rows.forEach((row, y) => {
      for (const m of row.matchAll(/#+/g)) d += `M${m.index} ${y}h${m[0].length}v1h${-m[0].length}z`;
    });
    return [name, { d, w: rows[0].length, h: rows.length }];
  }),
) as Record<PixelIconName, { d: string; w: number; h: number }>;

interface Props {
  name: PixelIconName;
  size?: number;
  color?: string;
  className?: string;
  style?: StyleProp<ViewStyle>; // what cssInterop fills from className (its color becomes `color`)
}

export function PixelIcon({ name, size = 22, color, style }: Props) {
  const { d, w, h } = PATHS[name];
  const side = Math.max(w, h);
  // Centered in a square box, whatever the grid's shape. Filled with currentColor: on the web the
  // text-* class colors the <svg> (theme colors are CSS variables, which a browser resolves in styles
  // but not in an SVG fill attribute); on phones cssInterop turns the class into `color`.
  return (
    <Svg width={size} height={size} color={color} style={[style, color ? ({ color } as ViewStyle) : null]} viewBox={`${(w - side) / 2} ${(h - side) / 2} ${side} ${side}`}>
      <Path d={d} fill="currentColor" />
    </Svg>
  );
}

cssInterop(PixelIcon, { className: { target: 'style', nativeStyleToProp: { color: true } } });
