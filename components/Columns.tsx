// Multi-column layouts for wide screens; on phones everything stays in one column, in the same order.
//   <Columns main={…} side={…} />  two columns: the main content and a narrower side column
//   <Grid>{cards}</Grid>           cards in 1, 2 or 3 columns (filled in turn, like a masonry)

import { Children, type ReactNode } from 'react';
import { View } from 'react-native';
import { useGridColumns, useIsWide } from '../hooks/useLayout';

export function Columns({ main, side }: { main: ReactNode; side: ReactNode }) {
  const wide = useIsWide();
  if (!wide) {
    return (
      <>
        {main}
        {side}
      </>
    );
  }
  return (
    <View className="flex-row items-start gap-8">
      <View className="flex-[3] gap-6">{main}</View>
      <View className="flex-[2] gap-6">{side}</View>
    </View>
  );
}

export function Grid({ children, maxColumns = 3 }: { children: ReactNode; maxColumns?: number }) {
  const count = Math.min(useGridColumns(), maxColumns);
  const items = Children.toArray(children);
  if (count === 1) return <View className="gap-3">{items}</View>;
  const columns = Array.from({ length: count }, (_, c) => items.filter((_, i) => i % count === c));
  return (
    <View className="flex-row items-start gap-4">
      {columns.map((column, c) => (
        <View key={c} className="flex-1 gap-4">
          {column}
        </View>
      ))}
    </View>
  );
}
