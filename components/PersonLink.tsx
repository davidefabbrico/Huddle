// A person's name or photo that opens their profile (app/(app)/user/[id].tsx); yours opens your Profilo

import type { ReactNode } from 'react';
import { Pressable } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../hooks/useAuth';

export function PersonLink({ userId, name, className, children }: { userId: string; name: string; className?: string; children: ReactNode }) {
  const me = useAuth((state) => state.user?.id);
  return (
    <Link href={userId === me ? '/profile' : { pathname: '/user/[id]', params: { id: userId } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`Profilo di ${name}`} className={className}>
        {children}
      </Pressable>
    </Link>
  );
}
