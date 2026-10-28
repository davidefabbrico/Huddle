// Group icon picker (like choosing an app icon): a live preview, a row of colors,
// and the emoji grid by category. Only values from lib/groupIcons.ts can be chosen.

import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { GROUP_COLORS, GROUP_COLOR_KEYS, GROUP_ICON_CATEGORIES, type GroupColor } from '../lib/groupIcons';
import { Chip } from './Chip';
import { GroupIcon } from './GroupIcon';

interface Props {
  name: string;
  icon: string;
  color: GroupColor;
  onChange: (value: { icon: string; color: GroupColor }) => void;
}

const CELL = 44;

export function GroupIconPicker({ name, icon, color, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const startCategory = Math.max(0, GROUP_ICON_CATEGORIES.findIndex((c) => c.icons.includes(icon)));
  const [category, setCategory] = useState(startCategory);

  return (
    <View className="gap-3">
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={open ? 'Chiudi la scelta dell’icona' : 'Cambia l’icona del gruppo'}
        className="items-center gap-2"
      >
        <GroupIcon name={name || 'Gruppo'} icon={icon} color={color} size={88} />
        <Text className="text-sm font-pixel text-brand-600">{open ? 'Fatto' : 'Cambia icona'}</Text>
      </Pressable>

      {open ? (
        <View className="gap-3 rounded-3xl border-2 border-b-4 border-line bg-white p-3">
          <View className="flex-row flex-wrap justify-center gap-2.5">
            {GROUP_COLOR_KEYS.map((key) => (
              <Pressable
                key={key}
                onPress={() => onChange({ icon, color: key })}
                accessibilityRole="radio"
                accessibilityState={{ selected: color === key }}
                accessibilityLabel={GROUP_COLORS[key].label}
                className={`h-8 w-8 rounded-full ${GROUP_COLORS[key].swatch} ${color === key ? 'border-[3px] border-ink' : 'border-2 border-white'}`}
              />
            ))}
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
            {GROUP_ICON_CATEGORIES.map((c, index) => (
              <Chip key={c.name} label={c.name} selected={category === index} onPress={() => setCategory(index)} />
            ))}
          </ScrollView>

          <View className="flex-row flex-wrap justify-center gap-1">
            {GROUP_ICON_CATEGORIES[category].icons.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => onChange({ icon: emoji, color })}
                accessibilityRole="radio"
                accessibilityState={{ selected: icon === emoji }}
                accessibilityLabel={`Icona ${emoji}`}
                className={`items-center justify-center rounded-2xl ${icon === emoji ? GROUP_COLORS[color].tile : 'active:bg-stone-100'}`}
                style={{ width: CELL, height: CELL }}
              >
                <Text style={{ fontSize: 26, lineHeight: 34 }}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
