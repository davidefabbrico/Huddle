// Opened from the "reset password" email link: choose a new password.
// Supabase signs the user in from the link; without that session the link is expired or already used.

import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '../components/Button';
import { NewPasswordForm } from '../components/NewPasswordForm';
import { AuthScreen } from '../components/AuthScreen';
import { useAuth } from '../hooks/useAuth';
import * as api from '../lib/api';
import { Text } from '../components/Text';

export default function ResetPasswordScreen() {
  const hasSession = useAuth((state) => state.user !== null);
  const finishRecovery = useAuth((state) => state.finishRecovery);
  const signOut = useAuth((state) => state.signOut);

  return (
    <AuthScreen>
      <ScrollView contentContainerClassName="flex-grow justify-center gap-6 px-6 py-10" keyboardShouldPersistTaps="handled">
        <View className="gap-1">
          <Text className="text-3xl font-bold text-ink">Nuova password</Text>
          <Text className="text-base text-stone-600">Scegli la password che userai da ora in poi.</Text>
        </View>

        {hasSession ? (
          <NewPasswordForm
            submitLabel="Salva e entra"
            onSubmit={async (password) => {
              await api.updatePassword(password);
              finishRecovery();
              router.replace('/');
            }}
          />
        ) : (
          <View className="gap-4">
            <Text className="text-base text-stone-600">
              Il link è scaduto o è già stato usato. Chiedine uno nuovo dalla pagina di accesso.
            </Text>
            <Button
              title="Torna all’accesso"
              variant="secondary"
              onPress={async () => {
                finishRecovery();
                await signOut().catch(() => undefined);
                router.replace('/login');
              }}
            />
          </View>
        )}
      </ScrollView>
    </AuthScreen>
  );
}
