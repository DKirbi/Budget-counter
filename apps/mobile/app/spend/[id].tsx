import { LogSpendScreen } from '@tbc/screens-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

/** Edit spend (modal). */
export default function EditSpend() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <LogSpendScreen spendId={id} onDone={() => router.back()} />;
}
