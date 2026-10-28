// Side menu on wide screens (computer browser): takes the place of the bottom tab bar and stays
// visible on every page (group, event, chat…). Same sections, plus Attività with the unread count.
// Pixel icons, the active section on a pastel tile; "Crea" is an arcade button.

import { useState } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../hooks/useAuth';
import * as api from '../lib/api';
import { Avatar, avatarOf } from './Avatar';
import { Confetti } from './Confetti';
import { PixelIcon, type PixelIconName } from './PixelIcon';
import { Text } from './Text';

type Section = 'search' | 'groups' | 'events' | 'create' | 'chats' | 'activity' | 'profile';

const items: { section: Section; href: Href; label: string; icon: PixelIconName }[] = [
  { section: 'search', href: '/search', label: 'Cerca', icon: 'search' },
  { section: 'groups', href: '/', label: 'Gruppi', icon: 'people' },
  { section: 'events', href: '/events', label: 'Eventi', icon: 'calendar' },
  { section: 'chats', href: '/chats', label: 'Chat', icon: 'chat' },
  { section: 'activity', href: '/activity', label: 'Attività', icon: 'bell' },
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
    <View className="w-64 gap-1 border-r border-stone-200 bg-white px-3 pb-6" style={{ paddingTop: insets.top + 24 }}>
      <Pressable
        onPress={() => router.navigate('/')}
        onLongPress={() => setBurst((b) => b + 1)} // easter egg: confetti
        delayLongPress={600}
        accessibilityRole="link"
        accessibilityLabel="Huddle, vai ai gruppi"
        className="mb-6 flex-row items-center gap-3 px-3"
      >
        <Image source={require('../assets/icon.png')} style={{ width: 36, height: 36, borderRadius: 4 }} accessibilityIgnoresInvertColors />
        <Text className="font-pixel text-2xl text-ink">Huddle</Text>
      </Pressable>

      {items.map((item) => (
        <NavItem
          key={item.section}
          label={item.label}
          icon={item.icon}
          active={active === item.section}
          badge={item.section === 'activity' ? (unread.data ?? 0) : 0}
          onPress={() => router.navigate(item.href)}
        />
      ))}

      <Pressable
        onPress={() => router.navigate('/create')}
        accessibilityRole="link"
        className={`mt-4 h-14 flex-row items-center justify-center gap-2 rounded-2xl border-2 border-b-4 border-line ${active === 'create' ? 'bg-brand-300' : 'bg-brand-200 active:border-b-2 active:bg-brand-300'}`}
      >
        <PixelIcon name="plus" size={18} className="text-brand-800" />
        <Text className="text-base font-semibold text-brand-800">Crea</Text>
      </Pressable>

      <View className="flex-1" />

      {user ? (
        <Pressable
          onPress={() => router.navigate('/profile')}
          accessibilityRole="link"
          accessibilityLabel="Profilo"
          className={`flex-row items-center gap-3 rounded-full px-3 py-2 ${active === 'profile' ? 'bg-brand-200' : 'active:bg-stone-100'}`}
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

function NavItem({ label, icon, active, badge, onPress }: { label: string; icon: PixelIconName; active: boolean; badge: number; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={badge > 0 ? `${label}, ${badge} non lette` : label}
      className={`h-14 flex-row items-center gap-4 rounded-full px-4 ${active ? 'bg-brand-200' : 'active:bg-stone-100'}`}
    >
      <PixelIcon name={icon} size={22} className={active ? 'text-brand-800' : 'text-stone-500'} />
      <Text className={`flex-1 text-base font-semibold ${active ? 'text-brand-800' : 'text-stone-600'}`}>{label}</Text>
      {badge > 0 ? (
        <View className="h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1">
          <Text className="text-xs font-bold text-[#FFFFFF]">{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}
