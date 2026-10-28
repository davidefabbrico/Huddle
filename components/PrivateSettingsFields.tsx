// Private settings in "Modifica profilo" (only you see them): birth year, your area and how far
// to look, the weekly newsletter, venues' invitations. Saved in user_settings.

import { Switch, Text, View } from 'react-native';
import { DISTANCES_KM } from '../lib/search';
import type { UserSettings } from '../lib/types';
import { Chip } from './Chip';
import { InfoTip } from './InfoTip';
import { PlaceField } from './PlaceField';
import { TextField } from './TextField';
import { colors } from './theme';

interface Props {
  settings: UserSettings;
  birthYear: string; // as typed
  isBusiness: boolean;
  onBirthYear: (text: string) => void;
  onChange: (changes: Partial<UserSettings>) => void;
}

export function PrivateSettingsFields({ settings, birthYear, isBusiness, onBirthYear, onChange }: Props) {
  return (
    <View className="gap-4 rounded-3xl bg-white p-4">
      <View className="flex-row items-center gap-2">
        <Text className="text-lg font-semibold text-ink">Solo per te</Text>
        <InfoTip text="Questi dati non compaiono sul profilo: servono solo a cercare e a suggerirti eventi." />
      </View>
      {isBusiness ? null : (
        <TextField label="Anno di nascita" value={birthYear} onChangeText={onBirthYear} placeholder="Es. 1994" keyboardType="number-pad" maxLength={4} />
      )}
      <PlaceField
        label="La tua zona"
        value={{ text: settings.area ?? '', lat: settings.area_lat, lon: settings.area_lon }}
        onChange={(place) => onChange({ area: place.text || null, area_lat: place.lat, area_lon: place.lon })}
        placeholder="Es. Novoli, Firenze"
        hint="Scegli dai suggerimenti: basta il quartiere o la città, non serve l’indirizzo."
        foundHint="Zona trovata: le distanze partono da qui."
      />
      <View className="gap-2">
        <Text className="text-sm font-medium text-stone-700">“Vicino” per te è entro</Text>
        <View className="flex-row flex-wrap gap-2">
          {DISTANCES_KM.map((km) => (
            <Chip key={km} label={`${km} km`} selected={settings.search_radius_km === km} onPress={() => onChange({ search_radius_km: km })} />
          ))}
        </View>
      </View>
      <Toggle
        title="📰 Newsletter settimanale"
        text="Una volta a settimana, in Attività: gli eventi vicini a te o con i tuoi interessi."
        value={settings.newsletter}
        onChange={(newsletter) => onChange({ newsletter })}
      />
      {isBusiness ? null : (
        <Toggle
          title="📣 Inviti dei locali della zona"
          text="I locali possono far arrivare un loro evento ai gruppi vicini (spendendo i punti guadagnati)."
          value={settings.accept_promos}
          onChange={(accept_promos) => onChange({ accept_promos })}
        />
      )}
    </View>
  );
}

function Toggle({ title, text, value, onChange }: { title: string; text: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between gap-4">
      <View className="flex-1 flex-row items-center gap-2">
        <Text className="text-base font-semibold text-ink">{title}</Text>
        <InfoTip text={text} />
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: colors.brand, false: '#D6D3D1' }}
        thumbColor={colors.white}
        // react-native-web only: otherwise the "on" thumb is teal
        {...({ activeThumbColor: colors.white } as object)}
      />
    </View>
  );
}
