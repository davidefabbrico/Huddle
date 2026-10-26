// Bottom tab bar, Instagram style: icons only (labels kept for screen readers), filled when active.
// Gruppi · Eventi · ➕ Crea · Chat · Profilo (your avatar). Notifications live behind the bell on Gruppi.

import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, avatarOf } from '../../../components/Avatar';
import { colors } from '../../../components/theme';
import { useAuth } from '../../../hooks/useAuth';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Height of the bar above the safe area (home indicator). By default React Navigation puts the icons
// at the top of a 49px bar (leaving the space meant for labels empty), so they look glued to the top edge.
// We make the icon box fill the tab (minus the tab's own 5px padding top and bottom): icons end up centered.
const TAB_BAR_CONTENT_HEIGHT = 60;
const TAB_PADDING = 5;

// Outline icon normally, filled icon on the active tab
function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ focused }: { focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={26} color={focused ? colors.ink : colors.muted} />;
  };
}

export default function TabsLayout() {
  const user = useAuth((state) => state.user);
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: '#E7E5E4',
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
        },
        // Wide enough for the ➕ square (44px) and the avatar ring; the default box is 31x28
        tabBarIconStyle: { width: 48, height: TAB_BAR_CONTENT_HEIGHT - 2 * TAB_PADDING },
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
            <View className={`h-9 w-11 items-center justify-center rounded-xl ${focused ? 'bg-brand-600' : 'bg-brand-500'}`}>
              <Ionicons name="add" size={26} color={colors.white} />
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
          // Your avatar, with a ring when active
          tabBarIcon: ({ focused }) => (
            <View className={`rounded-full border-2 p-0.5 ${focused ? 'border-ink' : 'border-transparent'}`}>
              {user ? <Avatar {...avatarOf(user)} size={24} /> : null}
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
