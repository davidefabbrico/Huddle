// Login screen: email + password, "password dimenticata", and resend of the confirmation email

import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Link } from 'expo-router';
import { Button } from '../components/Button';
import { PasswordField } from '../components/PasswordField';
import { AuthScreen } from '../components/AuthScreen';
import { TextField } from '../components/TextField';
import { useAuth } from '../hooks/useAuth';
import * as api from '../lib/api';
import { Text } from '../components/Text';

export default function LoginScreen() {
  const signIn = useAuth((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [notConfirmed, setNotConfirmed] = useState(false);
  const [resent, setResent] = useState(false);

  // On success the route guard in app/_layout.tsx moves us to the app
  async function handleSignIn() {
    if (!email.trim() || !password) return setError('Inserisci email e password');
    setError(undefined);
    setNotConfirmed(false);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Accesso non riuscito';
      setError(message);
      setNotConfirmed(message.startsWith('Prima conferma'));
      setLoading(false);
    }
  }

  async function handleResend() {
    try {
      await api.resendConfirmation(email);
      setResent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invio non riuscito');
    }
  }

  return (
    <AuthScreen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-6 py-10" keyboardShouldPersistTaps="handled">
          {/* On a computer the brand panel of AuthScreen already shows logo and name */}
          <View className="items-center wide:hidden">
            <Image source={require('../assets/icon.png')} style={{ width: 84, height: 84, borderRadius: 6 }} accessibilityIgnoresInvertColors />
            <Text className="mt-4 font-pixel text-4xl text-ink">Huddle</Text>
            <Text className="mt-2 max-w-xs text-center text-base text-stone-600">
              Organizza eventi con i tuoi gruppi e scopri chi c’è.
            </Text>
          </View>

          <View className="gap-4">
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
              placeholder="••••••••"
              autoComplete="current-password"
              onSubmitEditing={handleSignIn}
            />
            <Link href="/forgot-password" className="self-end text-sm font-semibold text-brand-600">
              Password dimenticata?
            </Link>
            {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
            {notConfirmed ? (
              <Button
                title={resent ? 'Email inviata ✓' : 'Rimanda l’email di conferma'}
                variant="secondary"
                size="sm"
                disabled={resent}
                onPress={handleResend}
              />
            ) : null}
            <Button title="Accedi" onPress={handleSignIn} loading={loading} />
          </View>

          <View className="flex-row justify-center gap-1">
            <Text className="text-stone-600">Non hai un account?</Text>
            <Link href="/signup" className="font-semibold text-brand-600">
              Registrati
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthScreen>
  );
}
