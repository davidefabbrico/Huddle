// Attività: your notifications. Opening the screen marks them as read
// (they stay highlighted until you leave, so you can see what's new).

import { useEffect, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';
import { colors } from '../../components/theme';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import { timeAgo } from '../../lib/format';
import type { Notification, NotificationType } from '../../lib/types';
import { Text } from '../../components/Text';

const typeStyle: Record<NotificationType, { icon: ComponentProps<typeof Ionicons>['name']; box: string; iconClass: string }> = {
  join_request: { icon: 'person-add', box: 'bg-brand-100', iconClass: 'text-brand-600' },
  request_accepted: { icon: 'checkmark-circle', box: 'bg-emerald-100', iconClass: 'text-emerald-700' },
  request_guest: { icon: 'walk', box: 'bg-sky-100', iconClass: 'text-sky-700' },
  request_rejected: { icon: 'close-circle', box: 'bg-stone-200', iconClass: 'text-stone-500' },
  new_event: { icon: 'calendar', box: 'bg-brand-100', iconClass: 'text-brand-600' },
  rank_up: { icon: 'trophy', box: 'bg-amber-100', iconClass: 'text-amber-700' },
  thanks: { icon: 'heart', box: 'bg-amber-100', iconClass: 'text-amber-700' },
  ride: { icon: 'car', box: 'bg-sky-100', iconClass: 'text-sky-700' },
  expense: { icon: 'wallet', box: 'bg-emerald-100', iconClass: 'text-emerald-700' },
  promo: { icon: 'megaphone', box: 'bg-violet-100', iconClass: 'text-violet-700' },
  digest: { icon: 'newspaper', box: 'bg-brand-100', iconClass: 'text-brand-600' },
  event_update: { icon: 'alert-circle', box: 'bg-amber-100', iconClass: 'text-amber-700' },
  group_event: { icon: 'people', box: 'bg-brand-100', iconClass: 'text-brand-600' },
};

// Where tapping a notification takes you
function destination(n: Notification): Href | null {
  if (n.type === 'digest') return '/events';
  if ((n.type === 'new_event' || n.type === 'thanks' || n.type === 'ride' || n.type === 'expense' || n.type === 'promo' || n.type === 'event_update' || n.type === 'group_event') && n.event_id) return { pathname: '/event/[id]', params: { id: n.event_id } };
  if (n.type === 'rank_up') return '/profile';
  if ((n.type === 'request_accepted' || n.type === 'request_guest') && n.group_id) {
    return { pathname: '/group/[id]/chat', params: { id: n.group_id } };
  }
  if (n.group_id) return { pathname: '/group/[id]', params: { id: n.group_id } };
  return null;
}

export default function ActivityScreen() {
  const user = useAuth((state) => state.user)!;
  const notifications = useAsync(() => api.getNotifications(user.id), [user.id]);

  useEffect(() => {
    if (notifications.data) api.markNotificationsRead(user.id);
  }, [notifications.data, user.id]);

  return (
    <Screen width="page">
      <Header title="Attività" />
      {!notifications.data ? (
        <ActivityIndicator color={colors.brand} className="mt-10" />
      ) : notifications.data.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-8">
          <Ionicons name="notifications-outline" size={40} className="text-stone-500" />
          <Text className="text-center text-lg font-semibold text-ink">Nessuna novità</Text>
          <Text className="text-center text-stone-500">
            Qui trovi nuovi eventi nei tuoi gruppi, richieste accettate, i grazie ricevuti e i gradi che conquisti.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-4 py-4">
          <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
            {notifications.data.map((n, index) => {
              const style = typeStyle[n.type];
              const href = destination(n);
              return (
                <Pressable
                  key={n.id}
                  onPress={href ? () => router.push(href) : undefined}
                  disabled={!href}
                  className={`flex-row items-center gap-3 p-4 active:bg-stone-100 ${index > 0 ? 'border-t border-stone-100' : ''} ${n.read_at ? '' : 'bg-brand-50'}`}
                >
                  <View className={`h-11 w-11 items-center justify-center rounded-full ${style.box}`}>
                    <Ionicons name={style.icon} size={22} className={style.iconClass} />
                  </View>
                  <View className="flex-1">
                    <Text className="font-semibold text-ink">{n.title}</Text>
                    <Text className="text-sm text-stone-600">{n.body}</Text>
                    <Text className="mt-0.5 text-xs text-stone-400">{timeAgo(n.created_at)}</Text>
                  </View>
                  {n.read_at ? null : <View className="h-2.5 w-2.5 rounded-full bg-brand-500" />}
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}
