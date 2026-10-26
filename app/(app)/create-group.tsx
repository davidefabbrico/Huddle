// New group form. The creator becomes its admin.

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import type { GroupType } from '../../lib/types';

export default function CreateGroupScreen() {
  const user = useAuth((state) => state.user)!;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [type, setType] = useState<GroupType>('open_to_new');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleCreate() {
    setError(undefined);
    setLoading(true);
    try {
      const group = await api.createGroup(user.id, { name, description, location, type });
      router.replace({ pathname: '/group/[id]', params: { id: group.id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creazione non riuscita');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Header title="Nuovo gruppo" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-5 px-4 py-5" keyboardShouldPersistTaps="handled">
          <TextField label="Nome del gruppo" value={name} onChangeText={setName} placeholder="Es. Calcetto del lunedì" />
          <TextField
            label="Descrizione"
            value={description}
            onChangeText={setDescription}
            placeholder="Cosa fate, quando, che livello serve…"
            multiline
            style={{ height: 110, paddingTop: 12, textAlignVertical: 'top' }}
          />
          <TextField label="Zona" value={location} onChangeText={setLocation} placeholder="Es. Isola, Milano" />

          <View className="gap-2">
            <Text className="text-sm font-medium text-stone-700">Accettate nuovi membri?</Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip label="Sì, aperto a nuovi membri" selected={type === 'open_to_new'} onPress={() => setType('open_to_new')} />
              <Chip label="No, al completo" selected={type === 'closed'} onPress={() => setType('closed')} />
            </View>
          </View>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
          <Button title="Crea gruppo" icon="sparkles" onPress={handleCreate} loading={loading} />
          <Text className="text-center text-sm text-stone-500">Sarai l’admin: approvi le richieste e crei gli eventi.</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
