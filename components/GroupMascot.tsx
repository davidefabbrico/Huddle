// The group's mascot as a small decoration (only where you interact with a group: its page, organizing
// for it). It says hi in a little bubble that fades after a few seconds; tap it for its stage, the way
// to the next one and the group's clan (easter egg). Seven quick taps: it dances and throws confetti.

import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { clanOf, ELEMENTS, hatFor, mascotOf, nextStage, stageFor, type Element } from '../lib/mascot';
import type { Group, GroupLevel } from '../lib/types';
import { Confetti } from './Confetti';
import { useBrand } from './GroupTheme';
import { Mascot } from './Mascot';

const GREETINGS = ['Sto per schiudermi!', 'Ciao! 🐾', 'Che squadra!', 'Siamo leggenda 👑'];
const BUBBLE_MS = 3500;

interface Props {
  group: Pick<Group, 'name' | 'tags' | 'icon' | 'mascot'> & { created_at?: string | null };
  level: GroupLevel;
  size?: number;
  cheer?: string; // instead of the greeting (organizing: "Si organizza!")
}

export function GroupMascot({ group, level, size = 52, cheer }: Props) {
  const brand = useBrand();
  const [burst, setBurst] = useState(0);
  const [bubble, setBubble] = useState(true);
  const [open, setOpen] = useState(false);
  const stage = stageFor(level.xp);
  const next = nextStage(level.xp);
  const clan = clanOf(group);
  const progress = next ? (level.xp - stage.minXp) / (next.minXp - stage.minXp) : 1;

  useEffect(() => {
    const timeout = setTimeout(() => setBubble(false), BUBBLE_MS);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <View className="z-20">
      <Mascot
        species={mascotOf(group)}
        stage={stage.level}
        accent={brand[400]}
        hat={hatFor(group.created_at ?? null)}
        size={size}
        onTap={() => setOpen((o) => !o)}
        onSecret={() => setBurst((b) => b + 1)}
      />
      {bubble && !open ? (
        <View pointerEvents="none" className="absolute rounded-xl rounded-br-sm bg-white px-2 py-1 shadow-sm" style={{ right: size - 6, top: -4 }}>
          <Text numberOfLines={1} className="text-xs text-ink">
            {cheer ?? GREETINGS[stage.level]}
          </Text>
        </View>
      ) : null}
      {open ? (
        <View className="absolute right-0 w-60 gap-2 rounded-2xl bg-white p-3 shadow-lg" style={{ top: size + 4 }}>
          <View className="flex-row items-center justify-between">
            <Text className="text-xs font-semibold text-brand-700">{stage.name}</Text>
            {next ? <Text className="text-xs text-stone-500">→ {next.name}</Text> : null}
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-brand-100">
            <View className="h-full rounded-full bg-brand-300" style={{ width: `${Math.round(progress * 100)}%` }} />
          </View>
          <View className="flex-row items-center gap-2">
            <ClanEmblem element={clan.element} rings={stage.level} size={32} />
            <View className="flex-1">
              <Text className="text-xs font-semibold text-ink">{clan.name}</Text>
              <Text className="text-xs italic text-stone-500">“{clan.motto}”</Text>
            </View>
          </View>
        </View>
      ) : null}
      <Confetti burst={burst} />
    </View>
  );
}

// The clan's emblem: the element's symbol on its pastel color; one ring per stage of the mascot
export function ClanEmblem({ element, rings, size }: { element: Element; rings: number; size: number }) {
  const { color, soft } = ELEMENTS[element];
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <Circle cx={24} cy={24} r={22} fill={soft} />
      {Array.from({ length: rings }, (_, i) => (
        <Circle key={i} cx={24} cy={24} r={22 - i * 2.4} fill="none" stroke={color} strokeWidth={1} opacity={0.6} />
      ))}
      {element === 'fuoco' ? <Path d="M24 10 C29 17 32 21 32 28 A8 8 0 0 1 16 28 C16 23 19 21 20 16 C22 19 24 20 25 19 C25 16 25 13 24 10 Z" fill={color} /> : null}
      {element === 'acqua' ? <Path d="M24 10 C29 18 32 23 32 29 A8 8 0 0 1 16 29 C16 23 19 18 24 10 Z" fill={color} /> : null}
      {element === 'vento' ? (
        <Path d="M12 20 H27 A4 4 0 1 0 23 16 M12 26 H32 A4 4 0 1 1 28 30 M12 23 H20" stroke={color} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      ) : null}
      {element === 'terra' ? <Path d="M10 34 L20 17 L26 26 L30 21 L38 34 Z" fill={color} /> : null}
      {element === 'fulmine' ? <Path d="M27 9 L15 27 H23 L20 39 L33 20 H25 Z" fill={color} /> : null}
    </Svg>
  );
}
