// Session store: the signed-in user's profile. The root layout uses it to guard routes.
// init() restores the saved session at startup and follows sign-in/out coming from
// outside the screens (email links, expired sessions).

import { Platform } from 'react-native';
import { create } from 'zustand';
import * as api from '../lib/api';
import type { SignUpInput, SignUpResult, User } from '../lib/types';
import { useJoinStore } from './useJoinStore';

interface AuthState {
  user: User | null;
  initialized: boolean; // false until the saved session has been checked
  recovering: boolean; // opened the "reset password" email link: must choose a new password
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<SignUpResult>;
  signOut: () => Promise<void>;
  updateProfile: (changes: Partial<Omit<User, 'id'>>) => Promise<void>;
  finishRecovery: () => void;
}

// Web: the reset email link points to /reset-password (see api.sendPasswordReset)
const openedFromResetLink = Platform.OS === 'web' && typeof window !== 'undefined' && window.location.pathname.endsWith('/reset-password');

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  initialized: false,
  recovering: openedFromResetLink,

  init: () => {
    api
      .getSessionUser()
      .then((user) => set({ user, initialized: true }))
      .catch(() => set({ user: null, initialized: true }));

    return api.onAuthEvent((event, userId) => {
      // Deferred: supabase-js must not be called from inside its own auth callback
      setTimeout(async () => {
        if (event === 'signed_out') {
          useJoinStore.getState().reset();
          set({ user: null, recovering: false });
          return;
        }
        if (userId && get().user?.id !== userId) set({ user: await api.getUserById(userId) });
        if (event === 'password_recovery') set({ recovering: true });
      }, 0);
    });
  },

  // Errors are thrown to the calling screen, which shows the message
  signIn: async (email, password) => {
    set({ user: await api.signIn(email, password) });
  },
  signUp: async (input) => {
    const result = await api.signUp(input);
    if (result.user) set({ user: result.user });
    return result;
  },
  signOut: async () => {
    await api.signOut();
    useJoinStore.getState().reset();
    set({ user: null, recovering: false });
  },
  updateProfile: async (changes) => {
    const user = get().user;
    if (!user) return;
    set({ user: await api.updateProfile(user.id, changes) });
  },
  finishRecovery: () => set({ recovering: false }),
}));
