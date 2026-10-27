// Wide screens (computer browser, tablet in landscape): side menu instead of the bottom bar, and
// pages on more columns. Phones keep the single-column layout.

import { useWindowDimensions } from 'react-native';

export const WIDE_MIN_WIDTH = 900;
const THREE_COLUMNS_MIN_WIDTH = 1300;

export function useIsWide(): boolean {
  return useWindowDimensions().width >= WIDE_MIN_WIDTH;
}

// Columns for card grids: 1 on phones, 2 on laptops, 3 on large monitors
export function useGridColumns(): number {
  const { width } = useWindowDimensions();
  return width >= THREE_COLUMNS_MIN_WIDTH ? 3 : width >= WIDE_MIN_WIDTH ? 2 : 1;
}
