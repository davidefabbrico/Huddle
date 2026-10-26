// Bottom tab bar, Instagram style: icons only (labels kept for screen readers), filled when active.
// Gruppi · Eventi · ➕ Crea · Chat · Profilo (your avatar). Notifications live behind the bell on Gruppi.

import type { ComponentProps } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { Avatar } from '../../../components/Avatar';
import { colors } from '../../../components/theme';
import { useAuth } from '../../../hooks/useAuth';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Outline icon normally, filled icon on the active tab
function tabIcon(outline: IconName, filled: IconName) {
  return ({ focused }: { focused: boolean }) => (
    <Ionicons name={focused ? filled : outline} size={26} color={focused ? colors.ink : colors.muted} />
  );
}

export default function TabsLayout() {
  const fullName = useAuth((state) => state.user?.full_name ?? '');

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: '#E7E5E4' },
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
              <Avatar name={fullName} size={24} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
