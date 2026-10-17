import { SummaryScreen } from '@tbc/screens-native';
import { useRouter } from 'expo-router';

/** Summary tab. */
export default function Summary() {
  const router = useRouter();
  return <SummaryScreen onCreateTrip={() => router.push('/trip/new')} />;
}
