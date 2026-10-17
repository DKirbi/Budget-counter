import { SettingsScreen } from '@tbc/screens-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';

/** Settings tab. */
export default function Settings() {
  const router = useRouter();
  return (
    <SettingsScreen
      onCreateTrip={() => router.push('/trip/new')}
      appVersion={Constants.expoConfig?.version}
    />
  );
}
