// Signup + onboarding: profile basics and the key choice
// "Solo looking for groups" vs "Group looking for new members"

import { useState, type ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { ArrivalPicker } from '../components/ArrivalPicker';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { Screen } from '../components/Screen';
import { TextField } from '../components/TextField';
import { colors } from '../components/theme';
import { useAuth } from '../hooks/useAuth';
import { dateMonthsAgo, intentLabels, interestOptions } from '../lib/format';
import type { UserIntent, UserRole } from '../lib/types';

const roleOptions: { value: UserRole; title: string; text: string; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { value: 'solo', title: 'Cerco un gruppo', text: 'Vorrei entrare in una compagnia già formata.', icon: 'person' },
  { value: 'group', title: 'Il mio gruppo cerca nuovi membri', text: 'Abbiamo spazio per qualcuno di nuovo.', icon: 'people' },
];

export default function SignupScreen() {
  const signUp = useAuth((state) => state.signUp);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('solo');
  const [intent, setIntent] = useState<UserIntent>('friends');
  const [isRelocated, setIsRelocated] = useState(true);
  const [relocatedAt, setRelocatedAt] = useState<string | null>(dateMonthsAgo(0));
  const [interests, setInterests] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  const toggleInterest = (interest: string) =>
    setInterests((prev) => (prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]));

  // On success the route guard in app/_layout.tsx moves us to the home feed
  async function handleSignUp() {
    if (!fullName.trim() || !email.includes('@') || password.length < 6) {
      setError('Inserisci nome, una email valida e una password di almeno 6 caratteri');
      return;
    }
    setError(undefined);
    setLoading(true);
    try {
      await signUp({
        full_name: fullName,
        email,
        password,
        role,
        intent,
        is_relocated: isRelocated,
        relocated_at: relocatedAt,
        interests,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registrazione non riuscita');
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerClassName="gap-7 px-6 py-8" keyboardShouldPersistTaps="handled">
          <View>
            <Text className="text-3xl font-bold text-ink">Ti diamo il benvenuto</Text>
            <Text className="mt-1 text-base text-stone-600">Due minuti e potrai conoscere il tuo prossimo gruppo.</Text>
          </View>

          <View className="gap-4">
            <TextField label="Nome e cognome" value={fullName} onChangeText={setFullName} placeholder="Giulia Rossi" autoComplete="name" />
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
              placeholder="Almeno 6 caratteri"
              secureTextEntry
              autoComplete="new-password"
            />
          </View>

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
                  <View className={`h-12 w-12 items-center justify-center rounded-2xl ${selected ? 'bg-brand-500' : 'bg-stone-100'}`}>
                    <Ionicons name={option.icon} size={24} color={selected ? colors.white : colors.muted} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-semibold text-ink">{option.title}</Text>
                    <Text className="text-sm text-stone-500">{option.text}</Text>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={22}
                    color={selected ? colors.brand : colors.muted}
                  />
                </Pressable>
              );
            })}
          </View>

          <View className="gap-4 rounded-3xl bg-white p-4">
            <View className="flex-row items-center justify-between gap-4">
              <View className="flex-1">
                <Text className="text-base font-semibold text-ink">Mi sono trasferito/a da poco</Text>
                <Text className="text-sm text-stone-500">Mostra il badge “Da poco in città” sul tuo profilo.</Text>
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
    </Screen>
  );
}
