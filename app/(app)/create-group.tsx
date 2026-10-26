// New group form. The creator becomes its admin.

import { router } from 'expo-router';
import { GroupForm } from '../../components/GroupForm';
import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';

export default function CreateGroupScreen() {
  const user = useAuth((state) => state.user)!;

  return (
    <Screen>
      <Header title="Nuovo gruppo" />
      <GroupForm
        submitLabel="Crea gruppo"
        footnote="Sarai l’admin: approvi le richieste e crei gli eventi."
        onSubmit={async (values) => {
          const group = await api.createGroup(user.id, values);
          router.replace({ pathname: '/group/[id]', params: { id: group.id } });
        }}
      />
    </Screen>
  );
}
