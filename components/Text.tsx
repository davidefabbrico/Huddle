// The app's Text and TextInput: React Native's, in Chakra Petch (assets/fonts, loaded in app/_layout.tsx).
// Phones don't apply a custom font to every text by themselves, nor pick its bold from fontWeight: each
// weight is its own file. So the weight class (font-medium, font-semibold, font-bold…) chooses the file
// and is dropped. "font-pixel" (the Huddle logo) keeps its own font.

import type { ComponentProps } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';

const WEIGHT_CLASS = /\bfont-(thin|extralight|light|normal|medium|semibold|bold|extrabold|black)\b/g;

function fontFor(className: string | undefined): { family: string | null; className: string | undefined } {
  if (!className) return { family: 'ChakraPetch-Regular', className };
  if (/\bfont-pixel\b/.test(className)) return { family: null, className };
  const weight = className.match(WEIGHT_CLASS)?.at(-1)?.slice(5);
  const family =
    weight === 'bold' || weight === 'extrabold' || weight === 'black'
      ? 'ChakraPetch-Bold'
      : weight === 'semibold'
        ? 'ChakraPetch-SemiBold'
        : weight === 'medium'
          ? 'ChakraPetch-Medium'
          : 'ChakraPetch-Regular';
  return { family, className: className.replace(WEIGHT_CLASS, '').trim() };
}

// `ref` is a plain prop (React 19), passed on with the rest
export function Text({ className, style, ...props }: ComponentProps<typeof RNText> & { className?: string }) {
  const font = fontFor(className);
  return <RNText className={font.className} style={[font.family ? { fontFamily: font.family } : null, style]} {...props} />;
}

export function TextInput({ className, style, ...props }: ComponentProps<typeof RNTextInput> & { className?: string }) {
  const font = fontFor(className);
  return <RNTextInput className={font.className} style={[font.family ? { fontFamily: font.family } : null, style]} {...props} />;
}
