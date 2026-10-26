// "Cambia password" from the profile (already signed in)

import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Header } from '../../components/Header';
import { NewPasswordForm } from '../../components/NewPasswordForm';
import { Screen } from '../../components/Screen';
import * as api from '../../lib/api';

export default function ChangePasswordScreen() {
  const [done, setDone] = useState(false);

  return (
    <Screen>
      <Header title="Cambia password" />
      <ScrollView contentContainerClassName="gap-5 px-6 py-8" keyboardShouldPersistTaps="handled">
        {done ? (
          <View className="items-center gap-2 rounded-3xl bg-white p-6">
            <Text className="text-center text-lg font-semibold text-ink">Password aggiornata ✓</Text>
            <Text className="text-center text-stone-600">Usala dal prossimo accesso.</Text>
          </View>
        ) : (
          <NewPasswordForm
            submitLabel="Aggiorna password"
            onSubmit={async (password) => {
              await api.updatePassword(password);
              setDone(true);
              setTimeout(() => (router.canGoBack() ? router.back() : router.replace('/profile')), 1200);
            }}
          />
        )}
      </ScrollView>
    </Screen>
  );
}
