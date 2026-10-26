// Login screen, with one-tap demo accounts for testing the mock data

import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Button } from '../components/Button';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../components/theme';
import { useAuth } from '../hooks/useAuth';

// Must exist in mockAccounts (lib/mockData.ts)
const demoAccounts = [
  { email: 'giulia@huddle.app', label: 'Giulia', hint: 'nuova in città, cerca un gruppo' },
  { email: 'sofia@huddle.app', label: 'Sofia', hint: 'admin dei Runners dei Navigli' },
];

export default function LoginScreen() {
  const signIn = useAuth((state) => state.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // On success the route guard in app/_layout.tsx moves us to the home feed
  async function handleSignIn(withEmail = email) {
    setError(undefined);
    setLoading(true);
    try {
      await signIn(withEmail, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Accesso non riuscito');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="flex-grow justify-center gap-8 px-6 py-10" keyboardShouldPersistTaps="handled">
          <View className="items-center">
            <View className="h-20 w-20 items-center justify-center rounded-3xl bg-brand-500">
              <Ionicons name="people" size={42} color={colors.white} />
            </View>
            <Text className="mt-4 text-4xl font-bold text-ink">Huddle</Text>
            <Text className="mt-2 max-w-xs text-center text-base text-stone-600">
              Da poco in una nuova città? Non partire da zero: entra in un gruppo che esiste già.
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
            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoComplete="password"
              onSubmitEditing={() => handleSignIn()}
            />
            {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
            <Button title="Accedi" onPress={() => handleSignIn()} loading={loading} />
          </View>

          <View className="gap-2 rounded-3xl bg-brand-50 p-4">
            <Text className="text-sm font-semibold text-brand-700">Prova con un account demo</Text>
            {demoAccounts.map((account) => (
              <Pressable
                key={account.email}
                onPress={() => {
                  setEmail(account.email);
                  handleSignIn(account.email);
                }}
                disabled={loading}
                className="flex-row items-center justify-between rounded-2xl bg-white px-4 py-3 active:bg-stone-100"
              >
                <View>
                  <Text className="font-semibold text-ink">{account.label}</Text>
                  <Text className="text-xs text-stone-500">{account.hint}</Text>
                </View>
                <Ionicons name="arrow-forward" size={18} color={colors.brand} />
              </Pressable>
            ))}
          </View>

          <View className="flex-row justify-center gap-1">
            <Text className="text-stone-600">Non hai un account?</Text>
            <Link href="/signup" className="font-semibold text-brand-600">
              Registrati
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
