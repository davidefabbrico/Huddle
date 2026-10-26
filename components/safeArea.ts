// Bottom safe area (iPhone home indicator).
// Web: CSS env() directly. When the site runs as a home-screen app, the JavaScript measurement of
// react-native-safe-area-context can come out as 0, which glued the tab bar to the bottom edge.
// iOS/Android: the measured inset.

import { Platform } from 'react-native';

const WEB_BOTTOM = 'env(safe-area-inset-bottom, 0px)';

// RN types only allow numbers here; react-native-web passes CSS strings through as they are
const css = (value: string) => value as unknown as number;

// { paddingBottom } = extra + safe area
export function bottomPadding(nativeInset: number, extra = 0) {
  return Platform.OS === 'web'
    ? { paddingBottom: css(`calc(${extra}px + ${WEB_BOTTOM})`) }
    : { paddingBottom: nativeInset + extra };
}

// { height, paddingBottom } for a bar whose content is `height` tall, sitting on the safe area
export function barWithSafeArea(nativeInset: number, height: number) {
  return Platform.OS === 'web'
    ? { height: css(`calc(${height}px + ${WEB_BOTTOM})`), paddingBottom: css(WEB_BOTTOM) }
    : { height: height + nativeInset, paddingBottom: nativeInset };
}
