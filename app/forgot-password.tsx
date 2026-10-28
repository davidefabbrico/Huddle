// "Password dimenticata": sends an email with a link to choose a new password (/reset-password)

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from '../components/Button';
import { Header } from '../components/Header';
import { AuthScreen } from '../components/AuthScreen';
import { TextField } from '../components/TextField';
import { colors } from '../components/theme';
import * as api from '../lib/api';
import { Text } from '../components/Text';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSend() {
    if (!email.includes('@')) return setError('Inserisci la tua email');
    setError(undefined);
    setLoading(true);
    try {
      await api.sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invio non riuscito');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreen>
      <Header title="Password dimenticata" />
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-5 px-6 py-8" keyboardShouldPersistTaps="handled">
          {sent ? (
            <View className="items-center gap-3 rounded-3xl border border-stone-200 bg-white p-6">
              <Ionicons name="mail-open-outline" size={40} color={colors.brand} />
              <Text className="text-center text-lg font-semibold text-ink">Controlla la posta</Text>
              <Text className="text-center text-stone-600">
                Se esiste un account per {email.trim()}, ti abbiamo mandato un link per scegliere una nuova password.
                Guarda anche nello spam.
              </Text>
            </View>
          ) : (
            <>
              <Text className="text-base text-stone-600">
                Scrivi l’email con cui ti sei registrato/a: ti mandiamo un link per scegliere una nuova password.
              </Text>
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="nome@email.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                onSubmitEditing={handleSend}
                testID="forgot-email"
              />
              {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
              <Button title="Mandami il link" icon="mail" onPress={handleSend} loading={loading} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </AuthScreen>
  );
}
