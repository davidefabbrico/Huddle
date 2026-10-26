// Loads a group's messages and appends new ones as they arrive (realtime-style).

import { useEffect, useState } from 'react';
import * as api from '../lib/api';
import type { ChatMessageWithAuthor } from '../lib/types';

// Merge two lists by id, keeping chronological order
function merge(a: ChatMessageWithAuthor[], b: ChatMessageWithAuthor[]): ChatMessageWithAuthor[] {
  const byId = new Map([...a, ...b].map((m) => [m.id, m]));
  return [...byId.values()].sort((x, y) => x.created_at.localeCompare(y.created_at));
}

export function useChat(groupId: string, enabled: boolean) {
  const [messages, setMessages] = useState<ChatMessageWithAuthor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    // Subscribe first so nothing sent during the initial load is missed
    const unsubscribe = api.subscribeToMessages(groupId, (message) => {
      setMessages((prev) => merge(prev, [message]));
    });
    api.getMessages(groupId).then((initial) => {
      if (!active) return;
      setMessages((prev) => merge(initial, prev));
      setLoading(false);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [groupId, enabled]);

  // The new message comes back through the subscription
  const send = (userId: string, content: string) => api.sendMessage(groupId, userId, content);

  return { messages, loading, send };
}
