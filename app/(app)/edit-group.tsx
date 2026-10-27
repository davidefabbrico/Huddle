// Edit a group you administer (?id=group_id), including the external chat link

import { ActivityIndicator, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { GroupForm } from '../../components/GroupForm';
import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';
import { colors } from '../../components/theme';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';

export default function EditGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuth((state) => state.user)!;
  const data = useAsync(async () => {
    const [group, links] = await Promise.all([api.getGroupById(id), api.getGroupLinks(id)]);
    return { group, links };
  }, [id, user.id]);

  const group = data.data?.group;

  return (
    <Screen>
      <Header title="Modifica gruppo" />
      {!data.data ? (
        <ActivityIndicator color={colors.brand} className="mt-10" />
      ) : !group || group.admin_id !== user.id ? (
        <Text className="p-4 text-stone-600">Solo l’admin può modificare questo gruppo.</Text>
      ) : (
        <GroupForm
          initial={{
            name: group.name,
            description: group.description,
            location: group.location,
            type: group.type,
            visibility: group.visibility,
            expenses_enabled: group.expenses_enabled,
            icon: group.icon,
            color: group.color,
            chat_url: data.data.links.chat_url,
            parking_code: data.data.links.parking_code,
          }}
          submitLabel="Salva"
          onSubmit={async (values) => {
            await api.updateGroup(id, values);
            router.back();
          }}
        />
      )}
    </Screen>
  );
}
