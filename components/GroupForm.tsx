// Group fields, shared by "Nuovo gruppo" and "Modifica gruppo"

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { detectChatApp, validateChatLink } from '../lib/chatLinks';
import { groupLook, isGroupColor, isGroupIcon, suggestGroupIcon, type GroupColor } from '../lib/groupIcons';
import { normalizeParkingCode, validateParkingCode } from '../lib/smartpark';
import type { NewGroupInput } from '../lib/types';
import { Button } from './Button';
import { Chip } from './Chip';
import { GroupIconPicker } from './GroupIconPicker';
import { TextField } from './TextField';

interface Props {
  initial?: NewGroupInput;
  submitLabel: string;
  footnote?: string;
  onSubmit: (values: NewGroupInput) => Promise<void>;
}

const empty: NewGroupInput = {
  name: '',
  description: '',
  location: '',
  type: 'open_to_new',
  visibility: 'public',
  chat_url: '',
  parking_code: '',
};

export function GroupForm({ initial = empty, submitLabel, footnote, onSubmit }: Props) {
  const [values, setValues] = useState<NewGroupInput>({
    ...initial,
    visibility: initial.visibility ?? 'public',
    chat_url: initial.chat_url ?? '',
    parking_code: initial.parking_code ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const set = (changes: Partial<NewGroupInput>) => setValues((v) => ({ ...v, ...changes }));

  // Icon: the chosen one, or (until someone picks) the suggestion that follows the name as you type
  const [look, setLook] = useState<{ icon: string; color: GroupColor } | null>(
    isGroupIcon(initial.icon) && isGroupColor(initial.color) ? { icon: initial.icon, color: initial.color } : null,
  );
  const shownLook = look ?? (initial.icon || initial.color ? groupLook(initial) : suggestGroupIcon(values.name));

  const chatUrl = values.chat_url ?? '';
  const parkingCode = values.parking_code ?? '';
  const linkError = validateChatLink(chatUrl);

  async function handleSubmit() {
    const invalid = linkError ?? validateParkingCode(parkingCode);
    if (invalid) return setError(invalid);
    setError(undefined);
    setLoading(true);
    try {
      await onSubmit({
        ...values,
        icon: shownLook.icon,
        color: shownLook.color,
        chat_url: chatUrl.trim() || null,
        parking_code: parkingCode.trim() ? normalizeParkingCode(parkingCode) : null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito');
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="gap-5 px-4 py-5" keyboardShouldPersistTaps="handled">
        <GroupIconPicker name={values.name} icon={shownLook.icon} color={shownLook.color} onChange={setLook} />
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
          <Text className="text-sm font-medium text-stone-700">Chi può trovare il gruppo?</Text>
          {(
            [
              { value: 'public', title: '🌍 Pubblico', text: 'Compare in “Gruppi”: chiunque può vederlo e chiedere di entrare.' },
              { value: 'private', title: '🔒 Privato', text: 'Lo vede solo chi è dentro. Si entra solo con il link d’invito (e approvi tu).' },
            ] as const
          ).map((option) => {
            const selected = values.visibility === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => set({ visibility: option.value })}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`rounded-2xl border-2 bg-white px-4 py-3 ${selected ? 'border-brand-500' : 'border-stone-200'}`}
              >
                <Text className="font-semibold text-ink">{option.title}</Text>
                <Text className="text-sm text-stone-500">{option.text}</Text>
              </Pressable>
            );
          })}
        </View>

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

        <View className="gap-1.5">
          <TextField
            label="Codice del gruppo SmartPark (facoltativo)"
            value={parkingCode}
            onChangeText={(parking_code) => set({ parking_code: parking_code.toUpperCase() })}
            placeholder="es. 622066EA"
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <Text className="text-xs text-stone-500">
            Con SmartPark gli amici scoprono insieme dove si parcheggia e non finiscono tutti nello stesso posto. Il codice
            lo vedranno solo membri e ospiti.
          </Text>
        </View>

        {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
        <Button title={submitLabel} icon="checkmark" onPress={handleSubmit} loading={loading} />
        {footnote ? <Text className="text-center text-sm text-stone-500">{footnote}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
