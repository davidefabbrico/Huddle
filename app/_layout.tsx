// Root layout: loads global Tailwind styles, restores the session and guards routes.
// Signed out -> login/signup/forgot-password; signed in -> the (app) group;
// opened the reset-password email link -> only reset-password until a new password is set.

import '../global.css';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SetupNeeded } from '../components/SetupNeeded';
import { colors } from '../components/theme';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';

export default function RootLayout() {
  const isSignedIn = useAuth((state) => state.user !== null);
  const initialized = useAuth((state) => state.initialized);
  const recovering = useAuth((state) => state.recovering);

  useEffect(() => {
    if (isSupabaseConfigured) return useAuth.getState().init();
  }, []);

  if (!isSupabaseConfigured) return <SetupNeeded />;

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-stone-50">
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={recovering}>
          <Stack.Screen name="reset-password" />
        </Stack.Protected>
        <Stack.Protected guard={isSignedIn && !recovering}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!isSignedIn && !recovering}>
          <Stack.Screen name="login" />
          <Stack.Screen name="signup" />
          <Stack.Screen name="forgot-password" />
        </Stack.Protected>
      </Stack>
    </>
  );
}
