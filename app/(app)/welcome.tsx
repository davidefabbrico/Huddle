// The welcome after signup (steps 2 and 3; step 1 is the account, app/signup.tsx): what you like, then a
// bit about you (all optional). Done, the home opens on the groups "Per te" for your interests.
// app/(app)/_layout.tsx sends here whoever hasn't done it yet (users.onboarded_at is null).

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { ArrivalPicker } from '../../components/ArrivalPicker';
import { Button } from '../../components/Button';
import { InterestPicker } from '../../components/InterestPicker';
import { PlaceField } from '../../components/PlaceField';
import { Screen } from '../../components/Screen';
import { StepDots } from '../../components/StepDots';
import { TextField } from '../../components/TextField';
import { colors, SWITCH_OFF } from '../../components/theme';
import { useAuth } from '../../hooks/useAuth';
import * as api from '../../lib/api';
import { birthYearError } from '../../lib/age';
import { dateMonthsAgo, firstName } from '../../lib/format';
import { Text } from '../../components/Text';

export default function WelcomeScreen() {
  const user = useAuth((state) => state.user)!;
  const updateProfile = useAuth((state) => state.updateProfile);
  const isBusiness = user.account_type === 'business';
  const [step, setStep] = useState<2 | 3>(2);
  const [interests, setInterests] = useState<string[]>(user.interests);
  const [birthYear, setBirthYear] = useState('');
  const [area, setArea] = useState<{ text: string; lat: number | null; lon: number | null }>({ text: '', lat: null, lon: null });
  const [isRelocated, setIsRelocated] = useState(false);
  const [relocatedAt, setRelocatedAt] = useState<string | null>(dateMonthsAgo(0));
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function finish() {
    const yearError = birthYearError(birthYear);
    if (yearError) return setError(yearError);
    setError(undefined);
    setLoading(true);
    try {
      await api.updateMySettings(user.id, {
        birth_year: birthYear.trim() ? Number(birthYear) : null,
        ...(area.text.trim() ? { area: area.text.trim(), area_lat: area.lat, area_lon: area.lon } : {}),
      });
      await updateProfile({
        interests,
        bio: bio.trim(),
        is_relocated: !isBusiness && isRelocated,
        relocated_at: !isBusiness && isRelocated ? relocatedAt : null,
        onboarded_at: new Date().toISOString(),
      });
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-6 px-6 py-8" keyboardShouldPersistTaps="handled">
          <StepDots step={step} of={3} />
          {step === 2 ? (
            <>
              <View>
                <Text className="text-3xl font-bold text-ink">
                  {isBusiness ? 'Che eventi organizzate?' : `Cosa ti piace, ${firstName(user.full_name)}?`}
                </Text>
                <Text className="mt-1 text-base text-stone-600">
                  {isBusiness ? 'Chi ha questi interessi vedrà i vostri eventi.' : 'Scegli quanti vuoi: ti mostriamo i gruppi giusti per te.'}
                </Text>
              </View>
              <InterestPicker selected={interests} onChange={setInterests} />
              <Button title="Continua" icon="arrow-forward" onPress={() => setStep(3)} />
              {interests.length === 0 ? (
                <Text className="-mt-3 text-center text-sm text-stone-500">Puoi anche saltare: li aggiungi quando vuoi dal profilo.</Text>
              ) : null}
            </>
          ) : (
            <>
              <View>
                <Text className="text-3xl font-bold text-ink">{isBusiness ? 'Dove siete?' : 'Qualcosa su di te'}</Text>
                <Text className="mt-1 text-base text-stone-600">Tutto facoltativo: lo cambi quando vuoi dal profilo.</Text>
              </View>
              <PlaceField
                label={isBusiness ? 'La zona del locale' : 'La tua zona'}
                value={area}
                onChange={setArea}
                placeholder="Es. Novoli, Firenze"
                hint="Basta il quartiere o la città. Resta privata: serve a trovare le cose vicine."
                foundHint="Zona trovata: le distanze partono da qui."
              />
              {isBusiness ? null : (
                <>
                  <View className="gap-1">
                    <TextField
                      label="Anno di nascita"
                      value={birthYear}
                      onChangeText={setBirthYear}
                      placeholder="Es. 1994"
                      keyboardType="number-pad"
                      maxLength={4}
                    />
                    <Text className="text-xs text-stone-500">Resta privato: serve solo a trovarti gruppi della tua età.</Text>
                  </View>
                  <View className="gap-4 rounded-3xl border border-stone-200 bg-white p-4">
                    <View className="flex-row items-center justify-between gap-4">
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-ink">Sono nuovo/a in città</Text>
                        <Text className="text-sm text-stone-500">Badge “Da poco in città” e i gruppi che accolgono persone nuove.</Text>
                      </View>
                      <Switch
                        value={isRelocated}
                        onValueChange={setIsRelocated}
                        trackColor={{ true: colors.brand, false: SWITCH_OFF }}
                        thumbColor={colors.white}
                        // react-native-web only: otherwise the "on" thumb is teal
                        {...({ activeThumbColor: colors.white } as object)}
                      />
                    </View>
                    {isRelocated ? <ArrivalPicker value={relocatedAt} onChange={setRelocatedAt} /> : null}
                  </View>
                </>
              )}
              <TextField
                label={isBusiness ? 'Due righe sul locale' : 'Due righe su di te'}
                value={bio}
                onChangeText={setBio}
                placeholder={isBusiness ? 'Cosa organizzate, quando…' : 'Da dove vieni, cosa ti piace fare…'}
                multiline
                style={{ height: 96, paddingTop: 12, textAlignVertical: 'top' }}
              />
              {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
              <View className="gap-2">
                <Button title={isBusiness ? 'Inizia' : 'Vedi i gruppi per te'} icon="sparkles" onPress={finish} loading={loading} />
                <Button title="Indietro" variant="muted" onPress={() => setStep(2)} />
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
