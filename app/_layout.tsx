// Root layout: loads global Tailwind styles, restores the session and guards routes.
// Signed out -> login/signup/forgot-password; signed in -> the (app) group;
// opened the reset-password email link -> only reset-password until a new password is set.
// A link opened while signed out (invite, group, event) is reopened after signing in.

import '../global.css';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, Stack, usePathname, type Href } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SetupNeeded } from '../components/SetupNeeded';
import { colors } from '../components/theme';
import { useAuth } from '../hooks/useAuth';
import { rememberOpenedLink, takeRememberedLink } from '../lib/deepLink';
import { isSupabaseConfigured } from '../lib/supabase';

rememberOpenedLink(); // before the guard sends a signed-out visitor to the login

const AUTH_SCREENS = ['/login', '/signup', '/forgot-password', '/reset-password'];

export default function RootLayout() {
  const isSignedIn = useAuth((state) => state.user !== null);
  const initialized = useAuth((state) => state.initialized);
  const recovering = useAuth((state) => state.recovering);
  const pathname = usePathname();

  useEffect(() => {
    if (isSupabaseConfigured) return useAuth.getState().init();
  }, []);

  // Once signed in, go where the opened link pointed (unless we're already there).
  // Waits until the guard has left the login screens, or the navigation would be dropped.
  const onAuthScreen = AUTH_SCREENS.includes(pathname);
  useEffect(() => {
    if (!initialized || !isSignedIn || recovering || onAuthScreen) return;
    const link = takeRememberedLink();
    if (link && link.split('?')[0] !== pathname) router.replace(link as Href);
    // pathname is read only once the app is shown
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, isSignedIn, recovering, onAuthScreen]);

  if (!isSupabaseConfigured) return <SetupNeeded />;

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-surface">
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
