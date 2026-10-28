// Signed-in area: home feed, group detail, group chat.
// Right after signup, everything leads to the welcome (interests, about you) until it's done.
// On wide screens (computer) the side menu stays on the left of every page (not during the welcome).

import { View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { SideNav } from '../../components/SideNav';
import { useAuth } from '../../hooks/useAuth';
import { useIsWide } from '../../hooks/useLayout';

export default function AppLayout() {
  const wide = useIsWide();
  const pathname = usePathname();
  const onboarding = useAuth((state) => state.user !== null && state.user.onboarded_at === null);
  if (onboarding && pathname !== '/welcome') return <Redirect href="/welcome" />;
  const stack = <Stack screenOptions={{ headerShown: false }} />;
  if (!wide || onboarding) return stack;
  return (
    <View className="flex-1 flex-row bg-surface">
      <SideNav />
      <View className="flex-1">{stack}</View>
    </View>
  );
}
