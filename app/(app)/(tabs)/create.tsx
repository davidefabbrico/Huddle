// Crea tab (➕): new event (admins), new group (anyone), and the requests waiting for you

import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { GroupIcon } from '../../../components/GroupIcon';
import { Screen } from '../../../components/Screen';
import { colors } from '../../../components/theme';
import { useAsync } from '../../../hooks/useAsync';
import { useAuth } from '../../../hooks/useAuth';
import * as api from '../../../lib/api';

export default function CreateScreen() {
  const user = useAuth((state) => state.user)!;
  const adminGroups = useAsync(() => api.getAdminGroups(user.id), [user.id], { refetchOnFocus: true });

  const groups = adminGroups.data ?? [];
  const isAdmin = groups.length > 0;
  const pendingTotal = groups.reduce((sum, g) => sum + g.pending_requests, 0);

  return (
    <Screen>
      <ScrollView contentContainerClassName="gap-5 px-4 pb-10 pt-4">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-ink">Crea</Text>
          <Text className="text-base text-stone-600">
            {isAdmin ? 'Organizza il prossimo evento o gestisci chi vuole entrare.' : 'Hai già una compagnia? Portala su Huddle.'}
          </Text>
        </View>

        {!adminGroups.data && adminGroups.loading ? (
          <ActivityIndicator color={colors.brand} className="mt-6" />
        ) : (
          <>
            {isAdmin ? (
              <ActionCard
                href="/create-event"
                icon="calendar"
                title="Nuovo evento"
                text="Un’uscita, una partita, un aperitivo: i membri riceveranno una notifica."
              />
            ) : null}
            <ActionCard
              href="/create-group"
              icon="people"
              title="Nuovo gruppo"
              text={isAdmin ? 'Crea un altro gruppo di cui sarai admin.' : 'Crea il tuo gruppo e accogli chi è da poco in città.'}
            />

            {isAdmin ? (
              <View className="gap-3">
                <Text className="text-lg font-semibold text-ink">
                  Richieste in attesa{pendingTotal > 0 ? ` (${pendingTotal})` : ''}
                </Text>
                <View className="overflow-hidden rounded-3xl border border-stone-200 bg-white">
                  {groups.map(({ group, pending_requests }, index) => (
                    <Link key={group.id} href={{ pathname: '/group/[id]', params: { id: group.id } }} asChild>
                      <Pressable
                        className={`flex-row items-center gap-3 p-4 active:bg-stone-100 ${index > 0 ? 'border-t border-stone-100' : ''}`}
                      >
                        <GroupIcon name={group.name} size={40} />
                        <Text numberOfLines={1} className="flex-1 font-semibold text-ink">
                          {group.name}
                        </Text>
                        {pending_requests > 0 ? (
                          <View className="min-w-6 h-6 items-center justify-center rounded-full bg-brand-500 px-2">
                            <Text className="text-xs font-bold text-white">{pending_requests}</Text>
                          </View>
                        ) : (
                          <Text className="text-sm text-stone-400">nessuna</Text>
                        )}
                        <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                      </Pressable>
                    </Link>
                  ))}
                </View>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

interface ActionCardProps {
  href: Href;
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  text: string;
}

function ActionCard({ href, icon, title, text }: ActionCardProps) {
  return (
    <Link href={href} asChild>
      <Pressable className="flex-row items-center gap-4 rounded-3xl border border-stone-200 bg-white p-4 active:bg-stone-100">
        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-brand-500">
          <Ionicons name={icon} size={24} color={colors.white} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-semibold text-ink">{title}</Text>
          <Text className="text-sm text-stone-500">{text}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.muted} />
      </Pressable>
    </Link>
  );
}
