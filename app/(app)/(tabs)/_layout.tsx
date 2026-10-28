// Bottom tab bar, Material 3 style: icons only (labels kept for screen readers), filled on a pill when active.
// Gruppi · Eventi · ➕ Crea · Chat · Profilo (your avatar). Notifications live behind the bell on Gruppi.
// On wide screens the bar is hidden: the side menu (components/SideNav.tsx) takes its place.

import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, avatarOf } from '../../../components/Avatar';
import { barWithSafeArea } from '../../../components/safeArea';
import { colors } from '../../../components/theme';
import { useAuth } from '../../../hooks/useAuth';
import { useIsWide } from '../../../hooks/useLayout';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Height of the bar above the safe area (home indicator). By default React Navigation puts the icons
// at the top of a 49px bar (leaving the space meant for labels empty), so they look glued to the top edge.
// We make the icon box fill the tab (minus the tab's own 5px padding top and bottom): icons end up centered.
const TAB_BAR_CONTENT_HEIGHT = 60;
const TAB_PADDING = 5;

// Material 3 navigation bar: outline icon, or filled icon on a pastel pill when active
function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View className={`h-8 w-16 items-center justify-center rounded-full ${focused ? 'bg-brand-200' : ''}`}>
        <Ionicons name={focused ? filled : outline} size={22} color={focused ? colors.ink : colors.muted} />
      </View>
    );
  };
}

export default function TabsLayout() {
  const user = useAuth((state) => state.user);
  const insets = useSafeAreaInsets();
  const wide = useIsWide();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          display: wide ? 'none' : 'flex',
          backgroundColor: '#EFEAE6', // Material 3 surface container
          borderTopWidth: 0,
          // Space for the home indicator below the icons (CSS env() on the web, see safeArea.ts)
          ...barWithSafeArea(insets.bottom, TAB_BAR_CONTENT_HEIGHT),
        },
        // Wide enough for the active pill (64px); the default box is 31x28
        tabBarIconStyle: { width: 64, height: TAB_BAR_CONTENT_HEIGHT - 2 * TAB_PADDING },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Gruppi', tabBarAccessibilityLabel: 'Gruppi', tabBarIcon: tabIcon('people-outline', 'people') }}
      />
      <Tabs.Screen
        name="events"
        options={{ title: 'Eventi', tabBarAccessibilityLabel: 'Eventi', tabBarIcon: tabIcon('calendar-outline', 'calendar') }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Crea',
          tabBarAccessibilityLabel: 'Crea',
          // Brand-colored square, like a "post" button
          tabBarIcon: ({ focused }) => (
            <View className={`h-10 w-14 items-center justify-center rounded-2xl ${focused ? 'bg-brand-300' : 'bg-brand-200'}`}>
              <Ionicons name="add" size={26} color={colors.ink} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{ title: 'Chat', tabBarAccessibilityLabel: 'Chat', tabBarIcon: tabIcon('chatbubbles-outline', 'chatbubbles') }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profilo',
          tabBarAccessibilityLabel: 'Profilo',
          // Your avatar, on the pill when active
          tabBarIcon: ({ focused }) => (
            <View className={`h-8 w-16 items-center justify-center rounded-full ${focused ? 'bg-brand-200' : ''}`}>
              {user ? <Avatar {...avatarOf(user)} size={26} /> : null}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
