// Edit your profile: name, bio, arrival in the city, what you're looking for, interests

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrivalPicker } from '../../components/ArrivalPicker';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors } from '../../components/theme';
import { useAuth } from '../../hooks/useAuth';
import { intentLabels, interestOptions } from '../../lib/format';
import type { UserIntent } from '../../lib/types';

export default function EditProfileScreen() {
  const user = useAuth((state) => state.user)!;
  const updateProfile = useAuth((state) => state.updateProfile);

  const [fullName, setFullName] = useState(user.full_name);
  const [bio, setBio] = useState(user.bio);
  const [isRelocated, setIsRelocated] = useState(user.is_relocated);
  const [relocatedAt, setRelocatedAt] = useState(user.relocated_at);
  const [intent, setIntent] = useState<UserIntent>(user.intent);
  // Keep custom interests (e.g. from the mock data) selectable too
  const [interests, setInterests] = useState<string[]>(user.interests);
  const allInterests = [...new Set([...interestOptions, ...user.interests])];
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const toggleInterest = (interest: string) =>
    setInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));

  async function handleSave() {
    setError(undefined);
    setLoading(true);
    try {
      await updateProfile({
        full_name: fullName.trim(),
        bio: bio.trim(),
        is_relocated: isRelocated,
        relocated_at: isRelocated ? relocatedAt : null,
        intent,
        interests,
      });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <Header title="Modifica profilo" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 px-4 py-5" keyboardShouldPersistTaps="handled">
          <TextField label="Nome e cognome" value={fullName} onChangeText={setFullName} autoComplete="name" />
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Due righe su di te: da dove vieni, cosa ti piace fare…"
            multiline
            style={{ height: 110, paddingTop: 12, textAlignVertical: 'top' }}
          />

          <View className="gap-4 rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">Mi sono trasferito/a da poco</Text>
                <Text className="text-sm text-stone-500">Mostra il badge “Da poco in città”.</Text>
              </View>
              <Switch
                value={isRelocated}
                onValueChange={setIsRelocated}
                trackColor={{ true: colors.brand, false: '#D6D3D1' }}
                thumbColor={colors.white}
                // react-native-web only: otherwise the "on" thumb is teal
                {...({ activeThumbColor: colors.white } as object)}
              />
            </View>
            {isRelocated ? <ArrivalPicker value={relocatedAt} onChange={setRelocatedAt} /> : null}
          </View>

          <View className="gap-3">
            <Text className="text-lg font-semibold text-ink">Cosa cerchi?</Text>
            <View className="flex-row flex-wrap gap-2">
              {(Object.keys(intentLabels) as UserIntent[]).map((value) => (
                <Chip key={value} label={intentLabels[value]} selected={intent === value} onPress={() => setIntent(value)} />
              ))}
            </View>
          </View>

          <View className="gap-3">
            <Text className="text-lg font-semibold text-ink">I tuoi interessi</Text>
            <View className="flex-row flex-wrap gap-2">
              {allInterests.map((interest) => (
                <Chip
                  key={interest}
                  label={interest}
                  selected={interests.includes(interest)}
                  onPress={() => toggleInterest(interest)}
                />
              ))}
            </View>
          </View>

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
          <Button title="Salva" icon="checkmark" onPress={handleSave} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
