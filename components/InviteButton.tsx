// "Invita amici": shares the group's link (share sheet on the phone, copy on desktop browsers)

import { useState } from 'react';
import { Platform, Share } from 'react-native';
import { appUrl } from '../lib/appUrl';
import { Button } from './Button';

export function InviteButton({ groupId, groupName }: { groupId: string; groupName: string }) {
  const [copied, setCopied] = useState(false);

  async function invite() {
    const url = appUrl(`/group/${groupId}`);
    const message = `Unisciti a «${groupName}» su Huddle: ${url}`;
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
