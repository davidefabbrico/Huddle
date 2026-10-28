// "Nuova password" + "Ripeti password", used by the reset link page and by "Cambia password"
// (which also asks for the current one first: `askCurrent`)

import { useState } from 'react';
import { View } from 'react-native';
import { Button } from './Button';
import { PasswordField } from './PasswordField';
import { Text } from './Text';

export const MIN_PASSWORD_LENGTH = 6; // Supabase default; raise it in Auth settings and here together

export function passwordError(password: string, repeat: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `La password deve avere almeno ${MIN_PASSWORD_LENGTH} caratteri`;
  if (password !== repeat) return 'Le due password non coincidono';
  return null;
}

export function NewPasswordForm({ submitLabel, askCurrent = false, onSubmit }: {
  submitLabel: string;
  askCurrent?: boolean;
  onSubmit: (password: string, current: string) => Promise<void>;
}) {
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  async function handleSubmit() {
    if (askCurrent && !current) return setError('Scrivi prima la password che usi adesso');
    const invalid = passwordError(password, repeat);
    if (invalid) return setError(invalid);
    if (askCurrent && current === password) return setError('La nuova password è uguale a quella attuale');
    setError(undefined);
    setLoading(true);
    try {
      await onSubmit(password, current);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
      setLoading(false);
    }
  }

  return (
    <View className="gap-4">
      {askCurrent ? (
        <PasswordField label="Password attuale" value={current} onChangeText={setCurrent} autoComplete="current-password" />
      ) : null}
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
