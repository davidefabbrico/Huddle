// Supabase client. URL and key come from EXPO_PUBLIC_* env vars (.env.local locally,
// GitHub Actions variables/secrets for the website). The key is the public "publishable"
// (or legacy "anon") key: data is protected by Row Level Security (supabase/schema.sql).

import './sessionStorage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// When false the app shows a "configure Supabase" screen instead of crashing
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

export const supabase = createClient(supabaseUrl || 'http://localhost', supabaseKey || 'missing-key', {
  auth: {
    storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
    autoRefreshToken: true,
    persistSession: true,
    // Web: read the session from email links (confirm account, reset password)
    detectSessionInUrl: Platform.OS === 'web',
  },
});

// iOS/Android: refresh the session only while the app is in the foreground
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
