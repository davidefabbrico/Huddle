// Month calendar (no libraries): used by the agenda ("Ci vado": dots on your days) and to pick a
// holiday's dates (a range). Days are "YYYY-MM-DD" keys in local time; weeks start on Monday.

import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dayKey, monthLabel } from '../lib/format';
import { Text } from './Text';

interface Props {
  month: Date; // any day of the month to show
  onMonthChange: (month: Date) => void;
  marks?: Record<string, number>; // day -> how many events (dots)
  selected?: string | null; // a single selected day
  range?: { start: string | null; end: string | null }; // a selected range (holiday dates)
  minDay?: string; // days before it can't be tapped
  onDayPress?: (day: string) => void;
}

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D'];

export function MonthCalendar({ month, onMonthChange, marks = {}, selected, range, minDay, onDayPress }: Props) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [
    ...Array<null>(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => dayKey(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ];
  while (cells.length % 7) cells.push(null);
  const weeks = Array.from({ length: cells.length / 7 }, (_, w) => cells.slice(w * 7, w * 7 + 7));
  const today = dayKey(new Date());
  const shift = (months: number) => onMonthChange(new Date(month.getFullYear(), month.getMonth() + months, 1));

  return (
    <View className="gap-2 rounded-3xl border border-stone-200 bg-white p-3">
      <View className="flex-row items-center justify-between">
        <Pressable onPress={() => shift(-1)} accessibilityRole="button" accessibilityLabel="Mese precedente" hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:bg-stone-100">
          <Ionicons name="chevron-back" size={20} className="text-ink" />
        </Pressable>
        <Text className="text-base font-semibold capitalize text-ink">{monthLabel(first)}</Text>
        <Pressable onPress={() => shift(1)} accessibilityRole="button" accessibilityLabel="Mese successivo" hitSlop={8} className="h-9 w-9 items-center justify-center rounded-full active:bg-stone-100">
          <Ionicons name="chevron-forward" size={20} className="text-ink" />
        </Pressable>
      </View>
      <View className="flex-row">
        {WEEKDAYS.map((d, i) => (
          <Text key={i} className="flex-1 text-center text-xs font-semibold text-stone-400">
            {d}
          </Text>
        ))}
      </View>
      {weeks.map((week, w) => (
        <View key={w} className="flex-row">
          {week.map((day, i) => {
            if (!day) return <View key={i} className="h-11 flex-1" />;
            const inRange = range?.start && day >= range.start && day <= (range.end ?? range.start);
            const isEdge = range && (day === range.start || day === range.end);
            const isSelected = day === selected || isEdge;
            const disabled = Boolean(minDay && day < minDay);
            const count = marks[day] ?? 0;
            return (
              <Pressable
                key={i}
                onPress={onDayPress && !disabled ? () => onDayPress(day) : undefined}
                disabled={!onDayPress || disabled}
                accessibilityRole="button"
                accessibilityLabel={`${Number(day.slice(8))}${count ? `, ${count === 1 ? '1 evento' : `${count} eventi`}` : ''}`}
                accessibilityState={{ selected: Boolean(isSelected), disabled }}
                className={`h-11 flex-1 items-center justify-center ${inRange && !isEdge ? 'bg-brand-50' : ''}`}
              >
                <View
                  className={`h-8 w-8 items-center justify-center rounded-full ${isSelected ? 'bg-brand-300' : day === today ? 'border border-brand-500' : ''}`}
                >
                  <Text
                    className={`text-sm ${isSelected ? 'font-bold text-brand-800' : disabled ? 'text-stone-300' : count ? 'font-semibold text-ink' : 'text-stone-600'}`}
                  >
                    {Number(day.slice(8))}
                  </Text>
                </View>
                {count ? <View className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full ${isSelected ? 'bg-brand-700' : 'bg-brand-400'}`} /> : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
