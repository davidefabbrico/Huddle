// A small ⓘ next to a label: tap it to read the explanation in a panel over the page (screens stay clean,
// the help is one tap away, and the panel is always on top and easy to read). `children`: richer content
// (the points rules, the rank ladder) under the text.

import { useState, type ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from './Sheet';
import { Text } from './Text';

export function InfoTip({ text, title = 'Come funziona', label, children }: {
  text?: string;
  title?: string;
  label?: string; // for screen readers: what it explains
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={label ?? 'Spiegazione'} hitSlop={10}>
        <Ionicons name="information-circle-outline" size={18} className="text-stone-500" />
      </Pressable>
      {open ? (
        <Sheet visible onClose={() => setOpen(false)} title={title}>
          {text ? <Text className="text-base leading-6 text-ink">{text}</Text> : null}
          {children}
        </Sheet>
      ) : null}
    </>
  );
}
