// Signed-in area: home feed, group detail, group chat.
// On wide screens (computer) the side menu stays on the left of every page.

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { SideNav } from '../../components/SideNav';
import { useIsWide } from '../../hooks/useLayout';

export default function AppLayout() {
  const wide = useIsWide();
  const stack = <Stack screenOptions={{ headerShown: false }} />;
  if (!wide) return stack;
  return (
    <View className="flex-1 flex-row bg-surface">
      <SideNav />
      <View className="flex-1">{stack}</View>
    </View>
  );
}
