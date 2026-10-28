// Signup, step 1 of the welcome: just the account (who signs up, name, email, password) and the 18+
// declaration. Then the onboarding (app/(app)/welcome.tsx): interests and a bit about you, and the home
// opens on the groups "Per te".

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { passwordError } from '../components/NewPasswordForm';
import { PasswordField } from '../components/PasswordField';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { AuthScreen } from '../components/AuthScreen';
import { StepDots } from '../components/StepDots';
import { TextField } from '../components/TextField';
import { colors } from '../components/theme';
import { useAuth } from '../hooks/useAuth';
import * as api from '../lib/api';
import { MIN_AGE } from '../lib/age';
import type { AccountType } from '../lib/types';
import { Text } from '../components/Text';

export default function SignupScreen() {
  const signUp = useAuth((state) => state.signUp);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('person');
  const isBusiness = accountType === 'business';
  const [adult, setAdult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [checkEmail, setCheckEmail] = useState(false); // account created, waiting for the email link
  const [resent, setResent] = useState(false);

  // With a session the route guard in app/_layout.tsx moves us to the app (the onboarding);
  // with email confirmation on, we ask to open the link first.
  async function handleSignUp() {
    if (!fullName.trim() || !email.includes('@')) return setError('Inserisci nome e una email valida');
    const invalidPassword = passwordError(password, repeat);
    if (invalidPassword) return setError(invalidPassword);
    if (!adult) return setError(`Huddle è per chi ha almeno ${MIN_AGE} anni: conferma per continuare`);
    setError(undefined);
    setLoading(true);
    try {
      const result = await signUp({ full_name: fullName, email, password, account_type: accountType, adult });
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
          <View className="items-center gap-3 rounded-3xl border border-stone-200 bg-white p-6">
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
          <View className="gap-3">
            <StepDots step={1} of={3} />
            <View>
              <Text className="text-3xl font-bold text-ink">Crea il tuo account</Text>
              <Text className="mt-1 text-base text-stone-600">Poi ci dici cosa ti piace e ti mostriamo i gruppi giusti.</Text>
            </View>
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
          </View>

          {/* 18+: required (the database refuses the account without it) */}
          <Pressable
            onPress={() => setAdult(!adult)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: adult }}
            aria-checked={adult}
            className="flex-row items-center gap-3"
          >
            <View className={`h-6 w-6 items-center justify-center rounded border-2 ${adult ? 'border-brand-500 bg-brand-300' : 'border-stone-400 bg-white'}`}>
              {adult ? <Ionicons name="checkmark" size={16} color={colors.ink} /> : null}
            </View>
            <Text className="flex-1 text-base text-ink">
              {isBusiness ? `Chi registra il locale ha almeno ${MIN_AGE} anni` : `Ho almeno ${MIN_AGE} anni`}
            </Text>
          </Pressable>

          <View className="gap-3">
            {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
            <Button title="Continua" icon="arrow-forward" onPress={handleSignUp} loading={loading} />
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
