// Side menu on wide screens (computer browser): takes the place of the bottom tab bar and stays
// visible on every page (group, event, chat…). Same sections, plus Attività with the unread count.

import { useState, type ComponentProps } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import * as api from '../lib/api';
import { Avatar, avatarOf } from './Avatar';
import { Confetti } from './Confetti';
import { colors } from './theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Section = 'search' | 'groups' | 'events' | 'create' | 'chats' | 'activity' | 'profile';

const items: { section: Section; href: Href; label: string; icon: IconName; activeIcon: IconName }[] = [
  { section: 'search', href: '/search', label: 'Cerca', icon: 'search-outline', activeIcon: 'search' },
  { section: 'groups', href: '/', label: 'Gruppi', icon: 'people-outline', activeIcon: 'people' },
  { section: 'events', href: '/events', label: 'Eventi', icon: 'calendar-outline', activeIcon: 'calendar' },
  { section: 'chats', href: '/chats', label: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  { section: 'activity', href: '/activity', label: 'Attività', icon: 'notifications-outline', activeIcon: 'notifications' },
];

// Which section a page belongs to (a group's chat is under Chat, an event under Eventi…)
function sectionOf(path: string): Section {
  if (/^\/group\/[^/]+\/chat/.test(path) || path.startsWith('/chats')) return 'chats';
  if (path.startsWith('/event') || path === '/create-event') return 'events';
  if (path.startsWith('/activity')) return 'activity';
  if (path.startsWith('/search')) return 'search';
  if (['/profile', '/edit-profile', '/change-password'].includes(path)) return 'profile';
  if (path.startsWith('/create')) return 'create';
  return 'groups';
}

export function SideNav() {
  const user = useAuth((state) => state.user);
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const active = sectionOf(pathname);
  const [burst, setBurst] = useState(0);
  // Refreshed on every page change (opening Attività marks them as read)
  const unread = useAsync(() => (user ? api.getUnreadNotificationCount(user.id) : Promise.resolve(0)), [user?.id, pathname]);

  return (
    <View className="w-64 gap-1 bg-[#EFEAE6] px-3 pb-6" style={{ paddingTop: insets.top + 24 }}>
      <Pressable
        onPress={() => router.navigate('/')}
        onLongPress={() => setBurst((b) => b + 1)} // easter egg: confetti
        delayLongPress={600}
        accessibilityRole="link"
        accessibilityLabel="Huddle, vai ai gruppi"
        className="mb-6 flex-row items-center gap-3 px-3"
      >
        <Image source={require('../assets/icon.png')} style={{ width: 36, height: 36, borderRadius: 10 }} accessibilityIgnoresInvertColors />
        <Text className="text-2xl font-bold text-ink">Huddle</Text>
      </Pressable>

      {items.map((item) => (
        <NavItem
          key={item.section}
          label={item.label}
          icon={active === item.section ? item.activeIcon : item.icon}
          active={active === item.section}
          badge={item.section === 'activity' ? (unread.data ?? 0) : 0}
          onPress={() => router.navigate(item.href)}
        />
      ))}

      <Pressable
        onPress={() => router.navigate('/create')}
        accessibilityRole="link"
        className={`mt-4 h-14 flex-row items-center justify-center gap-2 rounded-2xl ${active === 'create' ? 'bg-brand-300' : 'bg-brand-200 active:bg-brand-300'}`}
      >
        <Ionicons name="add" size={24} color={colors.ink} />
        <Text className="text-base font-semibold text-ink">Crea</Text>
      </Pressable>

      <View className="flex-1" />

      {user ? (
        <Pressable
          onPress={() => router.navigate('/profile')}
          accessibilityRole="link"
          accessibilityLabel="Profilo"
          className={`flex-row items-center gap-3 rounded-full px-3 py-2 ${active === 'profile' ? 'bg-brand-100' : 'active:bg-stone-100'}`}
        >
          <Avatar {...avatarOf(user)} size={36} />
          <View className="flex-1">
            <Text numberOfLines={1} className="font-semibold text-ink">
              {user.full_name}
            </Text>
            <Text className="text-xs text-stone-500">Profilo</Text>
          </View>
        </Pressable>
      ) : null}
      <Confetti burst={burst} />
    </View>
  );
}

function NavItem({ label, icon, active, badge, onPress }: { label: string; icon: IconName; active: boolean; badge: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} non lette` : label}
      className={`h-14 flex-row items-center gap-4 rounded-full px-4 ${active ? 'bg-brand-100' : 'active:bg-stone-100'}`}
    >
      <Ionicons name={icon} size={24} color={active ? colors.ink : colors.muted} />
      <Text className={`flex-1 text-base ${active ? 'font-bold text-ink' : 'text-stone-600'}`}>{label}</Text>
      {badge > 0 ? (
        <View className="h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1">
          <Text className="text-xs font-bold text-white">{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
