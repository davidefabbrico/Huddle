// Page wrapper: safe-area top padding, warm background, centered column on wide (web) screens

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-stone-50" style={{ paddingTop: insets.top }}>
      <View className="w-full max-w-2xl flex-1 self-center">{children}</View>
    </View>
  );
}
