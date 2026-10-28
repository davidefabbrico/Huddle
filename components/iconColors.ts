// Icons take their color from a class too (<Ionicons className="text-ink" />), so they follow the
// light/dark theme and the group's colors like the text does. Imported once, in app/_layout.tsx.

import { Ionicons } from '@expo/vector-icons';
import { cssInterop } from 'nativewind';

cssInterop(Ionicons, { className: { target: 'style', nativeStyleToProp: { color: true } } });
