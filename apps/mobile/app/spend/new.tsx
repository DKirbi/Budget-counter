import { LogSpendScreen } from '@tbc/screens-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Add spend (modal). Optional `?date=YYYY-MM-DD`. */
export default function NewSpend() {
  const { date } = useLocalSearchParams<{ date?: string }>();
  const router = useRouter();
  return <LogSpendScreen initialDate={date} onDone={() => router.back()} />;
}
