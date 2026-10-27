// "Invita amici": shares the group's link (share sheet on the phone, copy on desktop browsers).
// Private groups share the secret invite link (/invite/<code>), public ones the group page.

import { useState } from 'react';
import { Platform, Share } from 'react-native';
import { appUrl } from '../lib/appUrl';
import type { Group } from '../lib/types';
import { Button } from './Button';

export function InviteButton({ group }: { group: Pick<Group, 'id' | 'name' | 'visibility' | 'invite_code'> }) {
  const [copied, setCopied] = useState(false);

  async function invite() {
    const isPrivate = group.visibility === 'private';
    const url = appUrl(isPrivate ? `/invite/${group.invite_code}` : `/group/${group.id}`);
    const message = isPrivate
      ? `Ti invito nel gruppo privato «${group.name}» su Huddle: ${url}`
      : `Unisciti a «${group.name}» su Huddle: ${url}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.share) {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return;
    }
    try {
      await Share.share({ message, url });
    } catch {
      // Share sheet dismissed
    }
  }

  return (
    <Button
      title={copied ? 'Link copiato ✓' : 'Invita amici'}
      icon={copied ? 'checkmark' : 'share-social-outline'}
      variant="secondary"
      onPress={invite}
    />
  );
}
