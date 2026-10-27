// Edit your profile: photo or pixel avatar, name, bio, arrival in the city, what you're looking for, interests,
// and the private settings (birth year, your area, newsletter, venues' invitations)

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrivalPicker } from '../../components/ArrivalPicker';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Header } from '../../components/Header';
import { PrivateSettingsFields } from '../../components/PrivateSettingsFields';
import { Screen } from '../../components/Screen';
import { TextField } from '../../components/TextField';
import { colors } from '../../components/theme';
import { useAsync } from '../../hooks/useAsync';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import { intentLabels, interestOptions } from '../../lib/format';
import { randomSeed } from '../../lib/identicon';
import { pickProfilePhoto } from '../../lib/pickers';
import type { PickedFile, UserIntent, UserSettings } from '../../lib/types';

export default function EditProfileScreen() {
  const user = useAuth((state) => state.user)!;
  const updateProfile = useAuth((state) => state.updateProfile);

  const [fullName, setFullName] = useState(user.full_name);
  const [bio, setBio] = useState(user.bio);
  const [isRelocated, setIsRelocated] = useState(user.is_relocated);
  const [relocatedAt, setRelocatedAt] = useState(user.relocated_at);
  const [intent, setIntent] = useState<UserIntent>(user.intent);
  const [hideActivity, setHideActivity] = useState(user.hide_activity);
  const isBusiness = user.account_type === 'business';
  // Private settings: loaded, plus what you changed here
  const savedSettings = useAsync(() => api.getMySettings(user.id), [user.id]);
  const [settingsChanges, setSettingsChanges] = useState<Partial<UserSettings>>({});
  const [birthYearText, setBirthYearText] = useState<string>();
  const settings = savedSettings.data ? { ...savedSettings.data, ...settingsChanges } : null;
  const birthYear = birthYearText ?? (savedSettings.data?.birth_year ? String(savedSettings.data.birth_year) : '');
  // Keep interests that are not in the standard list selectable too
  const [interests, setInterests] = useState<string[]>(user.interests);
  const allInterests = [...new Set([...interestOptions, ...user.interests])];
  // Avatar choice: a new photo to upload, the current photo, a pixel avatar (seed) or initials
  const [newPhoto, setNewPhoto] = useState<PickedFile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState(user.avatar_url);
  const [avatarSeed, setAvatarSeed] = useState(user.avatar_seed);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const toggleInterest = (interest: string) =>
    setInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));

  async function handleSave() {
    setError(undefined);
    const year = birthYear.trim() ? Number(birthYear) : null;
    if (year !== null && !(Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() - 14)) {
      return setError('Scrivi l’anno di nascita per intero, es. 1994');
    }
    setLoading(true);
    try {
      if (settings) await api.updateMySettings(user.id, { ...settingsChanges, birth_year: year });
      const photoUrl = newPhoto ? await api.uploadAvatar(user.id, newPhoto) : avatarUrl;
      await updateProfile({
        avatar_url: photoUrl,
        avatar_seed: avatarSeed,
        full_name: fullName.trim(),
        bio: bio.trim(),
        is_relocated: isRelocated,
        relocated_at: isRelocated ? relocatedAt : null,
        intent,
        interests,
        hide_activity: hideActivity,
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
          <View className="items-center gap-3">
            <Avatar name={fullName || user.full_name} url={newPhoto?.uri ?? avatarUrl} seed={avatarSeed} size={104} />
            <View className="flex-row flex-wrap justify-center gap-2">
              <Button
                title="Carica foto"
                icon="image-outline"
                size="sm"
                variant="secondary"
                onPress={async () => {
                  const photo = await pickProfilePhoto();
                  if (photo) setNewPhoto(photo);
                }}
              />
              <Button
                title={!newPhoto && !avatarUrl && avatarSeed ? 'Genera un altro' : 'Avatar a pixel'}
                icon="shuffle"
                size="sm"
                variant="secondary"
                onPress={() => {
                  setNewPhoto(null);
                  setAvatarUrl(null);
                  setAvatarSeed(randomSeed());
                }}
              />
              <Button
                title="Iniziali"
                size="sm"
                variant="muted"
                onPress={() => {
                  setNewPhoto(null);
                  setAvatarUrl(null);
                  setAvatarSeed(null);
                }}
              />
            </View>
          </View>

          <TextField label="Nome e cognome" value={fullName} onChangeText={setFullName} autoComplete="name" />
          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Due righe su di te: da dove vieni, cosa ti piace fare…"
            multiline
            style={{ height: 110, paddingTop: 12, textAlignVertical: 'top' }}
          />

          {isBusiness ? null : (
            <View className="gap-4 rounded-3xl bg-white p-4">
              <View className="flex-row items-center justify-between gap-4">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-ink">Sono nuovo/a in città</Text>
                  <Text className="text-sm text-stone-500">Mostra il badge “Da poco in città” e ti suggeriamo i gruppi che accolgono persone nuove.</Text>
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
          )}

          {isBusiness ? null : (
            <View className="gap-3">
              <Text className="text-lg font-semibold text-ink">Cosa cerchi?</Text>
              <View className="flex-row flex-wrap gap-2">
                {(Object.keys(intentLabels) as UserIntent[]).map((value) => (
                  <Chip key={value} label={intentLabels[value]} selected={intent === value} onPress={() => setIntent(value)} />
                ))}
              </View>
            </View>
          )}

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

          <View className="flex-row items-center justify-between gap-4 rounded-3xl bg-white p-4">
            <View className="flex-1">
              <Text className="text-base font-semibold text-ink">Nascondi la mia attività nei suggerimenti</Text>
              <Text className="text-sm text-stone-500">
                “Per te” mostra solo numeri (“ci vanno 3 persone dei tuoi gruppi”), mai nomi. Attivandolo non vieni
                contato/a nemmeno lì.
              </Text>
            </View>
            <Switch
              value={hideActivity}
              onValueChange={setHideActivity}
              trackColor={{ true: colors.brand, false: '#D6D3D1' }}
              thumbColor={colors.white}
              {...({ activeThumbColor: colors.white } as object)}
            />
          </View>

          {settings ? (
            <PrivateSettingsFields
              settings={settings}
              birthYear={birthYear}
              isBusiness={isBusiness}
              onBirthYear={setBirthYearText}
              onChange={(changes) => setSettingsChanges((prev) => ({ ...prev, ...changes }))}
            />
          ) : null}

          {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
          <Button title="Salva" icon="checkmark" onPress={handleSave} loading={loading} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
