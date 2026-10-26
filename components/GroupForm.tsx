// Group fields, shared by "Nuovo gruppo" and "Modifica gruppo"

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { detectChatApp, validateChatLink } from '../lib/chatLinks';
import type { NewGroupInput } from '../lib/types';
import { Button } from './Button';
import { Chip } from './Chip';
import { TextField } from './TextField';

interface Props {
  initial?: NewGroupInput;
  submitLabel: string;
  footnote?: string;
  onSubmit: (values: NewGroupInput) => Promise<void>;
}

const empty: NewGroupInput = { name: '', description: '', location: '', type: 'open_to_new', chat_url: '' };

export function GroupForm({ initial = empty, submitLabel, footnote, onSubmit }: Props) {
  const [values, setValues] = useState<NewGroupInput>({ ...initial, chat_url: initial.chat_url ?? '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const set = (changes: Partial<NewGroupInput>) => setValues((v) => ({ ...v, ...changes }));

  const chatUrl = values.chat_url ?? '';
  const linkError = validateChatLink(chatUrl);

  async function handleSubmit() {
    if (linkError) return setError(linkError);
    setError(undefined);
    setLoading(true);
    try {
      await onSubmit({ ...values, chat_url: chatUrl.trim() || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="gap-5 px-4 py-5" keyboardShouldPersistTaps="handled">
        <TextField label="Nome del gruppo" value={values.name} onChangeText={(name) => set({ name })} placeholder="Es. Calcetto del lunedì" />
        <TextField
          label="Descrizione"
          value={values.description}
          onChangeText={(description) => set({ description })}
          placeholder="Cosa fate, quando, che livello serve…"
          multiline
          style={{ height: 110, paddingTop: 12, textAlignVertical: 'top' }}
        />
        <TextField label="Zona" value={values.location} onChangeText={(location) => set({ location })} placeholder="Es. Isola, Milano" />

        <View className="gap-2">
          <Text className="text-sm font-medium text-stone-700">Accettate nuovi membri?</Text>
          <View className="flex-row flex-wrap gap-2">
            <Chip label="Sì, aperto a nuovi membri" selected={values.type === 'open_to_new'} onPress={() => set({ type: 'open_to_new' })} />
            <Chip label="No, al completo" selected={values.type === 'closed'} onPress={() => set({ type: 'closed' })} />
          </View>
        </View>

        <View className="gap-1.5">
          <TextField
            label="Link alla chat del gruppo (facoltativo)"
            value={chatUrl}
            onChangeText={(chat_url) => set({ chat_url })}
            placeholder="https://chat.whatsapp.com/…"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Text className="text-xs text-stone-500">
            {chatUrl.trim() && !linkError
              ? `Riconosciuto: ${detectChatApp(chatUrl).name}. Lo vedranno solo membri e ospiti.`
              : 'WhatsApp, Telegram, Signal o Discord. Lo vedranno solo membri e ospiti, non chi cerca gruppi.'}
          </Text>
        </View>

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        <Button title={submitLabel} icon="checkmark" onPress={handleSubmit} loading={loading} />
        {footnote ? <Text className="text-center text-sm text-stone-500">{footnote}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
