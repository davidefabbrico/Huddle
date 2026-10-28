// A range with two handles (search: "Età" from–to). Drag a handle (touch or mouse), or with a screen
// reader swipe up/down on it. Square pixel handles, like the rest of the arcade look.
// Built on the plain responder props (no extra library): they work the same on phones and on the web.

import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from './Text';

const HANDLE = 28;

interface Props {
  min: number;
  max: number;
  low: number;
  high: number;
  onChange: (low: number, high: number) => void;
  format?: (low: number, high: number) => string; // the label above
  label: string; // for screen readers: "Età"
}

export function RangeSlider({ min, max, low, high, onChange, format, label }: Props) {
  const [width, setWidth] = useState(0);
  const at = (value: number) => (width * (value - min)) / (max - min);
  const clamp = (value: number, from: number, to: number) => Math.min(to, Math.max(from, value));

  return (
    <View className="gap-2">
      <Text className="text-base font-semibold text-ink">{format ? format(low, high) : `${low}–${high}`}</Text>
      {/* the handles' centers move on this line, half a handle in from each side */}
      <View style={{ marginHorizontal: HANDLE / 2, height: HANDLE }} className="justify-center" onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <View className="h-2 bg-stone-200" />
        <View className="absolute h-2 bg-brand-300" style={{ left: at(low), width: Math.max(0, at(high) - at(low)) }} />
        <Handle
          value={low}
          min={min}
          max={max}
          width={width}
          label={`${label}: da`}
          // both at the top end: the "from" handle must stay reachable
          onTop={low === max}
          onChange={(value) => onChange(clamp(value, min, high), high)}
        />
        <Handle
          value={high}
          min={min}
          max={max}
          width={width}
          label={`${label}: a`}
          onTop={low !== max}
          onChange={(value) => onChange(low, clamp(value, low, max))}
        />
      </View>
    </View>
  );
}

function Handle({ value, min, max, width, label, onTop, onChange }: {
  value: number;
  min: number;
  max: number;
  width: number;
  label: string;
  onTop: boolean;
  onChange: (value: number) => void;
}) {
  const start = useRef({ x: 0, value: 0 });
  const left = width ? (width * (value - min)) / (max - min) : 0;
  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      // inside a scrolling page: keep the drag, don't let the page scroll take it
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        start.current = { x: e.nativeEvent.pageX, value };
      }}
      onResponderMove={(e) => {
        if (!width) return;
        const dx = e.nativeEvent.pageX - start.current.x;
        onChange(Math.round(start.current.value + (dx / width) * (max - min)));
      }}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ min, max, now: value }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(value + (e.nativeEvent.actionName === 'increment' ? 1 : -1))}
      className="absolute items-center justify-center border-2 border-line bg-white"
      style={{ left: left - HANDLE / 2, width: HANDLE, height: HANDLE, zIndex: onTop ? 2 : 1 }}
    >
      <View className="h-2.5 w-1 bg-brand-400" />
    </View>
  );
}
