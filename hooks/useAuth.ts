// Session store: the signed-in user. The root layout uses `user` to guard routes.

import { create } from 'zustand';
import * as api from '../lib/api';
import type { SignUpInput, User } from '../lib/types';
import { useJoinStore } from './useJoinStore';

interface AuthState {
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
}

// Errors are thrown to the calling screen, which shows the message
export const useAuth = create<AuthState>((set) => ({
  user: null,
  signIn: async (email, password) => {
    set({ user: await api.signIn(email, password) });
  },
  signUp: async (input) => {
    set({ user: await api.signUp(input) });
  },
  signOut: async () => {
    await api.signOut();
    useJoinStore.getState().reset();
    set({ user: null });
  },
}));
