// Two-step button for actions that can't be undone: the first tap shows the warning and "Conferma"

import { useState, type ComponentProps } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button } from './Button';

interface Props {
  title: string;
  confirmTitle: string;
  warning: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  onConfirm: () => Promise<void>;
}

export function ConfirmButton({ title, confirmTitle, warning, icon, onConfirm }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function confirm() {
    setError(undefined);
    setBusy(true);
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Operazione non riuscita');
      setBusy(false);
    }
  }

  if (!confirming) return <Button title={title} icon={icon} variant="muted" onPress={() => setConfirming(true)} />;

  return (
    <View className="gap-2 rounded-2xl border border-red-200 bg-red-50 p-3">
      <Text className="text-sm text-red-800">{warning}</Text>
      <View className="flex-row gap-2">
        <View className="flex-1">
          <Button title={confirmTitle} icon={icon} size="sm" loading={busy} onPress={confirm} />
        </View>
        <View className="flex-1">
          <Button title="Annulla" size="sm" variant="muted" disabled={busy} onPress={() => setConfirming(false)} />
        </View>
      </View>
      {error ? <Text className="text-sm text-red-600">{error}</Text> : null}
    </View>
  );
}
