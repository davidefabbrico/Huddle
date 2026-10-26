// Join flow store: the signed-in user's relationship with each group.
// Flow: "none" -> requestToJoin -> "pending" -> the admin accepts (or makes you a guest) in the app.

import { create } from 'zustand';
import * as api from '../lib/api';
import type { JoinStatus } from '../lib/types';

export type GroupAccess = 'loading' | 'none' | 'member' | JoinStatus;

interface JoinState {
  access: Record<string, GroupAccess>; // group_id -> access
  load: (userId: string, groupId: string) => Promise<void>;
  requestToJoin: (userId: string, groupId: string) => Promise<void>;
  reset: () => void;
}

// Statuses that open the lobby/chat and the event details (same rule as can_access_chat() in SQL)
export function hasChatAccess(access: GroupAccess | undefined): boolean {
  return access === 'member' || access === 'guest' || access === 'accepted';
}

export const useJoinStore = create<JoinState>((set) => {
  const setAccess = (groupId: string, value: GroupAccess) =>
    set((state) => ({ access: { ...state.access, [groupId]: value } }));

  return {
    access: {},

    load: async (userId, groupId) => {
      const [request, members] = await Promise.all([api.getJoinRequest(userId, groupId), api.getGroupMembers(groupId)]);
      if (members.some((m) => m.id === userId)) setAccess(groupId, 'member');
      else setAccess(groupId, request?.status ?? 'none');
    },

    requestToJoin: async (userId, groupId) => {
      const request = await api.requestToJoin(userId, groupId);
      setAccess(groupId, request.status);
    },

    reset: () => set({ access: {} }),
  };
});
