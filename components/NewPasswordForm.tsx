// "Nuova password" + "Ripeti password", used by the reset link page and by "Cambia password"

import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from './Button';
import { PasswordField } from './PasswordField';

export const MIN_PASSWORD_LENGTH = 6; // Supabase default; raise it in Auth settings and here together

export function passwordError(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`;
  if (password !== repeat) return 'Le due password non coincidono';
  return null;
}

export function NewPasswordForm({ submitLabel, onSubmit }: { submitLabel: string; onSubmit: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit() {
    const invalid = passwordError(password, repeat);
    if (invalid) return setError(invalid);
    setError(undefined);
    setLoading(true);
    try {
      await onSubmit(password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
      setLoading(false);
    }
  }

  return (
    <View className="gap-4">
      <PasswordField
        label="Nuova password"
        value={password}
        onChangeText={setPassword}
        placeholder={`Almeno ${MIN_PASSWORD_LENGTH} caratteri`}
        autoComplete="new-password"
      />
      <PasswordField
        label="Ripeti la password"
        value={repeat}
        onChangeText={setRepeat}
        autoComplete="new-password"
        onSubmitEditing={handleSubmit}
      />
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
      <Button title={submitLabel} icon="lock-closed" onPress={handleSubmit} loading={loading} />
    </View>
  );
}
