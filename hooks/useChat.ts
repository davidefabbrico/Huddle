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
    const load = () =>
      api.getMessages(groupId).then((latest) => {
        if (!active) return;
        setMessages((prev) => merge(latest, prev));
        setLoading(false);
      });
    // Live updates; when the subscription is ready, reload to catch anything sent while it was connecting
    const unsubscribe = api.subscribeToMessages(
      groupId,
      (message) => setMessages((prev) => merge(prev, [message])),
      load,
    );
    load();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [groupId, enabled]);

  // Shown right away; the copy coming back through the subscription is merged by id
  const send = async (userId: string, content: string) => {
    const message = await api.sendMessage(groupId, userId, content);
    setMessages((prev) => merge(prev, [message]));
    return message;
  };

  return { messages, loading, send };
}
