// Where you are in the welcome (signup -> interests -> about you): little squares, like pixels

import { View } from 'react-native';
import { Text } from './Text';

export function StepDots({ step, of }: { step: number; of: number }) {
  return (
    <View className="flex-row items-center gap-1.5" accessibilityLabel={`Passo ${step} di ${of}`}>
      {Array.from({ length: of }, (_, i) => (
        <View key={i} className={`h-2.5 ${i + 1 === step ? 'w-6 bg-brand-400' : i + 1 < step ? 'w-2.5 bg-brand-300' : 'w-2.5 bg-stone-200'}`} />
      ))}
      <Text className="ml-2 text-xs text-stone-500">
        Passo {step} di {of}
      </Text>
    </View>
  );
}
