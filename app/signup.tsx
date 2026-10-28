// Signup + onboarding: profile basics and the key choice
// "Solo looking for groups" vs "Group looking for new members"

import { useState, type ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ArrivalPicker } from '../components/ArrivalPicker';
import { passwordError } from '../components/NewPasswordForm';
import { PasswordField } from '../components/PasswordField';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { AuthScreen } from '../components/AuthScreen';
import { TextField } from '../components/TextField';
import { colors, SWITCH_OFF } from '../components/theme';
import { useAuth } from '../hooks/useAuth';
import * as api from '../lib/api';
import { dateMonthsAgo, intentLabels, interestOptions } from '../lib/format';
import type { AccountType, UserIntent, UserRole } from '../lib/types';

const roleOptions: { value: UserRole; title: string; text: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'solo', title: 'Cerco un gruppo', text: 'Vorrei entrare in una compagnia già formata.', icon: 'person' },
  { value: 'group', title: 'Il mio gruppo cerca nuovi membri', text: 'Abbiamo spazio per qualcuno di nuovo.', icon: 'people' },
];

export default function SignupScreen() {
  const signUp = useAuth((state) => state.signUp);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('person');
  const isBusiness = accountType === 'business';
  const [birthYear, setBirthYear] = useState('');
  const [role, setRole] = useState<UserRole>('solo');
  const [intent, setIntent] = useState<UserIntent>('friends');
  const [isRelocated, setIsRelocated] = useState(false);
  const [relocatedAt, setRelocatedAt] = useState<string | null>(dateMonthsAgo(0));
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [checkEmail, setCheckEmail] = useState(false); // account created, waiting for the email link
  const [resent, setResent] = useState(false);

  const toggleInterest = (interest: string) =>
    setInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));

  // With a session the route guard in app/_layout.tsx moves us to the app;
  // with email confirmation on, we ask to open the link first.
  async function handleSignUp() {
    if (!fullName.trim() || !email.includes('@')) return setError('Inserisci nome e una email valida');
    const year = birthYear.trim() ? Number(birthYear) : null;
    if (year !== null && !(Number.isInteger(year) && year >= 1900 && year <= new Date().getFullYear() - 14)) {
      return setError('Scrivi l’anno di nascita per intero, es. 1994 (servono almeno 14 anni)');
    }
    const invalidPassword = passwordError(password, repeat);
    if (invalidPassword) return setError(invalidPassword);
    setError(undefined);
    setLoading(true);
    try {
      const result = await signUp({
        full_name: fullName,
        email,
        password,
        role: isBusiness ? 'group' : role,
        intent,
        is_relocated: !isBusiness && isRelocated,
        relocated_at: relocatedAt,
        interests,
        account_type: accountType,
        birth_year: isBusiness ? null : year,
      });
      if (result.needsEmailConfirmation) {
        setCheckEmail(true);
        setLoading(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registrazione non riuscita');
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <AuthScreen>
        <ScrollView contentContainerClassName="flex-grow justify-center gap-6 px-6 py-10">
          <View className="items-center gap-3 rounded-3xl bg-white p-6">
            <Ionicons name="mail-unread-outline" size={44} color={colors.brand} />
            <Text className="text-center text-2xl font-bold text-ink">Controlla la posta</Text>
            <Text className="text-center text-base text-stone-600">
              Ti abbiamo mandato un link a {email.trim()}. Aprilo per confermare l’account: entrerai direttamente in
              Huddle. Guarda anche nello spam.
            </Text>
          </View>
          <Button
            title={resent ? 'Email inviata di nuovo ✓' : 'Non è arrivata? Rimandala'}
            variant="secondary"
            disabled={resent}
            onPress={async () => {
              try {
                await api.resendConfirmation(email);
                setResent(true);
              } catch (e) {
                setError(e instanceof Error ? e.message : 'Invio non riuscito');
              }
            }}
          />
          {error ? <Text className="text-center text-sm text-red-600">{error}</Text> : null}
          <Link href="/login" className="text-center font-semibold text-brand-600">
            Vai all’accesso
          </Link>
        </ScrollView>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-7 px-6 py-8" keyboardShouldPersistTaps="handled">
          <View>
            <Text className="text-3xl font-bold text-ink">Ti diamo il benvenuto</Text>
            <Text className="mt-1 text-base text-stone-600">Due minuti e potrai conoscere il tuo prossimo gruppo.</Text>
          </View>

          <View className="gap-3">
            <Text className="text-lg font-semibold text-ink">Chi si iscrive?</Text>
            <View className="flex-row flex-wrap gap-2">
              <Chip label="🙋 Una persona" selected={!isBusiness} onPress={() => setAccountType('person')} />
              <Chip label="🏪 Un locale o un’azienda" selected={isBusiness} onPress={() => setAccountType('business')} />
            </View>
            {isBusiness ? (
              <Text className="text-sm text-stone-500">
                Avrai la pagina del locale dove pubblicare i tuoi eventi: chiunque potrà dire “Ci sono”. Con i punti
                guadagnati potrai far arrivare un evento ai gruppi della zona.
              </Text>
            ) : null}
          </View>

          <View className="gap-4">
            <TextField
              label={isBusiness ? 'Nome del locale o dell’azienda' : 'Nome e cognome'}
              value={fullName}
              onChangeText={setFullName}
              placeholder={isBusiness ? 'Bar Centrale' : 'Giulia Rossi'}
              autoComplete={isBusiness ? 'organization' : 'name'}
            />
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="nome@email.com"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
            />
            <PasswordField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Almeno 6 caratteri"
              autoComplete="new-password"
            />
            <PasswordField label="Ripeti la password" value={repeat} onChangeText={setRepeat} autoComplete="new-password" />
            {isBusiness ? null : (
              <View className="gap-1">
                <TextField
                  label="Anno di nascita (facoltativo)"
                  value={birthYear}
                  onChangeText={setBirthYear}
                  placeholder="Es. 1994"
                  keyboardType="number-pad"
                  maxLength={4}
                />
                <Text className="text-xs text-stone-500">Resta privato: serve solo a trovarti gruppi della tua età.</Text>
              </View>
            )}
          </View>

          {isBusiness ? null : (
            <>
              <View className="gap-3">
                <Text className="text-lg font-semibold text-ink">Come vuoi usare Huddle?</Text>
                {roleOptions.map((option) => {
                  const selected = role === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setRole(option.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      className={`flex-row items-center gap-4 rounded-3xl border-2 bg-white p-4 ${selected ? 'border-brand-500' : 'border-stone-200'}`}
                    >
                      <View className={`h-12 w-12 items-center justify-center rounded-2xl ${selected ? 'bg-brand-200' : 'bg-stone-100'}`}>
                        <Ionicons name={option.icon} size={24} className={selected ? 'text-brand-800' : 'text-stone-500'} />
                      </View>
                      <View className="flex-1">
                        <Text className="text-base font-semibold text-ink">{option.title}</Text>
                        <Text className="text-sm text-stone-500">{option.text}</Text>
                      </View>
                      <Ionicons
                        name={selected ? 'radio-button-on' : 'radio-button-off'}
                        size={22}
                        className={selected ? 'text-brand-600' : 'text-stone-500'}
                      />
                    </Pressable>
                  );
                })}
              </View>

              <View className="gap-4 rounded-3xl bg-white p-4">
                <View className="flex-row items-center justify-between gap-4">
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink">Sono nuovo/a in città</Text>
                    <Text className="text-sm text-stone-500">
                      Se ti sei trasferito/a da poco: badge “Da poco in città” e suggerimenti dei gruppi che accolgono persone nuove.
                    </Text>
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

              <View className="gap-3">
                <Text className="text-lg font-semibold text-ink">Cosa cerchi?</Text>
                <View className="flex-row flex-wrap gap-2">
                  {(Object.keys(intentLabels) as UserIntent[]).map((value) => (
                    <Chip key={value} label={intentLabels[value]} selected={intent === value} onPress={() => setIntent(value)} />
                  ))}
                </View>
              </View>

            </>
          )}

          <View className="gap-3">
            <Text className="text-lg font-semibold text-ink">{isBusiness ? 'Che eventi organizzate?' : 'I tuoi interessi'}</Text>
            <View className="flex-row flex-wrap gap-2">
              {interestOptions.map((interest) => (
                <Chip
                  key={interest}
                  label={interest}
                  selected={interests.includes(interest)}
                  onPress={() => toggleInterest(interest)}
                />
              ))}
            </View>
          </View>

          <View className="gap-3">
            {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
            <Button title="Crea account" icon="sparkles" onPress={handleSignUp} loading={loading} />
            <View className="flex-row justify-center gap-1">
              <Text className="text-stone-600">Hai già un account?</Text>
              <Link href="/login" className="font-semibold text-brand-600">
                Accedi
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthScreen>
  );
}
