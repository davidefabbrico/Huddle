// The group's pixel-art mascot, shown only when you interact with a group (its page, organizing for it):
// it pops in animated with a speech bubble, the stage and the way to the next one. Next to it, the
// clan's emblem (easter egg): tap it to discover the clan's name, element and motto.
// Seven taps on the mascot: it dances and throws confetti.

import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { clanOf, ELEMENTS, hatFor, mascotOf, nextStage, stageFor, type Element } from '../lib/mascot';
import type { Group, GroupLevel } from '../lib/types';
import { Confetti } from './Confetti';
import { useBrand } from './GroupTheme';
import { Mascot } from './Mascot';

const GREETINGS = [
  'Sto per schiudermi… fate un evento insieme!',
  'Ciao! Cresco a ogni evento 🐾',
  'Siamo una bella squadra!',
  'Siamo leggenda 👑',
];

const BLOCKS = 10;

interface Props {
  group: Pick<Group, 'name' | 'tags' | 'icon' | 'mascot'> & { created_at?: string | null };
  level: GroupLevel;
  compact?: boolean; // organizing: a smaller mascot with a cheer
  cheer?: string;
}

export function GroupMascotCard({ group, level, compact = false, cheer }: Props) {
  const brand = useBrand();
  const [burst, setBurst] = useState(0);
  const [showClan, setShowClan] = useState(false);
  const stage = stageFor(level.xp);
  const next = nextStage(level.xp);
  const clan = clanOf(group);
  const progress = next ? (level.xp - stage.minXp) / (next.minXp - stage.minXp) : 1;

  return (
    <View className={`overflow-hidden rounded-3xl bg-brand-50 ${compact ? 'p-3' : 'p-4'}`}>
      <View className="flex-row items-center gap-3">
        <Mascot
          species={mascotOf(group)}
          stage={stage.level}
          accent={brand[400]}
          hat={hatFor(group.created_at ?? null)}
          size={compact ? 76 : 112}
          onSecret={() => setBurst((b) => b + 1)}
        />
        <View className="flex-1 gap-2">
          <View className="self-start rounded-2xl rounded-bl-sm bg-white px-3 py-2">
            <Text className="text-sm text-ink">{cheer ?? GREETINGS[stage.level]}</Text>
          </View>
          {compact ? null : (
            <View className="gap-1">
              <View className="flex-row items-center justify-between">
                <Text className="text-xs font-semibold text-brand-700">{stage.name}</Text>
                <Pressable onPress={() => setShowClan(!showClan)} accessibilityRole="button" accessibilityLabel="Il clan del gruppo" hitSlop={8}>
                  <ClanEmblem element={clan.element} rings={stage.level} size={30} />
                </Pressable>
              </View>
              {/* Progress in blocks, like an old game's energy bar */}
              <View className="flex-row gap-0.5">
                {Array.from({ length: BLOCKS }, (_, i) => (
                  <View key={i} className={`h-2 flex-1 ${i < Math.round(progress * BLOCKS) ? 'bg-brand-300' : 'bg-brand-100'}`} />
                ))}
              </View>
            </View>
          )}
        </View>
      </View>
      {showClan ? (
        <View className="mt-3 flex-row items-center gap-3 rounded-2xl bg-white p-3">
          <ClanEmblem element={clan.element} rings={stage.level} size={48} />
          <View className="flex-1">
            <Text className="font-semibold text-ink">{clan.name}</Text>
            <Text className="text-sm italic text-stone-500">“{clan.motto}”</Text>
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
