// Supabase client, created only when the env vars are set (see .env.example).
// Not used yet: the app runs on mock data via lib/api.ts.
// When wiring it up on native, pass an auth storage (e.g. @react-native-async-storage/async-storage)
// in createClient's `auth` options so the session survives app restarts.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// The anon key is public by design: data is protected by Row Level Security (supabase/schema.sql)
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
