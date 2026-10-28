// Bottom tab bar, Material 3 style: icons only (labels kept for screen readers), filled on a pill when active.
// Gruppi · Eventi · ➕ Crea · Chat · Profilo (your avatar). Notifications live behind the bell on Gruppi.
// On wide screens the bar is hidden: the side menu (components/SideNav.tsx) takes its place.

import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, avatarOf } from '../../../components/Avatar';
import { useNeutrals } from '../../../components/GroupTheme';
import { barWithSafeArea } from '../../../components/safeArea';
import { useAuth } from '../../../hooks/useAuth';
import { useIsWide } from '../../../hooks/useLayout';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Height of the bar above the safe area (home indicator). By default React Navigation puts the icons
// at the top of a 49px bar (leaving the space meant for labels empty), so they look glued to the top edge.
// We make the icon box fill the tab (minus the tab's own 5px padding top and bottom): icons end up centered.
const TAB_BAR_CONTENT_HEIGHT = 60;
const TAB_PADDING = 5;

// Material 3 navigation bar: outline icon, or filled icon on a pastel pill when active (a round one, not squashed)
function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return (
      <View className={`h-10 w-14 items-center justify-center rounded-full ${focused ? 'bg-brand-200' : ''}`}>
        <Ionicons name={focused ? filled : outline} size={22} className={focused ? 'text-brand-800' : 'text-stone-500'} />
      </View>
    );
  };
}

export default function TabsLayout() {
  const user = useAuth((state) => state.user);
  const insets = useSafeAreaInsets();
  const wide = useIsWide();
  const neutrals = useNeutrals();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          display: wide ? 'none' : 'flex',
          // White like the cards (dark grey at night), with a hairline over the page
          backgroundColor: neutrals.white,
          borderTopWidth: 1,
          borderTopColor: neutrals.stone[200],
          // Space for the home indicator below the icons (CSS env() on the web, see safeArea.ts)
          ...barWithSafeArea(insets.bottom, TAB_BAR_CONTENT_HEIGHT),
        },
        // Wide enough for the active pill (56px); the default box is 31x28
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
          // Brand-colored round button, like a "post" button
          tabBarIcon: ({ focused }) => (
            <View className={`h-12 w-12 items-center justify-center rounded-full ${focused ? 'bg-brand-300' : 'bg-brand-200'}`}>
              <Ionicons name="add" size={26} className="text-brand-800" />
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
            <View className={`h-10 w-14 items-center justify-center rounded-full ${focused ? 'bg-brand-200' : ''}`}>
              {user ? <Avatar {...avatarOf(user)} size={26} /> : null}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
