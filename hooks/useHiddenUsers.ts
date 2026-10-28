// The people you don't see (you blocked them, or they blocked you): left out of chats, member lists,
// rankings and attendees. Reloaded when the screen gains focus (after blocking someone elsewhere).

import { useAsync } from './useAsync';
import * as api from '../lib/api';

const NONE = new Set<string>();

export function useHiddenUsers(): { hidden: Set<string>; reload: () => void } {
  const data = useAsync(() => api.getHiddenUserIds(), [], { refetchOnFocus: true });
  return { hidden: data.data ?? NONE, reload: data.reload };
}
