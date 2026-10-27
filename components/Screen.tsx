// Page wrapper: safe-area top padding, warm background, centered column on wide (web) screens.
// width: 'form' for forms (narrow, easy to read), 'page' for lists and chats, 'wide' for pages
// that use more columns on a computer (Columns, Grid).

import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const maxWidth = { form: 'max-w-2xl', page: 'max-w-3xl', wide: 'max-w-6xl' };

export function Screen({ children, width = 'form' }: { children: ReactNode; width?: keyof typeof maxWidth }) {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 bg-stone-50" style={{ paddingTop: insets.top }}>
      <View className={`w-full flex-1 self-center ${maxWidth[width]}`}>{children}</View>
    </View>
  );
}
